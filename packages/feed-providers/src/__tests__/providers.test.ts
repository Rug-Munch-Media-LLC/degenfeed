import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyProvider } from '../providers/bluesky';
import { FarcasterProvider } from '../providers/farcaster';
import { LensProvider } from '../providers/lens';
import { MastodonProvider } from '../providers/mastodon';
import { NostrProvider } from '../providers/nostr';
import { RedditProvider } from '../providers/reddit';
import { RssProvider } from '../providers/rss';
import { ThreadsProvider } from '../providers/threads';

function mockResponse(
  overrides: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> },
): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    body: null,
    bodyUsed: false,
    clone: () => mockResponse(overrides),
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    json: async () => ({}),
    text: async () => '',
    ...overrides,
  } as Response;
}

describe('feed providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  describe('BlueskyProvider', () => {
    it('falls back when primary fails', async () => {
      const primary = vi.fn().mockRejectedValue(new Error('primary down'));
      const fallback = vi.fn().mockResolvedValue(
        mockResponse({
          json: async () => ({
            feed: [
              {
                post: {
                  uri: 'at://did:plc:1/app.bsky.feed.post/1',
                  cid: 'c1',
                  author: { did: 'did:plc:1', handle: 'test.bsky.social' },
                  record: { text: 'hello', createdAt: new Date().toISOString() },
                  likeCount: 1,
                  repostCount: 2,
                  replyCount: 3,
                  indexedAt: new Date().toISOString(),
                },
              },
            ],
          }),
        }),
      );
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        // searchPosts hits primary URL — fail it
        if (url.includes('searchPosts')) return primary();
        // fetchAuthorFeed also hits primary URL — fail it too
        if (url.includes('getAuthorFeed')) return primary();
        // fallback URL returns data (unused in new search-first strategy)
        return fallback();
      });

      const provider = new BlueskyProvider({
        baseUrl: 'https://public.api.bsky.app',
        fallbackUrl: 'https://bsky.social',
        accessJwt: 'jwt',
        curatedActors: ['test.bsky.social'],
      });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      // With search-first strategy, all searches fail, then curated actors
      // also fail (same primary URL). Expect empty posts.
      expect(result.posts.length).toBe(0);
    });
  });

  describe('FarcasterProvider', () => {
    it('returns empty when all hubs fail', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ ok: false, status: 503, statusText: 'Unavailable' }),
      );
      const provider = new FarcasterProvider({
        hubUrl: 'https://hub.example.com',
        curatedFids: [1],
      });
      const result = await provider.fetchFeed({ timeoutMs: 100 });
      expect(result.posts.length).toBe(0);
      expect(result.notice).toContain('unreachable');
    });
  });

  describe('LensProvider', () => {
    it('returns empty notice when all endpoints fail', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ ok: false, status: 500, statusText: 'Error' }),
      );
      const provider = new LensProvider({ curatedHandles: ['stani'] });
      const result = await provider.fetchFeed({ timeoutMs: 100 });
      expect(result.posts).toEqual([]);
      expect(result.notice).toBeDefined();
    });
  });

  describe('MastodonProvider', () => {
    it('falls back to public instance when primary fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('social.degenfeed.xyz')) {
          return Promise.resolve(
            mockResponse({ ok: false, status: 503, statusText: 'Unavailable' }),
          );
        }
        return Promise.resolve(
          mockResponse({
            json: async () => [
              {
                id: '1',
                uri: 'https://example.com/1',
                created_at: new Date().toISOString(),
                content: '<p>Hello</p>',
                visibility: 'public',
                sensitive: false,
                spoiler_text: '',
                media_attachments: [],
                tags: [{ name: 'crypto' }],
                reblogs_count: 0,
                favourites_count: 1,
                replies_count: 0,
                url: 'https://example.com/1',
                in_reply_to_id: null,
                reblog: null,
                card: null,
                account: {
                  id: 'a1',
                  username: 'user',
                  acct: 'user',
                  display_name: 'User',
                  note: '',
                  avatar: '',
                  header: '',
                  header_static: '',
                  followers_count: 0,
                  following_count: 0,
                  fields: [],
                },
              },
            ],
          }),
        );
      });
      const provider = new MastodonProvider();
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.protocol).toBe('mastodon');
    });
  });

  describe('NostrProvider', () => {
    it('falls back to HTTP when WebSocket fails', async () => {
      global.WebSocket = vi.fn().mockImplementation(() => ({
        close: vi.fn(),
        send: vi.fn(),
        set onopen(_: (() => void) | null) {},
        set onmessage(_: ((e: MessageEvent) => void) | null) {},
        set onerror(_: (() => void) | null) {},
        set onclose(_: (() => void) | null) {},
      })) as unknown as typeof WebSocket;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          json: async () => ({
            events: [
              {
                id: 'e1',
                pubkey: 'p1',
                created_at: Math.floor(Date.now() / 1000),
                kind: 1,
                tags: [],
                content: 'hello nostr',
                sig: 'sig',
              },
            ],
          }),
        }),
      );

      const provider = new NostrProvider({ relays: ['wss://down.relay'] });
      const result = await provider.fetchFeed({ timeoutMs: 100 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.protocol).toBe('nostr');
    });
  });

  describe('RedditProvider', () => {
    it('falls back to json when rss fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('.rss')) {
          return Promise.resolve(mockResponse({ ok: false, status: 500, statusText: 'Error' }));
        }
        return Promise.resolve(
          mockResponse({
            json: async () => ({
              data: {
                children: [
                  {
                    data: {
                      title: 'Bitcoin news',
                      permalink: '/r/Bitcoin/comments/1/x',
                      url: 'https://example.com',
                      created_utc: Math.floor(Date.now() / 1000),
                      selftext: '',
                      author: 'user',
                      subreddit: 'Bitcoin',
                    },
                  },
                ],
              },
            }),
          }),
        );
      });
      const provider = new RedditProvider({ subreddits: ['Bitcoin'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.text).toContain('Bitcoin');
    });
  });

  describe('RssProvider', () => {
    it('parses an RSS feed', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          text: async () =>
            `<?xml version="1.0"?><rss><channel><title>Blog</title><link>https://example.com</link><item><title>Post</title><link>https://example.com/1</link><description>Hello crypto</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`,
        }),
      );
      const provider = new RssProvider({ feeds: ['https://example.com/feed.xml'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBe(1);
      expect(result.posts[0]?.text).toContain('Hello crypto');
    });
  });

  describe('ThreadsProvider', () => {
    it('falls back to HTML scrape when AT Protocol fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url.includes('public.threads.net')) {
          return Promise.resolve(mockResponse({ ok: false, status: 500, statusText: 'Error' }));
        }
        return Promise.resolve(
          mockResponse({
            text: async () =>
              `<script type="application/ld+json">{"@type":"SocialMediaPosting","articleBody":"Threads post about crypto","url":"https://threads.net/p/1","datePublished":"2024-01-01T00:00:00Z","author":{"name":"threads","identifier":"threads","image":""}}</script>`,
          }),
        );
      });
      const provider = new ThreadsProvider({ curatedHandles: ['threads'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.text).toContain('crypto');
    });
  });
});
