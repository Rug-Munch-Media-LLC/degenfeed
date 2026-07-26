/**
 * /api/chat/keys — Encryption Key Verification Routes
 *
 * Routes:
 *   POST /api/chat/keys/verify       — Verify encryption keys with a peer
 *   GET  /api/chat/keys/fingerprint  — Get own key fingerprint
 *   GET  /api/chat/keys/fingerprint/:userId/:protocol — Get user's fingerprint
 *   GET  /api/chat/keys/verified     — Get list of verified peers
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const _keyManager: typeof import('@degenfeed/chat-super-app').KeyVerificationManager | null = null;
async function getKeyManager() {
