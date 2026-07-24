/**
 * @degenfeed/local-bridge — PeerTube Provider Tests
 *
 * Covers:
 * - guessNiches niche detection
 * - videoToPost mapping
 * - fetchPeerTubePosts error handling
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { guessNiches, videoToPost } from '../../bridge/src/providers/peertube';

function makeVideo(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    uuid: 'abc-def-ghi',
    name: 'Bitcoin Explained',
    description: 'A comprehensive guide to Bitcoin and blockchain technology.',
    category: { id: 1, label: 'Education' },
    licence: { id: 1, label: 'Attribution' },
    language: { id: 'en', label: 'English' },
    privacy: { id: 1, label: 'Public' },
    nsfw: false,
    url: 'https://peertube.example.com/videos/watch/abc-def-ghi',
    duration: 1200,
    views: 5000,
    likes: 200,
    dislikes: 5,
    thumbnailPath: '/static/thumbnails/abc.jpg',
    previewPath: '/static/previews/abc.jpg',
    embedPath: '/videos/embed/abc-def-ghi',
    createdAt: '2026-07-23T08:00:00Z',
    publishedAt: '2026-07-24T10:00:00Z',
    updatedAt: '2026-07-24T11:00:00Z',
    account: {
      id: 42,
      name: 'crypto-edu',
      displayName: 'Crypto Education',
      url: 'https://peertube.example.com/accounts/crypto-edu',
      avatar: { path: '/static/avatars/crypto-edu.jpg' },
    },
    channel: {
      id: 7,
      name: 'crypto-edu-channel',
      displayName: 'Crypto Education Channel',
      url: 'https://peertube.example.com/channels/crypto-edu-channel',
      avatar: { path: '/static/avatars/channel.jpg' },
    },
    ...overrides,
  };
}

describe('PeerTube Provider — guessNiches', () => {
  it('should detect bitcoin from video name', () => {
    expect(guessNiches('', 'Bitcoin 101')).toContain('bitcoin');
  });

  it('should detect defi from description text', () => {
    expect(
      guessNiches('Learn about DeFi yield farming and liquidity pools', 'DeFi Tutorial'),
    ).toContain('defi');
  });

  it('should detect educational niche from tutorial mention', () => {
    expect(guessNiches('Learn how to code in Rust', 'Rust Tutorial for Beginners')).toContain(
      'educational',
    );
  });

  it('should detect review niche from review mention', () => {
    expect(guessNiches('Product review of new hardware wallet', 'Ledger Review')).toContain(
      'review',
    );
  });

  it('should default to crypto when no match', () => {
    expect(guessNiches('Cooking pasta with fresh ingredients', 'Pasta Recipe')).toEqual(['crypto']);
  });

  it('should detect multiple relevant niches', () => {
    const niches = guessNiches('How to avoid phishing scams in DeFi', 'Security Tutorial');
    expect(niches).toContain('defi');
    expect(niches).toContain('security');
    expect(niches).toContain('educational');
  });
});

describe('PeerTube Provider — videoToPost', () => {
  it('should map video to UnifiedPost shape', () => {
    const video = makeVideo();
    const post = videoToPost(video);

    expect(post.id).toBe('peertube:abc-def-ghi');
    expect(post.protocol).toBe('peertube');
    expect(post.text).toContain('Bitcoin Explained');
    expect(post.text).toContain('comprehensive guide');
    expect(post.author.displayName).toBe('Crypto Education');
    expect(post.author.avatarUrl).toContain('/static/avatars/crypto-edu.jpg');
    expect(post.createdAt).toBe(new Date('2026-07-24T10:00:00Z').getTime());
    expect(post.metrics.likes).toBe(200);
    expect(post.metrics.views).toBe(5000);
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]?.kind).toBe('video');
    expect(post.embeds[0]?.meta?.duration).toBe(1200);
    expect(post.embeds[0]?.meta?.views).toBe(5000);
  });

  it('should fall back to channel if account is missing', () => {
    const video = makeVideo({ account: undefined });
    const post = videoToPost(video);
    expect(post.author.displayName).toBe('Crypto Education Channel');
    expect(post.author.avatarUrl).toContain('/static/avatars/channel.jpg');
  });

  it('should handle missing publishedAt by using createdAt', () => {
    const video = makeVideo({ publishedAt: undefined });
    const post = videoToPost(video);
    expect(post.createdAt).toBe(new Date('2026-07-23T08:00:00Z').getTime());
  });

  it('should handle NaN createdAt gracefully', () => {
    const video = makeVideo({ publishedAt: 'bad-date', createdAt: 'also-bad' });
    const post = videoToPost(video);
    expect(post.createdAt).toBeGreaterThan(0);
  });

  it('should generate URL from uuid when not provided', () => {
    const video = makeVideo({ url: undefined });
    const post = videoToPost(video);
    expect(post.embeds[0]?.url).toContain('abc-def-ghi');
  });
});

describe('PeerTube Provider — fetchPeerTubePosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchPeerTubePosts } = await import('../../bridge/src/providers/peertube');
    const posts = await fetchPeerTubePosts(10);
    expect(posts).toEqual([]);
  });

  it('should return empty array on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const { fetchPeerTubePosts } = await import('../../bridge/src/providers/peertube');
    const posts = await fetchPeerTubePosts(10);
    expect(posts).toEqual([]);
  });

  it('should return empty array when response has no data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ total: 0, data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { fetchPeerTubePosts } = await import('../../bridge/src/providers/peertube');
    const posts = await fetchPeerTubePosts(10);
    expect(posts).toEqual([]);
  });
});
