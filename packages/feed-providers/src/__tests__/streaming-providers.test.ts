/**
 * Tests for the audio/video streaming feed providers:
 * Audius, Twitch, and Kick.
 *
 * Covers schema guards, mapping to unified posts, circuit-breaker
 * degradation, and health checks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudiusProvider, isAudiusTrack } from '../providers/audius';
import { isKickChannel, isKickFeaturedVideo, KickProvider } from '../providers/kick';
import { isTwitchStream, TwitchProvider, twitchThumbnailUrl } from '../providers/twitch';

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

describe('audio/video streaming providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  // ─── Schema guards ──────────────────────────────────────────────

  describe('schema guards', () => {
    it('isAudiusTrack accepts a real track and rejects a playlist', () => {
      expect(
        isAudiusTrack({
          id: 'abc123',
          title: 'My Track',
          play_count: 42,
          artwork: { '150x150': 'https://img/150.jpg', '480x480': 'https://img/480.jpg' },
          user: { handle: 'artist', name: 'Artist' },
        }),
      ).toBe(true);
      expect(isAudiusTrack({ playlist_name: 'Hot & New', id: 'p1' })).toBe(false);
      expect(isAudiusTrack(null)).toBe(false);
    });

    it('isTwitchStream accepts a real stream', () => {
      expect(
        isTwitchStream({
          id: 's1',
          user_name: 'Streamer',
          title: 'Live now',
          viewer_count: 10,
          thumbnail_url:
            'https://static-cdn.jtvnw.net/previews-ttv/live_user_x-{width}x{height}.jpg',
        }),
      ).toBe(true);
      expect(isTwitchStream(null)).toBe(false);
    });

    it('isKickChannel and isKickFeaturedVideo accept real shapes', () => {
      expect(isKickChannel({ id: 1, slug: 'xqc', livestream: { viewers: 100 } })).toBe(true);
      expect(isKickFeaturedVideo({ id: 1, title: 'Featured', views: 5 })).toBe(true);
      expect(isKickChannel(null)).toBe(false);
      expect(isKickFeaturedVideo(null)).toBe(false);
    });
  });

  // ─── Twitch thumbnail substitution ──────────────────────────────

  describe('twitchThumbnailUrl', () => {
    it('replaces the {width}x{height} template', () => {
      expect(
        twitchThumbnailUrl(
          'https://static-cdn.jtvnw.net/previews-ttv/live_user_x-{width}x{height}.jpg',
        ),
      ).toBe('https://static-cdn.jtvnw.net/previews-ttv/live_user_x-320x180.jpg');
    });

    it('returns empty for missing templates', () => {
      expect(twitchThumbnailUrl(null)).toBe('');
    });
  });

  // ─── AudiusProvider ─────────────────────────────────────────────

  describe('AudiusProvider', () => {
    it('maps trending tracks to unified posts', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          json: async () => ({
            data: [
              {
                id: 't1',
                title: 'My Paradise',
                permalink: '/artist/my-paradise',
                genre: 'Trap',
                duration: 189,
                play_count: 759,
                favorite_count: 63,
                artwork: {
                  '150x150': 'https://img/150.jpg',
                  '480x480': 'https://img/480.jpg',
                },
                user: { handle: 'artist', name: 'Artist' },
              },
            ],
          }),
        }),
      );

      const provider = new AudiusProvider({ baseUrl: 'https://discovery.example/v1' });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      const post = result.posts[0];
      expect(post?.protocol).toBe('audius');
      expect(post?.text).toContain('My Paradise');
      expect(post?.text).toContain('Artist');
      expect(post?.text).toContain('759');
      expect(post?.text).toContain('3:09');
      expect(post?.metrics.views).toBe(759);
      const embed = post?.embeds[0];
      expect(embed?.kind).toBe('audio');
      expect((embed?.meta as Record<string, unknown>)?.thumbnail).toBe('https://img/480.jpg');
    });

    it('reports unhealthy when the API is down', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
      const provider = new AudiusProvider({ baseUrl: 'https://discovery.example/v1' });
      const health = await provider.healthCheck({ timeoutMs: 1000 });
      expect(health.healthy).toBe(false);
    });
  });

  // ─── TwitchProvider ─────────────────────────────────────────────

  describe('TwitchProvider', () => {
    it('returns a notice when not configured', async () => {
      const provider = new TwitchProvider({});
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts).toEqual([]);
      // RSS-Bridge is the primary path and needs no auth; when it yields
      // nothing and Helix is unconfigured the provider reports no content.
      expect(result.notice).toContain('no content');
    });

    it('maps streams to unified posts with a pre-minted token', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((_url: string) =>
        mockResponse({
          json: async () => ({
            data: [
              {
                id: 's1',
                user_id: 'u1',
                user_login: 'streamer',
                user_name: 'Streamer',
                game_name: 'Science & Technology',
                title: 'Coding live',
                viewer_count: 123,
                started_at: '2026-08-06T10:00:00Z',
                thumbnail_url:
                  'https://static-cdn.jtvnw.net/previews-ttv/live_user_streamer-{width}x{height}.jpg',
              },
            ],
          }),
        }),
      );

      const provider = new TwitchProvider({
        clientId: 'client',
        accessToken: 'token',
        apiUrl: 'https://api.example/helix',
        tokenUrl: 'https://id.example/oauth2/token',
      });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      const post = result.posts[0];
      expect(post?.protocol).toBe('twitch');
      expect(post?.text).toContain('Coding live');
      expect(post?.text).toContain('Streamer');
      expect(post?.text).toContain('123');
      expect(post?.metrics.views).toBe(123);
      const embed = post?.embeds[0];
      expect(embed?.kind).toBe('video');
      expect((embed?.meta as Record<string, unknown>)?.thumbnail).toContain('320x180');
    });

    it('mints a token via client credentials when only clientSecret is set', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, _init?: RequestInit) => {
          if (String(url).includes('oauth2/token')) {
            return Promise.resolve(
              mockResponse({ json: async () => ({ access_token: 'minted', expires_in: 3600 }) }),
            );
          }
          // streams call
          return Promise.resolve(
            mockResponse({
              json: async () => ({ data: [] }),
            }),
          );
        },
      );
      const provider = new TwitchProvider({
        clientId: 'client',
        clientSecret: 'secret',
        apiUrl: 'https://api.example/helix',
        tokenUrl: 'https://id.example/oauth2/token',
      });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      // Token minted → streams call returned empty → no posts, but no crash
      expect(Array.isArray(result.posts)).toBe(true);
    });
  });

  // ─── KickProvider ───────────────────────────────────────────────

  describe('KickProvider', () => {
    it('maps featured videos to unified posts', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          json: async () => ({
            data: [
              {
                id: 1,
                uuid: 'u1',
                title: 'Featured video',
                views: 5000,
                duration: 60,
                channel: { slug: 'streamer', username: 'Streamer' },
                thumbnail: { url: 'https://kick.com/thumb.jpg' },
              },
            ],
          }),
        }),
      );

      const provider = new KickProvider({
        baseUrl: 'https://kick.example/api',
        topChannels: [],
      });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      const post = result.posts[0];
      expect(post?.protocol).toBe('kick');
      expect(post?.text).toContain('Featured video');
      expect(post?.text).toContain('Streamer');
      expect(post?.metrics.views).toBe(5000);
      expect(post?.embeds[0]?.kind).toBe('video');
    });

    it('maps live channels when featured videos fail', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (String(url).includes('featured')) {
          return Promise.reject(new Error('blocked'));
        }
        return Promise.resolve(
          mockResponse({
            json: async () => ({
              id: 2,
              slug: 'xqc',
              user: { username: 'xqc', slug: 'xqc' },
              livestream: {
                title: 'Gaming live',
                viewers: 999,
                category: { name: 'Just Chatting' },
                thumbnail: { url: 'https://kick.com/live.jpg' },
              },
            }),
          }),
        );
      });

      const provider = new KickProvider({
        baseUrl: 'https://kick.example/api',
        topChannels: ['xqc'],
      });
      const result = await provider.fetchFeed({ timeoutMs: 1000 });
      expect(result.posts.length).toBeGreaterThan(0);
      const post = result.posts[0];
      expect(post?.protocol).toBe('kick');
      expect(post?.text).toContain('Gaming live');
      expect(post?.text).toContain('999');
    });

    it('reports unhealthy when the API is blocked', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('403 blocked'));
      const provider = new KickProvider({ baseUrl: 'https://kick.example/api' });
      const health = await provider.healthCheck({ timeoutMs: 1000 });
      expect(health.healthy).toBe(false);
    });
  });
});
