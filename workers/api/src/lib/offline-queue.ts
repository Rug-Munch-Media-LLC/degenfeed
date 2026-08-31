/**
 * @degenfeed/api-worker — Persistent Offline Queue
 *
 * Deferred operation processing for transient-failure recovery.
 *
 * Queue source:
 *   - Default (USE_RMI_QUEUE_API=true): uses the rmi-backend queue API
 *     (GET /v1/queue/dequeue?queue=offline, POST /v1/queue/enqueue) instead
 *     of KV list() + per-key get/put.
 *   - Fallback (flag disabled, or API unreachable): legacy KV-backed FIFO
 *     queue under `queue:op:` / `queue:pending`.
 *
 * Architecture:
 *   - Operations are stored in KV with a TTL (default 24h)
 *   - Each operation has: id, name, payload, status, retryCount, maxRetries
 *   - Processed via processQueue() which drains the queue
 *   - Dead letters (max retries exceeded) are preserved for admin review
 *
 * Integration:
 *   - Used by error-recovery.ts for offline queue strategy
 *   - Used by transaction-monitor.ts for postponed checks
 *   - Can be consumed by any route handler needing deferred execution
 *
 * Key schema (legacy mode only):
 *   queue:op:{queueKey}         → OperationRecord (staged)
 *   queue:pending               → Array<queueKey> (FIFO ordering)
 *   queue:dead-letter:{queueKey} → OperationRecord (exhausted)
 *   queue:cache:{cacheKey}      → CachedData (typed value)
 */

import type { Env } from '../types';
import {
  dequeueRaw,
  getApiBase,
  getApiKey,
  parsePayload,
  type QueueItem,
  enqueue as queueEnqueue,
  useRmiQueueApi,
} from './queue-client';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OperationRecord<T = unknown> {
  /** Unique operation key */
  key: string;
  /** Human-readable operation name for debugging */
  name: string;
  /** Opaque payload the handler will process */
  payload: T;
  /** Current processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead-letter';
  /** Retry counter */
  retryCount: number;
  /** Maximum retries before dead-letter */
  maxRetries: number;
  /** When the operation was created */
  createdAt: number;
  /** When it was last attempted */
  lastAttemptAt: number | null;
  /** Last error message */
  lastError: string | null;
  /** Timeout in ms (0 = no timeout) */
  timeoutMs: number;
  /** Optional grouping tag for batch processing */
  tag?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  deadLetter: number;
  oldestPending: number | null;
}

export type QueueHandler<T = unknown> = (record: OperationRecord<T>) => Promise<boolean>;

// ─── Constants ─────────────────────────────────────────────────────────────

const OP_PREFIX = 'queue:op:';
const PENDING_KEY = 'queue:pending';
const DEAD_LETTER_PREFIX = 'queue:dead-letter:';
const CACHE_PREFIX = 'queue:cache:';
const DEFAULT_TTL = 86_400; // 24 hours
const DEFAULT_MAX_RETRIES = 5;

// ─── Enqueue ───────────────────────────────────────────────────────────────

/**
 * Enqueue an operation for deferred processing.
 *
 * @param key   Unique key (deduplicates — if key exists, returns false)
 * @param data  Operation name and payload
 * @param env   Worker bindings (KV used for dedup + legacy mode)
 * @param opts  Optional overrides for maxRetries and timeout
 */
export async function enqueueOperation<T>(
  key: string,
  data: { name: string; payload: T; tag?: string },
  env?: Env,
  opts?: { maxRetries?: number; timeoutMs?: number },
): Promise<boolean> {
  if (!env) {
    console.warn('[offline-queue] No env provided — operation not persisted');
    return false;
  }

  const opKey = `${OP_PREFIX}${key}`;

  try {
    // Check for duplicate (KV still used for dedup in API mode when available)
    if (env.CACHE) {
      const existing = await env.CACHE.get(opKey);
      if (existing) return false; // Duplicate — reject
    }

    const record: OperationRecord<T> = {
      key,
      name: data.name,
      payload: data.payload,
      status: 'pending',
      retryCount: 0,
      maxRetries: opts?.maxRetries ?? DEFAULT_MAX_RETRIES,
      createdAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
      timeoutMs: opts?.timeoutMs ?? 30_000,
      tag: data.tag,
    };

    if (useRmiQueueApi(env)) {
      // API mode — the backend queue owns the item. The pending list in KV
      // is not needed anymore (dequeue replaces the list() scan).
      await queueEnqueue(getApiBase(env), 'offline', opKey, record, getApiKey(env));
      return true;
    }

    if (!env.CACHE) {
      // No KV available in legacy mode — fire-and-forget (operation is lost on restart)
      console.warn('[offline-queue] No KV available — operation not persisted');
      return false;
    }

    // Write operation + append to pending list
    await env.CACHE.put(opKey, JSON.stringify(record), {
      expirationTtl: DEFAULT_TTL,
    });

    // Append to ordered pending list
    const pendingRaw = await env.CACHE.get(PENDING_KEY);
    const pending: string[] = pendingRaw ? (JSON.parse(pendingRaw) as string[]) : [];
    pending.push(key);
    await env.CACHE.put(PENDING_KEY, JSON.stringify(pending), {
      expirationTtl: DEFAULT_TTL,
    });

    return true;
  } catch (err) {
    console.error('[offline-queue] Enqueue failed:', err);
    return false;
  }
}

// ─── Dequeue & Process ─────────────────────────────────────────────────────

/**
 * Dequeue and process operations from the queue.
 *
 * @param handler  Async function that processes each record.
 *                 Return true for success, false for transient failure.
 * @param batchSize Max operations to process in one call (default 10)
 * @param env      Worker bindings
 * @returns        Stats about the batch run
 */
export async function processQueue<T>(
  handler: QueueHandler<T>,
  env?: Env,
  batchSize = 10,
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}> {
  if (!env) return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

  if (useRmiQueueApi(env)) {
    return processQueueViaApi(handler, env, batchSize);
  }

  return processQueueViaKv(handler, env, batchSize);
}

/**
 * API mode: dequeue records from the rmi-backend `offline` queue and process
 * them. Failed (retryable) records are re-enqueued; exhausted records go to
 * the local dead-letter audit copy.
 */
async function processQueueViaApi<T>(
  handler: QueueHandler<T>,
  env: Env,
  batchSize: number,
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}> {
  let items: Array<QueueItem<unknown>>;
  try {
    items = await dequeueRaw(getApiBase(env), 'offline', batchSize, getApiKey(env));
  } catch (err) {
    console.warn('[offline-queue] Queue API unavailable — falling back to KV:', err);
    return processQueueViaKv(handler, env, batchSize);
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const item of items) {
    const record = parsePayload<OperationRecord<T>>(item.payload);
    if (!record?.key) continue;

    try {
      record.status = 'processing';
      record.lastAttemptAt = Date.now();

      // Execute handler with timeout
      const result = await executeWithTimeout(() => handler(record), record.timeoutMs);

      if (result) {
        // Success — backend queue already removed the item on dequeue.
        succeeded++;
      } else {
        // Handler returned false — transient failure
        record.retryCount++;
        record.lastError = 'Handler returned false';
        record.status = record.retryCount >= record.maxRetries ? 'dead-letter' : 'failed';

        if (record.status === 'dead-letter') {
          await moveToDeadLetter(record.key, record, env);
          deadLettered++;
        } else {
          try {
            await queueEnqueue(
              getApiBase(env),
              'offline',
              `${OP_PREFIX}${record.key}`,
              record,
              getApiKey(env),
            );
          } catch (enqErr) {
            console.error(`[offline-queue] Re-enqueue failed for ${record.key}:`, enqErr);
          }
        }
        failed++;
      }
    } catch (err) {
      // Handler threw — retry or dead-letter
      record.retryCount++;
      record.lastError = err instanceof Error ? err.message : String(err);
      record.status = record.retryCount >= record.maxRetries ? 'dead-letter' : 'failed';

      if (record.status === 'dead-letter') {
        await moveToDeadLetter(record.key, record, env);
        deadLettered++;
      } else {
        try {
          await queueEnqueue(
            getApiBase(env),
            'offline',
            `${OP_PREFIX}${record.key}`,
            record,
            getApiKey(env),
          );
        } catch (enqErr) {
          console.error(`[offline-queue] Re-enqueue failed for ${record.key}:`, enqErr);
        }
      }
      failed++;
    }
    processed++;
  }

  return { processed, succeeded, failed, deadLettered };
}

/**
 * Legacy KV mode: drain the FIFO pending list.
 */
async function processQueueViaKv<T>(
  handler: QueueHandler<T>,
  env: Env,
  batchSize: number,
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  deadLettered: number;
}> {
  if (!env.CACHE) return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;

  try {
    const pendingRaw = await env.CACHE.get(PENDING_KEY);
    if (!pendingRaw) return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

    const pending: string[] = JSON.parse(pendingRaw) as string[];
    if (pending.length === 0) return { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 };

    // Process up to batchSize
    const toProcess = pending.slice(0, batchSize);
    const remaining = pending.slice(batchSize);

    for (const key of toProcess) {
      const opKey = `${OP_PREFIX}${key}`;
      try {
        const raw = await env.CACHE.get(opKey);
        if (!raw) {
          // Operation expired or was deleted — skip
          processed++;
          continue;
        }

        const record = JSON.parse(raw) as OperationRecord<T>;
        record.status = 'processing';
        record.lastAttemptAt = Date.now();

        // Update status
        await env.CACHE.put(opKey, JSON.stringify(record), {
          expirationTtl: DEFAULT_TTL,
        });

        // Execute handler with timeout
        const result = await executeWithTimeout(() => handler(record), record.timeoutMs);

        if (result) {
          // Success — mark completed
          record.status = 'completed';
          await env.CACHE.put(opKey, JSON.stringify(record), {
            expirationTtl: DEFAULT_TTL,
          });
          succeeded++;
        } else {
          // Handler returned false — transient failure
          record.retryCount++;
          record.lastError = 'Handler returned false';
          record.status = record.retryCount >= record.maxRetries ? 'dead-letter' : 'failed';
          await env.CACHE.put(opKey, JSON.stringify(record), {
            expirationTtl: DEFAULT_TTL,
          });

          if (record.status === 'dead-letter') {
            await moveToDeadLetter(key, record, env);
            deadLettered++;
          }
          failed++;
        }
      } catch (err) {
        // Handler threw — retry or dead-letter
        try {
          const raw = await env.CACHE.get(opKey);
          if (raw) {
            const record = JSON.parse(raw) as OperationRecord<T>;
            record.retryCount++;
            record.lastError = err instanceof Error ? err.message : String(err);
            record.status = record.retryCount >= record.maxRetries ? 'dead-letter' : 'failed';
            await env.CACHE.put(opKey, JSON.stringify(record), {
              expirationTtl: DEFAULT_TTL,
            });

            if (record.status === 'dead-letter') {
              await moveToDeadLetter(key, record, env);
              deadLettered++;
            }
          }
        } catch {
          // Can't even update the record — skip
        }
        failed++;
      }
      processed++;
    }

    // Update pending list
    await env.CACHE.put(PENDING_KEY, JSON.stringify(remaining), {
      expirationTtl: DEFAULT_TTL,
    });
  } catch (err) {
    console.error('[offline-queue] processQueue failed:', err);
  }

  return { processed, succeeded, failed, deadLettered };
}

// ─── Dead Letter Management ────────────────────────────────────────────────

async function moveToDeadLetter<T>(
  key: string,
  record: OperationRecord<T>,
  env: Env,
): Promise<void> {
  try {
    await env.CACHE?.put(
      `${DEAD_LETTER_PREFIX}${key}`,
      JSON.stringify(record),
      { expirationTtl: DEFAULT_TTL * 7 }, // Keep dead letters for 7 days
    );
    // Remove from active ops
    await env.CACHE?.delete(`${OP_PREFIX}${key}`);
  } catch {
    // Non-critical
  }
}

/**
 * Retry all dead-letter operations.
 * Re-enqueues them with reset retry counts.
 *
 * Dead letters are KV audit copies; in API mode the re-enqueue goes through
 * POST /v1/queue/enqueue instead of the KV put.
 */
export async function retryDeadLetters(env?: Env, max = 50): Promise<number> {
  if (!env?.CACHE) return 0;

  let retried = 0;

  try {
    // List dead letters by scanning keys (local audit copies)
    const deadLetterKeys = await listDeadLetterKeys(env, max);

    for (const key of deadLetterKeys) {
      const raw = await env.CACHE.get(`${DEAD_LETTER_PREFIX}${key}`);
      if (!raw) continue;

      const record = JSON.parse(raw) as OperationRecord;
      record.retryCount = 0;
      record.status = 'pending';
      record.lastError = null;
      record.lastAttemptAt = null;

      // Re-enqueue
      if (useRmiQueueApi(env)) {
        try {
          await queueEnqueue(
            getApiBase(env),
            'offline',
            `${OP_PREFIX}${key}`,
            record,
            getApiKey(env),
          );
        } catch (err) {
          console.error(`[offline-queue] Dead-letter re-enqueue failed for ${key}:`, err);
        }
      } else {
        await env.CACHE.put(`${OP_PREFIX}${key}`, JSON.stringify(record), {
          expirationTtl: DEFAULT_TTL,
        });
      }
      await env.CACHE.delete(`${DEAD_LETTER_PREFIX}${key}`);

      // Add back to pending list (legacy FIFO ordering)
      if (!useRmiQueueApi(env)) {
        const pendingRaw = await env.CACHE.get(PENDING_KEY);
        const pending: string[] = pendingRaw ? (JSON.parse(pendingRaw) as string[]) : [];
        if (!pending.includes(key)) {
          pending.push(key);
          await env.CACHE.put(PENDING_KEY, JSON.stringify(pending), {
            expirationTtl: DEFAULT_TTL,
          });
        }
      }

      retried++;
    }
  } catch (err) {
    console.error('[offline-queue] retryDeadLetters failed:', err);
  }

  return retried;
}

async function listDeadLetterKeys(env: Env, max: number): Promise<string[]> {
  const keys: string[] = [];
  // Local KV audit copies only — the queue API has no dead-letter list surface.
  try {
    if (!env.CACHE) return [];
    const listed = await env.CACHE.list({
      prefix: DEAD_LETTER_PREFIX,
      limit: max,
    });
    if (listed?.keys) {
      for (const k of listed.keys) {
        const name = k.name as string;
        keys.push(name.slice(DEAD_LETTER_PREFIX.length));
      }
    }
  } catch {
    // KV list not available (local dev) — return empty
  }
  return keys;
}

// ─── Cache Helpers ─────────────────────────────────────────────────────────

/**
 * Store a value in the queue's cache namespace.
 */
export async function setCache<T>(key: string, data: T, env?: Env, ttl = 300): Promise<boolean> {
  if (!env?.CACHE) return false;
  try {
    await env.CACHE.put(`${CACHE_PREFIX}${key}`, JSON.stringify(data), {
      expirationTtl: ttl,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a value from the queue's cache namespace.
 */
export async function getCached<T>(key: string, env?: Env): Promise<T | null> {
  if (!env?.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Queue Statistics ─────────────────────────────────────────────────────

/**
 * Get queue statistics for monitoring.
 *
 * In API mode the dead-letter count is unavailable from the worker (no
 * queue-API stats surface yet) — reported as 0.
 * [REVIEW] rmi-backend should expose queue stats if this endpoint needs
 * live dead-letter counts.
 */
export async function getQueueStats(env?: Env): Promise<QueueStats> {
  if (!env?.CACHE) {
    return {
      total: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      oldestPending: null,
    };
  }

  try {
    const pendingRaw = await env.CACHE.get(PENDING_KEY);
    const pending: string[] = pendingRaw ? (JSON.parse(pendingRaw) as string[]) : [];

    // Count dead letters (legacy KV mode only; API mode reports 0)
    let deadLetter = 0;
    if (!useRmiQueueApi(env)) {
      try {
        const listed = await env.CACHE.list({ prefix: DEAD_LETTER_PREFIX });
        deadLetter = listed?.keys?.length ?? 0;
      } catch {
        // KV list not available
      }
    }

    // Find oldest pending
    let oldestPending: number | null = null;
    for (const key of pending.slice(0, 10)) {
      try {
        const raw = await env.CACHE.get(`${OP_PREFIX}${key}`);
        if (raw) {
          const record = JSON.parse(raw) as OperationRecord;
          if (record.createdAt && (!oldestPending || record.createdAt < oldestPending)) {
            oldestPending = record.createdAt;
          }
        }
      } catch {
        // Skip
      }
    }

    return {
      total: pending.length + deadLetter,
      pending: pending.length,
      completed: 0, // Would need separate tracking
      failed: 0,
      deadLetter,
      oldestPending,
    };
  } catch {
    return {
      total: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
      oldestPending: null,
    };
  }
}

// ─── Timeout Helper ────────────────────────────────────────────────────────

async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
