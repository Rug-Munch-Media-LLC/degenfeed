import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/identity/profile
 *
 * Resolve a cross-protocol unified profile.
 * Accepts any protocol identifier and returns ALL known identities.
 *
 * Query params:
 *   protocol  - Source protocol (nostr, bluesky, mastodon, farcaster, lens)
 *   id        - User ID on that protocol (npub, did, handle, fid, etc.)
 *   depth     - Resolution depth: basic | linked | full (default: linked)
 *
 * Returns a UnifiedProfile with handles across all known protocols,
 * follower counts, and confidence score.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol');
    const userId = searchParams.get('id');
    const depth = searchParams.get('depth') || 'linked';

    // Try worker/bridge proxy first
    try {
      const res = await proxyGet('/api/identity/profile', request);
      if (res.ok) return res;
    } catch {
      // Fall through
    }

    if (!protocol || !userId) {
      return NextResponse.json(
        {
          error: 'protocol and id parameters are required',
          example: '/api/identity/profile?protocol=nostr&id=npub1abc...',
        },
        { status: 400 },
      );
    }

    // Direct resolution via bridge
    const workerUrl =
      process.env.WORKER_URL ||
      process.env.NEXT_PUBLIC_WORKER_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      'http://localhost:8787';

    try {
      const bridgeRes = await fetch(
        `${workerUrl}/api/identity/profile?protocol=${encodeURIComponent(protocol)}&id=${encodeURIComponent(userId)}&depth=${encodeURIComponent(depth)}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (bridgeRes.ok) {
        const data = await bridgeRes.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fall through
    }

    // Fallback: return basic profile with the identity we have
    return NextResponse.json({
      profile: {
        profileId: `${protocol}:${userId}`,
        displayName: userId,
        bio: '',
        avatarUrl: '',
        handles: [
          {
            protocol,
            userId,
            handle: userId,
            verified: true,
          },
        ],
        primaryProtocol: protocol,
        totalFollowers: 0,
        protocolCount: 1,
        confidence: 0.5,
        firstSeen: Date.now(),
        lastResolved: Date.now(),
        dfUri: `df://profile/${protocol}/${userId}`,
      },
      resolutionDepth: depth,
      resolutionSource: 'fallback',
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to resolve identity profile' }, { status: 500 });
  }
}
