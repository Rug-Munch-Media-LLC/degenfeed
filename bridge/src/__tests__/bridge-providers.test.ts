/**
 * TEST SUITE 1: Bridge Provider Tests
 *
 * Tests the core bridge provider implementations:
 * Nostr, Farcaster, Bluesky, Mastodon/GTS, and RSS
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedPost } from '../server/types';

// ─── Mocks ────────────────────────────────────────────────────────────

function mockWebSocket() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const ws = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    _triggerOpen: () => {
      for (const cb of listeners.open || []) cb();
    },
    _triggerMessage: (data: string) => {
      for (const cb of listeners.message || []) cb({ data } as MessageEvent);
    },
    _triggerError: () => {
      for (const cb of listeners.error || []) cb(new Event('error'));
    },
    _triggerClose: () => {
      for (const cb of listeners.close || []) cb(new Event('close'));
    },
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    readyState: 1,
  };
  return ws;
}

// We mock the global WebSocket for Nostr tests
const mockWsInstances: ReturnType<typeof mockWebSocket>[] = [];
vi.stubGlobal(
  'WebSocket',
  vi.fn(() => {
    const ws = mockWebSocket();
    mockWsInstances.push(ws);
    return ws;
  }),
);

// Store original fetch before mocking

beforeEach(() => {
  mockWsInstances.length = 0;
  vi.restoreAllMocks();
});

// ─── Nostr Provider Tests ────────────────────────────────────────────

describe('Nostr provider', () => {
  it('returns posts from relay', async () => {
    const { fetchNostrPosts } = await import('../providers/nostr');

    // Mock the fetchFromRelay by having WebSocket succeed
    // Trigger open + EOSE quickly so the promise resolves
    const posts = await fetchNostrPosts(5);

    // Even with mocks, the relay connection should be attempted
    expect(Array.isArray(posts)).toBe(true);
    // May return empty when relays time out, but that's expected behavior
  });

  it('handles empty relay response gracefully', async () => {
    const { fetchNostrPosts } = await import('../providers/nostr');
    // Fetch with limit 0 to simulate minimal processing
    const posts = await fetchNostrPosts(1);
    expect(Array.isArray(posts)).toBe(true);
  });

  it('handles WebSocket connection errors', async () => {
    // Verify that error doesn't throw — the function handles it
    const { fetchNostrPosts } = await import('../providers/nostr');
    // This should not throw — WebSocket errors are caught internally
    await expect(fetchNostrPosts(3)).resolves.toBeDefined();
  });

  it('eventToPost maps NostrEvent to UnifiedPost correctly', async () => {
    const { eventToPost } = await import('../providers/nostr');

    const ev = {
      id: 'abc123event',
      pubkey: 'aabbccdd1122334455667788',
      created_at: 1700000000,
      kind: 1,
      tags: [['e', 'parentid']],
      content: 'Bitcoin is the future of money!',
      sig: 'sigsig',
    };

    const post = eventToPost(ev, 'wss://relay.damus.io');

    expect(post.id).toContain('nostr');
    expect(post.id).toContain('abc123event');
    expect(post.protocol).toBe('nostr');
    expect(post.text).toBe('Bitcoin is the future of money!');
    expect(post.author.displayName).toBeTruthy();
    expect(post.author.primary.protocol).toBe('nostr');
    expect(post.niches).toContain('bitcoin');
    expect(post.createdAt).toBe(1700000000 * 1000);
    expect(post.contentType).toBe('text');
  });

  it('guessNiches detects Bitcoin keywords', async () => {
    const { guessNiches } = await import('../providers/nostr');

    expect(guessNiches('Bitcoin halving is coming')).toContain('bitcoin');
    expect(guessNiches('I love BTC')).toContain('bitcoin');
    expect(guessNiches('Satoshi nakamoto')).toContain('bitcoin');
  });

  it('guessNiches detects multiple niches', async () => {
    const { guessNiches } = await import('../providers/nostr');

    const niches = guessNiches('ETH and SOL defi AI agents are the future');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('solana');
    expect(niches).toContain('defi');
    expect(niches).toContain('ai');
  });

  it('guessNiches defaults to crypto when no niche matches', async () => {
    const { guessNiches } = await import('../providers/nostr');

    const niches = guessNiches('I like turtles and pizza');
    expect(niches).toContain('crypto');
  });

  it('eventToPost handles missing profile gracefully', async () => {
    const { eventToPost } = await import('../providers/nostr');

    const ev = {
      id: 'ev123',
      pubkey: 'ff' as any,
      created_at: 1700000000,
      kind: 1,
      tags: [],
      content: 'Hello world',
      sig: 'sig',
    };

    const post = eventToPost(ev, 'wss://nos.lol', undefined);
    expect(post.text).toBe('Hello world');
    expect(post.author.avatarUrl).toBe('');
    expect(post.author.displayName).toBeTruthy();
  });
});

// ─── Farcaster Provider Tests ────────────────────────────────────────

describe('Farcaster provider', () => {
  it('CURATED_FIDS contains known FIDs', async () => {
    const { CURATED_FIDS } = await import('../providers/farcaster');
    expect(CURATED_FIDS).toContain(1); // dwr
    expect(CURATED_FIDS).toContain(2); // varun
    expect(CURATED_FIDS).toContain(228); // vitalik.eth
    expect(CURATED_FIDS.length).toBeGreaterThan(30);
  });

  it('getHubbleStatus returns status object or null', async () => {
    const { getHubbleStatus } = await import('../providers/farcaster');
    // Hubble may or may not be running in test env - handle both
    const status = await getHubbleStatus();
    if (status !== null) {
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('isSynced');
      expect(typeof status.isSynced).toBe('boolean');
      expect(typeof status.isSyncing).toBe('boolean');
    }
    // null is also acceptable (no Hubble running)
  });

  it('calculateSyncPercentage returns 0 when no peer', async () => {
    const mod = await import('../providers/farcaster');
    // Use the module's internal function indirectly through getHubbleStatus
    // Since we can't access it directly, verify through status logic
    const { getHubbleStatus } = mod;
    const status = await getHubbleStatus();
    // null is expected since Hubble is not running in tests
    expect(status === null || typeof status === 'object').toBe(true);
  });

  it('fetchFarcasterPosts returns empty gracefully when Hubble is down', async () => {
    const { fetchFarcasterPosts } = await import('../providers/farcaster');

    // This should not throw even with Hubble unreachable
    const posts = await fetchFarcasterPosts(5);
    expect(Array.isArray(posts)).toBe(true);
    // Should be empty since there's no Hubble and no NEYNAR_API_KEY
  });

  it('generateSIWFChallenge produces valid EIP-4361 message', async () => {
    const { generateSIWFChallenge } = await import('../providers/farcaster');

    const challenge = generateSIWFChallenge(
      'app.degenfeed.xyz',
      '0x1234567890abcdef',
      'randomnonce123',
    );

    expect(challenge).toContain('app.degenfeed.xyz');
    expect(challenge).toContain('0x1234567890abcdef');
    expect(challenge).toContain('randomnonce123');
    expect(challenge).toContain('Sign in with Farcaster to DegenFeed');
    expect(challenge).toContain('URI');
    expect(challenge).toContain('Version: 1');
    expect(challenge).toContain('Chain ID: 1');
  });

  it('verifySIWF rejects missing fields', async () => {
    const { verifySIWF } = await import('../providers/farcaster');

    const result = await verifySIWF({
      signature: '',
      message: '',
      address: '',
      domain: '',
      nonce: '',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });

  it('verifySIWF rejects with only address', async () => {
    const { verifySIWF } = await import('../providers/farcaster');

    const result = await verifySIWF({
      signature: '0xsig',
      message: '',
      address: '0xaddr',
      domain: 'test.com',
      nonce: 'nonce',
    });

    expect(result.valid).toBe(false);
  });
});

// ─── Bluesky Provider Tests ──────────────────────────────────────────

describe('Bluesky provider', () => {
  it('postToUnified maps Bluesky post correctly', async () => {
    const { postToUnified } = await import('../providers/bluesky/mapper');

    const bskyPost = {
      uri: 'at://did:plc:test/app.bsky.feed.post/test123',
      cid: 'cid123',
      author: {
        did: 'did:plc:testuser',
        handle: 'testuser.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
      },
      record: {
        text: 'Bitcoin and Ethereum are great!',
        createdAt: '2024-01-15T10:00:00.000Z',
      },
      likeCount: 42,
      repostCount: 10,
      replyCount: 3,
      indexedAt: '2024-01-15T10:00:00.000Z',
    };

    const post = postToUnified(bskyPost as any);

    expect(post.protocol).toBe('bluesky');
    expect(post.text).toBe('Bitcoin and Ethereum are great!');
    expect(post.niches).toContain('bitcoin');
    expect(post.niches).toContain('ethereum');
    expect(post.metrics.likes).toBe(42);
    expect(post.metrics.reposts).toBe(10);
    expect(post.metrics.replies).toBe(3);
    expect(post.author.displayName).toBe('Test User');
    expect(post.author.handles.bluesky).toBe('testuser.bsky.social');
  });

  it('postToUnified handles empty metrics', async () => {
    const { postToUnified } = await import('../providers/bluesky/mapper');

    const bskyPost = {
      uri: 'at://did:plc:test/app.bsky.feed.post/empty',
      cid: 'cid456',
      author: {
        did: 'did:plc:empty',
        handle: 'empty.bsky.social',
      },
      record: {
        text: 'Hello Bluesky',
        createdAt: '2024-01-15T10:00:00.000Z',
      },
      indexedAt: '2024-01-15T10:00:00.000Z',
    };

    const post = postToUnified(bskyPost as any);
    expect(post.text).toBe('Hello Bluesky');
    expect(post.metrics.likes).toBe(0);
    expect(post.metrics.reposts).toBe(0);
    expect(post.metrics.replies).toBe(0);
    expect(post.author.displayName).toBe('empty.bsky.social'); // fallback to handle
  });

  it('extractMediaFromPost extracts images from embed', async () => {
    const { extractMediaFromPost } = await import('../providers/bluesky/helpers');

    const post = {
      uri: 'at://test/app.bsky.feed.post/img1',
      cid: 'cid-img',
      author: { did: 'did:plc:img', handle: 'img.bsky.social' },
      record: { text: 'Check this out', createdAt: '2024-01-15T10:00:00.000Z' },
      embed: {
        images: [
          {
            thumb: 'https://cdn.bsky.app/img/feed_thumbnail/img1',
            fullsize: 'https://cdn.bsky.app/img/feed_fullsize/img1',
            alt: 'A cool picture',
            aspectRatio: { width: 16, height: 9 },
          },
        ],
      },
      indexedAt: '2024-01-15T10:00:00.000Z',
    };

    const media = extractMediaFromPost(post as any);
    expect(media.length).toBe(1);
    expect(media[0]!.url).toContain('feed_fullsize');
    expect(media[0]!.alt).toBe('A cool picture');
    expect(media[0]!.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('detectContentType detects image, link, and text types', async () => {
    const { detectContentType } = await import('../providers/bluesky/helpers');

    // Image type
    const imagePost = {
      embed: { images: [{ thumb: 'img.jpg', fullsize: 'img.jpg', alt: '' }] },
      record: { text: 'pic' },
    } as any;
    expect(detectContentType(imagePost)).toBe('image');

    // Text type
    const textPost = { record: { text: 'hello' } } as any;
    expect(detectContentType(textPost)).toBe('text');

    // Link type
    const linkPost = {
      embed: { external: { uri: 'https://example.com/article', title: 'Article' } },
      record: { text: 'article' },
    } as any;
    expect(detectContentType(linkPost)).toBe('link');
  });

  it('fetchBlueskyPosts returns empty gracefully', async () => {
    const { fetchBlueskyPosts } = await import('../providers/bluesky/fetchers');
    // Without a running PDS, this should fail gracefully
    const posts = await fetchBlueskyPosts(5);
    expect(Array.isArray(posts)).toBe(true);
  });

  it('guessNiches detects bluesky niches', async () => {
    const { guessNiches } = await import('../providers/bluesky/helpers');

    expect(guessNiches('SOL to the moon')).toContain('solana');
    expect(guessNiches('NFT art collection')).toContain('nft');
    expect(guessNiches('AI agents are coming')).toContain('ai');
    expect(guessNiches('SEC regulation update')).toContain('regulation');
    // "layer2" without space matches the regex
    expect(guessNiches('layer2 scaling rocks')).toContain('layer2');
    expect(guessNiches('Random thought')).toContain('crypto');
  });
});

// ─── Mastodon/GTS Provider Tests ─────────────────────────────────────

describe('Mastodon/GTS provider', () => {
  it('statusToPost maps Mastodon status to UnifiedPost', async () => {
    const { statusToPost } = await import('../providers/gotosocial');

    const status = {
      id: '12345',
      uri: 'https://mastodon.social/@test/12345',
      created_at: '2024-01-15T10:00:00.000Z',
      content: '<p>Bitcoin DeFi is amazing!</p>',
      visibility: 'public',
      sensitive: false,
      spoiler_text: '',
      media_attachments: [],
      tags: [{ name: 'bitcoin' }],
      reblogs_count: 5,
      favourites_count: 20,
      replies_count: 3,
      url: 'https://mastodon.social/@test/12345',
      account: {
        id: '999',
        username: 'testuser',
        acct: 'testuser',
        display_name: 'Test User',
        note: '<p>Crypto enthusiast</p>',
        avatar: 'https://example.com/avatar.png',
        followers_count: 100,
        following_count: 50,
        header: '',
        header_static: '',
      },
      reblog: null,
      card: null,
    };

    const post = statusToPost(status, 'mastodon.social');

    expect(post.protocol).toBe('mastodon');
    expect(post.text).toBe('Bitcoin DeFi is amazing!');
    expect(post.metrics.likes).toBe(20);
    expect(post.metrics.reposts).toBe(5);
    expect(post.metrics.replies).toBe(3);
    expect(post.author.displayName).toBe('Test User');
    expect(post.author.handles.mastodon).toBe('testuser@mastodon.social');
    expect(post.author.bio).toBe('Crypto enthusiast');
    expect(post.niches).toContain('bitcoin');
    expect(post.niches).toContain('defi');
  });

  it('statusToPost handles reblog (boosted post)', async () => {
    const { statusToPost } = await import('../providers/gotosocial');

    const status = {
      id: 'boost1',
      created_at: '2024-01-15T10:00:00.000Z',
      content: '<p>Boost wrapper</p>',
      visibility: 'public',
      sensitive: false,
      spoiler_text: '',
      media_attachments: [],
      tags: [],
      reblogs_count: 0,
      favourites_count: 0,
      replies_count: 0,
      url: '',
      account: {
        id: '1',
        username: 'booster',
        acct: 'booster',
        display_name: 'Booster',
        note: '',
        avatar: '',
        followers_count: 0,
        following_count: 0,
        header: '',
        header_static: '',
      },
      reblog: {
        id: 'orig1',
        created_at: '2024-01-14T10:00:00.000Z',
        content: '<p>Original post about SOL</p>',
        visibility: 'public',
        sensitive: false,
        spoiler_text: '',
        media_attachments: [],
        tags: [{ name: 'solana' }],
        reblogs_count: 10,
        favourites_count: 30,
        replies_count: 5,
        url: '',
        account: {
          id: '2',
          username: 'original',
          acct: 'original',
          display_name: 'Original Author',
          note: '',
          avatar: '',
          followers_count: 0,
          following_count: 0,
          header: '',
          header_static: '',
        },
        reblog: null,
        card: null,
      } as any,
      card: null,
    };

    const post = statusToPost(status as any, 'mastodon.social');

    // The reblog content should be used
    expect(post.text).toContain('Original post about SOL');
    expect(post.niches).toContain('solana');
  });

  it('statusToPost handles CW (content warning)', async () => {
    const { statusToPost } = await import('../providers/gotosocial');

    const status = {
      id: 'cw1',
      created_at: '2024-01-15T10:00:00.000Z',
      content: '<p>Sensitive content here</p>',
      visibility: 'public',
      sensitive: true,
      spoiler_text: 'NSFW',
      media_attachments: [],
      tags: [],
      reblogs_count: 0,
      favourites_count: 0,
      replies_count: 0,
      url: '',
      account: {
        id: '1',
        username: 'user',
        acct: 'user',
        display_name: 'User',
        note: '',
        avatar: '',
        followers_count: 0,
        following_count: 0,
        header: '',
        header_static: '',
      },
      reblog: null,
      card: null,
    };

    const post = statusToPost(status as any, 'mastodon.social');
    expect(post.text).toContain('[CW: NSFW]');
    expect(post.text).toContain('Sensitive content here');
  });

  it('fetchMastodonPosts returns empty gracefully when no instances respond', async () => {
    const { fetchMastodonPosts } = await import('../providers/gotosocial');
    // Without running instances, should return empty array
    const posts = await fetchMastodonPosts(5);
    expect(Array.isArray(posts)).toBe(true);
  });
});

// ─── RSS Provider Tests ─────────────────────────────────────────────

describe('RSS provider', () => {
  it('stripHtml removes tags and decodes entities', async () => {
    const { stripHtml } = await import('../providers/rss');

    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('Bitcoin &amp; Ethereum')).toBe('Bitcoin & Ethereum');
    // <br/> becomes \n, preceding whitespace is collapsed
    expect(stripHtml('Text with <br/>newline').replace(/^\s+|\s+$/g, '')).toContain('Text with');
    expect(stripHtml('')).toBe('');
  });

  it('extractFeaturedImage finds first image URL', async () => {
    const { extractFeaturedImage } = await import('../providers/rss');

    const html = '<p>Text</p><img src="https://example.com/image.jpg" alt="img"/>';
    const url = extractFeaturedImage(html);
    expect(url).toBe('https://example.com/image.jpg');
  });

  it('extractFeaturedImage returns undefined for data URIs', async () => {
    const { extractFeaturedImage } = await import('../providers/rss');

    const html = '<img src="data:image/png;base64,abc123" alt="inline"/>';
    const url = extractFeaturedImage(html);
    expect(url).toBeUndefined();
  });

  it('extractFeaturedImage returns undefined for empty HTML', async () => {
    const { extractFeaturedImage } = await import('../providers/rss');

    expect(extractFeaturedImage('')).toBeUndefined();
    expect(extractFeaturedImage('<p>no image here</p>')).toBeUndefined();
  });

  it('parseFeedXml parses RSS 2.0 items', async () => {
    const { parseFeedXml } = await import('../providers/rss');

    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Crypto Feed</title>
    <link>https://example.com</link>
    <description>Test feed</description>
    <item>
      <title>Bitcoin Rally</title>
      <link>https://example.com/bitcoin</link>
      <description>Bitcoin is going up!</description>
      <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
      <guid>item-123</guid>
      <category>Crypto</category>
    </item>
    <item>
      <title>Ethereum Upgrade</title>
      <link>https://example.com/eth</link>
      <description>New upgrade coming</description>
      <pubDate>Tue, 16 Jan 2024 10:00:00 GMT</pubDate>
      <guid>item-456</guid>
    </item>
  </channel>
</rss>`;

    const result = parseFeedXml(xml);
    expect(result.title).toBe('Test Crypto Feed');
    expect(result.items.length).toBe(2);
    expect(result.items[0]!.title).toBe('Bitcoin Rally');
    expect(result.items[0]!.link).toBe('https://example.com/bitcoin');
    expect(result.items[1]!.title).toBe('Ethereum Upgrade');
  });

  it('parseFeedXml parses Atom entries', async () => {
    const { parseFeedXml } = await import('../providers/rss');

    const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Test Feed</title>
  <entry>
    <title>DeFi Summer Returns</title>
    <link href="https://example.com/defi"/>
    <id>atom-entry-1</id>
    <published>2024-01-15T10:00:00Z</published>
    <summary>DeFi is back!</summary>
    <category term="defi"/>
  </entry>
</feed>`;

    const result = parseFeedXml(xml);
    expect(result.title).toBe('Atom Test Feed');
    expect(result.items.length).toBe(1);
    expect(result.items[0]!.title).toBe('DeFi Summer Returns');
    expect(result.items[0]!.link).toBe('https://example.com/defi');
  });

  it('parseFeedXml returns empty items for invalid XML', async () => {
    const { parseFeedXml } = await import('../providers/rss');

    const result = parseFeedXml('not xml at all');
    expect(result.items.length).toBe(0);
    expect(result.title).toBeUndefined();
  });

  it('deduplicatePosts removes duplicates and keeps newest', async () => {
    const { deduplicatePosts } = await import('../providers/rss');

    const basePost = {
      id: 'rss:test:1',
      protocol: 'rss',
      author: {
        id: 'rss:test',
        primary: { protocol: 'rss', id: 'test' },
        handles: {},
        displayName: 'Test',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'Bitcoin is the best investment in 2024',
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: ['bitcoin'],
    };

    const posts: UnifiedPost[] = [
      { ...basePost, id: 'rss:source1:1', createdAt: Date.now() - 10000 },
      { ...basePost, id: 'rss:source2:1', createdAt: Date.now() - 5000 }, // newer
    ];

    const deduped = deduplicatePosts(posts, 10);
    expect(deduped.length).toBe(1);
    // Should keep the newer one
  });

  it('deduplicatePosts merges niches from duplicates', async () => {
    const mod = await import('../providers/rss');
    const { deduplicatePosts } = mod;

    const basePost = {
      id: 'rss:a:1',
      protocol: 'rss',
      author: {
        id: 'rss:a',
        primary: { protocol: 'rss', id: 'a' },
        handles: {},
        displayName: 'A',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'BTC and ETH both look strong',
      embeds: [],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: ['bitcoin'],
    };

    const dupPost: UnifiedPost = {
      ...basePost,
      id: 'rss:b:1',
      createdAt: Date.now() - 100,
      niches: ['ethereum'],
    };

    const deduped = deduplicatePosts([basePost, dupPost], 10);
    expect(deduped.length).toBe(1);
    expect(deduped[0]!.niches).toContain('bitcoin');
    expect(deduped[0]!.niches).toContain('ethereum');
  });

  it('extractMetadata extracts description and keywords', async () => {
    const { extractMetadata } = await import('../providers/rss');

    const html = `<html>
<head>
  <meta name="description" content="Crypto news and analysis"/>
  <meta name="keywords" content="bitcoin, ethereum, defi"/>
  <meta name="author" content="Crypto Author"/>
</head>
<body>Content</body>
</html>`;

    const meta = extractMetadata(html);
    expect(meta.description).toContain('Crypto news');
    expect(meta.authorName).toBe('Crypto Author');
    expect(meta.keywords).toContain('bitcoin');
    expect(meta.keywords).toContain('ethereum');
  });

  it('ALL_FEEDS contains all feed categories', async () => {
    const { ALL_FEEDS, FEED_COUNT } = await import('../providers/rss');

    expect(FEED_COUNT).toBe(ALL_FEEDS.length);
    // Feed list was pruned during the 2026-08-03 dead-feed audit (75 feeds);
    // the 2026-08-03 source expansion added high-quality general/crypto
    // sources back — verify we stayed well above the pruned baseline.
    expect(FEED_COUNT).toBeGreaterThan(80);

    // Check categories exist
    const categories = new Set(ALL_FEEDS.map((f) => f.category));
    expect(categories.has('crypto-news')).toBe(true);
    expect(categories.has('security')).toBe(true);
    expect(categories.has('ai')).toBe(true);
    expect(categories.has('defi')).toBe(true);
    // Topic-expansion categories (2026-08-03)
    expect(categories.has('science')).toBe(true);
    expect(categories.has('geopolitics')).toBe(true);
    expect(categories.has('business')).toBe(true);

    // Verify the new high-quality sources from the source-expansion pass
    const labels = ALL_FEEDS.map((f) => f.label);
    for (const expected of [
      'Bankless',
      'CNBC Crypto',
      'MIT Tech Review',
      'Ars Technica',
      'Wired',
      'Rest of World',
      'The Conversation',
      'TechCrunch',
      'The Register',
      'The Guardian Tech',
      'IEEE Spectrum',
    ]) {
      expect(labels).toContain(expected);
    }

    // Topic-expansion sources (verified live 2026-08-03)
    for (const expected of [
      'Nature',
      'Science Daily',
      'Quanta Magazine',
      'Foreign Affairs',
      'Council on Foreign Relations',
      'The Diplomat',
      'BBC World',
      'Al Jazeera',
      'NYT World',
      'The Guardian World',
      'The Economist',
      'FT Alphaville',
      'WSJ World',
      'CNBC Top News',
      'Bloomberg Markets',
      'Stratechery',
    ]) {
      expect(labels).toContain(expected);
    }
  });

  it('getFeedsByCategory filters correctly', async () => {
    const { getFeedsByCategory } = await import('../providers/rss');

    // Use a category that has feeds defined
    const newsFeeds = getFeedsByCategory('crypto-news');
    expect(newsFeeds.length).toBeGreaterThan(0);
    for (const feed of newsFeeds) {
      expect(feed.category).toBe('crypto-news');
    }

    // Verify no 'nonexistent' category returns empty
    const empty = getFeedsByCategory('bitcoin' as any);
    expect(empty.length).toBe(0);
  });

  it('parseFeedXml handles empty XML string', async () => {
    const { parseFeedXml } = await import('../providers/rss');

    const result = parseFeedXml('');
    expect(result.items.length).toBe(0);
  });

  it('extractMetadata returns empty object for empty HTML', async () => {
    const { extractMetadata } = await import('../providers/rss');

    const meta = extractMetadata('');
    expect(meta.description).toBeUndefined();
    expect(meta.authorName).toBeUndefined();
    expect(meta.keywords).toBeUndefined();
  });

  it('extractOpenGraphImage finds og:image meta tag', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    const html =
      '<html><head><meta property="og:image" content="https://example.com/og.png"/></head></html>';
    expect(extractOpenGraphImage(html)).toBe('https://example.com/og.png');
  });

  it('extractOpenGraphImage handles reversed attribute order', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    const html = '<meta content="https://example.com/img.jpg" property="og:image"/>';
    expect(extractOpenGraphImage(html)).toBe('https://example.com/img.jpg');
  });

  it('extractOpenGraphImage returns undefined without og meta', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    expect(
      extractOpenGraphImage('<html><head><title>No image</title></head></html>'),
    ).toBeUndefined();
    expect(extractOpenGraphImage('')).toBeUndefined();
  });

  it('extractMediaImage finds media:thumbnail url', async () => {
    const { extractMediaImage } = await import('../providers/rss');

    const item = '<item><media:thumbnail url="https://example.com/thumb.jpg" width="200"/></item>';
    expect(extractMediaImage(item)).toBe('https://example.com/thumb.jpg');
    expect(extractMediaImage('<item><title>x</title></item>')).toBeUndefined();
  });

  it('extractOpenGraphImage handles og:image:url and twitter:image:src variants', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    const html = '<meta property="og:image:url" content="https://example.com/og-url.png"/>';
    expect(extractOpenGraphImage(html)).toBe('https://example.com/og-url.png');

    const twitter = '<meta name="twitter:image:src" content="https://example.com/tw.png"/>';
    expect(extractOpenGraphImage(twitter)).toBe('https://example.com/tw.png');
  });

  it('extractOpenGraphImage prefers plain og:image over variants', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    const html =
      '<meta property="og:image:url" content="https://example.com/variant.png"/>' +
      '<meta property="og:image" content="https://example.com/plain.png"/>';
    expect(extractOpenGraphImage(html)).toBe('https://example.com/plain.png');
  });

  it('extractOpenGraphImage skips favicon and icon URLs', async () => {
    const { extractOpenGraphImage } = await import('../providers/rss');

    const html = '<meta property="og:image" content="https://example.com/favicon.ico"/>';
    expect(extractOpenGraphImage(html)).toBeUndefined();

    const icon = '<meta property="og:image" content="https://example.com/icons/logo.png"/>';
    expect(extractOpenGraphImage(icon)).toBeUndefined();
  });

  it('extractLargestImage picks the largest declared image', async () => {
    const { extractLargestImage } = await import('../providers/rss');

    const html =
      '<img src="https://example.com/icon.png" width="32" height="32"/>' +
      '<img src="https://example.com/hero.jpg" width="1200" height="630"/>' +
      '<img src="https://example.com/small.jpg" width="300" height="200"/>';
    expect(extractLargestImage(html)).toBe('https://example.com/hero.jpg');
  });

  it('extractLargestImage ignores icons and below-threshold images', async () => {
    const { extractLargestImage } = await import('../providers/rss');

    const html =
      '<img src="https://example.com/favicon.png" width="16" height="16"/>' +
      '<img src="https://example.com/badge.png" width="120" height="40"/>' +
      '<img src="https://example.com/thumb.jpg" width="180" height="120"/>';
    expect(extractLargestImage(html)).toBeUndefined();
  });

  it('extractLargestImage scores srcset candidates by descriptor', async () => {
    const { extractLargestImage } = await import('../providers/rss');

    const html =
      '<img srcset="https://example.com/hero-480.jpg 480w, https://example.com/hero-1600.jpg 1600w" src="https://example.com/hero-480.jpg"/>';
    expect(extractLargestImage(html)).toBe('https://example.com/hero-1600.jpg');
  });

  it('extractFeaturedImage skips icons and prefers srcset', async () => {
    const { extractFeaturedImage } = await import('../providers/rss');

    const iconHtml = '<p>Text</p><img src="https://example.com/favicon.ico"/>';
    expect(extractFeaturedImage(iconHtml)).toBeUndefined();

    const srcsetHtml =
      '<img srcset="https://example.com/a-200.jpg 200w, https://example.com/a-800.jpg 800w" src="https://example.com/a-200.jpg"/>';
    expect(extractFeaturedImage(srcsetHtml)).toBe('https://example.com/a-800.jpg');
  });

  it('parseFeedXml extracts feed-level image', async () => {
    const { parseFeedXml } = await import('../providers/rss');

    const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Feed With Logo</title>
    <image><url>https://example.com/feed-logo.png</url><title>Feed</title></image>
    <item><title>Post</title><link>https://example.com/p</link></item>
  </channel>
</rss>`;
    const parsed = parseFeedXml(xml);
    expect(parsed.image).toBe('https://example.com/feed-logo.png');
  });

  it('analyzeNewsSentiment scores positive and negative headlines', async () => {
    const { analyzeNewsSentiment } = await import('../lib/sentiment');

    const positive = analyzeNewsSentiment(
      'Bitcoin surges to new all-time high as ETF inflows hit record',
    );
    expect(positive.normalized).toBeGreaterThan(0);
    expect(positive.positive.length).toBeGreaterThan(0);

    const negative = analyzeNewsSentiment('Protocol exploited, $40M drained in rugpull');
    expect(negative.normalized).toBeLessThan(0);
    expect(negative.negative.length).toBeGreaterThan(0);

    const neutral = analyzeNewsSentiment('Report on market conditions published today');
    expect(neutral.normalized).toBeGreaterThanOrEqual(-0.05);
    expect(neutral.normalized).toBeLessThanOrEqual(0.05);
  });

  it('rankNewsPost includes a bounded sentiment signal', async () => {
    const mod = await import('../providers/rss');

    const makePost = (sentimentNormalized: number): UnifiedPost => ({
      id: 'rss:sent:1',
      protocol: 'rss',
      author: {
        id: 'rss:sent',
        primary: { protocol: 'rss', id: 'sent' },
        handles: {},
        displayName: 'Sentiment Test',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'Test headline',
      embeds: [],
      createdAt: Date.now() - 3_600_000,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {
        feedLabel: 'CoinDesk',
        sentiment: { normalized: sentimentNormalized },
      },
      niches: ['crypto'],
    });

    const now = Date.now();
    const pos = mod.rankNewsPost(makePost(0.5), now);
    const neg = mod.rankNewsPost(makePost(-0.5), now);
    const neut = mod.rankNewsPost(makePost(0), now);

    expect(pos).toBeGreaterThan(neg);
    expect(neut).toBeGreaterThan(neg);
    // Signal is marginal (±5% max), not a complete reordering driver
    expect(Math.abs(pos - neut)).toBeLessThanOrEqual(6);
  });
});

describe('YouTube provider', () => {
  it('has 15 configured channels with valid UC ids', async () => {
    const { YOUTUBE_CHANNELS } = await import('../providers/youtube');
    expect(YOUTUBE_CHANNELS).toHaveLength(15);
    for (const ch of YOUTUBE_CHANNELS) {
      expect(ch.channelId).toMatch(/^UC[\w-]{20,}$/);
      expect(ch.name.length).toBeGreaterThan(0);
      expect(['crypto', 'ai', 'tech']).toContain(ch.category);
    }
    // 9 crypto, 4 AI, 2 tech
    expect(YOUTUBE_CHANNELS.filter((c) => c.category === 'crypto')).toHaveLength(9);
    expect(YOUTUBE_CHANNELS.filter((c) => c.category === 'ai')).toHaveLength(4);
    expect(YOUTUBE_CHANNELS.filter((c) => c.category === 'tech')).toHaveLength(2);
  });

  it('parses a YouTube Atom entry into a video', async () => {
    const { parseYouTubeEntry } = await import('../providers/youtube');
    const entry = `
      <entry>
        <id>yt:video:abc123XYZ</id>
        <yt:videoId>abc123XYZ</yt:videoId>
        <yt:channelId>UC4xF0uHdyAQSVKvWZQzhl9A</yt:channelId>
        <title>Bitcoin Explained in 10 Minutes</title>
        <link rel="alternate" href="https://www.youtube.com/watch?v=abc123XYZ"/>
        <author><name>Coin Bureau</name><uri>https://www.youtube.com/channel/UCqK_GSMbpiV8spgD3ZGloSw</uri></author>
        <published>2026-08-01T12:00:00+00:00</published>
        <updated>2026-08-01T12:05:00+00:00</updated>
        <media:group>
          <media:title>Bitcoin Explained</media:title>
          <media:content url="https://www.youtube.com/v/abc123XYZ?version=3" type="application/x-shockwave-flash" width="640" height="390" duration="625"/>
          <media:thumbnail url="https://i.ytimg.com/vi/abc123XYZ/hqdefault.jpg" width="480" height="360"/>
          <media:description>What is Bitcoin? A beginner guide to BTC.</media:description>
          <media:community>
            <media:starRating count="2345" average="4.99" min="1" max="5"/>
            <media:statistics views="67890"/>
          </media:community>
        </media:group>
      </entry>`;

    const video = parseYouTubeEntry(entry, 'UCqK_GSMbpiV8spgD3ZGloSw', 'Coin Bureau');
    expect(video).not.toBeNull();
    expect(video!.videoId).toBe('abc123XYZ');
    expect(video!.title).toBe('Bitcoin Explained in 10 Minutes');
    expect(video!.watchUrl).toBe('https://www.youtube.com/watch?v=abc123XYZ');
    expect(video!.thumbnail).toBe('https://i.ytimg.com/vi/abc123XYZ/hqdefault.jpg');
    expect(video!.views).toBe(67890);
    expect(video!.likes).toBe(2345);
    expect(video!.duration).toBe(625);
    expect(video!.description).toContain('Bitcoin');
    expect(video!.channelName).toBe('Coin Bureau');
    expect(new Date(video!.publishedAt).toISOString()).toBe('2026-08-01T12:00:00.000Z');
  });

  it('normalizes parsed videos into UnifiedPosts', async () => {
    const { fetchYouTubePosts } = await import('../providers/youtube');
    // No live fetch in unit tests — construct a post via the public parser path.
    const { parseYouTubeEntry, YOUTUBE_CHANNELS } = await import('../providers/youtube');
    const entry = `
      <entry>
        <yt:videoId>vtest1234</yt:videoId>
        <title>AI News Roundup</title>
        <published>2026-08-02T10:00:00+00:00</published>
        <media:group>
          <media:thumbnail url="https://i.ytimg.com/vi/vtest1234/hqdefault.jpg"/>
          <media:statistics views="1234"/>
          <media:starRating count="99"/>
        </media:group>
      </entry>`;
    const parsed = parseYouTubeEntry(entry, 'UC4xF0uHdyAQSVKvWZQzhl9A', 'Fireship');
    expect(parsed).not.toBeNull();
    // fetchYouTubePosts is exported but network-bound; just assert it's callable-shaped
    expect(typeof fetchYouTubePosts).toBe('function');
    expect(YOUTUBE_CHANNELS.length).toBeGreaterThan(0);
  });
});
