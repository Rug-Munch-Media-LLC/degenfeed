// ─── Split-vs-monolith dedup parity ─────────────────────────────────────
// Every case runs the split implementation and the restored monolith loop
// over identical cloned fixtures, then asserts BOTH the expected outcome and
// that the two implementations agree (ids + cross-post bookkeeping).
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { legacyDeduplicatePosts } from './__fixtures__/legacy-dedup';
import { deduplicatePosts } from './dedup';
import { buildUnifiedPost, emptyIdentity } from './index';

type BuildArgs = Parameters<typeof buildUnifiedPost>[0];

function author(name: string) {
  const identity = emptyIdentity();
  identity.id = `did:${name}`;
  identity.displayName = name;
  identity.bio = 'crypto writer';
  return identity;
}

function mk(
  protocol: Protocol,
  nativeId: string,
  text: string,
  over: Partial<BuildArgs> = {},
): UnifiedPost {
  return buildUnifiedPost({
    protocol,
    nativeId,
    author: author('alice'),
    text,
    createdAt: 1_700_000_000,
    raw: {},
    ...over,
  } as BuildArgs);
}

function crossOf(post: UnifiedPost): string[] {
  return ((post as unknown as Record<string, unknown>).crossPostedTo as string[]) ?? [];
}

function runBoth(posts: UnifiedPost[]) {
  return {
    split: deduplicatePosts(posts.map((p) => structuredClone(p))),
    legacy: legacyDeduplicatePosts(posts.map((p) => structuredClone(p))),
  };
}

function assertParity(posts: UnifiedPost[], expected: string[]): UnifiedPost[] {
  const { split, legacy } = runBoth(posts);
  expect(split.map((p) => p.id)).toEqual(expected);
  expect(split.map((p) => p.id)).toEqual(legacy.map((p) => p.id));
  expect(split.map(crossOf)).toEqual(legacy.map(crossOf));
  return split;
}

describe('dedup parity: split vs monolith', () => {
  it('empty input yields empty output', () => {
    assertParity([], []);
  });

  it('duplicate guard semantics: id, content, short exact', () => {
    const sameId = 'the same post arriving twice through one provider';
    assertParity([mk('nostr', 'a', sameId), mk('nostr', 'a', sameId)], ['nostr:a']);

    const content = 'bitcoin etf inflows hit a new record this week says analysts';
    assertParity(
      [mk('nostr', 'b1', content), mk('mastodon', 'b2', content, { author: author('bob') })],
      ['nostr:b1'],
    );

    assertParity([mk('nostr', 'c1', 'gm frens'), mk('mastodon', 'c2', 'gm frens')], ['nostr:c1']);
  });

  it('qid identity collapses reposts and exempts similarity', () => {
    const sameQuote = [
      mk('nostr', 'q1', 'RT @alice: big news https://x.com/9'),
      mk('mastodon', 'q2', 'RT @bob: big news https://x.com/9', { author: author('bob') }),
    ];
    assertParity(sameQuote, ['nostr:q1']);

    const distinctQuotes = [
      mk(
        'nostr',
        'r1',
        'RT @alice: bitcoin ethereum solana defi NFT market update https://x.com/1',
      ),
      mk(
        'mastodon',
        'r2',
        'RT @bob: bitcoin ethereum solana defi NFT market update https://x.com/2',
        {
          author: author('bob'),
        },
      ),
    ];
    assertParity(distinctQuotes, ['nostr:r1', 'mastodon:r2']);
  });

  it('skip rules: rss origin (longest wins), aggregator, already-seen id', () => {
    const title = 'Bitcoin ETF inflows hit record high';
    const rssShort = mk('rss', 's1', 'short summary', {
      embeds: [{ kind: 'link', url: 'https://news.example.com/a', meta: { title } }],
    });
    const rssLong = mk('rss', 's2', 'a much longer summary of the same article body', {
      embeds: [{ kind: 'link', url: 'https://news.example.com/b', meta: { title } }],
    });
    assertParity([rssShort, rssLong], ['rss:s2']);

    const aggregator = [
      mk('nostr', 'ag1', 'deep dive into scaling https://reddit.com/r/crypto/comments/x'),
      mk('mastodon', 'ag2', 'another take https://reddit.com/r/crypto/comments/x', {
        author: author('bob'),
      }),
    ];
    assertParity(aggregator, ['nostr:ag1']);

    assertParity(
      [
        mk('nostr', 'd1', 'first body about layer two rollups and bridges'),
        mk('nostr', 'd1', 'second body entirely different content here'),
      ],
      ['nostr:d1'],
    );
  });

  it('jaccard threshold: just below keeps, just above drops', () => {
    const below = [
      mk('nostr', 'j1', 'alpha bravo charlie delta echo foxtrot'),
      mk('mastodon', 'j2', 'alpha bravo charlie delta zulu yankee', { author: author('bob') }),
    ];
    assertParity(below, ['nostr:j1', 'mastodon:j2']);

    const above = [
      mk('nostr', 'k1', 'alpha bravo charlie delta echo foxtrot'),
      mk('mastodon', 'k2', 'alpha bravo charlie delta echo golf', { author: author('bob') }),
    ];
    const kept = assertParity(above, ['nostr:k1']);
    expect(crossOf(kept[0] as UnifiedPost)).toEqual(['mastodon']);
  });

  it('levenshtein threshold on cleaned text: 0.80 keeps, 0.85 drops', () => {
    const base = 'abcdefghijklmnopqrst';
    const edits3 = 'abcxefghijkxmnopqrsx';
    const edits4 = 'wxyzefghijklmnopqrst';
    const drop = [mk('nostr', 'm1', base), mk('mastodon', 'm2', edits3, { author: author('bob') })];
    const kept = assertParity(drop, ['nostr:m1']);
    expect(crossOf(kept[0] as UnifiedPost)).toEqual(['mastodon']);

    const keep = [mk('nostr', 'l1', base), mk('mastodon', 'l2', edits4, { author: author('bob') })];
    assertParity(keep, ['nostr:l1', 'mastodon:l2']);
  });

  it('levenshtein denominator is cleaned length, not raw length', () => {
    // Raw similarity of these is 0.85 but cleaned similarity is 0.842, so both
    // implementations keep the second post. Documented so a future change to
    // the denominator shows up as a parity failure.
    const posts = [
      mk('nostr', 'n1', 'the quick brown fox '),
      mk('mastodon', 'n2', 'the quack brawn fux ', { author: author('bob') }),
    ];
    assertParity(posts, ['nostr:n1', 'mastodon:n2']);
  });

  it('cross-post URL identity: same article via two protocols collapses to one', () => {
    const posts = [
      mk('nostr', 'u1', 'shared article https://example.com/deep-dive'),
      mk('bluesky', 'u2', 'sharing this https://example.com/deep-dive', { author: author('bob') }),
    ];
    assertParity(posts, ['nostr:u1']);
  });
});
