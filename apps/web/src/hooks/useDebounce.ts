'use client';

import { useEffect, useMemo, useRef } from 'react';

/**
 * useDebounce — creates a debounced version of a callback.
 *
 * Optimizes INP by ensuring expensive handlers (scroll, resize,
 * search, filter) don't block the main thread.
 *
 * @example
 * ```tsx
 * const handleScroll = useDebounce((e: Event) => {
 *   expensiveLayoutCalc();
 * }, 100);
 * ```
 */
export function useDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(() => {
    const debounced = (...args: unknown[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fnRef.current(...args);
      }, delay);
    };
    return debounced as T;
  }, [delay]) as T;
}

/**
 * useThrottle — creates a throttled version of a callback.
 * Unlike debounce, it fires immediately and then at most once
 * per `limit` ms.
 */
export function useThrottle<T extends (...args: unknown[]) => void>(fn: T, limit: number): T {
  const inThrottleRef = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useMemo(() => {
    const throttled = (...args: unknown[]) => {
      if (!inThrottleRef.current) {
        fnRef.current(...args);
        inThrottleRef.current = true;
        setTimeout(() => {
          inThrottleRef.current = false;
        }, limit);
      }
    };
    return throttled as T;
  }, [limit]) as T;
}

/**
 * useIdleCallback — runs a function during browser idle time.
 * Falls back to setTimeout(..., 1) if requestIdleCallback isn't available.
 *
 * Use to break up long tasks and improve INP.
 *
 * @example
 * ```tsx
 * useIdleCallback(() => {
 *   processHeavyList(largeData);
 * }, [largeData]);
 * ```
 */
export function useIdleCallback(fn: () => void, deps: unknown[], timeout = 50) {
  useEffect(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(() => fn(), { timeout });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(fn, 1);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
