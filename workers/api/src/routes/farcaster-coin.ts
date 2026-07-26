/**
 * @degenfeed/api-worker — Farcaster Creator Coin Routes
 *
 * Enables Farcaster users to deploy, manage, and receive tips through
 * their personal creator coin on Base, auto-wrapped for Zora visibility
 * and cross-chained to Solana.
 *
 * POST /api/farcaster/coin/deploy      — Deploy a creator coin for authenticated Farcaster user
 * GET  /api/farcaster/coin/:fid        — Get creator coin info for a FID
 * POST /api/farcaster/coin/:fid/tip    — Tip a Farcaster creator via their coin
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip';

// ─── Constants ──────────────────────────────────────────────────────────────

const FARCASTER_COIN_PREFIX = 'farcaster:coin:';
const FARCASTER_LINK_PREFIX = 'farcaster:link:';
const ZORA_WRAPPER_FACTORY = '0x0000000000000000000000000000000000000000'; // Override via env
const TTL_1Y = 60 * 60 * 24 * 365;

// ─── Types ──────────────────────────────────────────────────────────────────

type FarcasterCoinRecord = {};
