/**
 * @degenfeed/api-worker — Trending Aggregation Endpoints
 *
 * GET /api/trending/aggregated   — All-platform trending merged
 * GET /api/trending/per-platform — Per-platform trending (?platform=reddit)
 *
 * Data sourced from KV cache populated by the trending scraper cron job.
 * Falls back to direct scraping if cache is stale.
 */

import { type Env, jsonResponse } from '../index';
import { CrossNetworkSearch } from '../lib/cross-search';
import {
  getPlatformTrending,
  mergeTrendingItems,
  scrapeTrendingContent,
  TRENDING_CACHE_KEY,
  type TrendingData,
  type TrendingItem,
} from './trending-scraper';

// ─── KV / TTL ────────────────────────────────────────────────────────────

/** Serve from cache if fresher than this (in ms). Stale-while-revalidate window. */
const CACHE_MAX_AGE = 3600_000; // 1 hour

// ─── Helpers ─────────────────────────────────────────────────────────────

async function loadTrendingData(env: Env): Promise<TrendingData | null> {
  try {
    const cached = await env.CACHE?.get(TRENDING_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as TrendingData;
      // Validate shape minimally — if it has platforms, it's good
      if (parsed.platforms && typeof parsed.timestamp === 'number') {
        return parsed;
      }
    }
  } catch {
    // Corrupted cache — fall through to scrape
  }
  return null;
}

// ─── GET /api/trending/aggregated ────────────────────────────────────────

/**
 * Returns all trending items across all platforms, merged and sorted by score.
 *
 * Query params:
 *   - limit (number, default 50): max items to return
 *   - minScore (number, default 0): minimum engagement score filter
 *   - platforms (string, comma-separated): filter to specific platforms
 */
export async function handleTrendingAggregated(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const minScore = Number(url.searchParams.get('minScore')) || 0;
  const platformFilter = url.searchParams.get('platforms')?.split(',').filter(Boolean) ?? [];

  // Try cache first
  let data = await loadTrendingData(env);

  // Stale-while-revalidate: if cache is old, trigger background refresh
  const shouldRefresh = !data || Date.now() - data.timestamp > CACHE_MAX_AGE;

  if (shouldRefresh) {
    // Inline refresh for first request after expiry
    data = await scrapeTrendingContent(env);
  }

  if (!data) {
    return jsonResponse({ data: [], meta: { total: 0, note: 'Trending data unavailable' } }, 503);
  }

  // Merge all items
  let items = mergeTrendingItems(data);

  // Apply filters
  if (platformFilter.length > 0) {
    items = items.filter((item) => platformFilter.includes(item.platform));
  }
  if (minScore > 0) {
    items = items.filter((item) => item.score >= minScore);
  }

  // Paginate
  const total = items.length;
  const page = items.slice(0, limit);

  return jsonResponse({
    data: page,
    meta: {
      total,
      limit,
      platforms: Object.keys(data.platforms).filter(
        (p) => data.platforms[p as keyof typeof data.platforms].items.length > 0,
      ),
      fetchedAt: data.timestamp,
      stale: shouldRefresh,
    },
  });
}

// ─── GET /api/trending/per-platform ─────────────────────────────────────

/**
 * Returns trending items for a single platform.
 *
 * Query params:
 *   - platform (required): reddit | youtube | farcaster | nostr | bluesky
 *   - limit (number, default 50): max items
 */
export async function handleTrendingPerPlatform(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform')?.toLowerCase() as
    | keyof TrendingData['platforms']
    | null;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  if (!platform || !['reddit', 'youtube', 'farcaster', 'nostr', 'bluesky'].includes(platform)) {
    return jsonResponse(
      {
        error: 'Invalid platform',
        valid: ['reddit', 'youtube', 'farcaster', 'nostr', 'bluesky'],
      },
      400,
    );
  }

  let data = await loadTrendingData(env);

  const shouldRefresh = !data || Date.now() - data.timestamp > CACHE_MAX_AGE;

  if (shouldRefresh) {
    data = await scrapeTrendingContent(env);
  }

  if (!data) {
    return jsonResponse({ data: [], meta: { total: 0, note: 'Trending data unavailable' } }, 503);
  }

  const platformData = getPlatformTrending(data, platform);
  const items = platformData.items.slice(0, limit);

  return jsonResponse({
    data: items,
    meta: {
      total: platformData.items.length,
      limit,
      platform,
      fetchedAt: platformData.fetchedAt,
      source: platformData.source,
      stale: shouldRefresh,
    },
  });
}

// ─── GET /api/trending/now (compact for feed injection) ────────────────

/**
 * Compact "Trending Now" response designed for in-feed embedding.
 * Returns the top 5 items across all platforms with minimal payload.
 */
// ─── GET /api/trending/cross-network ──────────────────────────────────

/**
 * Returns what's trending across ALL networks right now.
 * Weighted by: volume, velocity, cross-protocol engagement.
 */
export async function handleCrossTrending(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

  const cacheKey = `trending:cross:v1:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* cache miss */
  }

  const engine = new CrossNetworkSearch(env);
  const items = await engine.trending(limit);

  const response = {
    data: items,
    meta: {
      total: items.length,
      sources: [...new Set(items.map((i) => i.source))],
      fetchedAt: Date.now(),
    },
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 120,
    });
  } catch {
    /* non-critical */
  }

  return jsonResponse(response);
}

export async function handleTrendingNow(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const count = Math.min(Number(url.searchParams.get('count')) || 5, 20);

  let data = await loadTrendingData(env);

  if (!data || Date.now() - data.timestamp > CACHE_MAX_AGE) {
    data = await scrapeTrendingContent(env);
  }

  if (!data) {
    return jsonResponse({
      trending: [],
      fetchedAt: 0,
      note: 'Trending data unavailable',
    });
  }

  const merged = mergeTrendingItems(data).slice(0, count);

  return jsonResponse({
    trending: merged.map((item: TrendingItem) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      platform: item.platform,
      authorName: item.authorName,
      score: item.score,
      engagement: item.engagement,
      thumbnailUrl: item.thumbnailUrl,
      publishedAt: item.publishedAt,
    })),
    fetchedAt: data.timestamp,
  });
}
