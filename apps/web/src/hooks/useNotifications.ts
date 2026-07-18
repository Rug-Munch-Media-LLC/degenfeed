'use client';

import type { StoredIdentity } from '@degenfeed/storage';
import { getAllIdentities } from '@degenfeed/storage';
import type { Notification } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCache } from '../lib/fetchWithCache';
import { retryFetch } from '../lib/retryFetch';

const READ_KEY = 'degenfeed_notifications_read';
const POLL_MS = 60000;

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

interface NotificationPrefs {
  likes: boolean;
  reposts: boolean;
  replies: boolean;
  follows: boolean;
  mentions: boolean;
}

type NotificationProtocolPrefs = Partial<Record<string, boolean | NotificationPrefs>>;

function buildAuth(identities: StoredIdentity[]): NotificationAuth {
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

const MAX_READ_IDS = 500;

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw) as string[];
    // Cap to last 500 IDs to prevent unbounded localStorage growth
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

export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationProtocolPrefs | null>(
    null,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const identities = await getAllIdentities();
      const auth = buildAuth(identities);
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
      // Cache notifications for offline use
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
      if (cached && notifications.length === 0) {
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
  }, [enabled, notifications.length]);

  const fetchNotificationPrefs = useCallback(async () => {
    try {
      const res = await retryFetch('/api/preferences', {
        maxRetries: 2,
        fetchOptions: {
          credentials: 'include',
          cache: 'no-store',
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: NotificationProtocolPrefs };
      if (data.notifications) setNotificationPrefs(data.notifications);
    } catch {
      /* ignore — non-critical preferences */
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

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    // POST to backend to persist the mark-all-read state
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
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of notifications) next.add(n.id);
      saveReadIds(next);
      return next;
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  useEffect(() => {
    fetchNotifications();
    fetchNotificationPrefs();
    intervalRef.current = setInterval(fetchNotifications, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications, fetchNotificationPrefs]);

  const decorated = notifications.map((n) => ({
    ...n,
    read: n.read || readIds.has(n.id),
  }));
  const unreadCount = decorated.filter((n) => !n.read).length;

  return {
    notifications: decorated,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    notificationPrefs,
    saveNotificationPrefs,
  };
}
