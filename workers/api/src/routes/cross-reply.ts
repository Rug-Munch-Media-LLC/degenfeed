/**
 * /api/cross-reply — Cross-protocol reply bridge.
 *
 * Reply to a post on ANY protocol from ANY other protocol.
 * This is the key differentiator: reply to a Lens post from Nostr,
 * reply to a Farcaster cast from Mastodon, etc.
 *
 * POST /api/cross-reply
 * Body: { parentPostUri, parentProtocol, replyProtocol, content, walletAddress }
 *
 * Flow:
 *   1. Resolve the parent post's protocol-specific ID from the df:// URI
 *   2. Get the user's identity on the reply protocol
 *   3. Format the reply with cross-protocol attribution
 *   4. Post through the appropriate protocol SDK
 *   5. Return success with the new post URI
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';

interface CrossReplyRequest {
  parentPostUri: string;
  parentProtocol: string;
  replyProtocol: string;
  content: string;
  walletAddress: string;
  /** Per-protocol auth tokens for the target protocol */
  auth?: Record<string, string>;
  /** Pre-signed events for protocols that require client-side signing */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

const BRIDGE_FOOTER = '\n\n_↻ Replied via DegenFeed cross-protocol bridge';

function buildCrossReplyFooter(parentProtocol: string, replyProtocol: string): string {
  return `${BRIDGE_FOOTER} (${parentProtocol} → ${replyProtocol})_`;
}

function formatProtocolLabel(p: string): string {
  const labels: Record<string, string> = {
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    bluesky: 'Bluesky',
    threads: 'Threads',
    mastodon: 'Mastodon',
    lemmy: 'Lemmy',
    rss: 'RSS',
  };
  return labels[p] ?? p;
}

/**
 * GET /api/cross-reply/status?parentPostUri=df://...
 *
 * Aggregates bridge reply records stored under `bridge:reply:{uri}:*`
 * and returns per-protocol reply counts for the bridge status indicator.
 */
export async function handleCrossReplyStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }
  const url = new URL(request.url);
  const parentPostUri = sanitizeString(url.searchParams.get('parentPostUri'), 1024);
  if (!parentPostUri) {
    return jsonResponse({ error: 'Missing parentPostUri query parameter' }, 400);
  }
  if (!env.CACHE) {
    return noCacheJsonResponse({ parentPostUri, total: 0, byProtocol: {} });
  }

  const prefix = `bridge:reply:${parentPostUri}:`;
  const byProtocol: Record<string, number> = {};
  let total = 0;
  try {
    let cursor: string | undefined;
    do {
      const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } = await env.CACHE.list({ prefix, cursor, limit: 1000 });
      for (const key of page.keys) {
        // Key formats:
        //   legacy: bridge:reply:{uri}:{protocol}
        //   current: bridge:reply:{uri}:{protocol}:{uniqueId}
        const rest: string = key.name.slice(prefix.length);
        const protocol: string = rest.split(':')[0]!;
        if (!protocol || !ALLOWED_PROTOCOLS.has(protocol)) continue;
        byProtocol[protocol] = (byProtocol[protocol] ?? 0) + 1;
        total += 1;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error('[cross-reply] KV list failed for bridge status:', e);
    return jsonResponse({ error: 'Bridge status lookup failed' }, 500);
  }

  return noCacheJsonResponse({ parentPostUri, total, byProtocol });
}

export async function handleCrossReply(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed — use POST' }, 405);
  }

  let body: CrossReplyRequest;
  try {
    body = (await request.json()) as CrossReplyRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const parentPostUri = sanitizeString(body.parentPostUri, 1024);
  const parentProtocol = sanitizeString(body.parentProtocol, 32);
  const replyProtocol = sanitizeString(body.replyProtocol, 32);
  const content = sanitizeString(body.content, 10000);
  const walletAddress = sanitizeString(body.walletAddress, 128);

  if (!parentPostUri || !parentProtocol || !replyProtocol || !content || !walletAddress) {
    return jsonResponse(
      {
        error: 'Missing required fields',
        required: ['parentPostUri', 'parentProtocol', 'replyProtocol', 'content', 'walletAddress'],
      },
      400,
    );
  }

  if (hasSuspiciousPayload(content)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  if (!ALLOWED_PROTOCOLS.has(parentProtocol)) {
    return jsonResponse({ error: `Unsupported parent protocol: ${parentProtocol}` }, 400);
  }
  if (!ALLOWED_PROTOCOLS.has(replyProtocol)) {
    return jsonResponse({ error: `Unsupported reply protocol: ${replyProtocol}` }, 400);
  }

  if (parentProtocol === replyProtocol) {
    return jsonResponse(
      {
        error: 'Same-protocol replies should use the normal publish endpoint',
        hint: 'Use POST /api/publish with targets=[replyProtocol] for same-protocol replies',
      },
      400,
    );
  }

  // 1. Parse the parent post URI to extract the protocol-specific ID
  const parentId = extractNativeId(parentPostUri, parentProtocol);
  if (!parentId) {
    return jsonResponse(
      { error: `Cannot extract native ID from parent URI: ${parentPostUri}` },
      400,
    );
  }

  // 2. Get user's linked identity for the reply protocol
  let protocolIdentity: { id: string; auth?: Record<string, string> } | null = null;
  try {
    const identityRaw = (await env.CACHE?.get(`identity:${walletAddress}`, 'json')) as
      | Record<string, { id: string; auth?: Record<string, string> }>
      | null
      | undefined;
    protocolIdentity = identityRaw?.[replyProtocol] ?? null;
  } catch {
    /* KV miss — fall through */
  }

  // For protocols where auth is passed in the request body (Bluesky, Mastodon, Farcaster)
  const auth = body.auth ?? {};
  if (!protocolIdentity) {
    // Check if the user has auth tokens for this protocol in the request body
    const hasAuth =
      auth[replyProtocol] ||
      auth[`${replyProtocol}_jwt`] ||
      auth[`${replyProtocol}_accessJwt`] ||
      auth.accessJwt;
    if (!hasAuth) {
      return jsonResponse(
        {
          error: `No ${formatProtocolLabel(replyProtocol)} identity linked`,
          hint: `Sign in with ${formatProtocolLabel(replyProtocol)} in Settings → Identities`,
        },
        400,
      );
    }
  }

  // 3. Format the reply with cross-protocol attribution footer
  const replyContent = `${content}${buildCrossReplyFooter(parentProtocol, replyProtocol)}`;

  // 4. Post through the target protocol's SDK
  const result = await publishCrossReply(
    env,
    replyProtocol,
    replyContent,
    parentId,
    parentProtocol,
    body,
    auth,
  );

  // 5. Store the bridge link in KV for the reply-count aggregator.
  //    Key includes a unique suffix so multiple replies from the same
  //    protocol don't overwrite each other (legacy keys had no suffix).
  if (result.ok) {
    const uniqueId = result.nativeId
      ? result.nativeId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || crypto.randomUUID()
      : crypto.randomUUID();
    const bridgeKey = `bridge:reply:${parentPostUri}:${replyProtocol}:${uniqueId}`;
    const bridgeEntry = {
      parentPostUri,
      parentProtocol,
      replyProtocol,
      replyId: result.nativeId ?? '',
      content: content.slice(0, 200),
      timestamp: Date.now(),
      walletAddress,
    };
    try {
      await env.CACHE?.put(bridgeKey, JSON.stringify(bridgeEntry), { expirationTtl: 86400 * 30 });
    } catch (e) {
      // Non-critical for the reply itself, but do not fail silently —
      // the bridge status indicator depends on these records.
      console.error(`[cross-reply] Failed to store bridge record ${bridgeKey}:`, e);
    }
  }

  // 6. Return success
  return noCacheJsonResponse({
    ok: result.ok,
    nativeId: result.nativeId,
    uri: result.nativeId ? `df://${replyProtocol}:${result.nativeId}` : undefined,
    parentPostUri,
    parentProtocol,
    replyProtocol,
    bridged: true,
    error: result.error,
  });
}

function extractNativeId(uri: string, _protocol: string): string | null {
  // df:// URIs: df://protocol:nativeId
  if (uri.startsWith('df://')) {
    const rest = uri.slice(5);
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) return rest;
    return rest.slice(colonIdx + 1);
  }
  // Raw protocol:id format
  const colonIdx = uri.indexOf(':');
  if (colonIdx === -1) return uri;
  return uri.slice(colonIdx + 1);
}

async function publishCrossReply(
  env: Env,
  protocol: string,
  text: string,
  parentId: string,
  parentProtocol: string,
  body: CrossReplyRequest,
  auth: Record<string, string>,
): Promise<{ ok: boolean; nativeId?: string; error?: string }> {
  try {
    switch (protocol) {
      case 'nostr': {
        const nostr = await import('@degenfeed/nostr-sdk');
        // Use pre-signed event from client if available
        if (body.signedMessage) {
          try {
            const signedEvent = JSON.parse(body.signedMessage) as {
              id: string;
              pubkey: string;
              created_at: number;
              kind: number;
              tags: string[][];
              content: string;
              sig: string;
            };
            if (!signedEvent.id || !signedEvent.sig || !signedEvent.pubkey) {
              return { ok: false, error: 'Pre-signed Nostr event is missing id/sig/pubkey' };
            }
            const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
              eoseTimeout: 4000,
            });
            await pool.publish(signedEvent);
            pool.disconnectAll();
            return { ok: true, nativeId: signedEvent.id };
          } catch (e) {
            console.error('[cross-reply] Nostr pre-signed publish failed:', e);
            return { ok: false, error: 'Failed to publish pre-signed Nostr event' };
          }
        }
        // Fallback: server-side signing via nsec (may be deprecated)
        const nsec = auth.nostr || auth.nsec;
        if (!nsec) {
          return {
            ok: false,
            error:
              'Nostr requires pre-signed event or nsec. Sign client-side with @degenfeed/nostr-sdk.',
          };
        }
        const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
          eoseTimeout: 4000,
        });
        // Only e-tag the parent when it is a real Nostr event id (64-char hex);
        // for cross-protocol parents, reference via bridge tags instead.
        const tags: string[][] = [];
        if (/^[0-9a-f]{64}$/i.test(parentId)) {
          tags.push(['e', parentId, '', 'reply']);
        }
        // Add cross-protocol context tags
        tags.push(['t', `cross-protocol:${parentProtocol}`]);
        tags.push(['t', 'degenfeed-bridge']);
        tags.push(['r', `df://${parentProtocol}:${parentId}`]);

        // createTextNote returns a fully signed event (pubkey/id/sig included)
        const ev = nostr.createTextNote(text, nsec, tags);
        await pool.publish(ev);
        pool.disconnectAll();
        return { ok: true, nativeId: ev.id };
      }

      case 'mastodon': {
        const { GtSClient } = await import('@degenfeed/mastodon-sdk');
        const instance =
          auth.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
        const accessToken = auth.mastodon || auth.accessJwt || body.auth?.mastodon;
        if (!accessToken) {
          return { ok: false, error: 'Not signed into Mastodon' };
        }
        const client = new GtSClient(instance, accessToken);
        // Cross-protocol parents never exist on this Mastodon instance, so
        // in_reply_to_id would be rejected. Post a standalone status that
        // links back to the original via the df:// URI.
        const statusText = `${text}\n\n🔗 df://${parentProtocol}:${parentId}`;
        const result = await client.publish(statusText, {
          visibility: 'public',
        });
        return {
          ok: true,
          nativeId: (result as { id?: string })?.id ?? '',
        };
      }

      case 'farcaster': {
        const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
        const signedMessage = body.signedMessage || auth.farcaster_message;
        if (!signedMessage) {
          return {
            ok: false,
            error: 'Farcaster requires pre-signed cast message. Sign client-side.',
          };
        }
        // Clients send the signed Message protobuf as a hex string;
        // the Hub expects raw bytes.
        let messageBody: BodyInit = signedMessage;
        const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
          const bytes = new Uint8Array(hex.length / 2);
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
          messageBody = bytes;
        }
        const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
          method: 'PUT',
          headers: { 'content-type': 'application/octet-stream' },
          body: messageBody,
        });
        if (submitRes.ok) {
          const submitData = (await submitRes.json()) as Record<string, unknown>;
          return { ok: true, nativeId: String(submitData.hash || '') };
        }
        const errText = await submitRes.text();
        return { ok: false, error: `Farcaster Hub rejected: ${errText.slice(0, 100)}` };
      }

      case 'lens': {
        const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
        const typedDataId = body.typedDataId || auth.lens_typedDataId;
        const signature = body.signature || auth.lens_signature;
        if (!typedDataId || !signature) {
          return {
            ok: false,
            error: 'Lens requires typedDataId + signature. Sign client-side.',
          };
        }
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
          return {
            ok: !!result?.txHash,
            nativeId: result?.txHash as string | undefined,
            error: result?.reason as string | undefined,
          };
        }
        const errText = await broadcastRes.text();
        return { ok: false, error: `Lens broadcast failed: ${errText.slice(0, 100)}` };
      }

      case 'bluesky': {
        // Writes go to the PDS (bsky.social), NOT the read-only public AppView.
        const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
        const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
        if (!accessJwt) {
          return { ok: false, error: 'Not signed into Bluesky' };
        }
        const repoDid = auth.bluesky_did || '';
        if (!repoDid) {
          return { ok: false, error: 'Bluesky DID missing — pass auth.bluesky_did' };
        }
        // Cross-protocol parents are never valid at:// refs, so the lexicon
        // would reject a `reply` block. Post a standalone skeet that links
        // back to the original via the df:// URI (the bridge footer carries
        // the attribution).
        const record = {
          $type: 'app.bsky.feed.post',
          text: `${text}\n\n🔗 df://${parentProtocol}:${parentId}`,
          createdAt: new Date().toISOString(),
        };
        const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessJwt}`,
          },
          body: JSON.stringify({
            repo: repoDid,
            collection: 'app.bsky.feed.post',
            record,
          }),
        });
        if (recordRes.ok) {
          const data = (await recordRes.json()) as { uri?: string };
          return { ok: true, nativeId: data.uri ?? '' };
        }
        const errText = await recordRes.text();
        return { ok: false, error: `Bluesky publish failed: ${errText.slice(0, 100)}` };
      }

      default:
        return { ok: false, error: `Cross-reply to ${protocol} not yet supported` };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
