'use client';

import { useCallback, useRef } from 'react';

/**
 * Hook for double-tap gesture detection.
 * Fires `onDoubleTap` when two taps occur within `delay` ms.
 *
 * @param onDoubleTap  Callback when double-tap is detected
 * @param delay        Max ms between taps (default 300)
 * @returns handlers   Spread onto the target element
 */
export function useDoubleTap(onDoubleTap?: () => void, delay = 300) {
  const lastTap = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout>>();

  const onTap = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      // Ignore if it was an actual click event and not a tap
      if ('button' in e && e.button !== 0) return;

      const now = Date.now();
      const timeSince = now - lastTap.current;

      if (timeSince < delay) {
        // Double-tap detected
        if (tapTimeout.current) {
          clearTimeout(tapTimeout.current);
          tapTimeout.current = undefined;
        }
        lastTap.current = 0;
        onDoubleTap?.();
      } else {
        lastTap.current = now;
        // Reset after delay so it doesn't carry over
        tapTimeout.current = setTimeout(() => {
          lastTap.current = 0;
        }, delay);
      }
    },
    [onDoubleTap, delay],
  );

  return {
    onClick: onTap,
    onTouchEnd: onTap,
  };
}
