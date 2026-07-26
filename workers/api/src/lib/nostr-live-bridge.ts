/**
 * @degenfeed/api-worker — Nostr Live Event Bridge (Kind 30311)
 *
 * Full lifecycle management for Nostr live events per NIP-93 (formerly NIP-53):
 *   - Announce new live streams as replaceable Kind 30311 events
 *   - Update live status (viewer count, status changes) by re-publishing
 *     with the same 'd' tag (replaceable event semantics)
 *   - End live streams with status='ended'
 *   - Announce audio spaces as Kind 30311 with space-specific tags
 *   - Fetch reactions (kind 1 replies + kind 9735 zap receipts)
 *   - Bridge Nostr chat replies into the DegenFeed stream chat
 *
 * Relies on @degenfeed/nostr-sdk for relay pool management and signing.
 * All operations use the existing bridge-reliability pattern for retry+circuit-breaker.
 */

import type { NostrEvent, UnsignedEvent } from '@degenfeed/nostr-sdk';
import * as NostrSdk from '@degenfeed/nostr-sdk';
import type { Space } from '@degenfeed/types';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { ChatMessage, LiveStream, StreamReaction } from './stream-store';
import { addChatMessage, addReaction } from './stream-store';

// ─── Types ──────────────────────────────────────────────────────────────

export type NostrLiveStatus = 'live' | 'ended' | 'planned';

export type NostrLiveEventContent = {}
