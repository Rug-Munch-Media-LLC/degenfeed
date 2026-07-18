'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook for swipe-based tab navigation on mobile.
 * Detects horizontal swipe gestures and triggers a tab change.
 *
 * @param onSwipeLeft  Called when user swipes left (→ next tab)
 * @param onSwipeRight Called when user swipes right (→ previous tab)
 * @param threshold    Minimum px distance to trigger (default 50)
 * @returns handlers   Spread onto the tabs container element
 */
export function useSwipeTabs(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 50,
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0]?.clientX ?? 0,
      y: e.touches[0]?.clientY ?? 0,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const dx = endX - touchStart.current.x;
      const dy = endY - touchStart.current.y;

      // Only horizontal swipes, ignore vertical scrolling
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
      touchStart.current = null;
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
