import { describe, expect, it } from 'vitest';

describe('@degenfeed/rss-sdk', () => {
  // ─── Exports ──────────────────────────────────────────────────────

  it('should export all source adapters', async () => {
    const mod = await import('./index');
    expect(mod.RedditSource).toBeDefined();
    expect(mod.RedditSource.fetch).toBeInstanceOf(Function);
    expect(mod.RedditSource.fetchUser).toBeInstanceOf(Function);

    expect(mod.MirrorSource).toBeDefined();
    expect(mod.MirrorSource.fetch).toBeInstanceOf(Function);

    expect(mod.SubstackSource).toBeDefined();
    expect(mod.SubstackSource.fetch).toBeInstanceOf(Function);

    expect(mod.MediumSource).toBeDefined();
    expect(mod.MediumSource.fetch).toBeInstanceOf(Function);

    expect(mod.ParagraphSource).toBeDefined();
    expect(mod.ParagraphSource.fetch).toBeInstanceOf(Function);

    expect(mod.GenericRssSource).toBeDefined();
    expect(mod.GenericRssSource.fetch).toBeInstanceOf(Function);

    expect(mod.fetchFeed).toBeInstanceOf(Function);
    expect(mod.feedToUnifiedPosts).toBeInstanceOf(Function);
    expect(mod.fetchAndNormalize).toBeInstanceOf(Function);
  });

  // ─── Normalizer ───────────────────────────────────────────────────

  it('should normalize rss-parser output to UnifiedPost', async () => {
    const { feedToUnifiedPosts } = await import('./index');
    const mockSource = {
      source: 'reddit' as const,
      handle: 'CryptoCurrency',
      url: 'https://old.reddit.com/r/CryptoCurrency/hot.rss',
      feed: {
        title: 'CryptoCurrency',
        description: 'The front page of crypto',
        link: 'https://old.reddit.com/r/CryptoCurrency/',
        items: [
          {
            guid: 't3_abc123',
            title: 'Bitcoin hits new ATH!',
            link: 'https://old.reddit.com/r/CryptoCurrency/comments/abc123/',
            contentSnippet: 'Bitcoin just reached a new all-time high of $150k.',
            creator: 'satoshi',
            pubDate: 'Sat, 04 Jul 2026 10:00:00 GMT',
            categories: ['Bitcoin', 'Markets'],
            isoDate: '2026-07-04T10:00:00.000Z',
          },
        ],
      },
    };

    const posts = feedToUnifiedPosts(mockSource);
    expect(posts).toHaveLength(1);

    const post = posts[0]!;
    expect(post.protocol).toBe('rss');
    expect(post.text).toContain('Bitcoin');
    expect(post.id).toContain('rss:reddit:');
    expect(post.author.displayName).toBe('satoshi');
    expect(post.niches).toContain('crypto');
    expect(post.embeds.length).toBeGreaterThanOrEqual(1); // link embed
    expect(post.createdAt).toBe(new Date('2026-07-04T10:00:00.000Z').getTime());
  });

  it('should handle feeds with no items', async () => {
    const { feedToUnifiedPosts } = await import('./index');
    const posts = feedToUnifiedPosts({
      source: 'generic',
      url: 'https://example.com/feed',
      feed: { title: 'Empty Feed', items: [] },
    });
    expect(posts).toEqual([]);
  });

  it('should extract image embeds from HTML content', async () => {
    const { feedToUnifiedPosts } = await import('./index');
    const mockSource = {
      source: 'mirror' as const,
      handle: 'vitalik',
      url: 'https://vitalik.mirror.xyz/feed',
      feed: {
        title: 'Vitalik',
        items: [
          {
            title: 'Post with image',
            link: 'https://vitalik.mirror.xyz/post-1',
            content: '<p>Check this image:</p><img src="https://mirror.xyz/image.png" />',
            contentSnippet: 'Check this image:',
            creator: 'Vitalik Buterin',
            pubDate: 'Sat, 04 Jul 2026 12:00:00 GMT',
          },
        ],
      },
    };

    const posts = feedToUnifiedPosts(mockSource);
    expect(posts).toHaveLength(1);

    // Should have image embed + link embed
    const imageEmbeds = posts[0]!.embeds.filter((e) => e.kind === 'image');
    expect(imageEmbeds.length).toBeGreaterThanOrEqual(1);
    expect(imageEmbeds[0]?.url).toBe('https://mirror.xyz/image.png');
  });

  it('should handle feeds with content:encoded', async () => {
    const { feedToUnifiedPosts } = await import('./index');
    const mockSource = {
      source: 'substack' as const,
      handle: 'cryptonative',
      url: 'https://cryptonative.substack.com/feed',
      feed: {
        title: 'Crypto Native',
        items: [
          {
            title: 'Deep Dive',
            guid: 'post-42',
            creator: 'Crypto Native Author',
            content: '<p>Full article content here with <b>rich text</b>.</p>',
            contentSnippet: 'Full article content here with rich text.',
            pubDate: 'Sun, 05 Jul 2026 08:00:00 GMT',
            categories: ['crypto', 'analysis'],
          },
        ],
      },
    };

    const posts = feedToUnifiedPosts(mockSource);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.author.displayName).toBe('Crypto Native Author');
    expect(posts[0]!.niches).toContain('crypto');
  });

  it('should handle dates in various formats', async () => {
    const { feedToUnifiedPosts } = await import('./index');
    const ts = Date.now();
    const mockSource = {
      source: 'generic' as const,
      url: 'https://example.com/feed',
      feed: {
        title: 'Dates Test',
        items: [
          { title: 'No Date', link: 'https://x.com/1' },
          { title: 'ISO Date', link: 'https://x.com/2', isoDate: '2026-07-04T12:00:00.000Z' },
          { title: 'Invalid Date', link: 'https://x.com/3', pubDate: 'not a date' },
        ],
      },
    };

    const posts = feedToUnifiedPosts(mockSource);
    expect(posts).toHaveLength(3);
    // No date → falls back to now (reasonable default)
    expect(posts[0]!.createdAt).toBeGreaterThan(ts - 1000);
    // ISO date
    expect(posts[1]!.createdAt).toBe(new Date('2026-07-04T12:00:00.000Z').getTime());
    // Invalid date → falls back to now
    expect(posts[2]!.createdAt).toBeGreaterThan(ts - 1000);
  });
});
