'use client';

/**
 * @degenfeed/ui — ReadingPosition (useReadingPosition)
 *
 * Saves and restores the user's scroll position per feed/tab.
 * Persists to localStorage so returning to a tab picks up where they left off.
 *
 * Hook: useReadingPosition(feedKey) → { savePosition, restorePosition, hasSavedPosition }
 */

import { useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'df:reading:';

function getStorageKey(feedKey: string): string {
  return `${STORAGE_PREFIX}${feedKey}`;
}

export interface ReadingPositionState {
  scrollY: number;
  topPostId?: string;
  timestamp: number;
}

/**
 * Hook that manages reading position memory.
 *
 * @param feedKey - Unique key for this feed/tab (e.g. "for-you", "following", "nostr")
 * @param enabled - Whether to track position (default: true)
 */
export function useReadingPosition(feedKey: string, enabled = true) {
  const savedPosition = useRef<ReadingPositionState | null>(null);

  // Load saved position on mount
  useEffect(() => {
    if (!enabled || !feedKey) return;
    try {
      const raw = localStorage.getItem(getStorageKey(feedKey));
      if (raw) {
        savedPosition.current = JSON.parse(raw) as ReadingPositionState;
      }
    } catch {
      /* ignore */
    }
  }, [feedKey, enabled]);

  /** Save current scroll position */
  const savePosition = useCallback(
    (topPostId?: string) => {
      if (!enabled || !feedKey) return;
      const state: ReadingPositionState = {
        scrollY: window.scrollY,
        topPostId,
        timestamp: Date.now(),
      };
      savedPosition.current = state;
      try {
        localStorage.setItem(getStorageKey(feedKey), JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
    [feedKey, enabled],
  );

  /** Restore scroll position (call after feed data loads) */
  const restorePosition = useCallback(() => {
    if (!savedPosition.current || !enabled) return;
    const { scrollY } = savedPosition.current;
    // Use rAF to wait for DOM to render
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' as ScrollBehavior });
    });
  }, [enabled]);

  /** Clear saved position */
  const clearPosition = useCallback(() => {
    savedPosition.current = null;
    try {
      localStorage.removeItem(getStorageKey(feedKey));
    } catch {
      /* ignore */
    }
  }, [feedKey]);

  return {
    savePosition,
    restorePosition,
    clearPosition,
    hasSavedPosition: !!savedPosition.current,
  };
}
