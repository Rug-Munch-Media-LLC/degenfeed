/**
 * /api/news/sources — Source Health Dashboard.
 *
 * Endpoints:
 *   GET  /api/news/sources/health      — All sources with health status, last fetch, error rate
 *   POST /api/news/sources/refresh     — Force refresh all sources
 *   GET  /api/news/sources/stats       — Stats: total articles, by source, by category
 */

import { aggregateNews } from '../feed/news-aggregator';
import { NEWS_SOURCES } from '../feed/news-source-tiers';
import { log } from '../index';
import { edgeCacheGet, edgeCachePut } from '../lib/edge-cache';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { NEWS } from '../constants';

// ─── KV Keys ──────────────────────────────────────────────────────────────

const SOURCE_HEALTH_PREFIX = 'news:source:health:';
const _SOURCE_COUNTS_PREFIX = 'news:source:counts:';
const CACHE_TTL_LONG = 86400; // 24 hours
const _CACHE_TTL_SHORT = 300; // 5 min
const STATS_CACHE_KEY = 'news:sources:stats:v1';
const CACHE_HEADERS = {
  'cache-control': `public, max-age=${NEWS.CACHE_TTL_SECONDS}, s-maxage=${NEWS.CACHE_TTL_SECONDS}`,
};

// ─── Types ────────────────────────────────────────────────────────────────

interface SourceHealthEntry {
  id: string;
  name: string;
  category: string;
  tier: number;
  credibility: number;
  url: string;
  type: string;
  enabled: boolean;
  lastFetchAt: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  fetchCount: number;
  errorCount: number;
  errorRate: number;
  avgResponseTimeMs: number;
  recentArticles: number;
  status: 'healthy' | 'degraded' | 'down' | 'untested';
}

interface CategoryStats {
  category: string;
  sourceCount: number;
  totalArticles: number;
  avgCredibility: number;
  healthySources: number;
  degradedSources: number;
}

// ─── GET /api/news/sources/health — Source Health ───────────────────────

export async function handleSourcesHealth(_request: Request, env: Env): Promise<Response> {
  const sources: SourceHealthEntry[] = [];

  for (const source of NEWS_SOURCES) {
    // Try to get health from KV
    let health: Partial<SourceHealthEntry> = {};
    try {
      const raw = await env.CACHE?.get(`${SOURCE_HEALTH_PREFIX}${source.id}`);
      if (raw) health = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    const fetchCount = (health.fetchCount as number) ?? 0;
    const errorCount = (health.errorCount as number) ?? 0;
    const errorRate = fetchCount > 0 ? errorCount / fetchCount : 0;

    let status: SourceHealthEntry['status'] = 'untested';
    if (fetchCount === 0) status = 'untested';
    else if (errorRate > 0.5) status = 'down';
    else if (errorRate > 0.2) status = 'degraded';
    else status = 'healthy';

    sources.push({
      id: source.id,
      name: source.name,
      category: source.category,
      tier: source.tier,
      credibility: source.credibility,
      url: source.url,
      type: source.type,
      enabled: true,
      lastFetchAt: (health.lastFetchAt as number) ?? null,
      lastSuccessAt: (health.lastSuccessAt as number) ?? null,
      lastErrorAt: (health.lastErrorAt as number) ?? null,
      lastErrorMessage: (health.lastErrorMessage as string) ?? null,
      fetchCount,
      errorCount,
      errorRate: Math.round(errorRate * 100) / 100,
      avgResponseTimeMs: (health.avgResponseTimeMs as number) ?? 0,
      recentArticles: (health.recentArticles as number) ?? 0,
      status,
    });
  }

  // Compute aggregate health
  const healthy = sources.filter((s) => s.status === 'healthy').length;
  const degraded = sources.filter((s) => s.status === 'degraded').length;
  const down = sources.filter((s) => s.status === 'down').length;
  const untested = sources.filter((s) => s.status === 'untested').length;
  const total = sources.length;

  return noCacheJsonResponse({
    data: sources,
    meta: {
      total,
      healthy,
      degraded,
      down,
      untested,
      healthScore: total > 0 ? Math.round((healthy / total) * 100) : 0,
      fetchedAt: Date.now(),
    },
  });
}

// ─── POST /api/news/sources/refresh — Force Refresh All Sources ──────────

export async function handleSourcesRefresh(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  // Trigger full aggregation (this fetches all sources)
  const startTime = Date.now();
  log('info', '[news-sources] forcing full source refresh...');

  try {
    const result = await aggregateNews(env, { limit: 100 });

    // Update per-source health in KV with this run
    const sourceArticleCounts = new Map<string, number>();
    for (const story of result.stories) {
      const sourceId = story.sourceMeta.id;
      sourceArticleCounts.set(sourceId, (sourceArticleCounts.get(sourceId) ?? 0) + 1);
    }

    // Update health entries for all sources
    for (const source of NEWS_SOURCES) {
      const recentCount = sourceArticleCounts.get(source.id) ?? 0;
      try {
        const raw = await env.CACHE?.get(`${SOURCE_HEALTH_PREFIX}${source.id}`);
        const existing: Partial<SourceHealthEntry> = raw ? JSON.parse(raw) : {};
        const update: Partial<SourceHealthEntry> = {
          ...existing,
          fetchCount: (existing.fetchCount ?? 0) + 1,
          lastFetchAt: Date.now(),
          lastSuccessAt: Date.now(),
          recentArticles: recentCount,
          lastErrorMessage: null,
          lastErrorAt: null,
        };
        await env.CACHE?.put(`${SOURCE_HEALTH_PREFIX}${source.id}`, JSON.stringify(update), {
          expirationTtl: CACHE_TTL_LONG,
        });
      } catch {
        /* non-critical */
      }
    }

    const elapsed = Date.now() - startTime;
    log(
      'info',
      `[news-sources] refresh complete: ${result.stories.length} stories in ${elapsed}ms`,
    );

    return jsonResponse({
      ok: true,
      storiesFetched: result.stories.length,
      sourcesQueried: NEWS_SOURCES.length,
      elapsedMs: elapsed,
    });
  } catch (err) {
    log(
      'error',
      `[news-sources] refresh failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return jsonResponse(
      { error: 'Refresh failed', details: err instanceof Error ? err.message : 'unknown' },
      500,
    );
  }
}

// ─── GET /api/news/sources/stats — Source & Category Stats ──────────────

export async function handleSourcesStats(_request: Request, env: Env): Promise<Response> {
  // Same caching pattern as the news feed: the aggregation underneath is
  // expensive and bounded by the aggregateNews timeout, so cache the stats
  // at the edge for NEWS.CACHE_TTL_SECONDS (5 min).
  try {
    const cached = await edgeCacheGet(env, STATS_CACHE_KEY);
    if (cached) {
      return jsonResponse(JSON.parse(cached), 200, CACHE_HEADERS);
    }
  } catch {
    // Cache miss / hiccup — recompute below.
  }

  // Get article counts per source (from recent aggregation)
  let result;
  try {
    result = await aggregateNews(env, { limit: 100 });
  } catch {
    return jsonResponse({ error: 'Failed to aggregate news for stats' }, 500);
  }

  const sourceArticleCounts = new Map<string, number>();
  const categoryArticleCounts = new Map<string, number>();
  const categorySourceSet = new Map<string, Set<string>>();

  for (const story of result.stories) {
    const sId = story.sourceMeta.id;
    sourceArticleCounts.set(sId, (sourceArticleCounts.get(sId) ?? 0) + 1);

    for (const cat of story.categories) {
      categoryArticleCounts.set(cat, (categoryArticleCounts.get(cat) ?? 0) + 1);
      if (!categorySourceSet.has(cat)) categorySourceSet.set(cat, new Set());
      categorySourceSet.get(cat)?.add(sId);
    }
  }

  // Build source stats
  const sourceStats = NEWS_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    tier: s.tier,
    credibility: s.credibility,
    recentArticles: sourceArticleCounts.get(s.id) ?? 0,
    enabled: true,
  })).sort((a, b) => b.recentArticles - a.recentArticles);

  // Build category stats
  const categoryStats: CategoryStats[] = Array.from(
    new Map(
      NEWS_SOURCES.reduce((acc, s) => {
        const existing = acc.get(s.category) ?? {
          category: s.category,
          sourceCount: 0,
          totalArticles: 0,
          avgCredibility: 0,
          healthySources: 0,
          degradedSources: 0,
        };
        existing.sourceCount++;
        existing.avgCredibility += s.credibility;
        acc.set(s.category, existing);
        return acc;
      }, new Map<string, CategoryStats>()),
    ).entries(),
  )
    .map(([_, cs]) => ({
      ...cs,
      totalArticles: categoryArticleCounts.get(cs.category) ?? 0,
      avgCredibility:
        cs.sourceCount > 0 ? Math.round((cs.avgCredibility / cs.sourceCount) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalArticles - a.totalArticles);

  // Token mentions aggregated
  const tokenMap = new Map<string, number>();
  for (const story of result.stories) {
    for (const token of story.entities.tokens) {
      tokenMap.set(token, (tokenMap.get(token) ?? 0) + 1);
    }
  }
  const topTokens = Array.from(tokenMap.entries())
    .map(([token, count]) => ({ token, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const body = {
    data: {
      overview: {
        totalSources: NEWS_SOURCES.length,
        totalArticles: result.stories.length,
        totalCategories: categoryStats.length,
        totalProtocols: result.meta.trending.length,
        uniqueTokens: topTokens.length,
        fetchedAt: result.meta.fetchedAt,
      },
      sources: sourceStats,
      categories: categoryStats,
      topTokens,
    },
    meta: {
      fetchedAt: Date.now(),
    },
  };

  try {
    await edgeCachePut(env, STATS_CACHE_KEY, JSON.stringify(body), NEWS.CACHE_TTL_SECONDS);
  } catch {
    // Non-critical — cache population failure does not fail the response.
  }
  return jsonResponse(body, 200, CACHE_HEADERS);
}

// ─── Router ───────────────────────────────────────────────────────────────

export async function handleNewsSourcesRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/news/sources/health') {
    return handleSourcesHealth(request, env);
  }
  if (path === '/api/news/sources/refresh') {
    return handleSourcesRefresh(request, env);
  }
  if (path === '/api/news/sources/stats') {
    return handleSourcesStats(request, env);
  }

  // Default: list sources (existing behavior). Built from the static registry
  // instead of re-delegating to routes/news (which would recurse forever and
  // blow the CPU budget with a Cloudflare 1102 error).
  const sourceList = NEWS_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    tier: s.tier,
    credibility: s.credibility,
    url: s.url,
    type: s.type,
  }));
  return jsonResponse({
    data: sourceList,
    meta: { total: sourceList.length, fetchedAt: Date.now() },
  });
}
