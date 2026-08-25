/**
 * @degenfeed/local-bridge — PeerTube Provider Tests
 *
 * Covers:
 * - guessNiches niche detection
 * - videoToPost mapping
 * - fetchPeerTubePosts contract verification
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
    publishedAt: '2026-07-24T10:00:00Z',
    createdAt: '2026-07-24T10:00:00Z',
    channel: {
      id: 456,
      name: 'Crypto Channel',
      displayName: 'Crypto Channel',
      description: 'All about crypto',
      url: 'https://peertube.example.com/video-channels/crypto-channel',
      avatar: { path: '/static/avatars/channel.jpg' },
      ownerAccount: {
        id: 789,
        displayName: 'Crypto Creator',
        url: 'https://peertube.example.com/accounts/crypto',
      },
    },
    tags: ['Bitcoin', 'crypto', 'blockchain'],
    ...overrides,
  };
}

describe('PeerTube Provider — guessNiches', () => {
  it('should detect bitcoin from text', () => {
    const niches = guessNiches('Bitcoin is the future!', 'Bitcoin Channel');
    expect(niches).toContain('bitcoin');
  });

  it('should detect ethereum from text', () => {
    const niches = guessNiches('Ethereum merge is coming', 'Crypto Channel');
    expect(niches).toContain('ethereum');
  });

  it('should detect ai and tech niches', () => {
    const niches = guessNiches('Building AI agents with Python', 'Tech Channel');
    expect(niches).toContain('ai');
    expect(niches).toContain('tech');
  });

  it('should fall back to crypto for unknown content', () => {
    const niches = guessNiches('A beautiful sunset', 'Scenic Channel');
    expect(niches).toContain('crypto');
  });
});

describe('PeerTube Provider — videoToPost', () => {
  it('should map video to UnifiedPost shape', () => {
    const video = makeVideo();
    const post = videoToPost(video);

    expect(post.id).toBe('peertube:abc-def-ghi');
    expect(post.protocol).toBe('peertube');
    expect(post.text).toContain('Bitcoin Explained');
    expect(post.text).toContain('Bitcoin and blockchain');
    expect(post.author.displayName).toBe('Crypto Creator');
    expect(post.metrics.likes).toBe(200);
    expect(post.metrics.views).toBe(5000);
  });

  it('should extract embed URL from video', () => {
    const video = makeVideo();
    const post = videoToPost(video);
    expect(post.embeds.length).toBeGreaterThan(0);
    expect(post.embeds[0]?.url).toContain('abc-def-ghi');
  });

  it('should handle missing description gracefully', () => {
    const video = makeVideo({ description: undefined });
    const post = videoToPost(video);
    expect(post.text).toContain('Bitcoin Explained');
  });

  it('should handle missing channel avatar', () => {
    const video = makeVideo({ channel: { ...makeVideo().channel, avatar: undefined } });
    const post = videoToPost(video);
    expect(post.author.avatarUrl).toBe('');
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

describe('PeerTube Provider — fetchPeerTubePosts (contract)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be an async function', async () => {
    const { fetchPeerTubePosts } = await import('../../bridge/src/providers/peertube');
    expect(fetchPeerTubePosts).toBeInstanceOf(Function);
    const result = fetchPeerTubePosts(10);
    expect(result).toBeInstanceOf(Promise);
  });
});
