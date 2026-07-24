/**
 * JWT Authentication — validates tokens issued by rmi-backend.
 *
 * Uses Web Crypto API (edge-compatible) to verify RS256 JWTs.
 * Supports both the existing wallet-based HMAC sessions AND JWT from rmi-backend.
 *
 * Configuration (env vars):
 *   - NEXT_PUBLIC_RMI_JWKS_URL: JWKS endpoint URL (default: https://rugmunch.io/.well-known/jwks.json)
 *   - RMI_JWT_PUBLIC_KEY: RSA public key PEM (optional, for offline validation)
 *   - RMI_JWT_ALGORITHM: "RS256" (default) or "HS256"
 *   - RMI_JWT_SECRET: HMAC secret (only for HS256 mode)
 *
 * Usage:
 *   import { verifyRmiJwt, extractJwtFromRequest } from '@/lib/jwt-auth';
 *
 *   const claims = await verifyRmiJwt(token);
 *   if (claims) {
 *     // Authenticated as rmi-backend user
 *     console.log(claims.email, claims.tier);
 *   }
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface JwtClaims {
  /** User ID (sub claim) */
  id: string;
  /** Email address */
  email: string;
  /** Subscription tier: FREE, PRO, ENTERPRISE */
  tier: string;
  /** User role: USER, ADMIN, MODERATOR */
  role: string;
  /** Optional wallet address */
  wallet: string | null;
}

interface JwksResponse {
  keys?: Array<{ kid?: string; kty?: string; n?: string; e?: string }>;
  pem?: string;
}

// ── Configuration ────────────────────────────────────────────────────────

const JWKS_URL =
  process.env.NEXT_PUBLIC_RMI_JWKS_URL ?? 'https://rugmunch.io/.well-known/jwks.json';

const RMI_JWT_ALGORITHM = (process.env.RMI_JWT_ALGORITHM ?? 'RS256') as 'RS256' | 'HS256';
const RMI_JWT_SECRET = process.env.RMI_JWT_SECRET ?? '';
const RMI_JWT_PUBLIC_KEY = process.env.RMI_JWT_PUBLIC_KEY ?? '';

// ── Cache ────────────────────────────────────────────────────────────────

interface CacheEntry {
  key: CryptoKey | null;
  fetchedAt: number;
}

let keyCache: CacheEntry = { key: null, fetchedAt: 0 };
const CACHE_TTL_MS = 3_600_000; // 1 hour

// ── PEM parsing (edge-safe) ──────────────────────────────────────────────

/**
 * Import an RSA public key from PEM format for RS256 verification.
 */
async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and decode base64
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Import an HMAC key for HS256 verification.
 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
}

// ── JWKS fetching ────────────────────────────────────────────────────────

async function fetchPublicKey(): Promise<CryptoKey | null> {
  const now = Date.now();

  // Check cache
  if (keyCache.key && now - keyCache.fetchedAt < CACHE_TTL_MS) {
    return keyCache.key;
  }

  // Try direct PEM env var first (fast path)
  if (RMI_JWT_PUBLIC_KEY) {
    try {
      const key = await importRsaPublicKey(RMI_JWT_PUBLIC_KEY);
      keyCache = { key, fetchedAt: now };
      return key;
    } catch (err) {
      console.error('[jwt-auth] Failed to import RSA key from env:', err);
    }
  }

  // HS256 mode
  if (RMI_JWT_ALGORITHM === 'HS256' && RMI_JWT_SECRET) {
    try {
      const key = await importHmacKey(RMI_JWT_SECRET);
      keyCache = { key, fetchedAt: now };
      return key;
    } catch (err) {
      console.error('[jwt-auth] Failed to import HMAC key:', err);
    }
  }

  // Fetch from JWKS endpoint
  try {
    const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`JWKS endpoint returned ${response.status}`);
    }
    const data = (await response.json()) as JwksResponse;

    // Try PEM field first (our fallback format)
    if (data.pem) {
      const key = await importRsaPublicKey(data.pem);
      keyCache = { key, fetchedAt: now };
      return key;
    }
  } catch (err) {
    console.error('[jwt-auth] Failed to fetch JWKS:', err);
  }

  return null;
}

// ── JWT decoding (no external deps — edge-safe) ──────────────────────────

/**
 * Decode a JWT's payload without verification (header inspection only).
 * Uses base64url decode safe for edge runtimes.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Verify an RS256 JWT signature using Web Crypto API.
 */
async function verifyRs256(token: string, key: CryptoKey): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sigPart = parts[2];
    if (!sigPart) return false;
    const signature = Uint8Array.from(atob(sigPart.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );

    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  } catch {
    return false;
  }
}

/**
 * Verify an HS256 JWT signature using Web Crypto API.
 */
async function verifyHs256(token: string, key: CryptoKey): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sigPart = parts[2];
    if (!sigPart) return false;
    const signature = Uint8Array.from(atob(sigPart.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
      c.charCodeAt(0),
    );

    return crypto.subtle.verify('HMAC', key, signature, data);
  } catch {
    return false;
  }
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Verify a JWT issued by rmi-backend.
 *
 * @param token - Raw JWT string (without 'Bearer ' prefix).
 * @returns User claims if valid, null otherwise.
 */
export async function verifyRmiJwt(token: string): Promise<JwtClaims | null> {
  if (token?.split('.').length !== 3) {
    return null;
  }

  // Decode payload first to check expiration
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Check expiration
  const exp = payload.exp as number | undefined;
  if (exp && exp * 1000 < Date.now()) {
    return null; // Expired
  }

  // Get verification key
  const key = await fetchPublicKey();
  if (!key) return null;

  // Verify signature
  let valid = false;
  if (RMI_JWT_ALGORITHM === 'HS256') {
    valid = await verifyHs256(token, key);
  } else {
    valid = await verifyRs256(token, key);
  }
  if (!valid) return null;

  // Return typed claims
  return {
    id: String(payload.sub ?? ''),
    email: String(payload.email ?? ''),
    tier: String(payload.tier ?? 'FREE'),
    role: String(payload.role ?? 'USER'),
    wallet: payload.wallet ? String(payload.wallet) : null,
  };
}

/**
 * Extract JWT from request headers or cookies.
 * Checks ``Authorization: Bearer`` header first, then ``rmi_token`` cookie.
 *
 * @returns The raw JWT string, or null if not found.
 */
export function extractJwtFromRequest(req: {
  headers: { get(name: string): string | null };
}): string | null {
  // 1. Check Authorization header
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token && token.split('.').length === 3) {
      return token;
    }
  }

  // 2. Check rmi_token cookie
  const cookie = req.headers.get('cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (name === 'rmi_token' && value) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Check if a token looks like a JWT (3 dot-separated segments).
 */
export function isJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}
