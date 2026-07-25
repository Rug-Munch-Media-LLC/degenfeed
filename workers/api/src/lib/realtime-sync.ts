/**
 * @degenfeed/api-worker — RealTime Cross-Protocol Sync Engine
 *
 * Keeps all protocols in sync within seconds. When something happens
 * (post, like, tip, reply, stream) on one protocol, this engine
 * propagates it to all linked sibling protocols and broadcasts to
 * connected WebSocket clients.
 *
 * Architecture:
 *   Protocol Event → Event Webhook → RealTimeSync.normalizeEvent()
 *     → getSiblings() → syncToProtocol() (per sibling)
 *     → broadcastToClients() (via WS)
 *     → enqueue to sync-queue (for durability)
 *
 * Inbound subscriptions:
 *   - Nostr: WebSocket REQ to relay + webhook receiver
 *   - AT Protocol: Firehose via JetStream webhook
 *   - Farcaster: Webhook receiver (Hubble)
 *   - ActivityPub: Streaming API EventSource (polled) + webhook
 *
 * Latency target: <2s source-to-sibling for likes, tips, replies.
 *                 <5s for new posts (bridging takes longer).
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { getSiblingUris } from './cross-post-store';
import type { SyncAction, SyncActionType } from './sync-queue';
import { enqueueSyncAction } from './sync-queue';

// ─── Exported Types ───────────────────────────────────────────────────────

export type ProtocolEventType =
  | 'post'
  | 'like'
  | 'unlike'
  | 'repost'
  | 'unrepost'
  | 'reply'
  | 'tip'
  | 'stream'
  | 'identity'
  | 'bookmark';

export interface ProtocolIdentity {
  /** Protocol-specific user ID */
  id: string;
  /** Display handle */
  handle?: string;
  /** Display name */
  displayName?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Auth tokens for this protocol */
  auth?: Record<string, string>;
}

export interface ProtocolEvent {
  /** Which protocol fired the event */
  protocol: Protocol;
  /** Event type */
  type: ProtocolEventType;
  /** Protocol-specific event identifier */
  eventId: string;
  /** Timestamp when the event occurred (ms) */
  timestamp: number;
  /** Content text */
  text?: string;
  /** Title (for long-form content) */
  title?: string;
  /** The user who triggered the event */
  actor: ProtocolIdentity;
  /** The subject post/content this event is about */
  subjectId?: string;
  /** Protocol-native subject URI */
  subjectUri?: string;
  /** Parent subject (for replies) */
  parentId?: string;
  /** Tip amount in USD (for tip events) */
  tipAmountUsd?: number;
  /** Stream title (for stream events) */
  streamTitle?: string;
  /** Stream URL (for stream events) */
  streamUrl?: string;
  /** Extra protocol-specific data */
  raw?: Record<string, unknown>;
}

export interface NormalizedEvent {
  /** Canonical df:// URI */
  dfUri: string;
  /** Normalized event type */
  type: ProtocolEventType;
  /** Source protocol */
  sourceProtocol: Protocol;
  /** Source native ID */
  sourceNativeId: string;
  /** Event timestamp */
  timestamp: number;
  /** Text content */
  text: string;
  /** Title */
  title?: string;
  /** Actor identity */
  actor: {
    id: string;
    handle?: string;
    displayName?: string;
  };
  /** Subject post URI */
  subjectDfUri?: string;
  /** Parent post URI */
  parentDfUri?: string;
  /** Tip amount */
  tipAmountUsd?: number;
  /** Stream info */
  streamTitle?: string;
  streamUrl?: string;
}

export interface SyncResult {
  protocol: Protocol;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface SyncReport {
  sourceProtocol: Protocol;
  sourceNativeId: string;
  eventType: ProtocolEventType;
  siblings: SyncResult[];
  broadcastToClients: boolean;
  enqueued: boolean;
  totalLatencyMs: number;
  timestamp: number;
}

// ─── Protocol Subscription State ──────────────────────────────────────────

interface ProtocolSubscription {
  protocol: Protocol;
  identity: ProtocolIdentity;
  active: boolean;
  startedAt: number;
  lastEventAt: number;
  error?: string;
}

const subscriptions = new Map<string, ProtocolSubscription>();

// ─── Event Normalization ──────────────────────────────────────────────────

/**
 * Normalize a protocol-native event into our unified format.
 * This is the bridge between protocol-specific webhooks and our sync engine.
 */
export function normalizeEvent(source: Protocol, event: ProtocolEvent): NormalizedEvent {
  const dfUri = `df://${source}:${event.eventId}`;

  return {
    dfUri,
    type: event.type,
    sourceProtocol: source,
    sourceNativeId: event.eventId,
    timestamp: event.timestamp,
    text: event.text ?? '',
    title: event.title,
    actor: {
      id: event.actor.id,
      handle: event.actor.handle,
      displayName: event.actor.displayName,
    },
    subjectDfUri: event.subjectUri ? `df://${source}:${event.subjectUri}` : undefined,
    parentDfUri: event.parentId ? `df://${source}:${event.parentId}` : undefined,
    tipAmountUsd: event.tipAmountUsd,
    streamTitle: event.streamTitle,
    streamUrl: event.streamUrl,
  };
}

// ─── Cross-Post Sibling Resolution ────────────────────────────────────────

/**
 * Find all cross-post siblings for a given df:// URI.
 * Looks up the cross-post store to find which protocols this content
 * was published to, excluding the source protocol.
 */
export async function getSiblings(
  env: Env,
  dfUri: string,
  sourceProtocol: Protocol,
): Promise<{ protocol: Protocol; nativeId: string; nativeUri?: string }[]> {
  const siblings = await getSiblingUris(env, dfUri);
  return siblings.filter((s) => s.protocol !== sourceProtocol);
}

// ─── Protocol Sync ────────────────────────────────────────────────────────

/**
 * Sync an event to a specific target protocol.
 * Uses the publish-orchestrator or bridge engine to perform the actual
 * cross-protocol action (like, reply, tip, etc.).
 */
async function syncToProtocol(
  normalized: NormalizedEvent,
  sibling: { protocol: Protocol; nativeId: string; nativeUri?: string },
  env: Env,
): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    // Map normalized event type to sync action type
    const syncType = eventTypeToSyncAction(normalized.type);

    // Create a sync action and enqueue it for durability
    await enqueueSyncAction(
      env,
      syncType,
      normalized.sourceProtocol,
      normalized.sourceNativeId,
      sibling.protocol,
      {
        text: normalized.text,
        title: normalized.title,
        timestamp: normalized.timestamp,
        targetNativeId: sibling.nativeId,
        targetNativeUri: sibling.nativeUri,
        tipAmountUsd: normalized.tipAmountUsd,
        streamTitle: normalized.streamTitle,
        streamUrl: normalized.streamUrl,
        actorId: normalized.actor.id,
        actorHandle: normalized.actor.handle,
      },
    );

    const latencyMs = Date.now() - startTime;

    return {
      protocol: sibling.protocol,
      ok: true,
      latencyMs,
    };
  } catch (err) {
    return {
      protocol: sibling.protocol,
      ok: false,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function eventTypeToSyncAction(type: ProtocolEventType): SyncActionType {
  const map: Record<ProtocolEventType, SyncActionType> = {
    post: 'post_created',
    like: 'like_added',
    unlike: 'like_removed',
    repost: 'repost_added',
    unrepost: 'repost_removed',
    reply: 'reply_added',
    tip: 'tip_received',
    stream: 'stream_started',
    identity: 'identity_linked',
    bookmark: 'post_updated',
  };
  return map[type] ?? 'post_updated';
}

// ─── Client Broadcasting ──────────────────────────────────────────────────

/**
 * Broadcast a normalized event to all connected WebSocket clients.
 * Uses the existing ws-broadcast system.
 */
export function broadcastToClients(normalized: NormalizedEvent): void {
  const channelMap: Record<ProtocolEventType, string> = {
    post: 'feed:new',
    like: 'sync:event',
    unlike: 'sync:event',
    repost: 'sync:event',
    unrepost: 'sync:event',
    reply: 'sync:event',
    tip: 'tip:received',
    stream: 'space:update',
    identity: 'sync:event',
    bookmark: 'feed:update',
  };

  const channel = channelMap[normalized.type] ?? 'sync:event';

  broadcastToAll(channel as never, {
    type: 'sync_event',
    eventType: normalized.type,
    sourceProtocol: normalized.sourceProtocol,
    dfUri: normalized.dfUri,
    text: normalized.text.slice(0, 200),
    actor: normalized.actor,
    timestamp: normalized.timestamp,
    tipAmountUsd: normalized.tipAmountUsd,
    streamTitle: normalized.streamTitle,
    streamUrl: normalized.streamUrl,
  });
}

// ─── Main Event Handler ───────────────────────────────────────────────────

/**
 * Handle an incoming event from any protocol.
 * This is the universal entry point for all cross-protocol sync.
 *
 * Flow:
 *   1. Normalize the protocol-native event
 *   2. Find cross-post siblings
 *   3. Sync to each sibling in parallel
 *   4. Broadcast to connected clients
 *   5. Return sync report
 */
export async function onEvent(
  source: Protocol,
  event: ProtocolEvent,
  env: Env,
): Promise<SyncReport> {
  const startTime = Date.now();

  // Step 1: Normalize
  const normalized = normalizeEvent(source, event);

  // Step 2: Find siblings (content must have been cross-posted)
  const siblings = await getSiblings(env, normalized.dfUri, source);

  // Step 3: Sync to all siblings in parallel
  const siblingResults = await Promise.all(
    siblings.map((sibling) => syncToProtocol(normalized, sibling, env)),
  );

  // Step 4: Broadcast to WebSocket clients
  broadcastToClients(normalized);

  return {
    sourceProtocol: source,
    sourceNativeId: event.eventId,
    eventType: event.type,
    siblings: siblingResults,
    broadcastToClients: true,
    enqueued: true,
    totalLatencyMs: Date.now() - startTime,
    timestamp: Date.now(),
  };
}

// ─── Action Sync ──────────────────────────────────────────────────────────

/**
 * Sync a specific action (like, reply, tip, repost, stream) from one
 * protocol to a specific target protocol. Does NOT look up siblings
 * — the caller specifies the exact target.
 */
export async function syncAction(
  sourceProtocol: Protocol,
  action: SyncAction,
  targetProtocol: Protocol,
  env: Env,
): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    await enqueueSyncAction(
      env,
      action.type,
      sourceProtocol,
      action.sourceNativeId,
      targetProtocol,
      {
        ...action.payload,
        sourceDfUri: action.dfUri,
      },
      action.auth,
      action.dfUri,
    );

    return {
      protocol: targetProtocol,
      ok: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      protocol: targetProtocol,
      ok: false,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── SyncProcessor — callback for sync-queue processing ──────────────────

/**
 * Process a sync action from the queue.
 * Uses the bridge engine to actually perform the cross-protocol action.
 * Called by the cron-based processQueue() or inline after webhook delivery.
 *
 * Returns true if the action was processed successfully.
 */
export async function processSyncAction(action: SyncAction): Promise<boolean> {
  try {
    const { getBridgeHandler, fetchSourceContent } = await import('./cross-protocol-bridge-engine');
    const env = (globalThis as unknown as { __ENV?: Env }).__ENV;

    if (!env) {
      console.warn('[realtime-sync] No __ENV available for sync processing — skipping');
      return false;
    }

    // For 'all' target, we process per-protocol separately
    if (action.targetProtocol === 'all') {
      return false; // 'all' is handled by the caller with sibling resolution
    }

    // Fetch source content
    const sourceContent = await fetchSourceContent(
      action.sourceProtocol,
      action.sourceNativeId,
      action.auth ?? {},
      env,
    );

    if (!sourceContent) {
      console.warn(
        `[realtime-sync] Could not fetch source content for ${action.sourceProtocol}:${action.sourceNativeId}`,
      );
      // Still try to bridge with what we have from the payload
    }

    const text = sourceContent?.text ?? (action.payload.text as string) ?? '';
    if (!text) {
      return false;
    }

    // Get the bridge handler for source→target
    const handler = getBridgeHandler(action.sourceProtocol, action.targetProtocol);
    if (!handler) {
      console.warn(
        `[realtime-sync] No bridge handler for ${action.sourceProtocol}→${action.targetProtocol}`,
      );
      return false;
    }

    const source = sourceContent ?? {
      text,
      title: action.payload.title as string | undefined,
      images: [],
      links: [],
      hashtags: [],
    };

    const result = await handler(source, action.auth ?? {}, env);

    if (!result.ok) {
      console.warn(
        `[realtime-sync] Bridge failed for ${action.sourceProtocol}→${action.targetProtocol}: ${result.error}`,
      );
    }

    return result.ok;
  } catch (err) {
    console.error(
      `[realtime-sync] processSyncAction error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ─── Event Factory Helpers ───────────────────────────────────────────────

/**
 * Create a ProtocolEvent from a webhook payload.
 * Each protocol webhook handler should normalize its payload into this format.
 */
export function createEvent(
  protocol: Protocol,
  type: ProtocolEventType,
  eventId: string,
  actor: ProtocolIdentity,
  opts?: {
    text?: string;
    title?: string;
    subjectId?: string;
    subjectUri?: string;
    parentId?: string;
    tipAmountUsd?: number;
    streamTitle?: string;
    streamUrl?: string;
    raw?: Record<string, unknown>;
  },
): ProtocolEvent {
  return {
    protocol,
    type,
    eventId,
    timestamp: Date.now(),
    text: opts?.text,
    title: opts?.title,
    actor,
    subjectId: opts?.subjectId,
    subjectUri: opts?.subjectUri,
    parentId: opts?.parentId,
    tipAmountUsd: opts?.tipAmountUsd,
    streamTitle: opts?.streamTitle,
    streamUrl: opts?.streamUrl,
    raw: opts?.raw,
  };
}

// ─── Protocol Subscriptions ───────────────────────────────────────────────

/**
 * Subscribe to real-time events from a protocol.
 * Each protocol has its own real-time mechanism:
 *
 *   Nostr       → WebSocket REQ to relay
 *   AT Protocol → JetStream firehose (SSE)
 *   Farcaster   → Hub event stream (HTTP long-poll)
 *   Mastodon    → Streaming API (EventSource)
 *   Threads     → Polling (no native real-time)
 *   Lens        → GraphQL subscription (HTTP poll fallback)
 *   RSS         → Polling (HTTP HEAD + conditional GET)
 *
 * In Workers, persistent outbound connections must be managed by
 * the cron-based processor or a Durable Object. This method
 * initializes the subscription state for monitoring.
 */
export function subscribeToProtocol(protocol: Protocol, identity: ProtocolIdentity): boolean {
  const key = `${protocol}:${identity.id}`;

  if (subscriptions.has(key)) {
    const existing = subscriptions.get(key)!;
    existing.lastEventAt = Date.now();
    return true;
  }

  subscriptions.set(key, {
    protocol,
    identity,
    active: true,
    startedAt: Date.now(),
    lastEventAt: Date.now(),
  });

  console.log(`[realtime-sync] Subscribed to ${protocol} (${identity.handle ?? identity.id})`);
  return true;
}

/**
 * Unsubscribe from a protocol's real-time events.
 */
export function unsubscribeFromProtocol(protocol: Protocol, identityId: string): boolean {
  const key = `${protocol}:${identityId}`;
  const sub = subscriptions.get(key);
  if (sub) {
    sub.active = false;
    subscriptions.delete(key);
    console.log(`[realtime-sync] Unsubscribed from ${protocol} (${identityId})`);
    return true;
  }
  return false;
}

/**
 * Get all active subscriptions.
 */
export function getSubscriptions(): ProtocolSubscription[] {
  return Array.from(subscriptions.values()).filter((s) => s.active);
}

/**
 * Get subscription count for monitoring.
 */
export function getSubscriptionCount(): number {
  return getSubscriptions().length;
}

// ─── Webhook Receivers ────────────────────────────────────────────────────

/**
 * Process an incoming webhook from Nostr.
 * Called when a new event is received via Nostr webhook relay.
 */
export async function handleNostrWebhook(
  eventId: string,
  pubkey: string,
  content: string,
  kind: number,
  tags: string[][],
  env: Env,
): Promise<SyncReport | null> {
  // Kind 1 = text note, kind 7 = reaction (like), kind 6 = repost
  let eventType: ProtocolEventType;
  switch (kind) {
    case 1:
    case 30023:
      eventType = 'post';
      break;
    case 7:
      eventType = 'like';
      break;
    case 6:
    case 16:
      eventType = 'repost';
      break;
    default:
      return null; // Skip unknown kinds
  }

  const actor: ProtocolIdentity = {
    id: pubkey,
    handle: tags.find((t) => t[0] === 'p')?.[1],
  };

  // Extract parent event from e-tag
  const eTag = tags.find((t) => t[0] === 'e');
  const parentId = eTag?.[1];

  const event = createEvent('nostr', eventType, eventId, actor, {
    text: content,
    subjectId: parentId,
    parentId,
    raw: { kind, tags },
  });

  return onEvent('nostr', event, env);
}

/**
 * Process an incoming webhook from AT Protocol (Bluesky).
 * Called when a new event is received via JetStream or webhook.
 */
export async function handleAtProtocolWebhook(
  did: string,
  collection: string,
  rkey: string,
  text: string,
  env: Env,
  action?: 'create' | 'delete',
): Promise<SyncReport | null> {
  // collection: app.bsky.feed.post, app.bsky.feed.like, app.bsky.feed.repost
  let eventType: ProtocolEventType;
  if (action === 'delete') {
    eventType = 'post';
  } else if (collection === 'app.bsky.feed.post') {
    eventType = 'post';
  } else if (collection === 'app.bsky.feed.like') {
    eventType = 'like';
  } else if (collection === 'app.bsky.feed.repost') {
    eventType = 'repost';
  } else {
    return null;
  }

  const actor: ProtocolIdentity = {
    id: did,
    handle: did,
    displayName: did,
  };

  const event = createEvent('bluesky', eventType, rkey, actor, {
    text,
    subjectId: rkey,
    subjectUri: `at://${did}/${collection}/${rkey}`,
    raw: { collection, action },
  });

  return onEvent('bluesky', event, env);
}

/**
 * Process an incoming webhook from Farcaster.
 * Called when a new cast/reaction is received via Hubble webhook.
 */
export async function handleFarcasterWebhook(
  hash: string,
  fid: number,
  text: string,
  eventType: 'cast' | 'like' | 'recast' | 'reply',
  env: Env,
  parentHash?: string,
): Promise<SyncReport | null> {
  const typeMap: Record<string, ProtocolEventType> = {
    cast: 'post',
    like: 'like',
    recast: 'repost',
    reply: 'reply',
  };

  const type = typeMap[eventType] ?? 'post';

  const actor: ProtocolIdentity = {
    id: String(fid),
    handle: `fid:${fid}`,
  };

  const event = createEvent('farcaster', type, hash, actor, {
    text,
    subjectId: parentHash,
    parentId: parentHash,
    raw: { fid, eventType },
  });

  return onEvent('farcaster', event, env);
}

/**
 * Process an incoming webhook from ActivityPub (Mastodon/GoToSocial).
 * Called via the streaming API callback.
 */
export async function handleActivityPubWebhook(
  statusId: string,
  accountId: string,
  content: string,
  eventType: 'status' | 'favourite' | 'reblog' | 'reply',
  env: Env,
  inReplyToId?: string,
): Promise<SyncReport | null> {
  const typeMap: Record<string, ProtocolEventType> = {
    status: 'post',
    favourite: 'like',
    reblog: 'repost',
    reply: 'reply',
  };

  const type = typeMap[eventType] ?? 'post';

  const actor: ProtocolIdentity = {
    id: accountId,
  };

  const event = createEvent('mastodon', type, statusId, actor, {
    text: content,
    subjectId: inReplyToId,
    parentId: inReplyToId,
    raw: { accountId, eventType },
  });

  return onEvent('mastodon', event, env);
}
