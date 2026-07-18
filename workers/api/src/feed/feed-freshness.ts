/**
 * feed-freshness — Feed freshness tracking, stale content deprioritization,
 * and WebSocket notifications.
 *
 * Tracks when feeds were last updated, sends WS events on new content,
 * and provides "Updated Xs ago" and "X new posts" indicators.
 * Posts older than 7 days are deprioritized unless they have high engagement.
 */

import type { Env } from '../index';
import type { UnifiedPost } from '@degenfeed/types';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { FeedType } from './feed-cache-layer';

const FRESHNESS_KEY_PREFIX = 'feed:freshness:';
const FEED_UPDATE_KEY_PREFIX = 'feed:updates:';
const FRESHNESS_TTL = 300; // 5 min

// Stale content thresholds
export const STALE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const HIGH_ENGAGEMENT_THRESHOLD = 25; // likes + reposts*2 + replies*3

export interface StalePostResult {
  post: UnifiedPost;
  isStale: boolean;
  isHighEngagement: boolean;
  deprioritized: boolean;
}

export interface FeedFreshnessEntry {
  lastUpdated: number;
  lastPostTimestamp: number;
  totalPosts: number;
  feedType: FeedType;
}

export function freshnessKey(feedType: FeedType): string {
  return `${FRESHNESS_KEY_PREFIX}${feedType}`;
}

export function userUpdatesKey(userId: string): string {
  return `${FEED_UPDATE_KEY_PREFIX}${userId.toLowerCase()}`;
}

export async function updateFeedFreshness(
  env: Env,
  feedType: FeedType,
  posts: Array<{ createdAt: number }>,
): Promise<FeedFreshnessEntry> {
  const entry: FeedFreshnessEntry = {
    lastUpdated: Date.now(),
    lastPostTimestamp: posts.length > 0 ? Math.max(...posts.map((p) => p.createdAt)) : 0,
    totalPosts: posts.length,
    feedType,
  };

  if (env.CACHE) {
    try {
      await env.CACHE.put(freshnessKey(feedType), JSON.stringify(entry), {
        expirationTtl: FRESHNESS_TTL,
      });
    } catch {
      // non-critical
    }
  }

  return entry;
}

export async function getFeedFreshness(
  env: Env,
  feedType: FeedType,
): Promise<FeedFreshnessEntry | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(freshnessKey(feedType));
    if (!raw) return null;
    return JSON.parse(raw) as FeedFreshnessEntry;
  } catch {
    return null;
  }
}

export function computeFreshnessMeta(
  entry: FeedFreshnessEntry | null,
  now: number,
): {
  updatedSecondsAgo: number;
  updatedLabel: string;
} {
  if (!entry) {
    return { updatedSecondsAgo: 0, updatedLabel: 'just now' };
  }

  const seconds = Math.floor((now - entry.lastUpdated) / 1000);

  let label: string;
  if (seconds < 10) label = 'just now';
  else if (seconds < 60) label = `Updated ${seconds}s ago`;
  else if (seconds < 3600) label = `Updated ${Math.floor(seconds / 60)}m ago`;
  else label = `Updated ${Math.floor(seconds / 3600)}h ago`;

  return { updatedSecondsAgo: seconds, updatedLabel: label };
}

export function computeNewPostsSince(
  lastVisit: number,
  posts: Array<{ createdAt: number }>,
): number {
  if (lastVisit <= 0) return 0;
  return posts.filter((p) => p.createdAt > lastVisit).length;
}

export async function broadcastFeedUpdate(
  feedType: FeedType,
  data: { newPostCount: number; timestamp: number },
): Promise<void> {
  broadcastToAll(`feed:${feedType}` as typeof CHANNELS.FEED_UPDATE, {
    type: 'feed:update',
    feedType,
    ...data,
  });
}

export async function broadcastFreshContent(
  userId: string | null,
  post: { id: string; title?: string; protocol: string },
): Promise<void> {
  const payload = {
    type: 'fresh:content',
    post,
  };

  if (userId) {
    broadcastToUser(userId, CHANNELS.FEED_NEW, payload);
  }
  broadcastToAll(CHANNELS.FEED_NEW, payload);
}

// ─── Stale content deprioritization ──────────────────────────────

/**
 * Flags posts older than 7 days as stale, unless they have high engagement.
 * High engagement posts are preserved regardless of age.
 * Stale posts are moved to the end of the list.
 */
export function deprioritizeStaleContent(
  posts: UnifiedPost[],
  now: number = Date.now(),
  maxAgeMs: number = STALE_AGE_MS,
  engagementThreshold: number = HIGH_ENGAGEMENT_THRESHOLD,
): UnifiedPost[] {
  const fresh: UnifiedPost[] = [];
  const staleHighEngagement: UnifiedPost[] = [];
  const staleLowEngagement: UnifiedPost[] = [];

  for (const post of posts) {
    const ageMs = now - post.createdAt;
    const isStale = ageMs > maxAgeMs;

    if (!isStale) {
      fresh.push(post);
      continue;
    }

    const engTotal =
      post.metrics.likes +
      post.metrics.reposts * 2 +
      post.metrics.replies * 3 +
      (post.metrics.quotes ?? 0);

    if (engTotal >= engagementThreshold) {
      staleHighEngagement.push(post);
    } else {
      staleLowEngagement.push(post);
    }
  }

  // Fresh first, then high-engagement stale, then low-engagement stale
  return [...fresh, ...staleHighEngagement, ...staleLowEngagement];
}

export function classifyStalePosts(
  posts: UnifiedPost[],
  now: number = Date.now(),
): StalePostResult[] {
  return posts.map((post) => {
    const ageMs = now - post.createdAt;
    const isStale = ageMs > STALE_AGE_MS;
    const engTotal =
      post.metrics.likes +
      post.metrics.reposts * 2 +
      post.metrics.replies * 3 +
      (post.metrics.quotes ?? 0);
    const isHighEngagement = engTotal >= HIGH_ENGAGEMENT_THRESHOLD;

    return {
      post,
      isStale,
      isHighEngagement,
      deprioritized: isStale && !isHighEngagement,
    };
  });
}
