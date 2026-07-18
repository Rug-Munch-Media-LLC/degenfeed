'use client';

/**
 * NotificationProvider — shared notification state via React Context.
 *
 * Wraps the notification polling + WebSocket real-time updates so
 * LeftSidebar, BottomNav, and the Notifications page all share the
 * same state. Eliminates badge desync when markAllRead fires or
 * new notifications arrive via WebSocket.
 */

import { CHANNELS, useRealtimeContext } from '@degenfeed/realtime';
import type { Notification } from '@degenfeed/ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../components/AuthProvider';
import { getCached, setCache } from '../lib/fetchWithCache';
import { retryFetch } from '../lib/retryFetch';

/* ─── Constants ────────────────────────────────────────────── */

const READ_KEY = 'degenfeed_notifications_read';
const POLL_MS = 60000;
const MAX_READ_IDS = 500;

/* ─── Types ────────────────────────────────────────────────── */

interface NotificationAuth {
  nostr_pubkey?: string;
  mastodon?: string;
  mastodon_instance?: string;
  bluesky?: {
    handle?: string;
    did?: string;
    accessJwt?: string;
  };
  farcaster?: {
    fid?: string;
    signerKey?: string;
  };
  lens?: string;
  lens_profileId?: string;
}

type NotificationProtocolPrefs = Partial<Record<string, boolean | Record<string, boolean>>>;

export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  notificationPrefs: NotificationProtocolPrefs | null;
  saveNotificationPrefs: (prefs: NotificationProtocolPrefs) => void;
}

/* ─── Context ──────────────────────────────────────────────── */

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    // Still provide a noop fallback so callers don't crash if rendered
    // without the provider (e.g. during testing or on landing page).
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: () => {},
      markRead: () => {},
      markAllRead: () => {},
      notificationPrefs: null,
      saveNotificationPrefs: () => {},
    };
  }
  return ctx;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw) as string[];
    if (arr.length > MAX_READ_IDS) {
      const trimmed = arr.slice(-MAX_READ_IDS);
      localStorage.setItem(READ_KEY, JSON.stringify(trimmed));
      return new Set(trimmed);
    }
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

function buildAuth(
  identities: Array<{
    protocol: string;
    publicId: string;
    keys?: Record<string, string | undefined>;
    handle?: string;
  }>,
): NotificationAuth {
  const auth: NotificationAuth = {};
  for (const identity of identities) {
    if (identity.protocol === 'nostr') {
      auth.nostr_pubkey = identity.publicId;
    } else if (identity.protocol === 'mastodon') {
      auth.mastodon = identity.keys?.accessToken ?? undefined;
      auth.mastodon_instance = identity.keys?.instanceUrl ?? 'https://social.degenfeed.xyz';
    } else if (identity.protocol === 'bluesky') {
      auth.bluesky = {
        handle: identity.handle,
        did: identity.publicId,
        accessJwt: identity.keys?.accessJwt ?? undefined,
      };
    } else if (identity.protocol === 'farcaster') {
      auth.farcaster = {
        fid: identity.publicId,
        signerKey: identity.keys?.signerKey ?? undefined,
      };
    } else if (identity.protocol === 'lens') {
      auth.lens = identity.keys?.accessToken ?? undefined;
      auth.lens_profileId = identity.publicId;
    }
  }
  return auth;
}

/* ─── Provider ─────────────────────────────────────────────── */

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { ready, signedInProtocols } = useAuth();
  const { subscribe } = useRealtimeContext();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationProtocolPrefs | null>(
    null,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationsRef = useRef<Notification[]>(notifications);

  // Keep ref in sync for use in callbacks
  notificationsRef.current = notifications;

  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  // Initialize read IDs from localStorage
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  // Core fetch function
  const fetchNotifications = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const { getAllIdentities } = await import('@degenfeed/storage');
      const identities = await getAllIdentities();
      const auth = buildAuth(
        identities as Array<{
          protocol: string;
          publicId: string;
          keys?: Record<string, string | undefined>;
          handle?: string;
        }>,
      );
      const hasAny =
        auth.nostr_pubkey ||
        auth.mastodon ||
        auth.bluesky?.accessJwt ||
        auth.farcaster?.fid ||
        auth.lens;
      if (!hasAny) {
        setNotifications([]);
        return;
      }
      const res = await retryFetch('/api/notifications', {
        fetchOptions: {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          body: JSON.stringify({ auth }),
        },
      });
      const data = (await res.json()) as { notifications?: Notification[] };
      const fetched = data.notifications || [];
      setCache('notifications', fetched);
      const currentRead = loadReadIds();
      setNotifications(
        fetched.map((n) => ({
          ...n,
          read: n.read || currentRead.has(n.id),
        })),
      );
    } catch {
      // Graceful degradation: show cached notifications on failure
      const cached = getCached<Notification[]>('notifications');
      if (cached && notificationsRef.current.length === 0) {
        const currentRead = loadReadIds();
        setNotifications(
          cached.map((n) => ({
            ...n,
            read: n.read || currentRead.has(n.id),
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  // Polling + initial fetch
  useEffect(() => {
    if (!hasSignedIn) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchNotifications, hasSignedIn]);

  // ── WebSocket: real-time notification increment ──
  useEffect(() => {
    if (!hasSignedIn) return;
    const unsub = subscribe(CHANNELS.NOTIFICATIONS_NEW, (_data: unknown) => {
      // When a new notification arrives via WS, immediately re-fetch
      // to get the full updated list with correct unread count.
      fetchNotifications();
    });
    return unsub;
  }, [subscribe, fetchNotifications, hasSignedIn]);

  // ── Mark read ──
  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  // ── Mark all read ──
  const markAllRead = useCallback(() => {
    // POST to backend to persist the mark-all-read state (fire-and-forget)
    void (async () => {
      try {
        await retryFetch('/api/notifications/mark-all-read', {
          maxRetries: 1,
          fetchOptions: {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          },
        });
      } catch {
        // Non-critical — local state update happens regardless
      }
    })();
    // Update local state immediately for responsiveness
    const current = notificationsRef.current;
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of current) next.add(n.id);
      saveReadIds(next);
      return next;
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // ── Notification prefs ──
  const fetchNotificationPrefs = useCallback(async () => {
    try {
      const res = await retryFetch('/api/preferences', {
        maxRetries: 2,
        fetchOptions: { credentials: 'include', cache: 'no-store' },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: NotificationProtocolPrefs };
      if (data.notifications) setNotificationPrefs(data.notifications);
    } catch {
      /* ignore */
    }
  }, []);

  const saveNotificationPrefs = useCallback(async (prefs: NotificationProtocolPrefs) => {
    setNotificationPrefs(prefs);
    try {
      await retryFetch('/api/preferences', {
        maxRetries: 2,
        fetchOptions: {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notifications: prefs }),
        },
      });
    } catch {
      /* ignore */
    }
  }, []);

  // Fetch prefs once on mount
  useEffect(() => {
    fetchNotificationPrefs();
  }, [fetchNotificationPrefs]);

  // Derive unread count
  const decorated = notifications.map((n) => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }));
  const unreadCount = decorated.filter((n) => !n.read).length;

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: decorated,
      unreadCount,
      loading,
      fetchNotifications,
      markRead,
      markAllRead,
      notificationPrefs,
      saveNotificationPrefs,
    }),
    [
      decorated,
      unreadCount,
      loading,
      fetchNotifications,
      markRead,
      markAllRead,
      notificationPrefs,
      saveNotificationPrefs,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
