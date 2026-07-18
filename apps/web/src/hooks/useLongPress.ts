'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook for long-press gesture detection on mobile.
 * Fires `onLongPress` after the element is pressed for `delay` ms.
 *
 * @param onLongPress  Callback when long-press is detected
 * @param delay        Hold duration in ms (default 500)
 * @returns handlers   Spread onto the target element
 */
export function useLongPress(
  onLongPress?: (e: React.TouchEvent | React.MouseEvent) => void,
  delay = 500,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      triggered.current = false;
      timerRef.current = setTimeout(() => {
        triggered.current = true;
        onLongPress?.(e);
      }, delay);
    },
    [onLongPress, delay],
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      start(e);
    },
    [start],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (triggered.current) {
        e.preventDefault();
      }
      clear();
    },
    [clear],
  );

  const onTouchMove = useCallback(() => {
    clear();
  }, [clear]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      start(e);
    },
    [start],
  );

  const onMouseUp = useCallback(() => {
    clear();
  }, [clear]);

  const onMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
  };
}
