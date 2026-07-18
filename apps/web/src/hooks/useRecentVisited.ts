'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'df_recent_visited';
const MAX_ITEMS = 10;

interface VisitedPage {
  href: string;
  label: string;
  timestamp: number;
}

/**
 * Hook that tracks recently visited pages.
 * Saves to localStorage and provides a list for the sidebar "recently visited" section.
 */
export function useRecentVisited() {
  const [recent, setRecent] = useState<VisitedPage[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: VisitedPage[] = JSON.parse(raw) as VisitedPage[];
        setRecent(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const trackVisit = useCallback((href: string, label: string) => {
    setRecent((prev) => {
      const filtered = prev.filter((p) => p.href !== href);
      const next: VisitedPage[] = [{ href, label, timestamp: Date.now() }, ...filtered].slice(
        0,
        MAX_ITEMS,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { recent, trackVisit, clearRecent };
}
