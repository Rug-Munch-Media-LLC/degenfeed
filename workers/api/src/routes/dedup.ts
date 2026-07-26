/**
 * /api/dedup/* — Cross-platform deduplication API.
 *
 * Routes:
 *   POST /api/dedup/check          — Check if content is duplicate
 *   POST /api/dedup/register       — Register content in dedup registry
 *   GET  /api/dedup/cluster/:id    — Get all copies of same content
 *   POST /api/dedup/mark-seen      — Mark content as seen by user
 *   GET  /api/dedup/seen/stats     — User's seen content stats
 *
 * All routes accept JSON request bodies and return JSON responses.
 * Seen-related routes require a wallet session.
 */

import { type DedupCheckRequest, GlobalDedupRegistry } from '../lib/global-dedup';
import { SeenContentManager } from '../lib/seen-content';
import { jsonResponse } from '../response-helpers';
import { verifySessionCookie } from '../session';
import type { Env } from '../types';

// ─── Session Helper ───────────────────────────────────────────────────────

async function getWalletFromSession(request: Request, env: Env): Promise<string | null> {
