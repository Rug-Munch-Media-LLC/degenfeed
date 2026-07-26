/**
 * Seed / Demo Content
 *
 * Served when ALL providers fail to return content. Shows what the feed
 * COULD look like with real data, plus a CTA to connect more protocols.
 *
 * Each post has a `_demo: true` flag so the frontend can show an
 * "example" badge instead of treating it as real content.
 */

import type { UnifiedPost } from './types';

const NOW = Date.now();
const HOUR = 3600_000;

// ─── Author templates ─────────────────────────────────────────────────────

const DEMO_AUTHORS = [
  {
    id: 'seed:crypto-bot',
    displayName: 'Crypto Bot',
    handle: 'cryptobot',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:defi-dad',
    displayName: 'DeFi Dad',
    handle: 'defidad',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:nft-king',
    displayName: 'NFT King',
    handle: 'nftking',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:btc-maximalist',
    displayName: 'BTC Maxi',
    handle: 'btcmaxi',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:eth-builder',
    displayName: 'ETH Builder',
    handle: 'ethbuilder',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:ai-researcher',
    displayName: 'AI Researcher',
    handle: 'airesearcher',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:defi-llama',
    displayName: 'DeFi Llama',
    handle: 'defillama',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
  {
    id: 'seed:memecoin-trader',
    displayName: 'Memecoin Trader',
    handle: 'memetrader',
    avatarUrl: '',
    bio: 'Demo account — connect a protocol to see real content!',
  },
];

function makeAuthor(index: number) {
  return DEMO_AUTHORS[index % DEMO_AUTHORS.length];
}

function makePost(
  text: string,
  niches: string[],
  authorIndex: number,
  hoursAgo: number,
  likes = 42,
  reposts = 12,
  replies = 5,
): UnifiedPost {
  const author = makeAuthor(authorIndex);
  return {
    id: `seed:${NOW}-${authorIndex}-${hoursAgo}`,
    protocol: '_demo',
    author: {
      id: author.id,
      primary: { protocol: '_demo' as never, id: author.id },
      handles: { _demo: author.handle },
      displayName: author.displayName,
      bio: author.bio,
      avatarUrl: author.avatarUrl,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    contentType: 'text',
    createdAt: NOW - hoursAgo * HOUR,
    metrics: { likes, reposts, replies, quotes: Math.floor(reposts / 3) },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes, reposts, replies, quotes: Math.floor(reposts / 3) },
    },
    raw: { _demo: true },
    niches,
  };
}

// ─── Demo posts (rotated, timestamped) ────────────────────────────────────

const DEMO_POST_TEMPLATES: Array<{
  text: string;
  niches: string[];
}> = [
  {
    text: 'Connect Nostr, Farcaster, Bluesky, or Mastodon to see real posts here! 🔌',
    niches: ['crypto', 'demo'],
  },
  {
    text: 'Bitcoin halving cycles have historically led to bull runs 12-18 months after. DYOR.',
    niches: ['bitcoin', 'crypto'],
  },
  {
    text: 'Ethereum L2s are processing more transactions than all other chains combined. The scaling roadmap is working.',
    niches: ['ethereum', 'layer2'],
  },
  {
    text: 'DeFi TVL just hit a new high across all chains. Liquidity is flowing back into protocols.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Solana每日活跃地址数突破200万。生态系统正在蓬勃发展。',
    niches: ['solana', 'crypto'],
  },
  {
    text: 'AI agents are starting to interact with smart contracts autonomously. This is going to be huge for DeFi.',
    niches: ['ai', 'defi'],
  },
  {
    text: 'The memecoin supercycle thesis: attention is the new alpha. But most will go to zero. Be careful out there.',
    niches: ['memecoin', 'crypto'],
  },
  {
    text: 'NFT volumes are recovering with new use cases: token-gated communities, event tickets, and real-world assets.',
    niches: ['nft', 'crypto'],
  },
  {
    text: 'Security alert: always verify contract addresses before interacting. Scammers are getting more sophisticated.',
    niches: ['security', 'crypto'],
  },
  {
    text: 'Layer 2 solutions are now handling >80% of ETH transactions. Blob space demand is increasing post-Dencun.',
    niches: ['layer2', 'ethereum'],
  },
  {
    text: 'ZKP technology is advancing rapidly. Privacy-preserving smart contracts are closer than most people think.',
    niches: ['crypto', 'tech'],
  },
  {
    text: 'The intersection of AI and crypto: decentralized compute, verifiable inference, and autonomous agents.',
    niches: ['ai', 'crypto'],
  },
  {
    text: 'Regulation update: multiple jurisdictions are moving toward comprehensive crypto frameworks. Clarity is coming.',
    niches: ['regulation', 'crypto'],
  },
  {
    text: 'RWA tokenization is the biggest opportunity in crypto right now. Trillions in assets will be on-chain.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Staking yields are normalizing across ETH, SOL, and ADA. Security budgets are finally sustainable.',
    niches: ['crypto', 'staking'],
  },
  {
    text: 'Cross-chain interoperability is improving with CCIP, LayerZero, and native USDC transfers.',
    niches: ['crypto', 'defi'],
  },
  {
    text: 'Developer activity is the best leading indicator. Check GitHub commit activity before investing in any project.',
    niches: ['dev', 'crypto'],
  },
  {
    text: 'The next wave: account abstraction, chain abstraction, intent-based architectures. UX will improve 10x.',
    niches: ['crypto', 'tech'],
  },
  {
    text: 'Degen tip: protocol fees are eating your returns. Use aggregators and compare gas costs across chains.',
    niches: ['defi', 'crypto'],
  },
  {
    text: 'Connect more protocols at app.degenfeed.xyz to see your full cross-protocol feed! 🔥',
    niches: ['demo', 'crypto'],
  },
];

/**
 * Generate seed/demo posts for the feed.
 * Rotates content based on the current hour for variety across requests.
 * Marked with `raw._demo = true` so the frontend can display an "example" badge.
 *
 * @param limit Max number of posts to return
 * @param protocol Optional: if provided, generates posts that mention this protocol
 */
export function getSeedContent(limit: number, protocol?: string): UnifiedPost[] {
  const hourSlot = Math.floor(NOW / (HOUR * 2)); // Rotate every 2 hours
  const posts: UnifiedPost[] = [];

  // Pick templates that mention the requested protocol, or all if no protocol
  const pool = protocol
    ? DEMO_POST_TEMPLATES.filter(
        (t) =>
          t.niches.includes(protocol.toLowerCase()) ||
          t.text.toLowerCase().includes(protocol.toLowerCase()),
      )
    : DEMO_POST_TEMPLATES;

  // If no matches for protocol, use all templates
  const templates = pool.length > 0 ? pool : DEMO_POST_TEMPLATES;

  for (let i = 0; i < limit && i < templates.length; i++) {
    const idx = (i + hourSlot) % templates.length;
    const template = templates[idx];
    if (!template) continue;
    posts.push(
      makePost(
        template.text,
        template.niches,
        i,
        i * 2 + 1, // spaced 2 hours apart
        100 - i * 5, // decreasing likes
        30 - i * 2,
        15 - i,
      ),
    );
  }

  return posts;
}
