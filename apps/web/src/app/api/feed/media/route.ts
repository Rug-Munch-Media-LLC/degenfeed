/**
 * @degenfeed/web — GET /api/feed/media
 *
 * Unified media feed endpoint.
 * Filters posts from ALL protocol providers where contentType is 'image' or 'video',
 * or embeds[].kind is 'image' or 'video'.
 *
 * Query params:
 *   type: 'images' | 'videos' | 'live' | (all if omitted)
 *   limit: number (default 30)
 *   page: number (default 1)
 *   sources: comma-separated protocol IDs (optional filter)
 *
 * Returns VisualFeedResponse
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const limit = searchParams.get('limit') || '30';
    const page = searchParams.get('page') || '1';
    const sources = searchParams.get('sources');

    // Build filter params for the worker
    const proxySearchParams = new URLSearchParams();
    proxySearchParams.set('limit', limit);
    proxySearchParams.set('page', page);

    // Map our media type filter to worker filter params
    if (type === 'images') {
      proxySearchParams.set('contentType', 'image');
    } else if (type === 'videos') {
      proxySearchParams.set('contentType', 'video');
    } else if (type === 'live') {
      proxySearchParams.set('contentType', 'video');
      proxySearchParams.set('isLive', 'true');
    }

    // Source filter
    if (sources) {
      proxySearchParams.set('sources', sources);
    }

    // All image/video capable protocols
    proxySearchParams.set(
      'protocols',
      sources || 'pixelfed,bluesky,zora,nostr,peertube,farcaster,lens,mastodon,youtube',
    );

    // Request visual feed format from worker
    proxySearchParams.set('format', 'visual');

    // Construct the worker path with params
    const workerPath = `/api/feed/media?${proxySearchParams.toString()}`;

    return await proxyGet(workerPath, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
