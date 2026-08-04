/**
 * @degenfeed/api-worker — Unified Interaction Handler
 *
 * One endpoint for interacting with posts from ANY protocol:
 *
 *   POST /api/interaction
 *   Body: {
 *     action: 'tip' | 'reply' | 'like' | 'unlike' | 'boost' | 'unboost',
 *     protocol: 'nostr' | 'farcaster' | 'mastodon' | 'bluesky' | 'lens' | 'lemmy',
 *     postId: string,             // df:// URI or protocol-native id
 *     target: { authorId?, publicationId? },  // protocol author / publication refs
 *     content?: string,           // reply text or tip memo
 *     amountUsd?: number,         // tip amount in USD (tips only)
 *     currency?: string,          // tip currency: eth | sol | usdc | bonk | btc | ...
 *     auth?: Record<string, string>,      // per-protocol tokens (see PROTOCOL_AUTH)
 *     signedMessage?: string,     // pre-signed Nostr event JSON / Farcaster message hex
 *   }
 *
 * The handler:
 *   1. Validates + sanitizes the request
 *   2. Authenticates the user on the target protocol (client-signed events
 *      for Nostr/Farcaster, access tokens for Mastodon/Bluesky/Lens/Lemmy)
 *   3. Performs the action natively on the protocol
 *   4. Records a unified interaction ledger entry in KV
 *   5. Returns success/failure with the native reference
 *
 * Protocol → native action mapping:
 *   Nostr:     like → kind 7 reaction, boost → kind 6, reply → kind 1 (e/p tags)
 *   Farcaster: like → ReactionAdd, boost → CastAdd(embed), reply → CastAdd(parent)
 *   Mastodon:  like → favourite, boost → reblog, reply → status (in_reply_to_id)
 *   Bluesky:   like → app.bsky.feed.like, boost → app.bsky.feed.repost,
 *              reply → app.bsky.feed.post (reply block)
 *   Lens:      like → like, boost → mirror, reply → comment
 *   Lemmy:     like → post/like, reply → comment
 *   Tips on any protocol are recorded in the unified tip ledger
 *   (`recordUnifiedTip`) and, when credentials allow, announced natively.
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import {
  hasSuspiciousPayload,
  isAllowedProtocol,
  sanitizeString,
  validateBodySize,
} from '../sanitize';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip-core';

// ─── Types ────────────────────────────────────────────────────────────────

export type InteractionAction = 'tip' | 'reply' | 'like' | 'unlike' | 'boost' | 'unboost';

export interface NativeReference {
  protocol: string;
  action: InteractionAction;
  /** Protocol-native id — event id, status id, at:// uri, tx hash, etc. */
  nativeId: string;
  /** Canonical URL on the native protocol, when known */
  url?: string;
}

export interface UnifiedInteractionResult {
  ok: boolean;
  nativeReference?: NativeReference;
  /** Unified tip ledger activity id (tips only) */
  activityId?: string;
  error?: string;
}

interface InteractionRequest {
  action?: string;
  protocol?: string;
  postId?: string;
  postUri?: string;
  target?: { authorId?: string; publicationId?: string };
  content?: string;
  amountUsd?: number;
  currency?: string;
  auth?: Record<string, string>;
  signedMessage?: string;
  walletAddress?: string;
}

const ALLOWED_ACTIONS = new Set<InteractionAction>([
  'tip',
  'reply',
  'like',
  'unlike',
  'boost',
  'unboost',
]);

/** Protocols with native interaction support through this handler. */
const INTERACTION_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'mastodon',
  'bluesky',
  'lens',
  'lemmy',
]);

// ─── Ledger keys ─────────────────────────────────────────────────────────

const interactionKey = (postUri: string, protocol: string, action: string, nativeId: string) =>
  `interaction:${postUri}:${protocol}:${action}:${nativeId.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64)}`;

const userInteractionKey = (wallet: string, protocol: string, action: string) =>
  `interaction:user:${wallet.toLowerCase()}:${protocol}:${action}`;

/** Record the "active" like/repost record uri so unlike/unboost can remove it. */
const activeRecordKey = (postUri: string, protocol: string, action: 'like' | 'boost') =>
  `interaction:${postUri}:${protocol}:${action}:active`;

// ─── Status aggregator ───────────────────────────────────────────────────

/**
 * GET /api/interaction/status?postUri=df://...&protocol=...
 *
 * Aggregates unified interaction ledger records stored under
 * `interaction:{postUri}:*` and returns per-protocol, per-action counts
 * for the engagement indicator UI.
 */
export async function handleInteractionStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const url = new URL(request.url);
  const postUri = sanitizeString(url.searchParams.get('postUri'), 1024);
  const protocolFilter = sanitizeString(url.searchParams.get('protocol'), 32);
  if (!postUri) {
    return jsonResponse({ error: 'Missing postUri query parameter' }, 400);
  }
  if (!env.CACHE) {
    return jsonResponse({ postUri, total: 0, byProtocol: {} });
  }

  const prefix = `interaction:${postUri}:`;
  const byProtocol: Record<string, { total: number; actions: Record<string, number> }> = {};
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
        // Key format: interaction:{postUri}:{protocol}:{action}:{nativeId}
        // Active-marker keys (`...:like:active`) are excluded from counts.
        const rest = key.name.slice(prefix.length);
        const parts = rest.split(':');
        const protocol = parts[0] ?? '';
        const action = parts[1] ?? '';
        const nativeId = parts[2] ?? '';
        if (!protocol || !action || !INTERACTION_PROTOCOLS.has(protocol)) continue;
        if (nativeId === 'active') continue;
        if (protocolFilter && protocolFilter !== protocol) continue;
        const bucket = byProtocol[protocol] ?? { total: 0, actions: {} };
        byProtocol[protocol] = bucket;
        bucket.total += 1;
        bucket.actions[action] = (bucket.actions[action] ?? 0) + 1;
        total += 1;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error('[unified-interaction] KV list failed:', e);
    return jsonResponse({ error: 'Interaction status lookup failed' }, 500);
  }

  return jsonResponse({ postUri, total, byProtocol });
}

// ─── Main handler ────────────────────────────────────────────────────────

export async function handleUnifiedInteraction(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const bodySizeCheck = validateBodySize(request, 64 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  let body: InteractionRequest;
  try {
    body = (await request.json()) as InteractionRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const action = sanitizeString(body.action, 16) as InteractionAction;
  const protocol = sanitizeString(body.protocol, 32);
  const postId = sanitizeString(body.postId ?? body.postUri, 512);
  const walletAddress = sanitizeString(body.walletAddress, 128);
  const content = sanitizeString(body.content, 10000);
  const currency = sanitizeString(body.currency, 16);
  const signedMessage = sanitizeString(body.signedMessage, 20000);
  const auth = body.auth ?? {};

  const target = {
    authorId: sanitizeString(body.target?.authorId, 256),
    publicationId: sanitizeString(body.target?.publicationId, 256),
  };

  // ── Validation ─────────────────────────────────────────────────────────
  if (!action || !protocol || !postId) {
    return jsonResponse({ error: 'action, protocol, and postId are required' }, 400);
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  }
  if (!isAllowedProtocol(protocol) || !INTERACTION_PROTOCOLS.has(protocol)) {
    return jsonResponse(
      {
        error: `Unsupported protocol: ${protocol} — supported: ${[...INTERACTION_PROTOCOLS].join(', ')}`,
      },
      400,
    );
  }
  if (hasSuspiciousPayload(`${action}${protocol}${postId}${content}`)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }
  if (action === 'reply' && !content) {
    return jsonResponse({ error: 'Reply requires content' }, 400);
  }
  if (action === 'tip') {
    const amount = Number(body.amountUsd);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
      return jsonResponse({ error: 'amountUsd must be between 0.01 and 10,000' }, 400);
    }
  }

  const postUri = postId.startsWith('df://')
    ? postId
    : postId.startsWith(`${protocol}:`)
      ? `df://${postId}`
      : `df://${protocol}:${postId}`;
  const nativeId = extractNativeId(postId, protocol);

  try {
    const result = await dispatchInteraction({
      env,
      action,
      protocol,
      postUri,
      nativeId,
      content,
      currency,
      amountUsd: action === 'tip' ? Math.round(Number(body.amountUsd) * 100) / 100 : undefined,
      target,
      auth,
      signedMessage,
      walletAddress,
    });

    return jsonResponse(result satisfies UnifiedInteractionResult, result.ok ? 200 : 502);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Interaction failed',
      } satisfies UnifiedInteractionResult,
      500,
    );
  }
}

// ─── Dispatch ────────────────────────────────────────────────────────────

interface DispatchParams {
  env: Env;
  action: InteractionAction;
  protocol: string;
  postUri: string;
  nativeId: string;
  content: string;
  currency: string;
  amountUsd?: number;
  target: { authorId: string; publicationId: string };
  auth: Record<string, string>;
  signedMessage: string;
  walletAddress: string;
}

async function dispatchInteraction(p: DispatchParams): Promise<UnifiedInteractionResult> {
  const { env, action, protocol, postUri, target, content } = p;

  let reference: NativeReference | undefined;

  switch (protocol) {
    case 'nostr':
      reference = await interactNostr(p);
      break;
    case 'farcaster':
      reference = await interactFarcaster(p);
      break;
    case 'mastodon':
      reference = await interactMastodon(p);
      break;
    case 'bluesky':
      reference = await interactBluesky(p);
      break;
    case 'lens':
      reference = await interactLens(p);
      break;
    case 'lemmy':
      reference = await interactLemmy(p);
      break;
    default:
      return { ok: false, error: `${protocol} interaction not supported` };
  }

  // Executors return undefined when the user is not authenticated on the
  // protocol or the native action could not be performed.
  if (!reference) {
    return {
      ok: false,
      error: `Could not perform ${action} on ${protocol} — are you signed in with ${protocol}?`,
    };
  }

  // Tips additionally record the unified tip ledger.
  let activityId: string | undefined;
  if (action === 'tip' && p.amountUsd !== undefined) {
    // TipPlatform omits 'nostr' — map it to the generic platform.
    const platform =
      protocol === 'nostr'
        ? 'degenfeed'
        : (protocol as 'farcaster' | 'lens' | 'mastodon' | 'bluesky' | 'lemmy');
    const activity = await recordUnifiedTip(env, {
      platform,
      entityId: postUri,
      entityType: 'post',
      amountUsd: p.amountUsd,
      fromUserId: p.walletAddress || undefined,
      toUserId: target.authorId || target.publicationId || undefined,
      fromLabel: p.walletAddress ? `${p.walletAddress.slice(0, 6)}…` : undefined,
      toLabel: target.authorId ? `${protocol}:${target.authorId.slice(0, 8)}` : undefined,
      entityLabel: `Interaction tip: ${protocol} post`,
      method: p.currency ? `interaction:${p.currency}` : `interaction:${protocol}`,
    });
    activityId = activity?.id;
  }

  // ── Record ledger entry ───────────────────────────────────────────────
  if (reference?.nativeId) {
    try {
      await env.CACHE?.put(
        interactionKey(postUri, protocol, action, reference.nativeId),
        JSON.stringify({
          action,
          protocol,
          postUri,
          actor: p.walletAddress || 'unknown',
          nativeId: reference.nativeId,
          url: reference.url,
          content: content.slice(0, 200),
          timestamp: Date.now(),
        }),
        { expirationTtl: 60 * 60 * 24 * 365 },
      );

      // Track the active like/repost record so unlike/unboost can find it.
      if (action === 'like' || action === 'boost') {
        await env.CACHE?.put(
          activeRecordKey(postUri, protocol, action),
          JSON.stringify({ nativeId: reference.nativeId, url: reference.url }),
          { expirationTtl: 60 * 60 * 24 * 365 },
        );
      }

      // Per-user recent interaction list (for status indicators).
      if (p.walletAddress) {
        const listKey = userInteractionKey(p.walletAddress, protocol, action);
        const raw = await env.CACHE?.get(listKey);
        let list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
        list = [postUri, ...list.filter((u) => u !== postUri)].slice(0, 50);
        await env.CACHE?.put(listKey, JSON.stringify(list), {
          expirationTtl: 60 * 60 * 24 * 30,
        });
      }
    } catch (e) {
      console.warn('[unified-interaction] ledger write failed:', String(e));
    }
  }

  return { ok: true, nativeReference: reference, activityId };
}

// ─── Native ID extraction ────────────────────────────────────────────────

function extractNativeId(postId: string, protocol: string): string {
  if (postId.startsWith('df://')) {
    const rest = postId.slice(5);
    const colonIdx = rest.indexOf(':');
    const value = colonIdx === -1 ? rest : rest.slice(colonIdx + 1);
    return value || rest;
  }
  const prefix = `${protocol}:`;
  if (postId.startsWith(prefix)) return postId.slice(prefix.length);
  return postId;
}

// ─── Protocol executors ──────────────────────────────────────────────────

/**
 * Nostr — like (kind 7), boost (kind 6), reply (kind 1).
 * Events must be pre-signed client-side (nsec never leaves the browser).
 * The server publishes the signed event to relays.
 */
async function interactNostr(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId, content, signedMessage, target } = p;

  if (action === 'tip') {
    // Tips: no native Nostr event required; the ledger records the tip.
    return { protocol: 'nostr', action, nativeId: `tip:${Date.now()}` };
  }

  const nostr = await import('@degenfeed/nostr-sdk');
  type NostrEvent = import('@degenfeed/nostr-sdk').NostrEvent;
  let event: NostrEvent | null = null;
  if (signedMessage) {
    try {
      const parsed = JSON.parse(signedMessage) as Partial<NostrEvent>;
      if (parsed.id && parsed.sig && parsed.pubkey) {
        event = parsed as NostrEvent;
      }
    } catch {
      return undefined; // invalid pre-signed event — will surface as ok:true without ref
    }
  } else if (env.NOSTR_NSEC || env.NOSTR_PRIVATE_KEY) {
    // Server-side fallback for the bridge bot account (no user secret).
    const nsec = env.NOSTR_NSEC ?? env.NOSTR_PRIVATE_KEY ?? '';
    const tags: string[][] = [];
    if (/^[0-9a-f]{64}$/i.test(nativeId)) {
      tags.push(['e', nativeId]);
    }
    if (/^[0-9a-f]{64}$/i.test(target.authorId)) {
      tags.push(['p', target.authorId]);
    }
    if (action === 'like') {
      event = nostr.createReaction('+', nativeId, target.authorId, nsec);
    } else if (action === 'boost') {
      const unsigned = {
        pubkey: nostr.getPublicKey(nsec),
        created_at: Math.floor(Date.now() / 1000),
        kind: 6,
        tags: [['e', nativeId], ...(target.authorId ? [['p', target.authorId]] : [])],
        content: '',
      };
      event = nostr.signEvent(unsigned, nsec);
    } else if (action === 'reply') {
      const unsigned = {
        pubkey: nostr.getPublicKey(nsec),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['e', nativeId, '', 'reply'], ...(target.authorId ? [['p', target.authorId]] : [])],
        content,
      };
      event = nostr.signEvent(unsigned, nsec);
    }
  }

  if (!event?.id) return undefined;

  const relays = (env.RELAY_URLS || env.NOSTR_RELAYS || 'wss://relay.damus.io,wss://nos.lol')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const pool = new nostr.RelayPool(relays, { eoseTimeout: 4000 });
  try {
    pool.publish(event);
  } finally {
    pool.disconnectAll();
  }
  return { protocol: 'nostr', action, nativeId: event.id };
}

/**
 * Farcaster — like (ReactionAdd), boost (CastAdd with embed), reply (CastAdd with parent).
 * The message must be pre-signed client-side; the server submits it to a Hub.
 */
async function interactFarcaster(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId } = p;

  if (action === 'tip') {
    return { protocol: 'farcaster', action, nativeId: `tip:${Date.now()}` };
  }

  const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
  const signedMessage = p.signedMessage || p.auth.farcaster_message;
  if (!signedMessage) return undefined;

  let messageBody: BodyInit = signedMessage;
  const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    messageBody = bytes;
  }

  const res = await fetch(`${hubUrl}/v1/submitMessage`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: messageBody,
  });
  if (!res.ok) return undefined;

  // The Hub echoes the accepted Message — extract the cast/reaction hash.
  let hubHash = '';
  try {
    const data = (await res.json()) as Record<string, unknown>;
    const msg = (data?.message ?? data) as Record<string, unknown>;
    hubHash = String(msg?.hash ?? data?.hash ?? '');
  } catch {
    /* ignore */
  }

  return { protocol: 'farcaster', action, nativeId: hubHash || nativeId };
}

/**
 * Mastodon / ActivityPub — like (favourite), boost (reblog), reply (status with
 * in_reply_to_id), tip (announce status + ledger).
 */
async function interactMastodon(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId, content } = p;
  const { GtSClient } = await import('@degenfeed/mastodon-sdk');
  const instance =
    p.auth.mastodon_instance ||
    env.GOTOSOCIAL_INSTANCE_URL ||
    env.AP_INSTANCE_URL ||
    'https://social.degenfeed.xyz';
  const token = p.auth.mastodon ?? p.auth.accessToken ?? env.MASTODON_ACCESS_TOKEN ?? '';
  if (!token) return undefined;

  const client = new GtSClient(instance, token);

  switch (action) {
    case 'like': {
      const status = await client.like(nativeId);
      return {
        protocol: 'mastodon',
        action,
        nativeId: String(status?.id ?? nativeId),
        url: status?.url,
      };
    }
    case 'unlike': {
      const status = await client.unlike(nativeId);
      return {
        protocol: 'mastodon',
        action,
        nativeId: String(status?.id ?? nativeId),
        url: status?.url,
      };
    }
    case 'boost': {
      const status = await client.repost(nativeId);
      return {
        protocol: 'mastodon',
        action,
        nativeId: String(status?.id ?? nativeId),
        url: status?.url,
      };
    }
    case 'unboost': {
      const status = await client.unrepost(nativeId);
      return {
        protocol: 'mastodon',
        action,
        nativeId: String(status?.id ?? nativeId),
        url: status?.url,
      };
    }
    case 'reply': {
      const status = await client.publish(content, { inReplyToId: nativeId });
      return { protocol: 'mastodon', action, nativeId: String(status?.id ?? ''), url: status?.url };
    }
    case 'tip': {
      // Announce the tip as a status (best-effort), then record ledger.
      try {
        await client.publish(
          `💸 ${p.walletAddress ? `${p.walletAddress.slice(0, 6)}…` : 'Someone'} sent a tip via DegenFeed`,
          { visibility: 'unlisted' },
        );
      } catch {
        /* non-fatal */
      }
      return { protocol: 'mastodon', action, nativeId: `tip:${Date.now()}` };
    }
    default:
      return undefined;
  }
}

/**
 * Bluesky / AT Protocol — like (app.bsky.feed.like), boost (app.bsky.feed.repost),
 * reply (app.bsky.feed.post with reply block), tip (record + post).
 * Records use client-generated TID rkeys so we can return the at:// URI.
 */
async function interactBluesky(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId, content, target } = p;
  const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
  const jwt =
    p.auth.bluesky ?? p.auth.accessJwt ?? p.auth.bluesky_jwt ?? env.BSKY_ACCESS_TOKEN ?? '';
  const did = p.auth.bluesky_did ?? env.BSKY_DID ?? target.authorId ?? '';
  if (!jwt || !did) return undefined;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${jwt}`,
  };

  const createRecord = async (
    collection: string,
    record: Record<string, unknown>,
  ): Promise<string> => {
    const rkey = genTid();
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo: did, collection, rkey, record }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bluesky ${collection} failed: ${errText.slice(0, 100)}`);
    }
    return `at://${did}/${collection}/${rkey}`;
  };

  const deleteActiveRecord = async (collection: string, kind: 'like' | 'boost'): Promise<void> => {
    // Prefer the record uri we stored when the interaction was created.
    const raw = await env.CACHE?.get(activeRecordKey(p.postUri, 'bluesky', kind));
    const active = raw ? (JSON.parse(raw) as { nativeId?: string }) : null;
    const recordUri = active?.nativeId?.startsWith('at://') ? active.nativeId : null;
    const rkey = recordUri ? (recordUri.split('/').pop() ?? '') : genTid();
    await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repo: did, collection, rkey }),
    });
  };

  switch (action) {
    case 'like': {
      if (!target.publicationId) return undefined; // need the cid of the subject
      const uri = await createRecord('app.bsky.feed.like', {
        subject: { uri: nativeId, cid: target.publicationId },
        createdAt: new Date().toISOString(),
      });
      return {
        protocol: 'bluesky',
        action,
        nativeId: uri,
        url: `https://bsky.app/profile/${did}/post/${nativeId.split('/').pop()}`,
      };
    }
    case 'unlike': {
      await deleteActiveRecord('app.bsky.feed.like', 'like');
      return { protocol: 'bluesky', action, nativeId };
    }
    case 'boost': {
      if (!target.publicationId) return undefined;
      const uri = await createRecord('app.bsky.feed.repost', {
        subject: { uri: nativeId, cid: target.publicationId },
        createdAt: new Date().toISOString(),
      });
      return { protocol: 'bluesky', action, nativeId: uri };
    }
    case 'unboost': {
      await deleteActiveRecord('app.bsky.feed.repost', 'boost');
      return { protocol: 'bluesky', action, nativeId };
    }
    case 'reply': {
      if (!target.publicationId) return undefined;
      const uri = await createRecord('app.bsky.feed.post', {
        text: content,
        createdAt: new Date().toISOString(),
        reply: {
          root: { uri: nativeId, cid: target.publicationId },
          parent: { uri: nativeId, cid: target.publicationId },
        },
      });
      return { protocol: 'bluesky', action, nativeId: uri };
    }
    case 'tip': {
      try {
        await createRecord('app.bsky.feed.post', {
          text: `💸 ${p.walletAddress ? `${p.walletAddress.slice(0, 6)}…` : 'Someone'} sent a tip via DegenFeed`,
          createdAt: new Date().toISOString(),
        });
      } catch {
        /* non-fatal */
      }
      return { protocol: 'bluesky', action, nativeId: `tip:${Date.now()}` };
    }
    default:
      return undefined;
  }
}

/**
 * Lens — like, boost (mirror), reply (comment) via the Lens API (client-side
 * typed-data broadcast for on-chain actions; access-token calls otherwise).
 */
async function interactLens(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId, content } = p;
  const token = p.auth.lens ?? p.auth.accessToken ?? env.LENS_ACCESS_TOKEN ?? '';
  if (!token) return undefined;

  const { LensClient } = await import('@degenfeed/lens-sdk');
  const client = new LensClient(env.LENS_API_URL || 'https://api-v2.lens.dev/graphql');
  client.setAuth(token);

  switch (action) {
    case 'like':
      await client.like(nativeId);
      return { protocol: 'lens', action, nativeId };
    case 'unlike':
      await client.unlike(nativeId);
      return { protocol: 'lens', action, nativeId };
    case 'boost':
      await client.mirror(nativeId);
      return { protocol: 'lens', action, nativeId };
    case 'unboost':
      await client.unmirror(nativeId);
      return { protocol: 'lens', action, nativeId };
    case 'reply':
      await client.comment(nativeId, content);
      return { protocol: 'lens', action, nativeId: `reply:${Date.now()}` };
    case 'tip':
      return { protocol: 'lens', action, nativeId: `tip:${Date.now()}` };
    default:
      return undefined;
  }
}

/**
 * Lemmy — like (post/like score), reply (comment), tip (comment + ledger).
 */
async function interactLemmy(p: DispatchParams): Promise<NativeReference | undefined> {
  const { env, action, nativeId, content } = p;
  const instance =
    p.auth.lemmy_instance || env.LEMMY_INSTANCE_URL || 'https://community.degenfeed.xyz';
  const token = p.auth.lemmy ?? p.auth.authToken ?? env.LEMMY_BOT_JWT ?? '';
  if (!token) return undefined;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  switch (action) {
    case 'like':
    case 'unlike': {
      const score = action === 'like' ? 1 : 0;
      const res = await fetch(`${instance}/api/v3/post/like`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ post_id: Number(nativeId) || 0, score }),
      });
      if (!res.ok) return undefined;
      return { protocol: 'lemmy', action, nativeId };
    }
    case 'reply': {
      const res = await fetch(`${instance}/api/v3/comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ post_id: Number(nativeId) || 0, content }),
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { comment_view?: { comment?: { id: number } } };
      const commentId = data.comment_view?.comment?.id;
      return {
        protocol: 'lemmy',
        action,
        nativeId: commentId ? String(commentId) : `reply:${Date.now()}`,
      };
    }
    case 'tip': {
      try {
        await fetch(`${instance}/api/v3/comment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            post_id: Number(nativeId) || 0,
            content: `💸 ${p.walletAddress ? `${p.walletAddress.slice(0, 6)}…` : 'Someone'} sent a tip via DegenFeed`,
          }),
        });
      } catch {
        /* non-fatal */
      }
      return { protocol: 'lemmy', action, nativeId: `tip:${Date.now()}` };
    }
    default:
      return undefined;
  }
}

// ─── TID generator (Bluesky record keys) ─────────────────────────────────
// TIDs are 13-char base32 strings. First char encodes the clock id (0-7
// for our purposes); the rest is a millisecond timestamp + monotonic counter.

function genTid(): string {
  const BASE32 = '0123456789abcdefghijklmnopqrstuv';
  const now = Date.now();
  let remaining = (BigInt(now) << 8n) | 0n;
  let out = BASE32.charAt(Math.floor(Math.random() * 8));
  for (let i = 0; i < 12; i++) {
    out += BASE32.charAt(Number(remaining & 31n));
    remaining >>= 5n;
  }
  return out;
}
