import {
  FarcasterProvider,
  LemmyProvider,
  MastodonProvider,
  NostrProvider,
} from '@degenfeed/feed-providers';
import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

function heatScore(post: UnifiedPost, now: number): number {
  const ageHrs = (now - post.createdAt) / 3600000;
  const recency = 0.5 ** (ageHrs / 24);
  const likes = post.metrics?.likes ?? 0;
  const reposts = post.metrics?.reposts ?? 0;
  const replies = post.metrics?.replies ?? 0;
  const engagementScore = likes * 1 + reposts * 2 + replies * 3;
  const quality: Record<string, number> = {
    lens: 1.0,
    farcaster: 1.0,
    bluesky: 1.0,
    nostr: 0.8,
    mastodon: 0.9,
    threads: 0.7,
    rss: 0.6,
  };
  return engagementScore * recency * (quality[post.protocol] ?? 0.5);
}

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];

async function fetchNostrTop(limit: number): Promise<UnifiedPost[]> {
  const provider = new NostrProvider({ relays: FALLBACK_RELAYS });
  const result = await provider.fetchFeed({ timeoutMs: 6000, concurrency: 4 });
  return result.posts.slice(0, limit);
}

async function fetchFarcasterTop(limit: number): Promise<UnifiedPost[]> {
  const provider = new FarcasterProvider();
  const result = await provider.fetchFeed({ timeoutMs: 6000, concurrency: 4 });
  return result.posts.slice(0, limit);
}

async function fetchBlueskyTop(_limit: number): Promise<UnifiedPost[]> {
  // Lazy-loaded to avoid pulling the provider into the hot path when not needed.
  const { BlueskyProvider } = await import('@degenfeed/feed-providers');
  const provider = new BlueskyProvider();
  const result = await provider.fetchFeed({ timeoutMs: 6000, concurrency: 4 });
  return result.posts;
}

async function fetchMastodonTop(limit: number): Promise<UnifiedPost[]> {
  const provider = new MastodonProvider();
  const result = await provider.fetchFeed({ timeoutMs: 6000, concurrency: 4 });
  return result.posts.slice(0, limit);
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
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    category: 'headlines',
  },
  {
    name: 'The Block',
    url: 'https://www.theblockcrypto.com/rss.xml',
    category: 'headlines',
  },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', category: 'headlines' },
  {
    name: 'Blockworks',
    url: 'https://blockworks.co/feed',
    category: 'headlines',
  },
  {
    name: 'CryptoSlate',
    url: 'https://cryptoslate.com/feed/',
    category: 'headlines',
  },
  { name: 'U_Today', url: 'https://u.today/rss', category: 'headlines' },
  {
    name: 'Bankless',
    url: 'https://bankless.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'Week in Ethereum',
    url: 'https://weekinethereumnews.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'ETH Daily',
    url: 'https://ethdaily.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'Messari',
    url: 'https://messari.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'Delphi Digital',
    url: 'https://members.delphidigital.com/feed/',
    category: 'deep_dives',
  },
  {
    name: 'Kerman Kohli',
    url: 'https://kermankohli.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'The DeFi Investor',
    url: 'https://thedefiinvestor.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'Dune Analytics',
    url: 'https://dune.com/feed',
    category: 'onchain_data',
  },
  {
    name: 'Glassnode',
    url: 'https://glassnode.com/blog/feed',
    category: 'onchain_data',
  },
  {
    name: 'Token Terminal',
    url: 'https://tokenterminal.com/feed',
    category: 'onchain_data',
  },
  {
    name: 'Nansen',
    url: 'https://nansen.substack.com/feed',
    category: 'onchain_data',
  },
  {
    name: 'Artemis',
    url: 'https://artemis.xyz/feed',
    category: 'onchain_data',
  },
  {
    name: 'DeFi Pulse',
    url: 'https://defipulse.com/blog/feed',
    category: 'defi',
  },
  { name: 'DeFi Prime', url: 'https://defiprime.com/feed', category: 'defi' },
  { name: 'DeFi Llama', url: 'https://defillama.com/feed', category: 'defi' },
  { name: 'Yearn', url: 'https://yearn.substack.com/feed', category: 'defi' },
  { name: 'Uniswap', url: 'https://uniswap.org/feed.xml', category: 'defi' },
  {
    name: 'The Sequence',
    url: 'https://thesequence.substack.com/feed',
    category: 'ai_crypto',
  },
  {
    name: 'AI in Crypto',
    url: 'https://aicrypto.substack.com/feed',
    category: 'ai_crypto',
  },
  {
    name: 'Crypto AI Daily',
    url: 'https://cryptoaidaily.substack.com/feed',
    category: 'ai_crypto',
  },
  {
    name: 'Modular',
    url: 'https://modular.substack.com/feed',
    category: 'ai_crypto',
  },
  {
    name: 'SEC Crypto',
    url: 'https://www.sec.gov/rss/crypto',
    category: 'regulation',
  },
  { name: 'CFTC', url: 'https://www.cftc.gov/rss', category: 'regulation' },
  {
    name: 'Crypto Law',
    url: 'https://cryptolaw.substack.com/feed',
    category: 'regulation',
  },
  {
    name: 'The DeFi Edge',
    url: 'https://thedefiedge.substack.com/feed',
    category: 'alpha_leaks',
  },
  {
    name: 'Alpha Leak',
    url: 'https://alphaleak.substack.com/feed',
    category: 'alpha_leaks',
  },
  {
    name: 'Degen News',
    url: 'https://degennews.substack.com/feed',
    category: 'alpha_leaks',
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    category: 'headlines',
  },
  {
    name: 'Unchained',
    url: 'https://unchainedcrypto.com/feed/',
    category: 'deep_dives',
  },
  {
    name: 'Milk Road',
    url: 'https://milkroad.substack.com/feed',
    category: 'deep_dives',
  },
  {
    name: 'The Defiant',
    url: 'https://thedefiant.io/feed',
    category: 'deep_dives',
  },
  {
    name: 'a16z crypto',
    url: 'https://a16zcrypto.com/feed/',
    category: 'deep_dives',
  },
  {
    name: 'Paradigm',
    url: 'https://paradigm.xyz/feed/',
    category: 'deep_dives',
  },
  {
    name: 'EigenLayer',
    url: 'https://eigenlayer.substack.com/feed',
    category: 'defi',
  },
  { name: 'Aave', url: 'https://aave.substack.com/feed', category: 'defi' },
  {
    name: 'Compound',
    url: 'https://compound.substack.com/feed',
    category: 'defi',
  },
  { name: 'Lido', url: 'https://lido.substack.com/feed', category: 'defi' },
  {
    name: 'Solana Foundation',
    url: 'https://solana.com/news/feed',
    category: 'headlines',
  },
  {
    name: 'Ethereum Foundation',
    url: 'https://blog.ethereum.org/feed.xml',
    category: 'headlines',
  },
];

const NEWSLETTER_MAX_SOURCES = 15;
const NEWSLETTER_SOURCE_TIMEOUT_MS = 5000;

export async function handleNewsletterFeed(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 25;
  const category = url.searchParams.get('category') || '';
  const allPosts: UnifiedPost[] = [];

  const sources = category
    ? NEWSLETTER_SOURCES.filter((s) => s.category === category)
    : NEWSLETTER_SOURCES;

  if (sources.length === 0) {
    const categories = [...new Set(NEWSLETTER_SOURCES.map((s) => s.category))];
    return jsonResponse({
      data: [],
      meta: { total: 0, category, available: categories },
    });
  }

  const { GenericRssSource, feedToUnifiedPosts } = await import('@degenfeed/rss-sdk');
  await Promise.allSettled(
    sources.slice(0, NEWSLETTER_MAX_SOURCES).map(async (src) => {
      try {
        const signal = AbortSignal.timeout(NEWSLETTER_SOURCE_TIMEOUT_MS);
        const s = await GenericRssSource.fetch(src.url, { signal });
        const posts = feedToUnifiedPosts(s);
        allPosts.push(...posts);
      } catch {
        /* empty -- error deliberately ignored */
      }
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

// ─── 4. Alt Feed — /api/feed/alt — Best of Lemmy + Reddit Alt ──

const ALT_REDDIT_SUBREDDITS = [
  'privacy',
  'selfhosted',
  'opensource',
  'linux',
  'fediverse',
  'homelab',
  'torrents',
  'Piracy',
  'DataHoarder',
  'degoogle',
  'fossdroid',
  'OpenSignups',
  'trackers',
  'usenet',
  'seedboxes',
  'VPN',
  'Monero',
  'darknet',
  'onions',
  'CryptoCurrency',
  'Bitcoin',
  'ethereum',
  'solana',
  'defi',
  'CryptoTechnology',
  'ethdev',
  'web3',
  'rust',
  'golang',
  'ReverseEngineering',
];

async function fetchLemmyTop(limit: number): Promise<UnifiedPost[]> {
  const provider = new LemmyProvider();
  const result = await provider.fetchFeed({ timeoutMs: 8000, concurrency: 3 });
  return result.posts.slice(0, limit);
}

async function fetchRedditAlt(limit: number, env: Env): Promise<UnifiedPost[]> {
  const { handleRedditFeed } = await import('./feed');
  const redditReq = new Request(
    `http://localhost/api/feed/reddit?subreddits=${ALT_REDDIT_SUBREDDITS.join(',')}&limit=${limit}`,
  );
  const res = await handleRedditFeed(redditReq, env);
  const data = (await res.json()) as { data?: UnifiedPost[] };
  return (data.data ?? []).slice(0, limit);
}

export async function handleAltFeed(_request: Request, _env: Env): Promise<Response> {
  const now = Date.now();

  const [lemmyPosts, redditPosts] = await Promise.all([
    fetchLemmyTop(30).catch(() => []),
    fetchRedditAlt(30, _env).catch(() => []),
  ]);

  const allPosts = [...lemmyPosts, ...redditPosts];
  const scored = allPosts
    .map((p) => {
      const ageHrs = (now - p.createdAt) / 3600000;
      const recency = 0.5 ** (ageHrs / 48);
      const engagement =
        (p.metrics?.likes ?? 0) * 1.5 +
        (p.metrics?.replies ?? 0) * 3 +
        (p.metrics?.reposts ?? 0) * 2;
      const score = engagement * recency;
      return { post: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((p) => p.score > 0)
    .slice(0, 50);

  const seen = new Set<string>();
  const deduped = scored.filter((s) => {
    const key = s.post.text.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return jsonResponse({
    data: deduped.map((s) => s.post),
    meta: {
      total: deduped.length,
      sources: { lemmy: lemmyPosts.length, reddit: redditPosts.length },
      type: 'alt',
    },
  });
}
