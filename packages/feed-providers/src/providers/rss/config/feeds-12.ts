import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_12: RssFeedConfig[] = [
  cfg('https://ignasdefi.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'research', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Bitcoin Focus (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://bitcoinmagazinepro.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'research', 'mining'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://satoshisjournal.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'crypto', 'culture'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://thebitcoinlayer.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'macro', 'economy'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://nikbhatia.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['bitcoin', 'macro', 'finance'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Trading / Markets (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://macroscope.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['macro', 'markets', 'trading'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://thetranscript.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'trading', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://execsum.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'crypto', 'derivatives'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://themarketear.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['markets', 'trading', 'macro', 'sentiment'],
    authority: 2,
    isPaid: false,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 / Builders (weight: 0.7, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://developerdao.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'dev', 'dao'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://a16zcrypto.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'crypto', 'research', 'vc'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://lijin.substack.com/feed', {
    tier: 3,
    weight: 0.7,
    category: 'newsletter',
    tags: ['web3', 'creator', 'crypto'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Web3 Publishing (Paragraph + Mirror) (weight: 0.8, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://dev.mirror.xyz/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['web3', 'dev', 'mirror'],
    authority: 2,
    isPaid: false,
    schedule: 'irregular',
  }),
  cfg('https://blog.paragraph.xyz/feed', {
    tier: 3,
    weight: 0.8,
    category: 'newsletter',
    tags: ['web3', 'publishing', 'paragraph'],
    authority: 2,
    isPaid: false,
    schedule: 'irregular',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Medium Publications (weight: 0.7, tier: 4)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://medium.com/feed/coinmonks', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'blockchain', 'defi'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/the-capital', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'finance', 'investing'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/cryptostars', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['crypto', 'blockchain', 'altcoin'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
  cfg('https://medium.com/feed/hackernoon', {
    tier: 4,
    weight: 0.7,
    category: 'newsletter',
    tags: ['tech', 'startup', 'programming'],
    authority: 1,
    isPaid: false,
    schedule: 'daily',
  }),
];
