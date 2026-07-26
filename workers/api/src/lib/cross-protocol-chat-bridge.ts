/**
 * @degenfeed/api-worker — Cross-Protocol Chat Bridge
 *
 * Bridges chat from ALL platforms (ActivityPub, AT Protocol, Farcaster, etc.)
 * where a stream was announced into the DegenFeed stream chat.
 *
 * When a stream goes live, this module:
 *   1. Checks which platforms the stream was announced to
 *   2. Polls each platform for new replies/comments
 *   3. Normalizes all replies into a unified StreamComment format
 *   4. Pushes them to the stream's WebSocket chat channel
 *   5. Labels each message with its source ("via Mastodon", "via Bluesky", etc.)
 *
 * This makes DegenFeed the CENTRAL hub where ALL cross-platform conversation
 * converges into a single unified chat experience.
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { StreamComment } from './activitypub-stream-bridge';
import { ActivityPubStreamBridge } from './activitypub-stream-bridge';
import { BlueskyStreamBridge } from './bluesky-stream-bridge';
import { NostrLiveBridge } from './nostr-live-bridge';
import { ThreadsStreamBridge } from './threads-stream-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export type ChatBridgeConfig = {}
