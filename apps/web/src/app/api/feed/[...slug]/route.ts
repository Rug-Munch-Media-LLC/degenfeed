/**
 * @degenfeed/web — GET /api/feed/[...slug]
 *
 * Catch-all route for protocol feed endpoints that don't have a dedicated
 * route handler (e.g., /api/feed/nostr, /api/feed/bluesky, /api/feed/lens).
 *
 * Forwards the request to the bridge worker via proxyGet().
 * Dedicated routes (mastodon, for-you, home, etc.) take priority
 * over this catch-all.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  try {
    const slug = (await params).slug;
    const path = `/api/feed/${slug.join('/')}`;
    return await proxyGet(path, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message, data: [], meta: { errors: [message] } },
      { status: 200 },
    );
  }
}
