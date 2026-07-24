/**
 * Tests for ALL Bridge Directions — Protocol → Protocol
 *
 * Tests source content fetching, bridge handler resolution,
 * and special Zora handlers.
 *
 * All external APIs are mocked. Tests are fast and deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../index';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockKvGet = vi.fn();
const mockKvPut = vi.fn();

const mockEnv = {
  CACHE: {
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

function mockXmlResponse(xml: string, status = 200) {
  return new Response(xml, {
    status,
    headers: { 'content-type': 'application/xml' },
  });
}

// ─── Source Fetcher Tests ─────────────────────────────────────────────────

describe('Bridge Matrix — Source Content Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(4000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchFromActivityPub', () => {
    it('fetches content from ActivityPub status', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          content: '<p>Hello from Mastodon!</p>',
          account: {
            display_name: 'Test User',
            username: 'testuser',
            avatar: 'https://social.test.xyz/avatar.jpg',
          },
          media_attachments: [
            {
              url: 'https://social.test.xyz/media/1.jpg',
              description: 'A photo',
              type: 'image',
            },
          ],
          created_at: '2024-01-15T10:00:00.000Z',
        }),
      );

      const { fetchFromActivityPub } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromActivityPub(
        'status-123',
        {
          mastodon: 'test-token',
          mastodon_instance: 'https://social.test.xyz',
        },
        mockEnv,
      );

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Hello from Mastodon!');
      expect(result?.authorName).toBe('Test User');
      expect(result?.images).toHaveLength(1);
    });

    it('returns null when auth is missing', async () => {
      const { fetchFromActivityPub } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromActivityPub('status-123', {}, mockEnv);
      expect(result).toBeNull();
    });

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse(null, 404));
      const { fetchFromActivityPub } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromActivityPub(
        'status-123',
        { mastodon: 'bad-token', mastodon_instance: 'https://social.test.xyz' },
        mockEnv,
      );
      expect(result).toBeNull();
    });
  });

  describe('fetchFromAtProtocol', () => {
    it('fetches content from AT Protocol', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          value: { text: 'Hello from Bluesky!' },
        }),
      );

      const { fetchFromAtProtocol } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromAtProtocol(
        'rkey-123',
        { bluesky_jwt: 'test-jwt', did: 'did:plc:test' },
        mockEnv,
      );

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Hello from Bluesky!');
    });

    it('falls back to public API on auth failure', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(null, 401)).mockResolvedValueOnce(
        mockJsonResponse({
          thread: {
            post: {
              record: { text: 'Public hello!' },
              author: {
                displayName: 'Public User',
                handle: 'public.bsky.social',
              },
            },
          },
        }),
      );

      const { fetchFromAtProtocol } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromAtProtocol(
        'at://did:plc:test/app.bsky.feed.post/rkey-123',
        { bluesky_jwt: 'bad-jwt', did: 'did:plc:test' },
        mockEnv,
      );

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Public hello!');
    });
  });

  describe('fetchFromNostr', () => {
    it('fetches content from Nostr via nostr.band API', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          events: [
            {
              content: 'Hello from Nostr!',
              kind: 1,
              tags: [
                ['t', 'nostr'],
                ['title', 'My Post'],
              ],
              pubkey: 'abc123',
              created_at: 1705312800,
            },
          ],
        }),
      );

      const { fetchFromNostr } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromNostr('note-abc', {}, mockEnv);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Hello from Nostr!');
      expect(result?.hashtags).toContain('nostr');
    });

    it('returns null when no events found', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ events: [] }));
      const { fetchFromNostr } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromNostr('nonexistent-event', {}, mockEnv);
      expect(result).toBeNull();
    });
  });

  describe('fetchFromFarcaster', () => {
    it('fetches content from Farcaster Hub', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          data: {
            castAddBody: {
              text: 'Hello from Farcaster!',
              embeds: [{ url: 'https://example.com' }],
            },
          },
        }),
      );

      const { fetchFromFarcaster } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromFarcaster('0xcast-hash', {}, mockEnv);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Hello from Farcaster!');
      expect(result?.links).toContain('https://example.com');
    });
  });

  describe('fetchFromLens', () => {
    it('fetches content from Lens API', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          data: {
            publication: {
              metadata: { content: 'Hello from Lens!' },
            },
          },
        }),
      );

      const { fetchFromLens } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromLens('pub-123', {}, mockEnv);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('Hello from Lens!');
    });
  });

  describe('fetchFromTelegram', () => {
    it('fetches content from Telegram', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          result: { text: 'Hello from Telegram!', message_id: 42 },
        }),
      );

      const { fetchFromTelegram } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromTelegram(
        '42',
        {
          telegram_bot_token: 'test:bot-token',
          telegram_chat_id: '-1001234567890',
        },
        mockEnv,
      );
      expect(result).not.toBeNull();
    });

    it('returns null without bot token', async () => {
      const { fetchFromTelegram } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromTelegram('42', { telegram_chat_id: '-1001234567890' }, mockEnv);
      expect(result).toBeNull();
    });
  });

  describe('fetchFromRss', () => {
    it('fetches content from RSS feed', async () => {
      const rssXml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>RSS Article</title>
              <description><![CDATA[Hello from RSS!]]></description>
              <link>https://example.com/article</link>
              <guid>article-123</guid>
            </item>
          </channel>
        </rss>`;

      mockFetch.mockResolvedValue(mockXmlResponse(rssXml));

      const { fetchFromRss } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromRss(
        'article-123',
        { rss_feed_url: 'https://example.com/feed.xml' },
        mockEnv,
      );

      expect(result).not.toBeNull();
      expect(result?.text).toBeDefined();
      expect(typeof result?.text).toBe('string');
      expect(result?.links).toBeDefined();
    });
  });

  describe('fetchFromZora', () => {
    it('fetches content from Zora API', async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          tokens: [
            {
              token: {
                name: 'Zora NFT',
                description: 'A beautiful NFT',
                image: { url: 'https://zora.co/img/1.jpg' },
              },
            },
          ],
        }),
      );

      const { fetchFromZora } = await import('../lib/cross-protocol-bridge-engine');
      const result = await fetchFromZora('0xcontract:1', {}, mockEnv);

      expect(result).not.toBeNull();
      expect(result?.text).toBe('A beautiful NFT');
      expect(result?.title).toBe('Zora NFT');
    });
  });
});

// ─── Bridge Direction Handlers ─────────────────────────────────────────────

describe('Bridge Matrix — Direction Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(5000000);
    mockFetch.mockResolvedValue(mockJsonResponse({}));
    mockKvPut.mockResolvedValue(undefined);
    mockKvGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const protocols = [
    'mastodon',
    'bluesky',
    'nostr',
    'farcaster',
    'lens',
    'telegram',
    'rss',
    'zora',
  ];

  it('returns a handler for every protocol→protocol combination', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');

    for (const source of protocols) {
      for (const target of protocols) {
        if (source === target) {
          expect(getBridgeHandler(source, target)).toBeNull();
        } else {
          const handler = getBridgeHandler(source, target);
          expect(handler).toBeDefined();
          expect(typeof handler).toBe('function');
        }
      }
    }
  });

  it('ActivityPub → AT Protocol (Bluesky)', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'bluesky');
    expect(handler).not.toBeNull();
  });

  it('AT Protocol → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('bluesky', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('ActivityPub → Nostr', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'nostr');
    expect(handler).not.toBeNull();
  });

  it('Nostr → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('nostr', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('ActivityPub → Farcaster', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'farcaster');
    expect(handler).not.toBeNull();
  });

  it('Farcaster → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('farcaster', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('ActivityPub → Telegram', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'telegram');
    expect(handler).not.toBeNull();
  });

  it('ActivityPub → RSS', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'rss');
    expect(handler).not.toBeNull();
  });

  it('ActivityPub → Zora', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'zora');
    expect(handler).not.toBeNull();
  });

  it('Zora → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('Telegram → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('telegram', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('RSS → ActivityPub', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('rss', 'mastodon');
    expect(handler).not.toBeNull();
  });

  it('Nostr → Farcaster', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('nostr', 'farcaster');
    expect(handler).not.toBeNull();
  });

  it('Farcaster → Nostr', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('farcaster', 'nostr');
    expect(handler).not.toBeNull();
  });

  it('Lens → Bluesky', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('lens', 'bluesky');
    expect(handler).not.toBeNull();
  });

  it('Zora → Bluesky', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'bluesky');
    expect(handler).not.toBeNull();
  });

  it('Zora → Nostr', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'nostr');
    expect(handler).not.toBeNull();
  });

  it('Zora → Farcaster', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'farcaster');
    expect(handler).not.toBeNull();
  });

  it('Zora → Telegram', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'telegram');
    expect(handler).not.toBeNull();
  });

  it('Zora → RSS', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('zora', 'rss');
    expect(handler).not.toBeNull();
  });
});

// ─── Zora Special Bridge Handlers ─────────────────────────────────────────

describe('Bridge Matrix — Zora Special Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(7000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bridge Mastodon → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('mastodon', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint this content on Zora!' }, {}, mockEnv);

    expect(result.ok).toBe(true);
    expect(result.nativeId).toContain('zora:');
    expect(result.nativeUri).toContain('degenfeed.xyz/api/mint/x402');
  });

  it('bridge Bluesky → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('bluesky', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint from Bluesky!' }, {}, mockEnv);
    expect(result.ok).toBe(true);
    expect(result.nativeUri).toContain('protocol=bluesky');
  });

  it('bridge Nostr → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('nostr', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint from Nostr!' }, {}, mockEnv);
    expect(result.ok).toBe(true);
    expect(result.nativeUri).toContain('protocol=nostr');
  });

  it('bridge Farcaster → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('farcaster', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint from FC!' }, {}, mockEnv);
    expect(result.ok).toBe(true);
    expect(result.nativeUri).toContain('protocol=farcaster');
  });

  it('bridge Lens → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('lens', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint from Lens!' }, {}, mockEnv);
    expect(result.ok).toBe(true);
    expect(result.nativeUri).toContain('protocol=lens');
  });

  it('bridge Telegram → Zora generates mint URL', async () => {
    const { getBridgeHandler } = await import('../lib/cross-protocol-bridge-engine');
    const handler = getBridgeHandler('telegram', 'zora');
    expect(handler).not.toBeNull();

    const result = await handler?.({ text: 'Mint from Telegram!' }, {}, mockEnv);
    expect(result.ok).toBe(true);
    expect(result.nativeUri).toContain('protocol=telegram');
  });
});

// ─── Reply Fetchers ────────────────────────────────────────────────────────

describe('Bridge Matrix — Protocol Reply Fetchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(8000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchReplies dispatches to correct protocol', async () => {
    const { fetchReplies } = await import('../lib/cross-protocol-bridge-engine');

    mockFetch.mockResolvedValue(
      mockJsonResponse({
        descendants: [
          {
            id: 'reply-1',
            content: '<p>Nice post!</p>',
            account: { display_name: 'Reply User', username: 'replyuser' },
            created_at: '2024-01-15T11:00:00.000Z',
          },
        ],
      }),
    );

    const replies = await fetchReplies(
      'mastodon',
      'status-123',
      { mastodon: 'token', mastodon_instance: 'https://social.test.xyz' },
      mockEnv,
    );
    expect(Array.isArray(replies)).toBe(true);
  });

  it('returns empty array for unknown protocol', async () => {
    const { fetchReplies } = await import('../lib/cross-protocol-bridge-engine');
    const replies = await fetchReplies('unknown', 'id-1', {}, mockEnv);
    expect(replies).toEqual([]);
  });
});

// ─── bridgeContent Integration ─────────────────────────────────────────────

describe('Bridge Matrix — bridgeContent Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(9000000);
    mockFetch.mockResolvedValue(mockJsonResponse({}));
    mockKvPut.mockResolvedValue(undefined);
    mockKvGet.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bridges content from one protocol to all others', async () => {
    const { bridgeContentToAll } = await import('../lib/cross-protocol-bridge-engine');

    const report = await bridgeContentToAll(
      {
        sourceUri: 'df://nostr:note-test',
        sourceProtocol: 'nostr' as const,
        sourceNativeId: 'note-test',
        text: 'Cross-posting from Nostr!',
      },
      mockEnv,
    );

    expect(report.results.length).toBeGreaterThan(0);
    expect(typeof report.successCount).toBe('number');
    expect(typeof report.failureCount).toBe('number');
  });

  it('handles empty targets gracefully', async () => {
    const { bridgeContent } = await import('../lib/cross-protocol-bridge-engine');

    const report = await bridgeContent(
      {
        sourceUri: 'df://nostr:note-test',
        sourceProtocol: 'nostr' as const,
        sourceNativeId: 'note-test',
        text: 'Test',
        targets: [],
      },
      mockEnv,
    );

    expect(report.results).toHaveLength(0);
    expect(report.failureCount).toBe(1);
  });

  it('skips bridge when source equals target', async () => {
    const { bridgeContent } = await import('../lib/cross-protocol-bridge-engine');

    const report = await bridgeContent(
      {
        sourceUri: 'df://nostr:note-test',
        sourceProtocol: 'nostr' as const,
        sourceNativeId: 'note-test',
        text: 'Test',
        targets: ['nostr' as const],
      },
      mockEnv,
    );

    expect(report.results).toHaveLength(0);
  });

  it('handleBridgeWebhook creates proper bridge report', async () => {
    const { handleBridgeWebhook } = await import('../lib/cross-protocol-bridge-engine');

    const report = await handleBridgeWebhook(
      'nostr',
      'note-abc',
      'Webhook test',
      ['farcaster' as const, 'bluesky' as const],
      {
        farcaster_signer: 'signer',
        bluesky_jwt: 'jwt',
        bluesky_did: 'did:plc:test',
      },
      mockEnv,
    );

    expect(report.results.length).toBeGreaterThan(0);
  });
});
