/**
 * Shared fallback data for API routes.
 * Mirrors the FALLBACK_* data from workers/api/src/routes/*.ts
 * so the frontend renders content even without Cloudflare KV.
 */

import type { CustomFeed } from '@degenfeed/types';
import type { CrossProtocolCommunity } from '@degenfeed/utils';

// === Communities ================================================

export interface FeedItem {
  id: string;
  protocol: string;
  text: string;
  author: { displayName: string; handle: string; avatar?: string };
  createdAt: number;
  likes: number;
  replies: number;
}

export const MOCK_COMMUNITIES: CrossProtocolCommunity[] = [
  {
    id: 'crypto-general',
    name: 'crypto-general',
    displayName: 'Crypto General',
    description:
      'General discussion about cryptocurrencies, blockchain technology, and the decentralized web. All protocols welcome.',
    createdAt: Date.now() - 86400000 * 45,
    memberCount: 45200,
    postCount: 12300,
    creator: { walletAddress: '0x1234...5678', identities: {} },
    protocols: {
      lemmy: { communityUrl: 'https://lemmy.world/c/crypto', communityId: 101, members: 12000 },
      nostr: { relayUrl: 'wss://relay.degenfeed.xyz', topicTag: 'crypto' },
      farcaster: { channelId: 'crypto', channelUrl: 'https://warpcast.com/~/channel/crypto' },
    },
    tags: ['crypto', 'blockchain', 'web3'],
  },
  {
    id: 'defi-degens',
    name: 'defi-degens',
    displayName: 'DeFi Degens',
    description:
      'Yield farming, liquidity pools, DEX trading, and all things DeFi. Share your strategies and apes.',
    createdAt: Date.now() - 86400000 * 30,
    memberCount: 28100,
    postCount: 8500,
    creator: { walletAddress: '0xabcd...ef01', identities: {} },
    protocols: {
      lemmy: { communityUrl: 'https://lemmy.world/c/defi', communityId: 102, members: 8000 },
      nostr: { relayUrl: 'wss://relay.degenfeed.xyz', topicTag: 'defi' },
      mastodon: { hashtag: 'defi', groupHandle: '@defi@social.degenfeed.xyz' },
    },
    tags: ['defi', 'yield', 'liquidity'],
  },
  {
    id: 'nft-collectors',
    name: 'nft-collectors',
    displayName: 'NFT Collectors',
    description:
      'NFT art, collectibles, PFPs, and digital ownership. Discuss drops, mints, and market trends.',
    createdAt: Date.now() - 86400000 * 60,
    memberCount: 18500,
    postCount: 6700,
    creator: { walletAddress: '0x9876...5432', identities: {} },
    protocols: {
      farcaster: { channelId: 'nfts', channelUrl: 'https://warpcast.com/~/channel/nfts' },
      bluesky: { feedUri: 'at://feed/nfts', feedName: 'NFT Collectors' },
      lens: { profileId: '0x01' },
    },
    tags: ['nft', 'art', 'collectibles'],
  },
  {
    id: 'solana-ecosystem',
    name: 'solana-ecosystem',
    displayName: 'Solana Ecosystem',
    description: 'Everything Solana: development, dApps, SPL tokens, and ecosystem news.',
    createdAt: Date.now() - 86400000 * 20,
    memberCount: 22300,
    postCount: 9800,
    creator: { walletAddress: '0xdef0...1234', identities: {} },
    protocols: {
      nostr: { relayUrl: 'wss://relay.degenfeed.xyz', topicTag: 'solana' },
      farcaster: { channelId: 'solana', channelUrl: 'https://warpcast.com/~/channel/solana' },
    },
    tags: ['solana', 'spl', 'serum'],
  },
  {
    id: 'ethereum-stakers',
    name: 'ethereum-stakers',
    displayName: 'Ethereum Stakers',
    description:
      'ETH staking, validator operations, MEV, and L2 discussions for the Ethereum community.',
    createdAt: Date.now() - 86400000 * 35,
    memberCount: 15200,
    postCount: 4200,
    creator: { walletAddress: '0x5678...9012', identities: {} },
    protocols: {
      lemmy: { communityUrl: 'https://lemmy.world/c/ethstaker', communityId: 103, members: 5000 },
      mastodon: { hashtag: 'ethstaker', groupHandle: '@ethstaker@social.degenfeed.xyz' },
    },
    tags: ['ethereum', 'staking', 'eth2'],
  },
  {
    id: 'ai-crypto',
    name: 'ai-crypto',
    displayName: 'AI × Crypto',
    description:
      'Intersection of artificial intelligence and blockchain — AI agents, decentralized compute, and more.',
    createdAt: Date.now() - 86400000 * 15,
    memberCount: 12400,
    postCount: 5600,
    creator: { walletAddress: '0x3456...7890', identities: {} },
    protocols: {
      nostr: { relayUrl: 'wss://relay.degenfeed.xyz', topicTag: 'ai-crypto' },
      bluesky: { feedUri: 'at://feed/ai-crypto', feedName: 'AI × Crypto' },
      lens: { profileId: '0x02' },
    },
    tags: ['ai', 'ml', 'decentralized-compute'],
  },
];

export const MOCK_FEED_ITEMS: Record<string, FeedItem[]> = {
  'crypto-general': [
    {
      id: 'p1',
      protocol: 'farcaster',
      text: 'Bitcoin dominance is at 58% — alt season incoming? 🚀 The rotation from BTC to alts historically happens when BTC dominance peaks. Keep an eye on ETH/BTC ratio.',
      author: { displayName: 'Crypto Analyst', handle: 'cryptoan@fcast' },
      createdAt: Date.now() - 3600000,
      likes: 234,
      replies: 56,
    },
    {
      id: 'p2',
      protocol: 'nostr',
      text: 'Just published my research on L2 scaling solutions. TL;DR: Arbitrum leads in TVL, Base in daily active users, Optimism in developer activity. Full thread below.',
      author: { displayName: 'L2 Researcher', handle: 'l2res@nostr' },
      createdAt: Date.now() - 7200000,
      likes: 189,
      replies: 43,
    },
    {
      id: 'p3',
      protocol: 'lemmy',
      text: "Hot take: USDC is more decentralized than most people think. Circle's multi-chain strategy and Basel III compliance actually matter. Discussion thread.",
      author: { displayName: 'Stablecoin Maxi', handle: 'stablemax@lemmy' },
      createdAt: Date.now() - 14400000,
      likes: 156,
      replies: 89,
    },
    {
      id: 'p4',
      protocol: 'bluesky',
      text: "The Fed pivot narrative is real. Rate cuts = liquidity injection = crypto pumps. History doesn't repeat but it often rhymes. 📈",
      author: { displayName: 'Macro Degen', handle: 'macroden@bsky' },
      createdAt: Date.now() - 21600000,
      likes: 312,
      replies: 67,
    },
    {
      id: 'p5',
      protocol: 'mastodon',
      text: 'Daily DCA thread for July 18, 2026. Stacking sats: 0.001 BTC, 0.1 ETH, 50 SOL. What are you buying today?',
      author: { displayName: 'DCA Bot', handle: 'dcabot@mastodon' },
      createdAt: Date.now() - 28800000,
      likes: 89,
      replies: 34,
    },
  ],
};

export function getMockFeed(communityName: string): FeedItem[] {
  return (
    MOCK_FEED_ITEMS[communityName] ?? [
      {
        id: 'f1',
        protocol: 'farcaster',
        text: 'Welcome to the community! Cross-protocol posts from Nostr, Farcaster, Lens, Bluesky, and Mastodon appear here.',
        author: { displayName: 'DegenFeed', handle: 'degenfeed@fcast' },
        createdAt: Date.now() - 60000,
        likes: 42,
        replies: 7,
      },
      {
        id: 'f2',
        protocol: 'nostr',
        text: 'This community is active across 6 protocols. Post from any network and it shows up here. 🤯',
        author: { displayName: 'Community Bot', handle: 'cmbot@nostr' },
        createdAt: Date.now() - 120000,
        likes: 28,
        replies: 5,
      },
    ]
  );
}

// === Spaces ====================================================

export interface SpaceItem {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  scheduledAt?: string;
  listeners: number;
  speakers: Array<{
    id: string;
    displayName: string;
    avatarUrl?: string;
    handle?: string;
    isHost: boolean;
    isCoHost: boolean;
    speaking: boolean;
  }>;
  reactions: Array<{ userId: string; emoji: string; createdAt: number }>;
  tipTokenAddress?: string;
  tippingEnabled: boolean;
}

export const MOCK_LIVE_SPACES: SpaceItem[] = [
  {
    id: 'space-live-1',
    title: 'DeFi Deep Dive — L2 Summer 2026',
    description: 'Discussing the state of L2s, Base vs Arbitrum, and what comes next.',
    hostId: 'host1',
    hostName: 'DeFi Degen',
    hostAvatarUrl: '',
    coHosts: ['cohost1'],
    protocols: ['farcaster', 'nostr'],
    status: 'live',
    createdAt: Date.now() - 1800000,
    listeners: 342,
    speakers: [
      { id: 'host1', displayName: 'DeFi Degen', isHost: true, isCoHost: false, speaking: true },
      {
        id: 'sp1',
        displayName: 'L2 Maxi',
        handle: 'l2maxi',
        isHost: false,
        isCoHost: true,
        speaking: false,
      },
    ],
    reactions: [{ userId: 'u1', emoji: '🔥', createdAt: Date.now() - 60000 }],
    tippingEnabled: true,
  },
  {
    id: 'space-live-2',
    title: 'Solana Ecosystem Call — Breakpoint Recap',
    description: 'Community call discussing Breakpoint announcements and ecosystem updates.',
    hostId: 'host2',
    hostName: 'Solana Whale',
    hostAvatarUrl: '',
    coHosts: [],
    protocols: ['solana', 'nostr'],
    status: 'live',
    createdAt: Date.now() - 3600000,
    listeners: 218,
    speakers: [
      { id: 'host2', displayName: 'Solana Whale', isHost: true, isCoHost: false, speaking: false },
    ],
    reactions: [],
    tippingEnabled: true,
  },
  {
    id: 'space-live-3',
    title: 'NFT Market Cool-Off — Buy the Dip?',
    description:
      'Is this the right time to accumulate blue chip NFTs? Market analysis and discussion.',
    hostId: 'host3',
    hostName: 'NFT Collector',
    hostAvatarUrl: '',
    coHosts: [],
    protocols: ['ethereum', 'bluesky'],
    status: 'live',
    createdAt: Date.now() - 7200000,
    listeners: 156,
    speakers: [
      { id: 'host3', displayName: 'NFT Collector', isHost: true, isCoHost: false, speaking: true },
    ],
    reactions: [],
    tippingEnabled: false,
  },
];

export const MOCK_UPCOMING_SPACES: SpaceItem[] = [
  {
    id: 'space-up-1',
    title: 'Bitcoin 2026 — Post-Halving Analysis',
    description:
      'Expert panel discussing Bitcoin post-halving dynamics and institutional adoption.',
    hostId: 'host4',
    hostName: 'BTC Maxi',
    hostAvatarUrl: '',
    coHosts: [],
    protocols: ['nostr', 'farcaster'],
    status: 'scheduled',
    createdAt: Date.now(),
    scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    listeners: 0,
    speakers: [],
    reactions: [],
    tippingEnabled: true,
  },
  {
    id: 'space-up-2',
    title: 'Building on Base — Dev Workshop',
    description: 'Live coding session building a DEX on Base. Bring your laptop!',
    hostId: 'host5',
    hostName: 'Base Builder',
    hostAvatarUrl: '',
    coHosts: [],
    protocols: ['ethereum', 'farcaster'],
    status: 'scheduled',
    createdAt: Date.now(),
    scheduledAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    listeners: 0,
    speakers: [],
    reactions: [],
    tippingEnabled: true,
  },
];

// === Leaderboard ===============================================

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  handle: string;
  avatarUrl: string;
  platform: string;
  platforms: string[];
  tipsReceived: number;
  tipsSent: number;
  followerCount: number;
  postCount: number;
  change: number;
}

export interface TrendingEntry {
  id: string;
  rank: number;
  title: string;
  platform: string;
  url: string;
  engagementScore: number;
  tipCount: number;
  tipTotal: number;
  change: number;
  authorName: string;
  authorAvatar: string;
}

export interface CommunityEntry {
  id: string;
  rank: number;
  name: string;
  icon: string;
  platform: string;
  memberCount: number;
  postCount: number;
  tipCount: number;
  tipTotal: number;
  change: number;
}

export const MOCK_CREATORS: LeaderboardEntry[] = [
  {
    id: 'c1',
    rank: 1,
    name: 'Vitalik Buterin',
    handle: 'vitalik.eth',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'farcaster'],
    tipsReceived: 42500,
    tipsSent: 12000,
    followerCount: 2400000,
    postCount: 8432,
    change: 2,
  },
  {
    id: 'c2',
    rank: 2,
    name: 'Crypto Whaler',
    handle: 'whaler@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'lemmy'],
    tipsReceived: 31200,
    tipsSent: 8900,
    followerCount: 156000,
    postCount: 3211,
    change: 5,
  },
  {
    id: 'c3',
    rank: 3,
    name: 'DeFi Degen',
    handle: 'defidegen@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 28750,
    tipsSent: 15400,
    followerCount: 89000,
    postCount: 1876,
    change: -1,
  },
  {
    id: 'c4',
    rank: 4,
    name: 'Lemmy Farmer',
    handle: 'farmer@lemmy.world',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 18300,
    tipsSent: 4200,
    followerCount: 12500,
    postCount: 4567,
    change: 8,
  },
  {
    id: 'c5',
    rank: 5,
    name: 'PeerTube Star',
    handle: 'starlight@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 15900,
    tipsSent: 6100,
    followerCount: 45000,
    postCount: 234,
    change: 3,
  },
  {
    id: 'c6',
    rank: 6,
    name: 'Meme Lord',
    handle: 'memelord@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'lemmy', 'peertube'],
    tipsReceived: 12400,
    tipsSent: 22100,
    followerCount: 67000,
    postCount: 892,
    change: 12,
  },
];

export const MOCK_TIPPERS: LeaderboardEntry[] = [
  {
    id: 't1',
    rank: 1,
    name: 'Generous Whale',
    handle: 'whale@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed'],
    tipsReceived: 2100,
    tipsSent: 89000,
    followerCount: 12000,
    postCount: 89,
    change: 1,
  },
  {
    id: 't2',
    rank: 2,
    name: 'Degen Angel',
    handle: 'angel@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'farcaster'],
    tipsReceived: 800,
    tipsSent: 65400,
    followerCount: 8500,
    postCount: 45,
    change: 4,
  },
  {
    id: 't3',
    rank: 3,
    name: 'Tip King',
    handle: 'tipking@lemmy.world',
    avatarUrl: '',
    platform: 'lemmy',
    platforms: ['lemmy'],
    tipsReceived: 350,
    tipsSent: 52100,
    followerCount: 3200,
    postCount: 234,
    change: -2,
  },
  {
    id: 't4',
    rank: 4,
    name: 'Generous Soul',
    handle: 'soul@degenfeed.xyz',
    avatarUrl: '',
    platform: 'degenfeed',
    platforms: ['degenfeed', 'peertube'],
    tipsReceived: 1200,
    tipsSent: 41000,
    followerCount: 6700,
    postCount: 167,
    change: 7,
  },
  {
    id: 't5',
    rank: 5,
    name: 'Micro Tipper',
    handle: 'micro@peertube.tv',
    avatarUrl: '',
    platform: 'peertube',
    platforms: ['peertube'],
    tipsReceived: 100,
    tipsSent: 34200,
    followerCount: 1200,
    postCount: 34,
    change: 11,
  },
];

export const MOCK_TRENDING: Record<string, TrendingEntry[]> = {
  daily: [
    {
      id: 'td1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 98500,
      tipCount: 342,
      tipTotal: 12400,
      change: 15,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'td2',
      rank: 2,
      title: 'I built a DeFi yield aggregator in Rust',
      platform: 'lemmy',
      url: '/post/rust-yield-1',
      engagementScore: 72100,
      tipCount: 189,
      tipTotal: 8200,
      change: 8,
      authorName: 'Rust Degen',
      authorAvatar: '',
    },
    {
      id: 'td3',
      rank: 3,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 65800,
      tipCount: 267,
      tipTotal: 15100,
      change: 22,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'td4',
      rank: 4,
      title: 'Meme coin season is back? 🐸',
      platform: 'degenfeed',
      url: '/post/meme-season-1',
      engagementScore: 54200,
      tipCount: 156,
      tipTotal: 4800,
      change: -3,
      authorName: 'Meme Lord',
      authorAvatar: '',
    },
  ],
  weekly: [
    {
      id: 'tw1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 580000,
      tipCount: 2100,
      tipTotal: 89000,
      change: 42,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'tw2',
      rank: 2,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 420000,
      tipCount: 1800,
      tipTotal: 95000,
      change: 28,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
    {
      id: 'tw3',
      rank: 3,
      title: 'How to spot a crypto scam in 2026',
      platform: 'lemmy',
      url: '/post/scam-spotting',
      engagementScore: 380000,
      tipCount: 1200,
      tipTotal: 34000,
      change: 15,
      authorName: 'News Hub',
      authorAvatar: '',
    },
  ],
  monthly: [
    {
      id: 'tm1',
      rank: 1,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 2100000,
      tipCount: 8400,
      tipTotal: 320000,
      change: 55,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
    {
      id: 'tm2',
      rank: 2,
      title: 'Ethereum Pectra upgrade explained simply',
      platform: 'peertube',
      url: '/post/pectra-video-1',
      engagementScore: 1800000,
      tipCount: 6200,
      tipTotal: 280000,
      change: 32,
      authorName: 'PeerTube Star',
      authorAvatar: '',
    },
  ],
  alltime: [
    {
      id: 'ta1',
      rank: 1,
      title: 'How DegenFeed unifies 7 social protocols',
      platform: 'degenfeed',
      url: '/post/df-unified',
      engagementScore: 5200000,
      tipCount: 12000,
      tipTotal: 890000,
      change: 3,
      authorName: 'DegenFeed Team',
      authorAvatar: '',
    },
    {
      id: 'ta2',
      rank: 2,
      title: 'Solana breaks $300 — new ATH',
      platform: 'degenfeed',
      url: '/post/sol-ath-1',
      engagementScore: 4800000,
      tipCount: 15000,
      tipTotal: 720000,
      change: 55,
      authorName: 'Crypto Whaler',
      authorAvatar: '',
    },
  ],
};

export const MOCK_COMMUNITIES_LB: CommunityEntry[] = [
  {
    id: 'lc1',
    rank: 1,
    name: 'Crypto General',
    icon: '₿',
    platform: 'degenfeed',
    memberCount: 45000,
    postCount: 12000,
    tipCount: 8400,
    tipTotal: 340000,
    change: 5,
  },
  {
    id: 'lc2',
    rank: 2,
    name: 'DeFi Degens',
    icon: '📊',
    platform: 'degenfeed',
    memberCount: 28000,
    postCount: 8500,
    tipCount: 6200,
    tipTotal: 280000,
    change: 12,
  },
  {
    id: 'lc3',
    rank: 3,
    name: 'Lemmy Crypto',
    icon: 'L',
    platform: 'lemmy',
    memberCount: 22000,
    postCount: 15000,
    tipCount: 4100,
    tipTotal: 120000,
    change: -2,
  },
  {
    id: 'lc4',
    rank: 4,
    name: 'Video Creators',
    icon: '▶',
    platform: 'peertube',
    memberCount: 12000,
    postCount: 3200,
    tipCount: 3800,
    tipTotal: 190000,
    change: 8,
  },
  {
    id: 'lc5',
    rank: 5,
    name: 'Meme Economy',
    icon: '🐸',
    platform: 'degenfeed',
    memberCount: 18000,
    postCount: 6700,
    tipCount: 5600,
    tipTotal: 145000,
    change: 3,
  },
];

// === Trending Topics ===========================================

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

export const MOCK_TRENDING_TOPICS: TrendingTopic[] = [
  { topic: 'Bitcoin', count: 12500, score: 98500 },
  { topic: 'Solana', count: 9800, score: 72100 },
  { topic: 'Ethereum', count: 8700, score: 65400 },
  { topic: 'DeFi', count: 7200, score: 54300 },
  { topic: 'AI', count: 6800, score: 51200 },
  { topic: 'NFT', count: 5400, score: 42300 },
  { topic: 'Layer 2', count: 4900, score: 38700 },
  { topic: 'Memecoin', count: 4500, score: 35600 },
  { topic: 'Stablecoin', count: 3800, score: 29800 },
  { topic: 'Regulation', count: 3400, score: 26700 },
  { topic: 'Security', count: 2900, score: 23400 },
  { topic: 'ETF', count: 2600, score: 21000 },
];

// === Custom Feeds ==============================================

export const MOCK_MY_FEEDS: CustomFeed[] = [
  {
    id: 'feed-1',
    name: 'Crypto Alpha',
    description: 'High-signal crypto content from Nostr, Farcaster, and Lens',
    creator: '0xuser',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'lens'] as const,
      topics: { crypto: 100 },
      contentTypes: ['text'],
      minEngagement: 10,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now(),
    subscribers: 234,
  },
  {
    id: 'feed-2',
    name: 'DeFi Watch',
    description: 'All DeFi-related posts with high engagement',
    creator: '0xuser',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'lemmy'] as const,
      topics: { defi: 100 },
      contentTypes: ['text', 'link'],
      minEngagement: 20,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now(),
    subscribers: 89,
  },
  {
    id: 'feed-3',
    name: 'Private Research',
    description: 'Personal research feed — not public',
    creator: '0xuser',
    isPublic: false,
    config: {
      sources: ['nostr'] as const,
      topics: { research: 100 },
      contentTypes: ['text'],
      minEngagement: 0,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now(),
    subscribers: 0,
  },
  {
    id: 'feed-4',
    name: 'Video Roundup',
    description: 'Best crypto videos from PeerTube and YouTube',
    creator: '0xuser',
    isPublic: true,
    config: {
      sources: ['peertube', 'youtube'] as const,
      topics: { crypto: 80, defi: 60 },
      contentTypes: ['video'],
      minEngagement: 50,
      excludeTopics: ['memes'],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
    subscribers: 412,
  },
];

export const MOCK_PUBLIC_FEEDS: CustomFeed[] = [
  {
    id: 'pub-1',
    name: 'Degen Daily',
    description: 'Curated daily digest of the best crypto content across all protocols',
    creator: '0xdegen',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'lens', 'bluesky', 'reddit'] as const,
      topics: { crypto: 100 },
      contentTypes: ['text', 'link', 'image'],
      minEngagement: 5,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now(),
    subscribers: 15200,
  },
  {
    id: 'pub-2',
    name: 'Solana Ecosystem',
    description: 'Everything Solana — development, dApps, ecosystem news',
    creator: '0xsolana',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'reddit'] as const,
      topics: { solana: 100, defi: 80 },
      contentTypes: ['text', 'link', 'video'],
      minEngagement: 3,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now(),
    subscribers: 8900,
  },
  {
    id: 'pub-3',
    name: 'NFT Alpha',
    description: 'NFT mints, flips, and market analysis from top collectors',
    creator: '0xnft',
    isPublic: true,
    config: {
      sources: ['farcaster', 'bluesky', 'lens'] as const,
      topics: { nft: 100, art: 80 },
      contentTypes: ['text', 'image'],
      minEngagement: 10,
      excludeTopics: ['spam'],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
    subscribers: 5600,
  },
  {
    id: 'pub-4',
    name: 'AI × Crypto',
    description: 'Latest at the intersection of AI and blockchain technology',
    creator: '0xai',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'reddit', 'rss'] as const,
      topics: { ai: 100, crypto: 80 },
      contentTypes: ['text', 'link', 'video'],
      minEngagement: 5,
      excludeTopics: [],
      excludeWords: [],
    },
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now(),
    subscribers: 3400,
  },
  {
    id: 'pub-5',
    name: 'DeFi Yields',
    description: 'Track the best yield farming opportunities across all chains',
    creator: '0xdefi',
    isPublic: true,
    config: {
      sources: ['nostr', 'farcaster', 'lemmy'] as const,
      topics: { defi: 100, yield: 100 },
      contentTypes: ['text', 'link'],
      minEngagement: 0,
      excludeTopics: [],
      excludeWords: ['scam', 'rug'],
    },
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now(),
    subscribers: 2100,
  },
];
