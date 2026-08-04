/**
 * @degenfeed/web — /api/feed/mastodon
 *
 * Fetches the Mastodon/GoToSocial public timeline via the local bridge worker
 * (WORKER_URL → bridge /api/feed/mastodon), which aggregates GtS statuses into
 * UnifiedPost[] and NEVER returns an empty feed (seeds demo content if the
 * provider returns nothing).
 *
 * Previously this route fetched GoToSocial directly at http://127.0.0.1:8082,
 * which fails inside the Docker container (container-localhost) and returns a
 * {data, meta} shape without a `posts` key. Proxying through the bridge keeps
 * the response shape consistent with every other /api/feed/* route.
 *
 * Environment:
 *   WORKER_URL  — bridge base URL (default http://host.docker.internal:3101)
 *   MASTODON_INSTANCE_URL — no longer used directly; bridge handles GtS.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/feed/mastodon', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message, data: [], posts: [], meta: { errors: [message] } },
      { status: 200 },
    );
  }
}
