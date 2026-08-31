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

/**
 * Resolve the rmi-backend queue API base URL from env — NO literal default.
 * Clear product separation (2026-08-31): degenfeed is a standalone app; the
 * RMI queue API is an OPTIONAL integration configured per-deployment via
 * the RMI_API_URL var. Unset → callers' existing try/catch fall back to
 * the legacy KV-backed queues (fail-open, same contract as pryscraper's
 * DataBus bridge).
 */
export function getApiBase(env?: { RMI_API_URL?: string } | null): string {
  const url = (env?.RMI_API_URL ?? '').replace(/\/+$/, '');
  if (!url) {
    throw new Error('[queue-client] RMI_API_URL not configured — queue API disabled');
  }
  return `${url}/api/v1`;
}

/**
 * Queue names accepted by the rmi-backend queue API.
 * (Literal["sync","offline","premium"] in kv_migration.py)
 */
const VALID_QUEUES = new Set(['sync', 'offline', 'premium']);

/**
 * Normalize a queue name to one the backend accepts.
 * Unknown queue names are mapped to "sync" and the original name is
 * embedded in the payload as `_queue` so the backend can inspect it.
 */
function normalizeQueue(queue: string): { queue: string; embedOriginal: boolean } {
  if (VALID_QUEUES.has(queue)) return { queue, embedOriginal: false };
  return { queue: 'sync', embedOriginal: true };
}

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
  baseUrl: string,
  queue: string,
  key: string,
  payload: unknown,
  apiKey: string,
): Promise<void> {
  const { queue: normalizedQueue, embedOriginal } = normalizeQueue(queue);
  const body: Record<string, unknown> = {
    queue: normalizedQueue,
    key,
    payload: embedOriginal
      ? {
          _queue: queue,
          ...(typeof payload === 'object' && payload !== null
            ? (payload as Record<string, unknown>)
            : { _data: payload }),
        }
      : payload,
  };
  const res = await fetch(`${baseUrl}/queue/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
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
  baseUrl: string,
  queue: string,
  limit = 50,
  apiKey: string,
): Promise<Array<QueueItem<unknown>>> {
  const { queue: normalizedQueue } = normalizeQueue(queue);
  const res = await fetch(`${baseUrl}/queue/dequeue?queue=${normalizedQueue}&limit=${limit}`, {
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
  baseUrl: string,
  queue: string,
  limit = 50,
  apiKey: string,
): Promise<Array<QueueItem<unknown>>> {
  try {
    return await dequeueRaw(baseUrl, queue, limit, apiKey);
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
