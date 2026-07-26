/**
 * @degenfeed/api-worker — Membership Tiers
 *
 * The canonical tier system for DegenFeed Premium.
 * 4 tiers: Free → Pro ($5) → Creator ($10) → Enterprise ($20)
 *
 * Re-exports for backward compat with premium.ts and tier-gate.ts.
 * New code should import from here.
 */

import type { Env } from '../types';

// ─── Tier Definitions ───────────────────────────────────────────────────────

export type Tier = 'free' | 'pro' | 'creator' | 'enterprise';

export type TierInfo = {}
