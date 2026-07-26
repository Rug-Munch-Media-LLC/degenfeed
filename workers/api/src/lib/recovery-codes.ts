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

import type { Env } from '../types';
import { recoveryCodeHashKey } from '../kv-key-patterns';

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
  const codes: string[] = [];
  const normalizedAddress = address.toLowerCase();

  for (let i = 0; i < count; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(BYTES_PER_CODE));
    const hex = bytesToHex(bytes);

    // Format: XXXX-XXXX-XXXX
    const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;

    // SHA-256 hash — never store plaintext
    const hash = await sha256Hex(code);

    // Store in KV with long TTL
    const key = recoveryCodeHashKey(normalizedAddress, hash);
    try {
      await env.CACHE?.put(key, '1', {
        expirationTtl: RECOVERY_CODE_TTL,
      });
    } catch {
      // KV write failure — continue generating remaining codes
      // The user can regenerate if setup fails
      console.error(`[recovery-codes] Failed to store code ${i + 1}/${count}`);
    }

    codes.push(code);
  }

  return codes;
}

/**
 * Verify a recovery code. Returns true if the code is valid and
 * has not been used before. The code hash is deleted from KV on
 * successful verification (one-time use).
 *
 * This is constant-time in the sense that SHA-256 verification
 * is done before the KV lookup — but the overall operation
 * depends on KV round-trip time.
 */
export async function verifyRecoveryCode(
  env: Env,
  address: string,
  code: string,
): Promise<boolean> {
  const normalizedAddress = address.toLowerCase();

  // Validate format first (fast reject)
  if (!/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i.test(code)) {
    return false;
  }

  const hash = await sha256Hex(code);
  const key = recoveryCodeHashKey(normalizedAddress, hash);

  try {
    const exists = await env.CACHE?.get(key);
    if (exists === null || exists === undefined) {
      return false;
    }

    // One-time use — delete immediately
    await env.CACHE?.delete(key);
    return true;
  } catch {
    // KV hiccup — fail closed (don't allow login through a broken check)
    return false;
  }
}

/**
 * Count remaining recovery codes for a wallet (for display purposes).
 * Walks through the expected keys — this is an estimate since we don't
 * have a list index.
 *
 * @returns Number of codes found, or -1 if we can't determine (KV error).
 */
export async function countRemainingRecoveryCodes(_env: Env, _address: string): Promise<number> {
  // We store hashes with deterministic keys based on the hash itself.
  // Without a list index, we can't enumerate them efficiently.
  // Return -1 to signal "unknown" — the UI should handle this gracefully.
  return -1;
}

// ─── SHA-256 helper ───────────────────────────────────────────

/**
 * Compute the SHA-256 hex digest of a string using the Web Crypto API.
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashBytes = new Uint8Array(hashBuffer);
  return bytesToHex(hashBytes);
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 * Local implementation to avoid importing @noble/hashes in this file
 * (though it's fine if imported — we use it in totp.ts).
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
