import type { UnifiedPost } from '@degenfeed/types';
import { describe, expect, it } from 'vitest';
import { type AlgoProfile, EMPTY_ALGO_PROFILE } from './algoProfile';
import { DEFAULT_FEED_CONTROLS, type FeedControls } from './feedRanking';
import {
  coldStartBoost,
  detectGenre,
  freshnessScore,
  GENRE_HALF_LIFE_HOURS,
  rankTopAlgo,
  serendipityFraction,
} from './topAlgo';

function makePost(overrides: Partial<UnifiedPost> & { id: string }): UnifiedPost {
  return {
    protocol: 'nostr',
    author: {
      id: 'a1',
      primary: { protocol: 'nostr', id: 'a1' },
      handles: {},
      displayName: 'A',
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: 'test post',
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: null,
    niches: [],
    ...overrides,
  } as unknown as UnifiedPost;
}

const NOW = Date.now();

function controlsWith(
  patch: Partial<FeedControls['algorithm']>,
  sort: FeedControls['sort'] = 'trending',
): FeedControls {
  return {
    ...DEFAULT_FEED_CONTROLS,
    sort,
    algorithm: { ...DEFAULT_FEED_CONTROLS.algorithm, ...patch },
  };
}

function author(id: string, followers = 0): UnifiedPost['author'] {
  return {
    id,
    primary: { protocol: 'nostr', id },
    handles: {},
    displayName: id,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: followers,
    followingCount: 0,
    links: [],
    keys: {},
  };
}

describe('topAlgo — genre-aware freshness decay', () => {
  it('detects news vs analysis genres', () => {
    const news = makePost({ id: 'n', text: 'BREAKING: protocol launches mainnet today' });
    const analysis = makePost({ id: 'a', text: 'A deep dive analysis of layer 2 architecture' });
    expect(detectGenre(news)).toBe('news');
    expect(detectGenre(analysis)).toBe('analysis');
  });

  it('news decays faster than analysis for the same age', () => {
    const fourHoursAgo = NOW - 4 * 3_600_000;
    const news = makePost({
      id: 'n',
      text: 'BREAKING: price crash today',
      createdAt: fourHoursAgo,
    });
    const analysis = makePost({
      id: 'a',
      text: 'An in-depth analysis explaining the protocol',
      createdAt: fourHoursAgo,
    });
    const newsF = freshnessScore(news, NOW);
    const analysisF = freshnessScore(analysis, NOW);
    expect(GENRE_HALF_LIFE_HOURS.news).toBeLessThan(GENRE_HALF_LIFE_HOURS.analysis);
    expect(newsF.score).toBeLessThan(analysisF.score);
  });
});

describe('topAlgo — cold start discovery', () => {
  it('boosts new creators (low followers) in their first 24h', () => {
    const newPost = makePost({
      id: 'new',
      author: author('newbie', 5),
      createdAt: NOW - 2 * 3_600_000,
    });
    const oldPost = makePost({
      id: 'old',
      author: author('newbie-old', 5),
      createdAt: NOW - 48 * 3_600_000,
    });
    const established = makePost({
      id: 'est',
      author: author('big', 100_000),
      createdAt: NOW - 2 * 3_600_000,
    });
    expect(coldStartBoost(newPost, NOW).boost).toBeGreaterThan(0);
    expect(coldStartBoost(oldPost, NOW).boost).toBe(0);
    expect(coldStartBoost(established, NOW).boost).toBe(0);
  });

  it('tags discovery posts in the ranked feed', () => {
    const posts = [
      makePost({
        id: 'cold',
        author: author('newbie', 3),
        text: 'gm frens new here',
        createdAt: NOW - 1_000,
      }),
      makePost({
        id: 'big1',
        author: author('big', 100_000),
        text: 'market analysis thread',
        createdAt: NOW - 2_000,
      }),
      makePost({
        id: 'big2',
        author: author('big', 100_000),
        text: 'another hot take',
        createdAt: NOW - 3_000,
      }),
    ];
    const out = rankTopAlgo(posts, controlsWith({ creatorSize: 0 }), { now: NOW });
    const cold = out.find((p) => p.id === 'cold');
    expect(cold?.score?.reasons).toContain('discovery');
  });
});

describe('topAlgo — content diversity (never >2 same creator in a row)', () => {
  it('interleaves authors with a max run of 2', () => {
    const posts = [
      makePost({ id: 'a1', author: author('A'), text: 'a1' }),
      makePost({ id: 'a2', author: author('A'), text: 'a2' }),
      makePost({ id: 'a3', author: author('A'), text: 'a3' }),
      makePost({ id: 'b1', author: author('B'), text: 'b1' }),
      makePost({ id: 'b2', author: author('B'), text: 'b2' }),
      makePost({ id: 'b3', author: author('B'), text: 'b3' }),
      makePost({ id: 'c1', author: author('C'), text: 'c1' }),
      makePost({ id: 'c2', author: author('C'), text: 'c2' }),
      makePost({ id: 'c3', author: author('C'), text: 'c3' }),
    ];
    const out = rankTopAlgo(posts, controlsWith({}), { now: NOW });
    expect(out).toHaveLength(9);
    let run = 1;
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1];
      const cur = out[i];
      if (!prev || !cur) continue;
      run = prev.author.id === cur.author.id ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });
});

describe('topAlgo — serendipity injection', () => {
  const profile: AlgoProfile = {
    protocols: { nostr: 0.6 },
    topics: { defi: 0.6 },
    creators: ['a1'],
    updatedAt: NOW,
  };

  function build20(): UnifiedPost[] {
    const posts: UnifiedPost[] = [];
    // 16 familiar posts (defi/nostr) with solid engagement.
    for (let i = 0; i < 16; i++) {
      posts.push(
        makePost({
          id: `fam${i}`,
          author: author(`fam${i % 4}`, 5_000),
          protocol: 'nostr',
          text: `defi yield strategy ${i}`,
          niches: ['defi'],
          metrics: { likes: 50, reposts: 5, replies: 3, quotes: 0 },
          createdAt: NOW - i * 60_000,
        }),
      );
    }
    // 4 serendipitous posts (nft/mastodon, unknown creators) with low engagement.
    for (let i = 0; i < 4; i++) {
      posts.push(
        makePost({
          id: `sere${i}`,
          author: author(`unknown${i}`, 10),
          protocol: 'mastodon',
          text: `nft art drop ${i} — limited edition generative collection by a new artist`,
          niches: ['nft'],
          metrics: { likes: 1, reposts: 0, replies: 0, quotes: 0 },
          createdAt: NOW - i * 60_000,
        }),
      );
    }
    return posts;
  }

  it('reserves a ~10% slice for unfamiliar content at the default slider', () => {
    expect(
      serendipityFraction({ ...DEFAULT_FEED_CONTROLS.algorithm, familiarDiscover: 50 }),
    ).toBeCloseTo(0.1, 1);
  });

  it('injects serendipitous posts into the ranked feed', () => {
    const out = rankTopAlgo(build20(), controlsWith({ familiarDiscover: 100 }), {
      profile,
      now: NOW,
    });
    const serendipityTagged = out.filter((p) => p.score?.reasons.includes('serendipity'));
    // The Discover slider raises the quota — some unfamiliar content must appear.
    expect(serendipityTagged.length).toBeGreaterThanOrEqual(1);
    // Quota placement pushes discovery content toward the top, not the bottom.
    expect(out.slice(0, 6).some((p) => p.id.startsWith('sere'))).toBe(true);
  });

  it('does not tag serendipity for a user with no engagement signal', () => {
    const out = rankTopAlgo(build20(), controlsWith({ familiarDiscover: 100 }), {
      profile: EMPTY_ALGO_PROFILE,
      now: NOW,
    });
    const tagged = out.filter((p) => p.score?.reasons.includes('serendipity'));
    expect(tagged.length).toBe(0);
  });
});

describe('topAlgo — personalization', () => {
  it('boosts posts matching the user engagement profile', () => {
    const profile: AlgoProfile = {
      protocols: { nostr: 0.8 },
      topics: { defi: 0.8 },
      creators: [],
      updatedAt: NOW,
    };
    const liked = makePost({
      id: 'liked',
      author: author('b1', 1_000),
      protocol: 'nostr',
      text: 'defi talk',
      niches: ['defi'],
      createdAt: NOW - 60_000,
    });
    const unrelated = makePost({
      id: 'other',
      author: author('b2', 1_000),
      protocol: 'mastodon',
      text: 'nft art',
      niches: ['nft'],
      createdAt: NOW - 60_000,
    });
    const out = rankTopAlgo([liked, unrelated], controlsWith({ familiarDiscover: 0 }), {
      profile,
      now: NOW,
    });
    expect(out[0]?.id).toBe('liked');
    expect(out[0]?.score?.reasons).toContain('on-topic');
  });

  it('tags followed creators with a human "followed" signal', () => {
    const profile: AlgoProfile = {
      protocols: {},
      topics: {},
      creators: ['c1'],
      updatedAt: NOW,
    };
    const fromFollowed = makePost({
      id: 'f',
      author: author('c1', 1_000),
      text: 'hello from a creator I engage with',
      createdAt: NOW - 60_000,
    });
    const fromOther = makePost({
      id: 'o',
      author: author('c2', 1_000),
      text: 'hello from someone else',
      createdAt: NOW - 60_000,
    });
    const out = rankTopAlgo([fromOther, fromFollowed], controlsWith({ familiarDiscover: 0 }), {
      profile,
      now: NOW,
    });
    expect(out[0]?.id).toBe('f');
    expect(out[0]?.score?.reasons).toContain('followed');
  });
});

describe('topAlgo — Recency ↔ Quality slider', () => {
  const freshLowQuality = makePost({
    id: 'fresh',
    author: author('x1', 1_000),
    text: 'short',
    createdAt: NOW - 60_000,
    qualityScore: { score: 20, max: 100, ratio: 0.2, reasons: [] },
  });
  const oldHighQuality = makePost({
    id: 'quality',
    author: author('x2', 1_000),
    text: 'a very long and detailed original analysis with plenty of substance here',
    createdAt: NOW - 3 * 3_600_000,
    qualityScore: { score: 90, max: 100, ratio: 0.9, reasons: [] },
  });

  it('recencyQuality=0 prefers fresh posts', () => {
    const out = rankTopAlgo(
      [oldHighQuality, freshLowQuality],
      controlsWith({ recencyQuality: 0 }),
      {
        now: NOW,
      },
    );
    expect(out[0]?.id).toBe('fresh');
  });

  it('recencyQuality=100 prefers high-quality posts', () => {
    const out = rankTopAlgo(
      [freshLowQuality, oldHighQuality],
      controlsWith({ recencyQuality: 100 }),
      { now: NOW },
    );
    expect(out[0]?.id).toBe('quality');
  });
});

describe('topAlgo — Creator size slider', () => {
  function creators() {
    const indie = makePost({
      id: 'indie',
      author: author('small', 20),
      text: 'indie creator post',
      createdAt: NOW - 60_000,
    });
    const big = makePost({
      id: 'big',
      author: author('huge', 500_000),
      text: 'big account post',
      createdAt: NOW - 60_000,
    });
    return { indie, big };
  }

  it('creatorSize=0 (Indie) ranks small creators first', () => {
    const { indie, big } = creators();
    const out = rankTopAlgo([big, indie], controlsWith({ creatorSize: 0 }), { now: NOW });
    expect(out[0]?.id).toBe('indie');
  });

  it('creatorSize=100 (Big) ranks established accounts first', () => {
    const { indie, big } = creators();
    const out = rankTopAlgo([indie, big], controlsWith({ creatorSize: 100 }), { now: NOW });
    expect(out[0]?.id).toBe('big');
  });
});

describe('topAlgo — transparency payload', () => {
  it('attaches score + feedDebug to every post', () => {
    const post = makePost({
      id: 'p',
      author: author('a1', 5_000),
      text: 'a reasonable length post about crypto markets today',
      metrics: { likes: 120, reposts: 20, replies: 10, quotes: 2 },
      createdAt: NOW - 30 * 60_000,
    });
    const out = rankTopAlgo([post], controlsWith({}), { now: NOW });
    expect(out[0]?.score?.total).toBeGreaterThan(0);
    expect(out[0]?.score?.reasons.length).toBeGreaterThan(0);
    expect(out[0]?.feedDebug?.sourceProtocol).toBe('nostr');
  });

  it('keeps Latest sort strictly chronological', () => {
    const a = makePost({ id: 'a', createdAt: NOW - 60_000, text: 'older' });
    const b = makePost({ id: 'b', createdAt: NOW - 1_000, text: 'newer' });
    const controls = controlsWith(
      { recencyQuality: 100, familiarDiscover: 100, creatorSize: 100 },
      'latest',
    );
    const out = rankTopAlgo([a, b], controls, { now: NOW });
    expect(out.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
