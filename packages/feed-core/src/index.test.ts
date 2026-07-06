import { describe, expect, it } from 'vitest';

describe('@degenfeed/feed-core', () => {
  it('should export utility functions', async () => {
    const mod = await import('./index');
    expect(typeof mod.extractEmbeds).toBe('function');
    expect(typeof mod.detectNiches).toBe('function');
    expect(typeof mod.dedupeKey).toBe('function');
    expect(typeof mod.buildUnifiedPost).toBe('function');
    expect(typeof mod.emptyIdentity).toBe('function');
    expect(typeof mod.emptyMetrics).toBe('function');
    expect(typeof mod.isSpamPost).toBe('function');
    expect(typeof mod.deduplicatePosts).toBe('function');
    expect(typeof mod.scorePost).toBe('function');
    expect(typeof mod.rankPosts).toBe('function');
  });

  it('should detect crypto niche from text', async () => {
    const { detectNiches } = await import('./index');
    const niches = detectNiches('Bitcoin and ethereum are great');
    expect(niches).toContain('crypto');
  });

  it('should detect AI niche from text', async () => {
    const { detectNiches } = await import('./index');
    const niches = detectNiches('My new GPT agent using AI');
    expect(niches).toContain('ai');
  });

  it('should detect bitcoin niche', async () => {
    const { detectNiches } = await import('./index');
    const niches = detectNiches('Bitcoin halving and satoshi');
    expect(niches).toContain('bitcoin');
  });

  it('should build dedupe key', async () => {
    const { dedupeKey } = await import('./index');
    expect(dedupeKey('nostr', 'abc123')).toBe('nostr:abc123');
  });

  it('should build unified post', async () => {
    const { buildUnifiedPost, emptyIdentity } = await import('./index');
    const post = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'test1',
      author: emptyIdentity(),
      text: 'Hello world',
      createdAt: Date.now(),
      raw: {},
    });
    expect(post.id).toBe('nostr:test1');
    expect(post.text).toBe('Hello world');
  });

  it('should extract embeds from text', async () => {
    const { extractEmbeds } = await import('./index');
    const embeds = extractEmbeds('Check https://example.com');
    expect(embeds.length).toBeGreaterThanOrEqual(1);
    expect(embeds[0]?.kind).toBe('link');
  });

  it('should return empty identity', async () => {
    const { emptyIdentity } = await import('./index');
    const id = emptyIdentity();
    expect(id.id).toBe('');
    expect(id.primary.protocol).toBe('nostr');
  });

  it('should flag spam posts', async () => {
    const { buildUnifiedPost, emptyIdentity, isSpamPost } = await import('./index');
    const spam = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'spam',
      author: emptyIdentity(),
      text: 'test',
      createdAt: Date.now(),
      raw: {},
    });
    expect(isSpamPost(spam)).toBe(true);
  });

  it('should deduplicate posts', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'a',
      author: emptyIdentity(),
      text: 'Hello world',
      createdAt: Date.now(),
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'b',
      author: emptyIdentity(),
      text: 'Hello world',
      createdAt: Date.now(),
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('should score posts by engagement', async () => {
    const { buildUnifiedPost, emptyIdentity, scorePost } = await import('./index');
    const post = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'a',
      author: emptyIdentity(),
      text: 'Crypto alpha',
      createdAt: Date.now(),
      raw: {},
      metrics: { likes: 10, reposts: 5, replies: 2, quotes: 0 },
    });
    expect(scorePost(post)).toBeGreaterThan(0);
  });

  it('should rank posts', async () => {
    const { buildUnifiedPost, emptyIdentity, rankPosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'a',
      author: emptyIdentity(),
      text: 'Old post',
      createdAt: now - 86400000,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'b',
      author: emptyIdentity(),
      text: 'New post',
      createdAt: now,
      raw: {},
      metrics: { likes: 10, reposts: 0, replies: 0, quotes: 0 },
    });
    const ranked = rankPosts([a, b], now);
    expect(ranked[0]?.id).toBe('farcaster:b');
  });
});
