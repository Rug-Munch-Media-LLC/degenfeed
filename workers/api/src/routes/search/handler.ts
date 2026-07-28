/**
 * @degenfeed/api-worker — Search Route Handlers
 *
 * Search across indexed content via MeiliSearch, with fallback to
 * cross-network federated search when MeiliSearch is unavailable.
 *
 * GET /api/search?q=&limit=&protocols=   — Unified content search
 * GET /api/search/autocomplete?q=         — Autocomplete suggestions
 * GET /api/search/identity?q=             — Identity/author search
 */

import { CrossNetworkSearch } from '../../lib/cross-search';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';

// ─── Configuration ─────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MEILI_DEFAULT_URL = 'http://127.0.0.1:7700';

// ─── Types ─────────────────────────────────────────────────────────────────

interface MeiliHit {
  id: string;
  source: string;
  protocol: string;
  contentType: string;
  sourceLabel: string;
  text: string;
  html?: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorId: string;
  authorBio: string;
  createdAt: number;
  metrics: string;
  niches: string[];
  url: string;
  embeds: string;
  imageUrl: string;
  language: string;
  metadata: string;
}

interface MeiliSearchResponse {
  hits: MeiliHit[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
}

// ─── Frontend-facing types ─────────────────────────────────────────────────

export interface SearchResultItem {
  id: string;
  protocol: string;
  author: {
    displayName: string;
    avatarUrl?: string;
  };
  text: string;
  url: string | null;
  image: string | null;
  niches: string[];
  createdAt: number;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
}

export interface IdentityResultItem {
  id: string;
  protocol: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string;
  postCount: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse a JSON-stringified metrics field or return defaults */
function parseMetrics(raw: string): SearchResultItem['metrics'] {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      likes: typeof parsed.likes === 'number' ? parsed.likes : 0,
      reposts: typeof parsed.reposts === 'number' ? parsed.reposts : 0,
      replies: typeof parsed.replies === 'number' ? parsed.replies : 0,
      quotes: typeof parsed.quotes === 'number' ? parsed.quotes : 0,
    };
  } catch {
    return { likes: 0, reposts: 0, replies: 0, quotes: 0 };
  }
}

/** Parse niches (already array, but guard against string) */
function parseNiches(raw: string[] | string): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Map a MeiliSearch hit to the frontend SearchResult shape */
function hitToSearchResult(hit: MeiliHit): SearchResultItem {
  return {
    id: hit.id,
    protocol: hit.protocol || hit.source,
    author: {
      displayName: hit.authorName || hit.authorHandle || 'Unknown',
      avatarUrl: hit.authorAvatar || undefined,
    },
    text: hit.text,
    url: hit.url || null,
    image: hit.imageUrl || null,
    niches: parseNiches(hit.niches),
    createdAt: hit.createdAt,
    metrics: parseMetrics(hit.metrics),
  };
}

/** Map a MeiliSearch hit to an Identity result */
function hitToIdentity(hit: MeiliHit): IdentityResultItem {
  return {
    id: hit.authorId || hit.id,
    protocol: hit.protocol || hit.source,
    displayName: hit.authorName || hit.authorHandle || 'Unknown',
    handle: hit.authorHandle || null,
    avatarUrl: hit.authorAvatar || null,
    bio: hit.authorBio || '',
    postCount: 1,
  };
}

// ─── MeiliSearch Client ────────────────────────────────────────────────────

async function queryMeili(
  env: Env,
  params: {
    q: string;
    limit?: number;
    offset?: number;
    filter?: string;
    attributesToRetrieve?: string[];
  },
): Promise<MeiliSearchResponse | null> {
  const meiliUrl = env.MEILI_URL || MEILI_DEFAULT_URL;
  const apiKey = env.MEILI_SEARCH_KEY;

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const body: Record<string, unknown> = {
      q: params.q,
      limit: params.limit ?? DEFAULT_LIMIT,
      offset: params.offset ?? 0,
    };

    if (params.filter) {
      body.filter = [params.filter];
    }

    if (params.attributesToRetrieve) {
      body.attributesToRetrieve = params.attributesToRetrieve;
    }

    const res = await fetch(`${meiliUrl}/indexes/posts/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn(
        `[search] MeiliSearch returned ${res.status}: ${await res.text().catch(() => '')}`,
      );
      return null;
    }

    return (await res.json()) as MeiliSearchResponse;
  } catch (err) {
    console.warn(
      '[search] MeiliSearch query failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Deduplicate results by ID */
function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// ─── Route Handlers ────────────────────────────────────────────────────────

/**
 * GET /api/search — Unified search across all indexed content.
 *
 * Query params:
 *   q         — Search query (required, min 2 chars)
 *   limit     — Max results (default 25, max 100)
 *   protocols — Comma-separated protocol filter (optional)
 *   offset    — Pagination offset (default 0)
 */
export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
  const protocols = url.searchParams.get('protocols')?.trim();

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Search query is required (min 2 characters)' }, 400);
  }

  // Try MeiliSearch first
  const meiliFilter = protocols
    ? protocols
        .split(',')
        .map((p) => `source = ${p.trim()}`)
        .join(' OR ')
    : undefined;

  const meiliResult = await queryMeili(env, {
    q: query,
    limit,
    offset,
    filter: meiliFilter,
    attributesToRetrieve: [
      'id',
      'source',
      'protocol',
      'contentType',
      'sourceLabel',
      'text',
      'html',
      'authorName',
      'authorHandle',
      'authorAvatar',
      'authorId',
      'authorBio',
      'createdAt',
      'metrics',
      'niches',
      'url',
      'imageUrl',
      'language',
      'metadata',
    ],
  });

  // Fallback: if MeiliSearch returned no hits, try federated cross-network search
  const hasMeiliHits = meiliResult?.hits && meiliResult.hits.length > 0;
  if (!hasMeiliHits) {
    try {
      const crossSearch = new CrossNetworkSearch(env);
      const crossResults = await crossSearch.search({
        query,
        limit: Math.min(limit, 20),
        protocols: protocols?.split(',').filter(Boolean) as string[],
      });

      // Map CrossNetworkSearch results to frontend format
      const posts = dedupe(
        [...crossResults.results.posts, ...crossResults.results.articles]
          .slice(0, limit)
          .map((r) => ({
            id: r.id,
            protocol: r.source,
            author: {
              displayName: (r.metadata?.author as string) || r.sourceLabel,
              avatarUrl: r.metadata?.avatarUrl as string | undefined,
            },
            text: r.description,
            url: r.url || null,
            image: r.thumbnail || null,
            niches: [] as string[],
            createdAt:
              typeof r.metadata?.publishedAt === 'string'
                ? new Date(r.metadata.publishedAt).getTime()
                : (r.metadata?.createdAt as number) || Date.now(),
            metrics: {
              likes: (r.metadata?.likes as number) || 0,
              reposts: (r.metadata?.reposts as number) || 0,
              replies: (r.metadata?.replies as number) || 0,
              quotes: (r.metadata?.quotes as number) || 0,
            },
          })),
      );

      const identities = crossResults.results.creators.slice(0, 5).map((r) => ({
        id: r.id,
        protocol: r.source,
        displayName: r.title,
        handle: r.metadata?.author as string | null,
        avatarUrl: r.thumbnail || null,
        bio: r.description,
        postCount: 1,
      }));

      const communities = crossResults.results.communities.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.title,
        protocol: r.source,
        description: r.description,
        memberCount: (r.metadata?.subscribers as number) || 0,
        url: r.url || '',
        icon: r.thumbnail || null,
      }));

      const videos = crossResults.results.videos.slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title,
        source: r.source,
        channelName:
          (r.metadata?.channelName as string) || (r.metadata?.channelTitle as string) || '',
        thumbnailUrl: r.thumbnail || null,
        url: r.url || '',
        views: (r.metadata?.views as number) || 0,
        durationSeconds: (r.metadata?.duration as number) || 0,
        publishedAt:
          typeof r.metadata?.publishedAt === 'string'
            ? new Date(r.metadata.publishedAt).getTime()
            : Date.now(),
      }));

      return noCacheJsonResponse({
        data: posts,
        identities,
        communities,
        videos,
        meta: {
          total: crossResults.totalResults,
          query,
          limit,
          source: 'cross-network',
          searchTime: crossResults.searchTime,
        },
      });
    } catch (err) {
      console.warn(
        '[search] Cross-network fallback failed:',
        err instanceof Error ? err.message : String(err),
      );
      return jsonResponse({
        data: [],
        identities: [],
        communities: [],
        videos: [],
        meta: { total: 0, query, limit, source: 'fallback' },
      });
    }
  }

  // Map MeiliSearch results to frontend format
  const hits = meiliResult.hits;
  const posts = dedupe(hits.map(hitToSearchResult));

  // Deduplicate identities by authorId
  const identityMap = new Map<string, IdentityResultItem>();
  for (const hit of hits) {
    const key = hit.authorId || hit.id;
    const existingEntry = identityMap.get(key);
    if (existingEntry) {
      existingEntry.postCount += 1;
    } else {
      identityMap.set(key, hitToIdentity(hit));
    }
  }
  const identities = Array.from(identityMap.values()).slice(0, 10);

  return noCacheJsonResponse({
    data: posts,
    identities,
    communities: [],
    videos: [],
    meta: {
      total: meiliResult.estimatedTotalHits || hits.length,
      query: meiliResult.query,
      limit,
      offset,
      source: 'meilisearch',
      processingTimeMs: meiliResult.processingTimeMs,
    },
  });
}

/**
 * GET /api/search/autocomplete — Autocomplete suggestions.
 *
 * Query params:
 *   q — Partial query (min 2 chars)
 */
export async function handleSearchAutocomplete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (!query || query.length < 2) {
    return noCacheJsonResponse({ suggestions: [] });
  }

  const suggestions: Array<{ text: string; type: string; source?: string; score: number }> = [];

  // Query MeiliSearch for author names and niche matches
  const meiliResult = await queryMeili(env, {
    q: query,
    limit: 5,
    attributesToRetrieve: ['authorName', 'authorHandle', 'niches', 'source'],
  });

  if (meiliResult?.hits) {
    const seen = new Set<string>();
    for (const hit of meiliResult.hits) {
      // Author name match
      const authorName = hit.authorName || hit.authorHandle;
      if (authorName?.toLowerCase().includes(query.toLowerCase())) {
        const key = `author:${authorName}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            text: authorName,
            type: 'creator',
            source: hit.source,
            score: 0.7,
          });
        }
      }

      // Niche matches
      for (const niche of parseNiches(hit.niches)) {
        if (niche.toLowerCase().includes(query.toLowerCase())) {
          const key = `niche:${niche}`;
          if (!seen.has(key)) {
            seen.add(key);
            suggestions.push({
              text: niche,
              type: 'query',
              score: 0.6,
            });
          }
        }
      }
    }
  }

  // Also try the CrossNetworkSearch autocomplete for additional suggestions
  try {
    const crossSearch = new CrossNetworkSearch(env);
    const crossSuggestions = await crossSearch.autocomplete(query);
    for (const s of crossSuggestions) {
      const key = `${s.type}:${s.text}`;
      if (!suggestions.some((existing) => `${existing.type}:${existing.text}` === key)) {
        suggestions.push(s);
      }
    }
  } catch {
    // Non-critical
  }

  // Sort by score descending, limit to 8
  suggestions.sort((a, b) => b.score - a.score);

  return noCacheJsonResponse({ suggestions: suggestions.slice(0, 8) });
}

/**
 * GET /api/search/identity — Identity/author search.
 *
 * Query params:
 *   q      — Author name query (required, min 2 chars)
 *   limit  — Max results (default 10)
 */
export async function handleSearchIdentity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 50);

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Identity search query is required (min 2 characters)' }, 400);
  }

  // Search by author name/handle in MeiliSearch
  const meiliResult = await queryMeili(env, {
    q: query,
    limit,
    attributesToRetrieve: [
      'id',
      'source',
      'authorName',
      'authorHandle',
      'authorAvatar',
      'authorId',
      'authorBio',
      'createdAt',
      'niches',
    ],
  });

  if (!meiliResult || meiliResult.hits.length === 0) {
    return noCacheJsonResponse({ data: [], meta: { query, total: 0 } });
  }

  // Group by authorId to deduplicate
  const identityMap = new Map<string, IdentityResultItem>();
  for (const hit of meiliResult.hits) {
    const key = hit.authorId || hit.authorHandle || hit.id;
    const existing = identityMap.get(key);
    if (existing) {
      existing.postCount += 1;
    } else {
      identityMap.set(key, {
        id: key,
        protocol: hit.protocol || hit.source,
        displayName: hit.authorName || hit.authorHandle || 'Unknown',
        handle: hit.authorHandle || null,
        avatarUrl: hit.authorAvatar || null,
        bio: hit.authorBio || '',
        postCount: 1,
      });
    }
  }

  return noCacheJsonResponse({
    data: Array.from(identityMap.values()).slice(0, limit),
    meta: { query, total: identityMap.size },
  });
}
