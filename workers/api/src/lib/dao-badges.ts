/**
 * @degenfeed/api-worker — DAO Badge System
 *
 * 20+ badges across voting, proposal, treasury, community, and special categories.
 * Badges are stored in the CACHE KV namespace and awarded by checking conditions.
 *
 * KV schema:
 *   badge:{userId}:{badgeId}     → BadgeAward (the badge detail + awardedAt)
 *   badges:{userId}              → string[] (list of badge IDs for the user)
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BadgeCategory = 'voting' | 'proposal' | 'treasury' | 'community' | 'special';

export type DAOBadgeDef = {};
