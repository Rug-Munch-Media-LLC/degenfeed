/**
 * @degenfeed/api-worker — Bridge Health & Stats Routes
 *
 * Routes:
 *   GET  /api/bridge/health              — All protocol health status
 *   GET  /api/bridge/health/:protocol    — Single protocol health
 *   POST /api/bridge/circuit/reset       — Reset circuit breaker (admin)
 *   GET  /api/bridge/stats               — Bridge statistics (volume, latency, errors)
 *   GET  /api/bridge/stats/:protocol     — Per-protocol bridge stats
 *
 * Every endpoint returns no-cache JSON for real-time observability.
 * Admin endpoints require a valid session with admin wallet.
 */

import { requireAdminFromSession } from '../lib/admin-guard';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Health Endpoints ──────────────────────────────────────────────────────

/**
 * GET /api/bridge/health
 *
 * Returns health status for ALL bridge protocols.
 * Combines live API reachability checks with circuit breaker state.
 * Cached in KV for 15 seconds to prevent thundering health checks.
 */
export async function handleBridgeHealth(request: Request, env: Env): Promise<Response> {
