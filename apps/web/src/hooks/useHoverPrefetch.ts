'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

/**
 * useHoverPrefetch — prefetches a Next.js route when the user hovers over an element.
 *
 * Returns { onMouseEnter, onMouseLeave, onTouchStart } handlers.
 * Apply to any clickable element wrapping a route.
 *
 * Debounces the hover by `debounceMs` (default 150ms) to avoid
 * prefetching during fast cursor sweeps over the feed.
 *
 * @example
 * ```tsx
 * const prefetch = useHoverPrefetch();
 *
 * <Link
 *   href="/post/123"
 *   onMouseEnter={prefetch.onMouseEnter}
 *   onTouchStart={prefetch.onTouchStart}
 * >
 *   ...
 * </Link>
 * ```
 */
export function useHoverPrefetch(debounceMs = 150) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback(
    (href: string) => {
      // Only prefetch each route once per session
      if (prefetchedRef.current.has(href)) return;
      prefetchedRef.current.add(href);
      try {
        router.prefetch(href);
      } catch {
        // prefetch may fail for external URLs — ignore
      }
    },
    [router],
  );

  const onMouseEnter = useCallback(
    (href: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => prefetch(href), debounceMs);
    },
    [prefetch, debounceMs],
  );

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (href: string) => {
      // Prefetch immediately on touch (before click)
      prefetch(href);
    },
    [prefetch],
  );

  return { onMouseEnter, onMouseLeave, onTouchStart };
}
