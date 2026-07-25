/**
 * @degenfeed/api-worker — Backend Route Quality Tests
 *
 * Verifies input validation, error response format, CORS headers,
 * cache headers, pagination, and rate limiting behavior.
 *
 * Tests the REAL route handlers with mocked KV storage.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// ─── Mock KV factory ─────────────────────────────────────────────────────

function createMockKv() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
  } as unknown as KVNamespace;
}

function createEnv(): Env {
  return { CACHE: createMockKv(), AUTH_SECRET: 'test-secret-32-bytes-minimum!!!' } as unknown as Env;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Input Validation', () => {
  it('sanitizes strings by removing control characters and truncating', async () => {
    const { sanitizeString } = await import('../sanitize');
    // Control chars (\x00, \x1f) are removed; spaces are preserved; trimmed
    const result = sanitizeString('  hello\x00world\x1f!  ', 20);
    expect(result).toBe('helloworld!');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('returns empty string for non-string sanitize input', async () => {
    const { sanitizeString } = await import('../sanitize');
    expect(sanitizeString(null, 100)).toBe('');
    expect(sanitizeString(undefined, 100)).toBe('');
    expect(sanitizeString(123, 100)).toBe('');
  });

  it('validates EVM addresses correctly', async () => {
    const { isValidEvmAddress } = await import('../sanitize');
    expect(isValidEvmAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    expect(isValidEvmAddress('0x1234')).toBe(false);
    expect(isValidEvmAddress('not-an-address')).toBe(false);
    expect(isValidEvmAddress('')).toBe(false);
  });

  it('validates Solana addresses correctly', async () => {
    const { isValidSolanaAddress } = await import('../sanitize');
    // Valid base58 Solana address (32-44 chars)
    expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true);
    expect(isValidSolanaAddress('short')).toBe(false);
    expect(isValidSolanaAddress('')).toBe(false);
  });

  it('validates allowed protocols', async () => {
    const { isAllowedProtocol } = await import('../sanitize');
    expect(isAllowedProtocol('nostr')).toBe(true);
    expect(isAllowedProtocol('farcaster')).toBe(true);
    expect(isAllowedProtocol('bluesky')).toBe(true);
    expect(isAllowedProtocol('solana')).toBe(true);
    expect(isAllowedProtocol('invalid_protocol')).toBe(false);
    expect(isAllowedProtocol('')).toBe(false);
  });

  it('detects suspicious payloads (XSS patterns)', async () => {
    const { hasSuspiciousPayload } = await import('../sanitize');
    expect(hasSuspiciousPayload('<script>alert("xss")</script>')).toBe(true);
    expect(hasSuspiciousPayload('javascript:void(0)')).toBe(true);
    expect(hasSuspiciousPayload('onerror=alert(1)')).toBe(true);
    expect(hasSuspiciousPayload('<iframe src="evil.com">')).toBe(true);
    expect(hasSuspiciousPayload('normal text without HTML')).toBe(false);
    expect(hasSuspiciousPayload('Hello, DegenFeed!')).toBe(false);
  });

  it('validates fetch URLs for SSRF protection', async () => {
    const { isValidFetchUrl } = await import('../sanitize');
    expect(isValidFetchUrl('https://app.degenfeed.xyz/api/feed')).toBe(true);
    expect(isValidFetchUrl('http://10.0.0.1/admin')).toBe(false); // private IP
    expect(isValidFetchUrl('https://evil.com/malware')).toBe(false); // not allowed
    expect(isValidFetchUrl('ftp://files.example.com')).toBe(false); // bad protocol
    expect(isValidFetchUrl('not-a-url')).toBe(false);
  });

  it('validates body size limits', async () => {
    const { validateBodySize } = await import('../sanitize');
    const smallReq = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': '100' },
    });
    expect(validateBodySize(smallReq, 1000)).toEqual({ ok: true });
    const largeReq = new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-length': '2000' },
    });
    expect(validateBodySize(largeReq, 1000)).toEqual({
      ok: false,
      error: 'Request body too large (max 1000 bytes)',
    });
  });

  it('validates coin names and symbols', async () => {
    const { isValidCoinName, isValidCoinSymbol } = await import('../sanitize');
    expect(isValidCoinName('Bitcoin')).toBe(true);
    expect(isValidCoinName('My Cool Coin')).toBe(true);
    expect(isValidCoinName('')).toBe(false);
    expect(isValidCoinName('a'.repeat(100))).toBe(false);
    expect(isValidCoinSymbol('BTC')).toBe(true);
    expect(isValidCoinSymbol('ETH')).toBe(true);
    expect(isValidCoinSymbol('tiny')).toBe(false); // must be uppercase
    expect(isValidCoinSymbol('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ERROR RESPONSE FORMAT
// ═══════════════════════════════════════════════════════════════════════════

describe('Error Response Format', () => {
  it('response-helpers produce consistent JSON error format', async () => {
    const { badRequest, notFound, forbidden, serverError, rateLimitResponse, methodNotAllowed } =
      await import('../response-helpers');

    const bad = badRequest('Invalid input');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Invalid input' });

    const nf = notFound('Post not found');
    expect(nf.status).toBe(404);
    expect(await nf.json()).toEqual({ error: 'Post not found' });

    const fb = forbidden('Access denied');
    expect(fb.status).toBe(403);
    expect(await fb.json()).toEqual({ error: 'Access denied' });

    const se = serverError('Internal error');
    expect(se.status).toBe(500);
    expect(await se.json()).toEqual({ error: 'Internal error' });

    const rl = rateLimitResponse(5000);
    expect(rl.status).toBe(429);
    expect(rl.headers.get('retry-after')).toBe('5');
    expect(rl.headers.get('cache-control')).toBe('no-store');
    const rlBody = await rl.json() as { error: string; retryAfterMs: number };
    expect(rlBody.error).toBe('Rate limit exceeded');
    expect(rlBody.retryAfterMs).toBe(5000);

    const mn = methodNotAllowed(['POST', 'PUT']);
    expect(mn.status).toBe(405);
    expect(mn.headers.get('allow')).toBe('POST, PUT');
  });

  it('response-helpers produce consistent success format', async () => {
    const { ok, created } = await import('../response-helpers');

    const okRes = ok({ data: [1, 2, 3] });
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('content-type')).toContain('application/json');
    expect(await okRes.json()).toEqual({ data: [1, 2, 3] });

    const createdRes = created({ id: 'new-entity' });
    expect(createdRes.status).toBe(201);
    const body = await createdRes.json();
    expect(body).toEqual({ id: 'new-entity' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CORS HEADERS
// ═══════════════════════════════════════════════════════════════════════════

describe('CORS Headers', () => {
  it('allows known origins', async () => {
    const { isAllowedOrigin } = await import('../cors');
    expect(isAllowedOrigin('https://app.degenfeed.xyz')).toBe(true);
    expect(isAllowedOrigin('https://degenfeed.xyz')).toBe(true);
    expect(isAllowedOrigin('https://social.degenfeed.xyz')).toBe(true);
  });

  it('rejects unknown origins', async () => {
    const { isAllowedOrigin } = await import('../cors');
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('http://malicious.site')).toBe(false);
  });

  it('rejects null or undefined origins', async () => {
    const { isAllowedOrigin } = await import('../cors');
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });

  it('is case-insensitive for origin matching', async () => {
    const { isAllowedOrigin } = await import('../cors');
    expect(isAllowedOrigin('HTTPS://APP.DEGENFEED.XYZ')).toBe(true);
    expect(isAllowedOrigin('https://App.DegenFeed.Xyz')).toBe(true);
  });

  it('generates proper CORS response headers', async () => {
    const { corsHeaders } = await import('../cors');
    const headers = corsHeaders('https://app.degenfeed.xyz');
    expect(headers.get('Access-Control-Allow-Origin')).toBe('https://app.degenfeed.xyz');
    expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(headers.get('Access-Control-Allow-Headers')).toContain('content-type');
    expect(headers.get('Access-Control-Allow-Headers')).toContain('authorization');
  });

  it('returns null origin when origin is not allowed', async () => {
    const { getAllowedOrigin } = await import('../cors');
    const req = new Request('http://localhost', { headers: { origin: 'https://evil.com' } });
    const result = getAllowedOrigin(req);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. TIP HANDLER QUALITY
// ═══════════════════════════════════════════════════════════════════════════

describe('Pagination & Scoring Quality', () => {
  it('leaderboard returns ranked entries sorted by total USD', async () => {
    const { recordUnifiedTip } = await import('../routes/unified-tip-core');
    const { handleUnifiedTipLeaderboard } = await import('../routes/unified-tip');
    const env = createEnv() as any;

    // Create 3 recipients with different amounts
    await recordUnifiedTip(env, {
      platform: 'degenfeed', entityId: 'lb_1', entityType: 'post',
      amountUsd: 100, toUserId: 'top_earner',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed', entityId: 'lb_2', entityType: 'post',
      amountUsd: 50, toUserId: 'second_earner',
    });
    await recordUnifiedTip(env, {
      platform: 'degenfeed', entityId: 'lb_3', entityType: 'post',
      amountUsd: 25, toUserId: 'third_earner',
    });

    const res = await handleUnifiedTipLeaderboard(
      new Request('http://localhost/api/tip/unified/leaderboard?period=alltime'),
      env,
    );
    const body = await res.json() as { entries: Array<{ userId: string; totalUsd: number; rank: number }> };
    expect(body.entries.length).toBe(3);
    expect(body.entries[0]?.userId).toBe('top_earner');
    expect(body.entries[0]?.totalUsd).toBe(100);
  });

  it('stats endpoint returns merged sent/received data', async () => {
    const { recordUnifiedTip } = await import('../routes/unified-tip-core');
    const { handleUnifiedTipStats } = await import('../routes/unified-tip');
    const env = createEnv() as any;

    await recordUnifiedTip(env, {
      platform: 'degenfeed', entityId: 'st_1', entityType: 'post',
      amountUsd: 10, fromUserId: 'alice', toUserId: 'bob',
    });

    const res = await handleUnifiedTipStats(
      new Request('http://localhost/api/tip/unified/stats?userId=bob'),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { received: { totalUsd: number } };
    expect(body.received.totalUsd).toBe(10);
  });

  it('activity endpoint returns newest-first results with platform filter', async () => {
    const { recordUnifiedTip } = await import('../routes/unified-tip-core');
    const { handleUnifiedTipActivity } = await import('../routes/unified-tip');
    const env = createEnv() as any;

    await recordUnifiedTip(env, {
      platform: 'degenfeed', entityId: 'a1', entityType: 'post',
      amountUsd: 5, fromLabel: 'Alice', toLabel: 'Bob',
    });
    await recordUnifiedTip(env, {
      platform: 'bluesky', entityId: 'a2', entityType: 'post',
      amountUsd: 10, fromLabel: 'Charlie', toLabel: 'Diana',
    });

    // No filter — should return both
    const res = await handleUnifiedTipActivity(
      new Request('http://localhost/api/tip/unified/activity'),
      env,
    );
    const body = await res.json() as { activity: Array<{ platform: string }> };
    expect(body.activity.length).toBe(2);

    // Filter by bluesky
    const filtered = await handleUnifiedTipActivity(
      new Request('http://localhost/api/tip/unified/activity?platform=bluesky'),
      env,
    );
    const filteredBody = await filtered.json() as { activity: Array<{ platform: string }> };
    expect(filteredBody.activity.length).toBe(1);
    expect(filteredBody.activity[0]?.platform).toBe('bluesky');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SSRF SAFETY
// ═══════════════════════════════════════════════════════════════════════════

describe('SSRF Safety & URL Validation', () => {
  it('safeFetch blocks private IPs', async () => {
    const { safeFetch } = await import('../sanitize');
    const res = await safeFetch('http://127.0.0.1:8080/admin');
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('Blocked URL');
  });

  it('safeFetch blocks disallowed hosts', async () => {
    const { safeFetch } = await import('../sanitize');
    const res = await safeFetch('https://malware.example.com/exploit');
    expect(res.status).toBe(400);
  });

  it('safeFetch blocks non-http protocols', async () => {
    const { safeFetch } = await import('../sanitize');
    const res = await safeFetch('ftp://files.example.com/data');
    expect(res.status).toBe(400);
  });
});
