'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type FontSize = 'sm' | 'md' | 'lg';
export type LineSpacing = 'compact' | 'comfortable' | 'relaxed';

const STORAGE_KEY = 'df_reader_settings';

interface ReadingSettings {
  fontSize: FontSize;
  lineSpacing: LineSpacing;
}

function getStored(): ReadingSettings {
  if (typeof window === 'undefined') return { fontSize: 'md', lineSpacing: 'comfortable' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ReadingSettings;
  } catch { /* ignore */ }
  return { fontSize: 'md', lineSpacing: 'comfortable' };
}

function store(settings: ReadingSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
}

function getSnapshot(): ReadingSettings {
  return getStored();
}

function getServerSnapshot(): ReadingSettings {
  return { fontSize: 'md', lineSpacing: 'comfortable' };
}

export function useReadingSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFontSize = useCallback((fontSize: FontSize) => {
    const next = { ...getStored(), fontSize };
    store(next);
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new Event('storage'));
  }, []);

  const setLineSpacing = useCallback((lineSpacing: LineSpacing) => {
    const next = { ...getStored(), lineSpacing };
    store(next);
    window.dispatchEvent(new Event('storage'));
  }, []);

  return { settings, setFontSize, setLineSpacing };
}
