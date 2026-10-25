/**
 * @degenfeed/utils — bounded concurrency contract tests
 *
 * Asserts the three invariants callers rely on: index-aligned results, a hard
 * in-flight ceiling, and per-item failure isolation.
 */

import { describe, expect, it, vi } from 'vitest';
import { withConcurrencyLimit } from './concurrency';

const tick = () => new Promise<void>((r) => setTimeout(r, 5));

describe('withConcurrencyLimit', () => {
  it('resolves to an empty array and never calls fn for an empty list', async () => {
    const fn = vi.fn(async (n: number) => n);
    await expect(withConcurrencyLimit([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('preserves input order regardless of completion order', async () => {
    const out = await withConcurrencyLimit([10, 20, 30, 40], 4, async (n) => {
      await new Promise((r) => setTimeout(r, n / 10));
      return n * 2;
    });
    expect(out).toEqual([20, 40, 60, 80]);
  });

  it('never exceeds the limit while in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    await withConcurrencyLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
      return n;
    });
    expect(peak).toBe(3);
  });

  it('runs strictly serially at limit 1', async () => {
    const order: number[] = [];
    await withConcurrencyLimit([1, 2, 3], 1, async (n) => {
      order.push(n);
      await tick();
      return n;
    });
    expect(order).toEqual([1, 2, 3]);
  });

  it('clamps a zero or negative limit to a single in-flight call', async () => {
    await expect(withConcurrencyLimit([1, 2], 0, async (n) => n * 2)).resolves.toEqual([2, 4]);
    await expect(withConcurrencyLimit([1, 2], -3, async (n) => n * 2)).resolves.toEqual([2, 4]);
  });

  it('isolates a rejected item without rejecting the batch, leaving a hole', async () => {
    const out = await withConcurrencyLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(1);
    expect(out[2]).toBe(3);
    // Contract: the failing slot stays undefined — callers must tolerate holes.
    expect(out[1]).toBeUndefined();
  });

  it('runs more items than the limit to completion', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const out = await withConcurrencyLimit(items, 5, async (n) => n + 1);
    expect(out).toEqual(items.map((n) => n + 1));
  });
});
