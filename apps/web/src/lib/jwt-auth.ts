/**
 * DegenFeed JWT Authentication — validates tokens issued by DegenFeed itself.
 *
 * DegenFeed is a self-contained social product. It does NOT trust tokens
 * issued by rmi-backend; instead it issues and validates its OWN JWTs using a
 * private HMAC secret (`DF_JWT_SECRET`, falling back to `AUTH_SECRET`). No
 * JWKS fetch, no external issuer, no network calls — validation is fully
 * offline and edge-compatible (Web Crypto / HMAC-SHA256).
 *
 * Configuration (env vars):
 *   - DF_JWT_SECRET: HMAC secret used to sign/verify degenfeed JWTs.
 *                    Falls back to AUTH_SECRET (the wallet-session secret).
 *   - DF_JWT_TTL_SECONDS: token lifetime for signing (default 3600).
 *   - DF_JWT_ISSUER: issuer claim (default "degenfeed").
 *
 * Usage:
 *   import { verifyDfJwt, signDfJwt, extractJwtFromRequest } from '@/lib/jwt-auth';
 *
 *   const token  = await signDfJwt({ sub, address, displayName }, secret); // issue
 *   const claims = await verifyDfJwt(token);                               // validate
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface DfJwtClaims {
  /** Subject — degenfeed user id / wallet address (sub claim). */
  sub: string;
  /** Canonical wallet address (lowercased). */
  address: string;
  /** Optional display name. */
  displayName?: string;
  /** Subscription tier: FREE, PRO, PLATINUM. */
  tier: string;
  /** User role: USER, ADMIN, MODERATOR. */
  role: string;
  /** Optional wallet address alias. */
  wallet?: string | null;
  /** Expiry, unix seconds (exp claim). */
  exp: number;
  /** Issued-at, unix seconds (iat claim). */
  iat: number;
  /** Issuer identifier (iss claim). */
  iss?: string;
}

// ── Configuration ────────────────────────────────────────────────────────
// No external issuer is consulted. A missing secret means DegenFeed cannot
// validate tokens AND never tries to — it fail-closed to `null`.

const DF_JWT_SECRET = process.env.DF_JWT_SECRET ?? process.env.AUTH_SECRET ?? '';
const DF_JWT_TTL_SECONDS = Number(process.env.DF_JWT_TTL_SECONDS ?? '3600') || 3600;
const DF_JWT_ISSUER = process.env.DF_JWT_ISSUER ?? 'degenfeed';

// ── base64url helpers (edge-safe) ────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function encodeJsonB64Url(obj: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

function decodeJsonB64Url<T>(b64: string): T | null {
  try {
    const bytes = base64UrlToBytes(b64);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

// ── Key import (HMAC-SHA256) ─────────────────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

// ── Signing / issuance ───────────────────────────────────────────────────

/**
 * Issue a DegenFeed JWT signed with HS256 using DegenFeed's own secret.
 * Intended for internal product flows that need a short-lived DegenFeed token
 * (e.g. an API access token). Never signs anything meant for rmi-backend.
 */
export async function signDfJwt(
  payload: Pick<DfJwtClaims, 'sub' | 'address'> &
    Partial<Omit<DfJwtClaims, 'sub' | 'address' | 'exp' | 'iat'>> & { expiresInSeconds?: number },
  secret?: string,
): Promise<string> {
  const key = secret ?? DF_JWT_SECRET;
  if (!key) throw new Error('[jwt-auth] No DF_JWT_SECRET configured; cannot sign token');
  const now = Math.floor(Date.now() / 1000);
  const ttl = payload.expiresInSeconds ?? DF_JWT_TTL_SECONDS;
  const claims: DfJwtClaims = {
    sub: payload.sub,
    address: payload.address.toLowerCase(),
    displayName: payload.displayName,
    tier: payload.tier ?? 'FREE',
    role: payload.role ?? 'USER',
    wallet: payload.wallet ?? null,
    iat: now,
    exp: now + ttl,
    iss: DF_JWT_ISSUER,
  };
  const headerPart = encodeJsonB64Url({ alg: 'HS256', typ: 'JWT' });
  const payloadPart = encodeJsonB64Url(claims);
  const data = `${headerPart}.${payloadPart}`;
  const sig = await crypto.subtle.sign(
    'HMAC',
    await importHmacKey(key),
    new TextEncoder().encode(data),
  );
  const sigPart = bytesToBase64Url(new Uint8Array(sig));
  return `${data}.${sigPart}`;
}

// ── Verification ─────────────────────────────────────────────────────────

/**
 * Verify a DegenFeed JWT signature. Fail-closed and fully offline:
 *   - non-3-segment token → null
 *   - no configured secret (DF_JWT_SECRET / AUTH_SECRET) → null
 *   - wrong alg, bad signature, malformed payload → null
 *   - expired / wrong issuer → null
 *
 * @param token - Raw JWT string (without 'Bearer ' prefix).
 * @returns DegenFeed claims if valid, null otherwise.
 */
export async function verifyDfJwt(token: string): Promise<DfJwtClaims | null> {
  if (!token || token.split('.').length !== 3) return null;
  const secret = DF_JWT_SECRET;
  if (!secret) return null; // fail-closed: never trust a token without a secret

  const [headerPart, payloadPart, sigPart] = token.split('.');
  if (!headerPart || !payloadPart || !sigPart) return null;

  const header = decodeJsonB64Url<{ alg?: string; typ?: string }>(headerPart);
  if (!header || header.alg !== 'HS256') return null;

  const data = `${headerPart}.${payloadPart}`;
  const signature = base64UrlToBytes(sigPart);
  const valid = await crypto.subtle.verify(
    'HMAC',
    await importHmacKey(secret),
    signature as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(data),
  );
  if (!valid) return null;

  const claims = decodeJsonB64Url<Partial<DfJwtClaims>>(payloadPart);
  if (!claims) return null;

  if (typeof claims.sub !== 'string' || typeof claims.address !== 'string') return null;
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
  if (claims.iss && claims.iss !== DF_JWT_ISSUER) return null;

  return {
    sub: claims.sub,
    address: claims.address,
    displayName: claims.displayName,
    tier: claims.tier ?? 'FREE',
    role: claims.role ?? 'USER',
    wallet: claims.wallet ?? null,
    exp: claims.exp ?? 0,
    iat: claims.iat ?? 0,
    iss: claims.iss,
  };
}

/**
 * Extract a DegenFeed JWT from request headers or cookies.
 * Checks `Authorization: Bearer` header first, then `df_token` cookie.
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

  // 2. Check df_token cookie
  const cookie = req.headers.get('cookie');
  if (cookie) {
    for (const part of cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (name === 'df_token' && value) {
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
