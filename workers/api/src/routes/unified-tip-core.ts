/**
 * @degenfeed/api-worker — Unified Tip Core
 *
 * Shared types, constants, key builders, sanitizers, KV helpers,
 * core tip recording logic, achievement badges, and POST /api/tip/unified handler.
 * Extracted from unified-tip.ts as the primary shared module.
 */

import type { Protocol } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type TipPlatform =
  | 'degenfeed'
  | 'lemmy'
  | 'peertube'
  | 'bluesky'
  | 'mastodon'
  | 'farcaster'
  | 'lens'
  | 'solana';
export type TipEntityType = 'post' | 'comment' | 'video' | 'space' | 'creator_coin';
export type TipPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

// ─── Multi-Chain Types ─────────────────────────────────────────────────

export type SupportedChain =
  | 'lightning'
  | 'ethereum'
  | 'base'
  | 'solana'
  | 'polygon'
  | 'optimism'
  | 'arbitrum';

export type ChainRoute = {};
