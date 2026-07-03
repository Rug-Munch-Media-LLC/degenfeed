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
});
