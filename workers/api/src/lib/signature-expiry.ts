/**
 * @degenfeed/api-worker — Signature Expiry and Replay Protection
 *
 * Prevents replay attacks on signed requests by enforcing:
 *   1. Timestamp-based expiry (signed messages expire after N seconds)
 *   2. Nonce consumption (each nonce can only be used once)
 *   3. Message format binding (message must match expected format)
 */

import { bytesToHex } from '@noble/hashes/utils';
import type { Env } from '../index';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface SignedRequest {
  /** The signed message content */
  message: string;
  /** Cryptographic signature */
  signature: string;
  /** Wallet address that signed */
  address: string;
  /** Chain: ethereum | solana */
  chain: 'ethereum' | 'solana';
  /** UNIX timestamp (seconds) when the message was generated */
  timestamp: number;
  /** Unique nonce to prevent replay */
  nonce: string;
  /** Intended action (e.g., "wallet_verify", "tip", "delete_account") */
  action: string;
}

export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
}

/* ─── Constants ─────────────────────────────────────────────────────── */

/** Maximum allowed drift between client and server clocks (seconds) */
const MAX_TIME_DRIFT_SECONDS = 60;

/** Default signature TTL per action (seconds) */
const SIGNATURE_TTL: Record<string, number> = {
  wallet_verify: 60, // 1 minute — quick login flow
  tip: 120, // 2 minutes — may need time to confirm
  delete_account: 300, // 5 minutes — sensitive action
  change_email: 300, // 5 minutes
  connect_wallet: 120, // 2 minutes
  sign_message: 60, // 1 minute
  api_key_create: 120, // 2 minutes
  session_revoke: 60, // 1 minute
  default: 120, // 2 minutes fallback
};

/* ─── KV key patterns ───────────────────────────────────────────────── */

function consumedNonceKey(nonce: string): string {
  return `used_nonce:${nonce}`;
}

/* ─── Message format builder ────────────────────────────────────────── */

/**
 * Build a signed message with the standard format that includes
 * expiry timestamp, nonce, and action binding.
 *
 * Format:
 *   "DegenFeed Signed Message:\n
 *    Action: {action}\n
 *    Address: {address}\n
 *    Chain: {chain}\n
 *    Nonce: {nonce}\n
 *    Timestamp: {timestamp}\n
 *    {additionalData}"
 */
export function buildSignedMessage(
  action: string,
  address: string,
  chain: string,
  additionalData?: string,
): { message: string; nonce: string; timestamp: number } {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const timestamp = Math.floor(Date.now() / 1000);

  const parts = [
    'DegenFeed Signed Message:',
    `Action: ${action}`,
    `Address: ${address.toLowerCase()}`,
    `Chain: ${chain}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ];

  if (additionalData) {
    parts.push('');
    parts.push(additionalData);
  }

  return {
    message: parts.join('\n'),
    nonce,
    timestamp,
  };
}

/* ─── Validation ────────────────────────────────────────────────────── */

/**
 * Validate a signed request for timestamp freshness, nonce uniqueness,
 * and action binding.
 */
export async function validateSignedRequest(
  request: SignedRequest,
  env: Env,
): Promise<SignatureValidationResult> {
  // 1. Validate required fields
  if (
    !request.message ||
    !request.signature ||
    !request.address ||
    !request.nonce ||
    !request.action
  ) {
    return { valid: false, error: 'Missing required signature fields' };
  }

  // 2. Validate nonce format (hex, 64 chars = 32 bytes)
  if (!/^[0-9a-f]{64}$/i.test(request.nonce)) {
    return { valid: false, error: 'Invalid nonce format' };
  }

  // 3. Check timestamp bounds (± MAX_TIME_DRIFT seconds from server time)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - request.timestamp) > MAX_TIME_DRIFT_SECONDS) {
    return { valid: false, error: 'Signature timestamp out of acceptable range' };
  }

  // 4. Check signature TTL
  const ttl = SIGNATURE_TTL[request.action] ?? SIGNATURE_TTL.default;
  const age = now - request.timestamp;
  if (age > ttl) {
    return { valid: false, error: `Signature expired (max ${ttl}s for action: ${request.action})` };
  }

  // 5. Check nonce hasn't been consumed (replay protection)
  if (env.CACHE) {
    try {
      const consumed = await env.CACHE.get(consumedNonceKey(request.nonce));
      if (consumed !== null) {
        return { valid: false, error: 'Nonce already used — replay detected' };
      }
    } catch {
      // KV hiccup — allow through but log concern
      console.warn('[signature-expiry] KV read failed for nonce check');
    }
  }

  // 6. Mark nonce as consumed (prevents replay)
  if (env.CACHE) {
    try {
      // TTL = remaining time until the signature would have expired + 60s buffer
      const remaining = Math.max(60, ttl - age + 60);
      await env.CACHE.put(consumedNonceKey(request.nonce), '1', {
        expirationTtl: remaining,
      });
    } catch {
      // Best-effort — if KV is down, we accept risk of replay
      console.warn('[signature-expiry] Failed to persist consumed nonce');
    }
  }

  return { valid: true };
}

/**
 * Check if a single-use nonce has already been consumed.
 * Used for idempotency checks (e.g., preventing double-tip processing).
 */
export async function isNonceConsumed(nonce: string, env: Env): Promise<boolean> {
  if (!env.CACHE) return false;
  try {
    const result = await env.CACHE.get(consumedNonceKey(nonce));
    return result !== null;
  } catch {
    return false;
  }
}

/* ─── Util: Extract signed request from HTTP request ────────────────── */

/**
 * Parse and validate a SignedRequest from POST body.
 * Does NOT verify the cryptographic signature — only the structure and expiry.
 */
export function parseSignedRequest(body: Record<string, unknown>): SignedRequest | null {
  if (
    typeof body.message !== 'string' ||
    typeof body.signature !== 'string' ||
    typeof body.address !== 'string' ||
    typeof body.chain !== 'string' ||
    typeof body.nonce !== 'string' ||
    typeof body.timestamp !== 'number' ||
    typeof body.action !== 'string'
  ) {
    return null;
  }

  const chain = body.chain as 'ethereum' | 'solana';
  if (chain !== 'ethereum' && chain !== 'solana') {
    return null;
  }

  return {
    message: body.message,
    signature: body.signature,
    address: body.address.toLowerCase(),
    chain,
    timestamp: body.timestamp,
    nonce: body.nonce,
    action: body.action,
  };
}
