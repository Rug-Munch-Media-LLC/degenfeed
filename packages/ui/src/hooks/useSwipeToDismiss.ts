'use client';

import { useCallback, useRef } from 'react';

/**
 * useSwipeToDismiss — swipe-down-to-dismiss for bottom-sheet modals.
 *
 * Returns handlers to spread onto the sheet panel. Dismisses when the user
 * swipes down past `threshold` px on touch devices (mobile only, via a
 * pointer: coarse media check). Safe to attach alongside other handlers.
 */
export function useSwipeToDismiss(onDismiss: () => void, threshold = 80) {
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const dy = (e.changedTouches[0]?.clientY ?? touchStartY.current) - touchStartY.current;
      touchStartY.current = null;
      if (dy > threshold && window.matchMedia('(max-width: 640px)').matches) onDismiss();
    },
    [onDismiss, threshold],
  );

  return { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd };
}
