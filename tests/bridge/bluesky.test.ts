/**
 * @degenfeed/local-bridge — Bluesky Provider Tests
 *
 * Covers:
 * - guessNiches niche detection
 * - postToUnified mapping correctness
 * - fetchBlueskyPosts shape, error handling, dedup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We import the source functions directly.
// For fetch-based tests we mock globalThis.fetch.
import { guessNiches, postToUnified } from '../../bridge/src/providers/bluesky';

// Helper to create a minimal BskyPostView
function makePost(overrides: Record<string, unknown> = {}) {
  return {
    uri: 'at://did:plc:test/app.bsky.feed.post/abc123',
    cid: 'cid123',
    author: {
      did: 'did:plc:test',
      handle: 'test.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
    record: {
      text: 'Bitcoin is the future! #btc',
      createdAt: '2026-07-24T10:00:00Z',
      embed: undefined,
    },
    likeCount: 42,
    repostCount: 10,
    replyCount: 5,
    indexedAt: '2026-07-24T10:01:00Z',
    ...overrides,
  };
}

// Re-import for fetch-based tests
const bridgeModule = '../../bridge/src/providers/bluesky';

describe('Bluesky Provider — guessNiches', () => {
  it('should detect bitcoin niche from text', () => {
    const niches = guessNiches('Bitcoin is the king, long live BTC!');
    expect(niches).toContain('bitcoin');
  });

  it('should detect solana niche from text', () => {
    const niches = guessNiches('Solana is fast and cheap. $SOL');
    expect(niches).toContain('solana');
  });

  it('should detect defi niche from liquidity mention', () => {
    const niches = guessNiches('Providing liquidity on Uniswap');
    expect(niches).toContain('defi');
  });

  it('should detect multiple niches in one text', () => {
    const niches = guessNiches('ETH L2 Arbitrum is great for DeFi yields');
    expect(niches).toContain('ethereum');
    expect(niches).toContain('layer2');
    expect(niches).toContain('defi');
  });

  it('should return "crypto" as default when no niche matches', () => {
    const niches = guessNiches('The weather today is nice for a walk');
    expect(niches).toEqual(['crypto']);
  });

  it('should detect ai niche from llm mention', () => {
    const niches = guessNiches('New LLM model from OpenAI is impressive');
    expect(niches).toContain('ai');
  });

  it('should detect security niche from exploit mention', () => {
    const niches = guessNiches('Major exploit detected in DeFi protocol');
    expect(niches).toContain('security');
  });

  it('should detect web3 niche from blockchain mention', () => {
    const niches = guessNiches('Building a new web3 dApp on Ethereum');
    expect(niches).toContain('web3');
  });

  it('should detect memecoin from doge mention', () => {
    const niches = guessNiches('DOGE to the moon! Much wow.');
    expect(niches).toContain('memecoin');
  });

  it('should detect tech from programming mention', () => {
    const niches = guessNiches('Writing Rust code for a new DeFi protocol');
    expect(niches).toContain('tech');
  });
});

describe('Bluesky Provider — postToUnified', () => {
  it('should map post to UnifiedPost shape correctly', () => {
    const post = makePost();
    const unified = postToUnified(post);

    expect(unified.id).toBe(`bluesky:${post.uri}`);
    expect(unified.protocol).toBe('bluesky');
    expect(unified.text).toBe(post.record.text);
    expect(unified.createdAt).toBe(new Date(post.record.createdAt).getTime());
    expect(unified.author.displayName).toBe('Test User');
    expect(unified.author.primary.id).toBe('did:plc:test');
    expect(unified.author.handles.bluesky).toBe('test.bsky.social');
    expect(unified.metrics.likes).toBe(42);
    expect(unified.metrics.reposts).toBe(10);
    expect(unified.metrics.replies).toBe(5);
    expect(unified.engagement.viewerLiked).toBe(false);
    expect(unified.engagement.viewerReposted).toBe(false);
    expect(unified.engagement.viewerBookmarked).toBe(false);
    expect(unified.niches).toContain('bitcoin');
  });

  it('should include link embeds when external embed exists', () => {
    const post = makePost({
      record: {
        text: 'Check this article',
        createdAt: '2026-07-24T10:00:00Z',
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: 'https://example.com/article',
            title: 'Great Article',
            description: 'A great article about crypto',
          },
        },
      },
    });
    const unified = postToUnified(post);
    expect(unified.embeds).toHaveLength(1);
    expect(unified.embeds[0]?.kind).toBe('link');
    expect(unified.embeds[0]?.url).toBe('https://example.com/article');
  });

  it('should handle missing author displayName', () => {
    const post = makePost({
      author: {
        did: 'did:plc:test',
        handle: 'anon.bsky.social',
        displayName: undefined,
        avatar: '',
      },
    });
    const unified = postToUnified(post);
    expect(unified.author.displayName).toBe('anon.bsky.social');
  });

  it('should handle zero metrics', () => {
    const post = makePost({ likeCount: undefined, repostCount: undefined, replyCount: undefined });
    const unified = postToUnified(post);
    expect(unified.metrics.likes).toBe(0);
    expect(unified.metrics.reposts).toBe(0);
    expect(unified.metrics.replies).toBe(0);
  });
});

describe('Bluesky Provider — fetchBlueskyPosts', () => {
  beforeEach(() => {
    // Ensure env is clean
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when all fetches fail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const { fetchBlueskyPosts } = await import(bridgeModule);
    const posts = await fetchBlueskyPosts(10);
    expect(posts).toEqual([]);
    expect(posts).toHaveLength(0);
  });

  it('should return empty array when fetch returns non-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const { fetchBlueskyPosts } = await import(bridgeModule);
    const posts = await fetchBlueskyPosts(10);
    expect(posts).toEqual([]);
  });

  it('should deduplicate posts with same text content', async () => {
    // Mock search response returning duplicate posts
    const mockPost = makePost({
      uri: 'at://did:plc:test/app.bsky.feed.post/dup',
      record: { text: 'Bitcoin is great!', createdAt: '2026-07-24T10:00:00Z' },
    });

    const searchResponse = {
      posts: [mockPost, mockPost],
      cursor: undefined,
    };

    // First call is PDS (rejected), subsequent calls return search
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) return Promise.reject(new Error('PDS not available'));
      return Promise.resolve(
        new Response(JSON.stringify(searchResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });

    const { fetchBlueskyPosts } = await import(bridgeModule);
    const posts = await fetchBlueskyPosts(5);
    // Dedup should collapse duplicates
    expect(posts.length).toBeLessThanOrEqual(1);
  });
});
