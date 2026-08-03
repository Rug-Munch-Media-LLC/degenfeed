/**
 * NIP-05 Well-Known Verification Endpoint
 *
 * Serves /.well-known/nostr.json for NIP-05 identifier verification.
 * This allows users to claim username@nostr.degenfeed.xyz as their Nostr identifier.
 *
 * Nostr clients (Damus, Primal, etc.) fetch this file to verify that a pubkey
 * is associated with a NIP-05 identifier.
 *
 * The bridge server maintains the canonical mapping. This route proxies to it,
 * but also includes direct mappings for known users.
 */

import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

interface Nip05Names {
  [name: string]: string; // username -> hex pubkey
}

interface Nip05Relays {
  [pubkey: string]: string[]; // pubkey -> relay URLs
}

interface NostrJson {
  names: Nip05Names;
  relays?: Nip05Relays;
}

// ─── Direct in-app known users ──────────────────────────────────────────
// These are populated by the registration flow. For production, this should
// be stored in a database/Redis and synced from the bridge server.
//
// The canonical source is the bridge server's in-memory KV store.
// This file serves as a fallback for direct requests to the web app.

const knownNames: Nip05Names = {};
const knownRelays: Nip05Relays = {};

// ─── Handlers ───────────────────────────────────────────────────────────

/**
 * GET /.well-known/nostr.json
 * NIP-05 verification: maps usernames to pubkeys.
 *
 * Query params:
 *   name - Optional. Filter to a specific username.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nameFilter = searchParams.get('name');

  // Try to fetch from bridge server first (canonical source)
  try {
    const workerUrl =
      process.env.WORKER_URL ??
      process.env.NEXT_PUBLIC_WORKER_URL ??
      process.env.NEXT_PUBLIC_API_BASE ??
      'http://localhost:8787';

    const bridgeRes = await fetch(`${workerUrl}/api/nostr/relays`, {
      signal: AbortSignal.timeout(3000),
    });

    if (bridgeRes.ok) {
      const bridgeData = (await bridgeRes.json()) as {
        users?: Array<{ username: string; npub: string; nip05: string }>;
      };

      if (bridgeData.users) {
        for (const user of bridgeData.users) {
          try {
            const { npubDecode } = await import('@degenfeed/nostr-sdk');
            const hex = npubDecode(user.npub);
            knownNames[user.username] = hex;
            knownRelays[hex] = ['wss://nostr.degenfeed.xyz'];
          } catch {
            // If parsing fails, use the npub directly (might already be hex)
            if (user.npub.length === 64 && /^[0-9a-f]+$/i.test(user.npub)) {
              knownNames[user.username] = user.npub;
              knownRelays[user.npub] = ['wss://nostr.degenfeed.xyz'];
            }
          }
        }
      }
    }
  } catch {
    // Bridge unavailable — use local knownNames
    console.log('[nip05] Bridge unavailable, using local mappings');
  }

  // Filter to requested name if provided
  if (nameFilter) {
    const pubkey = knownNames[nameFilter];
    if (!pubkey) {
      return NextResponse.json(
        { names: {}, relays: {} },
        {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        },
      );
    }

    const result: NostrJson = {
      names: { [nameFilter]: pubkey },
      relays: { [pubkey]: knownRelays[pubkey] || ['wss://nostr.degenfeed.xyz'] },
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  // Return all known names
  const result: NostrJson = {
    names: knownNames,
    relays: knownRelays,
  };

  return NextResponse.json(result, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
