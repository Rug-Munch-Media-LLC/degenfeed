/**
 * @degenfeed/api-worker — Feed Event Emitter
 *
 * Coordinates real-time feed event emission to WebSocket clients.
 * After any provider finishes fetching new content, this service:
 * 1. Checks for new posts since the last emission per feed type
 * 2. Compares against KV-stored "last seen" timestamps per feed type
 * 3. Emits `feed:new-post` events to subscribed WebSocket clients
 * 4. Batches emissions (max 1 per second) to avoid flooding
 * 5. Tracks which clients have seen which posts to avoid duplicates
 *
 * Also emits `feed:trending-update`, `feed:engagement-update`,
 * and `feed:protocol-status` events.
 */

import type { EngagementMetrics, Protocol, UnifiedPost } from '@degenfeed/types';
import { broadcastToTopic } from '../routes/realtime';
import type { FeedScope } from '../ws-channels';
import { CHANNELS } from '../ws-channels';

// ─── Types ────────────────────────────────────────────────────────────────

export interface NewPostEvent {
  post: UnifiedPost;
  protocol: Protocol;
  scope: FeedScope;
  timestamp: number;
}

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
  protocols: Protocol[];
}

export interface TrendingUpdateEvent {
  topics: TrendingTopic[];
  timestamp: number;
}

export interface EngagementUpdateEvent {
  postId: string;
  metrics: EngagementMetrics;
  timestamp: number;
}

export type ProtocolStatus = 'up' | 'degraded' | 'down';

export interface ProtocolStatusEvent {
  protocol: Protocol;
  status: ProtocolStatus;
  latency: number;
  timestamp: number;
}

// ─── Batching state ──────────────────────────────────────────────────────

const BATCH_INTERVAL_MS = 1_000; // max 1 emission per second per event type

interface BatchState {
  lastEmittedAt: number;
  pendingPosts: NewPostEvent[];
  pendingTrending: TrendingUpdateEvent | null;
  pendingEngagement: EngagementUpdateEvent[];
  pendingProtocolStatus: ProtocolStatusEvent[];
}

const batchState: BatchState = {
  lastEmittedAt: 0,
  pendingPosts: [],
  pendingTrending: null,
  pendingEngagement: [],
  pendingProtocolStatus: [],
};

let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── KV-backed dedup ─────────────────────────────────────────────────────

/**
 * KV key for tracking the last-seen post ID per feed scope.
 * Used to avoid emitting duplicate new-post events.
 */
function lastSeenKey(scope: FeedScope): string {
  return `feed:last-seen:${scope}`;
}

/**
 * Get the last-emitted post ID for a given feed scope from KV.
 */
export async function getLastSeenPostId(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
): Promise<string | null> {
  if (!env.CACHE) return null;
  try {
    return (await env.CACHE.get(lastSeenKey(scope))) ?? null;
  } catch {
    return null;
  }
}

/**
 * Store the latest post ID for a feed scope in KV.
 * Used to suppress duplicate emissions on the next cycle.
 */
export async function setLastSeenPostId(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
  postId: string,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(lastSeenKey(scope), postId, { expirationTtl: 86_400 });
  } catch {
    // Non-critical
  }
}

// ─── Event emission ──────────────────────────────────────────────────────

/**
 * Queue a `feed:new-post` event for batched emission.
 * If the queue was empty, schedule a flush in BATCH_INTERVAL_MS.
 */
export function emitNewPost(event: NewPostEvent): void {
  batchState.pendingPosts.push(event);
  scheduleFlush();
}

/**
 * Queue a `feed:trending-update` event.
 * Replaces any previously queued trending update (latest wins).
 */
export function emitTrendingUpdate(event: TrendingUpdateEvent): void {
  batchState.pendingTrending = event;
  scheduleFlush();
}

/**
 * Queue a `feed:engagement-update` event for batched emission.
 */
export function emitEngagementUpdate(event: EngagementUpdateEvent): void {
  batchState.pendingEngagement.push(event);
  scheduleFlush();
}

/**
 * Queue a `feed:protocol-status` event.
 * Only the latest status per protocol is kept.
 */
export function emitProtocolStatus(event: ProtocolStatusEvent): void {
  // Replace previous status for the same protocol
  const idx = batchState.pendingProtocolStatus.findIndex((e) => e.protocol === event.protocol);
  if (idx >= 0) {
    batchState.pendingProtocolStatus[idx] = event;
  } else {
    batchState.pendingProtocolStatus.push(event);
  }
  scheduleFlush();
}

// ─── Flush logic ─────────────────────────────────────────────────────────

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
}

function flushBatch(): void {
  flushTimer = null;
  const now = Date.now();
  const elapsed = now - batchState.lastEmittedAt;

  // Ensure minimum interval between flushes
  if (elapsed < BATCH_INTERVAL_MS) {
    scheduleFlush();
    return;
  }

  batchState.lastEmittedAt = now;

  // Flush pending new-post events (deduped by post ID)
  if (batchState.pendingPosts.length > 0) {
    const seen = new Set<string>();
    const unique: NewPostEvent[] = [];
    for (const evt of batchState.pendingPosts) {
      if (!seen.has(evt.post.id)) {
        seen.add(evt.post.id);
        unique.push(evt);
      }
    }
    for (const evt of unique) {
      broadcastToTopic(CHANNELS.FEED_NEW_POST, {
        type: 'feed:new-post',
        post: evt.post,
        protocol: evt.protocol,
        scope: evt.scope,
        timestamp: evt.timestamp,
      });
    }
    batchState.pendingPosts = [];
  }

  // Flush trending update (latest only)
  if (batchState.pendingTrending) {
    broadcastToTopic(CHANNELS.FEED_TRENDING_UPDATE , {
      type: 'feed:trending-update',
      topics: batchState.pendingTrending.topics,
      timestamp: batchState.pendingTrending.timestamp,
    });
    batchState.pendingTrending = null;
  }

  // Flush engagement updates (deduped by postId)
  if (batchState.pendingEngagement.length > 0) {
    const seen = new Set<string>();
    for (const evt of batchState.pendingEngagement) {
      if (!seen.has(evt.postId)) {
        seen.add(evt.postId);
        broadcastToTopic(CHANNELS.FEED_ENGAGEMENT_UPDATE , {
          type: 'feed:engagement-update',
          postId: evt.postId,
          metrics: evt.metrics,
          timestamp: evt.timestamp,
        });
      }
    }
    batchState.pendingEngagement = [];
  }

  // Flush protocol status events (one per protocol)
  if (batchState.pendingProtocolStatus.length > 0) {
    for (const evt of batchState.pendingProtocolStatus) {
      broadcastToTopic(CHANNELS.FEED_PROTOCOL_STATUS , {
        type: 'feed:protocol-status',
        protocol: evt.protocol,
        status: evt.status,
        latency: evt.latency,
        timestamp: evt.timestamp,
      });
    }
    batchState.pendingProtocolStatus = [];
  }
}

// ─── Provider fetch integration ──────────────────────────────────────────

/**
 * Called after a provider fetch completes.
 * Checks if the newest post is different from the last-seen post
 * for the given scope and emits a `feed:new-post` event if so.
 *
 * @param env - Worker env with KV bindings
 * @param scope - Which feed scope this fetch was for
 * @param posts - The posts returned from the provider fetch (sorted newest-first)
 * @param protocol - The protocol that was fetched
 */
export async function checkAndEmitNewPosts(
  env: { CACHE?: KVNamespace },
  scope: FeedScope,
  posts: UnifiedPost[],
  protocol: Protocol,
): Promise<void> {
  if (posts.length === 0) return;

  const newestPost = posts[0];
  if (!newestPost) return;

  const lastSeenId = await getLastSeenPostId(env, scope);
  if (lastSeenId === newestPost.id) {
    // No new post since last emission — skip
    return;
  }

  // Update last-seen
  await setLastSeenPostId(env, scope, newestPost.id);

  // Emit the event
  emitNewPost({
    post: newestPost,
    protocol,
    scope,
    timestamp: Date.now(),
  });
}

/**
 * Emit a trending update event to all subscribers.
 */
export function emitTrendingTopics(topics: TrendingTopic[]): void {
  emitTrendingUpdate({
    topics,
    timestamp: Date.now(),
  });
}

/**
 * Emit a protocol status change event.
 */
export function emitProtocolHealth(
  protocol: Protocol,
  status: ProtocolStatus,
  latency: number,
): void {
  emitProtocolStatus({
    protocol,
    status,
    latency,
    timestamp: Date.now(),
  });
}
