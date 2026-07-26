/**
 * @degenfeed/api-worker — Subscription NFT Routes
 *
 * NFT-backed subscription system. Creators mint subscription NFTs
 * to subscribers, creating on-chain proof of subscription with
 * automatic expiry support.
 *
 * KV keys:
 *   subnft:tier:{creator}:{tierId}        → Tier definition
 *   subnft:tiers:{creator}                 → Creator's tier list
 *   subnft:sub:{creator}:{subscriber}      → Subscription record
 *   subnft:subscribers:{creator}           → Subscriber address array
 *   subnft:active:{subscriber}             → Active subscriptions for user
 *   subnft:nonce:{creator}:{subscriber}    → Payment nonce (10min TTL)
 *   subnft:tx:{txHash}                     → Used txHash dedup (90d TTL)
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { isValidEvmAddress, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type SubscriptionTier = {};
