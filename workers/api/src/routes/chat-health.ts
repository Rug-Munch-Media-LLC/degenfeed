/**
 * /api/chat/health — Comprehensive Chat Health Dashboard
 *
 * Monitors the entire chat fabric: Conduit, all bridges, federation, and metrics.
 *
 * GET /api/chat/health       — Full health dashboard
 * GET /api/chat/health/quick — Quick status (lighter weight)
 * GET /api/chat/health/bridges — All bridge statuses
 *
 * Returns:
 *   - Conduit status: online/offline
 *   - Per-bridge status: online/degraded/offline
 *   - Federation status: connected/disconnected
 *   - Metrics: total rooms/users, active users, message throughput
 *   - Bridge coverage percentage
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse, serverError } from '../response-helpers';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/health
// ═══════════════════════════════════════════════════════════════════════════

export async function handleChatHealth(_request: Request, env: Env): Promise<Response> {
