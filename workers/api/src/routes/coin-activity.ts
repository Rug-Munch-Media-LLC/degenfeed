/**
 * @degenfeed/api-worker — Coin Activity Feed (TASK 1)
 *
 * Real-time activity feed for creator coins:
 *   GET /api/coin/:symbol/activity — Paginated activity feed
 *
 * Activity types: buy, sell, claim_vested, new_holder, phase_change,
 *                 badge_earned, tip_creator
 *
 * Cached in KV with 30s TTL for fresh feed.
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'buy'
  | 'sell'
  | 'claim_vested'
  | 'new_holder'
  | 'phase_change'
  | 'badge_earned'
  | 'tip_creator';

export type ActivityEvent = {};
