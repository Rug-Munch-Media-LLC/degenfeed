/**
 * Auxiliary feed routes — single-provider feeds, Reddit proxy, and
 * provider health. Split from routes/feed.ts (re-exported there for
 * backward compatibility); the home-feed orchestrator lives in
 * routes/feed.ts.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
  checkProvidersHealth,
  DEFAULT_PROTOCOLS,
  DEFAULT_TIMEOUT_MS,
  fetchRedditPosts,
  getProvider,
  readCachedHealth,
  readJsonCache,
  sanitizePosts,
  writeCachedHealth,
  writeJsonCache,
} from '../feed';
import { type Env, jsonResponse } from '../index';

export async function handleRedditFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const subreddit = params.get('subreddit');
  const limit = Math.min(Number(params.get('limit')) || 50, 200);
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
    return jsonResponse({
      data: [],
      meta: {
        total: 0,
        limit,
        subreddit: subreddit || 'all',
        error: 'Reddit provider failed',
      },
    });
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
  if (!valid.has(provider as Protocol)) {
    // If not in DEFAULT_PROTOCOLS, try BridgeFeedProvider anyway
    const { BridgeFeedProvider } = await import('../feed/feed-fetcher');
    const bridgeProvider = new BridgeFeedProvider(provider as Protocol, env);
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Number(params.get('limit')) || 50, 200);
    try {
      const result = await bridgeProvider.fetchFeed({ timeoutMs: 6000 });
      if (result.posts.length === 0) {
        return jsonResponse({
          data: [],
          meta: {
            total: 0,
            limit,
            protocol: provider,
            notice: result.notice,
            fetchedAt: Date.now(),
          },
        });
      }
      return jsonResponse({
        data: result.posts.slice(0, limit),
        meta: { total: result.posts.length, limit, protocol: provider, fetchedAt: Date.now() },
      });
    } catch (err) {
      return jsonResponse(
        {
          error: `Bridge provider failed for ${provider}: ${err instanceof Error ? err.message : 'unknown'}`,
        },
        502,
      );
    }
  }
  const protocol = provider as Protocol;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 50, 200);

  try {
    const feedProvider = getProvider(protocol, env);
    const result = await feedProvider.fetchFeed({
      timeoutMs: DEFAULT_TIMEOUT_MS,
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
    const message = err instanceof Error ? err.message : 'Provider fetch failed';
    console.error('[feed] provider feed fetch failed:', err instanceof Error ? err.message : err);
    return jsonResponse({ error: message }, 502);
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
