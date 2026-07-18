import { type NextRequest, NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

/**
 * POST /api/user/export/credentials
 *
 * Accepts user's linked protocol credentials (already decrypted client-side)
 * and returns a portable credentials file that users can import into any
 * compatible app (Nostr, Mastodon, Bluesky, etc.)
 *
 * Body: { credentials: Array<{ protocol: string; label: string; ... }> }
 *
 * Response: JSON file download with portable credential format.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      credentials?: Array<Record<string, unknown>>;
    };

    if (!Array.isArray(body.credentials) || body.credentials.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty "credentials" array' },
        { status: 400 },
      );
    }

    // Build a portable credential bundle with a standard format
    const portable = {
      exportedAt: new Date().toISOString(),
      source: 'DegenFeed',
      version: 1,
      credentials: body.credentials.map((cred) => ({
        protocol: cred.protocol || 'unknown',
        label: cred.label || `${cred.protocol} Credential`,
        type: cred.type || 'access_token',
        portable: true,
        // Each credential includes a note on how to use it elsewhere
        usage: getPortableUsage(cred.protocol as string),
        // Protocol-specific fields — only the portable ones
        ...mapPortableFields(cred),
      })),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `degenfeed-portable-credentials-${timestamp}.json`;

    const json = JSON.stringify(portable, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(json, 'utf-8')),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Credential export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Map protocol-specific credential fields to portable format */
function mapPortableFields(cred: Record<string, unknown>): Record<string, unknown> {
  const protocol = cred.protocol as string;

  switch (protocol) {
    case 'nostr':
      return {
        nsec: cred.nsec || null,
        npub: cred.publicKey || null,
        note: 'Import your nsec into any Nostr client (Damus, Coracle, Snort, etc.)',
      };

    case 'mastodon':
    case 'lemmy':
    case 'peertube':
      return {
        instance: cred.instance || (protocol === 'mastodon' ? 'social.degenfeed.xyz' : null),
        accessToken: cred.accessToken || null,
        handle: cred.handle || null,
        note: `Use these credentials to log into any ${protocol === 'mastodon' ? 'Mastodon' : protocol === 'lemmy' ? 'Lemmy' : 'PeerTube'} app (Ice Cubes, Mastodon for iOS/Android, Tusky, etc.)`,
      };

    case 'bluesky':
      return {
        handle: cred.handle || null,
        appPassword: cred.appPassword || null,
        did: cred.did || null,
        note: 'Use your handle and app password to log into any Bluesky client (Graysky, Skeets, etc.)',
      };

    case 'farcaster':
      return {
        fid: cred.fid || null,
        username: cred.username || null,
        signerKey: cred.signerKey || null,
        note: 'Farcaster signer keys are app-specific. Use Warpcast or other Farcaster clients.',
      };

    case 'lens':
      return {
        profileId: cred.profileId || null,
        handle: cred.handle || null,
        note: 'Lens uses your connected wallet for authentication. Use Lenster, Orb, or other Lens apps.',
      };

    case 'threads':
      return {
        threadsId: cred.threadsId || null,
        accessToken: cred.accessToken || null,
        note: 'Threads credentials work with the Threads API and compatible apps.',
      };

    default:
      // For unknown protocols, include all non-standard fields
      return { ...cred };
  }
}

/** Generate a human-readable usage note for each protocol */
function getPortableUsage(protocol: string): string {
  const usage: Record<string, string> = {
    nostr: 'Use your nsec to sign in to any Nostr client.',
    mastodon: 'Use your handle and access token on any Mastodon app.',
    lemmy: 'Use your credentials on any Lemmy instance that allows remote login.',
    peertube: 'Use your credentials on any PeerTube instance.',
    bluesky: 'Use your handle and app password on any Bluesky client.',
    farcaster: 'Use your Farcaster account with Warpcast or other clients.',
    lens: 'Use your wallet to access Lens via Lenster, Orb, etc.',
    threads: 'Use your Threads credentials with compatible apps.',
    ethereum: 'Use your wallet with any dApp or wallet app.',
    solana: 'Use your wallet with any Solana dApp or wallet app.',
  };
  return usage[protocol] || 'These credentials are portable to compatible apps.';
}
