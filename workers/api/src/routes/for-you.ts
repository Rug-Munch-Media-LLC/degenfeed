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
  feedCacheKey,
  fetchFromProviders,
  getCachedFeed,
  loadUserRankingContext,
  prefersEnglish,
  prepareBasePosts,
  scoreAndRank,
  setCachedFeed,
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

export async function handleForYouFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  // 1. Parse request params
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const cursor = Number(params.get('cursor')) || 0;
  const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';
  const cookieHeader = request.headers.get('cookie') ?? '';

  // 2. Load user profile + ranking context
  const userCtx = await loadUserRankingContext(request, env);
  const address = await sessionAddress(request, env);
  const behaviorProfile = address ? await readBehavior(env, address) : null;
  const isOnboarding = !behaviorProfile || isOnboardingMode(behaviorProfile);

  // 3. Feed pipeline: fetch → enrich → score
  const cacheKey = feedCacheKey(requestedProtocols, category, 'for-you');
  if (!cursor) {
    const cached = await getCachedFeed(env, cacheKey);
    if (cached) {
      return cachedJsonResponse(cached);
    }
  }

  const notices: string[] = [];
  const results = await fetchFromProviders(env, requestedProtocols, limit, notices, execCtx);
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(results);

  const allowNonCrypto =
    params.get('allowNonCrypto') === 'true' || userCtx.preferences?.allowNonCrypto === true;
  const deduped = prepareBasePosts(allPosts, { category, type: params.get('type') || '' });
  void writePostsToKV(env, deduped);
  const relevant = applyUserFilters(deduped, {
    mutedAuthors: userCtx.mutedAuthors,
    mutedWords: userCtx.mutedWords,
    allowNonCrypto,
    preferEnglish: prefersEnglish(
      params.get('lang') || '',
      request.headers.get('accept-language') || '',
    ),
  });

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

  // 4. Apply personalization if we have a learned profile
  let finalRanked: UnifiedPost[] = ranked;
  let boostApplied = false;
  let personalizationReasons: string[] = [];

  if (!isOnboarding && behaviorProfile) {
    const personalized: Array<UnifiedPost & { _boost: number; _reasons: string[] }> = ranked.map((post) => {
      const { boost, reasons } = personalizeScore(post, behaviorProfile);
      const mergedReasons = [...(post.score?.reasons ?? []), ...reasons];
      return {
        ...post,
        score: post.score ? { ...post.score, reasons: mergedReasons } : undefined,
        _boost: boost,
        _reasons: reasons,
      };
    });

    // Re-rank by base score + personalization boost
    personalized.sort((a, b) => {
      const baseA = a.score?.total ?? 0;
      const baseB = b.score?.total ?? 0;
      return baseB + b._boost - (baseA + a._boost);
    });

    boostApplied = true;
    for (const post of personalized.slice(0, 3)) {
      personalizationReasons.push(...post._reasons);
    }

    // Strip internal fields
    finalRanked = personalized.map(({ _boost, _reasons, ...clean }) => clean);
  }

  // 5. Build response
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
      fetchedAt: Date.now(),
      personalization: {
        hasProfile: !!behaviorProfile,
        boostApplied,
        isOnboarding,
        reasons: [...new Set(personalizationReasons)].slice(0, 5),
      },
    },
  };

  if (!cursor) void setCachedFeed(env, cacheKey, responseBody);
  const resp = cachedJsonResponse(responseBody);
  resp.headers.set(
    'X-DegenFeed-Debug',
    `personalized=${boostApplied},onboarding=${isOnboarding},profile=${!!behaviorProfile}`,
  );
  return resp;
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
