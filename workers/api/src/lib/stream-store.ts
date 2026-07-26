/**
 * @degenfeed/api-worker — Stream Data Layer (KV-backed)
 *
 * All CRUD operations for the DegenFeed multi-type streaming system.
 * Supports: solo video, audio spaces, collab streams, coin-launch hype,
 * and profile streams. Stores metadata in CONTENT_STORE KV with TTL-based
 * expiration for live streams (24h) and extended retention for ended streams (7d).
 *
 * KV Key Schema:
 *   stream:{id}                   — LiveStream record JSON
 *   stream:live                   — JSON array of all live stream IDs
 *   stream:live:{type}            — JSON array of live stream IDs by type
 *   stream:creator:{wallet}       — JSON array of creator stream IDs
 *   stream:past:{wallet}          — JSON array of ended stream IDs for creator
 *   stream:chat:{streamId}        — JSON array of ChatMessage (capped 200)
 *   stream:reactions:{streamId}   — JSON array of StreamReaction (capped 100)
 *   stream:tip:{streamId}         — JSON array of StreamTip (capped 200)
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamType = 'solo' | 'spaces' | 'collab' | 'coin-launch' | 'profile';
export type StreamSurface =
  | 'profile'
  | 'coin-page'
  | 'community'
  | 'visual-feed'
  | 'discover'
  | 'spaces-hub';
export type StreamHost = 'peertube' | 'huddle01';

export type LiveStream = {};
