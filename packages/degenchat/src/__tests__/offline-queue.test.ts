/**
 * @degenfeed/degenchat — Offline queue test suite
 *
 * Covers: enqueue, list, remove, clear, flush with success/failure/attempt
 * limits, and the in-memory fallback storage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOfflineQueue,
  getOfflineQueue,
  OFFLINE_QUEUE_KEY,
  resetOfflineQueue,
  type OfflineQueue,
  type StorageLike,
} from '../offline-queue';

class FakeStorage implements StorageLike {
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

function makeDraft(overrides: Partial<Parameters<OfflineQueue['enqueue']>[0]> = {}) {
  return {
    id: 'm1',
    conversationId: 'c1',
    toId: 'peer',
    body: 'gm',
    protocol: 'nostr',
    protocols: ['nostr', 'farcaster'],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('createOfflineQueue', () => {
  let storage: FakeStorage;
  let queue: OfflineQueue;

  beforeEach(() => {
    storage = new FakeStorage();
    queue = createOfflineQueue(storage);
  });

  it('enqueues and lists messages', () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    queue.enqueue(makeDraft({ id: 'b', body: 'hi' }));
    const list = queue.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('a');
    expect(list[0]?.attemptCount).toBe(0);
  });

  it('persists across instances sharing storage', () => {
    queue.enqueue(makeDraft({ id: 'persisted' }));
    const second = createOfflineQueue(storage);
    expect(second.list().map((m) => m.id)).toEqual(['persisted']);
    expect(second.size).toBe(1);
  });

  it('removes a message by id', () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    queue.enqueue(makeDraft({ id: 'b' }));
    queue.remove('a');
    expect(queue.list().map((m) => m.id)).toEqual(['b']);
  });

  it('clears the queue', () => {
    queue.enqueue(makeDraft());
    queue.clear();
    expect(queue.size).toBe(0);
    expect(storage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it('flushes successfully sent messages', async () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    queue.enqueue(makeDraft({ id: 'b' }));
    const send = vi.fn(async () => true);
    const result = await queue.flush(send);
    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 });
    expect(queue.size).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps failures and increments attemptCount', async () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    const send = vi.fn(async () => false);
    const result = await queue.flush(send, { maxAttempts: 3 });
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
    expect(queue.list()[0]?.attemptCount).toBe(1);
  });

  it('drops messages that exhaust maxAttempts', async () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    const send = vi.fn(async () => false);
    await queue.flush(send, { maxAttempts: 2 });
    await queue.flush(send, { maxAttempts: 2 });
    expect(queue.size).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('treats a throwing send as a failure', async () => {
    queue.enqueue(makeDraft({ id: 'a' }));
    const send = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await queue.flush(send, { maxAttempts: 4 });
    expect(result.failed).toBe(1);
    expect(result.remaining).toBe(1);
  });

  it('ignores corrupt stored payloads', () => {
    storage.setItem(OFFLINE_QUEUE_KEY, '{not json');
    expect(queue.size).toBe(0);
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([{ id: 'x' }]));
    expect(queue.size).toBe(0);
  });

  it('falls back to in-memory storage when none provided', () => {
    const mem = createOfflineQueue();
    mem.enqueue(makeDraft({ id: 'mem' }));
    expect(mem.size).toBe(1);
  });

  it('exposes a singleton accessor', () => {
    resetOfflineQueue();
    const q1 = getOfflineQueue();
    const q2 = getOfflineQueue();
    expect(q1).toBe(q2);
    resetOfflineQueue();
  });
});
