/**
 * /api/messages/keys — E2E Encryption Key Management & Encrypted Messaging
 *
 * Routes:
 *   POST /api/messages/keys/exchange        — X3DH key exchange
 *   POST /api/messages/keys/rotate          — Rotate key bundle
 *   GET  /api/messages/keys/public/:userId  — Get public key bundle
 *   POST /api/messages/keys/safety-numbers  — Get safety numbers
 *   POST /api/messages/send-encrypted       — Send encrypted message
 *   POST /api/messages/receive-encrypted    — Receive & decrypt
 *   GET  /api/messages/keys/status          — Check if keys exist
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/messages/keys/exchange — X3DH Key Exchange ───────────────

export async function handleKeyExchange(request: Request, env: Env): Promise<Response> {
