import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlueskyProvider } from '../providers/bluesky';
import { FarcasterProvider } from '../providers/farcaster';
import { LensProvider } from '../providers/lens';
import { MastodonProvider } from '../providers/mastodon';
import { NostrProvider } from '../providers/nostr';
import { RedditProvider } from '../providers/reddit';
import { RssProvider } from '../providers/rss';
import { isAvailable, ThreadsProvider } from '../providers/threads';

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
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
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
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
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
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ ok: false, status: 503, statusText: 'Unavailable' }),
      );
      const provider = new FarcasterProvider({
        hubUrl: 'https://hub.example.com',
        curatedFids: [1],
      });
      const result = await provider.fetchFeed({ timeoutMs: 100 });
      expect(result.posts.length).toBe(0);
      expect(result.notice).toContain('unavailable');
    });
  });

  describe('LensProvider', () => {
    it('returns empty notice when all endpoints fail', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ ok: false, status: 500, statusText: 'Error' }),
      );
      const provider = new LensProvider();
      const result = await provider.fetchFeed({ timeoutMs: 100 });
      expect(result.posts).toEqual([]);
      expect(result.notice).toBeDefined();
    });
  });

  describe('MastodonProvider', () => {
    it('falls back to public instance when primary fails', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
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
      globalThis.WebSocket = vi.fn().mockImplementation(() => ({
        close: vi.fn(),
        send: vi.fn(),
        set onopen(_: (() => void) | null) {},
        set onmessage(_: ((e: MessageEvent) => void) | null) {},
        set onerror(_: (() => void) | null) {},
        set onclose(_: (() => void) | null) {},
      })) as unknown as typeof WebSocket;

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
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
    it('parses RSS from www.reddit.com', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          text: async () =>
            `<?xml version="1.0"?><rss><channel><title>Bitcoin</title><item><title>Bitcoin hits new ATH</title><link>https://www.reddit.com/r/Bitcoin/comments/1/x</link><description>Bitcoin crypto news</description><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`,
        }),
      );
      const provider = new RedditProvider({ subreddits: ['Bitcoin'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.protocol).toBe('reddit');
      expect(result.posts[0]?.text).toContain('Bitcoin');
    });

    it('returns empty when all strategies fail', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ ok: false, status: 403, statusText: 'Forbidden' }),
      );
      const provider = new RedditProvider({ subreddits: ['Bitcoin'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBe(0);
      expect(result.notice).toBeDefined();
    });
  });

  describe('RssProvider', () => {
    it('parses an RSS feed', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
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
    it('returns empty with notice when Bridgy Fed is not configured', async () => {
      const provider = new ThreadsProvider({ curatedHandles: ['mosseri'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBe(0);
      expect(result.notice).toContain('not configured');
    });

    it('returns posts from Threads accounts via ActivityPub lookup', async () => {
      vi.stubEnv('BRIDGY_FED_ENABLED', 'true');

      // Mock account lookup
      (globalThis.fetch as ReturnType<typeof vi.fn>)
        // Account lookup for mosseri@threads.net
        .mockResolvedValueOnce(
          mockResponse({
            json: async () => ({
              id: '123',
              username: 'mosseri',
              acct: 'mosseri@threads.net',
              display_name: 'Adam Mosseri',
              avatar: 'https://example.com/avatar.jpg',
              header: '',
              header_static: '',
              note: '<p>Threads boss</p>',
              followers_count: 1000,
              following_count: 100,
              fields: [],
            }),
          }),
        )
        // Statuses for that account
        .mockResolvedValueOnce(
          mockResponse({
            json: async () => [
              {
                id: 's1',
                uri: 'https://threads.net/@mosseri/post/1',
                created_at: new Date().toISOString(),
                content: '<p>Threads post about crypto markets</p>',
                visibility: 'public',
                sensitive: false,
                spoiler_text: '',
                media_attachments: [],
                tags: [{ name: 'crypto' }],
                reblogs_count: 5,
                favourites_count: 42,
                replies_count: 3,
                url: 'https://threads.net/@mosseri/post/1',
                in_reply_to_id: null,
                reblog: null,
                card: null,
                account: {
                  id: '123',
                  username: 'mosseri',
                  acct: 'mosseri@threads.net',
                  display_name: 'Adam Mosseri',
                  avatar: 'https://example.com/avatar.jpg',
                  header: '',
                  header_static: '',
                  note: '',
                  followers_count: 1000,
                  following_count: 100,
                  fields: [],
                },
              },
            ],
          }),
        )
        // Hashtag timeline (empty)
        .mockResolvedValueOnce(
          mockResponse({
            json: async () => [],
          }),
        );

      const provider = new ThreadsProvider({ curatedHandles: ['mosseri'] });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      expect(result.posts[0]?.protocol).toBe('threads');
      expect(result.posts[0]?.text).toContain('crypto');
      expect(result.posts[0]?.metrics.likes).toBe(42);

      // Verify ActivityPub metadata on raw
      const raw = result.posts[0]?.raw as Record<string, unknown>;
      expect(raw._viaActivityPub).toBe(true);

      vi.unstubAllEnvs();
    });

    it('reports unhealthy when not configured', async () => {
      const provider = new ThreadsProvider();
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('not configured');
    });

    it('isAvailable returns false when not configured', () => {
      vi.unstubAllEnvs();
      expect(isAvailable()).toBe(false);
    });

    it('isAvailable returns true when BRIDGY_FED_ENABLED is set', () => {
      vi.stubEnv('BRIDGY_FED_ENABLED', 'true');
      expect(isAvailable()).toBe(true);
      vi.unstubAllEnvs();
    });

    it('isAvailable returns true when ACTIVITYPUB_BRIDGE_ENABLED is set', () => {
      vi.stubEnv('ACTIVITYPUB_BRIDGE_ENABLED', 'true');
      expect(isAvailable()).toBe(true);
      vi.unstubAllEnvs();
    });
  });
});
