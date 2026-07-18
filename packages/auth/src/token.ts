/**
 * @degenfeed/auth — JWT session token verification
 *
 * Verifies HMAC-SHA256 signed JWTs using Web Crypto API.
 * Compatible with both Edge and Node.js runtimes.
 * No external dependencies required.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface TokenPayload {
  walletAddress: string;
  exp?: number;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  return atob(pad ? base64 + '='.repeat(4 - pad) : base64);
}

// ─── Signing key ───────────────────────────────────────────────────────────

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

// Bundler-provided global (Next.js, Vite, etc.)
declare const process: { env: Record<string, string | undefined> };

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Verify an HMAC-SHA256 signed JWT session token.
 *
 * Expects `SESSION_SECRET` env var to be set on the server.
 * Returns the decoded payload with `walletAddress` on success, or `null` on
 * any verification failure (invalid signature, expired, malformed).
 *
 * @example
 * ```ts
 * const payload = await verifyToken(sessionCookie);
 * if (payload?.walletAddress) {
 *   // authenticated
 * }
 * ```
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      console.error('[auth] SESSION_SECRET environment variable is not set');
      return null;
    }

    // Verify HMAC-SHA256 signature
    const key = await getHmacKey(secret);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const sigRaw = Uint8Array.from(
      base64UrlDecode(signatureB64),
      c => c.charCodeAt(0),
    );

    const isValid = await crypto.subtle.verify('HMAC', key, sigRaw, data);
    if (!isValid) return null;

    // Decode payload
    const payloadStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr) as TokenPayload;

    // Check expiry
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
