'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook for swipe-from-left-edge-to-go-back gesture on mobile.
 * Only activates within 30px of the left edge of the viewport.
 * Uses a longer swipe threshold on top-level pages to avoid conflicting
 * with the drawer-open gesture.
 *
 * @param onBack  Callback when the back gesture is completed
 * @param enabled Enable/disable the gesture (default true)
 * @param threshold Minimum px to trigger back (default 80, higher on top pages)
 */
export function useEdgeSwipeBack(onBack?: () => void, enabled = true, threshold = 80) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const x = e.touches[0]?.clientX ?? 0;
    // Only intercept if starting within 30px of the left edge
    if (x <= 30) {
      touchStart.current = {
        x,
        y: e.touches[0]?.clientY ?? 0,
      };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStart.current) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const endY = e.changedTouches[0]?.clientY ?? 0;
      const dx = endX - touchStart.current.x;
      const dy = endY - touchStart.current.y;

      // Must be primarily horizontal and cover at least threshold px
      if (Math.abs(dx) > Math.abs(dy) && dx > threshold) {
        onBack?.();
      }
      touchStart.current = null;
    },
    [onBack, threshold],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);
}
