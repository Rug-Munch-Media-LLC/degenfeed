/**
 * Token bucket rate limiter.
 *
 * Uses an in-memory Map (per-edge-instance). For global consistency across
 * edge workers, swap for Cloudflare KV or Upstash Redis.
 *
 * USAGE:
 *   const result = globalLimiter.check(ip);
 *   result.allowed ? NextResponse.next() : 429;
 */

// == Types ==================================================================

export interface RateLimitResult {
  /** Whether the request is allowed through */
  allowed: boolean;
  /** Remaining tokens in the bucket (floored) */
  remaining: number;
  /** Unix timestamp (seconds) when the limit resets */
  resetTime: number;
}

export interface RateLimitConfig {
  /** Maximum burst of consecutive requests */
  maxTokens: number;
  /** Continuous refill rate — tokens per second — determines the sustained RPS */
  refillRate: number;
}

// == Bucket internals =======================================================

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// == Client IP extraction ===================================================
//
// SECURITY: The key fed into the token bucket is the client identity. If an
// attacker can control it per-request they bypass the rate limit entirely
// (CVSS 8.6 — unlimited brute-force on /api/auth, /api/tip, /api/admin).

interface HeaderSource {
  get(name: string): string | null;
}

/**
 * Extract a trustworthy client IP for rate limiting / abuse detection.
 *
 * Trust model (must match the origin proxy topology — see deploy/nginx.conf):
 *
 *   1. `cf-connecting-ip` — overwritten by Cloudflare at the edge. When
 *      present it is the ONLY authoritative source; the `x-forwarded-for`
 *      chain is attacker-influenced (nginx appends to it, it does not
 *      sanitize client-supplied entries), so XFF is ignored entirely.
 *   2. Rightmost entry of `x-forwarded-for` — only for direct origin access
 *      (no Cloudflare). Our origin nginx uses
 *      `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, which
 *      APPENDS `$remote_addr` to any client-supplied XFF. The rightmost entry
 *      is therefore the one added by our own proxy and cannot be spoofed by
 *      the client (as long as no untrusted proxy sits in front of nginx).
 *   3. `x-real-ip` — set by nginx when configured.
 *   4. Fallback `127.0.0.1` (local/dev).
 *
 * NEVER take the leftmost XFF entry: with `$proxy_add_x_forwarded_for` it is
 * fully attacker-controlled (`X-Forwarded-For: <spoof>, <real-ip>`), which
 * would let anyone rotate their rate-limit identity per request.
 */
export function getClientIpFromHeaders(headers: HeaderSource): string {
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const entries = xff
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      if (lastEntry !== undefined) return lastEntry;
    }
  }

  return headers.get('x-real-ip') ?? '127.0.0.1';
}

// == Memory-bounding constants ==============================================
// Every bucket Map grows when clients rotate keys. `cleanup()` evicts entries
// idle longer than BUCKET_MAX_AGE_MS. We call it (a) on a module-level timer
// for long-lived runtimes (Node) and (b) opportunistically inside `check()`
// for edge isolates where intervals are not guaranteed to persist.

const BUCKET_MAX_AGE_MS = 120_000;
const SWEEP_BUCKET_THRESHOLD = 10_000; // entries before we start sweeping
const SWEEP_EVERY_N_CHECKS = 64; // amortize the O(n) sweep cost
const CLEANUP_INTERVAL_MS = 120_000;

// == TokenBucket class ======================================================

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();
  private readonly config: RateLimitConfig;
  /** Amortized sweep counter — bounds the cost of opportunistic cleanup. */
  private sweepCounter = 0;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check and consume one token for a given key (typically an IP address).
   *
   * - Tokens refill continuously at `refillRate` per second.
   * - When denied, `resetTime` is the earliest moment at least one token
   *   will be available (not when the bucket is fully recharged).
   */
  check(key: string): RateLimitResult {
    const now = Date.now();

    // Opportunistic sweep: bound memory growth even on runtimes where the
    // module-level timer below does not survive (edge isolates). Amortized
    // so we only scan the Map every SWEEP_EVERY_N_CHECKS requests once the
    // bucket count passes the threshold.
    if (this.buckets.size >= SWEEP_BUCKET_THRESHOLD) {
      this.sweepCounter += 1;
      if (this.sweepCounter % SWEEP_EVERY_N_CHECKS === 0) {
        this.cleanup(BUCKET_MAX_AGE_MS);
      }
    }

    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill based on wall-clock elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refill = elapsed * this.config.refillRate;
    bucket.tokens = Math.min(this.config.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      // Consume one token
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetTime: Math.ceil((now + 60_000) / 1000),
      };
    }

    // Rate limited — return when the next token will be available
    const tokensNeeded = 1 - bucket.tokens;
    const msUntilAvailable = Math.ceil((tokensNeeded / this.config.refillRate) * 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.ceil((now + msUntilAvailable) / 1000),
    };
  }

  /**
   * Evict stale entries that haven't been touched in `maxAge` ms.
   * Call periodically to prevent unbounded memory growth.
   */
  cleanup(maxAge = BUCKET_MAX_AGE_MS): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /** Exposed for testing / diagnostics */
  get size(): number {
    return this.buckets.size;
  }
}

// == Singleton limiters =====================================================
// Each tier maps to a specific endpoint / method group from the spec.
//
// The refill rate is derived as  maxTokens / windowSeconds  so the bucket
// fully recharges over the stated window.  Single-token consumption per
// check gives a clean "allowed in window" semantic.

/** Global: 100 requests per 60 seconds per IP */
export const globalLimiter = new TokenBucket({
  maxTokens: 100,
  refillRate: 100 / 60, // ~1.67 tokens/s
});

/** POST / PUT / DELETE: 30 requests per 60 seconds per IP */
export const writeLimiter = new TokenBucket({
  maxTokens: 30,
  refillRate: 30 / 60, // 0.5 tokens/s
});

/** POST /api/tip/create: 10 per 60 seconds */
export const tipLimiter = new TokenBucket({
  maxTokens: 10,
  refillRate: 10 / 60, // ~0.167 tokens/s
});

/** POST /api/publish: 20 per 60 seconds */
export const publishLimiter = new TokenBucket({
  maxTokens: 20,
  refillRate: 20 / 60, // ~0.333 tokens/s
});

/** POST /api/admin/*: 20 per 60 seconds */
export const adminLimiter = new TokenBucket({
  maxTokens: 20,
  refillRate: 20 / 60, // ~0.333 tokens/s
});

/** POST /api/auth/*: 5 per 60 seconds (brute-force prevention) */
export const authLimiter = new TokenBucket({
  maxTokens: 5,
  refillRate: 5 / 60, // ~0.083 tokens/s
});

// == Periodic cleanup =======================================================
// Prevents unbounded memory growth (DoS) when the per-key bucket Maps grow
// under key rotation. Guarded against double registration so Next.js dev
// hot-reload never leaks duplicate timers. `unref()`d in Node so it never
// keeps the process alive; on edge runtimes the in-check sweep takes over.

interface GlobalCleanupTimerHolder {
  __degenfeedRateLimitCleanupTimer?: ReturnType<typeof setInterval>;
}

const ALL_LIMITERS = [
  globalLimiter,
  writeLimiter,
  tipLimiter,
  publishLimiter,
  adminLimiter,
  authLimiter,
];

function startCleanupInterval(): void {
  const holder = globalThis as GlobalCleanupTimerHolder;
  if (holder.__degenfeedRateLimitCleanupTimer !== undefined) return;

  const timer = setInterval(() => {
    for (const limiter of ALL_LIMITERS) {
      limiter.cleanup(BUCKET_MAX_AGE_MS);
    }
  }, CLEANUP_INTERVAL_MS);

  // Node: do not keep the process alive just for cleanup.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }

  holder.__degenfeedRateLimitCleanupTimer = timer;
}

startCleanupInterval();
