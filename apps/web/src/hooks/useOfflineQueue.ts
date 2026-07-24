'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// === Types =================================================================

export type QueuePriority = 'high' | 'normal' | 'low';

export interface QueuedOperation<T = unknown> {
  /** Unique ID for deduplication */
  id: string;
  /** Operation name for debugging */
  name: string;
  /** Payload to replay */
  payload: T;
  /** When the operation was first queued */
  queuedAt: number;
  /** Priority for replay ordering */
  priority: QueuePriority;
  /** Max retry attempts */
  maxRetries: number;
  /** Current retry count */
  retryCount: number;
  /** Last error message */
  lastError: string | null;
  /** Whether this is a state-changing operation (POST/PUT/DELETE) */
  isMutation: boolean;
}

export type QueueStatus = 'idle' | 'processing' | 'paused' | 'error';

export interface OfflineQueueState {
  /** Number of items in the queue */
  size: number;
  /** Current processing status */
  status: QueueStatus;
  /** Number of items processed this session */
  processedCount: number;
  /** Number of items that failed permanently */
  failedCount: number;
  /** Last error message */
  lastError: string | null;
  /** Whether the browser is currently online */
  isOnline: boolean;
}

export type ReplayHandler<T = unknown> = (operation: QueuedOperation<T>) => Promise<boolean>;

export interface UseOfflineQueueOptions {
  /** Database name for IndexedDB (default: 'degenfeed-offline-queue') */
  dbName?: string;
  /** Store name within IndexedDB (default: 'operations') */
  storeName?: string;
  /** Max concurrent operations per batch (default: 5) */
  batchSize?: number;
  /** Delay between processing batches (ms, default: 1000) */
  batchDelayMs?: number;
  /** Whether to auto-process when coming back online (default: true) */
  autoProcess?: boolean;
  /** Custom handler for processing operations. If not provided, uses fetch-based default. */
  handler?: ReplayHandler;
}

// === Constants =============================================================

const DEFAULT_DB_NAME = 'degenfeed-offline-queue';
const DEFAULT_STORE_NAME = 'operations';
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_BATCH_DELAY_MS = 1000;

// === IndexedDB Helpers =====================================================

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('priority', 'priority', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
        store.createIndex('retryCount', 'retryCount', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

async function getAllOperations(dbName: string, storeName: string): Promise<QueuedOperation[]> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index('queuedAt');
    const request = index.getAll();

    request.onsuccess = () => {
      resolve(request.result as QueuedOperation[]);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function addOperation(
  dbName: string,
  storeName: string,
  operation: QueuedOperation,
): Promise<void> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(operation);
    tx.oncomplete = () => {
      resolve();
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error);
      db.close();
    };
  });
}

async function removeOperation(dbName: string, storeName: string, id: string): Promise<void> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => {
      resolve();
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error);
      db.close();
    };
  });
}

async function updateOperation(
  dbName: string,
  storeName: string,
  operation: QueuedOperation,
): Promise<void> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(operation);
    tx.oncomplete = () => {
      resolve();
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error);
      db.close();
    };
  });
}

async function getOperationCount(dbName: string, storeName: string): Promise<number> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => {
      resolve(request.result);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function clearAll(dbName: string, storeName: string): Promise<void> {
  const db = await openDb(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => {
      resolve();
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error);
      db.close();
    };
  });
}

// === Default Replay Handler ================================================

/**
 * Default handler that replays operations by making fetch requests.
 * Operations should have a `url`, `method`, and optionally `body`.
 */
const defaultHandler: ReplayHandler<{
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
}> = async (operation) => {
  const { url, method, body, headers } = operation.payload;
  if (!url) return false;

  try {
    const fetchOptions: RequestInit = {
      method: method || 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      credentials: 'include',
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(url, fetchOptions);

    // 429 — rate limited, will retry
    if (res.status === 429) return false;

    // 4xx (except 429/408) — permanent failure
    if (res.status >= 400 && res.status < 500 && res.status !== 408) {
      // Don't retry client errors
      return true; // Mark as "success" for removal, but it failed permanently
    }

    return res.ok;
  } catch {
    // Network error — will retry
    return false;
  }
};

// === Hook ==================================================================

/**
 * useOfflineQueue — Client-side offline queue with IndexedDB persistence.
 *
 * Queues operations when offline and replays them when back online.
 * Handles network failures gracefully with automatic retry.
 *
 * Features:
 *   - IndexedDB-backed persistence (survives page refreshes)
 *   - Automatic replay on reconnect
 *   - Priority ordering (high priority operations replayed first)
 *   - Retry limit per operation (maxRetries)
 *   - Batch processing with configurable concurrency
 *   - Operation deduplication by ID
 *
 * Usage:
 * ```tsx
 * const { enqueue, state, retryAll } = useOfflineQueue();
 *
 * // Queue an operation
 * await enqueue({
 *   id: 'like-post-123',
 *   name: 'Like post',
 *   payload: { url: '/api/engage', method: 'POST', body: { postId: '123' } },
 *   priority: 'high',
 *   isMutation: true,
 * });
 * ```
 */
export function useOfflineQueue<T = unknown>(options: UseOfflineQueueOptions = {}) {
  const {
    dbName = DEFAULT_DB_NAME,
    storeName = DEFAULT_STORE_NAME,
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
    autoProcess = true,
    handler = defaultHandler as unknown as ReplayHandler<T>,
  } = options;

  const [state, setState] = useState<OfflineQueueState>({
    size: 0,
    status: 'idle',
    processedCount: 0,
    failedCount: 0,
    lastError: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });

  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // ── Core helpers (defined before effects that depend on them) ──────

  const refreshSize = useCallback(async () => {
    try {
      const count = await getOperationCount(dbName, storeName);
      setState((prev) => ({ ...prev, size: count }));
    } catch {
      // IndexedDB may not be available
    }
  }, [dbName, storeName]);

  /**
   * Process the queue — replay all pending operations.
   * Operations are sorted by priority (high first) then by age.
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    if (!navigator.onLine) return;

    processingRef.current = true;
    setState((prev) => ({ ...prev, status: 'processing' }));

    let processed = 0;
    let failed = 0;

    try {
      const operations = await getAllOperations(dbName, storeName);

      // Sort: high priority first, then oldest
      const sorted = operations.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        return a.queuedAt - b.queuedAt;
      });

      // Process in batches
      for (let i = 0; i < sorted.length; i += batchSize) {
        if (!mountedRef.current) break;
        if (!navigator.onLine) {
          setState((prev) => ({ ...prev, status: 'paused' }));
          processingRef.current = false;
          return;
        }

        const batch = sorted.slice(i, i + batchSize);

        const _results = await Promise.allSettled(
          batch.map(async (op) => {
            try {
              const success = await (
                handlerRef.current as (op: QueuedOperation<T>) => Promise<boolean>
              )(op as QueuedOperation<T>);

              if (success) {
                // Successful — remove from queue
                await removeOperation(dbName, storeName, op.id);
                processed++;
              } else {
                // Transient failure — increment retry count
                op.retryCount++;
                op.lastError = 'Handler returned false';

                if (op.retryCount >= op.maxRetries) {
                  // Max retries exceeded — remove and mark as failed permanently
                  await removeOperation(dbName, storeName, op.id);
                  failed++;
                  console.warn(
                    `[offline-queue] Operation "${op.name}" (${op.id}) failed permanently after ${op.maxRetries} retries`,
                  );
                } else {
                  // Update retry count and keep in queue
                  await updateOperation(dbName, storeName, op);
                }
              }
            } catch (err) {
              // Handler threw
              op.retryCount++;
              op.lastError = err instanceof Error ? err.message : String(err);

              if (op.retryCount >= op.maxRetries) {
                await removeOperation(dbName, storeName, op.id);
                failed++;
              } else {
                await updateOperation(dbName, storeName, op);
              }
            }
          }),
        );

        // Wait between batches
        if (i + batchSize < sorted.length) {
          await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
        }
      }

      await refreshSize();
      setState((prev) => ({
        ...prev,
        status: 'idle',
        processedCount: prev.processedCount + processed,
        failedCount: prev.failedCount + failed,
        size: Math.max(0, prev.size - processed - failed),
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Queue processing failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastError: errorMsg,
      }));
    } finally {
      processingRef.current = false;
    }
  }, [dbName, storeName, batchSize, batchDelayMs, refreshSize]);

  /**
   * Enqueue an operation. If online, tries to execute immediately.
   * Falls back to IndexedDB if the network request fails.
   */
  const enqueue = useCallback(
    async (op: {
      id: string;
      name: string;
      payload: T;
      priority?: QueuePriority;
      maxRetries?: number;
      isMutation?: boolean;
    }): Promise<{ queued: boolean; executed: boolean }> => {
      const operation: QueuedOperation<T> = {
        id: op.id,
        name: op.name,
        payload: op.payload,
        queuedAt: Date.now(),
        priority: op.priority ?? 'normal',
        maxRetries: op.maxRetries ?? 3,
        retryCount: 0,
        lastError: null,
        isMutation: op.isMutation ?? true,
      };

      // If online, try to execute immediately
      if (navigator.onLine) {
        try {
          const success = await handlerRef.current(operation);
          if (success) {
            return { queued: false, executed: true };
          }
          // Handler failed — fall through to queue
        } catch {
          // Fall through to queue
        }
      }

      // Persist to IndexedDB
      try {
        await addOperation(dbName, storeName, operation);
        await refreshSize();
        return { queued: true, executed: false };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to queue operation';
        setState((prev) => ({ ...prev, lastError: errorMsg, failedCount: prev.failedCount + 1 }));
        return { queued: false, executed: false };
      }
    },
    [dbName, storeName, refreshSize],
  );

  // ── Effects ─────────────────────────────────────────────────────────

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      // Auto-process when coming online
      if (autoProcess) {
        processQueue();
      }
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      mountedRef.current = false;
    };
  }, [autoProcess, processQueue]);

  // Refresh queue size on mount and periodically
  useEffect(() => {
    refreshSize();

    // Poll for size changes (in case other tabs add operations)
    const interval = setInterval(refreshSize, 30_000);
    return () => clearInterval(interval);
  }, [refreshSize]);

  // ── Returned API ────────────────────────────────────────────────────

  /**
   * Retry all failed (retry-exceeded) operations by re-enqueuing them.
   * Clears the entire queue first, then operations can be re-added.
   */
  const retryAll = useCallback(async () => {
    setState((prev) => ({ ...prev, lastError: null, failedCount: 0 }));
    await processQueue();
  }, [processQueue]);

  /**
   * Clear all queued operations.
   */
  const clearQueue = useCallback(async () => {
    try {
      await clearAll(dbName, storeName);
      await refreshSize();
      setState((prev) => ({
        ...prev,
        size: 0,
        processedCount: 0,
        failedCount: 0,
        lastError: null,
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear queue';
      setState((prev) => ({ ...prev, lastError: errorMsg }));
    }
  }, [dbName, storeName, refreshSize]);

  /**
   * Get all queued operations (for debugging/inspection).
   */
  const getQueued = useCallback(async (): Promise<QueuedOperation<T>[]> => {
    return getAllOperations(dbName, storeName) as Promise<QueuedOperation<T>[]>;
  }, [dbName, storeName]);

  return {
    enqueue,
    processQueue,
    retryAll,
    clearQueue,
    getQueued,
    state,
  };
}
