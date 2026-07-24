/**
 * feed-cache-layer — Advanced feed caching with stale-while-revalidate.
 *
 * Cache key scheme: feed:cache:{userId}:{feedType}
 *   - Anonymous users: feed:cache:anon:{feedType}
 *   - TTL: 60s for trending, 120s for home/for-you/everything
 *   - SWR: always return cache (even stale), refresh in background
 */

import type { Env } from '../index';
import { readJsonCache, writeJsonCache } from './feed-cache';

export type FeedType = 'home' | 'for-you' | 'trending' | 'everything' | 'curated';

const FEED_CACHE_TTLS: Record<FeedType, number> = {
  trending: 60,
  home: 120,
  'for-you': 120,
  everything: 120,
  curated: 60,
};

const FEED_CACHE_FRESH_MS: Record<FeedType, number> = {
  trending: 15_000, // 15s fresh
  home: 30_000, // 30s fresh
  'for-you': 30_000, // 30s fresh
  everything: 45_000, // 45s fresh
  curated: 20_000, // 20s fresh
};

export function buildFeedCacheKey(userId: string | null, feedType: FeedType): string {
  const user = userId ? userId.toLowerCase() : 'anon';
  return `feed:cache:${user}:${feedType}`;
}

export interface CachedFeedEntry {
  data: unknown;
  meta: Record<string, unknown>;
  cachedAt: number;
  feedType: FeedType;
  userId: string | null;
}

export interface CacheResult {
  type: 'hit' | 'stale' | 'miss';
  entry?: CachedFeedEntry;
}

export async function getFeedCache(
  env: Env,
  userId: string | null,
  feedType: FeedType,
): Promise<CacheResult> {
  const key = buildFeedCacheKey(userId, feedType);
  const entry = await readJsonCache<CachedFeedEntry>(env, key, `feed cache ${feedType}`);

  if (!entry) return { type: 'miss' };

  const age = Date.now() - entry.cachedAt;
  const freshMs = FEED_CACHE_FRESH_MS[feedType];

  if (age < freshMs) return { type: 'hit', entry };
  return { type: 'stale', entry };
}

export async function setFeedCache(
  env: Env,
  userId: string | null,
  feedType: FeedType,
  data: unknown,
  meta: Record<string, unknown>,
): Promise<void> {
  const key = buildFeedCacheKey(userId, feedType);
  const ttl = FEED_CACHE_TTLS[feedType];

  const entry: CachedFeedEntry = {
    data,
    meta,
    cachedAt: Date.now(),
    feedType,
    userId,
  };

  await writeJsonCache(env, key, entry, ttl, `feed cache ${feedType}`);
}

export async function invalidateFeedCache(
  env: Env,
  userId: string | null,
  feedType?: FeedType,
): Promise<void> {
  if (!env.CACHE) return;

  if (feedType) {
    const key = buildFeedCacheKey(userId, feedType);
    try {
      await env.CACHE.delete(key);
    } catch {
      // non-critical
    }
    return;
  }

  // Invalidate all feed types for user
  const types: FeedType[] = ['home', 'for-you', 'trending', 'everything', 'curated'];
  for (const type of types) {
    try {
      const key = buildFeedCacheKey(userId, type);
      await env.CACHE.delete(key);
    } catch {
      // non-critical
    }
  }

  // Also invalidate anonymous caches
  try {
    const anonTypes: FeedType[] = ['trending', 'everything'];
    for (const type of anonTypes) {
      const key = buildFeedCacheKey(null, type);
      await env.CACHE.delete(key);
    }
  } catch {
    // non-critical
  }
}

export function getCacheTTL(feedType: FeedType): number {
  return FEED_CACHE_TTLS[feedType];
}

export function getCacheFreshMs(feedType: FeedType): number {
  return FEED_CACHE_FRESH_MS[feedType];
}
