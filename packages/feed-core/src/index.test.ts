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
    expect(typeof mod.isRelevantPost).toBe('function');
    expect(typeof mod.deduplicatePosts).toBe('function');
    expect(typeof mod.contentFingerprint).toBe('function');
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

  it('Layer 1: should deduplicate by canonical ID', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'dup',
      author: emptyIdentity(),
      text: 'Hello world',
      createdAt: Date.now(),
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'dup',
      author: emptyIdentity(),
      text: 'Different text',
      createdAt: Date.now(),
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 2: should deduplicate by content fingerprint (12-word shingle)', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n1',
      author: emptyIdentity(),
      text: 'Bitcoin is the future of decentralized finance and will change everything about money forever',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'f2',
      author: emptyIdentity(),
      text: 'Bitcoin is the future of decentralized finance and will change everything about money forever',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 3: should deduplicate by normalized full-text hash', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-full-1',
      author: emptyIdentity(),
      text: 'Check out https://example.com/article — great read on DeFi!',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'lens',
      nativeId: 'l-full-1',
      author: emptyIdentity(),
      text: 'Check out https://another.link/post — great read on DeFi!',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 4: should deduplicate by primary URL', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-url-1',
      author: emptyIdentity(),
      text: 'Must read: https://example.com/breaking-news',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'bluesky',
      nativeId: 'b-url-1',
      author: emptyIdentity(),
      text: 'Breaking news! https://example.com/breaking-news',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 5: should deduplicate by text prefix (first 120 chars)', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const opening =
      'The SEC just announced a major shift in regulatory policy toward digital assets. '.repeat(4);
    const a = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'fc-prefix-1',
      author: emptyIdentity(),
      text: `${opening}This is huge for the industry.`,
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-prefix-1',
      author: emptyIdentity(),
      text: `${opening}Thoughts?`,
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 6: should deduplicate short posts by exact text', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-short',
      author: emptyIdentity(),
      text: 'GM frens ☀️',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'fc-short',
      author: emptyIdentity(),
      text: 'GM frens ☀️',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 7: should deduplicate same-author cross-post (author + fingerprint window)', async () => {
    const { buildUnifiedPost, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const author = {
      id: 'nostr:abc123',
      primary: { protocol: 'nostr' as const, id: 'abc123' },
      handles: {} as Record<string, string | null>,
      displayName: 'CryptoMuncher',
      bio: '',
      avatarUrl: '',
      verified: [] as { protocol: import('@degenfeed/types').Protocol; badge: string }[],
      followerCount: 0,
      followingCount: 0,
      links: [] as { label: string; url: string }[],
      keys: {},
    };
    const text = 'Just deployed a new smart contract for cross-chain swaps on Solana and Ethereum';
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-auth-1',
      author,
      text,
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'fc-auth-1',
      author: { ...author, id: 'farcaster:456' },
      text,
      createdAt: now + 30_000,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 8: should keep quoted/repost content marked as quote', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-qt-1',
      author: emptyIdentity(),
      text: 'The onchain data speaks for itself. Solana L1 is winning.',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'fc-qt-1',
      author: emptyIdentity(),
      text: 'RT @user The onchain data speaks for itself. Solana L1 is winning.',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(2);
  });

  it('Layer 9: should deduplicate by ticker + first-sentence snapshot', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-ticker-1',
      author: emptyIdentity(),
      text: '$BTC $ETH are looking extremely bullish today after the FOMC minutes dropped. More details at https://coindesk.com/btc-eth-bullish',
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: 'fc-ticker-1',
      author: emptyIdentity(),
      text: '$BTC $ETH are looking extremely bullish today after the FOMC minutes dropped. IMO we go higher from here.',
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });

  it('Layer 10: should deduplicate embed-only posts with same media', async () => {
    const { buildUnifiedPost, emptyIdentity, deduplicatePosts } = await import('./index');
    const now = Date.now();
    const a = buildUnifiedPost({
      protocol: 'nostr',
      nativeId: 'n-emb-1',
      author: emptyIdentity(),
      text: '',
      embeds: [{ kind: 'image', url: 'https://cdn.example/pic.jpg' }],
      createdAt: now,
      raw: {},
    });
    const b = buildUnifiedPost({
      protocol: 'lens',
      nativeId: 'l-emb-1',
      author: emptyIdentity(),
      text: 'gm',
      embeds: [{ kind: 'image', url: 'https://cdn.example/pic.jpg' }],
      createdAt: now,
      raw: {},
    });
    expect(deduplicatePosts([a, b])).toHaveLength(1);
  });
});
