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

export interface TOTPSecret {
  base32: string;
  hex: string;
}

export interface TOTPOptions {
  window?: number;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Generate a new TOTP secret: 20 cryptographically random bytes
 * encoded as Base32 and hex. The Base32 form is what users scan
 * or type into their authenticator app.
 */
export function generateTOTPSecret(): TOTPSecret {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return {
    base32: bytesToBase32(bytes),
    hex: bytesToHex(bytes),
  };
}

/**
 * Build an `otpauth://` URL for QR code generation.
 * This is the standard URI format consumed by all authenticator apps.
 * (Google Authenticator, Authy, 1Password, Bitwarden, etc.)
 *
 * @param base32Secret - Base32-encoded secret from generateTOTPSecret()
 * @param label - User identifier (e.g. wallet address truncated)
 * @param issuer - Service name displayed in the authenticator app
 */
export function buildOtpauthUrl(base32Secret: string, label: string, issuer = 'DegenFeed'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(label);
  return (
    `otpauth://totp/${encodedIssuer}:${encodedLabel}` +
    `?secret=${base32Secret}` +
    `&issuer=${encodedIssuer}` +
    `&algorithm=SHA1` +
    `&digits=${OTP_DIGITS}` +
    `&period=${TIME_STEP}`
  );
}

/**
 * Verify a user-provided TOTP code against the stored secret.
 * Checks the current time step plus `window` adjacent steps
 * to allow for minor clock drift between client and server.
 *
 * Default window of 1 means: [current - 1, current, current + 1]
 * for 3 total checks (covers ±30s drift).
 */
export async function verifyTOTP(
  secret: string,
  code: string,
  opts?: TOTPOptions,
): Promise<boolean> {
  const window = opts?.window ?? DEFAULT_WINDOW;
  const now = Math.floor(Date.now() / 1000 / TIME_STEP);

  // Check the current window and ±window adjacent windows
  for (let i = -window; i <= window; i++) {
    const generated = await generateTOTP(secret, now + i);
    if (generated === code) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a TOTP code for a given secret and time counter.
 * Implements RFC 4226 §5.3 (HOTP) with a time-based counter.
 *
 * Steps:
 *   1. Decode Base32 secret to bytes
 *   2. Encode counter as 8-byte big-endian
 *   3. HMAC-SHA1(key=secret, msg=counter)
 *   4. Dynamic truncation → 4 bytes → 31-bit integer → mod 10^6
 */
export async function generateTOTP(secret: string, counter: number): Promise<string> {
  const key = base32ToBytes(secret);

  // Step 2: counter → 8-byte big-endian
  const counterBuf = new ArrayBuffer(8);
  const counterView = new DataView(counterBuf);
  counterView.setBigUint64(0, BigInt(counter), false);

  // Step 3: HMAC-SHA1
  const hmac = await hmacSha1(key, new Uint8Array(counterBuf));

  // Step 4: Dynamic truncation (RFC 4226 §5.3)
  const lastByte = hmac[hmac.length - 1];
  if (lastByte === undefined) {
    throw new Error('TOTP: empty HMAC output');
  }
  const offset = lastByte & OFFSET_MASK;
  const b0 = hmac[offset];
  const b1 = hmac[offset + 1];
  const b2 = hmac[offset + 2];
  const b3 = hmac[offset + 3];
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    throw new Error('TOTP: offset out of bounds');
  }
  const binaryCode =
    ((b0 & DYNAMIC_TRUNCATION_MASK) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff);

  const otp = binaryCode % 10 ** OTP_DIGITS;
  return otp.toString().padStart(OTP_DIGITS, '0');
}

/**
 * Generate the expected TOTP code for the current time window.
 * Useful for debugging and testing.
 */
export async function getCurrentTOTP(secret: string): Promise<string> {
  const counter = Math.floor(Date.now() / 1000 / TIME_STEP);
  return generateTOTP(secret, counter);
}

// ─── HMAC-SHA1 (Web Crypto) ──────────────────────────────────

/**
 * Compute HMAC-SHA1 using the Web Crypto API.
 * This is the core cryptographic operation of both HOTP and TOTP.
 *
 * Returns a 20-byte (160-bit) SHA-1 digest synchronizing with
 * the session.ts pattern of `await crypto.subtle.sign(...)`.
 */
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data as BufferSource);
  return new Uint8Array(signature);
}

// ─── Base32 encoding / decoding (RFC 4648) ────────────────────

/**
 * Encode bytes as RFC 4648 Base32 (uppercase, no padding).
 * Standard format used by all TOTP authenticator apps.
 */
export function bytesToBase32(bytes: Uint8Array): string {
  let result = '';
  let bits = 0;
  let bitLen = 0;

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitLen += 8;

    while (bitLen >= 5) {
      bitLen -= 5;
      result += BASE32_ALPHABET[(bits >> bitLen) & 0x1f];
    }
  }

  // Emit remaining bits with zero-padding
  if (bitLen > 0) {
    result += BASE32_ALPHABET[(bits << (5 - bitLen)) & 0x1f];
  }

  return result;
}

/**
 * Decode RFC 4648 Base32 string to bytes.
 * Handles both padded and unpadded input, and is case-insensitive.
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];

  let bits = 0;
  let bitLen = 0;

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue; // skip invalid chars

    bits = (bits << 5) | idx;
    bitLen += 5;

    if (bitLen >= 8) {
      bitLen -= 8;
      bytes.push((bits >> bitLen) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

// ─── Validation helpers ───────────────────────────────────────

/**
 * Basic sanity check for a TOTP code string.
 * Must be exactly 6 decimal digits.
 */
export function isValidTOTPCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Basic sanity check for a recovery code format (XXXX-XXXX-XXXX).
 */
export function isValidRecoveryCodeFormat(code: string): boolean {
  return /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/i.test(code);
}
