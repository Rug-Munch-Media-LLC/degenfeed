/**
 * /api/features — KV-backed feature flags
 *
 * Stores feature flags in the CACHE KV namespace under the `ff:` prefix.
 * On first access, seeds a set of default flags from code, with the
 * enabled/disabled state driven by the FEATURE_FLAGS_DEFAULT wrangler var
 * (a comma-separated list of keys that default to enabled).
 *
 * GET  /api/features  — returns all feature flags (no auth)
 * POST /api/features  — upsert a single flag (requires ADMIN_API_KEY)
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

export type FeatureFlag = {};
