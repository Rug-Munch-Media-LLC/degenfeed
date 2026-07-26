/**
 * @degenfeed/api-worker — Enhanced Unified Stream Chat Integration
 *
 * Cross-platform chat that works across Owncast, PeerTube, DegenFeed native,
 * YouTube, Twitch, and Farcaster live streams.
 *
 * Features:
 *   - Unified message format with platform badges
 *   - Native WebSocket chat for DegenFeed
 *   - PeerTube chat bridge (REST)
 *   - Owncast chat bridge (REST/IRC)
 *   - YouTube Live chat bridge (via API)
 *   - Twitch chat bridge (via Helix/IRC)
 *   - Farcaster chat bridge (via Hubble)
 *   - Unified view: all messages in one stream with platform badges
 *   - Emotes, tips, highlighted messages from tippers
 *   - Cross-platform chat bridging
 *   - Rate-limited message sending
 *   - Message persistence in KV
 */

import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ──────────────────────────────────────────────────────────────

export type ChatSource =
  | 'degenfeed'
  | 'owncast'
  | 'peertube'
  | 'youtube'
  | 'twitch'
  | 'farcaster'
  | 'nostr';

export type ChatMessage = {}
