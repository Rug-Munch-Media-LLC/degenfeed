/**
 * @degenfeed/api-worker — TOTP 2FA (RFC 6238 / RFC 4226)
 *
 * Pure Web Crypto API implementation — zero external dependencies.
 * Compatible with Google Authenticator, Authy, 1Password, Bitwarden, etc.
 *
 * ## Usage
 *   const secret = generateTOTPSecret();
 *   const otpauthUrl = buildOtpauthUrl(secret.base32, walletAddress);
 *   const isValid = await verifyTOTP(secret.base32, userCode, { window: 1 });
 *
 * ## Security
 * - 20-byte (160-bit) random secrets (RFC 4226 §6 recommended)
 * - HMAC-SHA1 truncated to 6 digits (RFC 4226 §5.3)
 * - 30-second time step (RFC 6238 §5.1)
 * - Configurable drift window (±1 step default)
 */

import { bytesToHex } from '@noble/hashes/utils';

// ─── Constants ────────────────────────────────────────────────

/** RFC 4648 Base32 alphabet (no padding characters used internally). */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Time step in seconds (RFC 6238 §5.1 — 30s is standard). */
const TIME_STEP = 30;

/** Default verification window (±1 step allows 30s clock drift). */
const DEFAULT_WINDOW = 1;

/** Number of OTP digits (RFC 4226 §5.3 — 6 digits is standard). */
const OTP_DIGITS = 6;

/** Mask for dynamic truncation (RFC 4226 §5.3). */
const DYNAMIC_TRUNCATION_MASK = 0x7f;

/** Offset mask to extract the low 4 bits of the last hash byte. */
const OFFSET_MASK = 0x0f;

// ─── Exports ──────────────────────────────────────────────────

export type TOTPSecret = {}
