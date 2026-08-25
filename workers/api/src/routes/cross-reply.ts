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
 * Bridge directions (source → target):
 *   Mastodon→Nostr   — reply on Mastodon to a Nostr post
 *   Nostr→Farcaster  — reply on Nostr to a Farcaster post, echos to Farcaster
 *   Nostr→Mastodon   — reply on Nostr to a Mastodon post, echos to Mastodon
 *   Farcaster→Mastodon — reply on Farcaster to a Mastodon post, echos to Mastodon
 *
 * Flow:
 *   1. Resolve the parent post's protocol-specific ID from the df:// URI
 *   2. Get the user's identity on the reply protocol
 *   3. Format the reply with cross-protocol attribution
 *   4. Post through the appropriate protocol SDK
 *   5. Echo the reply back to the parent's protocol (when the bridge
 *      has the signing capability — currently Mastodon echo via GtSClient)
 *   6. Store bridge records in KV for the status aggregator
 *   7. Return success with the new post URI
 */

import { kvGetJson } from '../lib/kv-json';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';
import type { Env } from '../types';

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

// ─── Protocol content limits ──────────────────────────────────────────
// When bridging across protocols, the reply content must be truncated
// to the target protocol's maximum post length.
const PROTOCOL_MAX_LENGTH: Record<string, number> = {
  farcaster: 320,
  mastodon: 500,
  bluesky: 300,
  threads: 500,
  nostr: 10000,
  lens: 10000,
  lemmy: 10000,
  reddit: 40000,
  peertube: 10000,
};

const BRIDGE_FOOTER = '\n\n_↻ Replied via DegenFeed cross-protocol bridge';

function buildCrossReplyFooter(parentProtocol: string, replyProtocol: string): string {
  return `${BRIDGE_FOOTER} (${parentProtocol} → ${replyProtocol})_`;
}

/**
 * Format reply content for a specific bridge direction.
 * Applies the cross-protocol attribution footer, then truncates
 * to the target protocol's maximum post length.
 * The footer is always preserved even when truncation is needed.
 */
function formatDirectionContent(
  content: string,
  replyProtocol: string,
  parentProtocol: string,
): string {
  const footer = buildCrossReplyFooter(parentProtocol, replyProtocol);
  const maxLen = PROTOCOL_MAX_LENGTH[replyProtocol] ?? 10000;
  // Always reserve space for the footer
  const bodyLimit = maxLen - footer.length - 1;
  const body = bodyLimit > 0 ? content.slice(0, bodyLimit) : content.slice(0, maxLen - 1);
  return `${body}${footer}`.slice(0, maxLen);
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
    reddit: 'Reddit',
    peertube: 'PeerTube',
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
    return methodNotAllowed(['GET']);
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
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({ prefix, cursor, limit: 1000 });
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
    return methodNotAllowed(['POST']);
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
    const identityRaw = (await kvGetJson(env.CACHE, `identity:${walletAddress}`)) as
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
  //    Use direction-aware formatting that respects protocol character limits
  const replyContent = formatDirectionContent(content, replyProtocol, parentProtocol);
  const direction = `${parentProtocol}→${replyProtocol}`;

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
  let echoRecord: BridgeEchoEntry | undefined;

  if (result.ok) {
    const uniqueId = result.nativeId
      ? result.nativeId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64) || crypto.randomUUID()
      : crypto.randomUUID();
    const bridgeKey = `bridge:reply:${parentPostUri}:${replyProtocol}:${uniqueId}`;
    const bridgeEntry: BridgeEntry = {
      parentPostUri,
      parentProtocol,
      replyProtocol,
      direction,
      replyId: result.nativeId ?? '',
      content: content.slice(0, 200),
      timestamp: Date.now(),
      walletAddress,
    };
    try {
      await env.CACHE?.put(bridgeKey, JSON.stringify(bridgeEntry), {
        expirationTtl: 86400 * 30,
      });
    } catch (e) {
      // Non-critical for the reply itself, but do not fail silently —
      // the bridge status indicator depends on these records.
      console.error(`[cross-reply] Failed to store bridge record ${bridgeKey}:`, e);
    }

    // ── 5a. Echo the reply back to the parent protocol ──────────────
    //     When the bridge has server-side signing capability for the
    //     parent protocol, publish a copy there so the original author
    //     sees the reply on their own protocol.
    //
    //     Currently supported echoes:
    //       * →Mastodon (via GtSClient with auth from identity KV)
    //       * →Nostr    (via nsec from identity KV — experimental)
    //     Farcaster echo requires client-side signing, so it remains
    //     a client responsibility (two API calls).
    echoRecord = await echoReplyToParentProtocol(
      env,
      replyContent,
      parentProtocol,
      parentId,
      walletAddress,
      parentPostUri,
      replyProtocol,
    );

    // Store an additional KV record for the echo so the thread view
    // can find replies on the parent's protocol too.
    if (echoRecord?.ok && echoRecord.nativeId) {
      const echoKey = `bridge:reply:${parentPostUri}:${parentProtocol}:echo:${echoRecord.nativeId.slice(0, 16)}`;
      try {
        await env.CACHE?.put(
          echoKey,
          JSON.stringify({
            parentPostUri,
            parentProtocol,
            replyProtocol,
            direction: `${replyProtocol}→${parentProtocol}`,
            replyId: echoRecord.nativeId,
            content: content.slice(0, 200),
            timestamp: Date.now(),
            walletAddress,
          }),
          { expirationTtl: 86400 * 30 },
        );
      } catch (e) {
        console.error(`[cross-reply] Failed to store echo record ${echoKey}:`, e);
      }
    }

    // Maintain the cross-protocol thread index so nested replies
    // (replies to bridge replies) stay attached to the root thread.
    if (result.nativeId) {
      const { recordThreadRelationship } = await import('./thread');
      await recordThreadRelationship(
        env,
        parentPostUri,
        `df://${replyProtocol}:${result.nativeId}`,
        replyProtocol,
      );
    }
  }

  // 6. Return success with direction metadata
  return noCacheJsonResponse({
    ok: result.ok,
    nativeId: result.nativeId,
    uri: result.nativeId ? `df://${replyProtocol}:${result.nativeId}` : undefined,
    parentPostUri,
    parentProtocol,
    replyProtocol,
    direction,
    bridged: true,
    echo: echoRecord?.ok ? { protocol: parentProtocol, nativeId: echoRecord.nativeId } : undefined,
    error: result.error,
  });
}

// ─── Bridge record types ──────────────────────────────────────────

/** Record stored under `bridge:reply:{uri}:{protocol}:{uniqueId}`. */
interface BridgeEntry {
  parentPostUri: string;
  parentProtocol: string;
  replyProtocol: string;
  direction: string;
  replyId: string;
  content: string;
  timestamp: number;
  walletAddress: string;
}

/** Result of an echo attempt. */
interface BridgeEchoEntry {
  ok: boolean;
  nativeId?: string;
  error?: string;
}

// ─── Echo to parent protocol ──────────────────────────────────────
//
// After a successful cross-protocol reply, the bridge echoes the
// reply back to the parent protocol so the original author sees it
// on their own protocol. This is only possible when the bridge has
// server-side signing capability for that protocol:
//
//   →Mastodon: Server has GtSClient + user's auth token from KV
//   →Nostr:    Server can sign with nsec from KV (experimental)
//   →Farcaster: Requires client-side signing — NOT supported server-side
//
async function echoReplyToParentProtocol(
  env: Env,
  replyContent: string,
  parentProtocol: string,
  parentId: string,
  walletAddress: string,
  _parentPostUri: string,
  replyProtocol: string,
): Promise<BridgeEchoEntry | undefined> {
  switch (parentProtocol) {
    case 'mastodon': {
      // Look up the user's Mastodon identity from the bridge KV
      try {
        const identityRaw = (await kvGetJson(env.CACHE, `identity:${walletAddress}`)) as
          | Record<
              string,
              {
                id: string;
                auth?: Record<string, string>;
                keys?: Record<string, string>;
              }
            >
          | null
          | undefined;
        const mastodonIdent = identityRaw?.mastodon;
        const accessToken =
          mastodonIdent?.auth?.mastodon ??
          mastodonIdent?.auth?.accessToken ??
          mastodonIdent?.keys?.accessToken ??
          mastodonIdent?.keys?.mastodon_token;
        if (!accessToken) {
          console.debug(
            '[cross-reply] echo→mastodon: no auth token for',
            walletAddress.slice(0, 8),
          );
          return undefined;
        }
        const instance =
          mastodonIdent?.auth?.mastodon_instance ??
          mastodonIdent?.keys?.instanceUrl ??
          env.GOTOSOCIAL_INSTANCE_URL ??
          'https://social.degenfeed.xyz';
        const { GtSClient } = await import('@degenfeed/mastodon-sdk');
        const client = new GtSClient(instance, accessToken);
        const echoText = formatDirectionContent(
          // Use truncated original content for the echo
          replyContent.replace(/^(.{150})(.*)/s, '$1…'),
          'mastodon',
          replyProtocol,
        );
        const result = await client.publish(echoText, { visibility: 'public' });
        return {
          ok: true,
          nativeId: (result as { id?: string })?.id ?? '',
        };
      } catch (e) {
        console.error(`[cross-reply] echo→mastodon failed:`, e);
        return { ok: false, error: String(e) };
      }
    }

    case 'nostr': {
      // Experimental: echo to Nostr using user's nsec from KV
      try {
        const identityRaw = (await kvGetJson(env.CACHE, `identity:${walletAddress}`)) as
          | Record<
              string,
              {
                id: string;
                keys?: Record<string, string>;
                auth?: Record<string, string>;
              }
            >
          | null
          | undefined;
        const nostrIdent = identityRaw?.nostr;
        const nsec = nostrIdent?.keys?.nsec ?? nostrIdent?.auth?.nsec;
        if (!nsec) {
          console.debug('[cross-reply] echo→nostr: no nsec for', walletAddress.slice(0, 8));
          return undefined;
        }
        const nostr = await import('@degenfeed/nostr-sdk');
        const echoTags: string[][] = [
          ['t', `cross-protocol:${replyProtocol}`],
          ['t', 'degenfeed-bridge-echo'],
          ['r', `df://${replyProtocol}:${parentId}`],
        ];
        if (/^[0-9a-f]{64}$/i.test(parentId)) {
          echoTags.push(['e', parentId, '', 'reply']);
        }
        const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
          eoseTimeout: 4000,
        });
        const ev = nostr.createTextNote(replyContent, nsec, echoTags);
        await pool.publish(ev);
        pool.disconnectAll();
        return { ok: true, nativeId: ev.id };
      } catch (e) {
        console.error(`[cross-reply] echo→nostr failed:`, e);
        return { ok: false, error: String(e) };
      }
    }

    default:
      // No server-side echo capability for this protocol.
      // Farcaster echo requires a pre-signed cast from the client.
      return undefined;
  }
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
              return {
                ok: false,
                error: 'Pre-signed Nostr event is missing id/sig/pubkey',
              };
            }
            const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
              eoseTimeout: 4000,
            });
            await pool.publish(signedEvent);
            pool.disconnectAll();
            return { ok: true, nativeId: signedEvent.id };
          } catch (e) {
            console.error('[cross-reply] Nostr pre-signed publish failed:', e);
            return {
              ok: false,
              error: 'Failed to publish pre-signed Nostr event',
            };
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
        // Direction-aware cross-protocol tags:
        //   - e-tag only when parent is a real Nostr event (64-char hex)
        //   - t-tags carry the direction context for bridge bots
        //   - r-tag references the original post via df:// URI
        const direction = `${parentProtocol}→nostr`;
        const tags: string[][] = [];
        if (/^[0-9a-f]{64}$/i.test(parentId)) {
          tags.push(['e', parentId, '', 'reply']);
        }
        // Add cross-protocol context tags with direction awareness
        tags.push(['t', `cross-protocol:${parentProtocol}`]);
        tags.push(['t', `direction:${direction}`]);
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
          auth.mastodon_instance || env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
        const accessToken = auth.mastodon || auth.accessJwt || body.auth?.mastodon;
        if (!accessToken) {
          return { ok: false, error: 'Not signed into Mastodon' };
        }
        const client = new GtSClient(instance, accessToken);
        // Direction-aware Mastodon posting:
        //   - text already includes the bridge footer from formatDirectionContent()
        //   - For Mastodon→Nostr direction (parentProtocol !== 'mastodon'):
        //     post as standalone status with df:// link (parent doesn't exist on this instance)
        //   - For Nostr→Mastodon / Farcaster→Mastodon echoes:
        //     parent IS on Mastodon, so use in_reply_to_id when parentId is numeric
        const isMastodonParent = parentProtocol === 'mastodon';
        const parentNumericId = isMastodonParent && /^\d+$/.test(parentId) ? parentId : undefined;

        let statusText: string;
        const publishOpts: {
          inReplyToId?: string;
          visibility?: 'public' | 'unlisted' | 'private' | 'direct';
        } = { visibility: 'public' };

        if (parentNumericId) {
          // Parent is on the same Mastodon instance — thread the reply properly
          statusText = text;
          publishOpts.inReplyToId = parentNumericId;
        } else if (parentProtocol === 'farcaster') {
          // Farcaster→Mastodon: add explicit Farcaster reference
          statusText = `${text}`;
        } else if (parentProtocol === 'nostr') {
          // Nostr→Mastodon: note the Nostr origin
          statusText = `${text}`;
        } else {
          // Generic cross-protocol: append df:// link for reference
          statusText = `${text}\n\n🔗 df://${parentProtocol}:${parentId}`;
        }

        const result = await client.publish(statusText, publishOpts);
        return {
          ok: true,
          nativeId: (result as { id?: string })?.id ?? '',
        };
      }

      case 'farcaster': {
        // Farcaster has a 320-character limit including the bridge footer.
        // The content has already been truncated by formatDirectionContent(),
        // but double-check for the pre-signed message case.
        if (text.length > 320) {
          return {
            ok: false,
            error:
              'Farcaster cast limited to 320 characters. Reduce your reply content and try again.',
          };
        }
        const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
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
        return {
          ok: false,
          error: `Farcaster Hub rejected: ${errText.slice(0, 100)}`,
        };
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
        return {
          ok: false,
          error: `Lens broadcast failed: ${errText.slice(0, 100)}`,
        };
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
          return {
            ok: false,
            error: 'Bluesky DID missing — pass auth.bluesky_did',
          };
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
        return {
          ok: false,
          error: `Bluesky publish failed: ${errText.slice(0, 100)}`,
        };
      }

      case 'lemmy': {
        const instance = auth.lemmy_instance || 'https://community.degenfeed.xyz';
        const token = auth.lemmy || auth.authToken;
        if (!token) {
          return { ok: false, error: 'Not signed into Lemmy' };
        }
        // Post a top-level comment that links back to the original
        const commentText = `${text}\n\n\xf0\x9f\x94\x97 df://${parentProtocol}:${parentId}`;
        const res = await fetch(`${instance}/api/v3/comment`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            post_id: Number(parentId) || 0,
            content: commentText,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            comment_view?: { comment?: { id: number } };
          };
          const nativeId = data.comment_view?.comment?.id
            ? String(data.comment_view.comment.id)
            : '';
          return { ok: true, nativeId };
        }
        const errText = await res.text();
        return {
          ok: false,
          error: `Lemmy publish failed: ${errText.slice(0, 100)}`,
        };
      }

      case 'threads': {
        const accessToken = auth.threads_accessToken || auth.threads_jwt || auth.accessJwt;
        if (!accessToken) {
          return { ok: false, error: 'Not signed into Threads' };
        }
        const threadsUserId = auth.threads_userId || auth.threads_did || '';
        if (!threadsUserId) {
          return {
            ok: false,
            error: 'Threads user ID missing — pass auth.threads_userId',
          };
        }
        // Post a standalone thread that links back to the original
        const threadText = `${text}\n\n${buildCrossReplyFooter(parentProtocol, protocol)}`;
        const threadsRes = await fetch(
          `https://graph.threads.net/v1.0/${threadsUserId}/threads?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: threadText,
              media_type: 'TEXT',
            }),
          },
        );
        if (threadsRes.ok) {
          const data = (await threadsRes.json()) as { id?: string };
          return { ok: true, nativeId: data.id ?? '' };
        }
        const errText = await threadsRes.text();
        return {
          ok: false,
          error: `Threads publish failed: ${errText.slice(0, 100)}`,
        };
      }

      default:
        return {
          ok: false,
          error: `Cross-reply to ${protocol} not yet supported`,
        };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
