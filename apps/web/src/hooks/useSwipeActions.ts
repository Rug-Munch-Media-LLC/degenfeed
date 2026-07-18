'use client';

import { useCallback, useRef, useState } from 'react';

type SwipeDirection = 'left' | 'right' | null;

interface SwipeActions {
  /** Swipe progress 0–1 in the active direction */
  progress: number;
  /** Which direction is currently active */
  direction: SwipeDirection;
  /** Spread onto the post element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Reset swipe state */
  reset: () => void;
}

/**
 * Hook for swipe actions on post cards.
 * Swipe left → triggers `onSwipeLeft` (e.g. like/bookmark/repost)
 * Swipe right → triggers `onSwipeRight` (e.g. reply)
 *
 * @param onSwipeLeft   Callback when swiped left past threshold
 * @param onSwipeRight  Callback when swiped right past threshold
 * @param threshold     Minimum px to trigger action (default 80)
 */
export function useSwipeActions(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 80,
): SwipeActions {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<SwipeDirection>(null);
  const lastDirection = useRef<SwipeDirection>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0]?.clientX ?? 0,
      y: e.touches[0]?.clientY ?? 0,
    };
    setProgress(0);
    setDirection(null);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const currentX = e.touches[0]?.clientX ?? 0;
    const currentY = e.touches[0]?.clientY ?? 0;
    const dx = currentX - touchStart.current.x;
    const dy = currentY - touchStart.current.y;

    // Only horizontal swipes, ignore vertical scrolling
    if (Math.abs(dx) > Math.abs(dy)) {
      const pct = Math.min(Math.abs(dx) / threshold, 1);
      setProgress(pct);
      setDirection(dx > 0 ? 'right' : 'left');
      lastDirection.current = dx > 0 ? 'right' : 'left';
    }
  }, [threshold]);

  const onTouchEnd = useCallback(() => {
    if (lastDirection.current === 'left') {
      onSwipeLeft?.();
    } else if (lastDirection.current === 'right') {
      onSwipeRight?.();
    }
    setProgress(0);
    setDirection(null);
    touchStart.current = null;
    lastDirection.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  const reset = useCallback(() => {
    setProgress(0);
    setDirection(null);
    touchStart.current = null;
    lastDirection.current = null;
  }, []);

  return {
    progress,
    direction,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    reset,
  };
}
