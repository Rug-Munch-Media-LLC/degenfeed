import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VALID_PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit'];

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST to link or DELETE to unlink.' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { protocol, identity: identityData, walletAddress } = body;

    if (!protocol || !VALID_PROTOCOLS.includes(protocol)) {
      return NextResponse.json({ error: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}` }, { status: 400 });
    }

    if (!identityData || typeof identityData !== 'object' || Object.keys(identityData).length === 0) {
      return NextResponse.json({ error: 'Identity data is required' }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required to link an identity' }, { status: 400 });
    }

    // Validate required fields per protocol
    switch (protocol) {
      case 'nostr':
        if (!identityData.npub) {
          return NextResponse.json({ error: 'nostr requires npub' }, { status: 400 });
        }
        break;
      case 'farcaster':
        if (!identityData.fid && !identityData.username) {
          return NextResponse.json({ error: 'farcaster requires fid or username' }, { status: 400 });
        }
        break;
      case 'lens':
        if (!identityData.handle) {
          return NextResponse.json({ error: 'lens requires handle' }, { status: 400 });
        }
        break;
      case 'bluesky':
        if (!identityData.did && !identityData.handle) {
          return NextResponse.json({ error: 'bluesky requires did or handle' }, { status: 400 });
        }
        break;
      case 'mastodon':
        if (!identityData.handle) {
          return NextResponse.json({ error: 'mastodon requires handle' }, { status: 400 });
        }
        break;
      case 'reddit':
        if (!identityData.username) {
          return NextResponse.json({ error: 'reddit requires username' }, { status: 400 });
        }
        break;
    }

    // In production, this stores the linked identity in Postgres/KV
    return NextResponse.json({ success: true, protocol, linked: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol');
    const wallet = searchParams.get('wallet');

    if (!protocol || !VALID_PROTOCOLS.includes(protocol)) {
      return NextResponse.json({ error: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}` }, { status: 400 });
    }

    if (!wallet) {
      return NextResponse.json({ error: 'wallet parameter is required' }, { status: 400 });
    }

    // In production, this removes the linked identity from Postgres/KV
    return NextResponse.json({ success: true, protocol, unlinked: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unlink identity' }, { status: 500 });
  }
}
