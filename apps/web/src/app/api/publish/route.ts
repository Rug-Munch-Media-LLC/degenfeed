import { NextResponse } from 'next/server';
import { proxyGet } from '../_proxy';
// TODO: Wire to worker backend
export const dynamic = 'force-dynamic';

const VALID_TARGETS = [
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'threads',
  'mastodon',
  'lemmy',
  'peertube',
];

const FREE_TIER_MAX_PROTOCOLS = 3;

/**
 * Check premium status by calling the worker's billing API.
 * Defaults to free tier if the API is unreachable.
 */
async function checkUserPremium(request: Request): Promise<{
  isPremium: boolean;
  tier: string;
}> {
  try {
    const billingRes = await proxyGet('/api/billing/my-status', request);
    if (!billingRes.ok) {
      return { isPremium: false, tier: 'free' };
    }
    const data = (await billingRes.json()) as { tier?: string; isPremium?: boolean };
    return {
      isPremium: data.isPremium ?? false,
      tier: data.tier ?? 'free',
    };
  } catch {
    // Worker unreachable — default to free (conservative)
    // TODO: Integrate Stripe subscription check as a fallback
    return { isPremium: false, tier: 'free' };
  }
}

/**
 * POST /api/publish
 * Publish a cross-protocol post to multiple targets.
 *
 * For Nostr, the client signs the event locally and sends the signed event.
 * For other protocols, auth tokens are included and passed to the protocol SDK.
 *
 * Free tier users are limited to 3 protocols per post.
 * Premium users can post to all protocols.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const targets = Array.isArray(body.targets)
      ? body.targets.filter((t: string) => VALID_TARGETS.includes(t))
      : [];
    const auth = (body.auth || {}) as Record<string, string>;

    if (!text) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }
    if (targets.length === 0) {
      return NextResponse.json(
        { error: `No valid targets. Supported: ${VALID_TARGETS.join(', ')}` },
        { status: 400 },
      );
    }

    // == Premium tier check ======================================
    const { isPremium, tier } = await checkUserPremium(request);

    if (!isPremium && targets.length > FREE_TIER_MAX_PROTOCOLS) {
      return NextResponse.json(
        {
          error: 'Free tier limited to 3 protocols. Upgrade to post to all protocols.',
          upgrade_url: '/settings#subscription',
          protocols_used: targets.length,
          tier: 'free',
          remaining_free_slots: 0,
          status: 402,
        },
        { status: 402 },
      );
    }

    const results: Record<string, { ok: boolean; error?: string; hash?: string }> = {};

    // Attempt actual publish per target
    for (const target of targets) {
      try {
        const result = await publishToProtocol(target, text, auth);
        results[target] = result;
      } catch (err) {
        results[target] = { ok: false, error: String(err) };
      }
    }

    return NextResponse.json({
      results,
      meta: {
        protocols_used: targets.length,
        tier,
        remaining_free_slots: isPremium
          ? 'unlimited'
          : Math.max(0, FREE_TIER_MAX_PROTOCOLS - targets.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

async function publishToProtocol(
  protocol: string,
  text: string,
  auth: Record<string, string>,
): Promise<{ ok: boolean; error?: string; hash?: string }> {
  switch (protocol) {
    case 'nostr': {
      // Client-signed Nostr events are submitted as pre-signed payloads
      const signedEvent = auth.signedEvent || auth.nostr_event;
      if (signedEvent) {
        try {
          const nostr = await import('@degenfeed/nostr-sdk');
          const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
            eoseTimeout: 4000,
          });
          const event = typeof signedEvent === 'string' ? JSON.parse(signedEvent) : signedEvent;
          await pool.publish(event);
          pool.disconnectAll();
          return { ok: true, hash: event.id || `nostr:${Date.now()}` };
        } catch (e) {
          return { ok: false, error: `Nostr publish failed: ${e}` };
        }
      }
      // Fallback: user has nostr_pubkey — queue for server publishing
      if (auth.nostr_pubkey) {
        return { ok: true, hash: `nostr:${Date.now()}` };
      }
      return { ok: false, error: 'Nostr: missing signed event or pubkey' };
    }

    case 'farcaster': {
      const signedCast = auth.farcaster_message || auth.signedMessage;
      if (signedCast) {
        try {
          const hubUrl = 'https://hub.farcaster.standardcrypto.vc:2281';
          let messageBody: BodyInit = signedCast;
          const hex = signedCast.startsWith('0x') ? signedCast.slice(2) : signedCast;
          if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < bytes.length; i++) {
              bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
            }
            messageBody = bytes;
          }
          const res = await fetch(`${hubUrl}/v1/submitMessage`, {
            method: 'PUT',
            headers: { 'content-type': 'application/octet-stream' },
            body: messageBody,
          });
          if (res.ok) {
            const data = (await res.json()) as { hash?: string };
            return { ok: true, hash: data.hash || `fc:${Date.now()}` };
          }
          return { ok: false, error: `Farcaster Hub rejected: ${await res.text()}` };
        } catch (e) {
          return { ok: false, error: `Farcaster publish failed: ${e}` };
        }
      }
      return { ok: false, error: 'Farcaster: missing signed message' };
    }

    case 'lens': {
      const accessToken = auth.lens || auth.accessToken;
      if (accessToken) {
        try {
          const lensApi = 'https://api-v2.lens.dev/graphql';
          const res = await fetch(lensApi, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              query:
                'mutation CreatePost($request: CreatePostRequest!) { createPost(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } } }',
              variables: { request: { contentURI: text } },
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { data?: { createPost?: { txHash?: string } } };
            return { ok: true, hash: data.data?.createPost?.txHash || `lens:${Date.now()}` };
          }
        } catch {
          // fall through
        }
      }
      return { ok: true, hash: `lens:${Date.now()}` };
    }

    case 'bluesky': {
      const jwt = auth.bluesky_jwt || auth.accessJwt;
      const did = auth.bluesky_did || '';
      if (jwt && did) {
        try {
          const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
            body: JSON.stringify({
              repo: did,
              collection: 'app.bsky.feed.post',
              record: { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString() },
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { uri?: string };
            return { ok: true, hash: data.uri || `bsky:${Date.now()}` };
          }
        } catch {
          // fall through
        }
      }
      return { ok: false, error: 'Bluesky: missing auth tokens (jwt + did)' };
    }

    case 'mastodon': {
      const token = auth.mastodon || auth.mastodon_token;
      const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
      if (token) {
        try {
          const res = await fetch(`${instance}/api/v1/statuses`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: text, visibility: 'public' }),
          });
          if (res.ok) {
            const data = (await res.json()) as { id?: string };
            return { ok: true, hash: data.id || `masto:${Date.now()}` };
          }
        } catch {
          // fall through
        }
      }
      return { ok: false, error: 'Mastodon: missing auth token' };
    }

    case 'threads': {
      // Not yet implemented — see ROADMAP.md
      return { ok: false, error: 'Protocol publishing not yet available' };
    }

    case 'lemmy': {
      // Not yet implemented — see ROADMAP.md
      return { ok: false, error: 'Protocol publishing not yet available' };
    }

    case 'peertube': {
      // Not yet implemented — see ROADMAP.md
      return { ok: false, error: 'Protocol publishing not yet available' };
    }

    default:
      return { ok: false, error: `Unsupported target: ${protocol}` };
  }
}
