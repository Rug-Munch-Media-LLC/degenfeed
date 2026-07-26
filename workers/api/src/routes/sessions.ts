/**
 * @degenfeed/api-worker — Session management API
 *
 * Handles listing active sessions, revoking individual sessions, and
 * revoking all sessions for the current user.
 *
 * Session metadata is stored in KV when the session cookie is created
 * (see session.ts createSession). This allows the user to view and
 * manage their active sessions from the Security settings page.
 *
 * Routes (registered in app.ts):
 *   GET    /api/auth/sessions        → list active sessions
 *   DELETE /api/auth/sessions/:nonce → revoke a specific session
 *   DELETE /api/auth/sessions        → revoke all other sessions
 */

import { extractRequestMetadata, logSecurityEvent } from '../lib/security-log';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { isSessionRevoked, requireSession, revokeSession, type SessionPayload } from '../session';
import type { Env } from '../types';

/* ─── KV key patterns for session metadata ─────────────────────────── */

/**
 * Each active session stores metadata in KV at:
 *   session:meta:{nonce} → JSON SessionMeta
 *
 * A user's active sessions are tracked via a sorted list:
 *   user:sessions:{address} → JSON array of nonces
 */

export type SessionMeta = {}
