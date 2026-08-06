/**
 * Auxiliary feed routes — single-provider feeds, Reddit proxy, and
 * provider health. Split from routes/feed.ts (re-exported there for
 * backward compatibility); the home-feed orchestrator lives in
 * routes/feed.ts.
 */

import { PolymarketProvider } from '@degenfeed/feed-providers';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
  checkProvidersHealth,
  DEFAULT_PROTOCOLS,
  DEFAULT_TIMEOUT_MS,
  fetchRedditPosts,
  getProvider,
  PROVIDER_TIMEOUTS,
  readCachedHealth,
  readJsonCache,
  sanitizePosts,
  writeCachedHealth,
  writeJsonCache,
} from '../feed';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

/**
 * GET /api/feed/polymarket — Polymarket prediction markets sorted by volume.
 *
 * Returns the PolymarketProvider feed (markets + odds + volume) with the
 * posts re-sorted by volume (24h volume desc). Distinct from the generic
 * `/api/feed/:provider` catch-all so the frontend gets a stable,
 * volume-sorted market list.
 */
export async function handlePolymarketFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 100);
  const cacheKey = `polymarket:v1:${limit}`;
  const cached = await readJsonCache<unknown>(env, cacheKey, 'polymarket cache read');
  if (cached) return jsonResponse(cached);

  const provider = new PolymarketProvider({});
  const result = await provider.fetchFeed({ timeoutMs: DEFAULT_TIMEOUT_MS, concurrency: 2 });

  // Sort by volume desc (metrics.likes holds 24h/rolling volume)
  const sorted = sanitizePosts(result.posts).sort(
    (a, b) => (b.metrics.likes ?? 0) - (a.metrics.likes ?? 0),
  );
  const posts = sorted.slice(0, limit);

  const response = {
    data: posts,
    meta: {
      protocol: 'polymarket',
      total: posts.length,
      limit,
      notice: result.notice,
      sort: 'volume',
      fetchedAt: Date.now(),
    },
  };
  await writeJsonCache(env, cacheKey, response, 120, 'polymarket cache write');
  return jsonResponse(response);
}

export async function handleRedditFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const subreddit = params.get('subreddit');
  const limit = Math.min(Number(params.get('limit')) || 50, 100);
  const cacheKey = `reddit:v1:${subreddit || 'all'}:${limit}`;
  const cached = await readJsonCache<unknown>(env, cacheKey, 'reddit cache read');
  if (cached) return jsonResponse(cached);

  let posts: UnifiedPost[] = [];
  let notice: string | undefined;
  try {
    const result = await fetchRedditPosts(env, subreddit);
    posts = result.posts.slice(0, limit);
    notice = result.notice;
  } catch (err) {
    console.error('[feed] Reddit provider fetch failed:', err instanceof Error ? err.message : err);
    // Never serve demo/seed content — return an explicit empty result
    return jsonResponse({
      data: [],
      meta: {
        total: 0,
        limit,
        subreddit: subreddit || 'all',
        isDemo: false,
        source: 'direct',
        error: 'Reddit provider failed',
        fetchedAt: Date.now(),
      },
    });
  }

  // Never serve demo/seed content if all real sources failed
  if (posts.length === 0) {
    const response = {
      data: [],
      meta: {
        total: 0,
        limit,
        subreddit: subreddit || 'all',
        isDemo: false,
        source: 'direct',
        notice: notice || 'Reddit returned empty',
        fetchedAt: Date.now(),
      },
    };
    await writeJsonCache(env, cacheKey, response, 180, 'reddit cache write');
    return jsonResponse(response);
  }

  const response = {
    data: posts,
    meta: {
      total: posts.length,
      limit,
      subreddit: subreddit || 'all',
      notice,
      fetchedAt: Date.now(),
    },
  };
  await writeJsonCache(env, cacheKey, response, 180, 'reddit cache write');
  return jsonResponse(response);
}

export async function handleProviderFeed(
  request: Request,
  env: Env,
  provider: string,
): Promise<Response> {
  // Accept ANY protocol — falls through to BridgeFeedProvider for unregistered ones
  const valid = new Set<Protocol>(DEFAULT_PROTOCOLS);
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 100);

  // Helper: serve an explicit empty result when real content is unavailable
  // (never demo/seed content)
  async function serveEmptyFallback(reason: string): Promise<Response> {
    return jsonResponse({
      data: [],
      meta: {
        total: 0,
        limit,
        protocol: provider,
        isDemo: false,
        source: 'direct',
        notice: reason,
        fetchedAt: Date.now(),
      },
    });
  }

  if (!valid.has(provider as Protocol)) {
    // If not in DEFAULT_PROTOCOLS, try BridgeFeedProvider anyway
    const { BridgeFeedProvider } = await import('../feed/feed-fetcher');
    const bridgeProvider = new BridgeFeedProvider(provider as Protocol, env);
    try {
      const result = await bridgeProvider.fetchFeed({ timeoutMs: 6000 });
      if (result.posts.length === 0) {
        return serveEmptyFallback(result.notice || `Bridge returned empty for ${provider}`);
      }
      return jsonResponse({
        data: result.posts.slice(0, limit),
        meta: { total: result.posts.length, limit, protocol: provider, fetchedAt: Date.now() },
      });
    } catch (err) {
      return serveEmptyFallback(
        `Bridge provider failed for ${provider}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
  const protocol = provider as Protocol;

  try {
    const feedProvider = getProvider(protocol, env);
    const result = await feedProvider.fetchFeed({
      timeoutMs: PROVIDER_TIMEOUTS[protocol] ?? DEFAULT_TIMEOUT_MS,
      concurrency: 4,
    });
    let posts = sanitizePosts(result.posts).slice(0, limit);

    // Fallback: if primary provider returned 0, try BridgeFeedProvider
    if (posts.length === 0) {
      const { BridgeFeedProvider } = await import('../feed/feed-fetcher');
      const bridgeProvider = new BridgeFeedProvider(protocol, env);
      try {
        const bridgeResult = await bridgeProvider.fetchFeed({ timeoutMs: 6000 });
        posts = sanitizePosts(bridgeResult.posts).slice(0, limit);
        if (posts.length > 0) {
          return jsonResponse({
            data: posts,
            meta: {
              total: posts.length,
              limit,
              protocol,
              source: 'bridge-fallback',
              fetchedAt: Date.now(),
            },
          });
        }
      } catch {
        /* bridge also unavailable */
      }
    }

    // Never serve demo/seed content if all real sources failed
    if (posts.length === 0) {
      return serveEmptyFallback(result.notice || `Provider ${provider} returned empty`);
    }

    return jsonResponse({
      data: posts,
      meta: {
        total: posts.length,
        limit,
        protocol,
        notice: result.notice,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    // Final fallback: try bridge
    try {
      const { BridgeFeedProvider } = await import('../feed/feed-fetcher');
      const bridgeProvider = new BridgeFeedProvider(protocol, env);
      const bridgeResult = await bridgeProvider.fetchFeed({ timeoutMs: 6000 });
      const posts = sanitizePosts(bridgeResult.posts).slice(0, limit);
      if (posts.length > 0) {
        return jsonResponse({
          data: posts,
          meta: {
            total: posts.length,
            limit,
            protocol,
            source: 'bridge-fallback',
            fetchedAt: Date.now(),
          },
        });
      }
    } catch {
      /* bridge unavailable */
    }

    // Ultimate fallback: explicit empty result (never demo/seed content)
    return serveEmptyFallback(
      `Provider ${provider} failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

export async function handleFeedHealth(_request: Request, env: Env): Promise<Response> {
  const cacheKey = 'health:v2:default';
  const cached = await readCachedHealth(env, cacheKey);
  if (cached) return jsonResponse(cached);

  const health = await checkProvidersHealth(env);
  const body = { health, checkedAt: Date.now() };
  await writeCachedHealth(env, cacheKey, body);
  return jsonResponse(body);
}
