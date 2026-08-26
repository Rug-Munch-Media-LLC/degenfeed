/**
 * @degenfeed/api-worker — Durable Sync Queue
 *
 * Cross-protocol sync action queue.
 *
 * Queue source:
 *   - Default (USE_RMI_QUEUE_API=true): uses the rmi-backend queue API
 *     (GET /v1/queue/dequeue?queue=sync, POST /v1/queue/enqueue) instead of
 *     KV list() + per-key get/put. This removes the KV list quota burn.
 *   - Fallback (flag disabled, or API unreachable): legacy KV-backed queue
 *     under the `sync:queue:` prefix with exponential backoff and up to
 *     5 retries before permanent dead-letter status.
 *
 * Queue lifecycle:
 *   enqueue → pending → processing → completed | failed → retry (up to 5×)
 *
 * Processed by the cron trigger every minute and inline after
 * webhook delivery for sub-second forwarding.
 */

import type { Protocol } from '@degenfeed/types';
import {
  dequeueRaw,
  enqueue as queueEnqueue,
  getApiKey,
  parsePayload,
  useRmiQueueApi,
} from './queue-client';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type SyncActionType =
  | 'post_created'
  | 'post_updated'
  | 'post_deleted'
  | 'like_added'
  | 'like_removed'
  | 'repost_added'
  | 'repost_removed'
  | 'reply_added'
  | 'tip_received'
  | 'stream_started'
  | 'stream_ended'
  | 'stream_status'
  | 'identity_linked'
  | 'identity_unlinked';

export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export interface SyncAction {
  /** Unique action identifier */
  id: string;
  /** Action type */
  type: SyncActionType;
  /** Protocol where the action originated */
  sourceProtocol: Protocol;
  /** Native ID on the source protocol */
  sourceNativeId: string;
  /** Target protocol to sync to, or 'all' for all siblings */
  targetProtocol: Protocol | 'all';
  /** df:// URI of the subject */
  dfUri?: string;
  /** Action payload — varies by type */
  payload: Record<string, unknown>;
  /** Auth tokens per protocol needed for cross-posting */
  auth?: Record<string, string>;
}

export interface SyncQueueEntry {
  action: SyncAction;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  nextRetryAt: number;
  processedAt?: number;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const QUEUE_PREFIX = 'sync:queue:';
const DEAD_LETTER_PREFIX = 'sync:dead:';
const _PROCESSING_PREFIX = 'sync:processing:';
const QUEUE_TTL = 86400 * 3; // 3 days — entries auto-expire
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000; // 1s initial, doubles each retry

/** Backoff durations: [1s, 2s, 4s, 8s, 16s] */
function getBackoffMs(retryCount: number): number {
  return BACKOFF_BASE_MS * 2 ** Math.min(retryCount, MAX_RETRIES - 1);
}

// ─── Queue Operations ─────────────────────────────────────────────────────

/**
 * Enqueue a sync action for processing.
 * Returns the entry ID.
 */
export async function enqueue(env: Env, action: SyncAction): Promise<string> {
  const entry: SyncQueueEntry = {
    action,
    status: 'pending',
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: Date.now(),
    nextRetryAt: 0, // process immediately
  };

  const key = `${QUEUE_PREFIX}${action.id}`;

  if (useRmiQueueApi(env)) {
    try {
      await queueEnqueue('sync', key, entry, getApiKey(env));
    } catch (err) {
      // API unavailable — fall back to KV so the action isn't lost.
      console.error('[sync-queue] Queue API enqueue failed, falling back to KV:', err);
      if (env.CACHE) {
        await env.CACHE.put(key, JSON.stringify(entry), { expirationTtl: QUEUE_TTL });
      }
    }
  } else if (env.CACHE) {
    await env.CACHE.put(key, JSON.stringify(entry), { expirationTtl: QUEUE_TTL });
  }

  // Log for monitoring
  //   console.log(
  //     `[sync-queue] enqueued ${action.type} from ${action.sourceProtocol} → ${action.targetProtocol} (${action.id})`,
  //   );

  return action.id;
}

/**
 * Mark an entry as completed.
 * In API mode the backend queue owns the item (already consumed by dequeue),
 * so this is a no-op unless a local KV copy exists.
 */
export async function markCompleted(env: Env, id: string): Promise<void> {
  if (!env.CACHE) return;

  const key = `${QUEUE_PREFIX}${id}`;
  const raw = await env.CACHE.get(key);
  if (!raw) return;

  const entry: SyncQueueEntry = JSON.parse(raw);
  entry.status = 'completed';
  entry.processedAt = Date.now();

  await env.CACHE.put(key, JSON.stringify(entry), {
    expirationTtl: QUEUE_TTL,
  });
}

/**
 * Mark an entry as failed and schedule a retry if retries remain.
 * Moves to dead-letter if max retries exceeded.
 *
 * In API mode, a retryable failure is re-enqueued via POST /v1/queue/enqueue
 * (the dequeue already consumed the item); dead letters are kept as KV audit
 * copies since the queue API has no dead-letter surface yet.
 */
export async function markFailed(env: Env, id: string, error: string): Promise<void> {
  if (!env.CACHE) return;

  const key = `${QUEUE_PREFIX}${id}`;
  const raw = await env.CACHE.get(key);
  if (!raw) return;

  const entry: SyncQueueEntry = JSON.parse(raw);
  await failEntry(env, entry, error);
}

/**
 * Apply retry/failure state to an in-memory entry and persist it:
 *   - retries remain  → re-enqueue (API) or write back (KV)
 *   - retries exceeded → dead-letter KV audit copy
 */
async function failEntry(env: Env, entry: SyncQueueEntry, error: string): Promise<void> {
  entry.retryCount++;
  entry.error = error;

  if (entry.retryCount >= entry.maxRetries) {
    // Move to dead letter (KV audit copy — survives in both modes)
    entry.status = 'dead_letter';
    if (env.CACHE) {
      const deadKey = `${DEAD_LETTER_PREFIX}${entry.action.id}`;
      await env.CACHE.put(deadKey, JSON.stringify(entry), {
        expirationTtl: 86400 * 7, // keep dead letters for 7 days
      });
    }
  } else {
    entry.status = 'failed';
    entry.nextRetryAt = Date.now() + getBackoffMs(entry.retryCount);
    if (useRmiQueueApi(env)) {
      try {
        await queueEnqueue('sync', `${QUEUE_PREFIX}${entry.action.id}`, entry, getApiKey(env));
      } catch (err) {
        console.error(`[sync-queue] Re-enqueue failed for ${entry.action.id}:`, err);
      }
    }
  }

  // KV audit copy (both modes, guarded) — keeps legacy-mode parity and lets
  // ops flip USE_RMI_QUEUE_API back to "false" without losing state.
  if (env.CACHE) {
    await env.CACHE.put(`${QUEUE_PREFIX}${entry.action.id}`, JSON.stringify(entry), {
      expirationTtl: QUEUE_TTL,
    });
  }

  console.warn(
    `[sync-queue] failed ${entry.action.id} (retry ${entry.retryCount}/${entry.maxRetries}): ${error.slice(0, 200)}`,
  );
}

/**
 * Get a single queue entry.
 */
export async function getEntry(env: Env, id: string): Promise<SyncQueueEntry | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${QUEUE_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as SyncQueueEntry) : null;
  } catch {
    return null;
  }
}

/**
 * List all pending queue entries (status = pending, ready to process).
 *
 * API mode: dequeues from the rmi-backend `sync` queue (the backend is
 * responsible for readiness/backoff visibility). Falls back to the KV scan
 * for this call if the API is unreachable.
 */
export async function listPending(env: Env, limit = 100): Promise<SyncQueueEntry[]> {
  if (!env.CACHE) return [];

  if (useRmiQueueApi(env)) {
    try {
      const items = await dequeueRaw('sync', limit, getApiKey(env));
      const entries: SyncQueueEntry[] = [];
      for (const item of items) {
        const entry = parsePayload<SyncQueueEntry>(item.payload);
        if (!entry?.action?.id) continue;
        entries.push(entry);
        if (entries.length >= limit) break;
      }
      return entries;
    } catch (e) {
      console.warn('[sync-queue] Queue API unavailable — falling back to KV listPending:', e);
      // Fall through to the KV scan below
    }
  }

  const entries: SyncQueueEntry[] = [];
  try {
    let cursor: string | undefined;
    do {
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({
        prefix: QUEUE_PREFIX,
        cursor,
        limit: Math.min(limit, 1000),
      });

      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;
          const entry: SyncQueueEntry = JSON.parse(raw);

          // Only include pending entries that are ready to retry
          if (
            (entry.status === 'pending' || entry.status === 'failed') &&
            entry.nextRetryAt <= Date.now()
          ) {
            entries.push(entry);
            if (entries.length >= limit) break;
          }
        } catch {
          /* empty -- error deliberately ignored */
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && entries.length < limit);
  } catch (e) {
    console.error('[sync-queue] listPending error:', e);
  }

  return entries;
}

/**
 * Process the queue — iterate pending entries and call the processor.
 * The processor receives each action and should call markCompleted
 * or markFailed based on the result.
 */
export async function processQueue(
  env: Env,
  processor: (action: SyncAction) => Promise<boolean>,
  batchSize = 25,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const entries = await listPending(env, batchSize);
  let succeeded = 0;
  let failed = 0;

  // Process in parallel batches of 5
  const batchPromises: Promise<void>[] = [];
  for (const entry of entries) {
    // Mark as processing (KV only in legacy mode — in API mode the backend
    // queue owns the state after dequeue).
    if (!useRmiQueueApi(env)) {
      entry.status = 'processing';

      const key = `${QUEUE_PREFIX}${entry.action.id}`;
      await env.CACHE?.put(key, JSON.stringify(entry), {
        expirationTtl: QUEUE_TTL,
      });
    }

    const promise = processor(entry.action)
      .then(async (ok) => {
        if (ok) {
          await markCompleted(env, entry.action.id);
          succeeded++;
        } else {
          await failEntry(env, entry, 'Processor returned false');
          failed++;
        }
      })
      .catch(async (err) => {
        await failEntry(env, entry, err instanceof Error ? err.message : String(err));
        failed++;
      });

    batchPromises.push(promise);

    // Process in batches of 5
    if (batchPromises.length >= 5) {
      await Promise.allSettled(batchPromises);
      batchPromises.length = 0;
    }
  }

  // Flush remaining promises
  if (batchPromises.length > 0) {
    await Promise.allSettled(batchPromises);
  }

  return {
    processed: entries.length,
    succeeded,
    failed,
  };
}

/**
 * Retry all dead-letter entries (move them back to the queue).
 * Returns count of entries retried.
 *
 * Dead letters are kept as KV audit copies (no queue-API dead-letter surface
 * yet); retried entries are re-enqueued via the API in API mode.
 */
export async function retryDeadLetters(env: Env, limit = 50): Promise<number> {
  if (!env.CACHE) return 0;

  let retried = 0;
  try {
    let cursor: string | undefined;
    do {
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({
        prefix: DEAD_LETTER_PREFIX,
        cursor,
        limit: 100,
      });

      for (const key of page.keys) {
        if (retried >= limit) break;

        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;

          const entry: SyncQueueEntry = JSON.parse(raw);

          // Reset retry state
          entry.retryCount = 0;
          entry.status = 'pending';
          entry.nextRetryAt = Date.now();
          entry.error = undefined;

          // Write back to queue
          const queueKey = `${QUEUE_PREFIX}${entry.action.id}`;
          if (useRmiQueueApi(env)) {
            try {
              await queueEnqueue('sync', queueKey, entry, getApiKey(env));
            } catch (err) {
              console.error(`[sync-queue] Dead-letter re-enqueue failed for ${entry.action.id}:`, err);
            }
          } else {
            await env.CACHE.put(queueKey, JSON.stringify(entry), {
              expirationTtl: QUEUE_TTL,
            });
          }

          // Remove from dead letter
          await env.CACHE.delete(key.name);
          retried++;
        } catch {
          /* empty -- error deliberately ignored */
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && retried < limit);
  } catch (e) {
    console.error('[sync-queue] retryDeadLetters error:', e);
  }

  return retried;
}

/**
 * Get queue stats for monitoring.
 *
 * In API mode the backend owns queue state, so exact counts are not
 * available from the worker without another API surface — return zeros.
 * [REVIEW] rmi-backend should expose a queue stats endpoint if this
 * endpoint needs live numbers.
 */
export async function getQueueStats(env: Env): Promise<{
  pending: number;
  failed: number;
  deadLetter: number;
  completed: number;
}> {
  if (!env.CACHE) {
    return { pending: 0, failed: 0, deadLetter: 0, completed: 0 };
  }

  if (useRmiQueueApi(env)) {
    return { pending: 0, failed: 0, deadLetter: 0, completed: 0 };
  }

  let pending = 0;
  let failed = 0;
  let completed = 0;
  let deadLetter = 0;

  try {
    // Count queue entries
    let cursor: string | undefined;
    do {
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({ prefix: QUEUE_PREFIX, cursor, limit: 1000 });

      for (const key of page.keys) {
        try {
          const raw = await env.CACHE.get(key.name);
          if (!raw) continue;
          const entry: SyncQueueEntry = JSON.parse(raw);
          if (entry.status === 'pending' || entry.status === 'processing') pending++;
          else if (entry.status === 'failed') failed++;
          else if (entry.status === 'completed') completed++;
        } catch {
          /* empty -- error deliberately ignored */
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    // Count dead letters
    cursor = undefined;
    do {
      const page: {
        keys: { name: string }[];
        list_complete: boolean;
        cursor?: string;
      } = await env.CACHE.list({
        prefix: DEAD_LETTER_PREFIX,
        cursor,
        limit: 1000,
      });
      deadLetter += page.keys.length;
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    console.error('[sync-queue] getQueueStats error:', e);
  }

  return { pending, failed, deadLetter, completed };
}

/**
 * Generate a unique sync action ID.
 */
export function generateSyncId(): string {
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${ts}-${rand}`;
}

/**
 * Create a sync action and immediately enqueue it.
 * Convenience wrapper for the common pattern.
 */
export async function enqueueSyncAction(
  env: Env,
  type: SyncActionType,
  sourceProtocol: Protocol,
  sourceNativeId: string,
  targetProtocol: Protocol | 'all',
  payload: Record<string, unknown>,
  auth?: Record<string, string>,
  dfUri?: string,
): Promise<string> {
  const action: SyncAction = {
    id: generateSyncId(),
    type,
    sourceProtocol,
    sourceNativeId,
    targetProtocol,
    dfUri,
    payload,
    auth,
  };

  return enqueue(env, action);
}
