/**
 * @degenfeed/api-worker — Subscription routes
 *
 * Universal Creator Subscription system.
 * Supports Ethereum / Solana wallets, tiered subscriptions,
 * payment confirmation, content gating, and cancellation.
 *
 * KV keys:
 *   sub:config:{wallet}                  → Creator tier config (90d TTL)
 *   sub:{creator}:{subscriber}           → Subscription record (30d TTL active)
 *   sub:subscribers:{creator}            → Subscriber wallet index array
 *   sub:nonce:{creator}:{subscriber}     → Payment nonce (10min TTL)
 *   sub:tx:{txHash}                      → Used txHash dedup (90d TTL)
 *   sub:badge:{wallet}                   → Badge cache (24h TTL)
 */

import { rateLimit } from '../index';
import { jsonResponse, noCacheJsonResponse, rateLimitResponse } from '../response-helpers';
import type { Env } from '../types';
import {
