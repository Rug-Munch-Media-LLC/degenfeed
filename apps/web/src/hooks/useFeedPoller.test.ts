/**
 * @degenfeed/web — useFeedPoller tests
 *
 * Covers: polling interval, visibility pause/resume, data merging,
 * deduplication, cleanup, error handling, and disabled state.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeedPoller } from './useFeedPoller';

interface TestItem {
  id: string;
  text: string;
}

function createItem(id: string, text?: string): TestItem {
  return { id, text: text ?? `Post ${id}` };
}

describe('useFeedPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // === Basic polling ==================================================

  it('should call fetchFunction immediately on mount', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    await act(async () => {
      renderHook(() => useFeedPoller(fetchFn, 60_000, true));
      // Allow the seed effect to fire
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should poll at the configured interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    await act(async () => {
      renderHook(() => useFeedPoller(fetchFn, 30_000, true));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Advance 30s — should poll again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Advance another 30s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  // === Deduplication ==================================================

  it('should deduplicate posts with known IDs on seed', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a'), createItem('b')]);

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    // After initial seed, known IDs are populated but no newPosts yet
    expect(result.current.newPostCount).toBe(0);
    expect(result.current.newPosts).toEqual([]);
  });

  it('should detect new posts on subsequent polls', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([createItem('a')]);
      // Second call returns two items — 'b' is new
      return Promise.resolve([createItem('a'), createItem('b')]);
    });

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(result.current.newPostCount).toBe(1);
    expect(result.current.newPosts).toEqual([createItem('b')]);
  });

  it('should deduplicate new posts against already-pending newPosts', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([createItem('a')]);
      if (callCount === 2) return Promise.resolve([createItem('a'), createItem('b')]);
      // Third call: 'b' is already in newPosts, 'c' is genuinely new
      return Promise.resolve([createItem('a'), createItem('b'), createItem('c')]);
    });

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    // Poll 2 — discovers 'b'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.newPostCount).toBe(1);

    // Poll 3 — 'b' is still in knownIds, but not in newPosts pending dedup
    // The hook adds 'c' as new, 'b' is already known
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.newPostCount).toBe(2); // b (from earlier) + c (new)
  });

  // === refresh() ======================================================

  it('should clear newPosts when refresh() is called', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([createItem('a')]);
      return Promise.resolve([createItem('a'), createItem('b')]);
    });

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.newPostCount).toBe(1);

    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.newPostCount).toBe(0);
    expect(result.current.newPosts).toEqual([]);
  });

  // === lastPolledAt ===================================================

  it('should update lastPolledAt after successful poll', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);
    const startTime = Date.now();

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.lastPolledAt).not.toBeNull();
    expect(result.current.lastPolledAt!).toBeGreaterThanOrEqual(startTime);
  });

  // === Visibility pause/resume ========================================

  it('should pause polling when the tab is hidden', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    await act(async () => {
      renderHook(() => useFeedPoller(fetchFn, 60_000, true));
      await vi.advanceTimersByTimeAsync(0);
    });

    // Simulate tab hidden
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance past the interval — should NOT poll because paused
    const prevCount = fetchFn.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(fetchFn).toHaveBeenCalledTimes(prevCount); // no new calls
  });

  it('should resume polling when the tab becomes visible', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    await act(async () => {
      renderHook(() => useFeedPoller(fetchFn, 60_000, true));
      await vi.advanceTimersByTimeAsync(0);
    });

    // Hide tab
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Show tab again
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should have polled immediately on becoming visible
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  // === Cleanup ========================================================

  it('should clear interval on unmount', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    const { unmount } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    await act(async () => {
      unmount();
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('should remove visibility event listener on unmount', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      unmount();
    });

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeSpy.mockRestore();
  });

  // === Disabled state =================================================

  it('should not poll when enabled is false', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    await act(async () => {
      renderHook(() => useFeedPoller(fetchFn, 60_000, false));
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  // === isPolling ======================================================

  it('should reflect the enabled state via isPolling', async () => {
    const fetchFn = vi.fn().mockResolvedValue([createItem('a')]);

    const { result: enabledResult } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });
    expect(enabledResult.current.isPolling).toBe(true);

    const { result: disabledResult } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, false));
    });
    expect(disabledResult.current.isPolling).toBe(false);
  });

  // === Error handling =================================================

  it('should not crash when fetchFunction throws', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    // Let the seed run (it will throw, but should be caught)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // newPostCount should remain 0, lastPolledAt should not be set
    expect(result.current.newPostCount).toBe(0);
    expect(result.current.lastPolledAt).toBeNull();

    // Subsequent polls also should not crash
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.newPostCount).toBe(0);
  });

  it('should not crash when fetchFunction returns non-array', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // null is not iterable, the for-of loop throws, but it's caught
    expect(result.current.newPostCount).toBe(0);
  });

  // === Edge: empty fetch result ======================================

  it('should handle empty fetch result gracefully', async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);

    const { result } = await act(async () => {
      return renderHook(() => useFeedPoller(fetchFn, 60_000, true));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.newPostCount).toBe(0);
    expect(result.current.lastPolledAt).not.toBeNull();
  });
});
