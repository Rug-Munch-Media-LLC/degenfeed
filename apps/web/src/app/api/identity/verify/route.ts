import {
  getPlatformMeta,
  isExternalPlatform,
  isVerifyablePlatform,
  verifyIdentity,
} from '@degenfeed/identity';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  protocol: z.enum(['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'twitter', 'youtube', 'github', 'discord', 'telegram']),
  input: z.string().min(1).max(500),
  nip05: z.string().email().optional(),
});

/**
 * POST /api/identity/verify
 *
 * Verify a "Bring Your Own Account" handle for the given protocol.
 * Returns canonical identity data (identifier, handle, display name) that the
 * caller stores as a linked identity.
 *
 * Body: {
 *   protocol: "nostr" | "bluesky" | ...,
 *   input: "npub1..." | "alice.bsky.social" | ...,
 *   nip05?: "alice@example.com"   // optional NIP-05 cross-check for Nostr
 * }
 *
 * Response: { ok: true, identity: { protocol, identifier, handle, ... } }
 * or { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = VerifySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { protocol, input, nip05 } = parsed.data;

    if (!SUPPORTED_PROTOCOLS.includes(protocol as (typeof SUPPORTED_PROTOCOLS)[number])) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported protocol. Supported: ${SUPPORTED_PROTOCOLS.join(', ')}`,
        },
        { status: 400 },
      );
    }

    if (!input) {
      return NextResponse.json({ ok: false, error: 'input is required' }, { status: 400 });
    }

    const identity = await verifyIdentity(protocol, input, { nip05: body.nip05 });

    if (!identity) {
      return NextResponse.json(
        {
          ok: false,
          error: `Could not verify "${input}" on ${protocol}. Check the format and try again.`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ ok: true, identity });
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Verification failed' }, { status: 500 });
  }
}

/**
 * GET /api/identity/verify
 *
 * Returns the list of linkable platforms so the UI can render connect buttons.
 * Each entry includes display metadata and the connect mode (verifyable vs external).
 */
export async function GET() {
  const platforms = SUPPORTED_PROTOCOLS.map((protocol) => {
    const meta = getPlatformMeta(protocol);
    if (!meta) return null;
    return {
      id: protocol,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      placeholder: meta.placeholder,
      hint: meta.hint,
      connectMode: isVerifyablePlatform(protocol)
        ? ('verifyable' as const)
        : isExternalPlatform(protocol)
          ? ('external' as const)
          : null,
    };
  }).filter((p) => p !== null);

  return NextResponse.json({ ok: true, platforms });
}
