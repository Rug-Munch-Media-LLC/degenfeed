/**
 * @degenfeed/api-worker — Watch History & Progress Tracking
 *
 * Tracks user video consumption for "Continue watching" feature,
 * recommendation profiling, and watch analytics.
 *
 * Storage:
 *   - KV keys: `watch:{wallet}:{videoId}` → watch event JSON
 *   - Capped at 1000 entries per user (FIFO eviction)
 *   - Index key: `watch:index:{wallet}` → sorted list of recent videoIds
 *
 * Used by:
 *   - video-discovery.ts — "Continue watching" strategy, interest profiling
 *   - video-hub.ts — GET /api/video/history, POST /api/video/watch
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type WatchEvent = {};
