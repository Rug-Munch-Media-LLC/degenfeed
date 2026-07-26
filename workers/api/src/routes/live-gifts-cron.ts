/**
 * @degenfeed/api-worker — Live Gifts Cron & Payout Processing
 *
 * Handles:
 *   1. Post-stream payout processing
 *   2. Weekly gift rewards distribution
 *   3. Stale stream cleanup
 *   4. Gift earnings aggregation for creator dashboard
 *
 * Integrates with creator-rewards.ts for weekly distribution
 * and platform-fees.ts for fee capture.
 */

import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { GIFT_STREAM_STATE_PREFIX, kvGetJson, kvPutJson, type StreamGiftState, streamGiftKey } from './live-gifts-core';

// ─── Constants ───────────────────────────────────────────────────────────

const PAYOUT_QUEUE_PREFIX = 'live:gifts:payout:';
const TTL_30_DAYS = 60 * 60 * 24 * 30;

// ─── Payout Record ───────────────────────────────────────────────────────

export type GiftPayoutRecord = {}
