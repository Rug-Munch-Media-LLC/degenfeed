/**
 * @degenfeed/api-worker — Scheduled post executor (cron worker)
 *
 * Called by the every-minute cron trigger. Processes due scheduled posts
 * (scheduledAt ≤ now) via the existing handlePublish handler, and manages
 * retry/failure lifecycle.
 *
 * Queue source:
 *   - Default (USE_RMI_QUEUE_API=true): dequeues from the rmi-backend queue
 *     API (GET /v1/queue/dequeue?queue=scheduled). Re-scheduled (retry)
 *     items are posted back via POST /v1/queue/enqueue. This removes the
 *     KV list() + per-key get/put pattern that burned the KV list quota.
 *   - Fallback (flag disabled, or API unreachable): legacy KV list()-based
 *     scan of the `scheduled:` prefix.
 *
 * Self-throttling: the cron fires every minute, but the executor runs at
 * most once per SCHEDULED_EXECUTOR_INTERVAL_MINUTES (default 5) using a
 * KV last-run timestamp. A module-level lock prevents concurrent isolates
 * from processing the same batch.
 *
 * Flow per entry:
 *   1. Skip if status !== 'pending' or future-dated
 *   2. Create a short-lived session cookie for the owning wallet
 *   3. Build a synthetic Request with the stored text + targets
 *   4. Call handlePublish → reuses Postiz routing, auth checks, etc.
 *   5. Success → mark published, record in user:published:{wallet}, remove from user index
 *   6. Failure → increment retries; after 3 retries mark as failed
 */

import type { QueueItem } from '../lib/queue-client';
import {
  dequeueRaw,
  enqueue as queueEnqueue,
  getApiKey,
  parsePayload,
  useRmiQueueApi,
} from '../lib/queue-client';
import { type SessionPayload, signSession } from '../session';
import type { Env } from '../types';

const SCHEDULED_PREFIX = 'scheduled:';
const LAST_RUN_KEY = 'scheduled:executor:last-run';
const MAX_RETRIES = 3;

interface ScheduledEntry {
  id: string;
  text: string;
  targets: string[];
  scheduledAt: string;
  createdAt: string;
  status: 'pending' | 'published' | 'failed';
  wallet: string;
  retries?: number;
  lastError?: string;
}

/** Run lock: only one isolate processes at a time. */
let runningLock = false;

// ─── Public entry point ───────────────────────────────────────────────

export async function executeScheduledPosts(
  env: Env,
): Promise<{ executed: number; failed: number }> {
  if (!env.CACHE || !env.AUTH_SECRET) {
    return { executed: 0, failed: 0 };
  }
  // Prevent concurrent isolates from processing the same batch.
  if (runningLock) {
    return { executed: 0, failed: 0 };
  }
  runningLock = true;

  try {
    const authSecret: string = env.AUTH_SECRET;

    // ── Cron-frequency throttle ───────────────────────────────────────
    // The cron still fires every minute; the executor runs at most once
    // per SCHEDULED_EXECUTOR_INTERVAL_MINUTES (default 5).
    const intervalMinutes =
      Number.parseInt(env.SCHEDULED_EXECUTOR_INTERVAL_MINUTES ?? '5', 10) || 5;
    const now = Date.now();
    const lastRunRaw = await env.CACHE.get(LAST_RUN_KEY);
    if (lastRunRaw) {
      const lastRun = Number(lastRunRaw);
      if (Number.isFinite(lastRun) && now - lastRun < intervalMinutes * 60_000) {
        return { executed: 0, failed: 0 };
      }
    }
    await env.CACHE.put(LAST_RUN_KEY, String(now));

    if (useRmiQueueApi(env)) {
      return processViaQueueApi(env, authSecret);
    }
    return processViaKv(env, authSecret);
  } finally {
    runningLock = false;
  }
}

// ─── Queue-API mode (default) ─────────────────────────────────────────

/**
 * Dequeue due scheduled posts from the rmi-backend queue API and publish
 * them. Re-scheduled (retry) items are re-enqueued via the API.
 * Falls back to the KV scan for this run if the API is unreachable.
 */
async function processViaQueueApi(
  env: Env,
  authSecret: string,
): Promise<{ executed: number; failed: number }> {
  if (!env.CACHE) {
    return { executed: 0, failed: 0 };
  }
  let items: Array<QueueItem<unknown>>;
  try {
    items = await dequeueRaw('scheduled', 50, getApiKey(env));
  } catch (err) {
    console.warn('[scheduled-executor] Queue API unavailable — falling back to KV scan:', err);
    return processViaKv(env, authSecret);
  }

  let executed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const entry = parsePayload<ScheduledEntry>(item.payload);
      if (!entry?.id) continue;

      const outcome = await processEntry(entry, env, authSecret);
      if (!outcome.processed) continue;

      if (outcome.success) {
        // Mark published in KV (keep audit record), record user history
        await env.CACHE.put(
          item.key,
          JSON.stringify({ ...entry, status: 'published' }),
          { expirationTtl: 60 * 60 * 24 * 30 },
        );
        await recordPublished(env.CACHE, entry.wallet, entry);

        const { removeFromUserIndex } = await import('./scheduled');
        await removeFromUserIndex(env, entry.wallet, entry.id);
        executed++;
      } else {
        // ── Retry tracking ──────────────────────────────────────────
        const retries = (entry.retries ?? 0) + 1;
        const error = outcome.error ?? 'Unknown error';
        const newStatus = retries >= MAX_RETRIES ? 'failed' : 'pending';

        const updatedEntry: ScheduledEntry & {
          retries: number;
          lastError: string;
        } = {
          ...entry,
          retries,
          lastError: error.slice(0, 500),
          status: newStatus,
        };

        if (newStatus === 'pending') {
          // Re-schedule via the queue API (the dequeue already consumed it).
          try {
            await queueEnqueue('scheduled', item.key, updatedEntry, getApiKey(env));
          } catch (enqErr) {
            console.error(
              `[scheduled-executor] Re-enqueue failed for ${entry.id}:`,
              enqErr,
            );
          }
        } else {
          // Terminal failure — keep a KV audit copy.
          await env.CACHE.put(item.key, JSON.stringify(updatedEntry), {
            expirationTtl: 60 * 60 * 24 * 30,
          });
        }

        console.warn(
          `[scheduled-executor] Publish failed (${retries}/${MAX_RETRIES}) for ${entry.id}: ${error}`,
        );
        failed++;
      }
    } catch (err) {
      console.error('[scheduled-executor] Error processing item:', item.key, err);
      failed++;
    }
  }

  if (executed > 0 || failed > 0) {
    console.log(`[scheduled-executor] Done: ${executed} executed, ${failed} failed`);
  }

  return { executed, failed };
}

// ─── Legacy KV mode (fallback) ────────────────────────────────────────

/**
 * Legacy behavior: list ALL scheduled KV keys and process each one.
 * Kept as the fallback path (USE_RMI_QUEUE_API=false, or API unreachable).
 */
async function processViaKv(
  env: Env,
  authSecret: string,
): Promise<{ executed: number; failed: number }> {
  if (!env.CACHE) {
    return { executed: 0, failed: 0 };
  }
  let executed = 0;
  let failed = 0;
  const now = Date.now();

  try {
    // List ALL scheduled KV keys (paginated automatically by CF Workers KV)
    const listResult = await env.CACHE.list({ prefix: SCHEDULED_PREFIX });

    for (const key of listResult.keys) {
      try {
        const raw = await env.CACHE.get(key.name);
        if (!raw) continue;

        const entry: ScheduledEntry = JSON.parse(raw);

        // Skip already-published, failed, or future-dated posts
        if (entry.status !== 'pending') continue;

        const scheduledTime = new Date(entry.scheduledAt).getTime();
        if (scheduledTime > now) continue;

        const outcome = await processEntry(entry, env, authSecret);
        if (!outcome.processed) continue;

        if (outcome.success) {
          // Mark published in-place (keep KV entry for audit, change status)
          await env.CACHE.put(
            key.name,
            JSON.stringify({ ...entry, status: 'published' }),
            { expirationTtl: 60 * 60 * 24 * 30 },
          );

          // Record in user's published history
          await recordPublished(env.CACHE, entry.wallet, entry);

          // Remove from user's scheduled index
          const { removeFromUserIndex } = await import('./scheduled');
          await removeFromUserIndex(env, entry.wallet, entry.id);

          executed++;
        } else {
          // ── Retry tracking ────────────────────────────────────────
          const retries = (entry.retries ?? 0) + 1;
          const error = outcome.error ?? 'Unknown error';
          const newStatus = retries >= MAX_RETRIES ? 'failed' : 'pending';

          const updatedEntry: ScheduledEntry & {
            retries: number;
            lastError: string;
          } = {
            ...entry,
            retries,
            lastError: error.slice(0, 500),
            status: newStatus,
          };

          await env.CACHE.put(key.name, JSON.stringify(updatedEntry), {
            expirationTtl: 60 * 60 * 24 * 30,
          });

          console.warn(
            `[scheduled-executor] Publish failed (${retries}/${MAX_RETRIES}) for ${entry.id}: ${error}`,
          );
          failed++;
        }
      } catch (err) {
        console.error('[scheduled-executor] Error processing key:', key.name, err);
        failed++;
      }
    }
  } catch (err) {
    console.error('[scheduled-executor] Fatal error in list/iterate:', err);
  }

  if (executed > 0 || failed > 0) {
    console.log(`[scheduled-executor] Done: ${executed} executed, ${failed} failed`);
  }

  return { executed, failed };
}

// ─── Shared helpers ───────────────────────────────────────────────────

/**
 * Attempt to publish one entry. Shared by the queue-API and KV paths.
 */
async function processEntry(
  entry: ScheduledEntry,
  env: Env,
  authSecret: string,
): Promise<{ processed: boolean; success?: boolean; error?: string }> {
  // Skip already-published, failed, or future-dated posts
  if (entry.status !== 'pending') return { processed: false };

  const scheduledTime = new Date(entry.scheduledAt).getTime();
  if (scheduledTime > Date.now()) return { processed: false };

  const result = await publishScheduledPost(entry, env, authSecret);
  return { processed: true, success: result.success, error: result.error };
}

/**
 * Build a synthetic Request and dispatch it through the publish handler.
 *
 * Creates a short-lived HMAC-signed session cookie for the post's owner so
 * the publish handler's requireSession() check passes.
 */
async function publishScheduledPost(
  entry: ScheduledEntry,
  env: Env,
  authSecret: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── Create a short-lived session cookie ─────────────────────────
    const payload: SessionPayload = {
      address: entry.wallet,
      chain: 'ethereum',
      exp: Date.now() + 60_000, // 1 minute — long enough for one publish
      nonce: crypto.randomUUID(),
    };
    const token = await signSession(payload, authSecret);

    // ── Build the synthetic request ─────────────────────────────────
    const body = JSON.stringify({
      text: entry.text,
      targets: entry.targets,
    });

    const request = new Request('http://internal/scheduled-executor', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `__Host-dfid=${token}`,
      },
      body,
    });

    // ── Publish ─────────────────────────────────────────────────────
    const { handlePublish } = await import('./publish');
    const response = await handlePublish(request, env);

    if (response.ok) {
      return { success: true };
    }

    // Extract error from response body
    let errorMsg = `HTTP ${response.status}`;
    try {
      const bodyData = (await response.json()) as { error?: string };
      if (bodyData.error) errorMsg = bodyData.error;
    } catch {
      // Body may be empty or non-JSON
    }

    return { success: false, error: errorMsg };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Append a published post record to the user's history list.
 * Keeps at most 100 most recent entries.
 */
async function recordPublished(
  cache: KVNamespace,
  wallet: string,
  entry: ScheduledEntry,
): Promise<void> {
  try {
    const key = `user:published:${wallet.toLowerCase()}`;
    const raw = await cache.get(key);
    const list: Array<{
      id: string;
      text: string;
      targets: string[];
      publishedAt: string;
    }> = raw ? JSON.parse(raw) : [];

    list.unshift({
      id: entry.id,
      text: entry.text.slice(0, 100),
      targets: entry.targets,
      publishedAt: new Date().toISOString(),
    });

    const trimmed = list.slice(0, 100);
    await cache.put(key, JSON.stringify(trimmed), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch {
    // Non-fatal — the scheduled entry is already marked published
  }
}
