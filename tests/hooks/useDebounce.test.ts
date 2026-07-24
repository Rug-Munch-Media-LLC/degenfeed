/**
 * @degenfeed/web — useDebounce, useThrottle, useIdleCallback Tests
 *
 * Covers:
 * - useDebounce delays execution and only fires after delay
 * - useDebounce cancels previous pending call
 * - useDebounce cleans up timer on unmount
 * - useThrottle fires immediately then limits
 * - useIdleCallback runs the function
 */

// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should delay execution by the specified delay', async () => {
    const { useDebounce } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useDebounce(fn, 500));

    act(() => {
      result.current('test');
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('should cancel previous pending call when called again', async () => {
    const { useDebounce } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useDebounce(fn, 300));

    act(() => {
      result.current('first');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current('second');
    });

    // Only 'second' should fire after the full delay from the second call
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('second');
  });

  it('should clear timer on unmount', async () => {
    const { useDebounce } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result, unmount } = renderHook(() => useDebounce(fn, 200));

    act(() => {
      result.current('test');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('should pass multiple arguments through', async () => {
    const { useDebounce } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useDebounce(fn, 100));

    act(() => {
      result.current('arg1', 'arg2', 42);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 42);
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fire immediately on first call', async () => {
    const { useThrottle } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useThrottle(fn, 1000));

    act(() => {
      result.current('test');
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('test');
  });

  it('should ignore calls within the throttle window', async () => {
    const { useThrottle } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useThrottle(fn, 500));

    act(() => {
      result.current('first');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Second call within window — should be ignored
    act(() => {
      result.current('second');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // After the window, should fire again
    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current('third');
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('should fire again after the limit expires', async () => {
    const { useThrottle } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    const { result } = renderHook(() => useThrottle(fn, 300));

    act(() => {
      result.current('a');
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for the window to expire
    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      result.current('b');
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('useIdleCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should call the function', async () => {
    const { useIdleCallback } = await import('../../apps/web/src/hooks/useDebounce');
    const fn = vi.fn();

    renderHook(() => useIdleCallback(fn, [], 50));

    // With fake timers, requestIdleCallback won't fire automatically,
    // but the fallback setTimeout(..., 1) should
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(fn).toHaveBeenCalled();
  });
});
