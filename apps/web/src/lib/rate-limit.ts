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

// == TokenBucket class ======================================================

export class TokenBucket {
  private readonly buckets = new Map<string, Bucket>();
  private readonly config: RateLimitConfig;

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
  cleanup(maxAge = 120_000): void {
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
