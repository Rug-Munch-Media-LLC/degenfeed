/**
 * DegenFeed middleware — rate limiting + auth + CORS for /api/* routes.
 *
 * Enforcement order:
 *   1. Rate limit (all /api/*) — return 429 before any further processing
 *   2. CORS preflight (OPTIONS) — 204 with CORS headers
 *   3. Public paths (/api/auth, /api/health, /api/status) — pass through
 *   4. GET — pass through (read-only)
 *   5. Verify session for POST/PUT/PATCH/DELETE
 *   6. Admin wallet check for /api/admin/*
 *
 * Rate-limit tiers (first match wins):
 *   - POST /api/auth/*         →  5 req / 60 s
 *   - POST /api/tip/create     → 10 req / 60 s
 *   - POST /api/publish        → 20 req / 60 s
 *   - POST /api/admin/*        → 20 req / 60 s
 *   - POST / PUT / DELETE      → 30 req / 60 s
 *   - All other /api/*         → 100 req / 60 s
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  adminLimiter,
  authLimiter,
  globalLimiter,
  publishLimiter,
  type RateLimitResult,
  type TokenBucket,
  tipLimiter,
  writeLimiter,
} from '@/lib/rate-limit';

// ── Matcher: all /api/* routes ─────────────────────────────────────────────

export const config = {
  matcher: ['/api/:path*'],
};

// ── Rate-limit helpers ────────────────────────────────────────────────────

/**
 * Best-effort client IP extraction.  Cloudflare sets `cf-connecting-ip` when
 * proxied; otherwise falls through x-forwarded-for → x-real-ip → localhost.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

/**
 * Pick the appropriate rate-limiter for the request method + path.
 * Order matches the priority chain documented above.
 */
function pickLimiter(
  method: string,
  pathname: string,
): { limiter: TokenBucket; limit: number } | null {
  // Auth — tightest limit, brute-force protection
  if (pathname.startsWith('/api/auth/') && method === 'POST') {
    return { limiter: authLimiter, limit: 5 };
  }

  // POST /api/tip/create — financial endpoint
  if (method === 'POST' && pathname === '/api/tip/create') {
    return { limiter: tipLimiter, limit: 10 };
  }

  // POST /api/publish — content publication
  if (method === 'POST' && pathname === '/api/publish') {
    return { limiter: publishLimiter, limit: 20 };
  }

  // POST /api/admin/* — admin mutating actions
  if (method === 'POST' && pathname.startsWith('/api/admin/')) {
    return { limiter: adminLimiter, limit: 20 };
  }

  // Write methods — POST / PUT / DELETE
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return { limiter: writeLimiter, limit: 30 };
  }

  // Global default — all remaining /api/* (including GET)
  return { limiter: globalLimiter, limit: 100 };
}

function setRateLimitHeaders(headers: Headers, limit: number, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetTime));
}

// ── Auth constants ─────────────────────────────────────────────────────────

const COOKIE_NAME = '__Host-dfid';
const AUTH_TOKEN_PREFIX = 'Bearer ';

/** Public routes that skip auth entirely. */
const SKIP_PATHS = ['/api/auth', '/api/health', '/api/status'];

/** State-mutating HTTP methods that require auth. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ── Session payload shape (mirrors workers/api/src/session.ts) ────────────

interface SessionPayload {
  address: string;
  chain: 'ethereum' | 'solana';
  exp: number;
  nonce: string;
}

// ── Inline hex helpers (no external deps — edge-safe) ───────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ── HMAC key import (mirrors workers/api/src/session.ts) ────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  const keyBytes =
    /^[0-9a-fA-F]+$/.test(secret) && secret.length >= 64
      ? hexToBytes(secret)
      : new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    keyBytes as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

// ── Session verification (mirrors workers/api/src/session.ts) ───────────

async function verifySessionCookie(value: string, secret: string): Promise<SessionPayload | null> {
  const [data, signature] = value.split('.');
  if (!data || !signature) return null;

  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(signature) as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(data),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(atob(data)) as SessionPayload;
    if (
      typeof payload.address !== 'string' ||
      (payload.chain !== 'ethereum' && payload.chain !== 'solana') ||
      typeof payload.exp !== 'number' ||
      typeof payload.nonce !== 'string'
    ) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

// ── CORS helpers ────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://degenfeed.xyz',
  'https://www.degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const validOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://degenfeed.xyz';

  return {
    'Access-Control-Allow-Origin': validOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

function applyHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ── Route helpers ───────────────────────────────────────────────────────

function isSkipPath(pathname: string): boolean {
  return SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/api/admin/');
}

// ── Error responses ───────────────────────────────────────────────────

function unauthorizedResponse(corsHeaders: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', code: 'DF-401' },
    { status: 401, headers: corsHeaders },
  );
}

function forbiddenResponse(corsHeaders: Record<string, string>): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden', code: 'DF-403' },
    { status: 403, headers: corsHeaders },
  );
}

// ── Middleware ──────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const { method } = request;
  const ip = getClientIp(request);
  const corsHeaders = getCorsHeaders(request);

  // ── Step 1: Rate limiting (applies to ALL /api/* before anything else) ──
  const picked = pickLimiter(method, pathname);
  let rateLimitMeta: { limit: number; result: RateLimitResult } | null = null;

  if (picked) {
    const { limiter, limit } = picked;
    const result = limiter.check(ip);
    rateLimitMeta = { limit, result };

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil(result.resetTime - Date.now() / 1000));
      const response = NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
      setRateLimitHeaders(response.headers, limit, result);
      return response;
    }
  }

  // Helper: stamp rate-limit headers onto any outgoing response
  const stamp = (response: NextResponse): NextResponse => {
    if (rateLimitMeta) {
      setRateLimitHeaders(response.headers, rateLimitMeta.limit, rateLimitMeta.result);
    }
    return response;
  };

  // ── Step 2: CORS preflight ────────────────────────────────────
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // ── Step 3: Public paths pass through ──────────────────────────
  if (isSkipPath(pathname)) {
    return stamp(applyHeaders(NextResponse.next(), corsHeaders));
  }

  // ── Step 4: GET requests are public (read-only) ────────────────
  if (!MUTATING_METHODS.has(method)) {
    return stamp(applyHeaders(NextResponse.next(), corsHeaders));
  }

  // ── Step 5: Session verification for mutating methods ──────────
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('[middleware] AUTH_SECRET environment variable is not set');
    return stamp(unauthorizedResponse(corsHeaders));
  }

  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');

  let payload: SessionPayload | null = null;

  // Try Authorization: Bearer <token>
  if (authHeader?.startsWith(AUTH_TOKEN_PREFIX)) {
    const token = authHeader.slice(AUTH_TOKEN_PREFIX.length).trim();
    if (token) {
      payload = await verifySessionCookie(token, secret);
    }
  }

  // Fall back to session cookie
  if (!payload) {
    const cookieValue = parseSessionCookie(cookieHeader);
    if (cookieValue) {
      payload = await verifySessionCookie(cookieValue, secret);
    }
  }

  if (!payload) {
    return stamp(unauthorizedResponse(corsHeaders));
  }

  // ── Step 6: Admin route check ──────────────────────────────────
  if (isAdminPath(pathname)) {
    const adminWallets = process.env.ADMIN_WALLETS ?? '';
    if (!adminWallets) {
      return stamp(forbiddenResponse(corsHeaders));
    }
    const admins = adminWallets.split(',').map((a) => a.trim().toLowerCase());
    if (!admins.includes(payload.address.toLowerCase())) {
      return stamp(forbiddenResponse(corsHeaders));
    }
  }

  // ── Step 7: Proceed ────────────────────────────────────────────
  return stamp(applyHeaders(NextResponse.next(), corsHeaders));
}
