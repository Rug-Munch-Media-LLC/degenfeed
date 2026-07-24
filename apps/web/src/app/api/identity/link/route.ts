import { type NextRequest, NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

const VALID_PROTOCOLS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'reddit',
  'threads',
  'lemmy',
  'rss',
  'peertube',
  'zora',
];

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to link or DELETE to unlink.' },
    { status: 405 },
  );
}

/**
 * POST /api/identity/link
 *
 * Link two protocol identities together as the same user.
 * When a user connects their Nostr pubkey AND Mastodon handle,
 * this endpoint records the link for cross-protocol identity resolution.
 *
 * Body: {
 *   protocol: "nostr",              // protocol to link
 *   identityData: { npub: "..." },  // protocol-specific identity
 *   walletAddress: "0x...",         // wallet that owns this identity
 *   targetProtocol?: "mastodon",    // (optional) second protocol to link
 *   targetIdentity?: { handle: "..." }  // (optional) second identity data
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      protocol,
      identity: identityData,
      walletAddress,
      targetProtocol,
      targetIdentity,
    } = body;

    if (!protocol || !VALID_PROTOCOLS.includes(protocol)) {
      return NextResponse.json(
        { error: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}` },
        { status: 400 },
      );
    }

    if (
      !identityData ||
      typeof identityData !== 'object' ||
      Object.keys(identityData).length === 0
    ) {
      return NextResponse.json({ error: 'Identity data is required' }, { status: 400 });
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required to link an identity' },
        { status: 400 },
      );
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
          return NextResponse.json(
            { error: 'farcaster requires fid or username' },
            { status: 400 },
          );
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
      case 'threads':
        if (!identityData.username && !identityData.did) {
          return NextResponse.json({ error: 'threads requires username or did' }, { status: 400 });
        }
        break;
      case 'lemmy':
        if (!identityData.username) {
          return NextResponse.json({ error: 'lemmy requires username' }, { status: 400 });
        }
        break;
      case 'rss':
        if (!identityData.url) {
          return NextResponse.json({ error: 'rss requires url' }, { status: 400 });
        }
        break;
      case 'peertube':
        if (!identityData.username && !identityData.channelId) {
          return NextResponse.json(
            { error: 'peertube requires username or channelId' },
            { status: 400 },
          );
        }
        break;
      case 'zora':
        if (!identityData.address && !identityData.ens) {
          return NextResponse.json({ error: 'zora requires address or ens' }, { status: 400 });
        }
        break;
    }

    // If target protocol and identity are provided, link both
    if (targetProtocol && targetIdentity) {
      if (!VALID_PROTOCOLS.includes(targetProtocol)) {
        return NextResponse.json(
          { error: `Invalid target protocol: ${targetProtocol}` },
          { status: 400 },
        );
      }

      // In production, store the bidirectional link in Postgres/KV
      return NextResponse.json({
        success: true,
        links: [
          { protocol, identity: identityData, walletAddress },
          { protocol: targetProtocol, identity: targetIdentity, walletAddress },
        ],
        crossProtocol: true,
      });
    }

    // Single protocol link
    return NextResponse.json({ success: true, protocol, linked: true, walletAddress });
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol');
    const wallet = searchParams.get('wallet');

    if (!protocol || !VALID_PROTOCOLS.includes(protocol)) {
      return NextResponse.json(
        { error: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}` },
        { status: 400 },
      );
    }

    if (!wallet) {
      return NextResponse.json({ error: 'wallet parameter is required' }, { status: 400 });
    }

    // In production, this removes the linked identity from Postgres/KV
    return NextResponse.json({ success: true, protocol, unlinked: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to unlink identity' }, { status: 500 });
  }
}
