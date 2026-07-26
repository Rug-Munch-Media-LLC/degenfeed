/**
 * @degenfeed/api-worker — Mastodon Tipping Routes
 *
 * Tipping for Mastodon posts (toots).
 * Supports all 6 DegenFeed methods via the unified resolution pipeline.
 *
 * KV schema:
 *   mastodon:tip:{statusId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   mastodon:tip:leaderboard → [ { statusId, authorAcct, totalUsd, totalCount }, ... ]
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────

type MastodonTipRecord = {}
