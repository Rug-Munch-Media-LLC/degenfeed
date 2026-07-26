/**
 * @degenfeed/api-worker — Lemmy Tipping Routes
 *
 * Multi-currency tipping for Lemmy posts and comments.
 * Supports all 6 DegenFeed methods: ETH, SOL, Lightning, USDC,
 * Farcaster (Base), and Lens (Polygon).
 *
 * KV schema:
 *   lemmy:tip:{contentId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   lemmy:tip:leaderboard → [ { contentId, contentType, totalUsd, totalCount }, ... ] (sorted)
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { identityKey } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
