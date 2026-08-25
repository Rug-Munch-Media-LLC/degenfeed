/**
 * @degenfeed/local-bridge — Lemmy Provider Tests
 *
 * Covers:
 * - guessNiches niche detection with community context
 * - postToUnified mapping
 * - fetchLemmyPosts error handling
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { guessNiches, postToUnified } from '../../bridge/src/providers/lemmy';

function makePostView(overrides: Record<string, unknown> = {}) {
  return {
    post: {
      id: 42,
      name: 'Bitcoin is the future',
      body: 'I believe Bitcoin will reach new highs this cycle.',
      published: '2026-07-24T10:00:00Z',
      ap_id: 'https://lemmy.world/post/42',
      url: 'https://example.com/article',
      embed_title: undefined,
      embed_description: undefined,
      thumbnail_url: undefined,
      nsfw: false,
      deleted: false,
      removed: false,
    },
    creator: {
      person: {
        id: 7,
        name: 'satoshi',
        display_name: 'Satoshi Nakamoto',
        avatar: 'https://example.com/avatar.png',
        actor_id: 'https://lemmy.world/u/satoshi',
      },
    },
    community: {
      community: {
        id: 3,
        name: 'bitcoin',
        title: 'Bitcoin Community',
        actor_id: 'https://lemmy.world/c/bitcoin',
      },
    },
    counts: {
      upvotes: 150,
      downvotes: 5,
      score: 145,
      comments: 23,
    },
    ...overrides,
  };
}

describe('Lemmy Provider — guessNiches', () => {
  it('should detect bitcoin from community name', () => {
    expect(guessNiches('Great content here', 'bitcoin')).toContain('bitcoin');
  });

  it('should detect defi from community name', () => {
    expect(guessNiches('Yield farming strategies', 'defi')).toContain('defi');
  });

  it('should detect ethereum from text', () => {
    const niches = guessNiches('Ethereum L2s are scaling well', 'crypto');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('crypto');
  });

  it('should detect tech from programming community', () => {
    const niches = guessNiches('Rust borrow checker explained', 'programming');
    expect(niches).toContain('tech');
  });

  it('should detect web3 from community name', () => {
    expect(guessNiches('Decentralized web', 'web3')).toContain('web3');
  });

  it('should default to crypto when no niche matches', () => {
    expect(guessNiches('Random discussion topic', 'general')).toEqual(['crypto']);
  });

  it('should detect ai from agent in text', () => {
    expect(guessNiches('AI agents are the next big thing', 'technology')).toContain('ai');
  });
});

describe('Lemmy Provider — postToUnified', () => {
  it('should map post view to UnifiedPost shape', () => {
    const pv = makePostView();
    const post = postToUnified(pv, 'lemmy.world', 'bitcoin');

    expect(post.id).toBe('lemmy:42@lemmy.world');
    expect(post.protocol).toBe('lemmy');
    expect(post.text).toContain('Bitcoin is the future');
    expect(post.text).toContain('I believe Bitcoin will reach new highs');
    expect(post.author.displayName).toBe('Satoshi Nakamoto');
    expect(post.author.handles.lemmy).toBe('satoshi@lemmy.world');
    expect(post.author.avatarUrl).toBe('https://example.com/avatar.png');
    expect(post.metrics.likes).toBe(150);
    expect(post.metrics.replies).toBe(23);
    expect(post.embeds).toHaveLength(1);
    expect(post.embeds[0]?.kind).toBe('link');
    expect(post.niches).toContain('bitcoin');
  });

  it('should return null for missing post data', () => {
    const post = postToUnified({} as never, 'lemmy.world', 'crypto');
    expect(post).toBeNull();
  });

  it('should handle missing creator gracefully', () => {
    const pv = makePostView({ creator: undefined });
    const post = postToUnified(pv, 'lemmy.world', 'crypto');
    expect(post).not.toBeNull();
    expect(post?.author.displayName).toContain('user@');
  });

  it('should handle missing counts', () => {
    const pv = makePostView({ counts: undefined });
    const post = postToUnified(pv, 'lemmy.world', 'crypto');
    expect(post?.metrics.likes).toBe(0);
    expect(post?.metrics.replies).toBe(0);
  });

  it('should handle NaN createdAt', () => {
    const pv = makePostView({ post: { ...makePostView().post, published: 'bad-date' } });
    const post = postToUnified(pv, 'lemmy.world', 'crypto');
    expect(post?.createdAt).toBeGreaterThan(0);
  });
});

describe('Lemmy Provider — fetchLemmyPosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when all fetches fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchLemmyPosts } = await import('../../bridge/src/providers/lemmy');
    const posts = await fetchLemmyPosts(10);
    expect(posts).toEqual([]);
  });

  it('should handle non-ok responses gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const { fetchLemmyPosts } = await import('../../bridge/src/providers/lemmy');
    const posts = await fetchLemmyPosts(10);
    expect(posts).toEqual([]);
  });
});
