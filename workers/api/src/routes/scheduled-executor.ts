/**
 * @degenfeed/api-worker — Scheduled post executor (cron worker)
 *
 * Called by the every-minute cron trigger. Scans all scheduled KV entries
 * for posts where scheduledAt ≤ now, publishes each via the existing
 * handlePublish handler, and manages retry/failure lifecycle.
 *
 * Flow per entry:
 *   1. Skip if status !== 'pending' or future-dated
 *   2. Create a short-lived session cookie for the owning wallet
 *   3. Build a synthetic Request with the stored text + targets
 *   4. Call handlePublish → reuses Postiz routing, auth checks, etc.
 *   5. Success → mark published, record in user:published:{wallet}, remove from user index
 *   6. Failure → increment retries; after 3 retries mark as failed
 */

import type { Env } from '../index';
import { type SessionPayload, signSession } from '../session';

const SCHEDULED_PREFIX = 'scheduled:';
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

// ─── Public entry point ───────────────────────────────────────────────

export async function executeScheduledPosts(
  env: Env,
): Promise<{ executed: number; failed: number }> {
  if (!env.CACHE || !env.AUTH_SECRET) {
    return { executed: 0, failed: 0 };
  }
  const authSecret: string = env.AUTH_SECRET;

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

        // ── Attempt to publish ──────────────────────────────────────
        const result = await publishScheduledPost(entry, env, authSecret);

        if (result.success) {
          // Mark published in-place (keep KV entry for audit, change status)
          await env.CACHE.put(key.name, JSON.stringify({ ...entry, status: 'published' }), {
            expirationTtl: 60 * 60 * 24 * 30,
          });

          // Record in user's published history
          await recordPublished(env.CACHE, entry.wallet, entry);

          // Remove from user's scheduled index
          const { removeFromUserIndex } = await import('./scheduled');
          await removeFromUserIndex(env, entry.wallet, entry.id);

          executed++;
        } else {
          // ── Retry tracking ────────────────────────────────────────
          const retries = (entry.retries ?? 0) + 1;
          const error = result.error ?? 'Unknown error';
          const newStatus = retries >= MAX_RETRIES ? 'failed' : 'pending';

          const updatedEntry: ScheduledEntry & { retries: number; lastError: string } = {
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

// ─── Helpers ─────────────────────────────────────────────────────────

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
