/**
 * @degenfeed/api-worker — Tip Streaks & Incentives Backend
 *
 * TASK 5: Tip Incentives
 * Tracks tip streaks, awards badges, manages revenue goals,
 * and provides leaderboard data for the tipping UI.
 *
 * Uses KV-based streak tracking with 1-year TTL.
 *
 * @see ../routes/unified-tip-core.ts — Core tip recording + badge system
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import { awardBadge, kvGetJson, kvPutJson, type UnifiedTipEvent } from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────

const _VALID_METHODS = [
  'direct_onchain',
  'resolve_identity',
  'protocol_native',
  'generate_link',
  'generate_qr',
];

export type TipStreakRecord = {}
