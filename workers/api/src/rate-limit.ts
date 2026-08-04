/**
 * @degenfeed/api-worker — Rate Limiting
 *
 * KV-backed fixed-window rate limiter with tiered protection for
 * brute force, enumeration, scraping, admin, and DDoS attack vectors.
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

import { log } from './logger';
import type { Env, RateLimitResult } from './types';

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

// Log the dev-only RATE_LIMIT_DISABLED bypass once per isolate so it is
// visible in observability without spamming every request.
let rateLimitDisabledWarned = false;

function warnRateLimitDisabled(): void {
  if (rateLimitDisabledWarned) return;
  rateLimitDisabledWarned = true;
  log('warn', '[rate-limit] RATE_LIMIT_DISABLED=true — rate limiting bypassed (dev only)');
}

/**
 * KV-backed fixed-window rate limiter.
 */
export async function rateLimit(
  env: Env,
  ip: string,
  path: string,
  maxReq: number = DEFAULT_RATE_MAX,
  windowMs: number = DEFAULT_RATE_WINDOW,
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    warnRateLimitDisabled();
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
// Sensible tiers (target): auth 5/60s, tip 10/60s, publish 20/60s,
// admin 20/60s, writes 30/60s, reads 100/60s.

const AUTH_MAX = 5;
const AUTH_WINDOW_MS = 60_000;
const AUTH_BLOCK_MAX = 3;
const AUTH_BLOCK_WINDOW_MS = 1_800_000; // 30 minutes
const AUTH_BLOCK_RATE = 1; // 1 req/min when blocked
const AUTH_BLOCK_RATE_WINDOW_MS = 60_000;

const TIP_MAX = 10;
const TIP_WINDOW_MS = 60_000;

const PUBLISH_MAX = 20;
const PUBLISH_WINDOW_MS = 60_000;

const ENUMERATION_MAX = 3;
const ENUMERATION_WINDOW_MS = 60_000;
const ENUMERATION_BACKOFF_BASE_MS = 10_000; // Start at 10s
const ENUMERATION_BACKOFF_MAX_MS = 300_000; // Cap at 5min

const READS_MAX = 100;
const READS_WINDOW_MS = 60_000;

const WRITES_MAX = 30;
const WRITES_WINDOW_MS = 60_000;

const GLOBAL_DDOS_MAX = 1000;
const GLOBAL_DDOS_WINDOW_MS = 60_000;

const ADMIN_MAX = 20;
const ADMIN_WINDOW_MS = 60_000;

/**
 * Check if a path is a feed/scrape endpoint (reads tier).
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
 * Check if a path is a tip endpoint (tip tier).
 */
function isTipPath(path: string): boolean {
  return path.includes('/tip');
}

/**
 * Check if a path is a publish endpoint (publish tier).
 */
function isPublishPath(path: string): boolean {
  return (
    path.startsWith('/api/publish') ||
    path === '/api/shorts/publish' ||
    path === '/api/shorts/create'
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
 * More specific checks (brute force, enumeration, tip, publish) take
 * priority over general reads/writes/DDoS limits.
 */
export async function tieredRateLimit(
  env: Env,
  ip: string,
  path: string,
  _isAuthenticated: boolean,
  method: string = 'GET',
): Promise<RateLimitResult> {
  if (env.RATE_LIMIT_DISABLED === 'true') {
    warnRateLimitDisabled();
    return { allowed: true, retryAfter: 0 };
  }
  if (!env.CACHE) {
    return { allowed: true, retryAfter: 0 };
  }

  // ── Brute force protection (wallet verify) — auth 5/60s ────────
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
    if (failureCount >= AUTH_BLOCK_MAX) {
      return rateLimit(env, ip, path, AUTH_BLOCK_RATE, AUTH_BLOCK_RATE_WINDOW_MS);
    }

    // Normal: 5/min
    return rateLimit(env, ip, path, AUTH_MAX, AUTH_WINDOW_MS);
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

  // ── Tip protection — 10/60s ────────────────────────────────────
  if (isTipPath(path)) {
    return rateLimit(env, ip, path, TIP_MAX, TIP_WINDOW_MS);
  }

  // ── Publish protection — 20/60s ────────────────────────────────
  if (isPublishPath(path)) {
    return rateLimit(env, ip, path, PUBLISH_MAX, PUBLISH_WINDOW_MS);
  }

  // ── Admin endpoints — 20/60s ───────────────────────────────────
  if (isAdminPath(path)) {
    return rateLimit(env, ip, path, ADMIN_MAX, ADMIN_WINDOW_MS);
  }

  // ── Scraping protection (feed/search endpoints) — reads 100/60s
  if (isScrapePath(path)) {
    return rateLimit(env, ip, path, READS_MAX, READS_WINDOW_MS);
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

  // ── Default: split by request type — writes 30/60s, reads 100/60s
  const isWrite = method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD';
  if (isWrite) {
    return rateLimit(env, ip, path, WRITES_MAX, WRITES_WINDOW_MS);
  }
  return rateLimit(env, ip, path, READS_MAX, READS_WINDOW_MS);
}

/**
 * Record a failed brute force attempt.
 * Called by the wallet verify handler when signature verification fails.
 */
export async function recordBruteForceFailure(env: Env, ip: string): Promise<void> {
  if (!env.CACHE) return;
  const failureKey = `bf:fail:${ip}`;
  const now = Date.now();
  const windowMs = AUTH_BLOCK_WINDOW_MS;
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
