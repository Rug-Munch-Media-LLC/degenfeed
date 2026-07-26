/**
 * @degenfeed/api-worker — Bridgy Fed Bridge Routes
 *
 * Routes:
 *   GET    /api/bridgy/status      — Check Bridgy Fed bridge health
 *   POST   /api/bridgy/configure   — Configure Bridgy Fed for an instance
 *   GET    /api/bridgy/users       — List users with active bridges
 *   POST   /api/bridgy/cross-post  — Cross-post content via Bridgy Fed
 *   POST   /api/bridgy/register    — Register a user's bridge
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import { requireAdminFromSession } from '../lib/admin-guard';
import { type BridgyCrossPostRequest, type BridgyFedConfig, BridgyFedService, type BridgyUserBridge } from '../lib/bridgy-service';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── GET /api/bridgy/status — Bridgy Fed Bridge Health ───────────────────

export async function handleBridgyStatus(request: Request, env: Env): Promise<Response> {
