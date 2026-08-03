/**
 * @degenfeed/degenchat — Offline message queue
 *
 * Persists outbound DegenChat messages when the client is offline (or the
 * realtime bridge is disconnected) and replays them once connectivity
 * returns. Backed by `localStorage` when available, with an in-memory
 * fallback so the module stays usable in Node/tests and in privacy modes.
 *
 * Design:
 *   - Storage is injectable (`createOfflineQueue(storage?)`) for tests and
 *     for non-browser runtimes.
 *   - `flushOfflineQueue(send)` walks the queue oldest-first, removes
 *     successes and increments `attemptCount` on failures (bounded by
 *     `maxAttempts`) so a poisoned message can never wedge the queue.
 *   - The singleton (`getOfflineQueue()`) uses the browser localStorage and
 *     is what the web UI imports.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface DegenChatQueuedMessage {
  id: string;
  conversationId: string;
  toId: string;
  body: string;
  protocol: string;
  /** Delivery targets chosen by the sender (defaults to all reachable). */
  protocols: string[];
  contentType?: 'text' | 'image' | 'link' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  timestamp: number;
  attemptCount: number;
}

export type DegenChatQueuedDraft = Omit<DegenChatQueuedMessage, 'attemptCount'>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface OfflineQueue {
  enqueue(message: DegenChatQueuedDraft): DegenChatQueuedMessage[];
  list(): DegenChatQueuedMessage[];
  remove(id: string): DegenChatQueuedMessage[];
  clear(): void;
  flush(
    send: (message: DegenChatQueuedMessage) => Promise<boolean>,
    opts?: { maxAttempts?: number },
  ): Promise<{ sent: number; failed: number; remaining: number }>;
  get size(): number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────

export const OFFLINE_QUEUE_KEY = 'degenchat:offline-queue';
export const OFFLINE_QUEUE_MAX = 100;
export const OFFLINE_QUEUE_MAX_ATTEMPTS = 5;

function browserStorage(): StorageLike | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return localStorage;
  } catch {
    // privacy mode / quota errors — fall back to in-memory
    return undefined;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────

export function createOfflineQueue(
  storage?: StorageLike,
  options: { key?: string; max?: number } = {},
): OfflineQueue {
  const key = options.key ?? OFFLINE_QUEUE_KEY;
  const max = options.max ?? OFFLINE_QUEUE_MAX;
  const store: StorageLike = storage ?? browserStorage() ?? new InMemoryStorage();

  function read(): DegenChatQueuedMessage[] {
    try {
      const raw = store.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as DegenChatQueuedMessage[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m): m is DegenChatQueuedMessage =>
          Boolean(m?.id) && typeof m.body === 'string' && typeof m.timestamp === 'number',
      );
    } catch {
      return [];
    }
  }

  function write(queue: DegenChatQueuedMessage[]): void {
    try {
      store.setItem(key, JSON.stringify(queue));
    } catch {
      // storage full / unavailable — drop oldest and retry once
      try {
        store.setItem(key, JSON.stringify(queue.slice(-Math.floor(max / 2))));
      } catch {
        // best-effort: no persistence for this send
      }
    }
  }

  return {
    enqueue(message: DegenChatQueuedDraft): DegenChatQueuedMessage[] {
      const next = [...read(), { ...message, attemptCount: 0 }];
      const trimmed = next.length > max ? next.slice(next.length - max) : next;
      write(trimmed);
      return read();
    },

    list(): DegenChatQueuedMessage[] {
      return read();
    },

    remove(id: string): DegenChatQueuedMessage[] {
      const next = read().filter((m) => m.id !== id);
      write(next);
      return read();
    },

    clear(): void {
      try {
        store.removeItem(key);
      } catch {
        // best-effort
      }
    },

    async flush(
      send: (message: DegenChatQueuedMessage) => Promise<boolean>,
      opts?: { maxAttempts?: number },
    ): Promise<{ sent: number; failed: number; remaining: number }> {
      const maxAttempts = opts?.maxAttempts ?? OFFLINE_QUEUE_MAX_ATTEMPTS;
      const queue = read();
      let sent = 0;
      let failed = 0;

      const remaining: DegenChatQueuedMessage[] = [];
      for (const message of queue) {
        try {
          const ok = await send(message);
          if (ok) {
            sent += 1;
            continue;
          }
        } catch {
          // send threw — treat as failure
        }
        failed += 1;
        if (message.attemptCount + 1 < maxAttempts) {
          remaining.push({ ...message, attemptCount: message.attemptCount + 1 });
        }
      }

      write(remaining);
      return { sent, failed, remaining: remaining.length };
    },

    get size(): number {
      return read().length;
    },
  };
}

// ─── In-memory storage fallback ───────────────────────────────────────────

class InMemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

// ─── Singleton (browser default) ──────────────────────────────────────────

let _offlineQueue: OfflineQueue | null = null;

export function getOfflineQueue(storage?: StorageLike): OfflineQueue {
  if (!_offlineQueue) _offlineQueue = createOfflineQueue(storage);
  return _offlineQueue;
}

export function resetOfflineQueue(): void {
  _offlineQueue = null;
}
