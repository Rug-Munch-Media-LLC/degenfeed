/**
 * In-memory rate limiter for bridge providers.
 *
 * Usage:
 *   import { checkRateLimit } from '../rate-limiter';
 *   if (!checkRateLimit('rss', { maxRequests: 60, windowMs: 60_000 })) {
 *     console.log('[rss] Rate limited, skipping fetch');
 *     return [];
 *   }
 *
 * Keys are provider-level (e.g. 'rss', 'nostr:relay.damus.io') so different
 * providers / endpoints are tracked independently.
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface Window {
  timestamps: number[];
}

const windows = new Map<string, Window>();

/** Check whether `key` is allowed under `config`. Returns `true` if allowed. */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  let w = windows.get(key);
  if (!w) {
    w = { timestamps: [] };
    windows.set(key, w);
  }
  // Prune expired entries
  const cutoff = now - config.windowMs;
  w.timestamps = w.timestamps.filter((t) => t > cutoff);
  if (w.timestamps.length >= config.maxRequests) {
    return false;
  }
  w.timestamps.push(now);
  return true;
}

/** Return number of remaining requests for `key` in its current window. */
export function remaining(key: string, config: RateLimitConfig): number {
  const now = Date.now();
  const w = windows.get(key);
  if (!w) return config.maxRequests;
  const cutoff = now - config.windowMs;
  const active = w.timestamps.filter((t) => t > cutoff);
  return Math.max(0, config.maxRequests - active.length);
}

/** Reset rate limit tracking for a key. */
export function resetLimit(key: string): void {
  windows.delete(key);
}

/** Reset all rate limit tracking (useful in tests). */
export function resetAll(): void {
  windows.clear();
}
