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
import type { Env } from '../types';
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

export type ProtocolIdentity = {}
