/**
 * @degenfeed/api-worker — Live Aggregator Health Tracking
 *
 * Tracks source health and provides KV cache helpers.
 */

import { edgeCacheGet, edgeCachePut } from '../lib/edge-cache';
import type { Env } from '../types';
import type { LiveSource, SourceHealth, UnifiedLiveStream } from './live-aggregator-types';

// ─── KV Key Helpers ─────────────────────────────────────

export function liveCacheKey(): string {
  return 'live:aggregated';
}

export function upcomingCacheKey(): string {
  return 'live:upcoming';
}

function sourceHealthKey(): string {
  return 'live:source-health';
}

export function viewerKey(streamId: string): string {
  return `live:viewers:${streamId}`;
}

export function scheduleKey(id: string): string {
  return `live:schedule:${id}`;
}

export function creatorScheduleIndexKey(creatorId: string): string {
  return `live:schedule:creator:${creatorId.toLowerCase()}`;
}

// ─── Cached Aggregation ─────────────────────────────────
// Stored via the edge Cache API (primary) with KV as a migration fallback.

export async function getAggregatedCache(env: Env): Promise<UnifiedLiveStream[] | null> {
  try {
    const raw = await edgeCacheGet(env, liveCacheKey());
    if (!raw) return null;
    return JSON.parse(raw) as UnifiedLiveStream[];
  } catch {
    return null;
  }
}

export async function setAggregatedCache(
  env: Env,
  streams: UnifiedLiveStream[],
  ttl = 15,
): Promise<void> {
  await edgeCachePut(env, liveCacheKey(), JSON.stringify(streams), ttl);
}

// ─── Source Health Tracking ─────────────────────────────

export async function trackSourceHealth(
  env: Env,
  source: LiveSource,
  streamCount: number,
  latencyMs: number,
  error?: string,
): Promise<void> {
  try {
    const key = sourceHealthKey();
    const raw = await env.CACHE?.get(key);
    const health: Record<string, SourceHealth> = raw ? JSON.parse(raw) : {};

    health[source] = {
      source,
      healthy: !error,
      lastChecked: Date.now(),
      error,
      streamCount,
      latencyMs,
    };

    await env.CACHE?.put(key, JSON.stringify(health), { expirationTtl: 300 });
  } catch {
    // Non-critical
  }
}

export async function getSourceHealth(env: Env): Promise<Record<string, SourceHealth>> {
  try {
    const raw = await env.CACHE?.get(sourceHealthKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
