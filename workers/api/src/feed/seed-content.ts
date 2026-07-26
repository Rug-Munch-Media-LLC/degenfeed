/**
 * Seed / Demo Content for Worker API
 *
 * Served when ALL providers return empty data. Ensures the feed
 * never shows empty. Posts are tagged with _demo=true so the
 * frontend can show an "example" badge.
 */

import type { UnifiedPost } from '@degenfeed/types';

const NOW = Date.now();
const HOUR = 3600_000;

// ─── Author templates ─────────────────────────────────────────────────────

const DEMO_AUTHORS = [
  { displayName: 'Crypto Bot', handle: 'cryptobot', bio: 'Demo account' },
  { displayName: 'DeFi Dad', handle: 'defidad', bio: 'Demo account' },
  { displayName: 'NFT King', handle: 'nftking', bio: 'Demo account' },
  { displayName: 'BTC Maxi', handle: 'btcmaxi', bio: 'Demo account' },
  { displayName: 'ETH Builder', handle: 'ethbuilder', bio: 'Demo account' },
  { displayName: 'AI Researcher', handle: 'airesearcher', bio: 'Demo account' },
  { displayName: 'DeFi Llama', handle: 'defillama', bio: 'Demo account' },
  { displayName: 'Memecoin Trader', handle: 'memetrader', bio: 'Demo account' },
];

const DEMO_POST_TEMPLATES: Array<{ text: string; niches: string[] }> = [
  {
    text: 'Connect Nostr, Farcaster, Bluesky, or Mastodon to see real posts here! 🔌',
    niches: ['crypto', 'demo'],
  },
  {
    text: 'Bitcoin halving cycles have historically led to bull runs 12-18 months after. DYOR.',
    niches: ['bitcoin', 'crypto'],
  },
  {
    text: 'Ethereum L2s are processing more transactions than all other chains combined.',
    niches: ['ethereum', 'layer2'],
  },
  {
    text: 'DeFi TVL just hit a new high across all chains. Liquidity is flowing back.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Solana daily active addresses just crossed 2 million. Ecosystem is thriving.',
    niches: ['solana', 'crypto'],
  },
  {
    text: 'AI agents are starting to interact with smart contracts autonomously.',
    niches: ['ai', 'defi'],
  },
  {
    text: 'The memecoin supercycle thesis: attention is the new alpha. Most will go to zero.',
    niches: ['memecoin', 'crypto'],
  },
  {
    text: 'NFT volumes recovering with new use cases: token-gated communities & RWAs.',
    niches: ['nft', 'crypto'],
  },
  {
    text: 'Security: always verify contract addresses. Scammers are getting sophisticated.',
    niches: ['security', 'crypto'],
  },
  {
    text: 'L2s now handle >80% of ETH txns. Blob demand increasing post-Dencun.',
    niches: ['layer2', 'ethereum'],
  },
  {
    text: 'ZKP technology advancing rapidly. Privacy-preserving smart contracts are close.',
    niches: ['crypto', 'tech'],
  },
  {
    text: 'Regulation update: multiple jurisdictions moving toward crypto frameworks.',
    niches: ['regulation', 'crypto'],
  },
  {
    text: 'RWA tokenization: the biggest opportunity in crypto. Trillions on-chain.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Cross-chain interoperability improving with CCIP, LayerZero, native USDC.',
    niches: ['crypto', 'defi'],
  },
  {
    text: 'Developer activity is the best leading indicator. Check GitHub commit activity.',
    niches: ['dev', 'crypto'],
  },
  {
    text: 'Account abstraction will improve UX 10x. Intent-based architectures are next.',
    niches: ['crypto', 'tech'],
  },
  {
    text: 'Staking yields normalizing across ETH, SOL, ADA. Security budgets sustainable.',
    niches: ['crypto', 'staking'],
  },
  {
    text: 'Protocol fees eat your returns. Use aggregators and compare gas costs.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Connect more protocols at app.degenfeed.xyz to see your full cross-protocol feed! 🔥',
    niches: ['demo', 'crypto'],
  },
];

/**
 * Generate seed/demo posts for the feed.
 * Rotates content based on time for variety across requests.
 * Post.raw._demo = true so frontend can display an "example" badge.
 */
export function getSeedContent(limit: number, protocol?: string): UnifiedPost[] {
  const hourSlot = Math.floor(NOW / (HOUR * 2));
  const posts: UnifiedPost[] = [];

  const pool = protocol
    ? DEMO_POST_TEMPLATES.filter(
        (t) =>
          t.niches.includes(protocol.toLowerCase()) ||
          t.text.toLowerCase().includes(protocol.toLowerCase()),
      )
    : DEMO_POST_TEMPLATES;

  const templates = pool.length > 0 ? pool : DEMO_POST_TEMPLATES;

  for (let i = 0; i < limit && i < templates.length; i++) {
    const idx = (i + hourSlot) % templates.length;
    const template = templates[idx];
    if (!template) continue;

    const author = DEMO_AUTHORS[i % DEMO_AUTHORS.length];
    const hoursAgo = i * 2 + 1;

    posts.push({
      id: `seed:${NOW}-${i}`,
      protocol: '_demo' as any,
      author: {
        id: `seed:${author.handle}`,
        primary: { protocol: '_demo' as any, id: `seed:${author.handle}` },
        handles: { _demo: author.handle },
        displayName: author.displayName,
        bio: author.bio,
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: template.text,
      embeds: [],
      contentType: 'text',
      createdAt: NOW - hoursAgo * HOUR,
      metrics: {
        likes: 100 - i * 5,
        reposts: 30 - i * 2,
        replies: 15 - i,
        quotes: 10 - i,
        views: 500 - i * 20,
      },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 100 - i * 5, reposts: 30 - i * 2, replies: 15 - i, quotes: 10 - i },
      },
      raw: { _demo: true },
      niches: template.niches,
      sourceBadge: '●',
      sourceColor: '#666',
      sourceLabel: 'Demo',
    } as UnifiedPost & { sourceBadge?: string; sourceColor?: string; sourceLabel?: string });
  }

  return posts;
}

/**
 * Check if the given posts list is effectively empty
 * (all real providers returned nothing).
 */
export function isEffectivelyEmpty(posts: UnifiedPost[]): boolean {
  if (posts.length === 0) return true;
  // If every post is a seed/demo post, also treat as empty
  return posts.every((p) => (p.raw as Record<string, unknown>)?._demo === true);
}
