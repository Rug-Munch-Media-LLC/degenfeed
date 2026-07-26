/**
 * @degenfeed/api-worker — Creator Earnings Dashboard API
 *
 * Unified earnings aggregation across ALL revenue streams:
 *   GET /api/creator/earnings?wallet=0x...
 *
 * Aggregates: tips (Nostr zaps, Farcaster, Lens collects, direct crypto),
 * coin fees, subscriptions, NFT sales — by protocol, chain, and time period.
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────

export type EarningsData = {};
