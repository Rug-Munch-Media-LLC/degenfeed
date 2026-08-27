/**
 * POST /api/nostr/register
 *
 * Complete Nostr sign-up flow:
 *   1. Client generates nsec/npub keypair (NEVER sent to server)
 *   2. Client sends pubkey + desired username
 *   3. Server whitelists npub, registers NIP-05 (username@nostr.degenfeed.xyz)
 *   4. Server creates kind 0 profile metadata event on our relay
 *   5. Returns registration confirmation
 *
 * Body: {
 *   pubkey: string;     // 64-char hex public key
 *   npub?: string;      // bech32 npub (alternative to pubkey)
 *   username: string;   // desired nostr username
 *   profile?: {         // optional profile metadata
 *     name?: string;
 *     display_name?: string;
 *     about?: string;
 *     picture?: string;
 *   }
 * }
 *
 * Keys are NEVER stored on the server. Full key sovereignty.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { proxyPost } from '../../_proxy';

export const dynamic = 'force-dynamic';

const NostrRegisterSchema = z.object({
  pubkey: z.string().length(64).optional(),
  npub: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(30).regex(/^[a-z0-9_]+$/),
  profile: z.object({
    name: z.string().max(50).optional(),
    display_name: z.string().max(50).optional(),
    about: z.string().max(500).optional(),
    picture: z.string().url().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Proxy to bridge server which handles registration
    try {
      const res = await proxyPost('/api/nostr/register', request);
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } catch {
      // Bridge unavailable - return clear error
      return NextResponse.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Nostr registration service is temporarily unavailable. Please try again.',
          },
        },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } },
      { status: 500 },
    );
  }
}
