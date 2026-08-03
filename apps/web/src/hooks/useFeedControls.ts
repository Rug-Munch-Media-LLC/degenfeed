'use client';

/**
 * @degenfeed/web — useFeedControls
 *
 * State + persistence for user-controllable feed controls.
 *
 * Persistence layers (priority high → low):
 *   1. URL query params  (?sort=trending&protocols=nostr,farcaster&time=24h)
 *   2. localStorage      (df_feed_controls_v1)
 *   3. Defaults
 *
 * URL params win over localStorage so shareable links / deep links behave
 * predictably. Changes are written back to the URL via history.replaceState
 * (no navigation) and debounced to localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FEED_CONTROLS,
  type FeedControls,
  parseControlsFromParams,
  serializeControls,
} from '../lib/feedRanking';

const STORAGE_KEY = 'df_feed_controls_v1';
const SAVE_DEBOUNCE_MS = 400;

function mergeControls(...patches: Array<Partial<FeedControls> | null | undefined>): FeedControls {
  const merged: FeedControls = {
    ...DEFAULT_FEED_CONTROLS,
    algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm },
  };
  for (const patch of patches) {
    if (!patch) continue;
    Object.assign(merged, patch);
    if (patch.algorithm) Object.assign(merged.algorithm, patch.algorithm);
  }
  return merged;
}

function loadStorage(): Partial<FeedControls> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeedControls>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function initialControls(): FeedControls {
  if (typeof window === 'undefined') return DEFAULT_FEED_CONTROLS;
  return mergeControls(
    loadStorage(),
    parseControlsFromParams(new URLSearchParams(window.location.search)),
  );
}

/** Rewrite the current URL, preserving unrelated params. */
function writeUrlParams(params: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', url.toString());
}

export interface UseFeedControlsResult {
  controls: FeedControls;
  /** Replace the full controls (from FeedControls onChange). */
  setControls: (next: FeedControls) => void;
  /** Merge a partial update. */
  patchControls: (patch: Partial<FeedControls>) => void;
  /** Restore defaults. */
  resetControls: () => void;
}

export function useFeedControls(): UseFeedControlsResult {
  const [controls, setControlsState] = useState<FeedControls>(initialControls);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced localStorage persistence.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
      } catch {
        /* storage full / unavailable — URL params still carry the state */
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [controls]);

  // URL sync (no navigation). Remove params that match defaults so URLs
  // stay tidy; serializeControls only emits non-default params.
  useEffect(() => {
    writeUrlParams(serializeControls(controls));
  }, [controls]);

  const setControls = useCallback((next: FeedControls) => {
    setControlsState(next);
  }, []);

  const patchControls = useCallback((patch: Partial<FeedControls>) => {
    setControlsState((prev) => mergeControls(prev, patch));
  }, []);

  const resetControls = useCallback(() => {
    setControlsState(DEFAULT_FEED_CONTROLS);
  }, []);

  return { controls, setControls, patchControls, resetControls };
}
