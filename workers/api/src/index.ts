/**
 * @degenfeed/api-worker — Main router
 *
 * Dispatches requests to route handler modules.
 * Shared utilities (Env, rateLimit, jsonResponse, GTS config) are
 * re-exported for route module use.
 */

export type { Env, RateLimitResult } from './types';

import { isAllowedOrigin, parseOriginHeader } from './cors';
import { handleCron } from './routes/cron';

// ─── Shared constants ────────────────────────────────────────────────

export function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  console.log(
    JSON.stringify({
      l: level,
      m: msg,
      t: Date.now(),
      ...(data ? { d: data } : {}),
    }),
  );
}

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
export const FARCASTER_HUBS = [
  'http://127.0.0.1:2281',
  'https://hubble.degenfeed.xyz',
  'https://hub.farcaster.standardcrypto.vc:2281',
];
export const LENS_APIS = ['https://api.lens.xyz/graphql', 'https://api-v2.lens.dev/graphql'];
export const BSKY_PUBLIC = 'https://public.api.bsky.app';
export const BSKY_SOCIAL = 'https://bsky.social';
export const THREADS_PUBLIC = 'https://public.threads.net';

// ─── Rate limiting ───────────────────────────────────────────────────

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

/**
 * KV-backed fixed-window rate limiter.
 *
 * Cloudflare Workers can spin up many isolates per zone, so any in-memory
 * counter is unreliable. We use the CACHE KV namespace with a per-bucket
 * TTL equal to the window. Each bucket key = `${ip}:${path}:${windowMs/1000}`,
 * storing a JSON `{ count, resetAt }`. The bucket auto-expires after one
 * window so the counter resets.
 *
 * If `CACHE` is not bound (local dev), the function falls back to a
 * permissive "always allow" result and logs once — never blocks real users.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  path: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    // No KV bound (local dev). Skip throttling so the dev experience works.
    return { allowed: true, retryAfter: 0 };
  }
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `rl:${ip}:${path}:${bucketSec}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  let count = 1;
  try {
    const raw = await env.CACHE.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    // TTL covers the window so the key expires automatically.
    await env.CACHE.put(key, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // KV hiccup — fail open so a single KV outage doesn't break the API.
    return { allowed: true, retryAfter: 0 };
  }

  if (count > maxReq) {
    return { allowed: false, retryAfter: Math.max(0, resetAt - now) };
  }
  return { allowed: true, retryAfter: 0 };
}

// ─── Tiered rate limiters ────────────────────────────────────────────
// These build on the KV-backed rateLimit() to provide context-aware
// rate limiting for specific attack vectors:
//
//   Brute force:  wallet verify → 5/min → after 3 failures, 1/min for 30min
//   Enumeration:  email/username checks → 3/min with exponential backoff
//   Scraping:     feed endpoints → 30/min anonymous, 120/min authenticated
//   DDoS:         global 1000 req/min across all IPs
//   Admin:        10/min with wallet-specific tracking
//
// Failure counters use a separate KV prefix so they don't interfere with
// the main rate limit counters.

const BRUTE_FORCE_MAX = 5;
const BRUTE_FORCE_WINDOW_MS = 60_000;
const BRUTE_FORCE_BLOCK_MAX = 3;
const BRUTE_FORCE_BLOCK_WINDOW_MS = 1_800_000; // 30 minutes
const BRUTE_FORCE_BLOCK_RATE = 1; // 1 req/min when blocked
const BRUTE_FORCE_BLOCK_RATE_WINDOW_MS = 60_000;

const ENUMERATION_MAX = 3;
const ENUMERATION_WINDOW_MS = 60_000;
const ENUMERATION_BACKOFF_BASE_MS = 10_000; // Start at 10s
const ENUMERATION_BACKOFF_MAX_MS = 300_000; // Cap at 5min

const ANON_SCRAPE_MAX = 30;
const AUTH_SCRAPE_MAX = 120;
const SCRAPE_WINDOW_MS = 60_000;

const GLOBAL_DDOS_MAX = 1000;
const GLOBAL_DDOS_WINDOW_MS = 60_000;

const ADMIN_MAX = 10;
const ADMIN_WINDOW_MS = 60_000;

/**
 * Check if a path is a feed/scrape endpoint.
 */
function isScrapePath(path: string): boolean {
  return (
    path.startsWith('/api/feed/') ||
    path.startsWith('/api/discover/') ||
    path.startsWith('/api/search/') ||
    path.startsWith('/api/shorts/feed') ||
    path.startsWith('/api/shorts/trending') ||
    path.startsWith('/api/shorts/for-you')
  );
}

/**
 * Check if a path is an enumeration-susceptible endpoint.
 */
function isEnumerationPath(path: string): boolean {
  return (
    path === '/api/auth/email/register' ||
    path === '/api/auth/email/signin' ||
    path === '/api/auth/email/status' ||
    path === '/api/auth/email/password-reset' ||
    path === '/api/auth/email/password-reset/confirm'
  );
}

/**
 * Check if a path is an admin endpoint.
 */
function isAdminPath(path: string): boolean {
  return path.startsWith('/api/admin/');
}

/**
 * Check if a path is a brute-force target (wallet verify).
 */
function isBruteForcePath(path: string): boolean {
  return path === '/api/auth/wallet/verify';
}

/**
 * Tiered rate limit dispatch.
 *
 * Returns the appropriate rate limit for the request context.
 * More specific checks (brute force, enumeration) take priority over
 * general scraping/DDoS limits.
 */
export async function tieredRateLimit(
  env: Env,
  ip: string,
  path: string,
  isAuthenticated: boolean,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    return { allowed: true, retryAfter: 0 };
  }

  // ── Brute force protection (wallet verify) ─────────────────────
  if (isBruteForcePath(path)) {
    const failureKey = `bf:fail:${ip}`;
    const now = Date.now();

    // Check failure count in the current window
    let failureCount = 0;
    try {
      const raw = await env.CACHE.get(failureKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { count: number; resetAt: number };
        if (parsed.resetAt > now) {
          failureCount = parsed.count;
        }
      }
    } catch {
      // KV hiccup — fail open
    }

    // If in blocked state (>3 failures), use stricter rate
    if (failureCount >= BRUTE_FORCE_BLOCK_MAX) {
      return rateLimit(env, ip, path, BRUTE_FORCE_BLOCK_RATE, BRUTE_FORCE_BLOCK_RATE_WINDOW_MS);
    }

    // Normal: 5/min
    return rateLimit(env, ip, path, BRUTE_FORCE_MAX, BRUTE_FORCE_WINDOW_MS);
  }

  // ── Enumeration protection ─────────────────────────────────────
  if (isEnumerationPath(path)) {
    // Count attempts for this IP
    const enumKey = `enum:${ip}:${path}`;
    const now = Date.now();

    let attempts = 0;
    try {
      const raw = await env.CACHE.get(enumKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { count: number; resetAt: number };
        if (parsed.resetAt > now) {
          attempts = parsed.count;
        }
      }
    } catch {
      // KV hiccup — fail open
    }

    // Exponential backoff: each attempt beyond the first increases the window
    // Window = base * 2^(attempts - ENUMERATION_MAX), capped at max
    let windowMs = ENUMERATION_WINDOW_MS;
    if (attempts >= ENUMERATION_MAX) {
      const extraAttempts = attempts - ENUMERATION_MAX + 1;
      windowMs = Math.min(
        ENUMERATION_BACKOFF_BASE_MS * 2 ** extraAttempts,
        ENUMERATION_BACKOFF_MAX_MS,
      );
      return rateLimit(env, ip, path, 1, windowMs);
    }

    // Track attempt count
    const bucketSec = Math.max(1, Math.ceil(ENUMERATION_WINDOW_MS / 1000));
    const resetAt = now + ENUMERATION_WINDOW_MS;
    try {
      await env.CACHE.put(enumKey, JSON.stringify({ count: attempts + 1, resetAt }), {
        expirationTtl: bucketSec,
      });
    } catch {
      // Non-critical
    }

    return rateLimit(env, ip, path, ENUMERATION_MAX, ENUMERATION_WINDOW_MS);
  }

  // ── Scraping protection (feed/search endpoints) ────────────────
  if (isScrapePath(path)) {
    const maxReq = isAuthenticated ? AUTH_SCRAPE_MAX : ANON_SCRAPE_MAX;
    return rateLimit(env, ip, path, maxReq, SCRAPE_WINDOW_MS);
  }

  // ── Admin endpoints ────────────────────────────────────────────
  if (isAdminPath(path)) {
    return rateLimit(env, ip, path, ADMIN_MAX, ADMIN_WINDOW_MS);
  }

  // ── Global DDoS protection ─────────────────────────────────────
  // Count requests across ALL paths for this IP
  const globalKey = `rl:global:${ip}`;
  const globalBucketSec = Math.max(1, Math.ceil(GLOBAL_DDOS_WINDOW_MS / 1000));
  const now = Date.now();
  const globalResetAt = now + GLOBAL_DDOS_WINDOW_MS;

  let globalCount = 1;
  try {
    const raw = await env.CACHE.get(globalKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        globalCount = parsed.count + 1;
      }
    }
    await env.CACHE.put(globalKey, JSON.stringify({ count: globalCount, resetAt: globalResetAt }), {
      expirationTtl: globalBucketSec,
    });
  } catch {
    // KV hiccup — fail open
  }

  if (globalCount > GLOBAL_DDOS_MAX) {
    return { allowed: false, retryAfter: Math.max(0, globalResetAt - now) };
  }

  // ── Default: use the existing per-path rate limit ──────────────
  const maxReq = Number(env.RATE_MAX_REQ) || DEFAULT_RATE_MAX;
  const windowMs = Number(env.RATE_WINDOW_MS) || DEFAULT_RATE_WINDOW;
  return rateLimit(env, ip, path, maxReq, windowMs);
}

/**
 * Record a failed brute force attempt.
 * Called by the wallet verify handler when signature verification fails.
 */
export async function recordBruteForceFailure(env: Env, ip: string): Promise<void> {
  if (!env.CACHE) return;
  const failureKey = `bf:fail:${ip}`;
  const now = Date.now();
  const windowMs = BRUTE_FORCE_BLOCK_WINDOW_MS;
  const bucketSec = Math.max(1, Math.ceil(windowMs / 1000));

  let count = 1;
  try {
    const raw = await env.CACHE.get(failureKey);
    if (raw) {
      const parsed = JSON.parse(raw) as { count: number; resetAt: number };
      if (parsed.resetAt > now) {
        count = parsed.count + 1;
      }
    }
    const resetAt = now + windowMs;
    await env.CACHE.put(failureKey, JSON.stringify({ count, resetAt }), {
      expirationTtl: bucketSec,
    });
  } catch {
    // Non-critical
  }
}

// Rate limit cleanup inline in rateLimit() — avoids global setInterval (CF Workers restriction)

// ─── GotoSocial config ───────────────────────────────────────────────

export const GTS_AUTH_CONFIG = {
  clientId: '', // Must be set via GTS_CLIENT_ID env var
  clientSecret: '', // Must be set via GTS_CLIENT_SECRET env var
  instanceUrl: 'https://social.degenfeed.xyz',
  apiBase: 'https://social.degenfeed.xyz',
  redirectUri: 'https://degenfeed.xyz/auth/callback',
  scopes: 'read write follow push',
};

export function getGtsConfig(env: Env) {
  return {
    clientId: env.GTS_CLIENT_ID ?? GTS_AUTH_CONFIG.clientId,
    clientSecret: env.GTS_CLIENT_SECRET ?? GTS_AUTH_CONFIG.clientSecret,
    instanceUrl: env.GOTOSOCIAL_INSTANCE_URL ?? GTS_AUTH_CONFIG.instanceUrl,
    apiBase: env.GOTOSOCIAL_INSTANCE_URL ?? GTS_AUTH_CONFIG.apiBase,
    redirectUri: env.GTS_REDIRECT_URI ?? GTS_AUTH_CONFIG.redirectUri,
    scopes: GTS_AUTH_CONFIG.scopes,
  };
}

// ─── Response helper ─────────────────────────────────────────────────

/**
 * @deprecated Use response-helpers.ts (ok/created/badRequest/unauthorized/notFound/serverError) instead.
 * response-helpers.ts wraps responses in a consistent { data } envelope.
 * Routes using jsonResponse() should be migrated to response-helpers for consistency.
 * Migrated routes: health.ts
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=30',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function noCacheJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

// ─── CORS / CSRF helpers ─────────────────────────────────────────────

const CSRF_EXEMPT_PATHS = [
  // /api/auth/gotosocial/callback is now protected by a signed state nonce
  // (see routes/auth.ts) AND a normal origin check, so it's no longer exempt.
  '/api/tip/frame/',
  // '/api/bridge/rss-to-nostr' is NO LONGER exempt — requires CSRF check
  '/api/blink/tip',
  '/api/x402/verify',
];

function _isStateChanging(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

function isCsrfExempt(path: string): boolean {
  return CSRF_EXEMPT_PATHS.some((prefix) => path.startsWith(prefix));
}

function _validateOrigin(request: Request, path: string, env: Env): boolean {
  if (isCsrfExempt(path)) return true;
  const origin = request.headers.get('origin');
  if (origin) return isAllowedOrigin(origin, env.ALLOWED_ORIGINS);
  const referer = request.headers.get('referer');
  if (referer) {
    const refererOrigin = parseOriginHeader(referer);
    return refererOrigin ? isAllowedOrigin(refererOrigin, env.ALLOWED_ORIGINS) : false;
  }
  return false;
}

// ─── Cron handler ───────────────────────────────────────────────

/**
 * Called by the CF Workers cron trigger.
 *
 * Schedules:
 *   every-1-min  — scheduled post executor
 *   every-30-min — trending content scraper
 *   daily-14:00  — daily digest + trending refresh
 *   sun-12:00    — weekly source discovery + health maintenance
 *
 * The controller.cron field tells us which cron matched.
 * Re-exported from app.ts for the wrangler entry point.
 */
export async function scheduled(
  controller: { cron: string; scheduledTime: number; noRetry: () => void },
  env: Env,
): Promise<void> {
  const cron = controller.cron;

  // ── Every minute: scheduled post executor + sync queue processing ──
  if (cron === '* * * * *') {
    // Execute scheduled posts
    const { executeScheduledPosts } = await import('./routes/scheduled-executor');
    await executeScheduledPosts(env).catch((err) =>
      log('warn', '[scheduled] scheduled post executor failed', err),
    );

    // Execute content syndication queue
    try {
      const { executeDueSyndicationRules } = await import('./routes/content-syndication-routes');
      const synced = await executeDueSyndicationRules(env);
      if (synced > 0) {
        log('info', `[scheduled] executed ${synced} syndication rules`);
      }
    } catch (err) {
      log('warn', '[scheduled] syndication executor failed', err);
    }

    // Execute scheduled cross-posts
    const { executeDueScheduledCrossPosts } = await import('./routes/publish');
    const executed = await executeDueScheduledCrossPosts(env).catch((err) => {
      log('warn', '[scheduled] cross-post executor failed', err);
      return 0;
    });
    if (executed > 0) {
      log('info', `[scheduled] executed ${executed} scheduled cross-posts`);
    }

    // Execute premium scheduled posts (Buffer-style scheduling)
    const { executeDuePremiumPosts } = await import('./routes/premium-publish');
    const premiumExecuted = await executeDuePremiumPosts(env).catch((err) => {
      log('warn', '[scheduled] premium executor failed', err);
      return 0;
    });
    if (premiumExecuted > 0) {
      log('info', `[scheduled] executed ${premiumExecuted} premium scheduled posts`);
    }

    // Process realtime sync queue (every 30s effectively, since cron fires every min)
    try {
      const { processQueue } = await import('./lib/sync-queue');
      const { processSyncAction } = await import('./lib/realtime-sync');
      const result = await processQueue(env, processSyncAction, 25);
      if (result.processed > 0) {
        log(
          'info',
          `[scheduled] sync queue processed: ${result.succeeded} succeeded, ${result.failed} failed`,
        );
      }

      // Retry dead letters
      const retried = await retrySyncDeadLetters(env);
      if (retried > 0) {
        log('info', `[scheduled] retried ${retried} dead letter sync entries`);
      }
    } catch (err) {
      log('error', '[scheduled] sync queue processing failed', err);
    }

    // Clean up expired chat messages and files (auto-delete timers)
    try {
      const { handleCleanupCron } = await import('./routes/chat-features');
      const { cleanedMessages, cleanedFiles } = await handleCleanupCron(env);
      if (cleanedMessages > 0 || cleanedFiles > 0) {
        log('info', `[scheduled] chat cleanup: ${cleanedMessages} messages, ${cleanedFiles} files`);
      }
    } catch (err) {
      log('warn', '[scheduled] chat cleanup failed', err);
    }

    return; // No other work on the every-minute tick
  }

  // ── Trending scraper — 30-min and daily ticks ──────────────────────
  const { scrapeTrendingContent } = await import('./routes/trending-scraper');
  await scrapeTrendingContent(env).catch((err) =>
    log('warn', '[scheduled] trending scrape failed', err),
  );

  // ── Daily digest — 14:00 UTC ──────────────────────────────────────
  if (cron === '0 14 * * *') {
    await handleCron(env);

    // Process expired GDPR account deletion requests (24h grace period)
    try {
      const { processPendingDeletions } = await import('./routes/account-delete');
      const result = await processPendingDeletions(env);
      if (result.processed > 0 || result.errors > 0) {
        log('info', '[scheduled] GDPR deletion processing complete', result);
      }
    } catch (err) {
      log('error', '[scheduled] GDPR deletion processing failed', err);
    }

    // ── Curated podcast episode aggregation ──────────────────────
    try {
      const { handlePodcastAggregation } = await import('./routes/podcast-cron');
      const result = await handlePodcastAggregation(env);
      log('info', '[scheduled] curated podcast aggregation complete', {
        totalFetched: result.totalFetched,
        totalPodcasts: result.totalPodcasts,
        durationMs: result.durationMs,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err) {
      log('error', '[scheduled] podcast aggregation failed', err);
    }
  }

  // ── Weekly source discovery + health maintenance — Sunday 12:00 UTC ──
  if (cron === '0 12 * * 0') {
    // Run discovery
    try {
      const { handleSourcesDiscover } = await import('./routes/source-discovery');
      const discoverReq = new Request('http://localhost/api/sources/discover?platform=all');
      await handleSourcesDiscover(discoverReq, env);
      log('info', '[scheduled] weekly source discovery complete');
    } catch (err) {
      log('error', '[scheduled] source discovery failed', err);
    }

    // Initialize health tracking for newly discovered sources

    // ── Weekly identity re-discovery ────────────────────────────────
    try {
      const { discoverIdentities } = await import('./lib/identity-discovery');
      // Scan all wallets with linked identities and re-discover
      // This catches newly created protocol accounts that were linked after initial discovery
      let cursor: string | undefined;
      let rechecked = 0;
      do {
        const list = await env.IDENTITIES?.list({ cursor, limit: 100 });
        if (!list) break;
        cursor = list.cursor;
        for (const key of list.keys) {
          const wallet = key.name.replace('identity:', '');
          if (!wallet.startsWith('0x') && !wallet.startsWith('0x')) continue;
          try {
            await discoverIdentities(wallet, env, { forceRefresh: true });
            rechecked++;
          } catch {
            // Skip wallets that fail — likely stale entries
          }
        }
      } while (cursor);
      log('info', '[scheduled] identity re-discovery complete', { rechecked });
    } catch (err) {
      log('error', '[scheduled] identity re-discovery failed', err);
    }
    try {
      const { initSourceHealth } = await import('./routes/source-health');
      const allSourcesRaw = await env.CACHE?.get('discovered:sources:all');
      if (allSourcesRaw) {
        const allSources = JSON.parse(allSourcesRaw) as Array<{
          id: string;
          platform: string;
          weeklyActivity: number;
          relevanceScore: number;
          score: number;
        }>;
        for (const source of allSources) {
          await initSourceHealth(env, source as Parameters<typeof initSourceHealth>[1]);
        }
      }
      log('info', '[scheduled] health tracking initialized for sources');
    } catch (err) {
      log('error', '[scheduled] health init failed', err);
    }

    // Run health maintenance (stale detection + culling)
    try {
      const { runWeeklyHealthMaintenance } = await import('./routes/source-health');
      const result = await runWeeklyHealthMaintenance(env);
      log(
        'info',
        `[scheduled] health maintenance: ${result.checked} checked, ${result.stale} stale, ${result.culled} culled`,
      );
    } catch (err) {
      log('error', '[scheduled] health maintenance failed', err);
    }

    // Record KV last-run timestamp
    await env.CACHE?.put('discovered:sources:discovery:last-run', String(Date.now()));
  }
}

// ─── Helper: retry sync dead letters ─────────────────────────────────────

async function retrySyncDeadLetters(env: Env): Promise<number> {
  try {
    const { retryDeadLetters } = await import('./lib/sync-queue');
    return retryDeadLetters(env, 50);
  } catch {
    return 0;
  }
}
