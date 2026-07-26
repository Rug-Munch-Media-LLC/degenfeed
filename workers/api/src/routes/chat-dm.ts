/**
 * /api/chat/dm — Standardized Private Chat (Matrix-Backed)
 *
 * Every DM goes through a Matrix E2E room (Olm/Megolm).
 * Messages bridge to the recipient's preferred protocol automatically.
 *
 * POST   /api/chat/dm/create     — Create DM room with another user
 * POST   /api/chat/dm/send       — Send message to DM room
 * GET    /api/chat/dm/messages    — Get messages from DM room
 * GET    /api/chat/dm/list        — List all DM conversations
 *
 * Identity resolution: any identifier (wallet, npub, handle) → Matrix ID
 * Encryption: E2E via Matrix Olm/Megolm (m.megolm.v1.aes-sha2)
 */

import { badRequest, jsonResponse, methodNotAllowed, noCacheJsonResponse, notFound, serverError } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/dm/create
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDMCreate(request: Request, env: Env): Promise<Response> {
