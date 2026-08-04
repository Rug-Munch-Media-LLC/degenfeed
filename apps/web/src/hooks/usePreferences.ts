'use client';

/**
 * usePreferences — Centralized preference management with multi-layered persistence.
 *
 * Persistence layers:
 * - Appearance (theme, fontSize, density) → localStorage + cookie (theme for SSR)
 * - Notification prefs → KV API (/api/preferences)
 * - Muted/blocked → IndexedDB (via @degenfeed/storage) + KV sync
 * - Content settings → KV API
 */

import { getDb } from '@degenfeed/storage';
import type { Protocol } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyThemeClass } from '../lib/theme';

/* === IndexedDB helpers for muted/blocked ====================== */

async function _idbAddMutedWord(word: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('muted-words', { word: word.toLowerCase(), mutedBy: 'self', mutedAt: Date.now() });
  } catch {
    /* IndexedDB unavailable */
  }
}

async function _idbRemoveMutedWord(word: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('muted-words', [word.toLowerCase(), 'self']);
  } catch {
    /* IndexedDB unavailable */
  }
}

async function _idbAddMutedUser(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('muted', {
      targetId: userId,
      targetHandle: '',
      mutedBy: 'self',
      mutedAt: Date.now(),
    });
  } catch {
    /* IndexedDB unavailable */
  }
}

async function _idbRemoveMutedUser(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('muted', [userId, 'self']);
  } catch {
    /* IndexedDB unavailable */
  }
}

async function _idbAddBlockedUser(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.put('blocked', {
      targetId: userId,
      targetHandle: '',
      protocol: '',
      blockedBy: 'self',
      blockedAt: Date.now(),
    });
  } catch {
    /* IndexedDB unavailable */
  }
}

async function _idbRemoveBlockedUser(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('blocked', [userId, 'self']);
  } catch {
    /* IndexedDB unavailable */
  }
}

/* === Types ==================================================== */

export type Theme = 'dark' | 'light' | 'auto';
export type FontSize = 'small' | 'medium' | 'large';
export type LayoutDensity = 'compact' | 'comfortable' | 'visual';

export type NotificationType = 'likes' | 'reposts' | 'replies' | 'follows' | 'tips';
export type NotificationPreferences = Partial<Record<Protocol, Record<NotificationType, boolean>>>;

export interface PrivacySettings {
  publicProfile: boolean;
  showTipsReceived: boolean;
  showFollowers: boolean;
}

export interface ContentSettings {
  defaultFeed: 'following' | 'for-you' | 'trending';
  mutedWords: string[];
  mutedUsers: string[];
  blockedUsers: string[];
}

export interface AppPreferences {
  theme: Theme;
  fontSize: FontSize;
  layoutDensity: LayoutDensity;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  content: ContentSettings;
}

/* === Defaults ================================================== */

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  nostr: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  farcaster: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  lens: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  bluesky: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  mastodon: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  threads: { likes: true, reposts: true, replies: true, follows: true, tips: true },
  rss: { likes: false, reposts: false, replies: false, follows: false, tips: false },
};

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  fontSize: 'medium',
  layoutDensity: 'comfortable',
  notifications: DEFAULT_NOTIFICATIONS,
  privacy: { publicProfile: true, showTipsReceived: true, showFollowers: true },
  content: { defaultFeed: 'for-you', mutedWords: [], mutedUsers: [], blockedUsers: [] },
};

/* === Storage keys ============================================== */

const LS_THEME = 'df_theme';
const LS_FONT_SIZE = 'df_font_size';
const LS_DENSITY = 'df_layout_density';
const LS_NOTIFICATIONS = 'df_notifications';
const LS_PRIVACY = 'df_privacy';
const LS_CONTENT = 'df_content';
const COOKIE_THEME = 'df-theme';

/* === Helpers =================================================== */

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded */
  }
}

function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()};SameSite=Lax`;
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  // Keep <html> classes/data-theme consistent with the pre-paint bootstrap
  // script in the root layout (exactly one of dark/light, never both).
  applyThemeClass(theme);
}

function applyDensity(density: LayoutDensity): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('feed-density-dense', 'feed-density-visual');
  if (density === 'compact') {
    root.classList.add('feed-density-dense');
  } else if (density === 'visual') {
    root.classList.add('feed-density-visual');
  }
}

function applyFontSize(size: FontSize): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('reader-sm', 'reader-md', 'reader-lg');
  if (size === 'small') root.classList.add('reader-sm');
  else if (size === 'large') root.classList.add('reader-lg');
  else root.classList.add('reader-md');
}

/* === Hook ====================================================== */

export function usePreferences() {
  const [prefs, setPrefs] = useState<AppPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    return {
      theme: getLocal<Theme>(LS_THEME, 'dark'),
      fontSize: getLocal<FontSize>(LS_FONT_SIZE, 'medium'),
      layoutDensity: getLocal<LayoutDensity>(LS_DENSITY, 'comfortable'),
      notifications: getLocal<NotificationPreferences>(LS_NOTIFICATIONS, DEFAULT_NOTIFICATIONS),
      privacy: getLocal<PrivacySettings>(LS_PRIVACY, DEFAULT_PREFERENCES.privacy),
      content: getLocal<ContentSettings>(LS_CONTENT, DEFAULT_PREFERENCES.content),
    };
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Ref to capture latest prefs for async callbacks (avoids stale closures)
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  /**
   * Persist all preferences to the KV API server.
   * Uses prefsRef to get the latest state — safe to call right after a setPrefs.
   */
  const persistToServer = useCallback(async () => {
    const current = prefsRef.current;
    if (saveStatus === 'saving') return; // avoid duplicate saves
    setSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(current),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
    // Intentionally no deps — uses prefsRef.current for fresh state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus]);

  // Apply visual preferences on mount and when they change
  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);
  useEffect(() => {
    applyDensity(prefs.layoutDensity);
  }, [prefs.layoutDensity]);
  useEffect(() => {
    applyFontSize(prefs.fontSize);
  }, [prefs.fontSize]);

  // Listen for system color-scheme changes in auto mode
  useEffect(() => {
    if (prefs.theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [prefs.theme]);

  /* === Setters =============================================== */

  const setTheme = useCallback((theme: Theme) => {
    setPrefs((p) => ({ ...p, theme }));
    setLocal(LS_THEME, theme);
    setCookie(COOKIE_THEME, theme);
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setPrefs((p) => ({ ...p, fontSize }));
    setLocal(LS_FONT_SIZE, fontSize);
  }, []);

  const setLayoutDensity = useCallback((layoutDensity: LayoutDensity) => {
    setPrefs((p) => ({ ...p, layoutDensity }));
    setLocal(LS_DENSITY, layoutDensity);
  }, []);

  const setNotifications = useCallback((notifications: NotificationPreferences) => {
    setPrefs((p) => ({ ...p, notifications }));
    setLocal(LS_NOTIFICATIONS, notifications);
  }, []);

  const toggleNotificationType = useCallback(
    (protocol: Protocol, type: NotificationType) => {
      setPrefs((p) => {
        const updated = {
          ...p.notifications,
          [protocol]: {
            ...p.notifications[protocol],
            [type]: !p.notifications[protocol]?.[type],
          },
        };
        setLocal(LS_NOTIFICATIONS, updated);
        return { ...p, notifications: updated };
      });
      // Auto-save to server (no debounce needed — prefsRef ensures fresh state)
      persistToServer();
    },
    [persistToServer],
  );

  const setPrivacy = useCallback(
    (privacy: PrivacySettings) => {
      setPrefs((p) => ({ ...p, privacy }));
      setLocal(LS_PRIVACY, privacy);
      // Auto-save to server
      persistToServer();
    },
    [persistToServer],
  );

  const setContent = useCallback((content: ContentSettings) => {
    setPrefs((p) => ({ ...p, content }));
    setLocal(LS_CONTENT, content);
  }, []);

  /* === Save to KV API ======================================== */

  const saveToServer = useCallback(async () => {
    setSaveStatus('saving');
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          theme: prefs.theme,
          fontSize: prefs.fontSize,
          layoutDensity: prefs.layoutDensity,
          notifications: prefs.notifications,
          privacy: prefs.privacy,
          content: prefs.content,
        }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  /* === Muted / Blocked management ============================ */

  const addMutedWord = useCallback(async (word: string) => {
    setPrefs((p) => {
      const updated = { ...p.content, mutedWords: [...p.content.mutedWords, word] };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbAddMutedWord(word).catch(() => {});
    try {
      await fetch('/api/preferences/muted-words', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ word }),
      });
    } catch {
      /* background sync best-effort */
    }
  }, []);

  const removeMutedWord = useCallback(async (word: string) => {
    setPrefs((p) => {
      const updated = { ...p.content, mutedWords: p.content.mutedWords.filter((w) => w !== word) };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbRemoveMutedWord(word).catch(() => {});
    try {
      await fetch(`/api/preferences/muted-words?word=${encodeURIComponent(word)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const addMutedUser = useCallback(async (userId: string) => {
    setPrefs((p) => {
      const updated = { ...p.content, mutedUsers: [...p.content.mutedUsers, userId] };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbAddMutedUser(userId).catch(() => {});
    try {
      await fetch('/api/preferences/muted-users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const removeMutedUser = useCallback(async (userId: string) => {
    setPrefs((p) => {
      const updated = {
        ...p.content,
        mutedUsers: p.content.mutedUsers.filter((u) => u !== userId),
      };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbRemoveMutedUser(userId).catch(() => {});
    try {
      await fetch(`/api/preferences/muted-users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const addBlockedUser = useCallback(async (userId: string) => {
    setPrefs((p) => {
      const updated = { ...p.content, blockedUsers: [...p.content.blockedUsers, userId] };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbAddBlockedUser(userId).catch(() => {});
    try {
      await fetch('/api/preferences/blocked-users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch {
      /* best-effort */
    }
  }, []);

  const removeBlockedUser = useCallback(async (userId: string) => {
    setPrefs((p) => {
      const updated = {
        ...p.content,
        blockedUsers: p.content.blockedUsers.filter((u) => u !== userId),
      };
      setLocal(LS_CONTENT, updated);
      return { ...p, content: updated };
    });
    await _idbRemoveBlockedUser(userId).catch(() => {});
    try {
      await fetch(`/api/preferences/blocked-users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      /* best-effort */
    }
  }, []);

  return {
    prefs,
    setTheme,
    setFontSize,
    setLayoutDensity,
    setNotifications,
    toggleNotificationType,
    setPrivacy,
    setContent,
    saveToServer,
    saving,
    saveStatus,
    addMutedWord,
    removeMutedWord,
    addMutedUser,
    removeMutedUser,
    addBlockedUser,
    removeBlockedUser,
  };
}
