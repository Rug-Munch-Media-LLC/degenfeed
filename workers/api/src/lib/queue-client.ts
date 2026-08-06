/**
 * @degenfeed/api-worker — rmi-backend queue API client
 *
 * Thin client for the rmi-backend queue API:
 *   GET  /v1/queue/dequeue?queue=<name>&limit=<n>  → { items: [{ key, payload }] }
 *   POST /v1/queue/enqueue                         → { queue, key, payload }
 *
 * Replaces KV list()-based queue processing, which burns the KV list
 * operations quota (the every-minute cron was doing list() + per-key
 * get + put ≈ 1,440+ list ops/day).
 *
 * Auth: X-API-Key header. The key is provided via the RMI_API_KEY env var
 * (secret in production; placeholder in wrangler.toml [vars]).
 */

export interface QueueItem<T = unknown> {
  key: string;
  payload: T;
}

const API_BASE = 'https://api.rugmunch.io/v1';

/**
 * Feature flag: USE_RMI_QUEUE_API defaults to ENABLED. Set it to "false"
 * (wrangler var / secret) to fall back to the legacy KV-backed queues.
 */
export function useRmiQueueApi(env?: { USE_RMI_QUEUE_API?: string } | null): boolean {
  return env?.USE_RMI_QUEUE_API !== 'false';
}

/** Resolve the API key used to authenticate queue requests. */
export function getApiKey(env?: { RMI_API_KEY?: string } | null): string {
  return env?.RMI_API_KEY ?? '';
}

/**
 * Enqueue an item to the named queue.
 * Throws on HTTP failure so callers can decide how to handle the error
 * (e.g. fall back to KV, or count the item as failed).
 */
export async function enqueue(
  queue: string,
  key: string,
  payload: unknown,
  apiKey: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/queue/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ queue, key, payload }),
  });
  if (!res.ok) {
    throw new Error(`[queue-client] enqueue ${queue}/${key} failed: HTTP ${res.status}`);
  }
}

/**
 * Low-level dequeue. Throws when the API is unreachable or returns an error
 * status, so callers can distinguish "API unavailable" (fall back to KV)
 * from "empty queue" (return []).
 */
export async function dequeueRaw(
  queue: string,
  limit = 50,
  apiKey: string,
): Promise<Array<QueueItem<unknown>>> {
  const res = await fetch(`${API_BASE}/queue/dequeue?queue=${queue}&limit=${limit}`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`[queue-client] dequeue ${queue} failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { items?: Array<QueueItem<unknown>> };
  return data.items ?? [];
}

/**
 * Convenience dequeue that never throws — returns [] on any failure.
 * Use when a failed poll should simply be treated as "nothing to do".
 */
export async function dequeue(
  queue: string,
  limit = 50,
  apiKey: string,
): Promise<Array<QueueItem<unknown>>> {
  try {
    return await dequeueRaw(queue, limit, apiKey);
  } catch (err) {
    console.warn(`[queue-client] dequeue ${queue} failed:`, err);
    return [];
  }
}

/**
 * Normalize a queue payload that may have been stored as a JSON string
 * (legacy KV values) or as an already-parsed object (new API writes).
 */
export function parsePayload<T>(payload: unknown): T {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return payload as T;
    }
  }
  return payload as T;
}
