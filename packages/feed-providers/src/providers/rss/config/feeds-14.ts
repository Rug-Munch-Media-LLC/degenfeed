import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_14: RssFeedConfig[] = [
  cfg('https://www.aitoolreport.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['ai', 'daily', 'tools', 'newsletter'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://www.producthunt.com/feed', {
    tier: 4,
    weight: 0.8,
    category: 'tech',
    tags: ['startup', 'product', 'tech'],
    authority: 1,
  }),
  cfg('https://www.indiehackers.com/feed', {
    tier: 4,
    weight: 0.8,
    category: 'tech',
    tags: ['startup', 'indie', 'saas'],
    authority: 1,
  }),
  cfg('https://www.nature.com/nature.rss', {
    tier: 2,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'research', 'nature'],
    authority: 3,
  }),
  cfg('https://www.sciencedaily.com/rss/all.xml', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'research', 'discovery'],
    authority: 2,
  }),
  cfg('https://www.newscientist.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'tech', 'innovation'],
    authority: 2,
  }),
  cfg('https://phys.org/rss-feed', {
    tier: 3,
    weight: 0.7,
    category: 'science',
    tags: ['science', 'physics', 'space'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Crypto News — Tier 2
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://nulltx.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'news'],
    authority: 1,
  }),
  cfg('https://cryptonews.com/news/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto', 'news'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // DeFi News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defirate.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['defi', 'prediction-markets', 'regulation'],
    authority: 2,
  }),
  cfg('https://governance.aave.com/posts.rss', {
    tier: 4,
    weight: 0.6,
    category: 'development',
    tags: ['defi', 'aave', 'governance'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Regulation / Policy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defieducationfund.org/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['defi', 'regulation', 'policy'],
    authority: 2,
  }),
  cfg('https://www.cryptoforinnovation.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['crypto', 'policy', 'innovation'],
    authority: 1,
  }),
  cfg('https://www.theblockchainassociation.org/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['blockchain', 'policy', 'regulation'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Mining / Energy
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://hashrateindex.com/blog/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'markets',
    tags: ['bitcoin', 'mining', 'hashrate'],
    authority: 1,
  }),
  cfg('https://compassmining.io/education/rss/', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['bitcoin', 'mining', 'energy'],
    authority: 1,
  }),
  cfg('https://braiins.com/blog/feed', {
    tier: 5,
    weight: 0.6,
    category: 'tech',
    tags: ['bitcoin', 'mining', 'protocol'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Data / Analytics
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.intotheblock.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['onchain', 'analytics', 'crypto'],
    authority: 2,
  }),
  cfg('https://cryptoquant.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['onchain', 'bitcoin', 'analytics'],
    authority: 2,
  }),
  cfg('https://santiment.net/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['onchain', 'sentiment', 'analytics'],
    authority: 1,
  }),
  cfg('https://lookintobitcoin.com/feed/', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['bitcoin', 'onchain', 'metrics'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Privacy / Security
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.openzeppelin.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'security',
    tags: ['security', 'audit', 'smart-contracts'],
    authority: 2,
  }),
  cfg('https://www.certik.com/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit', 'blockchain'],
    authority: 1,
  }),
];
