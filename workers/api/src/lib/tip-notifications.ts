/**
 * @degenfeed/api-worker — Tip Notification Engine
 *
 * Unified tip notification pipeline:
 *   1. In-app notification bell (KV-stored)
 *   2. Push notification (Web Push / VAPID)
 *   3. Email digest of weekly tips
 *   4. Sound effect triggers (via WebSocket broadcast)
 *   5. Protocol-specific notifications (Nostr DM, Farcaster cast, etc.)
 *   6. "alice.eth just tipped you 500 sats" with protocol badge
 */

import { badRequest, methodNotAllowed, ok } from '../response-helpers';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';

// ─── Types ──────────────────────────────────────────────────────────────

export type TipNotificationEvent = {};
