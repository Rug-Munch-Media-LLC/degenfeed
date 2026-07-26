/**
 * @degenfeed/api-worker — Premium Publish Analytics
 *
 * Real post analytics tracking for premium publishing:
 * - Engagement metrics per protocol (likes, reposts, replies, quotes, tips)
 * - Publish success/failure rates
 * - Best-performing content analysis
 * - Cross-posting efficiency reports
 * - Per-post performance analytics
 *
 * Uses KV-backed counters for real-time aggregation.
 * Complements post-analytics.ts (which provides the aggregate dashboard).
 */

import { requirePremiumTier } from '../../premium';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

// ─── KV Key Prefixes ──────────────────────────────────────────────────────

const PREFIX_POST_ANALYTICS = 'premium:post:analytics:';
const PREFIX_PROTOCOL_STATS = 'premium:protocol:stats:';
// Reserved for daily aggregation: const PREFIX_DAILY_AGG = 'premium:daily:';

// ─── Types ────────────────────────────────────────────────────────────────

export type PostPerformance = {};
