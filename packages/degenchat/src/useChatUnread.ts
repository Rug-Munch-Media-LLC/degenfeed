'use client';

/**
 * @degenfeed/degenchat — useChatUnread
 *
 * Unified unread + pending counter for the DegenChat inbox.
 *
 * Two numbers feed the total:
 *   - `unread`   — server-reported unread conversation count (polled from the
 *     messages API; the fetcher is injectable so the hook stays app-agnostic).
 *   - `pending`  — messages sitting in the offline queue (localStorage) that
 *     failed to send while offline and are waiting for replay.
 *
 * `total = unread + pending`, so the sidebar badge keeps growing while a
 * message is stuck in the queue — users see that their send did not silently
 * vanish.
 *
 *   const { unread, pending, total } = useChatUnread({ enabled: hasSignedIn });
 *
 * The pending count stays reactive to same-tab queue writes (via the
 * `degenchat:offline-queue` CustomEvent dispatched by the send/flush helpers)
 * and to cross-tab writes (via the `storage` event).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOfflineQueue } from './offline-queue';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UseChatUnreadOptions {
  /** Poll the unread count (default true). Disable when the caller already
   *  fetches conversations (e.g. the inbox page) and only needs `pending`. */
  enabled?: boolean;
  /** Unread poll interval in ms (default 30_000). */
  pollIntervalMs?: number;
  /** Override the unread fetcher. Defaults to the DegenFeed conversations
   *  API (`/api/messages/conversations`) summed by `unreadCount`. */
  fetchUnread?: () => Promise<number>;
}

export interface UseChatUnreadResult {
  /** Server-reported unread conversations. */
  unread: number;
  /** Messages queued offline, waiting to be replayed. */
  pending: number;
  /** unread + pending combined. */
  total: number;
  /** True while the first unread fetch is in flight. */
  loading: boolean;
  /** Re-poll the unread count now. */
  refresh: () => void;
}

// ─── Default fetcher (DegenFeed conversations API) ────────────────────────

const DEFAULT_POLL_MS = 30_000;

async function fetchDegenFeedUnread(): Promise<number> {
  const res = await fetch('/api/messages/conversations', { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load conversations: HTTP ${res.status}`);
  const data = (await res.json()) as {
    conversations?: Array<{ unreadCount?: number }>;
  };
  return (data.conversations ?? []).reduce(
    (sum, conv) => sum + (typeof conv.unreadCount === 'number' ? conv.unreadCount : 0),
    0,
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useChatUnread(options: UseChatUnreadOptions = {}): UseChatUnreadResult {
  const {
    enabled = true,
    pollIntervalMs = DEFAULT_POLL_MS,
    fetchUnread = fetchDegenFeedUnread,
  } = options;

  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchRef = useRef(fetchUnread);
  fetchRef.current = fetchUnread;

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  // Pending count from the offline queue — reactive to same-tab and
  // cross-tab queue writes.
  useEffect(() => {
    const sync = () => {
      try {
        setPending(getOfflineQueue().size);
      } catch {
        setPending(0);
      }
    };
    sync();
    window.addEventListener('degenchat:offline-queue', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('degenchat:offline-queue', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Polled unread count.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken re-runs the unread poll
  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const count = await fetchRef.current();
        if (!cancelled) setUnread(count);
      } catch {
        // Keep the previous value — a failed poll is not worth a red screen.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const interval = setInterval(load, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, refreshToken]);

  return { unread, pending, total: unread + pending, loading, refresh };
}
