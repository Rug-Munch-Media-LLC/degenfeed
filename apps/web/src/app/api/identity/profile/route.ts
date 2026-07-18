import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Mock identity database — in production, this reads from the cross-platform
 * identity store (Postgres / Cloudflare KV).
 */
interface StoredIdentity {
  wallet: string;
  nostr?: { npub: string; verified: boolean };
  farcaster?: { fid: number; username: string; verified: boolean };
  lens?: { profileId: string; handle: string; verified: boolean };
  bluesky?: { did: string; handle: string; verified: boolean };
  mastodon?: { handle: string; instance: string; verified: boolean };
  reddit?: { username: string; verified: boolean };
}

const MOCK_IDENTITIES: Record<string, StoredIdentity> = {
  '0x1234567890abcdef1234567890abcdef12345678': {
    wallet: '0x1234567890abcdef1234567890abcdef12345678',
    nostr: { npub: 'npub1abc', verified: true },
    farcaster: { fid: 123, username: 'alice', verified: true },
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const normalizedWallet = wallet.toLowerCase();
    const identity = MOCK_IDENTITIES[normalizedWallet] || null;

    return NextResponse.json({ data: identity });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to resolve identity profile' }, { status: 500 });
  }
}
