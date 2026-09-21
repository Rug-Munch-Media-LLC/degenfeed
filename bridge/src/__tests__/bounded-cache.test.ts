import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoundedCache } from '../lib/bounded-cache';

afterEach(() => {
  vi.useRealTimers();
});

describe('BoundedCache', () => {
  it('evicts oldest entries beyond maxEntries (LRU)', () => {
    const cache = new BoundedCache<string>({ maxEntries: 3, ttlMs: 60_000 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    cache.set('d', '4'); // evicts 'a'
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe('4');
    cache.dispose();
  });

  it('drops entries after TTL', () => {
    vi.useFakeTimers();
    const cache = new BoundedCache<string>({ maxEntries: 10, ttlMs: 1_000 });
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(1_100);
    expect(cache.get('k')).toBeUndefined();
    cache.sweep();
    expect(cache.size).toBe(0);
    cache.dispose();
  });

  it('enforces byte cap via sizeOf', () => {
    const cache = new BoundedCache<Buffer>({
      maxEntries: 100,
      ttlMs: 60_000,
      maxBytes: 250,
      sizeOf: (v) => v.length,
    });
    cache.set('a', Buffer.alloc(100));
    cache.set('b', Buffer.alloc(100));
    cache.set('c', Buffer.alloc(100)); // pushes total to 300 > 250 → evicts 'a'
    expect(cache.totalBytes).toBeLessThanOrEqual(250);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBeDefined();
    cache.dispose();
  });

  it('sweep removes expired entries without reads', () => {
    vi.useFakeTimers();
    const cache = new BoundedCache<string>({ maxEntries: 10, ttlMs: 1_000 });
    cache.set('x', '1');
    vi.advanceTimersByTime(2_000);
    cache.sweep();
    expect(cache.size).toBe(0);
    cache.dispose();
  });
});
