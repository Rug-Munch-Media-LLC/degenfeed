'use client';

import { useEffect, useRef, useState } from 'react';

const LAST_VISIT_KEY = 'df_last_visit_time';
const AWAY_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface ReturningInfo {
  /** True if the user was away for more than 30 min */
  isReturning: boolean;
  /** How long they were away in milliseconds */
  awayDurationMs: number;
  /** Whether the "While you were away" card should show */
  showCard: boolean;
  /** Dismiss the card */
  dismiss: () => void;
}

/**
 * Detects when a user returns to the feed after being away for >30 min.
 * Reads `last_visit` from sessionStorage on mount.
 * Writes `last_visit` on unmount / visibility change.
 *
 * @returns {ReturningInfo} Whether user is returning, away duration, dismiss handler
 */
export function useReturningUser(): ReturningInfo {
  const [showCard, setShowCard] = useState(false);
  const awayDurationRef = useRef(0);
  const isReturningRef = useRef(false);

  useEffect(() => {
    const now = Date.now();

    // Read last visit
    let lastVisit: number | null = null;
    try {
      const raw = sessionStorage.getItem(LAST_VISIT_KEY);
      if (raw) lastVisit = Number.parseInt(raw, 10);
    } catch {
      /* ignore */
    }

    if (lastVisit && now - lastVisit > AWAY_THRESHOLD_MS) {
      isReturningRef.current = true;
      awayDurationRef.current = now - lastVisit;
      setShowCard(true);
    }

    // Update last visit
    try {
      sessionStorage.setItem(LAST_VISIT_KEY, String(now));
    } catch {
      /* ignore */
    }

    // Update on pagehide / visibilitychange (save when user navigates away)
    const save = () => {
      try {
        sessionStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });

    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
      save(); // Save on unmount
    };
  }, []);

  const dismiss = () => {
    setShowCard(false);
  };

  return {
    isReturning: isReturningRef.current,
    awayDurationMs: awayDurationRef.current,
    showCard,
    dismiss,
  };
}
