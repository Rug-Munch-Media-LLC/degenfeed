/**
 * @degenfeed/api-worker — Post Analytics Dashboard
 *
 * Premium analytics for cross-posts. Tracks engagement, best times,
 * content type performance, hashtag effectiveness, and follower growth.
 *
 * Data sources:
 *   - Bridge reliability KV (per-protocol publish success/failure)
 *   - Cross-publish orchestrator (batches, per-post stats)
 *   - Protocol-specific API calls for engagement metrics
 *   - Aggregated analytics KV store (pre-computed stats)
 *
 * All routes are premium-gated via premium-gate.ts / requirePremiumTier.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { requirePremiumTier } from '../premium';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type PostAnalytics = {};
