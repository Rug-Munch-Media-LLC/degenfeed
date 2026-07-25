/**
 * @degenfeed/api-worker — Route registry
 *
 * Provides constants, the withSession helper, and middleware setup
 * used by route registration files. Extracted from app.ts.
 */

import type { Hono } from 'hono';
import { apiKeyMiddleware } from '../api-key';
import { applyCors, getAllowedOrigin, isAllowedOrigin, parseOriginHeader } from '../cors';
import { logError } from '../error-logger';
import type { Env } from '../index';
import { jsonResponse, tieredRateLimit } from '../index';
import { requireAdminFromSession } from '../lib/admin-guard';
import { cspForPath } from '../lib/csp';
import { validateRequest } from '../lib/input-validator';
import type { handlePublish } from '../routes/publish';
import { validateBodySize } from '../sanitize';
import { parseSessionCookie, validateCsrfToken } from '../session';

// ─── Constants ──────────────────────────────────────────────

export const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
export const CSRF_SKIP_PREFIXES = ['/api/auth/'];
export const MAX_BODY_BYTES = 1_048_576;
export const DEFAULT_RATE_WINDOW = 5000;
export const DEFAULT_RATE_MAX = 20;

export const STATIC_REDIRECTS: Record<string, string> = {
  '/docs': 'https://app.degenfeed.xyz/docs',
  '/about': 'https://app.degenfeed.xyz/about',
  '/faq': 'https://app.degenfeed.xyz/faq',
  '/legal': 'https://app.degenfeed.xyz/legal',
  '/privacy': 'https://app.degenfeed.xyz/privacy',
  '/terms': 'https://app.degenfeed.xyz/terms',
  '/acceptable-use': 'https://app.degenfeed.xyz/acceptable-use',
  '/community-guidelines': 'https://app.degenfeed.xyz/community-guidelines',
  '/premium': 'https://app.degenfeed.xyz/premium',
  '/newsletter': 'https://app.degenfeed.xyz/newsletter',
  '/status': 'https://app.degenfeed.xyz/status',
  '/discover': 'https://app.degenfeed.xyz/discover',
  '/feed': 'https://app.degenfeed.xyz/feed',
  '/news': 'https://app.degenfeed.xyz/news',
  '/home': 'https://app.degenfeed.xyz/home',
};

// ─── Session helper ─────────────────────────────────────────

export async function withSession(
  // biome-ignore lint/suspicious/noExplicitAny: conditional type gate — actual shape matches Hono Context
  c: Parameters<typeof handlePublish>[0] extends Request ? any : never,
  handler: () => Promise<Response>,
): Promise<Response> {
  const { requireSession, applySessionRefresh } = await import('../session');
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const resp = await handler();
  if (c.env.AUTH_SECRET) return applySessionRefresh(resp, session, c.env.AUTH_SECRET);
  return resp;
}

// ─── Setup all middleware on the app ────────────────────────

export function setupMiddleware(app: Hono<{ Bindings: Env }>): void {
  // Global onError handler
  // Catches uncaught exceptions from any route handler so the API
  // never returns an unhandled 500 without structured logging.
  app.onError(async (err, c) => {
    const path = c.req.path;
    const method = c.req.method;
    const code = await logError(c.env, err, {
      route: path,
      method,
      statusCode: 500,
    });
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code,
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
  });

  // Middleware: Request ID correlation
  // Every request gets a unique x-request-id header for log correlation.
  // Added before CORS so it's always present.
  app.use('*', async (c, next) => {
    const reqId = crypto.randomUUID().slice(0, 8);
    (c as unknown as { set: (k: string, v: string) => void }).set('requestId', reqId);
    await next();
    if (c.res) {
      c.res = new Response(c.res.body, {
        status: c.res.status,
        statusText: c.res.statusText,
        headers: { ...Object.fromEntries(c.res.headers), 'x-request-id': reqId },
      });
    }
  });

  // Middleware: Security headers
  // Sets security headers on EVERY response:
  //   - Content-Security-Policy (route-aware)
  //   - Strict-Transport-Security (HSTS)
  //   - X-Content-Type-Options (nosniff)
  //   - X-Frame-Options (DENY, SAMEORIGIN for embed)
  //   - Referrer-Policy
  //   - Cross-Origin-Resource-Policy
  //   - Cache-Control for sensitive endpoints
  app.use('*', async (c, next) => {
    await next();
    if (!c.res) return;

    const path = c.req.path;
    const headers = new Headers(c.res.headers);

    // Content-Security-Policy — route-aware
    const csp = cspForPath(path);
    if (csp && !headers.has('content-security-policy')) {
      headers.set('content-security-policy', csp);
    }

    // Strict-Transport-Security (HSTS) — 2 year max-age
    if (!headers.has('strict-transport-security')) {
      headers.set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
    }

    // X-Content-Type-Options — prevent MIME sniffing
    if (!headers.has('x-content-type-options')) {
      headers.set('x-content-type-options', 'nosniff');
    }

    // X-Frame-Options — DENY by default, SAMEORIGIN for embed routes
    if (!headers.has('x-frame-options')) {
      if (path.startsWith('/api/embed/')) {
        headers.set('x-frame-options', 'SAMEORIGIN');
      } else {
        headers.set('x-frame-options', 'DENY');
      }
    }

    // Referrer-Policy
    if (!headers.has('referrer-policy')) {
      headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    }

    // Cross-Origin-Resource-Policy
    if (!headers.has('cross-origin-resource-policy')) {
      if (path.startsWith('/api/admin/')) {
        headers.set('cross-origin-resource-policy', 'same-origin');
      } else {
        headers.set('cross-origin-resource-policy', 'cross-origin');
      }
    }

    // Cache-Control for sensitive endpoints (auth, wallet, sessions)
    if (
      path.includes('/auth/') ||
      path.includes('/wallet/') ||
      path.includes('/session') ||
      path.includes('/api-key') ||
      path.startsWith('/api/admin/')
    ) {
      if (!headers.has('cache-control')) {
        headers.set('cache-control', 'no-store, must-revalidate');
      }
    }

    // Remove Server header (information disclosure)
    if (headers.has('server')) {
      headers.delete('server');
    }

    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers,
    });
  });

  // Middleware: CORS post-response
  // Registered first so it wraps every response with CORS headers.
  app.use('*', async (c, next) => {
    await next();
    const origin = getAllowedOrigin(c.req.raw, c.env.ALLOWED_ORIGINS);
    if (c.res) c.res = applyCors(c.res, origin);
  });

  // Middleware: OPTIONS preflight
  // Short-circuits before body size, CSRF, rate limit, and route handlers.
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    await next();
  });

  // Middleware: Input validation
  // Runs BEFORE body parsing and CSRF checks.
  // Validates query params, headers, content-type, and body size.
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();

    const validation = validateRequest(c.req.raw, {});
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: validation.error,
          code: validation.code || 'DF-400',
        }),
        {
          status: validation.code === 'DF-413' ? 413 : validation.code === 'DF-415' ? 415 : 400,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return next();
  });

  // Middleware: body size + CSRF for state-changing requests
  // Protects POST/PUT/PATCH/DELETE against cross-site request forgery via:
  //   1. Origin / Referer header validation (same‑site check)
  //   2. X‑CSRF‑Token header validation against a per‑session token stored in KV
  // Skips GET/HEAD/OPTIONS (safe methods), /api/auth/* (auth flows use their
  // own nonce‑based CSRF), and requests with Authorization: Bearer (API clients
  // are already independently authenticated).
  app.use('*', async (c, next) => {
    const method = c.req.method;
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next();
    }
    const path = c.req.path;

    // Skip body size and CSRF for /api/auth/* — these use OAuth state nonces
    // which provide their own CSRF protection.
    const isAuthPath = CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (isAuthPath) {
      // Still enforce body size limits for auth endpoints
      const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
      if (!sizeCheck.ok) {
        return jsonResponse({ error: sizeCheck.error }, 413);
      }
      return next();
    }

    // Skip CSRF for API clients using Bearer tokens — already authenticated
    // via API key middleware (separate scoped keys, not session cookies).
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
      if (!sizeCheck.ok) {
        return jsonResponse({ error: sizeCheck.error }, 413);
      }
      return next();
    }

    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }

    // ── Origin / Referer validation ──────────────────────────────
    const isWebhookExempt = CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
    if (!isWebhookExempt) {
      const origin = c.req.header('origin');
      if (origin) {
        if (!isAllowedOrigin(origin, c.env.ALLOWED_ORIGINS)) {
          return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
        }
      } else {
        const referer = c.req.header('referer');
        if (referer) {
          const refererOrigin = parseOriginHeader(referer);
          if (!refererOrigin || !isAllowedOrigin(refererOrigin, c.env.ALLOWED_ORIGINS)) {
            return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
          }
        } else {
          return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
        }
      }
    }

    // ── X-CSRF-Token validation ──────────────────────────────────
    // Only applies to cookie‑authenticated sessions (not Bearer API keys).
    const cookieValue = parseSessionCookie(c.req.header('cookie') ?? null);
    if (cookieValue) {
      const csrfToken = c.req.header('x-csrf-token');
      const valid = await validateCsrfToken(cookieValue, csrfToken ?? null, c.env);
      if (!valid) {
        return jsonResponse({ error: 'CSRF validation failed', code: 'DF-403' }, 403);
      }
    }

    await next();
  });

  // Middleware: API key authentication (v1 routes)
  app.use('/v1/*', apiKeyMiddleware);

  // Middleware: rate limiting (tiered)
  // Uses context-aware rate limits:
  //   - Brute force: wallet verify → 5/min → 1/min after 3 failures
  //   - Enumeration: email/username checks → 3/min with exponential backoff
  //   - Scraping: feed endpoints → 30/min anonymous, 120/min authenticated
  //   - Admin: 10/min
  //   - Global: 1000 req/min per IP DDoS protection
  app.use('*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

    // Detect if the request is authenticated (has a session or API key)
    const authHeader = c.req.header('authorization');
    const cookieHeader = c.req.header('cookie');
    const isAuthenticated = !!(
      authHeader?.startsWith('Bearer ') || cookieHeader?.includes('session=')
    );

    const rl = await tieredRateLimit(c.env, ip, c.req.path, isAuthenticated);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit', retryAfterMs: rl.retryAfter }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': String(Math.ceil(rl.retryAfter / 1000)),
        },
      });
    }
    await next();
  });

  // Middleware: Deprecation headers for legacy /api/ routes
  // Legacy /api/* routes get deprecation headers encouraging migration to /v1/
  app.use('/api/*', async (c, next) => {
    await next();
    if (c.res) {
      const headers = new Headers(c.res.headers);
      if (!headers.has('Deprecation')) {
        headers.set('Deprecation', 'true');
        headers.set('Sunset', 'Sat, 01 Nov 2026 00:00:00 GMT');
        headers.set('Link', '</v1/>; rel="successor-version"');
        c.res = new Response(c.res.body, {
          status: c.res.status,
          statusText: c.res.statusText,
          headers,
        });
      }
    }
  });

  // Middleware: Admin wallet guard
  // Protects all /api/admin/* routes — requires a valid session
  // with a wallet in the ADMIN_WALLETS env var.
  app.use('/api/admin/*', async (c, next) => {
    const result = await requireAdminFromSession(c.req.raw, c.env);
    if (result instanceof Response) return result;
    return next();
  });
}
