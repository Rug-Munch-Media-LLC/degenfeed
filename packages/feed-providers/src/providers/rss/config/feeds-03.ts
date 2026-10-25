import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_03: RssFeedConfig[] = [
  cfg('https://blog.celestia.org/rss', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['celestia', 'modular', 'data-availability'],
    authority: 1,
  }),
  cfg('https://polkadot.network/blog/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['polkadot', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.chain.link/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['chainlink', 'oracle', 'dev'],
    authority: 1,
  }),
  cfg('https://starknet.io/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['starknet', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://zksync.io/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['zksync', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://eips.ethereum.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'eips', 'standards'],
    authority: 1,
  }),
  cfg('https://weekinethereumnews.com/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'newsletter'],
    authority: 1,
  }),
  cfg('https://base.mirror.xyz/feed/atom', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['base', 'layer2', 'dev'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Exchange / Institutional Blogs
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.coinbase.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['coinbase', 'crypto', 'regulation'],
    authority: 2,
  }),
  cfg('https://www.coinbase.com/blog/rss.xml', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['coinbase', 'crypto'],
    authority: 2,
  }),
  cfg('https://blog.kraken.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['kraken', 'crypto', 'regulation'],
    authority: 2,
  }),
  cfg('https://blog.binance.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'news',
    tags: ['binance', 'crypto'],
    authority: 2,
  }),

  cfg('https://www.galaxy.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['galaxy', 'crypto', 'research'],
    authority: 2,
  }),
  cfg('https://blog.bitmex.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitmex', 'trading', 'derivatives'],
    authority: 1,
  }),
  cfg('https://blog.bitfinex.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitfinex', 'trading'],
    authority: 1,
  }),
  cfg('https://www.okx.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['okx', 'trading', 'crypto'],
    authority: 1,
  }),
  cfg('https://blog.bybit.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bybit', 'trading'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Data & Research Platforms
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://coinmarketcap.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'prices'],
    authority: 1,
  }),
  cfg('https://www.vanryun.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'macro'],
    authority: 1,
  }),
  cfg('https://www.21shares.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'institutional'],
    authority: 1,
  }),
  cfg('https://grayscale.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://bitwiseinvestments.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.coinshares.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'etf', 'institutional'],
    authority: 1,
  }),
  cfg('https://coingecko.com/en/blog/rss', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['crypto', 'prices', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Security & Policy
  // ═══════════════════════════════════════════════════════════════════
];
