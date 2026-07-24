/**
 * /api/feed/curated — Smarter addictive feed endpoint.
 *
 * Applies: seen tracking, freshness bias, explore/exploit, engagement
 * prediction, scroll depth adaptation, and content variety enforcement.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import {
  applyUserFilters,
  cachedJsonResponse,
  collectProviderResults,
  curateFeed,
  DEFAULT_PROTOCOLS,
  enrichNostrEngagement,
  FEED_GENERATION_TIMEOUT_MS,
  fetchFromProviders,
  getCircuitStatus,
  loadBehaviorProfile,
  loadPreviousEngagement,
  loadScrollProfile,
  loadSeenPosts,
  loadUserRankingContext,
  mergePreferences,
  ProviderTimer,
  parseCookiePrefs,
  parsePrefsFromQuery,
  prefersEnglish,
  prepareBasePosts,
  recordScrollDepth,
  recordSeenPosts,
  storeBehaviorProfile,
  updateStreak,
  writePostsToKV,
} from '../feed';
import type { Env } from '../index';
import { jsonResponse } from '../index';
import { verifySessionCookie } from '../session';

type ExecCtx = { waitUntil: (p: Promise<unknown>) => void };

async function sessionAddress(request: Request, env: Env): Promise<string | null> {
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

async function loadEngagedCreators(env: Env, wallet: string): Promise<Set<string>> {
  if (!env.CACHE || !wallet) return new Set();
  try {
    const raw = await env.CACHE.get(`user:engaged_creators:${wallet.toLowerCase()}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function handleCuratedFeed(
  request: Request,
  env: Env,
  execCtx?: ExecCtx,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = parseProtocols(params.get('protocols'), DEFAULT_PROTOCOLS);
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
  const category = params.get('category')?.toLowerCase() ?? '';
  const cookieHeader = request.headers.get('cookie') ?? '';

  // 1. Load user state
  const userCtx = await loadUserRankingContext(request, env);
  const wallet = await sessionAddress(request, env);
  const seenPosts = wallet ? await loadSeenPosts(env, wallet) : new Set<string>();
  const scrollProfile = wallet ? await loadScrollProfile(env, wallet) : undefined;
  const engagedCreators = wallet ? await loadEngagedCreators(env, wallet) : new Set<string>();
  const behaviorProfile = wallet ? await loadBehaviorProfile(env, wallet) : undefined;
  if (behaviorProfile) updateStreak(behaviorProfile);

  // 2. Fetch from providers with timeout + circuit tracking
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
    console.warn('[curated]', msg);
    return [] as Awaited<ReturnType<typeof fetchFromProviders>>;
  });
  const { posts: allPosts, errors, perProtocol } = collectProviderResults(fetchResults);

  // 3. Enrich
  const deduped = prepareBasePosts(allPosts, {
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
  await enrichNostrEngagement(relevant);

  // 4. Pre-scoring for existing score infrastructure
  const mergedPrefs = mergePreferences(
    parsePrefsFromQuery(params),
    userCtx.preferences,
    parseCookiePrefs(cookieHeader),
  );

  // Compute basic score for posts that don't have one yet
  const now = Date.now();
  for (const post of relevant) {
    if (!post.score) {
      const ageHours = (now - post.createdAt) / 3600000;
      const recency = Math.max(0, 1 - ageHours / 48);
      const likes = post.metrics.likes ?? 0;
      const reposts = post.metrics.reposts ?? 0;
      const replies = post.metrics.replies ?? 0;
      const quotes = post.metrics.quotes ?? 0;
      const engagementScore = likes * 1 + reposts * 2 + replies * 3 + quotes * 2;
      post.score = {
        total: Math.round((recency * 3 + engagementScore) * 10) / 10,
        recency: Math.round(recency * 10) / 10,
        engagement: engagementScore,
        relevance: 0,
        quality: 0,
        diversity: 0,
        source: 0,
        velocity: 0,
        reasons: [],
      };
    }
  }

  // 5. Curate with all the new algorithms
  const rawNiches: string[] = (mergedPrefs as any)?.preferredNiches ?? [];
  const preferredNiches: Set<string> = new Set(rawNiches.map((n: string) => n.toLowerCase()));
  const preferredContentTypes = new Set(params.get('contentTypes')?.split(',') ?? []);

  const previousEngagement = wallet
    ? await loadPreviousEngagement(env, relevant as UnifiedPost[])
    : undefined;

  const curated = curateFeed(relevant as UnifiedPost[], seenPosts, {
    wallet: wallet ?? undefined,
    limit,
    followed: userCtx.followed,
    preferredNiches,
    preferredContentTypes,
    engagedCreators,
    scrollProfile,
    behaviorProfile,
    previousEngagement,
  });

  // 6. Record seen posts and persist behavior profile (fire-and-forget)
  if (wallet && curated.posts.length > 0) {
    void recordSeenPosts(
      env,
      wallet,
      curated.posts.map((p) => p.id),
    );
    if (behaviorProfile) {
      void storeBehaviorProfile(env, wallet, behaviorProfile);
    }
  }

  if (curated.posts.length === 0 && errors.length > 0) {
    return jsonResponse({
      data: [],
      meta: {
        total: 0,
        limit,
        perProtocol,
        errors,
        notices,
        fetchedAt: now,
        curation: curated.meta,
      },
    });
  }

  // 7. Respond
  const responseBody = {
    data: curated.posts,
    meta: {
      total: curated.posts.length,
      limit,
      perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: now,
      curation: curated.meta,
      personalization: {
        hasProfile: !!wallet,
        seenTracking: seenPosts.size > 0,
        adaptedLimit: curated.meta.adjustedLimit !== limit,
      },
    },
  };

  const resp = cachedJsonResponse(responseBody, 200, 15);

  // Enhanced debug header with timing and circuit info
  const feedElapsed = Date.now() - feedStartTime;
  const circuitStatus = await getCircuitStatus(env, requestedProtocols);
  const circuitParts = Object.entries(circuitStatus).map(([p, s]) => `${p}=${s}`);
  const debugParts = [
    `feed-generation=${(feedElapsed / 1000).toFixed(1)}s`,
    `timeout=${(FEED_GENERATION_TIMEOUT_MS / 1000).toFixed(0)}s`,
    `curated=true,seenFiltered=${curated.meta.seenFiltered},explore=${curated.meta.exploreCount},exploit=${curated.meta.exploitCount},freshness=${curated.meta.freshnessBoosts},ratio=${curated.meta.exploreRatio?.exploitPct ?? 0.8}/${curated.meta.exploreRatio?.explorePct ?? 0.2},temporal=${curated.meta.temporal ?? 'unknown'},streak=${curated.meta.dopamine?.streakCount ?? 0}`,
  ];
  if (timer.getResults().length > 0) {
    debugParts.push(`timings=${timer.toDebugString()}`);
  }
  if (circuitParts.length > 0) {
    debugParts.push(`circuits=${circuitParts.join(',')}`);
  }
  resp.headers.set('X-DegenFeed-Debug', debugParts.join(' | '));
  return resp;
}

// ─── Scroll depth recording endpoint ─────────────────────────────────

export async function handleScrollDepth(request: Request, env: Env): Promise<Response> {
  const wallet = await sessionAddress(request, env);
  if (!wallet) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body: { depth?: number; bounced?: boolean };
  try {
    body = (await request.json()) as { depth?: number; bounced?: boolean };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (typeof body.depth !== 'number' || body.depth < 0) {
    return jsonResponse({ error: 'depth must be a non-negative number' }, 400);
  }

  const profile = await recordScrollDepth(env, wallet, body.depth, body.bounced === true);

  return jsonResponse({
    ok: true,
    profile: {
      avgDepth: Math.round(profile.avgDepth),
      maxDepth: profile.maxDepth,
      sessions: profile.sessions,
      bounceRate: Math.round(profile.bounceRate * 100) / 100,
    },
  });
}

// ─── Mark posts as seen ──────────────────────────────────────────────

export async function handleMarkSeen(request: Request, env: Env): Promise<Response> {
  const wallet = await sessionAddress(request, env);
  if (!wallet) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body: { postIds?: string[] };
  try {
    body = (await request.json()) as { postIds?: string[] };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postIds || !Array.isArray(body.postIds) || body.postIds.length === 0) {
    return jsonResponse({ error: 'postIds array required' }, 400);
  }

  if (body.postIds.length > 200) {
    return jsonResponse({ error: 'max 200 postIds per request' }, 400);
  }

  await recordSeenPosts(env, wallet, body.postIds);

  return jsonResponse({ ok: true, count: body.postIds.length });
}

// ─── Record engagement feedback for prediction learning ──────────────

export async function handleEngagementFeedback(request: Request, env: Env): Promise<Response> {
  const wallet = await sessionAddress(request, env);
  if (!wallet || !env.CACHE) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body: { creatorId?: string; postId?: string; engaged?: boolean };
  try {
    body = (await request.json()) as {
      creatorId?: string;
      postId?: string;
      engaged?: boolean;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (body.creatorId && body.engaged) {
    const key = `user:engaged_creators:${wallet.toLowerCase()}`;
    try {
      const raw = await env.CACHE.get(key);
      const creators: string[] = raw ? JSON.parse(raw) : [];
      if (!creators.includes(body.creatorId)) {
        creators.push(body.creatorId);
        await env.CACHE.put(key, JSON.stringify(creators.slice(-200)), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
      }
    } catch {
      /* non-critical */
    }
  }

  return jsonResponse({ ok: true });
}
