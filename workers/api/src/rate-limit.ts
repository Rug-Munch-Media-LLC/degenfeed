/**
 * @degenfeed/api-worker — Rate Limiting
 *
 * In-memory token-bucket rate limiter with tiered protection for
 * brute force, enumeration, scraping, admin, and DDoS attack vectors.
 *
 * Cloudflare Workers isolates are short-lived, so the token buckets are
 * per-isolate and approximate — but they are FREE compared to burning a KV
 * write per request. For cross-isolate enforcement, IPs that are near (or
 * over) their limit are periodically reported to the self-hosted rmi-backend
 * at `{RMI_API_URL}/api/v1/rate-limits/report` (every 60s), which keeps persistent
 * state without blocking every request on KV.
 *
 * If `RATE_LIMIT_DISABLED=true` (local dev), the limiter bypasses entirely
 * and logs once per isolate.
 */

import { RMI_API_URL } from './constants';
import { log } from './logger';
import type { Env, RateLimitResult } from './types';

const DEFAULT_RATE_WINDOW = 5000;
const DEFAULT_RATE_MAX = 20;

// ─── In-memory token buckets (per isolate) ─────────────────────────
// Key = `${ip}:${path}`. Approximate across isolates; exact within one.

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, TokenBucket>();

// ─── In-memory fixed-window counters ──────────────────────────────
// Used for brute-force failures, enumeration attempts, and the global
// per-IP DDoS counter. Shape matches the old KV entries.

interface WindowCounter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, WindowCounter>();

// ─── Cross-isolate sync (rmi-backend) ─────────────────────────────
// IPs near/over their limit are reported to rmi-backend so enforcement
// survives isolate death. Best-effort; never blocks requests.
//
// Backend receives at POST /api/v1/rate-limits/report:
//   { ip, path, count, max, window_ms }

const SYNC_INTERVAL_MS = 60_000;
const NEAR_LIMIT_FRACTION = 0.2; // report when < 20% of tokens remain

interface NearLimitEntry {
  ip: string;
  path: string;
  recordedAt: number;
  count: number;
  max: number;
  windowMs: number;
}

const nearLimitIps = new Map<string, NearLimitEntry>();
let lastSyncAt = 0;

// Log the dev-only RATE_LIMIT_DISABLED bypass once per isolate so it is
// visible in observability without spamming every request.
let rateLimitDisabledWarned = false;

function warnRateLimitDisabled(): void {
  if (rateLimitDisabledWarned) return;
  rateLimitDisabledWarned = true;
  log('warn', '[rate-limit] RATE_LIMIT_DISABLED=true — rate limiting bypassed (dev only)');
}

/**
 * Record an IP+path as near (or over) its limit and trigger the periodic
 * rmi-backend sync when the 60s window elapses.
 */
function markNearLimit(env: Env, ip: string, path: string, count: number, max: number, windowMs: number): void {
  if (!env.RMI_API_URL && !env.RMI_API_KEY) return;
  const key = `${ip}:${path}`;
  nearLimitIps.set(key, { ip, path, recordedAt: Date.now(), count, max, windowMs });
  maybeSyncRateLimits(env);
}

function maybeSyncRateLimits(env: Env): void {
  const now = Date.now();
  if (now - lastSyncAt < SYNC_INTERVAL_MS) return;
  if (nearLimitIps.size === 0) return;
  lastSyncAt = now;
  void syncRateLimitsToRmi(env);
}

/**
 * POST per-entry reports to rmi-backend. On failure the entries are
 * re-queued (capped) so the next sync retries them.
 */
async function syncRateLimitsToRmi(env: Env): Promise<void> {
  if (nearLimitIps.size === 0) return;
  const entries = Array.from(nearLimitIps.values());
  nearLimitIps.clear();
  const baseUrl = (env.RMI_API_URL || RMI_API_URL).replace(/\/+$/, '');
  const authHeaders: Record<string, string> = env.RMI_API_KEY
    ? { authorization: `Bearer ${env.RMI_API_KEY}`, 'content-type': 'application/json' }
    : { 'content-type': 'application/json' };

  const failed: NearLimitEntry[] = [];

  for (const e of entries) {
    try {
      const resp = await fetch(`${baseUrl}/api/v1/rate-limits/report`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ip: e.ip,
          path: e.path,
          count: e.count,
          max: e.max,
          window_ms: e.windowMs,
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) {
        throw new Error(`rmi-backend rate-limit report returned ${resp.status}`);
      }
    } catch (err) {
      failed.push(e);
    }
  }

  if (failed.length > 0) {
    log(
      'warn',
      `[rate-limit] rmi-backend sync failed for ${failed.length} entries (best-effort)`,
    );
    // Re-queue failed entries for the next sync window (bounded).
    for (const e of failed) {
      if (nearLimitIps.size < 5000 && !nearLimitIps.has(`${e.ip}:${e.path}`)) {
        nearLimitIps.set(`${e.ip}:${e.path}`, e);
      }
    }
  }
}

/**
 * Drop buckets that have not been touched in 2+ windows so the per-isolate
 * map cannot grow unbounded under attack.
 */
function cleanupBuckets(now: number, windowMs: number): void {
  if (buckets.size <= 10000) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > windowMs * 2) buckets.delete(key);
  }
}

/**
 * In-memory token-bucket rate limiter (per IP+path).
 *
 * A bucket holds `maxReq` tokens and refills at `maxReq / window` tokens per
 * second. Requests consume one token; when the bucket is empty the request
 * is denied. The bucket shape and defaults match the previous KV
 * fixed-window limiter so callers and tiers behave the same.
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

  const key = `${ip}:${path}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxReq, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time.
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxReq, bucket.tokens + elapsed * (maxReq / (windowMs / 1000)));
  bucket.lastRefill = now;

  cleanupBuckets(now, windowMs);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    // Near the limit — report to rmi-backend for cross-isolate enforcement.
    if (bucket.tokens < NEAR_LIMIT_FRACTION * maxReq) {
      markNearLimit(env, ip, path, maxReq - Math.ceil(bucket.tokens), maxReq, windowMs);
    }
    return { allowed: true, retryAfter: 0 };
  }

  // Over the limit — report to rmi-backend for cross-isolate enforcement.
  markNearLimit(env, ip, path, maxReq, maxReq, windowMs);
  return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
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
 * Read a fixed-window counter, transparently resetting expired entries.
 */
function readCounter(key: string): number {
  const now = Date.now();
  const counter = counters.get(key);
  if (!counter || counter.resetAt <= now) return 0;
  return counter.count;
}

/**
 * Increment a fixed-window counter, returning the new count.
 */
function incrCounter(key: string, windowMs: number): number {
  const now = Date.now();
  const counter = counters.get(key);
  const count = counter && counter.resetAt > now ? counter.count + 1 : 1;
  counters.set(key, { count, resetAt: now + windowMs });
  // Bounded growth: expired counters are dropped once the map gets large.
  if (counters.size > 10000) {
    for (const [k, v] of counters) {
      if (v.resetAt <= now) counters.delete(k);
    }
  }
  return count;
}

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

  // ── Brute force protection (wallet verify) — auth 5/60s ────────
  if (isBruteForcePath(path)) {
    const failureKey = `bf:fail:${ip}`;

    // If in blocked state (>3 failures), use stricter rate
    if (readCounter(failureKey) >= AUTH_BLOCK_MAX) {
      return rateLimit(env, ip, path, AUTH_BLOCK_RATE, AUTH_BLOCK_RATE_WINDOW_MS);
    }

    // Normal: 5/min
    return rateLimit(env, ip, path, AUTH_MAX, AUTH_WINDOW_MS);
  }

  // ── Enumeration protection ─────────────────────────────────────
  if (isEnumerationPath(path)) {
    const enumKey = `enum:${ip}:${path}`;
    const attempts = readCounter(enumKey);

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
    incrCounter(enumKey, ENUMERATION_WINDOW_MS);

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
  const globalCount = incrCounter(globalKey, GLOBAL_DDOS_WINDOW_MS);

  if (globalCount > GLOBAL_DDOS_MAX) {
    markNearLimit(env, ip, path, globalCount, GLOBAL_DDOS_MAX, GLOBAL_DDOS_WINDOW_MS);
    return { allowed: false, retryAfter: Math.ceil(GLOBAL_DDOS_WINDOW_MS / 1000) };
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
 * The count lives in the per-isolate map and is reported to rmi-backend so
 * the block survives isolate death.
 */
export async function recordBruteForceFailure(env: Env, ip: string): Promise<void> {
  const failureKey = `bf:fail:${ip}`;
  incrCounter(failureKey, AUTH_BLOCK_WINDOW_MS);
  const failureCount = readCounter(failureKey);
  markNearLimit(env, ip, '/api/auth/wallet/verify', failureCount, AUTH_BLOCK_MAX, AUTH_BLOCK_WINDOW_MS);
}
