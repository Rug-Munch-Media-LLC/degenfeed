import { describe, expect, it } from 'vitest';
import {
  generateCsrfToken,
  MemoryCsrfStore,
  sanitizeInput,
  sanitizeObject,
  TokenBucketRateLimiter,
  validateCsrfToken,
} from '../index';

describe('sanitizeInput', () => {
  it('should strip script tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
  });

  it('should strip event handlers', () => {
    const result = sanitizeInput('<div onload="evil()">hello</div>');
    expect(result).not.toContain('onload');
  });

  it('should encode HTML special characters', () => {
    expect(sanitizeInput('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(sanitizeInput('a&b')).toBe('a&amp;b');
    expect(sanitizeInput('"quote"')).toBe('&quot;quote&quot;');
  });

  it('should strip javascript: URIs', () => {
    const result = sanitizeInput('javascript:alert(1)');
    expect(result).not.toContain('javascript');
  });

  it('should handle non-string input', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should strip iframe, object, embed, svg tags', () => {
    expect(sanitizeInput('<iframe src="http://evil.com">')).toBe('');
    expect(sanitizeInput('<object data="evil.swf">')).toBe('');
    expect(sanitizeInput('<embed src="evil.swf">')).toBe('');
    expect(sanitizeInput('<svg onload="alert(1)">')).toBe('');
  });
});

describe('sanitizeObject', () => {
  it('should sanitize all string values in an object', () => {
    const input = {
      name: '<script>alert(1)</script>',
      bio: '<b>hi</b>',
      nested: {
        inner: '<img src=x onerror=alert(1)>',
      },
    };
    const result = sanitizeObject(input);
    expect(result.name).not.toContain('<script>');
    expect(result.bio).not.toContain('<b>');
    expect((result.nested as Record<string, unknown>).inner).not.toContain('onerror');
  });

  it('should handle arrays', () => {
    const input = {
      tags: ['<script>alert(1)</script>', 'safe'],
      items: [{ title: '<b>hello</b>' }],
    };
    const result = sanitizeObject(input);
    expect(result.tags[0]).not.toContain('<script>');
    expect((result.items[0] as Record<string, unknown>).title).not.toContain('<b>');
  });

  it('should return empty string for non-string input', () => {
    const result = sanitizeObject({ x: 42, y: null, z: true });
    expect(result.x).toBe(42);
    expect(result.y).toBeNull();
    expect(result.z).toBe(true);
  });
});

describe('TokenBucketRateLimiter', () => {
  it('should allow requests within capacity', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 5, refillRate: 1 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('test-key');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block requests exceeding capacity', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 3, refillRate: 10 });
    for (let i = 0; i < 3; i++) limiter.check('test-key');
    const result = limiter.check('test-key');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should handle different keys independently', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 1, refillRate: 1 });
    expect(limiter.check('key-a').allowed).toBe(true);
    expect(limiter.check('key-b').allowed).toBe(true);
    expect(limiter.check('key-a').allowed).toBe(false);
    expect(limiter.check('key-b').allowed).toBe(false);
  });

  it('should support reset', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 1, refillRate: 1 });
    limiter.check('key');
    limiter.reset('key');
    expect(limiter.check('key').allowed).toBe(true);
  });
});

describe('CSRF Tokens', () => {
  it('should generate a 64-char hex token', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(100);
  });
});

describe('MemoryCsrfStore', () => {
  it('should store and retrieve tokens', () => {
    const store = new MemoryCsrfStore();
    store.set('session-1', 'token-123', 60_000);
    expect(store.get('session-1')).toBe('token-123');
  });

  it('should return undefined for expired tokens', async () => {
    const store = new MemoryCsrfStore();
    store.set('session-exp', 'token-exp', 10); // 10ms TTL
    await new Promise((r) => setTimeout(r, 20));
    expect(store.get('session-exp')).toBeUndefined();
  });

  it('should delete tokens after one-time validation', () => {
    const store = new MemoryCsrfStore();
    store.set('session-2', 'token-456', 60_000);
    const valid = validateCsrfToken(store, 'session-2', 'token-456');
    expect(valid).toBe(true);
    expect(store.get('session-2')).toBeUndefined();
  });

  it('should reject invalid tokens', () => {
    const store = new MemoryCsrfStore();
    store.set('session-3', 'token-789', 60_000);
    expect(validateCsrfToken(store, 'session-3', 'wrong-token')).toBe(false);
    expect(validateCsrfToken(store, 'session-3', null)).toBe(false);
    expect(validateCsrfToken(store, 'nonexistent', 'token')).toBe(false);
  });
});
