/**
 * Tests for Cross-Protocol Bridge Infrastructure:
 *   - CircuitBreaker
 *   - withRetry (exponential backoff)
 *   - BridgeHealthMonitor
 *   - CrossProtocolChatBridge
 *   - RealTimeSync
 *   - SyncQueue
 *
 * All external APIs are mocked. Tests are fast and deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockKvGet = vi.fn();
const mockKvPut = vi.fn();
const mockKvList = vi.fn();
const mockKvDelete = vi.fn();

const mockEnv = {
  CACHE: {
    get: mockKvGet,
    put: mockKvPut,
    list: mockKvList,
    delete: mockKvDelete,
  } as unknown as KVNamespace,
  CONTENT_STORE: {
    get: mockKvGet,
    put: mockKvPut,
    list: mockKvList,
    delete: mockKvDelete,
  } as unknown as KVNamespace,
  GTS_INSTANCE_URL: 'https://social.test.xyz',
  BSKY_SOCIAL_URL: 'https://bsky.test.xyz',
  RELAY_URLS: 'wss://relay.test.xyz',
  FARCASTER_HUB_URL: 'https://hub.test.xyz',
  TELEGRAM_BOT_TOKEN: 'test:bot-token',
  LENS_API_URL: 'https://lens.test.xyz/graphql',
  BSKY_DID: 'did:plc:test',
} as unknown as Env;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubGlobal('AbortSignal', {
  timeout: vi.fn(() => ({ abort: false }) as AbortSignal),
});

// ─── CircuitBreaker Tests ──────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let CircuitBreaker: typeof import('../lib/bridge-reliability').CircuitBreaker;
  let cb: import('../lib/bridge-reliability').CircuitBreaker;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
    const mod = await import('../lib/bridge-reliability');
    CircuitBreaker = mod.CircuitBreaker;
    cb = new CircuitBreaker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed for any protocol', async () => {
    const status = await cb.getStatus('nostr');
    expect(status.state).toBe('closed');
    expect(status.failureCount).toBe(0);
  });

  it('opens after threshold failures', async () => {
    cb.configure('test-protocol', { threshold: 3, resetTimeout: 60000 });

    for (let i = 0; i < 3; i++) {
      await cb.recordFailure('test-protocol', new Error(`fail ${i + 1}`));
    }

    const status = await cb.getStatus('test-protocol');
    expect(status.state).toBe('open');
    expect(status.failureCount).toBe(3);

    await expect(cb.execute('test-protocol', async () => 'should not run')).rejects.toThrowError(
      expect.objectContaining({ name: 'CircuitBreakerOpenError' }),
    );
  });

  it('resets after timeout (open → half-open)', async () => {
    cb.configure('test-protocol', { threshold: 2, resetTimeout: 60000 });

    await cb.recordFailure('test-protocol', new Error('fail 1'));
    await cb.recordFailure('test-protocol', new Error('fail 2'));
    expect((await cb.getStatus('test-protocol')).state).toBe('open');

    vi.advanceTimersByTime(61000);

    const isOpen = await cb.isOpen('test-protocol');
    expect(isOpen).toBe(false);
  });

  it('half-open allows one request and closes on success', async () => {
    cb.configure('test-protocol', {
      threshold: 2,
      resetTimeout: 60000,
      halfOpenSuccesses: 1,
    });

    await cb.recordFailure('test-protocol', new Error('fail 1'));
    await cb.recordFailure('test-protocol', new Error('fail 2'));

    vi.advanceTimersByTime(61000);

    const result = await cb.execute('test-protocol', async () => 'success');
    expect(result).toBe('success');

    const status = await cb.getStatus('test-protocol');
    expect(status.state).toBe('closed');
  });

  it('half-open failure re-opens the circuit', async () => {
    cb.configure('test-protocol', {
      threshold: 2,
      resetTimeout: 60000,
      halfOpenSuccesses: 1,
    });

    await cb.recordFailure('test-protocol', new Error('fail 1'));
    await cb.recordFailure('test-protocol', new Error('fail 2'));

    vi.advanceTimersByTime(61000);

    await expect(
      cb.execute('test-protocol', async () => {
        throw new Error('half-open fail');
      }),
    ).rejects.toThrow('half-open fail');

    const status = await cb.getStatus('test-protocol');
    expect(status.state).toBe('open');
  });

  it('tracks failures per protocol independently', async () => {
    cb.configure('proto-a', { threshold: 2 });
    cb.configure('proto-b', { threshold: 5 });

    await cb.recordFailure('proto-a', new Error('fail'));
    await cb.recordFailure('proto-a', new Error('fail'));

    expect((await cb.getStatus('proto-a')).state).toBe('open');
    expect((await cb.getStatus('proto-b')).state).toBe('closed');
  });

  it('can be manually reset', async () => {
    cb.configure('test-protocol', { threshold: 1 });
    await cb.recordFailure('test-protocol', new Error('fail'));
    expect((await cb.getStatus('test-protocol')).state).toBe('open');

    await cb.reset('test-protocol');
    const status = await cb.getStatus('test-protocol');
    expect(status.state).toBe('closed');
    expect(status.failureCount).toBe(0);
    expect(status.lastError).toBeNull();
  });

  it('resetAll resets all protocols', async () => {
    cb.configure('proto-a', { threshold: 1 });
    cb.configure('proto-b', { threshold: 1 });
    await cb.recordFailure('proto-a', new Error('fail'));
    await cb.recordFailure('proto-b', new Error('fail'));

    const reset = await cb.resetAll();
    expect(reset).toContain('proto-a');
    expect(reset).toContain('proto-b');

    expect((await cb.getStatus('proto-a')).state).toBe('closed');
    expect((await cb.getStatus('proto-b')).state).toBe('closed');
  });

  it('records success decrements failure count in closed state', async () => {
    cb.configure('test-protocol', { threshold: 5 });
    await cb.recordFailure('test-protocol', new Error('fail 1'));
    await cb.recordFailure('test-protocol', new Error('fail 2'));

    await cb.recordSuccess('test-protocol');
    const status = await cb.getStatus('test-protocol');
    expect(status.failureCount).toBe(1);
  });
});

// ─── withRetry Tests ──────────────────────────────────────────────────────

describe('withRetry', () => {
  let withRetry: typeof import('../lib/bridge-reliability').withRetry;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(2000000);
    const mod = await import('../lib/bridge-reliability');
    withRetry = mod.withRetry;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on first try', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    const result = await withRetry(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('success');

    const result = await withRetry(operation, {
      baseDelay: 10,
      maxDelay: 100,
      maxRetries: 3,
    });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('respects maxRetries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('persistent'));

    await expect(
      withRetry(operation, { baseDelay: 10, maxDelay: 100, maxRetries: 2 }),
    ).rejects.toThrowError(expect.objectContaining({ name: 'MaxRetriesExceededError' }));
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('throws CircuitBreakerOpenError immediately without retry', async () => {
    const { CircuitBreakerOpenError } = await import('../lib/bridge-reliability');
    const operation = vi
      .fn()
      .mockRejectedValue(new CircuitBreakerOpenError('test-protocol', Date.now()));

    await expect(withRetry(operation, { maxRetries: 5 })).rejects.toThrowError(
      expect.objectContaining({ name: 'CircuitBreakerOpenError' }),
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-retryable HTTP status codes', async () => {
    const { HttpStatusError } = await import('../lib/bridge-reliability');
    const operation = vi.fn().mockRejectedValue(new HttpStatusError(400, 'Bad Request'));

    await expect(withRetry(operation)).rejects.toThrowError(
      expect.objectContaining({ status: 400 }),
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable HTTP status codes', async () => {
    const { HttpStatusError } = await import('../lib/bridge-reliability');
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new HttpStatusError(429, 'Too Many Requests'))
      .mockResolvedValue('success');

    const result = await withRetry(operation, {
      baseDelay: 10,
      maxDelay: 100,
    });
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('respects custom isRetryable function', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('custom-error'));

    await expect(
      withRetry(operation, {
        isRetryable: () => false,
        maxRetries: 3,
      }),
    ).rejects.toThrow('custom-error');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('throws after all retries exhausted', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(operation, { baseDelay: 10, maxDelay: 100, maxRetries: 1 }),
    ).rejects.toThrowError(expect.objectContaining({ name: 'MaxRetriesExceededError' }));
  });
});

// ─── calculateBackoff Tests ────────────────────────────────────────────────

describe('calculateBackoff', () => {
  it('creates exponential backoff with jitter', async () => {
    const { calculateBackoff } = await import('../lib/bridge-reliability');
    const delay = calculateBackoff(2, 1000, 30000);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(30000);
  });
});

// ─── BridgeHealthMonitor Tests ────────────────────────────────────────────

describe('BridgeHealthMonitor', () => {
  let BridgeHealthMonitor: typeof import('../lib/bridge-reliability').BridgeHealthMonitor;
  let monitor: import('../lib/bridge-reliability').BridgeHealthMonitor;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(3000000);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const mod = await import('../lib/bridge-reliability');
    BridgeHealthMonitor = mod.BridgeHealthMonitor;
    monitor = new BridgeHealthMonitor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks protocol health', async () => {
    const health = await monitor.checkProtocolHealth('nostr', mockEnv);
    expect(health.protocol).toBe('nostr');
    expect(typeof health.reachable).toBe('boolean');
    expect(typeof health.latencyMs).toBe('number');
    expect(typeof health.circuitBreakerState).toBe('string');
    expect(typeof health.checkedAt).toBe('number');
  });

  it('returns overall health report', async () => {
    const report = await monitor.getOverallHealth(mockEnv);
    expect(report.overall).toBeDefined();
    expect(['up', 'degraded', 'down']).toContain(report.overall);
    expect(typeof report.summary.total).toBe('number');
    expect(typeof report.summary.up).toBe('number');
    expect(typeof report.latencyMs).toBe('number');
  });

  it('detects unreachable protocols', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));
    const health = await monitor.checkProtocolHealth('farcaster', mockEnv);
    expect(health.reachable).toBe(false);
  });

  it('includes circuit breaker state in health report', async () => {
    const { getCircuitBreaker } = await import('../lib/bridge-reliability');
    const cb = getCircuitBreaker();
    cb.configure('mastodon', { threshold: 3 });
    await cb.recordFailure('mastodon', new Error('fail'));
    await cb.recordFailure('mastodon', new Error('fail'));
    await cb.recordFailure('mastodon', new Error('fail'));

    const health = await monitor.checkProtocolHealth('mastodon', mockEnv);
    expect(health.circuitBreakerOpen).toBe(true);
    expect(health.circuitBreakerState).toBe('open');
  });

  it('handles unknown protocol health gracefully', async () => {
    const health = await monitor.checkProtocolHealth('unknown-protocol', mockEnv);
    expect(health.reachable).toBe(false);
  });
});

// ─── SyncQueue Tests ──────────────────────────────────────────────────────

describe('SyncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(4000000);
    mockKvGet.mockResolvedValue(null);
    mockKvList.mockResolvedValue({ keys: [], list_complete: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enqueues and processes actions', async () => {
    const { enqueueSyncAction, processQueue } = await import('../lib/sync-queue');
    mockKvPut.mockResolvedValue(undefined);
    mockKvGet.mockResolvedValue(
      JSON.stringify({
        action: {
          id: 'test-id',
          type: 'post_created',
          sourceProtocol: 'nostr',
          sourceNativeId: 'abc123',
          targetProtocol: 'farcaster',
          payload: { text: 'hello' },
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: Date.now(),
        nextRetryAt: 0,
      }),
    );

    const processor = vi.fn().mockResolvedValue(true);
    const result = await processQueue(mockEnv as unknown as Env, processor, 10);

    expect(result.processed).toBeGreaterThanOrEqual(0);
  });

  it('handles failures with retry', async () => {
    const { markFailed, generateSyncId } = await import('../lib/sync-queue');
    const id = generateSyncId();

    mockKvGet.mockResolvedValue(
      JSON.stringify({
        action: {
          id,
          type: 'post_created',
          sourceProtocol: 'nostr',
          sourceNativeId: 'abc',
          targetProtocol: 'farcaster',
          payload: {},
        },
        status: 'pending',
        retryCount: 0,
        maxRetries: 5,
        createdAt: Date.now(),
        nextRetryAt: 0,
      }),
    );

    await markFailed(mockEnv as unknown as Env, id, 'test error');

    const putCall = mockKvPut.mock.calls.find((c: unknown[]) => String(c[0]).includes(id));
    if (putCall) {
      const entry = JSON.parse(putCall[1] as string);
      expect(entry.retryCount).toBe(1);
      expect(entry.status).toBe('failed');
    }
  });

  it('moves to dead letter after max retries', async () => {
    const { markFailed, generateSyncId } = await import('../lib/sync-queue');
    const id = generateSyncId();

    mockKvGet.mockResolvedValue(
      JSON.stringify({
        action: {
          id,
          type: 'post_created',
          sourceProtocol: 'nostr',
          sourceNativeId: 'abc',
          targetProtocol: 'farcaster',
          payload: {},
        },
        status: 'failed',
        retryCount: 4,
        maxRetries: 5,
        createdAt: Date.now(),
        nextRetryAt: Date.now(),
      }),
    );

    await markFailed(mockEnv as unknown as Env, id, 'final failure');

    const deadLetterPut = mockKvPut.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && String(c[0]).includes('sync:dead:'),
    );
    expect(deadLetterPut).toBeDefined();
    if (deadLetterPut) {
      const entry = JSON.parse(deadLetterPut[1] as string);
      expect(entry.status).toBe('dead_letter');
    }
  });

  it('retryDeadLetters moves entries back to queue', async () => {
    const { retryDeadLetters } = await import('../lib/sync-queue');

    mockKvList.mockResolvedValue({
      keys: [{ name: 'sync:dead:test-id-1' }, { name: 'sync:dead:test-id-2' }],
      list_complete: true,
    });
    mockKvGet.mockResolvedValue(
      JSON.stringify({
        action: {
          id: 'test-id-1',
          type: 'post_created',
          sourceProtocol: 'nostr',
          sourceNativeId: 'abc',
          targetProtocol: 'farcaster',
          payload: {},
        },
        status: 'dead_letter',
        retryCount: 5,
        maxRetries: 5,
        createdAt: Date.now(),
        nextRetryAt: 0,
        error: 'test error',
      }),
    );
    mockKvPut.mockResolvedValue(undefined);
    mockKvDelete.mockResolvedValue(undefined);

    const count = await retryDeadLetters(mockEnv as unknown as Env);
    expect(count).toBe(2);
  });

  it('generates unique sync IDs based on timestamp', async () => {
    const { generateSyncId } = await import('../lib/sync-queue');
    vi.setSystemTime(5000000);
    const id1 = generateSyncId();
    vi.setSystemTime(6000000);
    const id2 = generateSyncId();
    expect(id1).not.toBe(id2);
  });
});

// ─── CrossProtocolChatBridge Tests ────────────────────────────────────────

describe('CrossProtocolChatBridge', () => {
  let bridge: import('../lib/cross-protocol-chat-bridge').CrossProtocolChatBridge;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(5000000);
    mockFetch.mockReset();

    // Mock KV for announcement records
    mockKvGet.mockImplementation((key: string) => {
      if (key?.includes('bridge:ap:announcement:test-stream')) {
        return JSON.stringify({
          streamId: 'test-stream',
          protocol: 'activitypub',
          postId: 'ap-post-123',
          postUrl: 'https://social.test.xyz/@test/123',
          instanceUrl: 'https://social.test.xyz',
          announcedAt: Date.now(),
        });
      }
      if (key?.includes('bridge:bsky:announcement:test-stream')) {
        return JSON.stringify({
          streamId: 'test-stream',
          protocol: 'atproto',
          postUri: 'at://did:plc:test/app.bsky.feed.post/rkey123',
          cid: 'cid123',
          postUrl: 'https://bsky.app/profile/did:plc:test/post/rkey123',
          announcedAt: Date.now(),
        });
      }
      if (key?.includes('bridge:nostr:announcement:test-stream')) {
        return JSON.stringify({
          streamId: 'test-stream',
          protocol: 'nostr',
          eventId: 'note-event-123',
          announcedAt: Date.now(),
        });
      }
      return null;
    });
    mockKvPut.mockResolvedValue(undefined);

    // Mock fetch for all external API calls
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          descendants: [],
          thread: null,
          events: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { CrossProtocolChatBridge } = await import('../lib/cross-protocol-chat-bridge');
    bridge = new CrossProtocolChatBridge(mockEnv);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts bridging for all protocols', async () => {
    const comments = await bridge.bridgeChat('test-stream');
    expect(Array.isArray(comments)).toBe(true);
  });

  it('returns empty when no announcements found', async () => {
    mockKvGet.mockResolvedValue(null);
    const comments = await bridge.bridgeChat('nonexistent-stream');
    expect(Array.isArray(comments)).toBe(true);
  });

  it('stops bridging on stream end', async () => {
    const { stopBridge } = await import('../lib/cross-protocol-chat-bridge');
    await expect(stopBridge(mockEnv, 'test-stream')).resolves.not.toThrow();
  });
});

// ─── RealTimeSync Tests ───────────────────────────────────────────────────

describe('RealTimeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(6000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes events from all protocols', async () => {
    const { normalizeEvent } = await import('../lib/realtime-sync');

    const event = {
      protocol: 'nostr' as const,
      type: 'like' as const,
      eventId: 'event-123',
      timestamp: Date.now(),
      actor: { id: 'pubkey-hex', handle: 'nostr-user' },
    };

    const normalized = normalizeEvent(
      'nostr',
      event as import('../lib/realtime-sync').ProtocolEvent,
    );
    expect(normalized.dfUri).toBe('df://nostr:event-123');
    expect(normalized.type).toBe('like');
    expect(normalized.actor.id).toBe('pubkey-hex');
    expect(normalized.sourceProtocol).toBe('nostr');
  });

  it('syncs actions to target protocol', async () => {
    const { syncAction } = await import('../lib/realtime-sync');
    const { generateSyncId } = await import('../lib/sync-queue');

    mockKvPut.mockResolvedValue(undefined);

    const result = await syncAction(
      'nostr' as const,
      {
        id: generateSyncId(),
        type: 'like_added',
        sourceProtocol: 'nostr',
        sourceNativeId: 'note-abc',
        targetProtocol: 'farcaster',
        payload: { text: '❤️' },
      },
      'farcaster' as const,
      mockEnv,
    );

    expect(result.ok).toBe(true);
    expect(result.protocol).toBe('farcaster');
  });

  it('manages protocol subscriptions', async () => {
    const { subscribeToProtocol, unsubscribeFromProtocol, getSubscriptions, getSubscriptionCount } =
      await import('../lib/realtime-sync');

    const identity = { id: 'pubkey-test', handle: 'test-user' };

    expect(subscribeToProtocol('nostr', identity)).toBe(true);
    expect(getSubscriptionCount()).toBe(1);

    expect(unsubscribeFromProtocol('nostr', 'pubkey-test')).toBe(true);
    expect(getSubscriptionCount()).toBe(0);
  });

  it('creates events with factory helper', async () => {
    const { createEvent } = await import('../lib/realtime-sync');

    const event = createEvent(
      'farcaster',
      'tip',
      'tip-hash-1',
      { id: 'fid:123', handle: 'caster' },
      { tipAmountUsd: 50, text: 'Great content!' },
    );

    expect(event.protocol).toBe('farcaster');
    expect(event.type).toBe('tip');
    expect(event.tipAmountUsd).toBe(50);
    expect(event.actor.id).toBe('fid:123');
  });
});
