/**
 * @degenfeed/api-worker — TOTP 2FA Routes (RFC 6238)
 *
 * Provides endpoints for setting up, verifying, and disabling
 * time-based one-time password authentication using standard
 * authenticator apps (Google Authenticator, Authy, 1Password, etc.).
 *
 * ## Endpoints
 *   POST /api/auth/totp/setup          — Generate TOTP secret + QR URL
 *   POST /api/auth/totp/verify         — Confirm code + activate 2FA
 *   POST /api/auth/totp/authenticate   — Verify TOTP during login
 *   PUT  /api/auth/totp/disable        — Disable 2FA (requires code)
 *   GET  /api/auth/totp/status         — Check 2FA status
 *
 * ## Flow
 *   setup → (user scans QR in authenticator) → verify → 2FA active
 *   login → authenticate (wallet + code)
 *   disable → verify (code or recovery code)
 *
 * ## Security
 * - Secrets are stored in KV as encrypted values
 * - Recovery codes are SHA-256 hashed before storage
 * - Temp secrets have 10-minute TTL during setup
 * - Session-gated endpoints require active authenticated session
 * - authenticate endpoint uses direct wallet+code (for login flow)
 */

import { Hono } from 'hono';
import { totpSecretKey, totpTempKey } from '../kv-key-patterns';
import { generateRecoveryCodes, verifyRecoveryCode } from '../lib/recovery-codes';
import { buildOtpauthUrl, generateTOTPSecret, isValidTOTPCode, verifyTOTP } from '../lib/totp';
import { jsonResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ────────────────────────────────────────────────

/** TTL for temporary TOTP setup secret (10 minutes). */
const TEMP_SECRET_TTL = 600;

// ─── Router ───────────────────────────────────────────────────

const totp = new Hono<{ Bindings: Env }>();

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Extract and validate the JSON body, returning a parsed object
 * or an error Response.
 */
async function parseBody<T>(c: { req: { raw: Request } }): Promise<{ data?: T; error?: Response }> {
