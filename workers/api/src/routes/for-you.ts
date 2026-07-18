/**
 * /api/feed/for-you — AI-powered personalized feed
 *
 * Reads the user's behavior profile from KV, boosts posts matching
 * their learned interests, and falls back to the standard scored feed
 * for new users (onboarding mode).
 *
 * Also provides topic preference management endpoints so users can
 * fine-tune the AI's learned preferences.
 */

import {
  adjustTopicWeight,
  clearTopic,
  emptyBehaviorProfile,
  getLearnedTopics,
  isOnboardingMode,
  personalizeScore,
  type UserBehaviorProfile,
} from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
  applyUserFilters,
  cachedJsonResponse,
  collectProviderResults,
  computeAllAuthorStats,
  computeFreshnessMeta,
  computeTrending,
  deduplicateCrossProtocol,
  FEED_GENERATION_TIMEOUT_MS,
  feedCacheKey,
  fetchFromProviders,
  getCachedFeed,
  getCircuitStatus,
  getFeedCache,
  getLastSync,
  buildCatchUpSummary,
  loadUserRankingContext,
  predictEngagementBoost,
  prefersEnglish,
  prepareBasePosts,
  ProviderTimer,
  scoreAndRank,
  setCachedFeed,
  setFeedCache,
  shouldTriggerSmartRefresh,
  updateFeedFreshness,
  updateLastSync,
  writePostsToKV,
} from '../feed';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession, verifySessionCookie } from '../session';
import { DEFAULT_PROTOCOLS } from './feed';
import { mergePreferences, parseCookiePrefs, parsePrefsFromQuery } from '../feed/feed-scorer';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

// ─── KV helpers ─────────────────────────────────────────────────────

function behaviorKey(address: string): string {
  return `user:behavior:${address.toLowerCase()}`;
}

async function readBehavior(env: Env, address: string): Promise<UserBehaviorProfile> {
  try {
    const raw = await env.CACHE?.get(behaviorKey(address));
    if (raw) return JSON.parse(raw) as UserBehaviorProfile;
  } catch {
    /* ignore */
  }
  return emptyBehaviorProfile();
}

async function writeBehavior(
  env: Env,
  address: string,
  profile: UserBehaviorProfile,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(behaviorKey(address), JSON.stringify(profile), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
  } catch {
    console.warn('[for-you] KV write failed');
  }
}

/**
 * Extract the session cookie and decode the wallet address.
 * Returns null if the user is not authenticated.
 */
async function sessionAddress(
  request: Request,
  env: Env,
): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match || !env.AUTH_SECRET) return null;
  const cookieValue = match.slice('__Host-dfid='.length);
  const payload = await verifySessionCookie(cookieValue, env.AUTH_SECRET);
  return payload?.address ?? null;
}

// ─── For You feed handler ──────────────────────────────────────────

async function generateForYouFeed(
  request: Request,
  env: Env,
  execCtx: ExecCtx | undefined,
  userId: string | null,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';
  const cookieHeader = request.headers.get('cookie') ?? '';
  const now = Date.now();

  const userCtx = await loadUserRankingContext(request, env);
  const address = await sessionAddress(request, env);
  const behaviorProfile = address ? await readBehavior(env, address) : null;
  const isOnboarding = !behaviorProfile || isOnboardingMode(behaviorProfile);

  const feedStartTime = Date.now();
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const fetchResults = await Promise.race([
    fetchFromProviders(env, requestedProtocols, limit, notices, execCtx, timer),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`feed generation timeout after ${FEED_GENERATION_TIMEOUT_MS}ms`)),
        FEED_GENERATION_TIMEOUT_MS,
      ),
    ),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'feed generation timed out';
    notices.push(msg);
    console.warn('[for-you]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // Cross-protocol dedup
  const dedupResult = deduplicateCrossProtocol(allPosts);
  const deduped = prepareBasePosts(dedupResult.posts, {
    category,
    type: params.get('type') || '',
  });
  void writePostsToKV(env, deduped);

  const allowNonCrypto =
    params.get('allowNonCrypto') === 'true' || userCtx.preferences?.allowNonCrypto === true;
  const relevant = applyUserFilters(deduped, {
    mutedAuthors: userCtx.mutedAuthors,
    mutedWords: userCtx.mutedWords,
    allowNonCrypto,
    preferEnglish: prefersEnglish(
      params.get('lang') || '',
      request.headers.get('accept-language') || '',
    ),
  });

  // Engagement prediction boost
  const authorStats = computeAllAuthorStats(relevant);
  const computedTrendingSet = new Set<string>();
  const trending = await computeTrending(relevant, Number(params.get('trending')) || 24);
  for (const t of trending) {
    computedTrendingSet.add(t.topic.toLowerCase());
  }

  const predictionBoosts = new Map<string, number>();
  for (const post of relevant) {
    const stats = authorStats.get(post.author.id);
    const pred = predictEngagementBoost({
      post,
      authorStats: stats,
      trendingTopics: computedTrendingSet,
      now,
    });
    predictionBoosts.set(post.id, pred.boost);
  }

  const mergedPrefs = mergePreferences(null, userCtx.preferences, null);
  const { ranked, topOfHour, nextCursor, debug } = await scoreAndRank(env, relevant, {
    prefs: mergedPrefs,
    followed: userCtx.followed,
    sort: 'scored',
    diverse: params.get('diverse') !== 'false',
    limit,
    cursor,
    direction,
    hideLowQuality:
      params.get('hideLowQuality') === 'true' || userCtx.preferences?.hideLowQuality === true,
    hideLowQualityThreshold:
      Number(params.get('hideLowQualityThreshold')) ||
      userCtx.preferences?.hideLowQualityThreshold ||
      1.0,
    showOriginalContent:
      params.get('showOriginalContent') === 'true' ||
      userCtx.preferences?.showOriginalContent === true,
    minEngagement: Number(params.get('minEngagement')) || userCtx.preferences?.minEngagement || 0,
    maxPerNiche: Number(params.get('maxPerNiche')) || userCtx.preferences?.maxPerNiche || 5,
    interleaveProtocols:
      params.get('interleaveProtocols') !== 'false' &&
      (userCtx.preferences?.interleaveProtocols ?? true),
  });

  // Personalization
  let finalRanked: UnifiedPost[] = ranked;
  let boostApplied = false;
  let personalizationReasons: string[] = [];

  if (!isOnboarding && behaviorProfile) {
    const personalized: Array<UnifiedPost & { _boost: number; _reasons: string[] }> = ranked.map(
      (post) => {
        const { boost, reasons } = personalizeScore(post, behaviorProfile);
        const mergedReasons = [...(post.score?.reasons ?? []), ...reasons];
        return {
          ...post,
          score: post.score ? { ...post.score, reasons: mergedReasons } : undefined,
          _boost: boost,
          _reasons: reasons,
        };
      },
    );
    personalized.sort((a, b) => {
      const baseA = a.score?.total ?? 0;
      const baseB = b.score?.total ?? 0;
      return baseB + b._boost - (baseA + a._boost);
    });
    boostApplied = true;
    for (const post of personalized.slice(0, 3)) {
      personalizationReasons.push(...post._reasons);
    }
    finalRanked = personalized.map(({ _boost, _reasons, ...clean }) => clean);
  }

  // Smart refresh
  let catchUp = null;
  if (userId) {
    const lastSync = await getLastSync(env, userId);
    if (shouldTriggerSmartRefresh(lastSync, now)) {
      catchUp = buildCatchUpSummary(finalRanked, userCtx.followed, lastSync, now);
    }
    void updateLastSync(env, userId);
  }

  // Freshness
  const freshnessEntry = await updateFeedFreshness(env, 'for-you', finalRanked);
  const freshnessMeta = computeFreshnessMeta(freshnessEntry, now);

  const feedElapsed = Date.now() - feedStartTime;
  const responseBody = {
    data: finalRanked,
    meta: {
      total: finalRanked.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      topOfHour,
      nextCursor,
      sort: 'for-you',
      fetchedAt: now,
      freshness: {
        updatedLabel: freshnessMeta.updatedLabel,
        updatedSecondsAgo: freshnessMeta.updatedSecondsAgo,
      },
      dedup: {
        crossProtocol: dedupResult.crossProtocol,
        urlDedup: dedupResult.urlDedup,
        totalRemoved: dedupResult.deduped,
      },
      catchUp: catchUp && catchUp.triggered
        ? {
            triggered: true,
            awayMinutes: catchUp.awayMinutes,
            totalNewPosts: catchUp.totalNewPosts,
            topPostIds: catchUp.topPosts.map((p) => p.id),
            trendingSince: catchUp.trendingSince,
          }
        : undefined,
      personalization: {
        hasProfile: !!behaviorProfile,
        boostApplied,
        isOnboarding,
        reasons: [...new Set(personalizationReasons)].slice(0, 5),
      },
    },
  };

  if (!cursor) void setFeedCache(env, userId, 'for-you', responseBody, responseBody.meta);
  const resp = cachedJsonResponse(responseBody);

  const circuitStatus = await getCircuitStatus(env, requestedProtocols);
  const circuitParts = Object.entries(circuitStatus).map(([p, s]) => `${p}=${s}`);
  const debugParts = [
    `feed-generation=${(feedElapsed / 1000).toFixed(1)}s`,
    `timeout=${(FEED_GENERATION_TIMEOUT_MS / 1000).toFixed(0)}s`,
    `personalized=${boostApplied},onboarding=${isOnboarding},profile=${!!behaviorProfile}`,
    `dedup=cross=${dedupResult.crossProtocol},url=${dedupResult.urlDedup}`,
    `engagement-prediction=${predictionBoosts.size > 0 ? 'active' : 'inactive'}`,
    `freshness=${freshnessMeta.updatedLabel}`,
    catchUp?.triggered ? `catchup=${catchUp.awayMinutes}m,${catchUp.totalNewPosts}new` : '',
  ];
  if (timer.getResults().length > 0) {
    debugParts.push(`timings=${timer.toDebugString()}`);
  }
  if (circuitParts.length > 0) {
    debugParts.push(`circuits=${circuitParts.join(',')}`);
  }
  resp.headers.set('X-DegenFeed-Debug', debugParts.filter(Boolean).join(' | '));
  return resp;
}

export async function handleForYouFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const userId = await sessionAddress(request, env);

  // SWR cache: return stale immediately, generate fresh in background
  if (!params.get('cursor')) {
    const cacheResult = await getFeedCache(env, userId, 'for-you');
    if (cacheResult.type === 'hit' && cacheResult.entry) {
      const resp = cachedJsonResponse(cacheResult.entry, 200, 30);
      resp.headers.set(
        'X-DegenFeed-Debug',
        `cache=hit,cachedAt=${new Date(cacheResult.entry.cachedAt).toISOString()}`,
      );
      return resp;
    }
    if (cacheResult.type === 'stale' && cacheResult.entry) {
      if (execCtx?.waitUntil) {
        execCtx.waitUntil(
          generateForYouFeed(request, env, execCtx, userId).catch(() => {}),
        );
      } else {
        void generateForYouFeed(request, env, execCtx, userId);
      }
      const resp = cachedJsonResponse(cacheResult.entry, 200, 30);
      resp.headers.set(
        'X-DegenFeed-Debug',
        `cache=stale(swr),cachedAt=${new Date(cacheResult.entry.cachedAt).toISOString()},background=refresh`,
      );
      return resp;
    }
  }

  return generateForYouFeed(request, env, execCtx, userId);
}

// ─── Topic preference management endpoints ─────────────────────────

export async function handleGetTopics(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const profile = await readBehavior(env, session.address);
  const topics = getLearnedTopics(profile);

  return noCacheJsonResponse({ topics });
}

export async function handleAdjustTopic(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { topic?: string; delta?: number } = {};
  try {
    body = (await request.json()) as { topic?: string; delta?: number };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const topic = body.topic?.toLowerCase().trim();
  if (!topic) return jsonResponse({ error: 'topic required' }, 400);
  const delta = typeof body.delta === 'number' ? body.delta : 0.2;

  let profile = await readBehavior(env, session.address);
  profile = adjustTopicWeight(profile, topic, delta);
  await writeBehavior(env, session.address, profile);

  return noCacheJsonResponse({ ok: true, topics: getLearnedTopics(profile) });
}

export async function handleClearTopic(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { topic?: string } = {};
  try {
    body = (await request.json()) as { topic?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const topic = body.topic?.toLowerCase().trim();
  if (!topic) return jsonResponse({ error: 'topic required' }, 400);

  let profile = await readBehavior(env, session.address);
  profile = clearTopic(profile, topic);
  await writeBehavior(env, session.address, profile);

  return noCacheJsonResponse({ ok: true });
}
