/**
 * feed-unified route — /api/feed/unified
 *
 * Blended timeline: social posts + Lemmy threads + PeerTube videos +
 * YouTube videos + Mastodon posts, interleaved by time with source badges.
 *
 * Query params:
 *   sources=social,lemmy,peertube,youtube,mastodon — comma-separated source list
 *   mix=balanced|social-heavy|video-heavy|discussion-heavy — blend ratio
 *   section=hot|new|top|active — applies to Lemmy
 *   limit=50 — max posts
 *   cursor — pagination cursor (Lemmy page_cursor)
 */

import { buildUnifiedFeed } from '../feed/unified-feed';
import type { Env } from '../index';
import { jsonResponse } from '../index';

export async function handleUnifiedFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const sources = params.get('sources') ?? 'all';
  const mix = (params.get('mix') ?? 'balanced') as
    | 'balanced'
    | 'social-heavy'
    | 'video-heavy'
    | 'discussion-heavy';
  const section = params.get('section') ?? 'hot';
  const limit = Math.min(Number(params.get('limit')) || 50, 100);
  const cursor = params.get('cursor') ?? undefined;

  const result = await buildUnifiedFeed(env, {
    sources,
    mix,
    section,
    limit,
    cursor,
  });

  return jsonResponse({ data: result.posts, meta: result.meta });
}
