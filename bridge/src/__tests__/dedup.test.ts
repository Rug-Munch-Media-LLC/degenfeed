/**
 * TEST SUITE: Cross-protocol deduplication (bridge/src/lib/dedup.ts)
 *
 * Verifies:
 *  1. normalizeDedupText — first-100-char grouping key, URLs/@mentions stripped.
 *  2. urlKey — protocol-agnostic URL normalization (www, trailing slash, query).
 *  3. engagementScore / canonical selection — highest-engagement copy survives.
 *  4. deduplicateFeed — text grouping, URL grouping, crossPostOf tagging.
 */

import { describe, expect, it } from 'vitest';
import type { UnifiedPost } from '../server/types';
import {
  deduplicateFeed,
  engagementScore,
  normalizeDedupText,
  urlKey,
} from '../lib/dedup';

function post(
  id: string,
  opts: {
    protocol?: string;
    text?: string;
    embeds?: { kind: string; url: string }[];
    likes?: number;
    reposts?: number;
    createdAt?: number;
    authorId?: string;
  } = {},
): UnifiedPost {
  const now = Date.now();
  return {
    id,
    protocol: opts.protocol ?? 'nostr',
    author: {
      id: opts.authorId ?? `author:${id}`,
      primary: { protocol: opts.protocol ?? 'nostr', id: opts.authorId ?? id },
      handles: {},
      displayName: `Author ${id}`,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: opts.text ?? `shared headline about crypto ${id}`,
    embeds: opts.embeds ?? [],
    createdAt: opts.createdAt ?? now - 3_600_000,
    metrics: {
      likes: opts.likes ?? 0,
      reposts: opts.reposts ?? 0,
      replies: 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: {},
    niches: [],
  };
}

describe('normalizeDedupText', () => {
  it('lowercases, strips URLs and mentions, collapses whitespace', () => {
    expect(normalizeDedupText('  BTC Hits $100K https://t.co/abc @vitalik.eth NOW  ')).toBe(
      'btc hits 100k now',
    );
  });

  it('caps at 100 chars', () => {
    const long = 'a'.repeat(500);
    expect(normalizeDedupText(long)).toBe('a'.repeat(100));
  });
});

describe('urlKey', () => {
  it('normalizes protocol, www, trailing slash and query', () => {
    expect(urlKey('https://www.example.com/path/?utm_source=x&utm_medium=y')).toBe(
      'example.com/path',
    );
    expect(urlKey('HTTP://Example.com/Path/')).toBe('example.com/path');
    expect(urlKey('')).toBe('');
  });
});

describe('engagementScore', () => {
  it('prefers engagement over bare text', () => {
    const engaged = post('a', { likes: 50, reposts: 10 });
    const bare = post('b', { likes: 0, text: 'short' });
    expect(engagementScore(engaged)).toBeGreaterThan(engagementScore(bare));
  });

  it('scores text richness for zero-engagement posts', () => {
    const rich = post('a', { text: 'x'.repeat(200) });
    const empty = post('b', { text: '' });
    expect(engagementScore(rich)).toBeGreaterThan(engagementScore(empty));
  });
});

describe('deduplicateFeed', () => {
  it('collapses same-text cross-protocol copies, keeping highest engagement', () => {
    const low = post('nostr:1', { protocol: 'nostr', likes: 2, text: 'Same headline about token launch' });
    const high = post('farcaster:1', { protocol: 'farcaster', likes: 120, text: 'Same headline about token launch' });
    const result = deduplicateFeed([low, high]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('farcaster:1');
    expect(low.crossPostOf).toBe('farcaster:1');
  });

  it('groups by embed URL when text is short or missing', () => {
    const a = post('nostr:url', { text: 'check this', embeds: [{ kind: 'link', url: 'https://example.com/story/1' }] });
    const b = post('rss:url', { text: '', embeds: [{ kind: 'link', url: 'https://www.example.com/story/1/?ref=x' }] });
    const result = deduplicateFeed([a, b]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nostr:url');
    expect(b.crossPostOf).toBe('nostr:url');
  });

  it('keeps distinct posts untouched', () => {
    const a = post('a', { text: 'first unique story' });
    const b = post('b', { text: 'second unique story' });
    expect(deduplicateFeed([a, b])).toHaveLength(2);
    expect(a.crossPostOf).toBeUndefined();
    expect(b.crossPostOf).toBeUndefined();
  });

  it('marks only losers with crossPostOf pointing at the survivor id', () => {
    const a = post('p1', { text: 'dup headline text here' });
    const b = post('p2', { text: 'dup headline text here' });
    const c = post('p3', { text: 'dup headline text here' });
    const result = deduplicateFeed([a, b, c]);

    expect(result).toHaveLength(1);
    for (const dup of [a, b, c]) {
      if (dup.id !== result[0].id) expect(dup.crossPostOf).toBe(result[0].id);
    }
    expect(result[0].crossPostOf).toBeUndefined();
  });

  it('preserves input order of canonical posts', () => {
    const x = post('x', { text: 'alpha story' });
    const y = post('y', { text: 'beta story' });
    const xCopy = post('x-copy', { text: 'alpha story' });
    const result = deduplicateFeed([y, x, xCopy]);
    expect(result.map((p) => p.id)).toEqual(['y', 'x']);
  });
});
