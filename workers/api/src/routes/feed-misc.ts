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
  const limit = Math.min(Number(params.get('limit')) || 25, 100);
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
      meta: { total: 0, limit, subreddit: subreddit || 'all', error: 'Reddit provider failed' },
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
  const valid = new Set<Protocol>(DEFAULT_PROTOCOLS);
  if (!valid.has(provider as Protocol)) {
    return jsonResponse({ error: 'Unknown provider' }, 400);
  }
  const protocol = provider as Protocol;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 25, 100);

  try {
    const feedProvider = getProvider(protocol, env);
    const result = await feedProvider.fetchFeed({
      timeoutMs: DEFAULT_TIMEOUT_MS,
      concurrency: 4,
    });
    const posts = sanitizePosts(result.posts).slice(0, limit);
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
