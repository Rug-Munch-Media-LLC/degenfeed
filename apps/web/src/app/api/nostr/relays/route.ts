/**
 * GET /api/nostr/relays
 * POST /api/nostr/relays
 *
 * Relay management API.
 *
 * GET: List our relay info and registered users.
 * POST: Publish a kind 10002 (Relay List Metadata) event.
 *
 * POST Body: {
 *   event: NostrEvent;  // Signed kind 10002 event
 * }
 *
 * The kind 10002 event tells the network which relays the user
 * wants to read from and write to. Our relay is always the write relay.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET: Get relay status info
 */
export async function GET() {
  try {
    const workerUrl =
      process.env.WORKER_URL ?? process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787';

    const res = await fetch(`${workerUrl}/api/nostr/relays`, {
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Fall through to local response
  }

  // Fallback: return local relay info
  return NextResponse.json({
    relay: {
      ws: process.env.NOSTR_RELAY_WS || 'ws://127.0.0.1:8085',
      wss: process.env.NOSTR_RELAY_WSS || 'wss://nostr.degenfeed.xyz',
      nip05Domain: process.env.NIP05_DOMAIN || 'nostr.degenfeed.xyz',
      nip05WellKnown: `https://${process.env.NIP05_DOMAIN || 'nostr.degenfeed.xyz'}/.well-known/nostr.json`,
    },
    totalUsers: 0,
    users: [],
  });
}

/**
 * POST: Publish a relay list event (kind 10002)
 */
export async function POST(request: NextRequest) {
  try {
    const res = await proxyPost('/api/nostr/publish', request);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Relay service unavailable' } },
      { status: 503 },
    );
  }
}
