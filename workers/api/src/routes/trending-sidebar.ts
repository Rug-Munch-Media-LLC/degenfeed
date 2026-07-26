/**
 * @degenfeed/api-worker — Trending Sidebar
 *
 * GET /api/trending/sidebar — Returns all sidebar sections in one call.
 * Aggregates topics, communities, videos, spaces, nostr, farcaster, and tippers.
 * Cached for 120 seconds (2 min) in KV.
 */

import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type TrendingTopic = {};
