import { describe, expect, it, vi } from 'vitest';
import {
  FetchError,
  fetchJson,
  fetchWithFallbacks,
  withConcurrencyLimit,
  withRetry,
  withTimeout,
} from '../utils';

describe('withTimeout', () => {
  it('resolves when promise finishes first', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'test');
    expect(result).toBe(42);
  });

  it('rejects on timeout', async () => {
    await expect(withTimeout(new Promise((r) => setTimeout(r, 2000)), 10, 'slow')).rejects.toThrow(
      'slow timeout',
    );
  });
});

describe('withRetry', () => {
  it('retries transient failures', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error('boom');
      return 'ok';
    });
    const result = await withRetry(fn, 2);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(withRetry(fn, 1)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('fetchJson', () => {
  it('parses json on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ hello: 'world' }),
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    });
    const data = await fetchJson('https://example.com');
    expect(data).toEqual({ hello: 'world' });
  });

  it('throws FetchError and cancels body on non-2xx', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
      body: { cancel },
    });
    await expect(fetchJson('https://example.com')).rejects.toThrow(FetchError);
    expect(cancel).toHaveBeenCalled();
  });
});

describe('fetchWithFallbacks', () => {
  it('tries endpoints in order', async () => {
    const fetcher = vi.fn();
    fetcher.mockRejectedValueOnce(new Error('first failed'));
    fetcher.mockResolvedValueOnce('second ok');
    const result = await fetchWithFallbacks(['https://a', 'https://b'], fetcher);
    expect(result).toBe('second ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('throws when all endpoints fail', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('all failed'));
    await expect(fetchWithFallbacks(['https://a', 'https://b'], fetcher)).rejects.toThrow(
      'all failed',
    );
  });
});

describe('withConcurrencyLimit', () => {
  it('limits concurrency', async () => {
    let running = 0;
    let maxRunning = 0;
    const fn = vi.fn(async (item: number) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return item * 2;
    });
    const results = await withConcurrencyLimit([1, 2, 3, 4], 2, fn);
    expect(results).toEqual([2, 4, 6, 8]);
    expect(maxRunning).toBeLessThanOrEqual(2);
  });
});
