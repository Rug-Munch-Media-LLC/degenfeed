/**
 * feed-freshness — Feed freshness tracking and WebSocket notifications.
 *
 * Tracks when feeds were last updated, sends WS events on new content,
 * and provides "Updated Xs ago" and "X new posts" indicators.
 */

import type { Env } from '../index';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { FeedType } from './feed-cache-layer';

const FRESHNESS_KEY_PREFIX = 'feed:freshness:';
const FEED_UPDATE_KEY_PREFIX = 'feed:updates:';
const FRESHNESS_TTL = 300; // 5 min

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
