/**
 * @degenfeed/api-worker — Cross-Protocol Chat Discovery Routes
 *
 * GET  /api/chat/discover              — Search communities across all protocols
 * GET  /api/chat/discover/trending     — Trending communities
 * GET  /api/chat/discover/protocol/:p  — Communities by protocol
 * GET  /api/chat/discover/recommended  — Recommended based on interests
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── GET /api/chat/discover ─────────────────────────────────────────────────

export async function handleDiscoverySearch(request: Request, env: Env): Promise<Response> {
