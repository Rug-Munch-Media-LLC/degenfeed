'use client';

/**
 * @degenfeed/ui — OfflineQueue
 *
 * Queues actions when offline and replays them when connectivity returns.
 * Stores actions in localStorage for persistence across page loads.
 *
 * Hook: useOfflineQueue()
 *   → { isOnline, queue, enqueue, retryAll, clearQueue, pendingCount }
 *
 * Actions are typed by the ActionQueueItem interface.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ────────────────────────────────────────────────── */

export type ActionType =
  | 'like'
  | 'unlike'
  | 'repost'
  | 'reply'
  | 'post'
  | 'follow'
  | 'unfollow'
  | 'tip'
  | 'bookmark';

export interface ActionQueueItem {
  id: string;
  type: ActionType;
  payload: Record<string, unknown>;
  timestamp: number;
  /** Number of retry attempts */
  retries: number;
}

/* ─── Constants ────────────────────────────────────────────── */

const STORAGE_KEY = 'df:offline:queue';
const MAX_RETRIES = 3;
const REPLAY_DELAY_MS = 500; // delay between each replay action

/* ─── Hook ─────────────────────────────────────────────────── */

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queue, setQueue] = useState<ActionQueueItem[]>([]);
  const replayingRef = useRef(false);

  // Load persisted queue
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActionQueueItem[];
        setQueue(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist queue on change
  useEffect(() => {
    try {
      if (queue.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [queue]);

  // Monitor online/offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-replay when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !replayingRef.current) {
      replayAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, replayAll, queue.length]);

  /** Add an action to the queue */
  const enqueue = useCallback((action: Omit<ActionQueueItem, 'id' | 'timestamp' | 'retries'>) => {
    const item: ActionQueueItem = {
      ...action,
      id: `${action.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    setQueue((q) => [...q, item]);
  }, []);

  /** Retry all queued actions */
  const replayAll = useCallback(async () => {
    if (replayingRef.current || queue.length === 0) return;
    replayingRef.current = true;

    const items = [...queue];
    const remaining: ActionQueueItem[] = [];
    let _replayed = 0;

    for (const item of items) {
      if (!navigator.onLine) {
        remaining.push(item);
        break;
      }

      try {
        // Attempt replay
        const response = await fetch('/api/offline/replay', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          _replayed++;
        } else if (item.retries < MAX_RETRIES) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
        // else: drop it after max retries
      } catch {
        remaining.push(item);
      }

      // Small delay between replays
      await new Promise((r) => setTimeout(r, REPLAY_DELAY_MS));
    }

    setQueue(remaining);
    replayingRef.current = false;
  }, [queue]);

  /** Clear all queued actions */
  const clearQueue = useCallback(() => {
    setQueue([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    isOnline,
    queue,
    enqueue,
    replayAll,
    clearQueue,
    pendingCount: queue.length,
  } as const;
}

/* ─── OfflineIndicator Component ───────────────────────────── */

export interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  onReplay: () => void;
}

export function OfflineIndicator({ isOnline, pendingCount, onReplay }: OfflineIndicatorProps) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`offline-indicator ${isOnline ? 'offline-indicator-replaying' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="offline-indicator-dot" aria-hidden="true" />
      {!isOnline ? (
        <span className="offline-indicator-text">Offline — actions queued ({pendingCount})</span>
      ) : (
        <span className="offline-indicator-text">Reconnecting... {pendingCount} pending</span>
      )}
      {pendingCount > 0 && (
        <button
          type="button"
          className="offline-indicator-action"
          onClick={onReplay}
          disabled={!isOnline}
        >
          {isOnline ? 'Sync now' : 'Pending'}
        </button>
      )}
    </div>
  );
}
