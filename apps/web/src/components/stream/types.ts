/* === Extended Stream Types for Twitch-Quality Experience ===== */

export type StreamCategory =
  | 'gaming'
  | 'music'
  | 'crypto'
  | 'art'
  | 'irl'
  | 'talk'
  | 'education'
  | 'sports'
  | 'tech'
  | 'trading';

export interface StreamCategoryInfo {
  id: StreamCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const STREAM_CATEGORIES: StreamCategoryInfo[] = [
  { id: 'gaming', label: 'Gaming', icon: '🎮', color: '#9146FF', description: 'Video games and esports' },
  { id: 'music', label: 'Music', icon: '🎵', color: '#FF4081', description: 'Live music performances' },
  { id: 'crypto', label: 'Crypto & Web3', icon: '🪙', color: '#00ff41', description: 'Crypto, DeFi, and Web3' },
  { id: 'art', label: 'Art & Creative', icon: '🎨', color: '#FF6B35', description: 'Creative arts and design' },
  { id: 'irl', label: 'IRL & Lifestyle', icon: '🌍', color: '#00C853', description: 'Real life streaming' },
  { id: 'talk', label: 'Talk Shows & Podcasts', icon: '🎙️', color: '#FFD600', description: 'Conversations and interviews' },
  { id: 'education', label: 'Education', icon: '📚', color: '#2196F3', description: 'Learning and tutorials' },
  { id: 'sports', label: 'Sports', icon: '⚽', color: '#F44336', description: 'Sports and fitness' },
  { id: 'tech', label: 'Tech & Coding', icon: '💻', color: '#00BCD4', description: 'Technology and programming' },
  { id: 'trading', label: 'Trading', icon: '📈', color: '#4CAF50', description: 'Markets and trading' },
];

export function getCategoryInfo(id: string): StreamCategoryInfo {
  return STREAM_CATEGORIES.find((c) => c.id === id) ?? {
    id: id as StreamCategory,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    icon: '📡',
    color: '#888',
    description: '',
  };
}

/* === Stream Quality =========================================== */

export type StreamQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';

export interface QualityOption {
  id: StreamQuality;
  label: string;
  bitrate: string;
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { id: '1080p', label: '1080p', bitrate: '6 Mbps' },
  { id: '720p', label: '720p', bitrate: '3 Mbps' },
  { id: '480p', label: '480p', bitrate: '1.5 Mbps' },
  { id: '360p', label: '360p', bitrate: '800 Kbps' },
  { id: 'auto', label: 'Auto', bitrate: 'Adaptive' },
];

/* === Chat Types =============================================== */

export type ChatBadge = 'subscriber' | 'moderator' | 'vip' | 'og' | 'verified' | 'founder' | 'degen';

export interface BadgeInfo {
  id: ChatBadge;
  label: string;
  tooltip: string;
  color: string;
}

export const CHAT_BADGES: Record<ChatBadge, BadgeInfo> = {
  subscriber: { id: 'subscriber', label: 'SUB', tooltip: 'Subscriber', color: '#9146FF' },
  moderator: { id: 'moderator', label: 'MOD', tooltip: 'Moderator', color: '#00C853' },
  vip: { id: 'vip', label: 'VIP', tooltip: 'VIP', color: '#FFD600' },
  og: { id: 'og', label: 'OG', tooltip: 'Original Gangster', color: '#FF6B35' },
  verified: { id: 'verified', label: '✓', tooltip: 'Verified', color: '#2196F3' },
  founder: { id: 'founder', label: 'FOUNDER', tooltip: 'Founder', color: '#FF4081' },
  degen: { id: 'degen', label: 'DEGEN', tooltip: 'DegenFeed OG', color: '#00ff41' },
};

/* === Emote Types ============================================== */

export interface Emote {
  id: string;
  name: string;
  src: string;
  category?: string;
}

export const DEFAULT_EMOTES: Emote[] = [
  { id: 'e1', name: 'degenSmile', src: '😊', category: 'faces' },
  { id: 'e2', name: 'degenFire', src: '🔥', category: 'reactions' },
  { id: 'e3', name: 'degenMoon', src: '🚀', category: 'reactions' },
  { id: 'e4', name: 'degenLUL', src: '😂', category: 'faces' },
  { id: 'e5', name: 'degenW', src: '👋', category: 'greetings' },
  { id: 'e6', name: 'degenHeart', src: '❤️', category: 'reactions' },
  { id: 'e7', name: 'degenGlad', src: '😎', category: 'faces' },
  { id: 'e8', name: 'degenPray', src: '🙏', category: 'greetings' },
  { id: 'e9', name: 'degenClap', src: '👏', category: 'reactions' },
  { id: 'e10', name: 'degenRIP', src: '💀', category: 'reactions' },
  { id: 'e11', name: 'degenSip', src: '☕', category: 'reactions' },
  { id: 'e12', name: 'degenBull', src: '🐂', category: 'crypto' },
  { id: 'e13', name: 'degenBear', src: '🐻', category: 'crypto' },
  { id: 'e14', name: 'degenDiamond', src: '💎', category: 'crypto' },
  { id: 'e15', name: 'degenPE', src: '👀', category: 'faces' },
  { id: 'e16', name: 'degenBag', src: '💰', category: 'crypto' },
];

/* === Streamer Stats =========================================== */

export interface StreamerStats {
  followers: number;
  subscribers: number;
  totalViews: number;
  totalStreams: number;
  averageViewers: number;
  peakViewers: number;
  streamingSince: string;
}

/* === Extended Stream Info ===================================== */

export interface StreamExtended {
  id: string;
  title: string;
  creatorId: string;
  creatorHandle: string;
  creatorDisplayName: string;
  creatorAvatar?: string;
  creatorBanner?: string;
  category: StreamCategory;
  tags: string[];
  viewerCount: number;
  thumbnailUrl?: string;
  isLive: boolean;
  startedAt: number;
  description: string;
  stats: StreamerStats;
  isFollowing: boolean;
  isSubscribed: boolean;
  streamKey?: string;
  latency?: 'low' | 'normal';
}

/* === VOD / Clip Types ========================================= */

export interface VOD {
  id: string;
  title: string;
  thumbnailUrl?: string;
  duration: string;
  views: number;
  createdAt: string;
  streamId?: string;
}

export interface Clip {
  id: string;
  title: string;
  creatorHandle: string;
  thumbnailUrl?: string;
  views: number;
  duration: string;
  createdAt: string;
  slug: string;
}

export interface StreamSchedule {
  id: string;
  title: string;
  category: StreamCategory;
  scheduledAt: string;
  description?: string;
}

/* === Viewer Analytics ========================================= */

export interface ViewerAnalytics {
  peakViewers: number;
  averageViewers: number;
  totalUniqueViewers: number;
  watchTimeMinutes: number;
  newFollowers: number;
  newSubscribers: number;
  tipsReceived: number;
  topChatters: Array<{ handle: string; messages: number }>;
  viewerHistory: Array<{ timestamp: number; count: number }>;
}

/* === Mock Data Generator ====================================== */

const CATEGORIES: StreamCategory[] = [
  'gaming', 'music', 'crypto', 'art', 'irl', 'talk', 'education', 'sports', 'tech', 'trading',
];

const STREAM_TITLES: Record<StreamCategory, string[]> = {
  gaming: ['Elden Ring — No Hit Run', 'Valorant Ranked Grind', 'Minecraft Survival Series', 'Fortnite Zero Build Ws'],
  music: ['Lo-Fi Beats to DeFi To', 'Live Piano Improv', 'Producing a Beat from Scratch', 'Synthwave DJ Set'],
  crypto: ['DeFi Alpha Call — L2 Summer', 'Solana Ecosystem Deep Dive', 'BTC Post-Halving Analysis', 'Yield Farming Strategies'],
  art: ['Digital Painting Commission', 'Pixel Art Speed Build', '3D Modeling in Blender', 'Character Design Stream'],
  irl: ['Coffee & Code Morning Routine', 'Studio vlog — Build Day', 'Tokyo Walk & Talk', 'Desk Setup Tour'],
  talk: ['Crypto Twitter Roundtable', 'The Degen Chat Podcast', 'Interview with a Founder', 'AMA — Ask Me Anything'],
  education: ['React Masterclass', 'Solidity Smart Contracts 101', 'Python for Data Science', 'System Design Interview Prep'],
  sports: ['NBA 2K League Match', 'F1 Race Watchalong', 'FIFA Ultimate Team', 'Poker Night'],
  tech: ['Building a Full-Stack App Live', 'Linux Server Hardening', 'AI/ML Paper Review', 'Open Source Contribution'],
  trading: ['Day Trading S&P 500', 'Forex Analysis & Signals', 'Options Flow Deep Dive', 'Crypto Swing Trading'],
};

const CREATORS = [
  { id: 'c1', handle: 'defi_degen', display: 'DeFi Degen', avatar: '' },
  { id: 'c2', handle: 'sol_whale', display: 'Sol Whale', avatar: '' },
  { id: 'c3', handle: 'nft_collector', display: 'NFT Collector', avatar: '' },
  { id: 'c4', handle: 'crypto_analyst', display: 'Crypto Analyst', avatar: '' },
  { id: 'c5', handle: 'base_builder', display: 'Base Builder', avatar: '' },
  { id: 'c6', handle: 'meme_lord', display: 'Meme Lord', avatar: '' },
  { id: 'c7', handle: 'ai_researcher', display: 'AI Researcher', avatar: '' },
  { id: 'c8', handle: 'yield_farmer', display: 'Yield Farmer', avatar: '' },
  { id: 'c9', handle: 'code_ninja', display: 'Code Ninja', avatar: '' },
  { id: 'c10', handle: 'pixel_wizard', display: 'Pixel Wizard', avatar: '' },
  { id: 'c11', handle: 'beats_degen', display: 'Beats Degen', avatar: '' },
  { id: 'c12', handle: 'trade_master', display: 'Trade Master', avatar: '' },
];

export function generateMockStream(count = 16): StreamExtended[] {
  const streams: StreamExtended[] = [];
  for (let i = 0; i < count; i++) {
    const creator = CREATORS[i % CREATORS.length]!;
    const category = CATEGORIES[i % CATEGORIES.length]!;
    const titles = STREAM_TITLES[category]!;
    const title = titles[i % titles.length]!;
    streams.push({
      id: `stream-${i + 100}`,
      title,
      creatorId: creator.id,
      creatorHandle: creator.handle,
      creatorDisplayName: creator.display,
      creatorAvatar: creator.avatar,
      creatorBanner: undefined,
      category,
      tags: [category, 'live', 'degen', 'web3'],
      viewerCount: Math.floor(Math.random() * 5000) + 15,
      thumbnailUrl: undefined,
      isLive: true,
      startedAt: Date.now() - Math.floor(Math.random() * 7200000),
      description: `Join ${creator.display} for an amazing stream about ${category}! We'll be diving deep into the topic, answering questions, and having a great time. Don't forget to follow and subscribe!`,
      stats: {
        followers: Math.floor(Math.random() * 50000) + 100,
        subscribers: Math.floor(Math.random() * 5000) + 50,
        totalViews: Math.floor(Math.random() * 500000) + 1000,
        totalStreams: Math.floor(Math.random() * 200) + 5,
        averageViewers: Math.floor(Math.random() * 500) + 20,
        peakViewers: Math.floor(Math.random() * 3000) + 100,
        streamingSince: '2024-01-01',
      },
      isFollowing: Math.random() > 0.7,
      isSubscribed: Math.random() > 0.85,
      latency: (Math.random() > 0.8 ? 'low' : 'normal') as 'low' | 'normal',
    });
  }
  return streams;
}

export function generateMockVODs(count = 8): VOD[] {
  const titles = [
    'DeFi Deep Dive — Full Analysis',
    'Building on Base: Live Coding Session',
    'NFT Market Review — Weekly Roundup',
    'Trading Room: BTC Technical Analysis',
    'Interview with Solana Foundation',
    'Yield Farming Masterclass',
    'AI x Crypto Panel Discussion',
    'Wallet Security Best Practices',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `vod-${i + 1}`,
    title: titles[i % titles.length] ?? 'Past Broadcast',
    thumbnailUrl: undefined,
    duration: `${Math.floor(Math.random() * 3) + 1}h ${Math.floor(Math.random() * 60)}m`,
    views: Math.floor(Math.random() * 10000) + 100,
    createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
  }));
}

export function generateMockClips(count = 8): Clip[] {
  const titles = [
    'INSANE play in the final round!',
    'When he said "it\'s over" 😱',
    'Best moment of the stream',
    'This is why we love crypto',
    'UNREAL comeback!',
    'The chat went CRAZY',
    'Most wholesome moment',
    'Educational gold right here',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `clip-${i + 1}`,
    title: titles[i % titles.length] ?? 'Clip',
    creatorHandle: CREATORS[i % CREATORS.length]?.handle ?? 'unknown',
    thumbnailUrl: undefined,
    views: Math.floor(Math.random() * 50000) + 500,
    duration: `${Math.floor(Math.random() * 30) + 10}s`,
    createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    slug: `clip-${i + 1}-${Date.now()}`,
  }));
}

export function generateMockSchedule(): StreamSchedule[] {
  const now = Date.now();
  return [
    { id: 'sched-1', title: 'Weekly DeFi Roundup', category: 'crypto', scheduledAt: new Date(now + 86400000 * 2).toISOString(), description: 'Top DeFi news and analysis' },
    { id: 'sched-2', title: 'Live Coding: DEX on Base', category: 'tech', scheduledAt: new Date(now + 86400000 * 3).toISOString(), description: 'Building a decentralized exchange' },
    { id: 'sched-3', title: 'Gaming Night — Elden Ring', category: 'gaming', scheduledAt: new Date(now + 86400000).toISOString(), description: 'Late night gaming session' },
    { id: 'sched-4', title: 'Music Production Stream', category: 'music', scheduledAt: new Date(now + 86400000 * 4).toISOString(), description: 'Making lo-fi beats live' },
  ];
}
