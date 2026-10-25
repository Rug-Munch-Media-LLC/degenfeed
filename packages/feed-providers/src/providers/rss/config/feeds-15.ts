import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_15: RssFeedConfig[] = [
  cfg('https://www.slowmist.com/feed/', {
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

  // ═══════════════════════════════════════════════════════════════════
  // VC / Investment
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://1confirmation.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'research',
    tags: ['crypto', 'vc', 'investment'],
    authority: 2,
  }),
  cfg('https://placeholder.vc/feed', {
    tier: 4,
    weight: 0.7,
    category: 'research',
    tags: ['crypto', 'vc', 'investment'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // On-Chain Data
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://flipsidecrypto.xyz/blog/feed', {
    tier: 4,
    weight: 0.7,
    category: 'analysis',
    tags: ['onchain', 'analytics', 'data'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // Layer 1 & 2 News
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://aptosfoundation.org/rss', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['aptos', 'layer1', 'move'],
    authority: 1,
  }),
  cfg('https://blog.sui.io/feed', {
    tier: 4,
    weight: 0.7,
    category: 'development',
    tags: ['sui', 'layer1', 'move'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // PODCASTS — Crypto (weight: 0.8, tier: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://feeds.megaphone.fm/bankless', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'ethereum', 'defi', 'interview'],
    authority: 2,
  }),
  cfg('https://feeds.megaphone.fm/unchained', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'interview', 'news'],
    authority: 2,
  }),
  cfg('https://pomp.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'macro', 'interview'],
    authority: 2,
  }),
  cfg('https://feeds.megaphone.fm/empire', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'blockchain', 'news', 'interview'],
    authority: 2,
  }),
  cfg('https://0xresearch.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'research', 'markets'],
    authority: 2,
  }),
  cfg('https://bellcurve.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'macro', 'defi', 'research'],
    authority: 2,
  }),
  cfg('https://thedefiant.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['defi', 'crypto', 'interview'],
    authority: 2,
  }),
  cfg('https://epicenter.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'blockchain', 'interview', 'tech'],
    authority: 2,
  }),
  cfg('https://intotheether.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['ethereum', 'defi', 'ecosystem'],
    authority: 2,
  }),
  cfg('https://thescoop.libsyn.com/rss', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'news', 'interview', 'markets'],
    authority: 2,
  }),
  cfg('https://feeds.simplecast.com/onthebrink', {
    tier: 3,
    weight: 0.8,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'macro', 'investment'],
    authority: 2,
  }),
  cfg('https://goodmorningcrypto.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['crypto', 'news', 'daily'],
    authority: 1,
  }),
  cfg('https://cryptoconversation.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['crypto', 'bitcoin', 'interview'],
    authority: 1,
  }),
  cfg('https://thebitcoinpodcast.libsyn.com/rss', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['bitcoin', 'culture', 'interview'],
    authority: 1,
  }),
  cfg('https://feeds.simplecast.com/whatbitcoindid', {
    tier: 4,
    weight: 0.7,
    category: 'podcast',
    tags: ['bitcoin', 'interview', 'macro'],
    authority: 1,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // RESEARCH PAPERS & Aggregators
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://eprint.iacr.org/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['cryptography', 'academic', 'papers', 'security'],
    authority: 3,
  }),
];
