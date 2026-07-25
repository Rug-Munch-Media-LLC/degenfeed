'use client';

/**
 * useOfflineQueue — Offline message queue with auto-retry on reconnect
 *
 * Stores unsent messages in localStorage. When connection returns,
 * sends queued messages in FIFO order. Handles conflict resolution
 * for messages sent but not confirmed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

export interface QueuedMessage {
  /** Local temp ID — replaced by server ID on successful send */
  localId: string;
  /** Server message ID if previously attempted */
  serverId?: string;
  /** Target conversation */
  conversationId: string;
  /** Recipient ID */
  toId: string;
  /** Message content */
  content: string;
  /** Protocol to send over */
  protocol: string;
  /** When it was first queued */
  queuedAt: number;
  /** Number of send attempts so far */
  retryCount: number;
  /** Last attempt timestamp */
  lastAttemptAt?: number;
  /** Status: queued | sending | sent | confirmed | failed */
  status: 'queued' | 'sending' | 'sent' | 'confirmed' | 'failed';
  /** Error message if failed */
  error?: string;
}

/* ─── Constants ───────────────────────────────────────────────── */

const STORAGE_KEY = 'degenfeed_offline_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_QUEUE_SIZE = 200;

/* ─── Helpers ─────────────────────────────────────────────────── */

function generateLocalId(): string {
  return `offline_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
}

function loadQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    // Keep only last MAX_QUEUE_SIZE entries, prune old confirmed ones
    const pruned = queue.filter((m) => m.status !== 'confirmed').slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // localStorage full — prune aggressively
    try {
      const pruned = queue.slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // Silently fail — non-critical
    }
  }
}

/* ─── Hook ────────────────────────────────────────────────────── */

export function useOfflineQueue(
  onSend: (msg: {
    toId: string;
    content: string;
    protocol: string;
  }) => Promise<{ ok: boolean; message?: { id?: string }; error?: string } | undefined | undefined>,
  isOnline: boolean,
) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const queueRef = useRef<QueuedMessage[]>([]);
  const processingRef = useRef(false);

  // Keep ref in sync
  queueRef.current = queue;

  // Load on mount
  useEffect(() => {
    const stored = loadQueue();
    setQueue(stored);
    queueRef.current = stored;
  }, []);

  // Persist on change
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  /** Add a message to the offline queue */
  const enqueue = useCallback(
    (msg: Omit<QueuedMessage, 'localId' | 'queuedAt' | 'retryCount' | 'status'>) => {
      const entry: QueuedMessage = {
        ...msg,
        localId: generateLocalId(),
        queuedAt: Date.now(),
        retryCount: 0,
        status: 'queued',
      };
      setQueue((prev) => {
        // Avoid duplicate enqueue for same content in last 10s
        const recent = prev.filter(
          (m) =>
            m.content === msg.content && m.toId === msg.toId && Date.now() - m.queuedAt < 10000,
        );
        if (recent.length > 0) return prev;
        return [...prev, entry];
      });
      return entry.localId;
    },
    [],
  );

  /** Update a queued message by localId */
  const updateEntry = useCallback((localId: string, updates: Partial<QueuedMessage>) => {
    setQueue((prev) => prev.map((m) => (m.localId === localId ? { ...m, ...updates } : m)));
  }, []);

  /** Remove a confirmed entry */
  const confirmEntry = useCallback((localId: string, serverId: string) => {
    setQueue((prev) =>
      prev.map((m) => (m.localId === localId ? { ...m, status: 'confirmed', serverId } : m)),
    );
  }, []);

  /** Process queue — send all queued messages in order */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    const toProcess = queueRef.current.filter(
      (m) => m.status === 'queued' || (m.status === 'failed' && m.retryCount < MAX_RETRIES),
    );

    for (const entry of toProcess) {
      // Re-check online status before each send
      if (!navigator.onLine) break;

      const delay = BASE_DELAY_MS * 2 ** entry.retryCount + Math.random() * 500;
      if (entry.retryCount > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      updateEntry(entry.localId, { status: 'sending', lastAttemptAt: Date.now() });

      try {
        const result = await onSend({
          toId: entry.toId,
          content: entry.content,
          protocol: entry.protocol,
        });

        // result can be void (success with no payload) or { ok, message?, error? }
        const sendOk = result === undefined || result === null || result?.ok;
        if (sendOk) {
          confirmEntry(entry.localId, (result as any)?.message?.id ?? entry.localId);
        } else {
          updateEntry(entry.localId, {
            status: 'failed',
            retryCount: entry.retryCount + 1,
            error: result?.error ?? 'Send failed',
            lastAttemptAt: Date.now(),
          });
        }
      } catch (err) {
        updateEntry(entry.localId, {
          status: 'failed',
          retryCount: entry.retryCount + 1,
          error: err instanceof Error ? err.message : 'Network error',
          lastAttemptAt: Date.now(),
        });
      }
    }

    processingRef.current = false;
    setProcessing(false);
  }, [onSend, updateEntry, confirmEntry]);

  // Auto-process when coming online
  useEffect(() => {
    if (isOnline && queue.some((m) => m.status === 'queued' || m.status === 'failed')) {
      processQueue();
    }
  }, [isOnline, queue, processQueue]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      processQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);

  /** Get queued messages for a specific conversation */
  const getQueuedForConversation = useCallback(
    (conversationId: string): QueuedMessage[] => {
      return queue.filter((m) => m.conversationId === conversationId && m.status !== 'confirmed');
    },
    [queue],
  );

  /** Clear all failed messages */
  const clearFailed = useCallback(() => {
    setQueue((prev) => prev.filter((m) => m.status !== 'failed'));
  }, []);

  /** Retry all failed messages */
  const retryFailed = useCallback(() => {
    setQueue((prev) =>
      prev.map((m) =>
        m.status === 'failed' ? { ...m, status: 'queued', retryCount: 0, error: undefined } : m,
      ),
    );
    processQueue();
  }, [processQueue]);

  return {
    queue,
    processing,
    enqueue,
    confirmEntry,
    getQueuedForConversation,
    clearFailed,
    retryFailed,
    processQueue,
  };
}
