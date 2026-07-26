/**
 * @degenfeed/api-worker — Lens Protocol Creator Coin Routes
 *
 * Enables Lens Protocol users to deploy, manage, and receive tips through
 * their personal creator coin on Polygon (Lens native), auto-wrapped for
 * Zora visibility, bridged to Base, and cross-chained to Solana.
 *
 * POST /api/lens/coin/deploy           — Deploy creator coin for authenticated Lens profile
 * GET  /api/lens/coin/:profileId       — Get creator coin info for a Lens profile
 * POST /api/lens/coin/:profileId/tip   — Tip a Lens creator via their coin
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import { recordUnifiedTip } from './unified-tip';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_COIN_PREFIX = 'lens:coin:';
const LENS_LINK_PREFIX = 'lens:link:';
const ZORA_WRAPPER_FACTORY = '0x0000000000000000000000000000000000000000'; // Override via env
const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
const TTL_1Y = 60 * 60 * 24 * 365;

// ─── Types ──────────────────────────────────────────────────────────────────

type LensCoinRecord = {}
