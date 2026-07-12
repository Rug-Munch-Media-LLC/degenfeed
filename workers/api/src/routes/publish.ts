import {
  createTextNote,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  type NostrEvent,
  RelayPool,
  signEvent,
  verifyEvent,
} from '@degenfeed/nostr-sdk';
import { type Env, jsonResponse, log, rateLimit } from '../index';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  sanitizeString,
  sanitizeStringArray,
  validateBodySize,
} from '../sanitize';

// ─── RSS-to-Nostr bridge ─────────────────────────────────────────────
//
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MIGRATION NOTICE (2026-07)                                         ║
// ║                                                                    ║
// ║  Server-side nsec signing is DEPRECATED. The `nsec` field is no    ║
// ║  longer accepted. Requests with `nsec` get HTTP 410 Gone.          ║
// ║                                                                    ║
// ║  MIGRATION PATH:                                                    ║
// ║  1. Client generates & signs events locally using nostr-tools or     ║
// ║     @degenfeed/nostr-sdk:                                           ║
// ║       import { signEvent, createTextNote } from 'nostr-tools';      ║
// ║       const ev = createTextNote(text, privateKey, tags);             ║
// ║       signEvent(ev, privateKey);                                    ║
// ║       // ev is now a fully signed NostrEvent with id, pubkey, sig   ║
// ║  2. POST the signed event object to this endpoint:                   ║
// ║       POST /api/bridge/rss-to-nostr                                 ║
// ║       { "signedEvent": { "id": "...", "pubkey": "...", ... } }      ║
// ║  3. Server validates the structure and signature, then publishes    ║
// ║     to relays. No private key touches the wire.                     ║
// ║                                                                    ║
// ║  See: https://docs.degenfeed.xyz/bridge/nostr                      ║
// ║ ╚══════════════════════════════════════════════════════════════════════╝

const MAX_BRIDGE_PER_HOUR = 3;

/** Required fields on a NostrEvent for server-side validation. */
const NOSTR_EVENT_REQUIRED_FIELDS = [
  'id',
  'pubkey',
  'created_at',
  'kind',
  'tags',
  'content',
  'sig',
] as const;

export async function handleRssToNostrBridge(request: Request, env: Env): Promise<Response> {
  try {
    // ── Rate limit: 3 requests per hour per IP ────────────────────────
    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';
    const rl = await rateLimit(env, ip, 'bridge:rss-to-nostr', MAX_BRIDGE_PER_HOUR, 3_600_000);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfterMs: rl.retryAfter }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
          },
        },
      );
    }

    // ── Body size limit ───────────────────────────────────────────────
    const bodySizeCheck = validateBodySize(request, 10 * 1024);
    if (!bodySizeCheck.ok) {
      return jsonResponse({ error: bodySizeCheck.error }, 413);
    }

    const body = (await request.json()) as Record<string, unknown>;

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  DEPRECATED: server-side nsec signing                          ║
    // ║  Returning 410 Gone to signal permanent removal with a clear    ║
    // ║  migration path.                                               ║
    // ╚══════════════════════════════════════════════════════════════════╝
    if (body.nsec) {
      log('warn', 'RSS-to-Nostr bridge received deprecated nsec — rejecting', {
        ip: `${ip.slice(0, 8)}...`,
      });
      return new Response(
        JSON.stringify({
          error: 'server_side_signing_deprecated',
          message:
            'Server-side nsec signing has been deprecated for security. Please sign events client-side using nostr-tools or your preferred Nostr SDK and POST the signed event instead.',
          docs: 'https://docs.degenfeed.xyz/bridge/nostr',
        }),
        {
          status: 410,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    // ── Accept pre-signed Nostr event (no nsec required) ──────────────
    if (body.signedEvent) {
      const signedEvent = body.signedEvent as Record<string, unknown>;

      // Validate required fields exist
      for (const field of NOSTR_EVENT_REQUIRED_FIELDS) {
        if (!(field in signedEvent)) {
          return jsonResponse({ error: `Missing required field: ${field}` }, 400);
        }
      }

      // Validate field types
      if (
        typeof signedEvent.id !== 'string' ||
        typeof signedEvent.pubkey !== 'string' ||
        typeof signedEvent.created_at !== 'number' ||
        typeof signedEvent.kind !== 'number' ||
        !Array.isArray(signedEvent.tags) ||
        typeof signedEvent.content !== 'string' ||
        typeof signedEvent.sig !== 'string'
      ) {
        return jsonResponse({ error: 'Invalid event field types' }, 400);
      }

      // Verify the cryptographic signature
      const event = signedEvent as unknown as NostrEvent;
      if (!verifyEvent(event)) {
        return jsonResponse({ error: 'Invalid event signature' }, 400);
      }

      // Publish to relays
      const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
        eoseTimeout: 3000,
      });
      await pool.publish(event);
      pool.disconnectAll();

      return jsonResponse({ ok: true, eventId: event.id });
    }

    // ── Neither nsec nor signedEvent provided ─────────────────────────
    return jsonResponse(
      { error: 'Provide signedEvent (a pre-signed Nostr event object) for publishing.' },
      400,
    );
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handlePublish(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);
  try {
    interface PublishRequest {
      text?: string;
      targets?: string[];
      auth?: Record<string, string>;
      signedMessage?: string;
      typedDataId?: string;
      signature?: string;
      lensCollect?: boolean;
    }
    const body: PublishRequest = (await request.json()) as PublishRequest;
    const text = sanitizeString(body.text, 10000);
    const targets = sanitizeStringArray(body.targets, 64).filter(isAllowedProtocol);
    const _lensCollect = body.lensCollect ?? false;

    if (!text || hasSuspiciousPayload(text)) {
      return jsonResponse({ error: 'Invalid text' }, 400);
    }
    if (targets.length === 0) {
      return jsonResponse({ error: 'Invalid targets' }, 400);
    }
    const auth = body.auth ?? ({} as Record<string, string>);

    const results: Record<string, { ok: boolean; error?: string; hash?: string }> = {};

    for (const target of targets) {
      try {
        switch (target) {
          case 'nostr': {
            const skHex: string = auth.nostr ?? '';
            const sk: string = skHex || generateSecretKey();
            const pk = getPublicKey(sk);
            const ev = createTextNote(text, sk, []);
            ev.pubkey = pk;
            ev.id = getEventHash(ev);
            signEvent(ev, sk);
            const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
              eoseTimeout: 2000,
            });
            await pool.publish(ev);
            pool.disconnectAll();
            results[target] = { ok: true };
            break;
          }

          case 'farcaster': {
            // Farcaster Hub submitMessage via REST API
            // Accepts a pre-signed Message protobuf from the client
            // Client flow: @farcaster/hub-web makeCastAdd → sign → send hex
            const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
            const signedMessage = body.signedMessage || body.auth?.farcaster_message;
            if (signedMessage) {
              // Submit pre-signed message to Hub
              const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
                method: 'PUT',
                headers: { 'content-type': 'application/octet-stream' },
                body: signedMessage,
              });
              if (submitRes.ok) {
                const submitData = (await submitRes.json()) as Record<string, unknown>;
                results[target] = { ok: true, hash: String(submitData.hash || '') || undefined };
              } else {
                const errText = await submitRes.text();
                results[target] = {
                  ok: false,
                  error: `Farcaster Hub rejected: ${errText.slice(0, 100)}`,
                };
              }
            } else {
              // No pre-signed message — return stub asking client to sign
              results[target] = {
                ok: false,
                error:
                  'Client must sign cast using @farcaster/hub-web, then submit signedMessage in publish request.',
              };
            }
            break;
          }

          case 'lens': {
            // Lens API v2 broadcast — accepts a pre-signed typed data from the client
            // Client flow: lens.createPostTypedData → wallet.signTypedData → send signature
            const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
            const typedDataId = body.typedDataId || body.auth?.lens_typedDataId;
            const signature = body.signature || body.auth?.lens_signature;
            if (typedDataId && signature) {
              const broadcastRes = await fetch(lensApi, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  query:
                    'mutation Broadcast($request: BroadcastRequest!) { broadcast(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } } }',
                  variables: { request: { id: typedDataId, signature } },
                }),
              });
              if (broadcastRes.ok) {
                const broadcastData = (await broadcastRes.json()) as Record<string, unknown>;
                const result = (broadcastData.data as Record<string, unknown>)?.broadcast as
                  | Record<string, unknown>
                  | undefined;
                results[target] = {
                  ok: !!result?.txHash,
                  hash: result?.txHash as string | undefined,
                  error: result?.reason as string | undefined,
                };
              } else {
                const errText = await broadcastRes.text();
                results[target] = {
                  ok: false,
                  error: `Lens broadcast failed: ${errText.slice(0, 100)}`,
                };
              }
            } else {
              results[target] = {
                ok: false,
                error:
                  'Client must sign typed data using wallet, then submit typedDataId + signature in publish request.',
              };
            }
            break;
          }

          case 'bluesky': {
            const pdsUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
            const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
            if (!accessJwt) {
              results[target] = { ok: false, error: 'Not signed into bluesky' };
              break;
            }
            const repoDid = auth.bluesky_did || '';
            const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
              body: JSON.stringify({
                repo: repoDid,
                collection: 'app.bsky.feed.post',
                record: { text: text, createdAt: new Date().toISOString() },
              }),
            });
            if (recordRes.ok) {
              results[target] = { ok: true };
            } else {
              const errText = await recordRes.text();
              results[target] = {
                ok: false,
                error: `bluesky publish failed: ${errText.slice(0, 100)}`,
              };
            }
            break;
          }

          case 'threads': {
            const accessToken = auth.threads_accessToken || auth.threads;
            const userId = auth.threads_userId || auth.threads_did;
            if (!accessToken || !userId) {
              results[target] = { ok: false, error: 'Not signed into Threads' };
              break;
            }
            try {
              const { ThreadsClient } = await import('@degenfeed/threads-sdk');
              const client = new ThreadsClient(accessToken, userId);
              const creationId = await client.createThread(text);
              await client.publishThread(creationId);
              results[target] = { ok: true, hash: creationId };
            } catch (e) {
              results[target] = {
                ok: false,
                error: `threads publish failed: ${(e as Error).message.slice(0, 100)}`,
              };
            }
            break;
          }

          case 'mastodon': {
            const { GtSClient } = await import('@degenfeed/mastodon-sdk');
            const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
            const accessToken = auth.mastodon;
            if (!accessToken) {
              results[target] = { ok: false, error: 'Not signed into Mastodon' };
              break;
            }
            const client = new GtSClient(instance, accessToken);
            await client.publish(text, { visibility: 'public' });
            results[target] = { ok: true };
            break;
          }

          default:
            results[target] = { ok: false, error: `${target} not supported` };
        }
      } catch (e) {
        results[target] = { ok: false, error: String(e) };
      }
    }
    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
