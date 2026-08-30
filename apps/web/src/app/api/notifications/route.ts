import { type NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../_auth';
import { proxyGet } from '../_proxy';

export const dynamic = 'force-dynamic';

/**
 * Unified cross-protocol notifications endpoint.
 *
 * GET /api/notifications?limit=20&protocols=nostr,bluesky
 *
 * Returns a single notification feed with events from ALL protocols:
 *   - Likes, reposts, replies, follows, mentions
 *   - Nostr zaps ⚡
 *   - Bridge notifications (cross-post status)
 *   - All sorted by recency
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';

    // Get wallet from session for personalized notifications
    const session = await getSessionFromRequest(request);
    const walletParam = session?.address ? `&wallet=${session.address}` : '';

    // Try worker/bridge proxy first
    try {
      const res = await proxyGet('/api/notifications', request);
      if (res.ok) return res;
    } catch {
      // Fall through
    }

    // Direct fetch to bridge
    const workerUrl =
      process.env.WORKER_URL ||
      process.env.NEXT_PUBLIC_WORKER_URL ||
      'http://host.docker.internal:3101';

    const bridgeRes = await fetch(
      `${workerUrl}/api/notifications?limit=${encodeURIComponent(limit)}${walletParam}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie')! } : {}),
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      return NextResponse.json(data);
    }

    // Fallback: return empty
    return NextResponse.json({
      notifications: [],
      meta: { total: 0, unread: 0, protocols: [] },
    });
  } catch {
    return NextResponse.json({
      notifications: [],
      meta: { total: 0, unread: 0, protocols: [] },
    });
  }
}
