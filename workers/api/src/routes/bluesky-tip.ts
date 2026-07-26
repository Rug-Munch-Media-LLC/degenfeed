/**
 * @degenfeed/api-worker — Bluesky Tipping Routes
 *
 * Tipping for Bluesky posts (AT Protocol).
 * Supports all 6 DegenFeed methods via the unified resolution pipeline.
 *
 * KV schema:
 *   bluesky:tip:{postId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   bluesky:tip:leaderboard → [ { postId, authorDid, totalUsd, totalCount }, ... ]
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────

type BlueskyTipRecord = {}
