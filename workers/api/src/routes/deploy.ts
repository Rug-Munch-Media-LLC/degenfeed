/**
 * /api/deploy — Self-hosted community deployment requests
 *
 * POST /api/deploy/request — Submit a deploy request (stored in KV)
 * GET  /api/deploy/status   — Check deploy request status by id
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export type DeployRequest = {};
