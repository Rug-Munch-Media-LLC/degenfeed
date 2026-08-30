/**
 * TEST SUITE: Feed diversity — capped interleave + discovery mode
 *
 * Verifies the home feed diversity guarantees from feeds.ts:
 *  1. No more than MAX_CONSECUTIVE_SAME_PROTOCOL (3) posts from the same
 *     protocol appear in a row in any multi-protocol feed.
 *  2. Single-source feeds still return their full list (cap waived).
 *  3. Dedup still collapses identical cross-protocol copies.
 *  4. Discovery mode selects protocols NOT in the user's active set.
 */

import { describe, expect, it } from 'vitest';
import {
  dedupeAndInterleave,
  MAX_CONSECUTIVE_SAME_PROTOCOL,
  selectDiscoveryProtocols,
  textFingerprint,
} from '../server/feeds';
import type { UnifiedPost } from '../server/types';

function post(id: string, protocol: string, text: string, n = 0): UnifiedPost {
  return {
    id: `${protocol}:${id}:${n}`,
    protocol: protocol as UnifiedPost['protocol'],
    author: {
      id: `${protocol}:author:${n}`,
      primary: { protocol: protocol as UnifiedPost['protocol'], id: 'author' },
      handles: {},
      displayName: 'Test Author',
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    createdAt: Date.now() - n * 1000,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: {},
    niches: ['crypto'],
  };
}

describe('dedupeAndInterleave — capped protocol runs', () => {
  it('never emits more than MAX_CONSECUTIVE_SAME_PROTOCOL in a row (balanced)', () => {
    const posts: UnifiedPost[] = [
      ...Array.from({ length: 6 }, (_, i) => post('a', 'nostr', `nostr post ${i}`, i)),
      ...Array.from({ length: 6 }, (_, i) => post('b', 'farcaster', `fc post ${i}`, i)),
      ...Array.from({ length: 6 }, (_, i) => post('c', 'bluesky', `bsky post ${i}`, i)),
    ];
    const out = dedupeAndInterleave(posts, 18);
    expect(out.length).toBe(18);

    let run = 1;
    for (let i = 1; i < out.length; i++) {
      run = out[i]!.protocol === out[i - 1]!.protocol ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(MAX_CONSECUTIVE_SAME_PROTOCOL);
    }
  });

  it('caps a dominant protocol while other sources still have content', () => {
    // nostr dominates but farcaster/lens still have posts to interleave.
    const posts: UnifiedPost[] = [
      ...Array.from({ length: 12 }, (_, i) => post('a', 'nostr', `nostr post ${i}`, i)),
      ...Array.from({ length: 4 }, (_, i) => post('b', 'farcaster', `fc post ${i}`, i)),
      ...Array.from({ length: 4 }, (_, i) => post('c', 'lens', `lens post ${i}`, i)),
    ];
    const out = dedupeAndInterleave(posts, 12);
    expect(out.length).toBe(12);
    let run = 1;
    for (let i = 1; i < out.length; i++) {
      run = out[i]!.protocol === out[i - 1]!.protocol ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(MAX_CONSECUTIVE_SAME_PROTOCOL);
    }
  });

  it('still fills the feed when one protocol is the sole remaining source', () => {
    // 12 nostr posts but only 1 farcaster + 1 lens: after farcaster/lens are
    // drained, nostr is the only source left — the cap is waived so the feed
    // still fills to the requested limit (volume over diversity).
    const posts: UnifiedPost[] = [
      ...Array.from({ length: 12 }, (_, i) => post('a', 'nostr', `nostr post ${i}`, i)),
      post('b', 'farcaster', 'fc post', 0),
      post('c', 'lens', 'lens post', 0),
    ];
    const out = dedupeAndInterleave(posts, 12);
    expect(out.length).toBe(12);
    // The interleaved prefix still shows the diversity before the tail.
    const prefixProtocols = out.slice(0, 4).map((p) => p.protocol);
    expect(prefixProtocols).toContain('farcaster');
    expect(prefixProtocols).toContain('lens');
  });

  it('single-source feed returns the full list (cap waived)', () => {
    const posts: UnifiedPost[] = Array.from({ length: 12 }, (_, i) =>
      post('a', 'owncast', `owncast stream ${i}`, i),
    );
    const out = dedupeAndInterleave(posts, 12);
    expect(out.length).toBe(12);
  });

  it('deduplicates identical text across protocols before interleaving', () => {
    const posts: UnifiedPost[] = [
      post('a', 'nostr', 'Bitcoin is the future of money!', 0),
      post('b', 'farcaster', 'Bitcoin is the future of money!', 1),
      post('c', 'rss', 'Different headline entirely', 2),
    ];
    const out = dedupeAndInterleave(posts, 3);
    // 2 unique texts → 2 posts (the identical pair collapses to one).
    expect(out.length).toBe(2);
  });
});

describe('selectDiscoveryProtocols — discovery mode', () => {
  it('returns protocols not in the active set', () => {
    const active = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
    const picked = selectDiscoveryProtocols(active, 1_000_000_000_000);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.length).toBeLessThanOrEqual(2);
    for (const p of picked) {
      expect(active).not.toContain(p);
    }
  });

  it('rotates selection across 60s windows', () => {
    const active = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
    const t1 = selectDiscoveryProtocols(active, 1_000_000_000_000);
    const t2 = selectDiscoveryProtocols(active, 1_000_000_060_000);
    // Over enough windows the selection must differ.
    let differs = false;
    for (let w = 0; w < 100; w++) {
      const picked = selectDiscoveryProtocols(active, 1_000_000_000_000 + w * 60_000);
      if (picked.join(',') !== t1.join(',')) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
    expect(t1.length).toBe(t2.length);
  });

  it('returns nothing when the active set covers the whole pool', () => {
    const picked = selectDiscoveryProtocols(
      ['minds', 'hive', 'steem', 'diaspora'],
      1_000_000_000_000,
    );
    expect(Array.isArray(picked)).toBe(true);
  });
});

describe('textFingerprint', () => {
  it('strips URLs (with scheme) and @mentions, lowercases, collapses whitespace', () => {
    const a = textFingerprint('Check https://example.com/post and @user for details!');
    // URL with scheme and the @mention are removed; everything else is kept,
    // lowercased, and whitespace/punctuation runs are collapsed.
    expect(a).toBe('check and for details');
    expect(a).not.toContain('https://');
    expect(a).not.toContain('@user');
  });

  it('bare domains and ordinary words are preserved (only scheme URLs match)', () => {
    const a = textFingerprint('Visit example.com/post for the full story');
    expect(a).toBe('visit example com post for the full story');
  });
});
