/**
 * /api/chat/client — Unified Chat Client
 *
 * Login with DegenFeed wallet → auto-provisions Matrix account.
 * Sync messages via Matrix /sync API (long-poll for real-time updates).
 * Chat list: all DMs and groups in one feed.
 *
 * POST /api/chat/client/login  — Login wallet → provision Matrix account
 * GET  /api/chat/client/sync   — Matrix /sync (long-poll for new messages)
 * GET  /api/chat/client/rooms  — All rooms (DMs + groups)
 * POST /api/chat/client/logout — Clear Matrix session
 */

import { badRequest, jsonResponse, methodNotAllowed, noCacheJsonResponse, notFound, serverError } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/client/login
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClientLogin(request: Request, env: Env): Promise<Response> {
