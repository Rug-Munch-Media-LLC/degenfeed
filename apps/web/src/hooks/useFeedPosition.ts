'use client';

import { useCallback, useEffect, useRef } from 'react';

const POSITION_KEY = 'df_feed_position';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface SavedPosition {
  scrollY: number;
  timestamp: number;
  pathname: string;
}

/**
 * Hook that saves and restores the feed scroll position.
 * On mount, restores the position if we're returning to the feed
 * within 30 minutes. On unmount, saves the current position.
 *
 * Uses `sessionStorage` for per-tab isolation with a timestamp
 * so the position expires after 30 min.
 *
 * @param containerRef  Ref to the feed scroll container
 * @param enabled       Enable position saving (default true)
 */
export function useFeedPosition(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  const restored = useRef(false);

  const savePosition = useCallback(() => {
    if (!enabled) return;
    const scrollY = window.scrollY;
    if (scrollY <= 0) return;

    try {
      const entry: SavedPosition = {
        scrollY,
        timestamp: Date.now(),
        pathname: window.location.pathname,
      };
      sessionStorage.setItem(POSITION_KEY, JSON.stringify(entry));
    } catch {
      /* ignore */
    }
  }, [enabled]);

  const restorePosition = useCallback(() => {
    if (!enabled || restored.current) return;
    try {
      const raw = sessionStorage.getItem(POSITION_KEY);
      if (!raw) return;
      const entry = JSON.parse(raw) as SavedPosition;

      // Only restore if same page and within expiry window
      if (
        entry.pathname === window.location.pathname &&
        Date.now() - entry.timestamp < EXPIRY_MS
      ) {
        restored.current = true;
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          window.scrollTo({ top: entry.scrollY, behavior: 'instant' as ScrollBehavior });
        });
      }
    } catch {
      /* ignore */
    }
  }, [enabled]);

  // Restore on mount
  useEffect(() => {
    restorePosition();
  }, [restorePosition]);

  // Save on scroll (throttled)
  useEffect(() => {
    if (!enabled) return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          savePosition();
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Save on unmount
      savePosition();
    };
  }, [enabled, savePosition]);

  return { savePosition, restorePosition };
}
