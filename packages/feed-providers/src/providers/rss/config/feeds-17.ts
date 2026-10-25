import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_17: RssFeedConfig[] = [
  cfg('https://www.theblock.co/post/type/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'policy', 'sec', 'cftc'],
    authority: 2,
  }),
  cfg('https://blog.coinbase.com/category/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'coinbase', 'policy'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // STABLECOINS — Dedicated stablecoin & RWA feeds (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/stablecoins/feed removed — tag RSS 404
  cfg('https://defillama.com/stablecoin/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['stablecoin', 'tvl', 'defi'],
    authority: 2,
  }),
  cfg('https://decrypt.co/stablecoins/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['stablecoin', 'usdc', 'usdt', 'dai'],
    authority: 2,
  }),
  cfg('https://coindesk.com/stablecoins/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['stablecoin', 'defi', 'rwa'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // MEMECOINS — Dedicated meme coin coverage (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/meme-coins/feed removed — tag RSS 404
  cfg('https://decrypt.co/memecoins/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['memecoin', 'meme-coin', 'degen'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // LAYER 2 / SCALING — Additional L2 sources (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // l2beat.com/feed removed — 404 (site restructured)
  // cointelegraph.com/tags/layer-2/feed removed — tag RSS 404

  // ═══════════════════════════════════════════════════════════════════
  // BITCOIN — Additional BTC analysis (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://bitcoinmagazine.com/.rss/full/', {
    tier: 2,
    weight: 1.0,
    category: 'news',
    tags: ['bitcoin', 'btc', 'mining', 'lightning'],
    authority: 3,
  }),
  // cointelegraph.com/tags/bitcoin/feed removed — tag RSS 404
  cfg('https://www.blockchain.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'tech',
    tags: ['bitcoin', 'blockchain', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // DeFi DEEP — Additional yield & protocol coverage (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/defi/feed removed — tag RSS 404
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['defi', 'tvl', 'crypto', 'yield'],
    authority: 2,
  }),
  cfg('https://decrypt.co/defi/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['defi', 'dex', 'yield', 'lending'],
    authority: 2,
  }),
  cfg('https://thedefiant.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'news',
    tags: ['defi', 'crypto', 'ethereum', 'yield'],
    authority: 3,
  }),
  cfg('https://coingecko.com/en/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['defi', 'crypto', 'prices', 'data'],
    authority: 2,
  }),
  cfg('https://blog.intotheblock.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'onchain', 'analytics', 'crypto'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY — Additional security research (added 2026-07-18)
  // ═══════════════════════════════════════════════════════════════════
  // cointelegraph.com/tags/hacking/feed removed — tag RSS 404
  cfg('https://decrypt.co/security/feed', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['security', 'hack', 'audit'],
    authority: 2,
  }),
  cfg('https://slowmist.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://www.certik.com/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
  cfg('https://peckshield.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'exploits'],
    authority: 1,
  }),
  cfg('https://blog.halborn.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'web3'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // RESEARCH — Ethereum Foundation research forum (added 2026-08-06)
  // ═══════════════════════════════════════════════════════════════════
  // ethresear.ch is a Discourse forum (not a Mastodon instance), so it
  // is surfaced here via its RSS feed instead of the fediverse adapter.
  // Verified reachable: GET /latest.rss → 200.
  cfg('https://ethresear.ch/latest.rss', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['ethereum', 'crypto', 'research', 'layer2', 'rollup'],
    authority: 2,
  }),
];
