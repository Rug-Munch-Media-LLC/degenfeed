/**
 * visual-feed route — /api/feed/visual*
 *
 * Visual media feed aggregating from Pixelfed, Zora, Bluesky, Nostr,
 * Farcaster, and GoToSocial into a unified masonry-grid feed.
 *
 * Query params:
 *   sources=pixelfed,zora,bluesky — comma-separated source list (default: all)
 *   filter=all|photos|nfts|video|bluesky — media type filter
 *   sort=newest|trending|top — sort order
 *   cursor=0 — pagination offset
 *   limit=30 — results per page (max 100)
 */

import type { VisualSource } from '@degenfeed/types';
import {
  getForYouVisualFeed,
  getTrendingVisualFeed,
  getVisualFeed,
} from '../feed/visual-aggregator';
import type { Env } from '../index';
import { jsonResponse } from '../index';

const VALID_SOURCES = new Set([
  'pixelfed',
  'zora',
  'bluesky',
  'nostr',
  'farcaster',
  'gotosocial',
  'all',
]);
const VALID_FILTERS = new Set(['all', 'photos', 'nfts', 'video', 'bluesky']);
const VALID_SORTS = new Set(['newest', 'trending', 'top']);

function parseSources(raw: string | null): VisualSource[] {
  if (!raw || raw === 'all') return ['all'];
  const parts = raw.split(',').map((s) => s.trim().toLowerCase() as VisualSource);
  const valid = parts.filter((s) => VALID_SOURCES.has(s));
  return valid.length > 0 ? valid : ['all'];
}

export async function handleVisualFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const rawSources = params.get('sources');
  const sources = parseSources(rawSources);
  const rawFilter = params.get('filter')?.toLowerCase() ?? 'all';
  const filter = VALID_FILTERS.has(rawFilter)
    ? (rawFilter as 'all' | 'photos' | 'nfts' | 'video' | 'bluesky')
    : 'all';
  const rawSort = params.get('sort')?.toLowerCase() ?? 'newest';
  const sort = VALID_SORTS.has(rawSort) ? (rawSort as 'newest' | 'trending' | 'top') : 'newest';
  const cursor = params.get('cursor') ?? undefined;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);

  const result = await getVisualFeed(env, {
    sources,
    filter,
    sort,
    cursor,
    limit,
  });

  return jsonResponse(result, 200, {
    'cache-control': 'public, max-age=15, stale-while-revalidate=60',
  });
}

export async function handleVisualTrending(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);

  const result = await getTrendingVisualFeed(env, limit);

  return jsonResponse(result, 200, {
    'cache-control': 'public, max-age=30, stale-while-revalidate=120',
  });
}

export async function handleVisualForYou(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get('limit')) || 30, 100);
  const followingOnly = params.get('following') === 'true';
  const creatorFilter = params.get('creators')?.split(',').filter(Boolean);

  const result = await getForYouVisualFeed(env, {
    limit,
    followingOnly,
    creatorFilter,
  });

  return jsonResponse(result, 200, {
    'cache-control': 'public, max-age=15, stale-while-revalidate=60',
  });
}
