/**
 * @degenfeed/api-worker — Unified Image Feed Router
 *
 * Aggregates images from ALL sources into one unified feed:
 *   GET /api/feed/images/trending    — Trending images
 *   GET /api/feed/images/latest      — Latest images
 *   GET /api/feed/images/category    — By category (art, photography, memes, nft)
 *   GET /api/feed/images/creator     — By creator
 *
 * Types: ./image-feed-types
 * Source fetchers: ./image-feed-sources
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import type { UnifiedImage, ImageCategory, ImageFeedResponse } from './image-feed-types';
import {
  fetchPixelfedImages,
  fetchZoraImages,
  fetchMastodonImages,
  fetchNostrImages,
  fetchBlueskyImages,
} from './image-feed-sources-fediverse';
import {
  fetchLensImages,
  fetchDecentralizedImages,
  fetchRedditImages,
  fetchSelfHostedImages,
} from './image-feed-sources-misc';

// ─── Deduplication ────────────────────────────────────────────────────────

function deduplicateImages(images: UnifiedImage[]): UnifiedImage[] {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = `${img.imageUrl}:${img.author.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Filter by category ───────────────────────────────────────────────────

function filterByCategory(images: UnifiedImage[], category?: string): UnifiedImage[] {
  if (!category || category === 'all') return images;
  return images.filter((img) => img.category === (category as ImageCategory));
}

// ─── Filter by creator ────────────────────────────────────────────────────

function filterByCreator(images: UnifiedImage[], creatorId?: string): UnifiedImage[] {
  if (!creatorId) return images;
  const lower = creatorId.toLowerCase();
  return images.filter(
    (img) =>
      img.author.id.toLowerCase().includes(lower) ||
      img.author.displayName.toLowerCase().includes(lower) ||
      img.author.handle?.toLowerCase().includes(lower),
  );
}

// ─── Rank helpers ─────────────────────────────────────────────────────────

function rankByTrending(images: UnifiedImage[]): UnifiedImage[] {
  return [...images].sort((a, b) => {
    const scoreA = a.likes + a.shares * 2 + a.comments * 3;
    const scoreB = b.likes + b.shares * 2 + b.comments * 3;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.createdAt - a.createdAt;
  });
}

function rankByLatest(images: UnifiedImage[]): UnifiedImage[] {
  return [...images].sort((a, b) => b.createdAt - a.createdAt);
}

// ─── Main fetcher ─────────────────────────────────────────────────────────

async function fetchAllImages(
  env: Env,
  limit: number,
  filters: { category?: string; creatorId?: string; sort?: 'trending' | 'latest' } = {},
): Promise<{ data: UnifiedImage[]; perSource: Record<string, number>; errors: string[] }> {
  const errors: string[] = [];
  const perSource: Record<string, number> = {};
  const perSourceLimit = Math.max(Math.ceil(limit / 7), 10);

  const fetchers: Array<{ source: string; fetch: Promise<UnifiedImage[]> }> = [
    { source: 'pixelfed', fetch: fetchPixelfedImages(env, perSourceLimit) },
    { source: 'zora', fetch: fetchZoraImages(env, perSourceLimit) },
    { source: 'mastodon', fetch: fetchMastodonImages(env, perSourceLimit) },
    { source: 'nostr', fetch: fetchNostrImages(env, perSourceLimit) },
    { source: 'bluesky', fetch: fetchBlueskyImages(env, perSourceLimit) },
    { source: 'lens', fetch: fetchLensImages(env, perSourceLimit) },
    { source: 'reddit', fetch: fetchRedditImages(env, perSourceLimit) },
  ];

  // Optional self-hosted sources
  if (env.IMMICH_URL) {
    fetchers.push({ source: 'immich', fetch: fetchSelfHostedImages(env, perSourceLimit) });
  }

  // Decentralized images
  fetchers.push({ source: 'ipfs', fetch: fetchDecentralizedImages(env, perSourceLimit) });

  const results = await Promise.allSettled(
    fetchers.map(async (f) => {
      try {
        const images = await f.fetch;
        return { source: f.source, images };
      } catch (err) {
        errors.push(`${f.source}: ${err instanceof Error ? err.message : 'unknown'}`);
        return { source: f.source, images: [] };
      }
    }),
  );

  const allImages: UnifiedImage[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      perSource[r.value.source] = r.value.images.length;
      allImages.push(...r.value.images);
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : 'unknown error');
    }
  }

  // Dedup
  const deduped = deduplicateImages(allImages);

  // Filter
  let filtered = deduped;
  if (filters.category) filtered = filterByCategory(filtered, filters.category);
  if (filters.creatorId) filtered = filterByCreator(filtered, filters.creatorId);

  // Sort
  if (filters.sort === 'trending') filtered = rankByTrending(filtered);
  else filtered = rankByLatest(filtered);

  return { data: filtered, perSource, errors };
}

// ─── Route Handlers ───────────────────────────────────────────────────────

/**
 * GET /api/feed/images/trending — Trending images across all sources
 */
export async function handleImagesTrending(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const category = params.get('category') ?? undefined;

  const { data, perSource, errors } = await fetchAllImages(env, limit, {
    category,
    sort: 'trending',
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    },
  );
}

/**
 * GET /api/feed/images/latest — Latest images across all sources
 */
export async function handleImagesLatest(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const cursor = Number(params.get('cursor')) || 0;
  const category = params.get('category') ?? undefined;

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    category,
    sort: 'latest',
  });

  const paginated = data.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < data.length ? String(cursor + limit) : undefined;

  return jsonResponse(
    {
      data: paginated,
      nextCursor,
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=15, stale-while-revalidate=60',
    },
  );
}

/**
 * GET /api/feed/images/category — Images by category
 */
export async function handleImagesCategory(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const category = params.get('category') || 'general';
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const sort = (params.get('sort') || 'trending') as 'trending' | 'latest';

  const validCategories: string[] = ['art', 'photography', 'memes', 'nft', 'general', 'ai', 'all'];
  const resolvedCategory = validCategories.includes(category) ? category : 'all';

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    category: resolvedCategory === 'all' ? undefined : resolvedCategory,
    sort,
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=30, stale-while-revalidate=120',
    },
  );
}

/**
 * GET /api/feed/images/creator — Images by creator
 */
export async function handleImagesCreator(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const creatorId = params.get('creator');
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const sort = (params.get('sort') || 'latest') as 'trending' | 'latest';

  if (!creatorId) {
    return jsonResponse({ error: 'creator query parameter is required' }, 400);
  }

  const { data, perSource, errors } = await fetchAllImages(env, limit * 2, {
    creatorId,
    sort,
  });

  return jsonResponse(
    {
      data: data.slice(0, limit),
      meta: { total: data.length, perSource, errors, fetchedAt: Date.now() },
    } satisfies ImageFeedResponse,
    200,
    {
      'cache-control': 'public, max-age=15, stale-while-revalidate=60',
    },
  );
}
