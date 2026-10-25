import { cfg } from '../cfg-helpers';
import type { RssFeedConfig } from '../types';

export const FEEDS_01: RssFeedConfig[] = [
  // ═══════════════════════════════════════════════════════════════════
  // TIER 1 — Must Have Crypto News (weight: 1.0, authority: 3)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://cointelegraph.com/rss', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://decrypt.co/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://www.coindesk.com/arc/outboundfeeds/rss/', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'policy'],
    authority: 3,
  }),
  cfg('https://blockworks.co/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['crypto', 'bitcoin', 'ethereum', 'defi'],
    authority: 3,
  }),
  cfg('https://thedefiant.io/api/feed', {
    tier: 1,
    weight: 1.0,
    category: 'news',
    tags: ['defi', 'crypto', 'ethereum'],
    authority: 3,
  }),
  cfg('https://unchainedcrypto.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'interviews'],
    authority: 3,
    isPaid: false,
    schedule: 'weekly',
  }),
  cfg('https://pomp.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'bitcoin', 'macro'],
    authority: 3,
    isPaid: true,
    schedule: 'daily',
  }),
  cfg('https://blog.chainalysis.com/feed/', {
    tier: 1,
    weight: 1.0,
    category: 'research',
    tags: ['onchain', 'security', 'crypto'],
    authority: 3,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2 — High Quality Research / VC (weight: 0.9, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.electriccapital.com/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'onchain', 'analytics'],
    authority: 2,
  }),
  cfg('https://panteracapital.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'bitcoin', 'blockchain'],
    authority: 2,
  }),
  cfg('https://framework.ventures/rss', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'defi', 'gaming'],
    authority: 2,
  }),
  cfg('https://members.delphidigital.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'macro', 'defi'],
    authority: 2,
  }),
  cfg('https://www.galaxy.com/insights/feed/', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'bitcoin', 'research'],
    authority: 2,
  }),
  cfg('https://coinmetrics.io/feed', {
    tier: 2,
    weight: 0.9,
    category: 'markets',
    tags: ['bitcoin', 'ethereum', 'onchain', 'metrics'],
    authority: 2,
  }),
  cfg('https://delphidigital.substack.com/feed', {
    tier: 1,
    weight: 1.0,
    category: 'newsletter',
    tags: ['crypto', 'macro', 'defi', 'research'],
    authority: 3,
    isPaid: true,
    schedule: 'weekly',
  }),
  cfg('https://variant.fund/feed', {
    tier: 2,
    weight: 0.9,
    category: 'research',
    tags: ['crypto', 'defi', 'web3'],
    authority: 2,
  }),
  cfg('https://nansen.substack.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'analysis',
    tags: ['onchain', 'ethereum', 'defi'],
    authority: 2,
  }),
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'tvl', 'crypto'],
    authority: 2,
  }),
  cfg('https://tokenterminal.com/feed', {
    tier: 2,
    weight: 0.9,
    category: 'analysis',
    tags: ['crypto', 'defi', 'metrics'],
    authority: 2,
  }),

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3 — Analysis & Data (weight: 0.8, authority: 2)
  // ═══════════════════════════════════════════════════════════════════
  cfg('https://blog.kaiko.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'markets',
    tags: ['crypto', 'markets', 'trading', 'data'],
    authority: 2,
  }),
  cfg('https://insights.glassnode.com/feed/', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['bitcoin', 'ethereum', 'onchain'],
    authority: 2,
  }),
  // nansen.ai/research removed — 404 (redirects to substack which is already listed above)
  cfg('https://www.artemis.xyz/blog/rss', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['crypto', 'defi', 'layer2', 'metrics'],
    authority: 2,
  }),
  cfg('https://dappradar.com/blog/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'nft', 'gaming', 'dapps'],
    authority: 2,
  }),
  cfg('https://defillama.com/feed', {
    tier: 3,
    weight: 0.8,
    category: 'analysis',
    tags: ['defi', 'tvl', 'crypto'],
    authority: 2,
  }),
];
