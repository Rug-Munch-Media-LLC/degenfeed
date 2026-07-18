/**
 * smart-refresh — Catching you up after returning from inactivity.
 *
 * When a user returns after >30min:
 * 1. Shows "Catching you up..." with summary of top posts
 * 2. Prioritizes posts from followed creators
 * 3. Mixes in trending since their last visit
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';

const SMART_REFRESH_THRESHOLD_MS = 30 * 60_000; // 30 minutes
const CATCHUP_MAX_POSTS = 5;
const SYNC_KEY_PREFIX = 'user:sync:';

export interface CatchUpSummary {
  triggered: boolean;
  awayMinutes: number;
  totalNewPosts: number;
  topPosts: UnifiedPost[];
  fromFollowed: UnifiedPost[];
  trendingSince: Array<{ topic: string; postCount: number }>;
}

export interface LastSync {
  timestamp: number;
  address: string;
}

function syncKey(address: string): string {
  return `${SYNC_KEY_PREFIX}${address.toLowerCase()}`;
}

export async function getLastSync(env: Env, address: string): Promise<number> {
  if (!env.CACHE || !address) return Date.now() - SMART_REFRESH_THRESHOLD_MS - 1;
  try {
    const raw = await env.CACHE.get(syncKey(address));
    if (!raw) return 0;
    const data = JSON.parse(raw) as LastSync;
    return data.timestamp || 0;
  } catch {
    return 0;
  }
}

export async function updateLastSync(env: Env, address: string): Promise<void> {
  if (!env.CACHE || !address) return;
  try {
    const data: LastSync = { timestamp: Date.now(), address: address.toLowerCase() };
    await env.CACHE.put(syncKey(address), JSON.stringify(data), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch {
    // non-critical
  }
}

export function shouldTriggerSmartRefresh(lastSync: number, now: number): boolean {
  return now - lastSync > SMART_REFRESH_THRESHOLD_MS && lastSync > 0;
}

export function buildCatchUpSummary(
  posts: UnifiedPost[],
  followed: Set<string>,
  lastSync: number,
  now: number,
): CatchUpSummary {
  const awayMinutes = Math.round((now - lastSync) / 60_000);
  const newPosts = posts.filter((p) => p.createdAt > lastSync);

  if (newPosts.length === 0) {
    return {
      triggered: false,
      awayMinutes,
      totalNewPosts: 0,
      topPosts: [],
      fromFollowed: [],
      trendingSince: [],
    };
  }

  const sorted = [...newPosts].sort((a, b) => {
    const engA =
      (a.metrics.likes ?? 0) + (a.metrics.reposts ?? 0) * 2 + (a.metrics.replies ?? 0) * 3;
    const engB =
      (b.metrics.likes ?? 0) + (b.metrics.reposts ?? 0) * 2 + (b.metrics.replies ?? 0) * 3;
    return engB - engA;
  });

  const topPosts = sorted.slice(0, CATCHUP_MAX_POSTS);

  const fromFollowed = sorted
    .filter((p) => followed.has(p.author.id))
    .slice(0, CATCHUP_MAX_POSTS);

  // Compute trending topics since last visit
  const topicCount = new Map<string, number>();
  for (const post of newPosts) {
    for (const niche of post.niches) {
      const key = niche.toLowerCase();
      topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
    }
  }

  const trendingSince = [...topicCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic: topic as string, postCount: count as number }));

  return {
    triggered: true,
    awayMinutes,
    totalNewPosts: newPosts.length,
    topPosts,
    fromFollowed,
    trendingSince,
  };
}
