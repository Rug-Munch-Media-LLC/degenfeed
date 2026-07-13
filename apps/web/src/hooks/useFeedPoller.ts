'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FeedPollerResult<T extends { id: string }> {
  /** Number of new posts discovered since the last refresh */
  newPostCount: number;
  /** New posts discovered since the last refresh (newest first) */
  newPosts: T[];
  /** Whether the poller is actively running */
  isPolling: boolean;
  /** Timestamp (ms) of the last successful poll, or null */
  lastPolledAt: number | null;
  /** Clear new-post state. Call after merging new posts into the feed. */
  refresh: () => void;
}

/**
 * Polls a feed endpoint at a configurable interval, tracking newly-arrived
 * posts by their `id`. Pauses when the tab is hidden and resumes on
 * visibility change, so we don't waste bandwidth when the user isn't looking.
 *
 * @param fetchFunction  Async function that returns the current feed items.
 * @param pollingInterval  Milliseconds between polls (default 60_000).
 * @param enabled  Set to `false` to pause polling entirely (default true).
 */
export function useFeedPoller<T extends { id: string }>(
  fetchFunction: () => Promise<T[]>,
  pollingInterval: number = 60_000,
  enabled: boolean = true,
): FeedPollerResult<T> {
  const [newPosts, setNewPosts] = useState<T[]>([]);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchFnRef = useRef(fetchFunction);
  const enabledRef = useRef(enabled);

  // Keep refs in sync without re-creating the interval
  fetchFnRef.current = fetchFunction;
  enabledRef.current = enabled;

  const poll = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      const result = await fetchFnRef.current();
      const now = Date.now();
      setLastPolledAt(now);

      // Find posts whose IDs we haven't seen before
      const unknown: T[] = [];
      for (const item of result) {
        if (!knownIdsRef.current.has(item.id)) {
          unknown.push(item);
          knownIdsRef.current.add(item.id);
        }
      }

      if (unknown.length > 0) {
        setNewPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const trulyNew = unknown.filter((p) => !existingIds.has(p.id));
          if (trulyNew.length === 0) return prev;
          return [...trulyNew, ...prev];
        });
      }
    } catch {
      // Silently swallow errors — the feed UI must not crash
    }
  }, []);

  const refresh = useCallback(() => {
    setNewPosts([]);
  }, []);

  // Seed known IDs on mount and start the polling interval
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const seed = async () => {
      try {
        const result = await fetchFnRef.current();
        if (cancelled) return;
        for (const item of result) {
          knownIdsRef.current.add(item.id);
        }
        setLastPolledAt(Date.now());
      } catch {
        // silent
      }
    };
    seed();

    intervalRef.current = setInterval(poll, pollingInterval);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollingInterval, poll]);

  // Pause / resume with tab visibility
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Tab came back — poll immediately and restart the interval
        poll();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(poll, pollingInterval);
      } else {
        // Tab hidden — pause to save resources
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, pollingInterval, poll]);

  return {
    newPostCount: newPosts.length,
    newPosts,
    isPolling: enabled,
    lastPolledAt,
    refresh,
  };
}
