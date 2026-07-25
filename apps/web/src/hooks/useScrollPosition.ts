'use client';

/**
 * useScrollPosition — Persists and restores scroll position per key (e.g., tab).
 *
 * Stores scroll positions in a Map keyed by tab ID.
 * On scroll, updates the current key's position.
 * On key change, restores the previous position.
 */

import { useCallback, useEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

export function useScrollPosition(
  activeKey: string,
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const prevKeyRef = useRef(activeKey);

  // Save current position when key changes
  useEffect(() => {
    const prevKey = prevKeyRef.current;
    if (prevKey !== activeKey) {
      // Save current position
      scrollPositions.set(prevKey, window.scrollY);

      // Restore previous position for new key
      const saved = scrollPositions.get(activeKey);
      if (saved !== undefined && saved > 0) {
        // Defer to next frame to let DOM settle
        requestAnimationFrame(() => {
          window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }

      prevKeyRef.current = activeKey;
    }
  }, [activeKey]);

  // Save on scroll
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.set(activeKey, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeKey]);

  const clearPosition = useCallback((key: string) => {
    scrollPositions.delete(key);
  }, []);

  const clearAll = useCallback(() => {
    scrollPositions.clear();
  }, []);

  return { clearPosition, clearAll };
}
