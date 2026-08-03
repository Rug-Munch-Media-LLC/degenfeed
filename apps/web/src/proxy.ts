/**
 * DegenFeed proxy (Next.js 16) — security headers, CSP with nonces, rate
 * limiting, auth, CORS, and host-aware root routing.
 *
 * Runs on ALL routes except static assets. Security headers (CSP, HSTS, etc.)
 * are applied to every response. API-specific logic (rate limiting, auth, CORS)
 * runs only for /api/* paths.
 *
 * Host-aware routing:
 *   - `app.degenfeed.xyz` (and other app.* subdomains) serve the feed at `/`
 *     via a rewrite to `/feed`, so the app subdomain behaves like a Twitter
 *     clone instead of showing the marketing landing page.
 *   - `degenfeed.xyz` keeps the landing page at `/`.
 *
 * CSP strategy:
 *   - Per-request nonce for inline scripts/styles (no unsafe-inline)
 *   - strict-dynamic for trusted script loading chains
 *   - No unsafe-eval (blocks eval(), setTimeout('string'), etc.)
 *   - Nonce passed via x-csp-nonce request header for RSC consumption
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
import { extractJwtFromRequest, isJwt, type JwtClaims, verifyRmiJwt } from '@/lib/jwt-auth';
import {
  adminLimiter,
  authLimiter,
  getClientIpFromHeaders,
  globalLimiter,
  publishLimiter,
  type RateLimitResult,
  type TokenBucket,
  tipLimiter,
  writeLimiter,
} from '@/lib/rate-limit';

// == Matcher: all routes except static assets ==============================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icon\\.svg|og-image\\.png|robots\\.txt).*)',
  ],
};

// == CSP builder ===========================================================

function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

// == Security headers ======================================================

function setSecurityHeaders(headers: Headers, csp: string): void {
  headers.set('Content-Security-Policy', csp);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// == Rate-limit helpers ====================================================

const COOKIE_NAME = '__Host-dfid';
const AUTH_TOKEN_PREFIX = 'Bearer ';

/** Public routes that skip auth entirely. */
const SKIP_PATHS = ['/api/auth', '/api/health', '/api/status'];

/** State-mutating HTTP methods that require auth. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const ALLOWED_ORIGINS = [
  'https://degenfeed.xyz',
  'https://www.degenfeed.xyz',
  'https://app.degenfeed.xyz',
  'https://social.degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:3001',
];

// == Helpers ==============================================================

/**
 * Trustworthy client IP extraction — delegates to
 * `getClientIpFromHeaders` in `@/lib/rate-limit` (single source of truth).
 *
 * SECURITY (CVSS 8.6 rate-limit bypass): Cloudflare's `cf-connecting-ip`
 * wins when present and XFF is ignored entirely. On direct origin access the
 * RIGHTMOST `x-forwarded-for` entry is used — the one appended by our own
 * nginx `$proxy_add_x_forwarded_for` — never the leftmost, which is fully
 * attacker-controlled (`X-Forwarded-For: <spoof>, <real-ip>`).
 */
function getClientIp(request: NextRequest): string {
  return getClientIpFromHeaders(request.headers);
}

/**
 * Pick the appropriate rate-limiter for the request method + path.
 * Order matches the priority chain documented above.
 */
function pickLimiter(
  method: string,
  pathname: string,
): { limiter: TokenBucket; limit: number } | null {
  if (pathname.startsWith('/api/auth/') && method === 'POST') {
    return { limiter: authLimiter, limit: 5 };
  }
  if (method === 'POST' && pathname === '/api/tip/create') {
    return { limiter: tipLimiter, limit: 10 };
  }
  if (method === 'POST' && pathname === '/api/publish') {
    return { limiter: publishLimiter, limit: 20 };
  }
  if (method === 'POST' && pathname.startsWith('/api/admin/')) {
    return { limiter: adminLimiter, limit: 20 };
  }
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return { limiter: writeLimiter, limit: 30 };
  }
  return { limiter: globalLimiter, limit: 100 };
}

function setRateLimitHeaders(headers: Headers, limit: number, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetTime));
}

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

function isSkipPath(pathname: string): boolean {
  return SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/api/admin/');
}

// == Error responses ======================================================

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

// == Auth helpers =========================================================

interface SessionPayload {
  address: string;
  chain: 'ethereum' | 'solana';
  exp: number;
  nonce: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

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

// == ====================================================================
// == Proxy (Next.js 16 replacement for middleware) ======================
// == ====================================================================

const APP_SUBDOMAIN_PREFIXES = ['app.', 'm.', 'beta.'];

/** Does this hostname belong to the app subdomain (feed-first) family? */
function isAppHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return APP_SUBDOMAIN_PREFIXES.some(
    (prefix) => lower === prefix.slice(0, -1) || lower.startsWith(prefix),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // ── 0. Host-aware root routing: app.* subdomains serve the feed ──
  // The marketing landing page lives at degenfeed.xyz/. The app subdomain
  // (app.degenfeed.xyz) should behave like a Twitter clone, so rewrite its
  // root to the main feed. Localhost stays on the landing page for dev.
  if (pathname === '/' && isAppHost(hostname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.rewrite(url);
  }

  // ── 1. Generate CSP nonce (per-request, cryptographically random) ──
  const nonce = crypto.randomUUID();
  const cspHeader = buildCspHeader(nonce);

  // Inject nonce into request headers for RSC consumption (layout.tsx etc.)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-csp-nonce', nonce);

  // ── 2. Handle API routes (rate limiting, auth, CORS) ──
  if (pathname.startsWith('/api/')) {
    return handleApiRoute(request, nonce, cspHeader);
  }

  // ── 3. Non-API routes: apply CSP + security headers, pass through ──
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  setSecurityHeaders(response.headers, cspHeader);
  response.headers.set('x-request-id', crypto.randomUUID().slice(0, 8));
  return response;
}

// == API route handler (extracted from original middleware) ================

async function handleApiRoute(
  request: NextRequest,
  nonce: string,
  cspHeader: string,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const { method } = request;
  const ip = getClientIp(request);
  const corsHeaders = getCorsHeaders(request);

  // Inject nonce into request headers for potential API RSC consumption
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-csp-nonce', nonce);

  // ── Rate limiting ──
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
      setSecurityHeaders(response.headers, cspHeader);
      return response;
    }
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  const stamp = (response: NextResponse): NextResponse => {
    response.headers.set('x-request-id', requestId);
    if (rateLimitMeta) {
      setRateLimitHeaders(response.headers, rateLimitMeta.limit, rateLimitMeta.result);
    }
    setSecurityHeaders(response.headers, cspHeader);
    return response;
  };

  // ── CORS preflight ──
  if (method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204, headers: corsHeaders });
    setSecurityHeaders(response.headers, cspHeader);
    return response;
  }

  // ── Public paths pass through ──
  if (isSkipPath(pathname)) {
    return stamp(
      applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), corsHeaders),
    );
  }

  // ── GET requests are public (read-only) ──
  if (!MUTATING_METHODS.has(method)) {
    return stamp(
      applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), corsHeaders),
    );
  }

  // ── Session verification for mutating methods ──
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');

  let payload: SessionPayload | null = null;
  let jwtClaims: JwtClaims | null = null;

  // Try JWT from rmi-backend first
  const rmiToken = cookieHeader ? extractJwtFromRequest(request) : null;
  if (rmiToken && isJwt(rmiToken)) {
    jwtClaims = await verifyRmiJwt(rmiToken);
    if (jwtClaims) {
      payload = {
        address: jwtClaims.wallet ?? `rmi:${jwtClaims.id}`,
        chain: 'ethereum',
        exp: Date.now() + 3600000,
        nonce: '',
      };
    }
  }

  // Fall back to wallet HMAC session
  if (!payload) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      console.error('[middleware] AUTH_SECRET environment variable is not set');
      return stamp(unauthorizedResponse(corsHeaders));
    }

    if (authHeader?.startsWith(AUTH_TOKEN_PREFIX)) {
      const token = authHeader.slice(AUTH_TOKEN_PREFIX.length).trim();
      if (token) {
        payload = await verifySessionCookie(token, secret);
      }
    }

    if (!payload) {
      const cookieValue = parseSessionCookie(cookieHeader);
      if (cookieValue) {
        payload = await verifySessionCookie(cookieValue, secret);
      }
    }
  }

  if (!payload) {
    return stamp(unauthorizedResponse(corsHeaders));
  }

  // ── Admin route check ──
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

  // ── Proceed ──
  return stamp(
    applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), corsHeaders),
  );
}
