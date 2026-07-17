'use client';

import { savePreferences } from '@degenfeed/storage';
import type { LayoutDensity } from '@degenfeed/storage';
import { useCallback, useEffect, useState } from 'react';

const DENSITY_STORAGE_KEY = 'df_density';

/**
 * Read initial density from localStorage.
 * Falls back to 'comfortable' if unset or invalid.
 */
function readStoredDensity(): LayoutDensity {
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (stored === 'compact' || stored === 'comfortable') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'comfortable';
}

function applyDensityClass(density: LayoutDensity) {
  document.documentElement.classList.toggle('layout-compact', density === 'compact');
}

/**
 * Hook for managing layout density preference.
 *
 * Persists to localStorage (instant) and IndexedDB/KV (via savePreferences).
 * Toggles `.layout-compact` class on `<html>` for CSS-driven compact mode.
 *
 * Usage:
 * ```tsx
 * const { density, setDensity, toggleDensity } = useLayoutDensity();
 * ```
 */
export function useLayoutDensity() {
  const [density, setDensityState] = useState<LayoutDensity>('comfortable');

  // Initialize from localStorage on mount
  useEffect(() => {
    const initial = readStoredDensity();
    setDensityState(initial);
    applyDensityClass(initial);
  }, []);

  const setDensity = useCallback(
    async (next: LayoutDensity) => {
      setDensityState(next);
      applyDensityClass(next);
      try {
        localStorage.setItem(DENSITY_STORAGE_KEY, next);
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
        const merged = { ...defaults, ...(existing ?? {}), layoutDensity: next };
        await savePreferences(merged);
      } catch {
        /* ignore — offline or no session */
      }
    },
    [],
  );

  const toggleDensity = useCallback(() => {
    setDensity(density === 'comfortable' ? 'compact' : 'comfortable');
  }, [density, setDensity]);

  return {
    density,
    setDensity,
    toggleDensity,
    /** True when compact mode is active */
    isCompact: density === 'compact',
  } as const;
}
