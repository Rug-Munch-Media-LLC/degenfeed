/**
 * @degenfeed/api-worker — Hono entry point (orchestrator)
 *
 * Thin orchestrator that applies global middleware and delegates route
 * registration to specialized modules under ./routes/register/.
 *
 * Wraps the existing route handlers in a Hono app for runtime portability.
 * Keeps all handler signatures intact — Hono's c.req.raw returns a standard
 * Request, and handlers return Response, so no handler changes are needed.
 *
 * To deploy on Node.js/Deno/Bun instead of Cloudflare Workers, change
 * wrangler.toml "main" back to "src/index.ts" and run:
 *   npm run dev:node    # development
 *   npm run start:node  # production
 */

import { Hono } from 'hono';
import { apiKeyMiddleware } from './api-key';
import { applyCors, getAllowedOrigin, isAllowedOrigin, parseOriginHeader } from './cors';
import { tieredRateLimit } from './rate-limit';
import { jsonResponse, rateLimitResponse } from './response-helpers';
import { validateBodySize } from './sanitize';
import { parseSessionCookie, validateCsrfToken } from './session';
import type { Env } from './types';

// ─── Error handling ──────────────────────────────────────────

import { requireAdminFromSession } from './lib/admin-guard';

// ─── Route registration ─────────────────────────────────────
// Delegated to register/ sub-modules under ./routes/register/

import { registerAuthRoutes } from './routes/register/auth';
import { registerCoinsRoutes } from './routes/register/coins';
import { registerCoreRoutes } from './routes/register/core';
import { registerDaoRoutes } from './routes/register/dao';
import { registerFeedRoutes } from './routes/register/feed';
// ─── Farcaster Frames v2 + Nostr NIP-29 Groups ─────────────────────────
import { registerFramesRoutes } from './routes/register/frames';
import { registerLensRoutes } from './routes/register/lens';
import { registerLiveRoutes } from './routes/register/live';
import { registerMediaRoutes } from './routes/register/media';
import { registerMembershipRoutes } from './routes/register/membership';
import { registerMessagingRoutes } from './routes/register/messaging';
import { registerNostrGroupRoutes } from './routes/register/nostr-groups';
import { registerPremiumRoutes } from './routes/register/premium';
import { registerSocialRoutes } from './routes/register/social';

// ─── Additional dependencies ─────────────────────────────────

import { cspForPath } from './lib/csp';
import { validateRequest } from './lib/input-validator';

// ─── App ────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// ─── Global onError handler ─────────────────────────────────
// Catches uncaught exceptions from any route handler so the API
// never returns an unhandled 500 without structured logging.
// Uses AppError subclasses for proper HTTP status codes and
// consistent JSON error shapes.
app.onError(async (err, c) => {
  const path = c.req.path;
  const method = c.req.method;
  const requestId = (c as unknown as { get?: (k: string) => string }).get?.('requestId');

  // Use handleError which handles AppError subclasses with proper status codes
  // and never leaks stack traces in production
  const { handleError } = await import('./lib/errors');
  return handleError(err, c.env, { route: path, method, requestId });
});

// ─── Constants ──────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = ['/api/tip/frame/', '/api/blink/tip', '/api/x402/verify'];
const CSRF_SKIP_PREFIXES = ['/api/auth/'];
const MAX_BODY_BYTES = 1_048_576;

const STATIC_REDIRECTS: Record<string, string> = {
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

// ─── Middleware: Request ID correlation ─────────────────────
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

// ─── Middleware: Security headers ────────────────────────────
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

  // Strict-Transport-Security — 2 year max-age
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

  // Cache-Control for sensitive endpoints
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

// ─── Middleware: CORS post-response ──────────────────────────
app.use('*', async (c, next) => {
  await next();
  const origin = getAllowedOrigin(c.req.raw, c.env.ALLOWED_ORIGINS);
  if (c.res) c.res = applyCors(c.res, origin);
});

// ─── Middleware: OPTIONS preflight ───────────────────────────
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
  await next();
});

// ─── Middleware: Input validation ────────────────────────────
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

// ─── Middleware: body size + CSRF for state-changing requests ──
app.use('*', async (c, next) => {
  const method = c.req.method;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }
  const path = c.req.path;

  // Skip body size and CSRF for /api/auth/*
  const isAuthPath = CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isAuthPath) {
    const sizeCheck = validateBodySize(c.req.raw, MAX_BODY_BYTES);
    if (!sizeCheck.ok) {
      return jsonResponse({ error: sizeCheck.error }, 413);
    }
    return next();
  }

  // Skip CSRF for API clients using Bearer tokens
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

  // Origin / Referer validation
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

  // X-CSRF-Token validation
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

// ─── Middleware: API key authentication (v1 routes) ──────────
app.use('/v1/*', apiKeyMiddleware);

// ─── Middleware: rate limiting (tiered) ──────────────────────
app.use('*', async (c, next) => {
  // Tiered rate limits: auth 5/60s, tip 10/60s, publish 20/60s,
  // admin 20/60s, writes 30/60s, reads 100/60s.
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const authHeader = c.req.header('authorization');
  const cookieHeader = c.req.header('cookie');
  const isAuthenticated = !!(
    authHeader?.startsWith('Bearer ') || cookieHeader?.includes('session=')
  );

  const rl = await tieredRateLimit(c.env, ip, c.req.path, isAuthenticated, c.req.method);
  if (!rl.allowed) {
    return rateLimitResponse(rl.retryAfter);
  }

  await next();
});

// ─── Middleware: Deprecation headers for legacy /api/ routes ──
app.use('/api/*', async (c, next) => {
  await next();
  if (c.res) {
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: {
        ...Object.fromEntries(c.res.headers),
        deprecation: 'true',
        sunset: '2026-09-01',
        'x-deprecation-notice': 'Use /v1/ paths instead. See https://docs.degenfeed.xyz/migration',
      },
    });
  }
});

// ─── Middleware: Admin wallet guard ─────────────────────────
app.use('/api/admin/*', async (c, next) => {
  try {
    await requireAdminFromSession(c.req.raw, c.env);
  } catch (err) {
    const { handleError } = await import('./lib/errors');
    return handleError(err, c.env, { route: c.req.path, method: c.req.method });
  }
  await next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════

registerCoreRoutes(app);
registerAuthRoutes(app);
registerFeedRoutes(app);
registerSocialRoutes(app);
registerDaoRoutes(app);
registerCoinsRoutes(app);
registerLensRoutes(app);
registerMediaRoutes(app);
registerMembershipRoutes(app);
registerMessagingRoutes(app);
registerLiveRoutes(app);
registerPremiumRoutes(app);
registerFramesRoutes(app);
registerNostrGroupRoutes(app);

// ─── External platform routes (DegenFeed Connect) ────────────────
import {
  handleConnectCallback,
  handleConnectExternalPlatform,
  handleDisconnectPlatform,
  handleExternalAnalytics,
  handleExternalGoLive,
  handleExternalPost,
  handleExternalSchedule,
  handleExternalStatus,
  handleExternalWebhook,
  handleListAccounts,
  handleListPlatforms,
  handleStandaloneSubscribe,
} from './routes/external-platforms';

// POST /api/external/connect — Initiate OAuth connection to external platform
app.post('/api/external/connect', async (c) => handleConnectExternalPlatform(c.req.raw, c.env));
// GET /api/external/connect/callback — Handle OAuth callback from Postiz
app.get('/api/external/connect/callback', async (c) => handleConnectCallback(c.req.raw, c.env));
// GET /api/external/accounts — List connected external accounts
app.get('/api/external/accounts', async (c) => handleListAccounts(c.req.raw, c.env));
// POST /api/external/post — Post to external platforms
app.post('/api/external/post', async (c) => handleExternalPost(c.req.raw, c.env));
// POST /api/external/schedule — Schedule post for later
app.post('/api/external/schedule', async (c) => handleExternalSchedule(c.req.raw, c.env));
// POST /api/external/go-live — Go live on external platform
app.post('/api/external/go-live', async (c) => handleExternalGoLive(c.req.raw, c.env));
// GET /api/external/analytics — Pull analytics from external platforms
app.get('/api/external/analytics', async (c) => handleExternalAnalytics(c.req.raw, c.env));
// DELETE /api/external/disconnect — Disconnect platform
app.delete('/api/external/disconnect', async (c) => handleDisconnectPlatform(c.req.raw, c.env));
// POST /api/external/webhook — Postiz webhook receiver
app.post('/api/external/webhook', async (c) => handleExternalWebhook(c.req.raw, c.env));
// GET /api/external/platforms — List available platforms
app.get('/api/external/platforms', async (c) => handleListPlatforms(c.req.raw, c.env));
// GET /api/external/status — Get external platform status
app.get('/api/external/status', async (c) => handleExternalStatus(c.req.raw, c.env));
// POST /api/external/standalone/subscribe — Purchase standalone add-on
app.post('/api/external/standalone/subscribe', async (c) =>
  handleStandaloneSubscribe(c.req.raw, c.env),
);

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGY FED BRIDGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

import {
  handleBridgyConfigure,
  handleBridgyCrossPost,
  handleBridgyRegisterUser,
  handleBridgyStatus,
  handleBridgyUsers,
} from './routes/bridgy-routes';

// GET  /api/bridgy/status    — Bridgy Fed bridge health
app.get('/api/bridgy/status', async (c) => handleBridgyStatus(c.req.raw, c.env));
// POST /api/bridgy/configure — Configure Bridgy Fed for an instance (admin)
app.post('/api/bridgy/configure', async (c) => handleBridgyConfigure(c.req.raw, c.env));
// GET  /api/bridgy/users     — List bridged users
app.get('/api/bridgy/users', async (c) => handleBridgyUsers(c.req.raw, c.env));
// POST /api/bridgy/cross-post — Cross-post via Bridgy Fed
app.post('/api/bridgy/cross-post', async (c) => handleBridgyCrossPost(c.req.raw, c.env));
// POST /api/bridgy/register  — Register user's bridge
app.post('/api/bridgy/register', async (c) => handleBridgyRegisterUser(c.req.raw, c.env));

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM ACCOUNT PORTABILITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. Join All Networks ─────────────────────────────────────────────────
import { handleJoinAll, handleJoinAllRetry, handleJoinAllStatus } from './routes/accounts-join-all';

app.post('/api/accounts/join-all', async (c) => handleJoinAll(c.req.raw, c.env));
app.get('/api/accounts/join-all/status', async (c) => handleJoinAllStatus(c.req.raw, c.env));
app.post('/api/accounts/join-all/retry', async (c) => handleJoinAllRetry(c.req.raw, c.env));

// ─── 2. Cross-Instance Login ──────────────────────────────────────────────
import {
  handleCrossLoginBluesky,
  handleCrossLoginCredentials,
  handleCrossLoginFarcaster,
  handleCrossLoginLemmy,
  handleCrossLoginMastodon,
  handleCrossLoginMatrix,
  handleCrossLoginPeerTube,
  handleCrossLoginPixelfed,
  handleCrossLoginSSOToken,
} from './routes/accounts-cross-login';

app.post('/api/accounts/cross-login/mastodon', async (c) =>
  handleCrossLoginMastodon(c.req.raw, c.env),
);
app.post('/api/accounts/cross-login/bluesky', async (c) =>
  handleCrossLoginBluesky(c.req.raw, c.env),
);
app.post('/api/accounts/cross-login/farcaster', async (c) =>
  handleCrossLoginFarcaster(c.req.raw, c.env),
);
app.post('/api/accounts/cross-login/matrix', async (c) => handleCrossLoginMatrix(c.req.raw, c.env));
app.post('/api/accounts/cross-login/peertube', async (c) =>
  handleCrossLoginPeerTube(c.req.raw, c.env),
);
app.post('/api/accounts/cross-login/lemmy', async (c) => handleCrossLoginLemmy(c.req.raw, c.env));
app.post('/api/accounts/cross-login/pixelfed', async (c) =>
  handleCrossLoginPixelfed(c.req.raw, c.env),
);
app.get('/api/accounts/cross-login/credentials', async (c) =>
  handleCrossLoginCredentials(c.req.raw, c.env),
);
app.get('/api/accounts/cross-login/sso-token', async (c) =>
  handleCrossLoginSSOToken(c.req.raw, c.env),
);

// ─── 3. Data Portability Hub ──────────────────────────────────────────────
import {
  handleExportAll,
  handleExportAllDownload,
  handleExportAllManifest,
  handleExportAllStatus,
} from './routes/accounts-export-all';

app.post('/api/accounts/export-all', async (c) => handleExportAll(c.req.raw, c.env));
app.get('/api/accounts/export-all/status', async (c) => handleExportAllStatus(c.req.raw, c.env));
app.get('/api/accounts/export-all/manifest', async (c) =>
  handleExportAllManifest(c.req.raw, c.env),
);
app.get('/api/accounts/export-all/download', async (c) =>
  handleExportAllDownload(c.req.raw, c.env),
);

// ─── 4. Account Migration ─────────────────────────────────────────────────
import {
  handleMigrateBluesky,
  handleMigrateExport,
  handleMigrateFarcaster,
  handleMigrateImport,
  handleMigrateJobs,
  handleMigrateMastodon,
  handleMigrateStatus,
} from './routes/accounts-migrate';

app.post('/api/accounts/migrate/bluesky', async (c) => handleMigrateBluesky(c.req.raw, c.env));
app.post('/api/accounts/migrate/mastodon', async (c) => handleMigrateMastodon(c.req.raw, c.env));
app.post('/api/accounts/migrate/farcaster', async (c) => handleMigrateFarcaster(c.req.raw, c.env));
app.post('/api/accounts/migrate/import', async (c) => handleMigrateImport(c.req.raw, c.env));
app.post('/api/accounts/migrate/export', async (c) => handleMigrateExport(c.req.raw, c.env));
app.get('/api/accounts/migrate/status', async (c) => handleMigrateStatus(c.req.raw, c.env));
app.get('/api/accounts/migrate/jobs', async (c) => handleMigrateJobs(c.req.raw, c.env));

// ─── 5. Cross-Platform Profile Sync ──────────────────────────────────────
import {
  handleProfileSync,
  handleProfileSyncProtocol,
  handleProfileSyncStatus,
  handleProfileUpdate,
  handleProfileVisibility,
} from './routes/accounts-profile-sync';

app.get('/api/accounts/profile/status', async (c) => handleProfileSyncStatus(c.req.raw, c.env));
app.put('/api/accounts/profile/update', async (c) => handleProfileUpdate(c.req.raw, c.env));
app.post('/api/accounts/profile/sync', async (c) => handleProfileSync(c.req.raw, c.env));
app.post('/api/accounts/profile/sync/:protocol', async (c) =>
  handleProfileSyncProtocol(c.req.raw, c.env),
);
app.put('/api/accounts/profile/visibility', async (c) => handleProfileVisibility(c.req.raw, c.env));

// ═══════════════════════════════════════════════════════════════
// POST-ROUTE REGISTRATIONS (catch-all, static redirects, etc.)
// ═══════════════════════════════════════════════════════════════

// ─── Static redirects ──────────────────────────────────────
app.all('/*', async (c, next) => {
  const path = c.req.path;
  if (path in STATIC_REDIRECTS) {
    return Response.redirect(STATIC_REDIRECTS[path] as string, 301);
  }
  await next();
});

// ─── Catch-all: return API info ─────────────────────────────
app.all('/*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return jsonResponse({
      status: 'ok',
      service: 'degenfeed-api',
      version: '0.2.0',
    });
  }
  return jsonResponse({
    status: 'ok',
    service: 'degenfeed-api',
    version: '0.2.0',
  });
});

// ─── Exports ─────────────────────────────────────────────────

export default app;
export { scheduled } from './cron-handler';
export { app };
