/**
 * @degenfeed/api-worker — Algorithm Control API
 *
 * Gives users TOTAL control over their feed algorithm weights, signal sources,
 * custom rules, and presets. Supports the /api/algo/* routes.
 *
 * All user-specific data is stored in KV under `algo:*` keys.
 *
 * Auth: All endpoints require a valid session cookie (`__Host-dfid`).
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type ExplainerContext, explainPost } from '../lib/feed-explainer';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type AlgorithmWeights = {};
