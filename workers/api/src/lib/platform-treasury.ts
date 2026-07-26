/**
 * @degenfeed/api-worker — Platform Treasury & Fee System (TASK 4)
 *
 * DegenFeed charges 0.5% on every buy/sell of every creator coin.
 * This module handles:
 *   1. Fee collection tracking in KV
 *   2. Weekly revenue report generation
 *   3. Fee distribution: 60% protocol treasury, 20% DegenFeed ops, 20% creator reward pool
 *   4. On-chain treasury address configuration
 *   5. Revenue transparency endpoint (via creator-dashboard.ts)
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

/** Platform fee: 0.5% = 50 bps */
export const PLATFORM_FEE_BPS = 50;
/** Basis points denominator */
const BPS_DENOM = 10_000;
/** Fee distribution splits (in percent) */
export const FEE_DISTRIBUTION = {
