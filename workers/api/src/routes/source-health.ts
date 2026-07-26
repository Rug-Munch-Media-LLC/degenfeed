/**
 * @degenfeed/api-worker — Source Health, Trending & Stale Detection
 *
 * Extends the source-discovery system with ongoing health monitoring,
 * trending detection, and stale source flagging for the auto-discovery v2.
 *
 * KV keys:
 *   discovered:sources:health:{sourceId}     — SourceHealth JSON
 *   discovered:sources:health:index          — JSON array of sourceIds with tracking
 *   discovered:sources:trending:cached       — TrendingSource[] cache (1h TTL)
 *   discovered:sources:new-week-cache        — DiscoveredSource[] for new this week
 *   discovered:sources:culled                — JSON array of culled source IDs
 *   discovered:sources:last-health-check     — ISO timestamp
 */

import {
  aggregateStats,
  buildTrendingSource,
  computeSourceHealthScore,
  type DiscoveredSource,
  getNewThisWeek,
  type SourceHealth,
  type SourceLifecycle,
  type TrendingSource,
} from '@degenfeed/feed-providers';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── KV keys ──────────────────────────────────────────────────────────

function healthKey(sourceId: string): string {
  return `discovered:sources:health:${sourceId}`;
}

const HEALTH_INDEX_KEY = 'discovered:sources:health:index';
const TRENDING_CACHE_KEY = 'discovered:sources:trending:cached';
const _NEW_WEEK_KEY = 'discovered:sources:new-week-cache';
const CULLED_KEY = 'discovered:sources:culled';
const LAST_CHECK_KEY = 'discovered:sources:last-health-check';
const LAST_RUN_KEY = 'discovered:sources:discovery:last-run';

// ─── Health data helpers ──────────────────────────────────────────────

async function getHealthIndex(env: Env): Promise<string[]> {
  try {
    const raw = await env.CACHE?.get(HEALTH_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function saveHealthIndex(env: Env, ids: string[]): Promise<void> {
  await env.CACHE?.put(HEALTH_INDEX_KEY, JSON.stringify(ids), {
    expirationTtl: 86400 * 90,
  });
}

async function getHealth(env: Env, sourceId: string): Promise<SourceHealth | null> {
  try {
    const raw = await env.CACHE?.get(healthKey(sourceId));
    return raw ? (JSON.parse(raw) as SourceHealth) : null;
  } catch {
    return null;
  }
}

async function saveHealth(env: Env, health: SourceHealth): Promise<void> {
  await env.CACHE?.put(healthKey(health.sourceId), JSON.stringify(health), {
    expirationTtl: 86400 * 90,
  });
}

async function getAllHealth(env: Env): Promise<SourceHealth[]> {
  const ids = await getHealthIndex(env);
  const healthEntries: SourceHealth[] = [];
  for (const id of ids) {
    const h = await getHealth(env, id);
    if (h) healthEntries.push(h);
  }
  return healthEntries;
}

async function _getCulledIds(env: Env): Promise<string[]> {
  try {
    const raw = await env.CACHE?.get(CULLED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// ─── Source load helpers ──────────────────────────────────────────────

async function getAllSources(env: Env): Promise<DiscoveredSource[]> {
  try {
    const raw = await env.CACHE?.get('discovered:sources:all');
    return raw ? (JSON.parse(raw) as DiscoveredSource[]) : [];
  } catch {
    return [];
  }
}

async function _getPendingSources(env: Env): Promise<DiscoveredSource[]> {
  try {
    const raw = await env.CACHE?.get('discovered:sources:pending');
    return raw ? (JSON.parse(raw) as DiscoveredSource[]) : [];
  } catch {
    return [];
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/sources/health
 * Returns health scores for all tracked sources.
 */
export async function handleSourcesHealth(_request: Request, env: Env): Promise<Response> {
  const healthEntries = await getAllHealth(env);
  const allSources = await getAllSources(env);
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));

  const result = healthEntries.map((h) => {
    const source = sourceMap.get(h.sourceId);
    const signals = computeSourceHealthScore(h);
    return { source, health: h, signals };
  });

  return noCacheJsonResponse({ health: result, total: result.length });
}

/**
 * GET /api/sources/trending
 * Returns trending sources sorted by trending score descending.
 */
export async function handleSourcesTrending(_request: Request, env: Env): Promise<Response> {
  // Check cache first
  try {
    const cached = await env.CACHE?.get(TRENDING_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as TrendingSource[];
      return jsonResponse({ trending: parsed });
    }
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const healthEntries = await getAllHealth(env);
  const allSources = await getAllSources(env);
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));
  const now = Date.now();
  const windowStart = now - 7 * 86_400_000;

  const trending: TrendingSource[] = [];

  for (const health of healthEntries) {
    const source = sourceMap.get(health.sourceId);
    if (source?.status !== 'approved') continue;

    const daysActive = Math.max(1, (now - health.lastCheckedAt) / 86_400_000);
    const engagementVelocity = health.engagement30d / daysActive;
    const postVelocity = health.postCount30d / daysActive;

    trending.push(
      buildTrendingSource(
        health.sourceId,
        source.name,
        source.platform,
        engagementVelocity,
        postVelocity,
        0.5,
        windowStart,
        now,
      ),
    );
  }

  trending.sort((a, b) => b.trendingScore - a.trendingScore);
  const topTrending = trending.slice(0, 20);

  // Cache for 1 hour
  await env.CACHE?.put(TRENDING_CACHE_KEY, JSON.stringify(topTrending), {
    expirationTtl: 3600,
  });

  return jsonResponse({ trending: topTrending });
}

/**
 * GET /api/sources/stale
 * Returns sources with no activity in 14+ days.
 */
export async function handleSourcesStale(_request: Request, env: Env): Promise<Response> {
  const healthEntries = await getAllHealth(env);
  const allSources = await getAllSources(env);
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));
  const now = Date.now();
  const threshold = now - 14 * 86_400_000;

  const stale: Array<{
    source: DiscoveredSource;
    health: SourceHealth;
    daysSinceLastPost: number;
  }> = [];

  for (const health of healthEntries) {
    if (health.lastPostAt >= threshold) continue;
    const source = sourceMap.get(health.sourceId);
    if (source?.status !== 'approved') continue;

    stale.push({
      source,
      health,
      daysSinceLastPost: Math.round((now - health.lastPostAt) / 86_400_000),
    });
  }

  stale.sort((a, b) => b.daysSinceLastPost - a.daysSinceLastPost);
  return jsonResponse({ sources: stale, total: stale.length });
}

/**
 * GET /api/sources/new-this-week
 * Returns sources discovered within the last 7 days.
 */
export async function handleSourcesNewThisWeek(_request: Request, env: Env): Promise<Response> {
  const allSources = await getAllSources(env);
  const newSources = getNewThisWeek(allSources, Date.now(), 7);
  newSources.sort((a, b) => b.score - a.score);
  return jsonResponse({ sources: newSources, total: newSources.length });
}

/**
 * GET /api/sources/stats
 * Returns aggregated discovery stats.
 */
export async function handleSourcesStats(_request: Request, env: Env): Promise<Response> {
  const allSources = await getAllSources(env);
  const healthEntries = await getAllHealth(env);
  const healthMap = new Map(healthEntries.map((h) => [h.sourceId, h]));

  // Get discovery run history from KV
  const runHistory: Array<{
    platform: string;
    discovered: number;
    autoApproved: number;
    pending: number;
    timestamp: number;
  }> = [];
  try {
    const raw = await env.CACHE?.get('discovered:sources:run-history');
    if (raw) {
      const parsed = JSON.parse(raw) as typeof runHistory;
      runHistory.push(...parsed);
    }
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const lastRunRaw = await env.CACHE?.get(LAST_RUN_KEY);

  const stats = aggregateStats(allSources, healthMap, runHistory);

  return jsonResponse({
    ...stats,
    lastRunAt: lastRunRaw ? Number(lastRunRaw) : null,
    runHistory: runHistory.slice(-20).reverse(),
  });
}

/**
 * POST /api/sources/health-check
 * Run health check on all sources. Flags stale ones, culls low-quality ones.
 */
export async function handleSourcesHealthCheck(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const healthEntries = await getAllHealth(env);
  const allSources = await getAllSources(env);
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));
  const now = Date.now();

  let stale = 0;
  let culled = 0;

  for (const health of healthEntries) {
    health.lastCheckedAt = now;
    const result = computeSourceHealthScore(health);
    health.compositeScore = result.score;
    await saveHealth(env, health);

    if (result.lifecycle === 'stale') stale++;

    // Auto-cull: health < 0.3 AND inactive 14+ days
    if (result.lifecycle === 'culled') {
      const source = sourceMap.get(health.sourceId);
      if (source && source.status === 'approved') {
        source.lifecycle = 'culled' as SourceLifecycle;
        source.lifecycleCheckedAt = now;
        source.status = 'rejected';
        culled++;
      }
    }
  }

  // Save updated sources back
  const _approvedSources = allSources.filter((s) => s.status === 'approved');
  const _pendingSources = allSources.filter((s) => s.status === 'pending');
  await env.CACHE?.put('discovered:sources:all', JSON.stringify(allSources), {
    expirationTtl: 86400 * 90,
  });

  const nowISO = new Date().toISOString();
  await env.CACHE?.put(LAST_CHECK_KEY, nowISO);

  return jsonResponse({
    success: true,
    checked: healthEntries.length,
    stale,
    culled,
    checkedAt: nowISO,
  });
}

/**
 * POST /api/sources/record-engagement
 * Record engagement for a source (called by feed pipeline when content
 * from this source receives likes/comments/shares).
 * Body: { sourceId: string, engagementDelta: number, postCount?: number, spamScore?: number }
 */
export async function handleRecordEngagement(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      sourceId: string;
      engagementDelta: number;
      postCount?: number;
      spamScore?: number;
    };

    const { sourceId, engagementDelta, postCount = 0, spamScore } = body;

    const health = await getHealth(env, sourceId);
    if (!health) {
      return jsonResponse({ error: 'Source not found in health index' }, 404);
    }

    health.engagement30d += engagementDelta;
    health.postCount30d += postCount;
    health.lastPostAt = Date.now();
    health.lastCheckedAt = Date.now();

    if (spamScore !== undefined) {
      health.spamScore = Math.min(1, health.spamScore + spamScore);
      health.spamFlagCount++;
    }

    health.postFrequency = health.postCount30d / Math.max(1, 30);
    health.engagementScore = Math.min(
      1,
      health.engagement30d / Math.max(1, health.postCount30d || 1),
    );

    const result = computeSourceHealthScore(health);
    health.compositeScore = result.score;

    await saveHealth(env, health);

    return jsonResponse({
      success: true,
      sourceId,
      compositeScore: health.compositeScore,
      lifecycle: result.lifecycle,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to record engagement', details: String(err) }, 500);
  }
}

/**
 * Initialize health tracking for a newly discovered source.
 */
export async function initSourceHealth(env: Env, source: DiscoveredSource): Promise<void> {
  const health: SourceHealth = {
    sourceId: source.id,
    platform: source.platform,
    lastPostAt: Date.now(),
    postFrequency: source.weeklyActivity,
    engagementScore: source.relevanceScore * 0.5,
    relevanceScore: source.relevanceScore,
    spamScore: 0,
    compositeScore: source.score,
    lastCheckedAt: Date.now(),
    spamFlagCount: 0,
    engagement30d: 0,
    postCount30d: 0,
  };

  await saveHealth(env, health);

  const index = await getHealthIndex(env);
  if (!index.includes(source.id)) {
    index.push(source.id);
    await saveHealthIndex(env, index);
  }
}

/**
 * Run weekly health maintenance (cron helper).
 * Called by the weekly cron trigger.
 */
export async function runWeeklyHealthMaintenance(env: Env): Promise<{
  checked: number;
  stale: number;
  culled: number;
}> {
  const result = await handleSourcesHealthCheck(
    new Request('http://localhost/api/sources/health-check'),
    env,
  );
  const data = (await result.json()) as {
    checked: number;
    stale: number;
    culled: number;
  };
  return data;
}
