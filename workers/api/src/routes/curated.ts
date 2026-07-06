import type { GtSStatus } from '@degenfeed/mastodon-sdk';
import type { UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

// ─── Heat Score ────────────────────────────────────────────────
// Scores a post based on engagement, recency, and source quality
function heatScore(post: UnifiedPost, now: number): number {
  const ageHrs = (now - post.createdAt) / 3600000;
  const recency = 0.5 ** (ageHrs / 24); // 24h half-life

  const likes = post.metrics?.likes ?? 0;
  const reposts = post.metrics?.reposts ?? 0;
  const replies = post.metrics?.replies ?? 0;

  const engagementScore = likes * 1 + reposts * 2 + replies * 3;

  // Source quality multiplier
  const quality: Record<string, number> = {
    lens: 1.0,
    farcaster: 1.0,
    bluesky: 1.0,
    nostr: 0.8,
    mastodon: 0.9,
    threads: 0.7,
    rss: 0.6,
  };
  const q = quality[post.protocol] ?? 0.5;

  return engagementScore * recency * q;
}

// ─── 1. Best of Web3 — /api/feed/top ──────────────────────────
// Fetches from all protocols, scores by heat, returns top 50 in last 24h

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];

async function fetchNostrTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { RelayPool } = await import('@degenfeed/nostr-sdk');
    const pool = new RelayPool(FALLBACK_RELAYS, { eoseTimeout: 3000 });
    const events = await pool.list({ kinds: [1], limit: limit * 3 }, 3000);
    pool.disconnectAll();
    for (const ev of events) {
      posts.push({
        id: `nostr:${ev.id}`,
        protocol: 'nostr' as const,
        author: {
          id: `nostr:${ev.pubkey}`,
          primary: { protocol: 'nostr' as const, id: ev.pubkey },
          handles: {
            nostr: ev.pubkey.slice(0, 12),
            farcaster: null,
            lens: null,
            bluesky: null,
            threads: null,
            rss: null,
            mastodon: null,
          },
          displayName: ev.pubkey.slice(0, 12),
          bio: '',
          avatarUrl: '',
          verified: [],
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: ev.content,
        embeds: [],
        createdAt: ev.created_at * 1000,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: ev,
        niches: [],
      });
    }
  } catch {}
  return posts;
}

async function fetchFarcasterTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { HubClient } = await import('@degenfeed/farcaster-sdk');
    const client = new HubClient('https://hub.farcaster.standardcrypto.vc:2281');
    const fids = [1, 2, 3, 5650, 1234, 11276, 215, 320];
    const results = await Promise.allSettled(
      fids.slice(0, 4).map((fid) => client.getCastsByFid(fid, Math.ceil(limit / 2))),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const cast of r.value) {
          posts.push(cast as unknown as UnifiedPost);
        }
      }
    }
  } catch {}
  return posts;
}

async function fetchBlueskyTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { BskyClient } = await import('@degenfeed/bluesky-sdk');
    const client = new BskyClient('https://public.api.bsky.app');
    const { posts: raw } = await client.getTimeline(limit);
    for (const p of raw) {
      posts.push(p as unknown as UnifiedPost);
    }
  } catch {}
  return posts;
}

async function fetchMastodonTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient('https://social.degenfeed.xyz');
    const statuses = await client.getPublicTimeline(limit);
    for (const s of statuses as GtSStatus[]) {
      posts.push({
        id: `mastodon:${s.id}`,
        protocol: 'mastodon' as const,
        author: {
          id: `mastodon:${s.account.id}`,
          primary: { protocol: 'mastodon' as const, id: s.account.id },
          handles: {
            mastodon: s.account.acct,
            nostr: null,
            farcaster: null,
            lens: null,
            bluesky: null,
            threads: null,
            rss: null,
          },
          displayName: s.account.display_name || s.account.username,
          bio: '',
          avatarUrl: s.account.avatar,
          verified: [],
          followerCount: s.account.followers_count,
          followingCount: s.account.following_count,
          links: [],
          keys: {},
        },
        text: s.content.replace(/<[^>]*>/g, ''),
        embeds: [],
        createdAt: new Date(s.created_at).getTime(),
        metrics: {
          likes: s.favourites_count,
          reposts: s.reblogs_count,
          replies: s.replies_count,
          quotes: 0,
        },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: s,
        niches: [],
      });
    }
  } catch {}
  return posts;
}

export async function handleTopFeed(request: Request, _env: Env): Promise<Response> {
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 50;
  const now = Date.now();

  const [nostrPosts, fcPosts, bskyPosts, mastodonPosts] = await Promise.all([
    fetchNostrTop(limit).catch(() => []),
    fetchFarcasterTop(limit).catch(() => []),
    fetchBlueskyTop(limit).catch(() => []),
    fetchMastodonTop(limit).catch(() => []),
  ]);

  const allPosts = [...nostrPosts, ...fcPosts, ...bskyPosts, ...mastodonPosts];
  const scored = allPosts
    .map((p) => ({ post: p, score: heatScore(p, now) }))
    .sort((a, b) => b.score - a.score)
    .filter((p) => p.score > 0)
    .slice(0, limit);

  // Dedup by content similarity
  const seen = new Set<string>();
  const deduped = scored
    .filter((s) => {
      const key = s.post.text.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);

  return jsonResponse({
    data: deduped.map((s) => s.post),
    meta: { total: deduped.length, limit, type: 'top' },
  });
}

// ─── 2. Newsletter Feed — /api/feed/newsletters ───────────────

const NEWSLETTER_SOURCES = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'headlines',
  },
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', category: 'headlines' },
  { name: 'The Block', url: 'https://www.theblockcrypto.com/rss.xml', category: 'headlines' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', category: 'headlines' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed', category: 'headlines' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/', category: 'headlines' },
  { name: 'U_Today', url: 'https://u.today/rss', category: 'headlines' },
  { name: 'Bankless', url: 'https://bankless.substack.com/feed', category: 'deep_dives' },
  { name: 'Week in Ethereum', url: 'https://weekinethereumnews.com/feed', category: 'deep_dives' },
  { name: 'ETH Daily', url: 'https://ethdaily.substack.com/feed', category: 'deep_dives' },
  { name: 'Messari', url: 'https://messari.io/rss', category: 'deep_dives' },
  {
    name: 'Delphi Digital',
    url: 'https://members.delphidigital.com/feed/',
    category: 'deep_dives',
  },
  { name: 'Kerman Kohli', url: 'https://kermankohli.substack.com/feed', category: 'deep_dives' },
  {
    name: 'The DeFi Investor',
    url: 'https://thedefiinvestor.substack.com/feed',
    category: 'deep_dives',
  },
  { name: 'Dune Analytics', url: 'https://dune.com/feed', category: 'onchain_data' },
  { name: 'Glassnode', url: 'https://glassnode.com/blog/feed', category: 'onchain_data' },
  { name: 'Token Terminal', url: 'https://tokenterminal.com/feed', category: 'onchain_data' },
  { name: 'Nansen', url: 'https://nansen.substack.com/feed', category: 'onchain_data' },
  { name: 'Artemis', url: 'https://artemis.xyz/feed', category: 'onchain_data' },
  { name: 'DeFi Pulse', url: 'https://defipulse.com/blog/feed', category: 'defi' },
  { name: 'DeFi Prime', url: 'https://defiprime.com/feed', category: 'defi' },
  { name: 'DeFi Llama', url: 'https://defillama.com/feed', category: 'defi' },
  { name: 'Yearn', url: 'https://yearn.substack.com/feed', category: 'defi' },
  { name: 'Uniswap', url: 'https://uniswap.org/feed.xml', category: 'defi' },
  { name: 'The Sequence', url: 'https://thesequence.substack.com/feed', category: 'ai_crypto' },
  { name: 'AI in Crypto', url: 'https://aicrypto.substack.com/feed', category: 'ai_crypto' },
  {
    name: 'Crypto AI Daily',
    url: 'https://cryptoaidaily.substack.com/feed',
    category: 'ai_crypto',
  },
  { name: 'Modular', url: 'https://modular.substack.com/feed', category: 'ai_crypto' },
  { name: 'SEC Crypto', url: 'https://www.sec.gov/rss/crypto', category: 'regulation' },
  { name: 'CFTC', url: 'https://www.cftc.gov/rss', category: 'regulation' },
  { name: 'Crypto Law', url: 'https://cryptolaw.substack.com/feed', category: 'regulation' },
  { name: 'The DeFi Edge', url: 'https://thedefiedge.substack.com/feed', category: 'alpha_leaks' },
  { name: 'Alpha Leak', url: 'https://alphaleak.substack.com/feed', category: 'alpha_leaks' },
  { name: 'Degen News', url: 'https://degennews.substack.com/feed', category: 'alpha_leaks' },
];

export async function handleNewsletterFeed(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 25;
  const category = url.searchParams.get('category') || '';
  const allPosts: UnifiedPost[] = [];

  const sources = category
    ? NEWSLETTER_SOURCES.filter((s) => s.category === category)
    : NEWSLETTER_SOURCES;

  if (sources.length === 0) {
    return jsonResponse({
      data: [],
      meta: { total: 0, category, available: Object.keys(NEWSLETTER_SOURCES).filter(Boolean) },
    });
  }

  const _results = await Promise.allSettled(
    sources.slice(0, 15).map(async (src) => {
      try {
        const { GenericRssSource, feedToUnifiedPosts } = await import('@degenfeed/rss-sdk');
        const s = await GenericRssSource.fetch(src.url);
        const posts = feedToUnifiedPosts(s);
        allPosts.push(...posts);
      } catch {}
    }),
  );

  allPosts.sort((a, b) => b.createdAt - a.createdAt);

  // Enhanced niche detection from combined content
  const nicheCounts: Record<string, number> = {};
  for (const post of allPosts.slice(0, 50)) {
    const text = `${post.text} ${(post.niches || []).join(' ')}`.toLowerCase();
    const keywords: Record<string, string[]> = {
      bitcoin: ['bitcoin', 'btc', 'satoshi'],
      ethereum: ['ethereum', 'eth', 'vitalik'],
      solana: ['solana', 'sol'],
      defi: ['defi', 'lending', 'yield', 'liquidity', 'amm', 'swap'],
      nft: ['nft', 'nfts', 'collectible', 'art block', 'punk'],
      ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt'],
      regulation: ['sec', 'regulation', 'cftc', 'biden', 'congress'],
      degen: ['degen', 'ape', 'moon', 'rug', 'pump', 'dump', 'memecoin'],
      layer2: ['layer 2', 'l2', 'rollup', 'arbitrum', 'optimism', 'base'],
      privacy: ['privacy', 'monero', 'zero knowledge', 'zkp'],
      gaming: ['gaming', 'gamefi', 'metaverse', 'play to earn'],
    };
    for (const [niche, terms] of Object.entries(keywords)) {
      if (terms.some((t) => text.includes(t))) {
        nicheCounts[niche] = (nicheCounts[niche] || 0) + 1;
      }
    }
  }

  // Sort niches by frequency
  const trending = Object.entries(nicheCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count }));

  return jsonResponse({
    data: allPosts.slice(0, limit),
    meta: {
      total: allPosts.length,
      sources: sources.length,
      category: category || 'all',
      trending,
    },
  });
}

// ─── 3. Trending Topics — /api/feed/trending ─────────────────

export async function handleTrendingFeed(request: Request, env: Env): Promise<Response> {
  // Fetch recent posts across protocols, extract niches, aggregate
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 20;

  const [nostrPosts, fcPosts] = await Promise.all([
    fetchNostrTop(limit).catch(() => []),
    fetchFarcasterTop(limit).catch(() => []),
  ]);

  const allPosts = [...nostrPosts, ...fcPosts];
  allPosts.sort((a, b) => b.createdAt - a.createdAt);

  // Delegate to the home feed handler for ranking
  const { handleHomeFeed } = await import('./feed');
  const fakeReq = new Request(
    `http://localhost/api/feed/home?protocols=nostr,farcaster&limit=${limit}`,
  );
  return handleHomeFeed(fakeReq, env);
}
