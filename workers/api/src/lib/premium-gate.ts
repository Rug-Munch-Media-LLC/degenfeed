/**
 * @degenfeed/api-worker — Premium Tier Gating
 *
 * Tier-based feature gating for DegenFeed Premium Cross-Posting.
 * Complements premium.ts (subscription status) with resource limits
 * and per-feature access checks.
 *
 * Tier structure:
 *   Free (basic):    3 protocols, 10 scheduled posts, basic stats
 *   Premium $10/mo (pro):    All 12 protocols, unlimited scheduling, AI optimize,
 *                            auto-thread, full analytics, calendar, content recycling,
 *                            evergreen posts, batch import
 *   Pro $25/mo (platinum):   Everything in Premium + team accounts, white-label,
 *                            API access, priority support
 *   Enterprise:              Custom
 */

import { type PremiumTier, requirePremiumTier, TIER_LIMITS } from '../premium';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { createPostizSchedule, getSchedulingEngine, shouldUsePostiz } from './postiz-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export type PremiumUsage = {}
