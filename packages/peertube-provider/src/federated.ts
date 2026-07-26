/**
 * @degenfeed/peertube-provider — Federated PeerTube Content Discovery
 *
 * Discovers and aggregates PeerTube content from across the ActivityPub
 * fediverse. Uses both Sepiasearch (federated index) and direct instance
 * API queries to find crypto/tech content from dozens of instances.
 *
 * The PeerTube network has ~1,000+ instances and millions of videos.
 * Many instances carry excellent crypto, blockchain, and tech content.
 * This module aggregates them into a unified, DegenFeed-branded feed.
 *
 * Architecture:
 *   searchFederatedVideos() — Search via Sepiasearch index + direct fallback
 *   getTrendingVideos()     — Aggregate trending from known instances
 *   discoverChannels()      — Find quality crypto/tech channels
 *   getFederatedFeed()      — Unified feed combining all sources
 *
 * Caching:
 *   Results are cached in an in-memory Map with TTL (default 15 min).
 *   This avoids hammering remote instances on every page load.
 */

// ─── Types ───────────────────────────────────────────────────────────

import type { PeerTubeVideo, PeerTubeVideoResponse } from './types';

export interface FederatedVideoItem {
  id: string;
  title: string;
  url: string;
  instanceUrl: string;
  instanceName: string;
  channelName: string;
  channelUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  publishedMs: number;
  views: number;
  likes: number;
  duration: number;
  isLive: boolean;
  description: string;
  tags: string[];
  /** Source instance hostname */
  source: string;
}

export interface FederatedFeedResult {
  items: FederatedVideoItem[];
  total: number;
  sourceInstances: number;
  cached: boolean;
}

export interface FederatedChannel {
  name: string;
  displayName: string;
  url: string;
  instanceUrl: string;
  videoCount: number;
  totalViews: number;
  description: string;
  avatarUrl: string | null;
  tags: string[];
  lastVideoAt: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────

/** Known PeerTube instances with crypto/tech content.
 *
 * Selected based on:
 * - Active moderation (no spam/CSAM)
 * - Content diversity (tech, crypto, science, education)
 * - API accessibility (public read endpoints)
 * - Federation health (peers with other instances)
 *
 * Sources:
 * - Sepiasearch index (sepiasearch.org)
 * - PeerTube instance lists (instances.joinpeertube.org, the-federation.info)
 * - Manual curation based on content quality
 *
 * Last reviewed: 2026-07-18
 */
export const FEDERATED_PEERTUBE_INSTANCES: Array<{
  url: string;
  name: string;
  tags: string[];
  priority: number;
}> = [
  // ── Tier 1: High-quality tech/crypto instances ──────────────────────
  {
    url: 'https://tilvids.com',
    name: 'TILvids',
    tags: ['tech', 'education', 'science', 'linux'],
    priority: 1,
  },
  {
    url: 'https://tube.shanti.cafe',
    name: 'Shanti Cafe',
    tags: ['tech', 'crypto', 'linux', 'foss'],
    priority: 1,
  },
  {
    url: 'https://makertube.net',
    name: 'MakerTube',
    tags: ['maker', 'tech', 'diy', 'hardware'],
    priority: 1,
  },
  {
    url: 'https://videos.lukesmith.xyz',
    name: 'Luke Smith Videos',
    tags: ['tech', 'linux', 'foss'],
    priority: 2,
  },
  {
    url: 'https://spectra.video',
    name: 'Spectra Video',
    tags: ['general', 'tech', 'news'],
    priority: 2,
  },
  // ── Tier 2: Tech/Science instances ─────────────────────────────────
  {
    url: 'https://peertube.linuxrocks.online',
    name: 'Linux Rocks',
    tags: ['linux', 'tech', 'foss'],
    priority: 2,
  },
  {
    url: 'https://videos.trom.tf',
    name: 'Trom Videos',
    tags: ['tech', 'science', 'privacy'],
    priority: 2,
  },
  {
    url: 'https://diode.zone',
    name: 'Diode Zone',
    tags: ['maker', 'tech', 'art'],
    priority: 2,
  },
  // {
  //   url: 'https://peertube.tamanoir.foucry.net',
  //   name: 'Foucry PeerTube',
  //   tags: ['tech', 'general'],
  //   priority: 3,
  //   // NOTE: commented out 2026-07-18 — instance unreachable from Talos
  // },
  {
    url: 'https://peertube.1312.media',
    name: '1312 Media',
    tags: ['tech', 'politics', 'news'],
    priority: 3,
  },
  // ── Tier 3: Additional instances for breadth ────────────────────────
  {
    url: 'https://video.lagacetilla.org',
    name: 'La Gacetilla',
    tags: ['general', 'news'],
    priority: 3,
  },
  {
    url: 'https://tube.undervolt.io',
    name: 'Undervolt Tube',
    tags: ['tech', 'gaming'],
    priority: 3,
  },
  {
    url: 'https://video.hardlimit.com',
    name: 'Hardlimit Video',
    tags: ['tech', 'gaming', 'foss'],
    priority: 3,
  },
  {
    url: 'https://videos.retroframe.cloud',
    name: 'RetroFrame Videos',
    tags: ['retro', 'tech', 'gaming'],
    priority: 3,
  },
  {
    url: 'https://peertube.stream',
    name: 'PeerTube Stream',
    tags: ['general', 'tech', 'live'],
    priority: 3,
  },
  {
    url: 'https://videos.squidowl.org',
    name: 'SquidOwl Videos',
    tags: ['tech', 'science', 'education'],
    priority: 3,
  },
];

/** Sepiasearch — federated PeerTube video search index */
const SEPIASEARCH_URL = 'https://sepiasearch.org/api/v1/search/videos';

/** Cache TTL in milliseconds (default: 15 minutes) */
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Max videos to return from aggregated calls */
const MAX_FEDERATED_VIDEOS = 50;

/** Max concurrent instance fetches */
const MAX_CONCURRENCY = 5;

// ─── In-memory cache ─────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

/** Clear all cached entries (for testing). */
export function clearCache(): void {
  cache.clear();
}

// ─── Sepiasearch API ─────────────────────────────────────────────────

/**
 * Search the Sepiasearch federated index.
 * Sepiasearch indexes videos from hundreds of PeerTube instances.
 * Returns raw PeerTubeVideo[] from across the fediverse.
 */
export async function searchSepiasearch(
  query: string,
  limit: number = 20,
): Promise<PeerTubeVideo[]> {
  const cacheKey = `sepiasearch:${query}:${limit}`;
  const cached = getCached<PeerTubeVideo[]>(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      search: query,
      count: String(Math.min(limit, 100)),
    });

    const response = await fetch(`${SEPIASEARCH_URL}?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/1.0 (federated video discovery)',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[peertube/federated] Sepiasearch returned ${response.status}`);
      return [];
    }

    const data = (await response.json()) as PeerTubeVideoResponse;
    const videos = data.data ?? [];
    setCache(cacheKey, videos);
    return videos;
  } catch (err) {
    console.warn(
      '[peertube/federated] Sepiasearch error:',
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

// ─── Instance API client ─────────────────────────────────────────────

/**
 * Query a single PeerTube instance's API for videos.
 * Tries the main /api/v1/videos endpoint, falls back to search.
 */
async function fetchInstanceVideos(
  instanceUrl: string,
  options: {
    sort?: string;
    limit?: number;
    search?: string;
    categoryOneOf?: string;
  } = {},
): Promise<PeerTubeVideo[]> {
  const { sort = '-views', limit = 10, search, categoryOneOf } = options;

  try {
    const params = new URLSearchParams({
      count: String(limit),
      sort,
    });

    if (categoryOneOf) params.set('categoryOneOf', categoryOneOf);
    if (search) params.set('search', search);

    const endpoint = search ? 'search/videos' : 'videos';
    const url = `${instanceUrl.replace(/\/$/, '')}/api/v1/${endpoint}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/1.0 (federated video discovery)',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as PeerTubeVideoResponse;
    return data.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Concurrency-limited batch fetch from multiple instances.
 */
async function batchFetchInstances(
  instances: Array<{ url: string; name: string; tags: string[]; priority: number }>,
  options: {
    sort?: string;
    limit?: number;
    search?: string;
  } = {},
): Promise<{ videos: FederatedVideoItem[]; instanceCount: number }> {
  const allVideos: FederatedVideoItem[] = [];
  let instanceCount = 0;

  // Process in batches to avoid overwhelming networks
  for (let i = 0; i < instances.length; i += MAX_CONCURRENCY) {
    const batch = instances.slice(i, i + MAX_CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (inst) => {
        const videos = await fetchInstanceVideos(inst.url, {
          sort: options.sort,
          limit: options.limit ?? 10,
          search: options.search,
        });

        if (videos.length > 0) {
          instanceCount++;
        }

        return videos.map(
          (v): FederatedVideoItem => ({
            id: v.uuid,
            title: v.name,
            url: v.url,
            instanceUrl: inst.url,
            instanceName: inst.name,
            channelName: v.channel?.displayName ?? v.channel?.name ?? 'unknown',
            channelUrl: v.channel?.url ?? null,
            thumbnailUrl: v.thumbnailPath ? `${inst.url}${v.thumbnailPath}` : null,
            publishedAt: v.publishedAt,
            publishedMs: new Date(v.publishedAt).getTime(),
            views: v.views,
            likes: v.likes ?? 0,
            duration: v.duration,
            isLive: v.isLive ?? false,
            description: v.shortDescription || v.description || '',
            tags: v.tags ?? [],
            source: new URL(inst.url).hostname,
          }),
        );
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allVideos.push(...result.value);
      }
    }
  }

  return { videos: allVideos, instanceCount };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Search for federated PeerTube videos matching a query.
 * Uses Sepiasearch as the primary source, falls back to direct instance queries.
 *
 * @param query - Search term (e.g., "crypto", "bitcoin", "ethereum tutorial")
 * @param limit - Max results (default 20, max 100)
 * @returns FederatedFeedResult with deduplicated items
 */
export async function searchFederatedVideos(
  query: string,
  limit: number = 20,
): Promise<FederatedFeedResult> {
  const cacheKey = `search:${query}:${limit}`;
  const cached = getCached<FederatedFeedResult>(cacheKey);
  if (cached) return cached;

  // Primary: Sepiasearch
  const sepiasearchResults = await searchSepiasearch(query, limit);

  // Convert to FederatedVideoItem[]
  const items: FederatedVideoItem[] = sepiasearchResults.map((v) => {
    const host = v.url ? new URL(v.url).hostname : 'unknown';
    const instanceName =
      FEDERATED_PEERTUBE_INSTANCES.find((i) => i.url.includes(host))?.name ?? host;
    return {
      id: v.uuid,
      title: v.name,
      url: v.url,
      instanceUrl: `https://${host}`,
      instanceName,
      channelName: v.channel?.displayName ?? v.channel?.name ?? 'unknown',
      channelUrl: v.channel?.url ?? null,
      thumbnailUrl: v.thumbnailPath ? `https://${host}${v.thumbnailPath}` : null,
      publishedAt: v.publishedAt,
      publishedMs: new Date(v.publishedAt).getTime(),
      views: v.views,
      likes: v.likes ?? 0,
      duration: v.duration,
      isLive: v.isLive ?? false,
      description: v.shortDescription || v.description || '',
      tags: v.tags ?? [],
      source: host,
    };
  });

  // Fallback: direct instance queries if sepiasearch returned nothing
  let instanceResults: FederatedVideoItem[] = [];
  let instanceCount = 0;
  if (items.length === 0) {
    const result = await batchFetchInstances(FEDERATED_PEERTUBE_INSTANCES, {
      sort: '-views',
      limit: 5,
      search: query,
    });
    instanceResults = result.videos;
    instanceCount = result.instanceCount;
  }

  // Deduplicate by UUID
  const seen = new Set<string>();
  const allItems = [...items, ...instanceResults].filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // Sort by views (descending)
  allItems.sort((a, b) => b.views - a.views);

  const result: FederatedFeedResult = {
    items: allItems.slice(0, Math.min(limit, MAX_FEDERATED_VIDEOS)),
    total: allItems.length,
    sourceInstances: instanceCount || new Set(allItems.map((v) => v.source)).size,
    cached: false,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get trending videos across the fediverse.
 * Aggregates most-viewed recent content from known instances.
 * Cached for 15 minutes.
 *
 * @param limit - Max results (default 50)
 * @returns FederatedFeedResult
 */
export async function getTrendingVideos(
  limit: number = MAX_FEDERATED_VIDEOS,
): Promise<FederatedFeedResult> {
  const cacheKey = `trending:${limit}`;
  const cached = getCached<FederatedFeedResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const result = await batchFetchInstances(FEDERATED_PEERTUBE_INSTANCES, {
    sort: '-views',
    limit: Math.ceil(limit / FEDERATED_PEERTUBE_INSTANCES.length) + 2,
  });

  // Deduplicate by UUID
  const seen = new Set<string>();
  const unique = result.videos.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // Score: views / hours since published (trending = high views in short time)
  const now = Date.now();
  const scored = unique.map((v) => {
    const ageHours = Math.max(1, (now - v.publishedMs) / 3600000);
    const trendScore = v.views / ageHours;
    return { ...v, trendScore };
  });

  scored.sort((a, b) => b.trendScore - a.trendScore);

  const fedResult: FederatedFeedResult = {
    items: scored.slice(0, limit).map(({ trendScore: _, ...v }) => v),
    total: unique.length,
    sourceInstances: result.instanceCount,
    cached: false,
  };

  setCache(cacheKey, fedResult);
  return fedResult;
}

/**
 * Get the most recent videos from all federated instances.
 * Opposite of trending — focuses on recency.
 */
export async function getRecentFederatedVideos(limit: number = 30): Promise<FederatedFeedResult> {
  const cacheKey = `recent:${limit}`;
  const cached = getCached<FederatedFeedResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const result = await batchFetchInstances(FEDERATED_PEERTUBE_INSTANCES, {
    sort: '-publishedAt',
    limit: Math.ceil(limit / FEDERATED_PEERTUBE_INSTANCES.length) + 2,
  });

  // Deduplicate
  const seen = new Set<string>();
  result.videos = result.videos.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // Sort by published date (newest first)
  result.videos.sort((a, b) => b.publishedMs - a.publishedMs);

  const fedResult: FederatedFeedResult = {
    items: result.videos.slice(0, limit),
    total: result.videos.length,
    sourceInstances: result.instanceCount,
    cached: false,
  };

  setCache(cacheKey, fedResult);
  return fedResult;
}

/**
 * Discover crypto/tech channels across federated instances.
 * Searches for common crypto/tech terms and aggregates channel info.
 */
export async function discoverChannels(
  searchTerms: string[] = ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'linux', 'tech'],
): Promise<FederatedChannel[]> {
  const cacheKey = `channels:${searchTerms.join(',')}`;
  const cached = getCached<FederatedChannel[]>(cacheKey);
  if (cached) return cached;

  const seen = new Set<string>();
  const channels: Map<string, FederatedChannel> = new Map();

  // Search each term via Sepiasearch and extract channel info
  for (const term of searchTerms) {
    const videos = await searchSepiasearch(term, 20);
    for (const v of videos) {
      if (!v.channel) continue;

      const channelKey = `${v.channel.url}`;
      if (seen.has(channelKey)) continue;
      seen.add(channelKey);

      const host = v.url ? new URL(v.url).hostname : 'unknown';
      const existing = channels.get(channelKey);

      if (existing) {
        existing.videoCount++;
        existing.totalViews += v.views;
        if (v.tags) {
          for (const tag of v.tags) {
            if (!existing.tags.includes(tag)) existing.tags.push(tag);
          }
        }
      } else {
        channels.set(channelKey, {
          name: v.channel.name,
          displayName: v.channel.displayName,
          url: v.channel.url,
          instanceUrl: `https://${host}`,
          videoCount: 1,
          totalViews: v.views,
          description: v.shortDescription || '',
          avatarUrl: v.channel.avatar?.path ? `https://${host}${v.channel.avatar.path}` : null,
          tags: v.tags ?? [],
          lastVideoAt: v.publishedAt,
        });
      }
    }
  }

  const result = Array.from(channels.values())
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 100);

  setCache(cacheKey, result);
  return result;
}

/**
 * Unified federated feed — combines trending + recent + search results.
 * This is the main entry point for the /videos Federated tab.
 *
 * @param options.sort - 'trending' (default), 'recent', or search term
 * @param options.limit - Max results
 * @returns FederatedFeedResult
 */
export async function getFederatedFeed(
  options: { sort?: string; limit?: number } = {},
): Promise<FederatedFeedResult> {
  const { sort = 'trending', limit = MAX_FEDERATED_VIDEOS } = options;

  // Handle search queries
  if (sort && !['trending', 'recent', 'popular'].includes(sort)) {
    return searchFederatedVideos(sort, limit);
  }

  if (sort === 'recent') {
    return getRecentFederatedVideos(limit);
  }

  // Default: trending
  return getTrendingVideos(limit);
}

/**
 * Health check — test connectivity to a selection of federated instances.
 */
export async function federatedHealthCheck(): Promise<{
  total: number;
  reachable: number;
  instances: Array<{ name: string; url: string; reachable: boolean; videoCount: number }>;
}> {
  const results = await Promise.allSettled(
    FEDERATED_PEERTUBE_INSTANCES.map(async (inst) => {
      try {
        const url = `${inst.url}/api/v1/videos?count=1`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          return { ...inst, reachable: false, videoCount: 0 };
        }
        const data = (await response.json()) as PeerTubeVideoResponse;
        return {
          ...inst,
          reachable: true,
          videoCount: data.total ?? 0,
        };
      } catch {
        return { ...inst, reachable: false, videoCount: 0 };
      }
    }),
  );

  const instances = results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          name: 'unknown',
          url: 'unknown',
          tags: [] as string[],
          priority: 99,
          reachable: false,
          videoCount: 0,
        },
  );

  return {
    total: instances.length,
    reachable: instances.filter((i) => i.reachable).length,
    instances,
  };
}
