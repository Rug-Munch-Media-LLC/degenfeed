/**
 * Feed routes — thin orchestrator over the feed pipeline layers.
 *
 * Pipeline: fetch (providers + circuit breakers) → dedup (cross-protocol)
 * → enrich (spam, mutes, language) → score (ranking v2 + velocity +
 * engagement prediction) → cache (KV, SWR, per-user).
 * Layer implementations live in src/feed/; auxiliary routes (reddit,
 * single provider, health) live in ./feed-misc.
 */

import { PRESET_NAMES, type PresetName, resolvePreset } from '@degenfeed/feed-core';
import { parseProtocols } from '@degenfeed/utils';
import {
  ALL_CATEGORIES,
  applyCurationPipeline,
  applyUserFilters,
  broadcastFeedUpdate,
  buildCatchUpSummary,
  cachedJsonResponse,
  collectProviderResults,
  computeAllAuthorStats,
  computeFreshnessMeta,
  computeTrending,
  countNewSinceLastVisit,
  DEFAULT_PROTOCOLS,
  deduplicateCrossProtocol,
  deprioritizeStaleContent,
  enrichNostrEngagement,
  FEED_GENERATION_TIMEOUT_MS,
  type FeedType,
  feedCacheKey,
  fetchFromProviders,
  getCategoryCounts,
  getCircuitStatus,
  getFeedCache,
  getLastSync,
  invalidateFeedCache,
  loadUserRankingContext,
  mergePreferences,
  ProviderTimer,
  parseCookiePrefs,
  parsePrefsFromQuery,
  predictEngagementBoost,
  prefersEnglish,
  prepareBasePosts,
  scoreAndRank,
  setCachedFeed,
  setFeedCache,
  shouldTriggerSmartRefresh,
  updateFeedFreshness,
  updateLastSync,
  verifyDiversity,
  writePostsToKV,
} from '../feed';
import { type Env, jsonResponse } from '../index';
import { verifySessionCookie } from '../session';
import { TRENDING_CACHE_KEY } from './trending-scraper';

// Backward-compatible re-exports for stream.ts, newsletter.ts, app.ts, and tests.
export { DEFAULT_PROTOCOLS, getProvider } from '../feed';
export {
  handleFeedHealth,
  handleProviderFeed,
  handleRedditFeed,
} from './feed-misc';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

async function resolveUserId(request: Request, env: Env): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match || !env.AUTH_SECRET) return null;
  const cookieValue = match.slice('__Host-dfid='.length);
  try {
    const payload = await verifySessionCookie(cookieValue, env.AUTH_SECRET);
    return payload?.address ?? null;
  } catch {
    return null;
  }
}

async function handleCachedFeed(
  request: Request,
  env: Env,
  execCtx: ExecCtx | undefined,
  feedType: FeedType,
): Promise<Response> {
  const feedStartTime = Date.now();
  const params = new URL(request.url).searchParams;
  const now = Date.now();
  const userId = await resolveUserId(request, env);

  const isTrending = feedType === 'trending';
  const _isEverything = feedType === 'everything';

  // 1. Check per-user cache (SWR pattern)
  if (!params.get('cursor')) {
    const cacheResult = await getFeedCache(env, userId, feedType);
    if (cacheResult.type === 'hit' && cacheResult.entry) {
      const resp = cachedJsonResponse(cacheResult.entry, 200, isTrending ? 15 : 30);
      resp.headers.set(
        'X-DegenFeed-Debug',
        `cache=hit,cachedAt=${new Date(cacheResult.entry.cachedAt).toISOString()},feed-generation=${((now - feedStartTime) / 1000).toFixed(3)}s`,
      );
      return resp;
    }
    if (cacheResult.type === 'stale' && cacheResult.entry) {
      // Return stale immediately, refresh in background
      if (execCtx?.waitUntil) {
        execCtx.waitUntil(
          generateAndCacheFeed(request, env, execCtx, feedType, userId).catch(() => {}),
        );
      } else {
        void generateAndCacheFeed(request, env, execCtx, feedType, userId);
      }
      const resp = cachedJsonResponse(cacheResult.entry, 200, isTrending ? 15 : 30);
      resp.headers.set(
        'X-DegenFeed-Debug',
        `cache=stale(swr),cachedAt=${new Date(cacheResult.entry.cachedAt).toISOString()},background=refresh,feed-generation=${((now - feedStartTime) / 1000).toFixed(3)}s`,
      );
      return resp;
    }
  }

  // 2. Miss: generate fresh feed
  return generateAndCacheFeed(request, env, execCtx, feedType, userId);
}

async function generateAndCacheFeed(
  request: Request,
  env: Env,
  execCtx: ExecCtx | undefined,
  feedType: FeedType,
  userId: string | null,
): Promise<Response> {
  const feedStartTime = Date.now();
  const params = new URL(request.url).searchParams;
  const cookieHeader = request.headers.get('cookie') ?? '';
  const now = Date.now();

  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const sort = params.get('sort') || 'scored';
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';

  // Resolve protocols
  const protocolsParam = params.get('protocols');
  const requestedProtocols = protocolsParam
    ? parseProtocols(protocolsParam, DEFAULT_PROTOCOLS)
    : DEFAULT_PROTOCOLS;

  // 3. Fetch from providers
  const notices: string[] = [];
  const timer = new ProviderTimer();
  const results = await Promise.race([
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
    console.warn('[feed]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(results);

  // 4. Cross-protocol content deduplication
  const dedupResult = deduplicateCrossProtocol(allPosts);
  const deduped = prepareBasePosts(dedupResult.posts, {
    category,
    type: params.get('type') || '',
  });
  void writePostsToKV(env, deduped);

  // 5. Per-user filtering
  const userCtx = await loadUserRankingContext(request, env);
  const allowNonCrypto =
    params.get('allowNonCrypto') === 'true' || userCtx.preferences?.allowNonCrypto === true;
  const relevant = applyUserFilters(deduped, {
    mutedAuthors: userCtx.mutedAuthors,
    mutedWords: userCtx.mutedWords,
    mutedCommunities: userCtx.mutedCommunities,
    blockedCommunities: userCtx.blockedCommunities,
    allowNonCrypto,
    preferEnglish: prefersEnglish(
      params.get('lang') || '',
      request.headers.get('accept-language') || '',
    ),
  });
  await enrichNostrEngagement(relevant);

  // 6. Engagement prediction for ranking boost
  const authorStats = computeAllAuthorStats(relevant);
  const trendingSet = new Set<string>();
  const computedTrending = await computeTrending(relevant, Number(params.get('trending')) || 24);
  for (const t of computedTrending) {
    trendingSet.add(t.topic.toLowerCase());
  }

  const predictedBoosts = new Map<string, number>();
  for (const post of relevant) {
    const stats = authorStats.get(post.author.id);
    const prediction = predictEngagementBoost({
      post,
      authorStats: stats,
      trendingTopics: trendingSet,
      now,
    });
    predictedBoosts.set(post.id, prediction.boost);
  }

  // 7. Quality preset
  const activeProtocol = protocolsParam?.split(',')?.filter(Boolean)?.[0] ?? null;
  let presetName: PresetName = 'balanced';
  const presetParam = params.get('preset');
  if (presetParam && (PRESET_NAMES as readonly string[]).includes(presetParam)) {
    presetName = presetParam as PresetName;
  } else if (userCtx.preferences?.presetName) {
    presetName = userCtx.preferences.presetName;
  }
  const resolvedPreset = resolvePreset(presetName, activeProtocol ?? undefined);

  // 8. Score and rank
  const mergedPrefs = mergePreferences(
    parsePrefsFromQuery(params),
    userCtx.preferences,
    parseCookiePrefs(cookieHeader),
  );
  const { ranked, topOfHour, nextCursor, debug } = await scoreAndRank(env, relevant, {
    prefs: mergedPrefs,
    followed: userCtx.followed,
    sort,
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
    presetName,
    resolvedPreset,
  });

  // 8b. Apply curation pipeline: freshness boost, protocol interleaving,
  //     content type variety, and category rotation
  const curationOpts = {
    freshnessBoost: params.get('freshnessBoost') !== 'false',
    interleaveProtocols: params.get('interleaveProtocols') !== 'false',
    maxConsecutiveProtocols: Number(params.get('maxConsecutiveProtocols')) || 2,
    contentTypeVariety: params.get('contentTypeVariety') !== 'false',
    maxConsecutiveContentType: Number(params.get('maxConsecutiveContentType')) || 3,
    categoryRotation: params.get('categoryRotation') !== 'false',
    minCategories: Number(params.get('minCategories')) || 3,
    now,
  };
  const curated = applyCurationPipeline(ranked, curationOpts);

  // 8c. Deprioritize stale content (>7 days old, low engagement)
  const freshnessSorted = deprioritizeStaleContent(curated, now);

  // 9. Smart refresh — catch up returning users
  let catchUp = null;
  if (userId) {
    const lastSync = await getLastSync(env, userId);
    if (shouldTriggerSmartRefresh(lastSync, now)) {
      catchUp = buildCatchUpSummary(freshnessSorted, userCtx.followed, lastSync, now);
    }
    void updateLastSync(env, userId);
  }

  // 10. Feed freshness tracking
  const freshnessEntry = await updateFeedFreshness(env, feedType, freshnessSorted);
  const freshnessMeta = computeFreshnessMeta(freshnessEntry, now);

  // 11. Trending Now (best-effort)
  let trendingNow: Array<Record<string, unknown>> = [];
  try {
    const raw = await env.CACHE?.get(TRENDING_CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as {
        platforms: Record<string, { items: Array<Record<string, unknown>> }>;
      };
      const items: Array<Record<string, unknown>> = [];
      for (const p of Object.values(data.platforms)) {
        if (p.items) items.push(...p.items);
      }
      items.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
      trendingNow = items.slice(0, 5);
    }
  } catch {
    // non-critical
  }

  if (freshnessSorted.length === 0 && errors.length > 0) {
    return jsonResponse({
      data: [],
      meta: {
        total: 0,
        limit,
        perProtocol,
        errors,
        notices,
        fetchedAt: now,
        freshness: freshnessMeta,
        note: relevant.length === 0 ? 'No relevant posts found' : 'All sources failed or filtered',
      },
    });
  }

  // 12. Build response with coverage audit
  const feedElapsed = Date.now() - feedStartTime;
  const categoryCounts = getCategoryCounts(freshnessSorted);
  const diversityCheck = verifyDiversity(freshnessSorted);
  const responseBody = {
    data: freshnessSorted,
    meta: {
      total: freshnessSorted.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      trending: computedTrending,
      trendingNow: trendingNow.length > 0 ? trendingNow : undefined,
      topOfHour,
      nextCursor,
      sort,
      presetName,
      presetLabel: resolvedPreset.profile.label,
      newSinceLastVisit: countNewSinceLastVisit(cookieHeader, freshnessSorted),
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
      categoryCoverage: {
        counts: categoryCounts,
        uniqueCategories: diversityCheck.uniqueCategories,
        dominantCategory: diversityCheck.dominantCategory,
        dominantPct: diversityCheck.dominantPct,
        sufficientlyDiverse: diversityCheck.diverse,
      },
      catchUp: catchUp?.triggered
        ? {
            triggered: true,
            awayMinutes: catchUp.awayMinutes,
            totalNewPosts: catchUp.totalNewPosts,
            topPostIds: catchUp.topPosts.map((p) => p.id),
            trendingSince: catchUp.trendingSince,
          }
        : undefined,
    },
  };

  // 13. Cache the result
  if (!cursor) {
    void setFeedCache(env, userId, feedType, responseBody, responseBody.meta);
  }
  // Legacy cache for backward compat
  if (!cursor) {
    const legacyKey = feedCacheKey(requestedProtocols, category, sort);
    await setCachedFeed(env, legacyKey, responseBody);
  }

  const resp = cachedJsonResponse(responseBody, 200, feedType === 'trending' ? 15 : 30);

  // Debug header
  const circuitStatus = await getCircuitStatus(env, requestedProtocols);
  const circuitParts = Object.entries(circuitStatus).map(([p, s]) => `${p}=${s}`);
  const slowProviderParts = timer.getSlowProviders().map((t) => `${t.protocol}=${t.durationMs}ms`);
  const debugParts = [
    `feed-generation=${(feedElapsed / 1000).toFixed(1)}s`,
    `timeout=${(FEED_GENERATION_TIMEOUT_MS / 1000).toFixed(0)}s`,
    `cache=miss`,
    `dedup=cross=${dedupResult.crossProtocol},url=${dedupResult.urlDedup}`,
    `engagement-prediction=${predictedBoosts.size > 0 ? 'active' : 'inactive'}`,
    `freshness=${freshnessMeta.updatedLabel}`,
    catchUp?.triggered ? `catchup=${catchUp.awayMinutes}m,${catchUp.totalNewPosts}new` : '',
  ];
  if (timer.getResults().length > 0) {
    debugParts.push(`timings=${timer.toDebugString()}`);
  }
  if (circuitParts.length > 0) {
    debugParts.push(`circuits=${circuitParts.join(',')}`);
  }
  if (slowProviderParts.length > 0) {
    debugParts.push(`slow=${slowProviderParts.join(',')}`);
  }
  debugParts.push(
    `spam=${debug.avgSpam.toFixed(2)},quality=${debug.avgQuality.toFixed(0)},reputation=${debug.avgReputation.toFixed(0)},velocity=${debug.avgVelocity.toFixed(0)}`,
  );
  debugParts.push(
    `categories=${diversityCheck.uniqueCategories}/${ALL_CATEGORIES.length},dominant=${diversityCheck.dominantCategory ?? 'none'}=${diversityCheck.dominantPct}%`,
  );

  resp.headers.set('X-DegenFeed-Debug', debugParts.filter(Boolean).join(' | '));

  // Broadcast feed update via WebSocket
  void broadcastFeedUpdate(feedType, {
    newPostCount: freshnessSorted.length,
    timestamp: now,
  });

  return resp;
}

export async function handleHomeFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  return handleCachedFeed(request, env, execCtx, 'home');
}

export async function handleTrendingFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('protocols', DEFAULT_PROTOCOLS.join(','));
  return handleCachedFeed(new Request(url.toString()), env, execCtx, 'trending');
}

export async function handleCategoryFeed(
  request: Request,
  env: Env,
  category: string,
  execCtx?: ExecCtx,
): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set('category', category);
  return handleCachedFeed(new Request(url.toString()), env, execCtx, 'home');
}

// ─── Cache management endpoints ────────────────────────────────────

export async function handleFeedCacheInvalidate(request: Request, env: Env): Promise<Response> {
  const userId = await resolveUserId(request, env);
  const params = new URL(request.url).searchParams;
  const feedType = (params.get('type') ?? undefined) as FeedType | undefined;

  await invalidateFeedCache(env, userId, feedType);
  return jsonResponse({
    ok: true,
    userId,
    feedType,
    invalidatedAt: Date.now(),
  });
}
