'use client';

import { useCallback, useRef } from 'react';

/**
 * Provides haptic-style feedback for engagement actions (like, repost, bookmark).
 * Uses the Vibration API if available, and manages animation state via CSS classes.
 *
 * Returns handlers for each action type that trigger both vibration and animation.
 */
export function useHapticFeedback() {
  const lastVibratedRef = useRef(0);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        // Throttle vibrations to avoid spam (min 200ms between)
        const now = Date.now();
        if (now - lastVibratedRef.current > 200) {
          lastVibratedRef.current = now;
          navigator.vibrate(Array.isArray(pattern) ? pattern : [pattern]);
        }
      }
    } catch {
      // Vibration API not available — silently skip
    }
  }, []);

  const triggerLike = useCallback(() => {
    vibrate([20, 30, 15]); // Quick double-tap feel
  }, [vibrate]);

  const triggerRepost = useCallback(() => {
    vibrate([30, 20, 30]); // Repost: two medium pulses
  }, [vibrate]);

  const triggerBookmark = useCallback(() => {
    vibrate([15]); // Single short pulse
  }, [vibrate]);

  const triggerReply = useCallback(() => {
    vibrate([10]); // Very subtle tap
  }, [vibrate]);

  return {
    triggerLike,
    triggerRepost,
    triggerBookmark,
    triggerReply,
    vibrate,
    /** Check if vibration is supported */
    isSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  };
}
