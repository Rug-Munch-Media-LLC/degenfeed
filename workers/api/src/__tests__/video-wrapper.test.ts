/**
 * @degenfeed/api-worker — Video Wrapper (oEmbed + Media RSS) Tests
 *
 * Verifies the discovery layer of the Video Wrapper system:
 *   1. oEmbed JSON for PeerTube URLs (protocol surfaces present)
 *   2. oEmbed JSON for Blossom / direct mp4 URLs
 *   3. oEmbed JSON for IPFS gateway URLs
 *   4. oEmbed JSON for YouTube URLs (iframe embed)
 *   5. Invalid URL rejected
 *   6. Media RSS feed renders announced videos with enclosures
 */

import { describe, expect, it, vi } from 'vitest';
import { announceVideoPublished, appendAnnouncedVideo } from '../lib/video-announcer';
import { getAnnouncedVideos, videoEmbed } from '../routes/video/embed';

// ─── Mock Env ─────────────────────────────────────────────────────────────

function createMockEnv(overrides: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  const cache = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  return {
    env: {
      CACHE: cache,
      RELAY_URLS: 'wss://relay.damus.io',
      NOSTR_NSEC: '',
      ...overrides,
    },
    store,
  };
}

function fetchJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('video embed oEmbed — PeerTube', () => {
  it('returns oEmbed JSON with protocol surfaces for a PeerTube URL', async () => {
    const { env } = createMockEnv({ NOSTR_NSEC: 'nsec-placeholder-not-used-for-get' });
    const req = new Request(
      'https://degenfeed.xyz/api/video/embed?url=https%3A%2F%2Fvideo.degenfeed.xyz%2Fvideos%2Fwatch%2Fabc123-def456',
    );

    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent('https://video.degenfeed.xyz/videos/watch/abc123-def456')}`,
      req,
      env,
    );
    expect(res.status).toBe(200);

    const body = (await fetchJson(res)) as {
      type: string;
      source: string;
      canonical_url: string;
      protocols: Record<string, unknown>;
      html: string;
    };
    expect(body.type).toBe('video');
    expect(body.source).toBe('peertube');
    expect(body.canonical_url).toContain('video.degenfeed.xyz');
    expect(body.html).toContain('<iframe');
    expect(body.protocols.activitypub).toBeDefined();
    expect(body.protocols.bluesky).toBeDefined();
    expect(body.protocols.farcaster).toBeDefined();
    expect(body.protocols.rss).toBeDefined();
    expect(body.protocols.lens).toBeDefined();
  });

  it('returns protocol surfaces even without a Nostr key (no nostr surface)', async () => {
    const { env } = createMockEnv({});
    const req = new Request(
      'https://degenfeed.xyz/api/video/embed?url=' +
        encodeURIComponent('https://video.degenfeed.xyz/w/xyz789'),
    );
    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent('https://video.degenfeed.xyz/w/xyz789')}`,
      req,
      env,
    );
    const body = (await fetchJson(res)) as { protocols: Record<string, unknown> };
    expect(res.status).toBe(200);
    expect(body.protocols.nostr).toBeUndefined();
  });
});

describe('video embed oEmbed — Blossom / direct / IPFS / YouTube', () => {
  it('renders a <video> tag for Blossom blob URLs', async () => {
    const { env } = createMockEnv({});
    const url =
      'https://blossom.nostr.build/media/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent(url)}`,
      new Request('https://x/api/video/embed'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await fetchJson(res)) as { source: string; html: string };
    expect(body.source).toBe('blossom');
    expect(body.html).toContain('<video');
  });

  it('renders a <video> tag for direct mp4 URLs', async () => {
    const { env } = createMockEnv({});
    const url = 'https://cdn.degenfeed.xyz/clips/test-clip.mp4';
    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent(url)}`,
      new Request('https://x/api/video/embed'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await fetchJson(res)) as { source: string; html: string };
    expect(body.source).toBe('direct');
    expect(body.html).toContain('<video');
  });

  it('renders a <video> tag for IPFS gateway URLs', async () => {
    const { env } = createMockEnv({});
    const url = 'https://ipfs.degenfeed.xyz/ipfs/QmT5NvUtoM5nWFfrQdVrFtvGf1mC3G7suVysMBicPDdA1e';
    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent(url)}`,
      new Request('https://x/api/video/embed'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await fetchJson(res)) as { source: string; html: string };
    expect(body.source).toBe('ipfs');
    expect(body.html).toContain('<video');
  });

  it('renders an iframe for YouTube URLs', async () => {
    const { env } = createMockEnv({});
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const res = await videoEmbed.request(
      `/?url=${encodeURIComponent(url)}`,
      new Request('https://x/api/video/embed'),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await fetchJson(res)) as { source: string; html: string };
    expect(body.source).toBe('youtube');
    expect(body.html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('rejects invalid URLs', async () => {
    const { env } = createMockEnv({});
    const res = await videoEmbed.request(
      '/?url=not-a-url',
      new Request('https://x/api/video/embed'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects missing url param', async () => {
    const { env } = createMockEnv({});
    const res = await videoEmbed.request('/', new Request('https://x/api/video/embed'), env);
    expect(res.status).toBe(400);
  });
});

describe('video announcer + Media RSS', () => {
  it('appends and reads announced videos in KV', async () => {
    const { env, store } = createMockEnv({});
    const item = {
      id: 'video-1',
      title: 'Test Announcement',
      url: 'https://video.degenfeed.xyz/videos/watch/video-1',
      enclosureUrl: 'https://video.degenfeed.xyz/static/video-1.mp4',
      enclosureType: 'video/mp4',
      enclosureLength: 1024,
      thumbnailUrl: 'https://video.degenfeed.xyz/thumb/video-1.jpg',
      description: 'A test video',
      publishedAt: Date.now(),
    };
    const ok = await appendAnnouncedVideo(env, item);
    expect(ok).toBe(true);
    expect(store.has('video:announcements:v1:list')).toBe(true);

    const items = await getAnnouncedVideos(env);
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('video-1');
    expect(items[0]?.enclosureType).toBe('video/mp4');
  });

  it('dedupes by video id (newest wins)', async () => {
    const { env } = createMockEnv({});
    await appendAnnouncedVideo(env, {
      id: 'dup-1',
      title: 'Old',
      url: 'https://x/1',
      enclosureUrl: 'https://x/1.mp4',
      enclosureType: 'video/mp4',
      publishedAt: 1,
    });
    await appendAnnouncedVideo(env, {
      id: 'dup-1',
      title: 'New',
      url: 'https://x/2',
      enclosureUrl: 'https://x/2.mp4',
      enclosureType: 'video/mp4',
      publishedAt: 2,
    });
    const items = await getAnnouncedVideos(env);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('New');
  });

  it('renders Media RSS with enclosure for announced videos', async () => {
    const { env } = createMockEnv({});
    await appendAnnouncedVideo(env, {
      id: 'rss-1',
      title: 'RSS Video',
      url: 'https://video.degenfeed.xyz/videos/watch/rss-1',
      enclosureUrl: 'https://video.degenfeed.xyz/static/rss-1.mp4',
      enclosureType: 'video/mp4',
      enclosureLength: 2048,
      publishedAt: 1700000000000,
    });

    const res = await videoEmbed.request(
      '/rss.xml',
      new Request('https://degenfeed.xyz/api/video/rss.xml'),
      env,
    );
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>RSS Video</title>');
    expect(xml).toContain(
      '<enclosure url="https://video.degenfeed.xyz/static/rss-1.mp4" type="video/mp4" length="2048"',
    );
    expect(xml).toContain('xmlns:media=');
  });

  it('announceVideoPublished records RSS and fails open without Nostr key', async () => {
    const { env } = createMockEnv({ NOSTR_NSEC: '' });
    const result = await announceVideoPublished(env, {
      id: 'ann-1',
      title: 'Announced',
      url: 'https://video.degenfeed.xyz/videos/watch/ann-1',
      fileUrl: 'https://video.degenfeed.xyz/static/ann-1.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 4096,
      duration: 120,
      tags: ['test'],
    });
    expect(result.activitypub?.ok).toBe(true);
    expect(result.rss?.ok).toBe(true);
    expect(result.nostr?.ok).toBe(false);
    expect(result.nostr?.error).toContain('NOSTR_NSEC');
  });
});
