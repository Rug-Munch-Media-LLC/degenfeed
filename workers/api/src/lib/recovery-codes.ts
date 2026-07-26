/**
 * @degenfeed/api-worker — One-Time Recovery Codes
 *
 * Generates and verifies recovery codes for TOTP 2FA lockout protection.
 * Codes are hashed with SHA-256 before storage — never stored in plaintext.
 * Each code is single-use (deleted after verification).
 *
 * ## Format
 * XXXX-XXXX-XXXX (crypto exchange standard)
 * Each X is a hex nibble, giving 12 hex chars = 48 bits of entropy per code.
 * 8 codes × 48 bits = 384 bits total entropy.
 *
 * ## Security
 * - SHA-256 hashed before KV storage (never plaintext)
 * - One-time use: deleted from KV after successful verification
 * - Generated in batches of 8 (industry standard for 2FA recovery)
 * - User is shown codes exactly once during TOTP setup
 *
 * ## Usage
 *   const codes = await generateRecoveryCodes(env, wallet, 8);
 *   const valid = await verifyRecoveryCode(env, wallet, code);
 */

import { recoveryCodeHashKey } from '../kv-key-patterns';
import type { Env } from '../types';

// ─── Constants ────────────────────────────────────────────────

/** Default number of recovery codes to generate. */
const DEFAULT_CODE_COUNT = 8;

/** Bytes of randomness per code (6 bytes → 12 hex chars → XXXX-XXXX-XXXX). */
const BYTES_PER_CODE = 6;

/** TTL for recovery code hashes in KV (5 years — essentially permanent). */
const RECOVERY_CODE_TTL = 5 * 365 * 24 * 60 * 60; // ~157M seconds

// ─── Public API ───────────────────────────────────────────────

/**
 * Generate `count` one-time recovery codes for the given wallet.
 * Each code is formatted as XXXX-XXXX-XXXX.
 * Codes are SHA-256 hashed and stored in KV — the plaintext codes
 * are returned exactly once for the user to save.
 *
 * @returns Array of plaintext recovery codes (display to user exactly once).
 */
export async function generateRecoveryCodes(
  env: Env,
  address: string,
  count: number = DEFAULT_CODE_COUNT,
): Promise<string[]> {
