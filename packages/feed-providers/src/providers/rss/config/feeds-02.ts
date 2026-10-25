import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_02: RssFeedConfig[] = [
  cfg('https://tokenterminal.com/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
  }),
  cfg('https://messari.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'research', 'onchain'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4 — News Aggregators (weight: 0.7, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cryptoslate.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum'],
    authority: 1,
  }),
  cfg('https://cryptobriefing.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'defi'],
    authority: 1,
  }),
  cfg('https://beincrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://coingape.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://ambcrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://cryptopotato.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://www.newsbtc.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),
  cfg('https://bitcoinmagazine.com/.rss/full/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://u.today/rss', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum'],
    authority: 1,
  }),
  cfg('https://dailyhodl.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'altcoin'],
    authority: 1,
  }),
  cfg('https://zycrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'altcoin'],
    authority: 1,
  }),
  cfg('https://bitcoinist.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),
  cfg('https://cryptonews.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://unchainedcrypto.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'defi'],
    authority: 1,
  }),

  cfg('https://protos.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'bitcoin'],
    authority: 1,
  }),
  cfg('https://www.ledgerinsights.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'blockchain', 'enterprise'],
    authority: 1,
  }),
  cfg('https://news.bitcoin.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin', 'crypto'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 5 — Developer / Protocol Blogs (weight: 0.6, authority: 1)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.ethereum.org/feed.xml', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['ethereum', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.polygon.technology/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['polygon', 'layer2', 'dev'],
    authority: 1,
  }),
  cfg('https://starkware.co/feed', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['starkware', 'layer2', 'zk', 'dev'],
    authority: 1,
  }),
  cfg('https://www.zk.com/blog/rss', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['zk', 'zero-knowledge', 'dev'],
    authority: 1,
  }),
  cfg('https://blog.eigenlayer.xyz/rss', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['eigenlayer', 'restaking', 'ethereum'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
];
