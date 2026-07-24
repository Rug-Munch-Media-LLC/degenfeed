/**
 * ═════════════════════════════════════════════════════════════════════════════
 * PERFORMANCE TESTS — 10 tests
 *
 * Measures timing characteristics of the cross-protocol bridge, feed assembly,
 * content normalization, identity resolution, and concurrent operations.
 *
 * These tests verify that operations complete within acceptable time bounds
 * under mocked conditions. They are NOT benchmark tests — they assert that
 * the code is performant enough for production use.
 * ═════════════════════════════════════════════════════════════════════════════
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Protocol, UnifiedPost, UnifiedIdentity } from '@degenfeed/types';

// ─── Mocks for adapters (same pattern as integration tests) ─────────────────

const mockHealthCheck = vi.fn();
const mockTransform = vi.fn();
const mockPublish = vi.fn();

vi.mock('@degenfeed/cross-protocol-bridge/src/transforms/index', () => {
  const mockAdapterMap = new Map<string, any>();
  const adapterIds = [
    'activitypub→atproto', 'activitypub→nostr', 'atproto→nostr',
    'nostr→farcaster', 'rss→activitypub',
  ];
  for (const id of adapterIds) {
    mockAdapterMap.set(id, {
      id, name: id, source: id.split('→')[0], target: id.split('→')[1],
      healthCheck: mockHealthCheck, transform: mockTransform, publish: mockPublish,
    });
  }
  return {
    registerAdapter: vi.fn(), getAdapter: vi.fn((id: string) => mockAdapterMap.get(id) ?? null),
    getAllAdapters: vi.fn(() => Array.from(mockAdapterMap.values())),
    registerBuiltinAdapters: vi.fn(),
  };
});

// ─── Factories ──────────────────────────────────────────────────────────────

function createIdentity(id = 'test:user1'): UnifiedIdentity {
  return {
    id, primary: { protocol: 'nostr', id: 'npub1test' },
    handles: { nostr: 'testuser', farcaster: null, lens: null, bluesky: null, mastodon: null },
    displayName: 'Test User', bio: '', avatarUrl: '',
    verified: [], followerCount: 100, followingCount: 50, links: [], keys: {},
  };
}

function createPost(id: string, protocol: Protocol, text?: string): UnifiedPost {
  return {
    id, protocol,
    author: createIdentity(`${protocol}:author`),
    text: text ?? 'Performance test post content',
    html: `<p>${text ?? 'Performance test post content'}</p>`,
    embeds: [], createdAt: Date.now(),
    metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
    engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false, raw: { likes: 10, reposts: 2, replies: 1, quotes: 0 } },
    niches: ['test'], raw: {},
  };
}

// Helper to measure execution time
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
  const start = performance.now();
  const result = await fn();
  const elapsedMs = performance.now() - start;
  return { result, elapsedMs };
}

// ─── 1. Feed Load Time with Batch Posts ────────────────────────────────────

describe('Performance: Feed Load Time', () => {
  it('bridges 10 posts within acceptable time', async () => {
    mockTransform.mockResolvedValue({ success: true as const, payload: { text: 'test' } });
    mockPublish.mockResolvedValue({ success: true as const, nativeId: 'note-1' });

    const { Bridge } = await import('@degenfeed/cross-protocol-bridge');
    const bridge = new Bridge({ enabled: true });

    const posts = Array.from({ length: 10 }, (_, i) =>
      createPost(`mastodon:perf${i}`, 'mastodon', `Performance post ${i}`),
    );

    const { elapsedMs } = await measureTime(async () => {
      const results = await Promise.all(posts.map((p) => bridge.bridgePost(p, 'nostr')));
      return results;
    });

    // 10 sequential bridge operations should complete quickly
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('bridges 100 posts without errors', async () => {
    mockTransform.mockResolvedValue({ success: true as const, payload: { text: 'test' } });
    mockPublish.mockResolvedValue({ success: true as const, nativeId: 'note-bulk' });

    const { Bridge } = await import('@degenfeed/cross-protocol-bridge');
    const bridge = new Bridge({ enabled: true });

    const posts = Array.from({ length: 100 }, (_, i) =>
      createPost(`nostr:bulk${i}`, 'nostr', `Bulk post ${i}`),
    );

    const { result, elapsedMs } = await measureTime(async () => {
      return await Promise.all(posts.map((p) => bridge.bridgePost(p, 'farcaster')));
    });

    const successes = result.filter((r) => r.success).length;
    expect(successes).toBe(100);
    expect(elapsedMs).toBeLessThan(10000);
  });
});

// ─── 2. Search Response Time ─────────────────────────────────────────────

describe('Performance: Search Response Time', () => {
  it('crossProtocolSearch returns results quickly', async () => {
    const { crossProtocolSearch } = await import('@degenfeed/cross-protocol-bridge');

    const { elapsedMs } = await measureTime(() =>
      crossProtocolSearch('bitcoin', { sources: ['nostr', 'farcaster'] as Protocol[] }),
    );

    expect(elapsedMs).toBeLessThan(2000);
  });

  it('search with empty query returns immediately', async () => {
    const { crossProtocolSearch } = await import('@degenfeed/cross-protocol-bridge');

    const { elapsedMs } = await measureTime(() =>
      crossProtocolSearch('', { sources: ['nostr'] as Protocol[] }),
    );

    expect(elapsedMs).toBeLessThan(1000);
  });
});

// ─── 3. Bridge Response Time ─────────────────────────────────────────────

describe('Performance: Bridge Response Time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransform.mockReset();
    mockPublish.mockReset();
  });

  it('single bridge operation completes quickly', async () => {
    mockTransform.mockResolvedValue({ success: true as const, payload: { text: 'fast' } });
    mockPublish.mockResolvedValue({ success: true as const, nativeId: 'fast-note' });

    const { Bridge } = await import('@degenfeed/cross-protocol-bridge');
    const bridge = new Bridge({ enabled: true });
    const post = createPost('nostr:fast1', 'nostr');

    const { elapsedMs } = await measureTime(() => bridge.bridgePost(post, 'farcaster'));
    expect(elapsedMs).toBeLessThan(2000);
  });

  it('bridgePostToAll completes within reasonable time', async () => {
    mockTransform.mockResolvedValue({ success: true as const, payload: { text: 'batch' } });
    mockPublish.mockResolvedValue({ success: true as const, nativeId: 'batch-note' });

    const { Bridge } = await import('@degenfeed/cross-protocol-bridge');
    const bridge = new Bridge({ enabled: true });
    const post = createPost('mastodon:batch1', 'mastodon');

    const { elapsedMs } = await measureTime(() => bridge.bridgePostToAll(post));
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('circuit breaker state retrieval is fast', async () => {
    const { circuitBreaker } = await import('@degenfeed/cross-protocol-bridge');

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      circuitBreaker.isAllowed('activitypub→nostr');
    }
    const elapsedMs = performance.now() - start;

    // 1000 circuit breaker checks should be nearly instant
    expect(elapsedMs).toBeLessThan(500);
  });
});

// ─── 4. Concurrent User Simulation ─────────────────────────────────────────

describe('Performance: Concurrent Users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransform.mockReset();
    mockPublish.mockReset();
    mockTransform.mockResolvedValue({ success: true as const, payload: { text: 'concurrent' } });
    mockPublish.mockResolvedValue({ success: true as const, nativeId: 'concurrent-note' });
  });

  it('handles 50 concurrent bridge requests', async () => {
    const { Bridge } = await import('@degenfeed/cross-protocol-bridge');
    const bridge = new Bridge({ enabled: true });

    const posts = Array.from({ length: 50 }, (_, i) =>
      createPost(`nostr:conc${i}`, 'nostr'),
    );

    const { elapsedMs } = await measureTime(async () => {
      return await Promise.all(posts.map((p) => bridge.bridgePost(p, 'farcaster')));
    });

    const results = await Promise.all(posts.map((p) => bridge.bridgePost(p, 'farcaster')));
    const successes = results.filter((r) => r.success).length;
    // Should handle all 50 without bottlenecks
    expect(successes).toBe(50);
    expect(elapsedMs).toBeLessThan(15000);
  }, 20000);

  it('handles 25 concurrent identity resolutions', async () => {
    const { linkIdentity, resolveByIdentity } = await import('@degenfeed/cross-protocol-bridge');

    // Link 25 identities
    for (let i = 0; i < 25; i++) {
      linkIdentity(`df:conc${i}`, `0x${i.toString(16).padStart(40, '0')}`, 'nostr', `npub-conc${i}`, `user${i}`);
    }

    const { elapsedMs } = await measureTime(async () => {
      return await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          resolveByIdentity('nostr', `npub-conc${i}`)),
      );
    });

    const identities = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        resolveByIdentity('nostr', `npub-conc${i}`)),
    );
    const found = identities.filter(Boolean).length;
    expect(found).toBe(25);
    expect(elapsedMs).toBeLessThan(2000);
  });
});

// ─── 5. Identity Resolution Performance ──────────────────────────────────

describe('Performance: Identity Resolution', () => {
  it('resolves 100 identity lookups quickly', async () => {
    const { linkIdentity, resolveByWallet } = await import('@degenfeed/cross-protocol-bridge');

    // Link 100 identities
    for (let i = 0; i < 100; i++) {
      const wallet = `0x${i.toString(16).padStart(40, '0')}`;
      linkIdentity(`df:lookup${i}`, wallet, 'nostr', `npub-lookup${i}`, `lookup_user${i}`);
    }

    const start = performance.now();
    // Resolve every other identity
    for (let i = 0; i < 100; i += 2) {
      const wallet = `0x${i.toString(16).padStart(40, '0')}`;
      const identity = resolveByWallet(wallet);
      expect(identity).toBeDefined();
    }
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(1000);
  });
});
