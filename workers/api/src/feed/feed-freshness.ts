/**
 * feed-freshness — Feed freshness tracking, stale content deprioritization,
 * and WebSocket notifications.
 *
 * Tracks when feeds were last updated, sends WS events on new content,
 * and provides "Updated Xs ago" and "X new posts" indicators.
 * Posts older than 7 days are deprioritized unless they have high engagement.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';
import { broadcastToAll, broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { FeedType } from './feed-cache-layer';

const FRESHNESS_KEY_PREFIX = 'feed:freshness:';
const FEED_UPDATE_KEY_PREFIX = 'feed:updates:';
const FRESHNESS_TTL = 300; // 5 min

// Per-protocol high-engagement thresholds (likes + reposts*2 + replies*3)
// Scaled: 25 on Nostr is viral, 30 on Farcaster is moderate engagement
export const HIGH_ENGAGEMENT_BY_PROTOCOL: Record<string, number> = {
  nostr: 15,
  farcaster: 30,
  lens: 20,
  bluesky: 25,
  mastodon: 15,
  rss: 10,
};
export const DEFAULT_HIGH_ENGAGEMENT = 20;

export function getHighEngagementThreshold(protocol?: string): number {
  return (
    (protocol ? HIGH_ENGAGEMENT_BY_PROTOCOL[protocol.toLowerCase()] : undefined) ??
    DEFAULT_HIGH_ENGAGEMENT
  );
}

/**
 * Continuous staleness decay: 1 / (1 + log2(hours/24 + 1))
 * At 0h → 1.0, 24h → 0.5, 7d → 0.25, 30d → 0.17
 * No cliff — posts fade out gradually instead of dying at 7 days.
 */
export function computeDecayMultiplier(ageMs: number, now: number = Date.now()): number {
  const hours = (now - ageMs) / 3600000;
  if (hours <= 0) return 1.0;
  return 1 / (1 + Math.log2(hours / 24 + 1));
}

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
 * Applies continuous decay to posts. Posts are sorted by a combined
 * score: engagement * decayMultiplier. High-engagement posts resist
 * decay (engagement measured per-protocol). No hard 7-day cutoff.
 */
export function deprioritizeStaleContent(
  posts: UnifiedPost[],
  now: number = Date.now(),
): UnifiedPost[] {
  if (posts.length === 0) return posts;

  return [...posts].sort((a, b) => {
    const _aAge = now - a.createdAt;
    const _bAge = now - b.createdAt;

    const aDecay = computeDecayMultiplier(a.createdAt, now);
    const bDecay = computeDecayMultiplier(b.createdAt, now);

    const aEng =
      a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
    const bEng =
      b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);

    // High-engagement resist decay: apply per-protocol threshold
    const aThreshold = getHighEngagementThreshold(a.protocol);
    const bThreshold = getHighEngagementThreshold(b.protocol);
    const aHigh = aEng >= aThreshold;
    const bHigh = bEng >= bThreshold;

    // Composite: engagement × decay. High-engagement gets decay floor of 0.4.
    const aScore = aEng * (aHigh ? Math.max(aDecay, 0.4) : aDecay);
    const bScore = bEng * (bHigh ? Math.max(bDecay, 0.4) : bDecay);

    if (bScore !== aScore) return bScore - aScore;
    return b.createdAt - a.createdAt;
  });
}

export function classifyStalePosts(
  posts: UnifiedPost[],
  now: number = Date.now(),
): StalePostResult[] {
  return posts.map((post) => {
    const decay = computeDecayMultiplier(post.createdAt, now);
    const engTotal =
      post.metrics.likes +
      post.metrics.reposts * 2 +
      post.metrics.replies * 3 +
      (post.metrics.quotes ?? 0);
    const threshold = getHighEngagementThreshold(post.protocol);
    const isHighEngagement = engTotal >= threshold;
    const isStale = decay < 0.4; // < 40% signal remaining = stale

    return {
      post,
      isStale,
      isHighEngagement,
      deprioritized: isStale && !isHighEngagement,
    };
  });
}
