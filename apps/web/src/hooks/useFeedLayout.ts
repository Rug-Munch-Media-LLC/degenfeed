'use client';

import type { FeedLayout } from '@degenfeed/storage';
import { savePreferences } from '@degenfeed/storage';
import { useCallback, useEffect, useState } from 'react';

const LAYOUT_STORAGE_KEY = 'df_layout';

const LAYOUT_LABELS: Record<FeedLayout, string> = {
  compact: 'Compact — Twitter-like density',
  comfortable: 'Comfortable — full cards',
  'media-grid': 'Media Grid — images & videos only',
  reader: 'Reader — clean reading view',
};

const LAYOUT_CYCLE: FeedLayout[] = ['compact', 'comfortable', 'media-grid', 'reader'];

/**
 * Read initial layout from localStorage.
 * Falls back to 'comfortable' if unset or invalid.
 */
function readStoredLayout(): FeedLayout {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (
      stored === 'compact' ||
      stored === 'comfortable' ||
      stored === 'media-grid' ||
      stored === 'reader'
    )
      return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'comfortable';
}

function applyLayoutClass(layout: FeedLayout) {
  const root = document.documentElement;
  // Remove all layout classes first
  for (const l of LAYOUT_CYCLE) {
    root.classList.remove(`layout-${l}`);
  }
  // Add the active one
  root.classList.add(`layout-${layout}`);
}

/**
 * Hook for managing feed layout preference.
 *
 * Persists to localStorage (instant) and IndexedDB/KV (via savePreferences).
 * Toggles `.layout-{name}` class on `<html>` for CSS-driven layout modes.
 *
 * Layouts:
 *  - compact: Twitter-like density
 *  - comfortable: Default full-card layout
 *  - media-grid: Images/videos only in a masonry grid
 *  - reader: Full article view with clean typography
 */
export function useFeedLayout() {
  const [layout, setLayoutState] = useState<FeedLayout>('comfortable');

  // Initialize from localStorage on mount
  useEffect(() => {
    const initial = readStoredLayout();
    setLayoutState(initial);
    applyLayoutClass(initial);
  }, []);

  const setLayout = useCallback(async (next: FeedLayout) => {
    setLayoutState(next);
    applyLayoutClass(next);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    // Fire-and-forget: sync to IndexedDB
    try {
      const { getPrimaryIdentity, getPreferences, getDefaultPreferences } = await import(
        '@degenfeed/storage'
      );
      const primary = await getPrimaryIdentity();
      const identityId = primary?.id ?? 'anon';
      const existing = await getPreferences(identityId);
      const defaults = await getDefaultPreferences(identityId);
      const merged = { ...defaults, ...existing, feedLayout: next };
      await savePreferences(merged);
    } catch {
      /* ignore — offline or no session */
    }
  }, []);

  const cycleLayout = useCallback(() => {
    const currentIndex = LAYOUT_CYCLE.indexOf(layout);
    const nextIndex = (currentIndex + 1) % LAYOUT_CYCLE.length;
    setLayout(LAYOUT_CYCLE[nextIndex]!);
  }, [layout, setLayout]);

  const layoutLabel = LAYOUT_LABELS[layout];

  return {
    layout,
    setLayout,
    cycleLayout,
    layoutLabel,
    /** True when compact mode is active */
    isCompact: layout === 'compact',
    /** True when media-grid mode is active */
    isMediaGrid: layout === 'media-grid',
    /** True when reader mode is active */
    isReader: layout === 'reader',
  } as const;
}
