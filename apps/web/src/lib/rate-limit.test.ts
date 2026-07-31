/**
 * @degenfeed/web — rate-limit unit tests
 *
 * Covers the CVSS 8.6 rate-limit bypass fix (spoofable X-Forwarded-For) and
 * the memory-exhaustion guard (periodic cleanup of the token bucket Map).
 */
import { describe, expect, it, vi } from 'vitest';
import { getClientIpFromHeaders, globalLimiter, TokenBucket } from './rate-limit';

function headers(init: Record<string, string | null>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(init)) {
    if (v !== null) h.set(k, v);
  }
  return h;
}

describe('getClientIpFromHeaders (rate-limit bypass fix)', () => {
  it('prefers cf-connecting-ip and ignores spoofed XFF entirely', () => {
    const h = headers({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });
    expect(getClientIpFromHeaders(h)).toBe('203.0.113.10');
  });

  it('uses the RIGHTMOST x-forwarded-for entry (our proxy-appended IP), not the leftmost attacker value', () => {
    const h = headers({
      'x-forwarded-for': '1.2.3.4, 198.51.100.7',
    });
    expect(getClientIpFromHeaders(h)).toBe('198.51.100.7');
  });

  it('handles a single XFF entry', () => {
    const h = headers({ 'x-forwarded-for': '198.51.100.7' });
    expect(getClientIpFromHeaders(h)).toBe('198.51.100.7');
  });

  it('ignores empty/whitespace XFF entries', () => {
    const h = headers({ 'x-forwarded-for': '1.2.3.4,   , 198.51.100.7' });
    expect(getClientIpFromHeaders(h)).toBe('198.51.100.7');
  });

  it('falls back to x-real-ip when neither CF nor XFF is present', () => {
    const h = headers({ 'x-real-ip': '198.51.100.9' });
    expect(getClientIpFromHeaders(h)).toBe('198.51.100.9');
  });

  it('falls back to 127.0.0.1 when nothing is present', () => {
    expect(getClientIpFromHeaders(new Headers())).toBe('127.0.0.1');
  });
});

describe('TokenBucket', () => {
  it('allows requests up to maxTokens then denies', () => {
    const bucket = new TokenBucket({ maxTokens: 3, refillRate: 0 });
    expect(bucket.check('ip-a').allowed).toBe(true);
    expect(bucket.check('ip-a').allowed).toBe(true);
    expect(bucket.check('ip-a').allowed).toBe(true);
    const denied = bucket.check('ip-a');
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it('keeps per-key buckets independent', () => {
    const bucket = new TokenBucket({ maxTokens: 1, refillRate: 0 });
    expect(bucket.check('ip-a').allowed).toBe(true);
    expect(bucket.check('ip-a').allowed).toBe(false);
    expect(bucket.check('ip-b').allowed).toBe(true);
  });

  it('cleanup() evicts stale buckets but keeps fresh ones', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const bucket = new TokenBucket({ maxTokens: 1, refillRate: 0 });
    bucket.check('stale-key');
    bucket.check('fresh-key');

    // Advance past the 120s max age.
    vi.setSystemTime(new Date('2026-01-01T00:03:00Z'));
    bucket.check('fresh-key'); // keep fresh-key alive
    bucket.cleanup();

    expect(bucket.size).toBe(1);

    vi.useRealTimers();
  });

  it('opportunistically sweeps stale buckets past the threshold (edge-runtime guard)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const bucket = new TokenBucket({ maxTokens: 1, refillRate: 0 });

    // Fill past the sweep threshold (10_000 buckets).
    for (let i = 0; i < 10_000; i += 1) {
      bucket.check(`old-ip-${i}`);
    }
    expect(bucket.size).toBe(10_000);

    // Age all old buckets beyond the 120s max age.
    vi.setSystemTime(new Date('2026-01-01T00:03:00Z'));

    // Enough checks to cross SWEEP_EVERY_N_CHECKS (64) a couple of times.
    for (let i = 0; i < 128; i += 1) {
      bucket.check(`new-ip-${i}`);
    }

    // Old buckets evicted; only the new ones remain.
    expect(bucket.size).toBe(128);

    vi.useRealTimers();
  });

  it('registers the periodic cleanup interval on module load', () => {
    const holder = globalThis as { __degenfeedRateLimitCleanupTimer?: unknown };
    expect(holder.__degenfeedRateLimitCleanupTimer).toBeDefined();
  });
});

describe('singleton limiters (tiers)', () => {
  it('global limiter allows initial requests', () => {
    const result = globalLimiter.check('singleton-test-ip');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });
});
