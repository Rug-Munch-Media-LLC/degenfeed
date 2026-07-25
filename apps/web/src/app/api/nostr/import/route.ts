/**
 * POST /api/nostr/import
 *
 * Import an existing nsec and register with our relay.
 *
 * The nsec is used CLIENT-SIDE to derive the pubkey.
 * The server only receives the pubkey for registration.
 *
 * Body: {
 *   nsec: string;     // Existing nsec to import
 *   username: string; // Desired Nostr username
 * }
 *
 * Response: {
 *   pubkey: string;
 *   npub: string;
 *   nip05: string;
 *   registered: boolean;
 * }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../../_proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // nsec decoding and pubkey derivation happens CLIENT-SIDE
    // The server receives the pubkey + username for registration
    const body = await request.json();
    const { nsec, username } = body as { nsec?: string; username?: string };

    if (!nsec) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'nsec is required' } },
        { status: 400 },
      );
    }

    if (!username || username.length < 2) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Username is required (2+ characters)' } },
        { status: 400 },
      );
    }

    // Validate nsec format
    if (!nsec.startsWith('nsec1')) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid nsec format. Must start with nsec1...',
          },
        },
        { status: 400 },
      );
    }

    // The client has already derived the pubkey locally.
    // We proxy to the bridge for registration.
    try {
      const res = await proxyPost('/api/nostr/register', request);
      const data = await res.json();
      return NextResponse.json({ ...data, imported: true });
    } catch {
      return NextResponse.json(
        { error: { code: 'SERVICE_UNAVAILABLE', message: 'Import service unavailable' } },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Import failed' } },
      { status: 500 },
    );
  }
}
