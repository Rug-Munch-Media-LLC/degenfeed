/**
 * @degenfeed/api-worker — Cross-Protocol Live Bridge Engine
 *
 * Makes live content accessible across all connected protocols:
 *   - Nostr NIP-53 / Kind 30311 ↔ PeerTube
 *   - Farcaster Live Frames ↔ Owncast
 *   - YouTube ↔ PeerTube (authorized mirroring)
 *   - Cross-platform chat (messages from any platform reach all others)
 *
 * Every bridge operation uses: reliability layer, KV state tracking, structured errors.
 */

import type { LiveSource } from '../feed/live-aggregator';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { recordBridgeOperation } from './bridge-reliability';
import { NostrLiveBridge } from './nostr-live-bridge';

// ─── Types ──────────────────────────────────────────────────────────────

export type BridgeDirection =
  | 'nostr-to-peertube'
  | 'peertube-to-nostr'
  | 'farcaster-to-owncast'
  | 'youtube-to-peertube';

export type BridgeProtocol = 'nostr' | 'peertube' | 'farcaster' | 'owncast' | 'youtube' | 'all';

export type BridgeConfig = {}
