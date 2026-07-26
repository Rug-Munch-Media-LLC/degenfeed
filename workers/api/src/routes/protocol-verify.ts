/**
 * @degenfeed/api-worker — Protocol Content Visibility Verification
 *
 * Verifies that content posted to a protocol is visible:
 *   1. On the protocol's native feed
 *   2. In DegenFeed's main unified feed
 *   3. In DegenFeed's per-protocol feed
 *   4. Via search
 *   5. To other users on the protocol (not on DegenFeed)
 *
 * Routes:
 *   POST /api/protocol/verify/post   — Verify a specific post's visibility
 *   GET  /api/protocol/verify/health  — Overall verification system health
 */

import { log } from '../logger';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/protocol/verify/post ────────────────────────────────────

export async function handleVerifyPost(request: Request, env: Env): Promise<Response> {
