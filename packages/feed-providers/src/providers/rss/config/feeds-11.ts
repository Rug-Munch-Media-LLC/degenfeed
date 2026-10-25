import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_11: RssFeedConfig[] = [
  cfg('https://0xresearch.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'research', 'defi'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi / Protocol (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://defiweekly.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['defi', 'decentralized-finance', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://thedefiant.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['defi', 'crypto', 'ethereum'],
    authority: 2,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://weekinethereum.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ethereum', 'layer2', 'dev'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://tokenterminal.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://dunedigest.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['onchain', 'analytics', 'defi'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — AI x Crypto (weight: 0.9, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://supervised.news/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'crypto', 'research'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://theaireport.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'ml', 'llm'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://tldrai.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'ml', 'llm', 'digest'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://importai.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'newsletter',
    tags: ['ai', 'research', 'ml'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — Crypto Research (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://theblockresearch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'onchain'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://reflexivityresearch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'macro'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://caneisland.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['crypto', 'research', 'bitcoin'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://ecoinometrics.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['bitcoin', 'research', 'macro', 'onchain'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),

  // ═══════════════════════════════════════════════════════════════════
  // NEWSLETTERS — DeFi Alpha (weight: 0.8, tier: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://ournetwork.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'onchain', 'research'],
    authority: 2,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://blockcrunch.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'crypto', 'research'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://defidad.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'yield', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://route2fi.substack.com/feed', {
    tier: 2,
    weight: 0.8,
    category: 'newsletter',
    tags: ['defi', 'finance', 'crypto'],
    authority: 2,
    isPaid: false,
    schedule: 'weekly',
  }),
];
