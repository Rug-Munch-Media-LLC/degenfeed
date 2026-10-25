import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_04: RssFeedConfig[] = [
  cfg('https://blog.trailofbits.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'security',
    tags: ['security', 'audit', 'research'],
    authority: 2,
  }),
  cfg('https://www.coincenter.org/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['policy', 'regulation', 'bitcoin'],
    authority: 2,
  }),
  cfg('https://www.sec.gov/news/pressreleases.rss', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['sec', 'regulation', 'policy'],
    authority: 1,
  }),
  cfg('https://www.imf.org/en/News/RSS', {
    tier: 4,
    weight: 0.7,
    category: 'policy',
    tags: ['imf', 'macro', 'policy'],
    authority: 1,
  }),
  cfg('https://blog.coinbase.com/category/regulation/feed', {
    tier: 3,
    weight: 0.8,
    category: 'policy',
    tags: ['regulation', 'coinbase', 'policy'],
    authority: 2,
  }),
  cfg('https://slowmist.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit'],
    authority: 1,
  }),
  cfg('https://immunefi.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'bounty', 'audit'],
    authority: 1,
  }),
  cfg('https://certik.medium.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'audit'],
    authority: 1,
  }),
  cfg('https://medium.com/feed/immunefi', {
    tier: 4,
    weight: 0.7,
    category: 'security',
    tags: ['security', 'bounty'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Web3 / NFT / Gaming
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.decentraland.org/feed/', {
    tier: 5,
    weight: 0.6,
    category: 'development',
    tags: ['metaverse', 'gaming', 'decentraland'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment Research
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dragonfly.xyz/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'vc', 'defi'],
    authority: 2,
  }),
  cfg('https://variantfund.substack.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'defi', 'web3'],
    authority: 2,
  }),
  cfg('https://www.ledger.com/blog.rss', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['hardware', 'security', 'crypto'],
    authority: 1,
  }),
  cfg('https://trezor.io/blog/feed.xml', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['hardware', 'security', 'bitcoin'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Premium Newsletters (Substack / Mirror / Paragraph / Ghost)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://milkroad.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'daily', 'digest'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://thedefiedge.substack.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'research'],
    authority: 2,
  }),
  cfg('https://ethdaily.substack.com/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['ethereum', 'daily'],
    authority: 1,
  }),
  cfg('https://vitalik.eth.limo/feed.xml', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['ethereum', 'crypto', 'research'],
    authority: 2,
  }),
  cfg('https://paragraph.xyz/@bitcoin/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['bitcoin'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@crypto/feed', {
    tier: 4,
    weight: 0.7,
    category: 'news',
    tags: ['crypto'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@andrew/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'opinion'],
    authority: 1,
  }),
  cfg('https://paragraph.xyz/@divine/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'opinion'],
    authority: 1,
  }),
  cfg('https://mirror.xyz/0x25B0/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'web3'],
    authority: 1,
  }),
  cfg('https://mirror.xyz/0xc0FFee/feed', {
    tier: 5,
    weight: 0.6,
    category: 'news',
    tags: ['crypto', 'web3'],
    authority: 1,
  }),
];
