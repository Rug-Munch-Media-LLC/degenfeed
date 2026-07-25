/**
 * POST /api/nostr/auth
 *
 * Authenticate a user with an existing Nostr key (nsec or extension).
 *
 * Two modes:
 *   1. Basic: Provide pubkey/npub to identify the user
 *   2. NIP-42: Provide pubkey + signed challenge for proof of ownership
 *
 * Body: {
 *   pubkey: string;        // 64-char hex public key
 *   npub?: string;          // bech32 npub
 *   signature?: string;     // NIP-42 auth event signature (optional)
 *   challenge?: string;     // Challenge string signed (optional)
 * }
 *
 * Never sends nsec over the wire. Auth is done via pubkey + optional signature.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../../_proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const res = await proxyPost('/api/nostr/auth', request);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Auth service unavailable' },
      },
      { status: 503 },
    );
  }
}
