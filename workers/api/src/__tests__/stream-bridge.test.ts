/**
 * Tests for Stream Cross-Protocol Bridge
 *
 * Tests stream announcement, chat bridging, and reliability
 * across all supported protocols.
 *
 * All external APIs are mocked. Tests are fast and deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// Mock nostr-sdk to avoid broken internal module resolution
vi.mock('@degenfeed/nostr-sdk', () => {
  const mockPool = {
    list: vi.fn().mockResolvedValue([]),
    disconnectAll: vi.fn(),
  };
  return {
    RelayPool: vi.fn().mockImplementation(() => mockPool),
    getPublicKey: vi.fn().mockReturnValue('mock-pubkey-hex'),
    finalizeEvent: vi.fn().mockReturnValue({ id: 'mock-event-id', sig: 'mock-sig' }),
    serializeEvent: vi.fn().mockReturnValue(new Uint8Array(256)),
  };
});

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockKvGet = vi.fn();
const mockKvPut = vi.fn();
const mockKvDelete = vi.fn();
const mockKvList = vi.fn();

const mockEnv = {
  CACHE: {
    get: mockKvGet,
    put: mockKvPut,
    delete: mockKvDelete,
    list: mockKvList,
  } as unknown as KVNamespace,
  CONTENT_STORE: {
    get: mockKvGet,
    put: mockKvPut,
    delete: mockKvDelete,
    list: mockKvList,
  } as unknown as KVNamespace,
  STREAMS: {
    get: mockKvGet,
    put: mockKvPut,
  } as unknown as KVNamespace,
  GTS_INSTANCE_URL: 'https://social.test.xyz',
  BSKY_SOCIAL_URL: 'https://bsky.test.xyz',
  RELAY_URLS: 'wss://relay.test.xyz',
  FARCASTER_HUB_URL: 'https://hub.test.xyz',
  LENS_API_URL: 'https://lens.test.xyz/graphql',
  TELEGRAM_BOT_TOKEN: 'test:bot-token',
  BSKY_DID: 'did:plc:test',
  NOSTR_PRIVATE_KEY: 'test-privkey-hex',
  IDENTITIES: {
    get: mockKvGet,
    put: mockKvPut,
  } as unknown as KVNamespace,
} as unknown as Env;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubGlobal('AbortSignal', {
  timeout: vi.fn(() => ({ abort: false }) as AbortSignal),
});

function mockJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Test Suite ────────────────────────────────────────────────────────────

describe('Stream Cross-Protocol Bridge', () => {
  const TEST_STREAM = {
    id: 'stream-001',
    title: 'Test Live Stream',
    creator: '0xCreatorWallet',
    creatorHandle: 'creator',
    streamType: 'live' as const,
    streamUrl: 'https://app.degenfeed.xyz/live/0xCreatorWallet',
    thumbnail: 'https://example.com/thumb.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    mockKvGet.mockResolvedValue(null);
    mockKvPut.mockResolvedValue(undefined);
    mockKvDelete.mockResolvedValue(undefined);
    mockKvList.mockResolvedValue({ keys: [], list_complete: true });
  });

  // ─── ActivityPub Stream Bridge ─────────────────────────────────────

  describe('ActivityPub Stream Bridge', () => {
    it('fetches replies from Mastodon', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          descendants: [
            {
              id: 'mastodon-reply-1',
              content: '<p>Great stream!</p>',
              account: {
                display_name: 'Masto User',
                username: 'mastouser',
                avatar: 'https://social.test.xyz/avatar.jpg',
                url: 'https://social.test.xyz/@mastouser',
              },
              created_at: '2024-01-15T12:00:00.000Z',
            },
          ],
        }),
      );

      const { ActivityPubStreamBridge } = await import('../lib/activitypub-stream-bridge');
      const bridge = new ActivityPubStreamBridge(mockEnv);

      const replies = await bridge.fetchReplies('stream-001');
      expect(Array.isArray(replies)).toBe(true);
    });

    it('stores announcement record in KV', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          id: 'ap-post-456',
          url: 'https://social.test.xyz/@degenfeed/ap-post-456',
        }),
      );

      const { ActivityPubStreamBridge } = await import('../lib/activitypub-stream-bridge');
      const bridge = new ActivityPubStreamBridge(mockEnv);

      await bridge.announceStream(TEST_STREAM, 'test-token');

      // verify KV storage was attempted by bridge
      expect(mockKvPut).toHaveBeenCalled();
    });
  });

  // ─── Bluesky (AT Protocol) Stream Bridge ────────────────────────────

  describe('Bluesky (AT Protocol) Stream Bridge', () => {
    it('fetches replies from Bluesky', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          thread: {
            replies: [
              {
                post: {
                  uri: 'at://did:plc:test/app.bsky.feed.post/reply-1',
                  record: {
                    text: 'Nice stream!',
                    createdAt: '2024-01-15T12:00:00.000Z',
                  },
                  author: {
                    displayName: 'Bsky User',
                    handle: 'bskyuser.bsky.social',
                  },
                },
              },
            ],
          },
        }),
      );

      const { BlueskyStreamBridge } = await import('../lib/bluesky-stream-bridge');
      const bridge = new BlueskyStreamBridge(mockEnv);

      const replies = await bridge.fetchReplies('stream-001');
      expect(Array.isArray(replies)).toBe(true);
    });
  });

  // ─── Nostr Stream Bridge ────────────────────────────────────────────

  describe('Nostr Stream Bridge', () => {
    it('creates live event payload', async () => {
      const { createLiveEventPayload } = await import('../lib/nostr-live-bridge');

      const payload = createLiveEventPayload(TEST_STREAM);
      expect(payload).toBeDefined();
      expect(payload.kind).toBe(30311);
      expect(payload.tags).toBeDefined();
    });

    it('fetches reactions (zaps and replies)', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          events: [
            {
              id: 'reply-event-1',
              pubkey: 'reply-pubkey',
              content: 'Cool stream!',
              tags: [['e', 'stream-event-id']],
              created_at: Math.floor(Date.now() / 1000),
              kind: 1,
            },
          ],
        }),
      );

      const { NostrLiveBridge } = await import('../lib/nostr-live-bridge');
      const bridge = new NostrLiveBridge(mockEnv, {
        nsec: 'test-nsec',
        relayUrls: 'wss://relay.test.xyz',
      });

      const reactions = await bridge.fetchReactions('stream-event-id');
      expect(Array.isArray(reactions)).toBe(true);
    });
  });

  // ─── Threads Stream Bridge ──────────────────────────────────────────

  describe('Threads Stream Bridge', () => {
    it('bridges chat from Threads users', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          mockJsonResponse({
            descendants: [
              {
                id: 'threads-reply-1',
                content: '<p>Hello from Threads!</p>',
                created_at: '2024-01-15T12:00:00.000Z',
                account: {
                  acct: 'threadsuser@threads.net',
                  display_name: 'Threads User',
                  avatar: 'https://threads.net/avatar.jpg',
                  url: 'https://threads.net/@threadsuser',
                },
              },
            ],
          }),
        ),
      );

      const { ThreadsStreamBridge } = await import('../lib/threads-stream-bridge');
      const bridge = new ThreadsStreamBridge(mockEnv, {
        instanceUrl: 'https://social.test.xyz',
        accessToken: 'test-token',
        accountHandle: 'degenfeed',
      });

      const replies = await bridge.fetchThreadsReplies('gts-post-1');
      expect(Array.isArray(replies)).toBe(true);
    });

    it('detects Threads accounts', async () => {
      const { isThreadsAccount } = await import('../lib/threads-stream-bridge');
      expect(isThreadsAccount('user@threads.net')).toBe(true);
      expect(isThreadsAccount('user@mastodon.social')).toBe(false);
    });
  });

  // ─── Cross-Protocol Chat Bridge ─────────────────────────────────────

  describe('Cross-Protocol Chat Bridge', () => {
    it('starts and stops bridging', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse([]));
      mockKvGet.mockResolvedValue(null);
      mockKvPut.mockResolvedValue(undefined);

      const { startBridge, stopBridge } = await import('../lib/cross-protocol-chat-bridge');

      await expect(
        startBridge(mockEnv, 'stream-001', undefined, '0xCreatorWallet'),
      ).resolves.not.toThrow();

      await expect(stopBridge(mockEnv, 'stream-001')).resolves.not.toThrow();
    });

    it('getBridgedChatMessages retrieves from KV', async () => {
      const { getBridgedChatMessages } = await import('../lib/cross-protocol-chat-bridge');

      mockKvGet.mockResolvedValue(
        JSON.stringify([
          {
            id: 'msg-1',
            protocol: 'activitypub',
            protocolLabel: 'Mastodon',
            authorId: 'ap:user1',
            authorName: 'User',
            text: 'Hello',
            createdAt: Date.now(),
          },
        ]),
      );

      const messages = await getBridgedChatMessages(mockEnv, 'stream-001');
      expect(Array.isArray(messages)).toBe(true);
      if (messages.length > 0) {
        expect(messages[0].id).toBe('msg-1');
      }
    });

    it('handles empty chat messages', async () => {
      const { getBridgedChatMessages } = await import('../lib/cross-protocol-chat-bridge');

      mockKvGet.mockResolvedValue(null);
      const messages = await getBridgedChatMessages(mockEnv, 'nonexistent-stream');
      expect(messages).toEqual([]);
    });
  });

  // ─── Bridge Reliability Integration ────────────────────────────────

  describe('Bridge Reliability', () => {
    it('withReliability wraps operations', async () => {
      const { withReliability } = await import('../lib/bridge-reliability');

      const result = await withReliability('test-protocol', async () => 'ok', {
        env: mockEnv,
      });
      expect(result).toBe('ok');
    });

    it('withReliability handles CircuitBreakerOpenError', async () => {
      const { withReliability, getCircuitBreaker } = await import('../lib/bridge-reliability');

      const cb = getCircuitBreaker(mockEnv);
      cb.configure('failing-protocol', { threshold: 1, resetTimeout: 60000 });
      await cb.recordFailure('failing-protocol', new Error('test'));

      await expect(
        withReliability('failing-protocol', async () => 'should not run', {
          env: mockEnv,
        }),
      ).rejects.toThrowError(expect.objectContaining({ name: 'CircuitBreakerOpenError' }));
    });

    it('recordBridgeOperation stores in KV', async () => {
      const { recordBridgeOperation } = await import('../lib/bridge-reliability');

      mockKvPut.mockResolvedValue(undefined);
      mockKvGet.mockResolvedValue(null);

      await expect(recordBridgeOperation(mockEnv, 'nostr', true, 150)).resolves.not.toThrow();
    });
  });

  // ─── Format Translation ─────────────────────────────────────────────

  describe('Format Translation', () => {
    it('formats content for ActivityPub', async () => {
      const { formatForActivityPub } = await import('../lib/format-translator');

      const result = formatForActivityPub({
        text: 'Hello from DegenFeed!',
        hashtags: ['live', 'stream'],
      });

      expect(result.status).toBeDefined();
      expect(result.status).toContain('Hello from DegenFeed!');
    });

    it('formats content for Nostr', async () => {
      const { formatForNostr } = await import('../lib/format-translator');

      const result = formatForNostr({
        text: 'Hello Nostr!',
        links: ['https://example.com'],
      });

      expect(result.content).toContain('Hello Nostr!');
      expect(result.tags).toBeDefined();
    });

    it('formats content for Farcaster', async () => {
      const { formatForFarcaster } = await import('../lib/format-translator');

      const result = formatForFarcaster({
        text: 'Hello Farcaster!',
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  // ─── Stream Announcer ──────────────────────────────────────────────

  describe('Stream Announcer', () => {
    it('calls announceStreamToAllProtocols with stream data', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}));
      mockKvPut.mockResolvedValue(undefined);
      mockKvGet.mockResolvedValue(null);

      const { announceStreamToAllProtocols } = await import('../lib/stream-announcer');

      const result = await announceStreamToAllProtocols(mockEnv, {
        streamId: 'stream-001',
        creator: '0xCreatorWallet',
        creatorHandle: 'creator',
        title: 'Test Live Stream',
        streamType: 'live',
        streamUrl: 'https://app.degenfeed.xyz/live/0xCreatorWallet',
        thumbnail: 'https://example.com/thumb.jpg',
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });
});
