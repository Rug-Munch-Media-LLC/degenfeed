/**
 * @degenfeed/api-worker — Coin Holder Reputation System
 *
 * Computes reputation scores and tier badges for token holders based on:
 *   - Holding duration and loyalty
 *   - Buy/sell behavior (diamond hands, buy-the-dip)
 *   - Community participation (voting, tipping, referrals)
 *   - Creator interaction
 *
 * Scores are 0-1000 with tiers unlocked at thresholds.
 */

import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type HolderTier = 'supporter' | 'believer' | 'diamond_hands' | 'og' | 'whale';

export type HolderReputation = {}
