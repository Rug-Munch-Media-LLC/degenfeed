/**
 * @degenfeed/api-worker — WebRTC Video Call Service
 *
 * P2P video calling with zero bandwidth cost.
 *   - 1-on-1: Direct P2P (offer/answer/ICE via KV, text-only)
 *   - Group <6: Full mesh — each peer connects to every other
 *   - Group 6+: SFU mode via Livepeer (or mesh with reduced quality)
 *   - Screen sharing: Add screen share track
 *   - Recording: Optional recording via Livepeer
 *
 * Server cost: zero for signaling (KV text exchange, KB-scale).
 * Video bytes flow peer-to-peer, never through our servers.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ──────────────────────────────────────────────────────────────

export type VideoCall = {};
