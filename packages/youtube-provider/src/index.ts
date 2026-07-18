/**
 * @degenfeed/youtube-provider
 *
 * Fetches YouTube video metadata from RSS feeds of curated crypto channels.
 * Returns normalized VideoItem[] suitable for rendering in the /videos grid.
 *
 * Falls back to the YouTube Data API if RSS is unavailable (not implemented yet).
 */

// ─── Types ───────────────────────────────────────────────────────────

export type ChannelCategory =
  | 'market_analysis'
  | 'defi'
  | 'trading'
  | 'nft_gaming'
  | 'macro_bitcoin'
  | 'security_tech';

export interface YouTubeVideoItem {
  id: string;
  title: string;
  channelName: string;
  channelUrl: string;
  thumbnailUrl: string;
  url: string;
  publishedAt: string;
  publishedMs: number;
  duration?: string;
  views?: number;
  description?: string;
  category?: string;
  channelCategory?: ChannelCategory;
  channelWeight?: number;
  niches?: string[];
  source: 'youtube';
}

export interface YouTubeChannel {
  name: string;
  feed: string;
  channelId?: string;
  /** Primary category for quality-weighting and filtering */
  category: ChannelCategory;
  /** Quality weight 0.0–1.0 — higher = more relevant for our audience */
  weight: number;
  /** DegenFeed niche tags for discovery and topic routing */
  niches: string[];
}

// ─── Quality filter constants ────────────────────────────────────────

export const QUALITY_FILTERS = {
  /** Max age in days — anything older is excluded */
  MAX_AGE_DAYS: 7,
  /** Shorts shorter than this (seconds) are filtered out */
  SHORTS_MAX_DURATION: 60,
  /** Minimum views threshold (requires Data API; RSS doesn't provide this) */
  MIN_VIEWS: 1000,
  /** Channels exempt from livestream filtering (high-value commentary) */
  LIVESTREAM_EXEMPT_CHANNELS: [
    'Bankless',
    'Coin Bureau',
    'a16z Crypto',
    'Andrei Jikh',
    'Benjamin Cowen',
    'InvestAnswers',
  ] as readonly string[],
};

// ─── Curated crypto YouTube channels ──────────────────────────────────

export const CRYPTO_CHANNELS: YouTubeChannel[] = [
  // ── Market Analysis / Daily News (weight: 1.0) ────────────────────
  {
    name: 'Bankless',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCAl9Ld79qaZxp9JzEOwd3aA',
    channelId: 'UCAl9Ld79qaZxp9JzEOwd3aA',
    category: 'market_analysis',
    weight: 1.0,
    niches: ['crypto', 'defi', 'macro', 'ethereum'],
  },
  {
    name: 'Coin Bureau',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw',
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    category: 'market_analysis',
    weight: 1.0,
    niches: ['crypto', 'defi', 'macro', 'bitcoin'],
  },
  {
    name: 'Altcoin Daily',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbLhGKVY-bJPcawebgtNfbw',
    channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
    category: 'market_analysis',
    weight: 1.0,
    niches: ['crypto', 'altcoins', 'news'],
  },
  {
    name: 'Crypto Banter',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCN9Nj4tjXbVTLYWN0EKlylQ',
    channelId: 'UCN9Nj4tjXbVTLYWN0EKlylQ',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'news', 'trading'],
  },
  {
    name: 'Unchained Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWiiMnsnw5Isc2PP1to9nNw',
    channelId: 'UCWiiMnsnw5Isc2PP1to9nNw',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'news', 'interviews'],
  },
  {
    name: 'Cointelegraph',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCV0XLtgVhDYyFRB-HpHkXbQ',
    channelId: 'UCV0XLtgVhDYyFRB-HpHkXbQ',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'news', 'bitcoin', 'regulation'],
  },
  {
    name: 'CoinDesk',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCeU2Fg3fDgQTMOdT6zRqL9g',
    channelId: 'UCeU2Fg3fDgQTMOdT6zRqL9g',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'news', 'bitcoin', 'markets'],
  },
  {
    name: 'Benjamin Cowen',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCRvqjQPSeaWn-uEx-w0XOIg',
    channelId: 'UCRvqjQPSeaWn-uEx-w0XOIg',
    category: 'market_analysis',
    weight: 1.0,
    niches: ['trading', 'bitcoin', 'macro', 'onchain'],
  },
  {
    name: 'InvestAnswers',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9z0i47pv7PvZz1W2mI_UiA',
    channelId: 'UC9z0i47pv7PvZz1W2mI_UiA',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'macro', 'trading', 'bitcoin'],
  },
  {
    name: 'DataDash',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCatR7nWbYrkVXdxXb4cGXw',
    channelId: 'UCCatR7nWbYrkVXdxXb4cGXw',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['crypto', 'macro', 'bitcoin', 'ethereum'],
  },
  {
    name: 'Into The Cryptoverse',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnC0j5jeEi8q7F0z_JyXbGw',
    channelId: 'UCnC0j5jeEi8q7F0z_JyXbGw',
    category: 'market_analysis',
    weight: 0.8,
    niches: ['crypto', 'macro', 'trading'],
  },
  {
    name: 'Savvy Finance',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCkH2fkUhDjZ2o13TCFPYPXg',
    channelId: 'UCkH2fkUhDjZ2o13TCFPYPXg',
    category: 'market_analysis',
    weight: 0.7,
    niches: ['crypto', 'news', 'defi'],
  },
  {
    name: 'Thinking Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1eRVoBfyUYQvsG8k42ksjQ',
    channelId: 'UC1eRVoBfyUYQvsG8k42ksjQ',
    category: 'market_analysis',
    weight: 0.8,
    niches: ['crypto', 'news', 'interviews', 'regulation'],
  },
  {
    name: 'Anthony Pompliano',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6rD0j7TQ5Rg0zKjV1V6v2g',
    channelId: 'UC6rD0j7TQ5Rg0zKjV1V6v2g',
    category: 'market_analysis',
    weight: 0.9,
    niches: ['macro', 'bitcoin', 'crypto', 'investing'],
  },

  // ── DeFi / Protocol Deep Dives (weight: 0.9) ──────────────────────
  {
    name: 'Finematics',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCn2cHmXby69CRaR5eowM7lQ',
    channelId: 'UCn2cHmXby69CRaR5eowM7lQ',
    category: 'defi',
    weight: 0.9,
    niches: ['defi', 'layer2', 'ethereum', 'tutorial'],
  },
  {
    name: 'Whiteboard Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC5sYBAiOnT4v0QBseBRh_sg',
    channelId: 'UC5sYBAiOnT4v0QBseBRh_sg',
    category: 'defi',
    weight: 0.8,
    niches: ['crypto', 'defi', 'tutorial', 'blockchain'],
  },
  {
    name: 'DeFi Dad',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZRhDKYWrRiUTsY4Y3stYQA',
    channelId: 'UCZRhDKYWrRiUTsY4Y3stYQA',
    category: 'defi',
    weight: 0.8,
    niches: ['defi', 'ethereum', 'yield', 'liquidity'],
  },
  {
    name: 'a16z Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8gx6RzYYdqWB3K_dKsC6kQ',
    channelId: 'UC8gx6RzYYdqWB3K_dKsC6kQ',
    category: 'defi',
    weight: 0.9,
    niches: ['crypto', 'defi', 'web3', 'vc'],
  },
  {
    name: 'The Defiant',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCL0iXkca1rL9K8Yf1Ae1EMg',
    channelId: 'UCL0iXkca1rL9K8Yf1Ae1EMg',
    category: 'defi',
    weight: 0.8,
    niches: ['defi', 'news', 'ethereum', 'nft'],
  },
  {
    name: 'Taiki Maeda',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCS43gI19p2Mx8qKjM7Q2oXA',
    channelId: 'UCS43gI19p2Mx8qKjM7Q2oXA',
    category: 'defi',
    weight: 0.7,
    niches: ['defi', 'yield', 'liquidity', 'trading'],
  },
  {
    name: 'Thor Hartvigsen',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqUftnL8c1q0pLCKKRao4Mg',
    channelId: 'UCqUftnL8c1q0pLCKKRao4Mg',
    category: 'defi',
    weight: 0.7,
    niches: ['defi', 'onchain', 'degen', 'alpha'],
  },
  {
    name: 'Justin Bram',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCkMHO_hk_3NQ1rEQCpAEl_g',
    channelId: 'UCkMHO_hk_3NQ1rEQCpAEl_g',
    category: 'defi',
    weight: 0.7,
    niches: ['defi', 'real-world-assets', 'tokenization'],
  },

  // ── Trading / Technical Analysis (weight: 0.7) ────────────────────
  {
    name: 'CryptoCred',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCDz981NTNU4rkjqG8x7JfTA',
    channelId: 'UCDz981NTNU4rkjqG8x7JfTA',
    category: 'trading',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'futures'],
  },
  {
    name: 'Alessio Rastani',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCspSuakPflnSMJwBOm7Rvdw',
    channelId: 'UCspSuakPflnSMJwBOm7Rvdw',
    category: 'trading',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'macro', 'bitcoin'],
  },
  {
    name: 'The Trading Channel',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCz9x1ZMPnT5q8jIcLxTHW1g',
    channelId: 'UCz9x1ZMPnT5q8jIcLxTHW1g',
    category: 'trading',
    weight: 0.7,
    niches: ['trading', 'technical-analysis', 'crypto', 'stocks'],
  },
  {
    name: 'Mitch Ray',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCd9FrBp7CV9ZRvqNtFgG5Uw',
    channelId: 'UCd9FrBp7CV9ZRvqNtFgG5Uw',
    category: 'trading',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'altcoins'],
  },
  {
    name: 'Folding Stock',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCw8mYhF2FmTz0jK0G8z1D0A',
    channelId: 'UCw8mYhF2FmTz0jK0G8z1D0A',
    category: 'trading',
    weight: 0.7,
    niches: ['trading', 'options', 'bitcoin', 'ethereum'],
  },

  // ── NFT / Gaming / Web3 (weight: 0.6) ─────────────────────────────
  {
    name: 'Giancarlo',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCzV3OT7h55QD9q2QAgB1iOw',
    channelId: 'UCzV3OT7h55QD9q2QAgB1iOw',
    category: 'nft_gaming',
    weight: 0.6,
    niches: ['nft', 'gaming', 'web3', 'metaverse'],
  },
  {
    name: 'NFT Simplified',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW7EZ9sEIsyGqHlJFQx0Dag',
    channelId: 'UCW7EZ9sEIsyGqHlJFQx0Dag',
    category: 'nft_gaming',
    weight: 0.6,
    niches: ['nft', 'tutorial', 'collectibles', 'art'],
  },
  {
    name: 'Brypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UClqFuU6N_n6plK7w_wFkW_Q',
    channelId: 'UClqFuU6N_n6plK7w_wFkW_Q',
    category: 'nft_gaming',
    weight: 0.5,
    niches: ['nft', 'gaming', 'web3', 'reviews'],
  },
  {
    name: 'Cirrus',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC1ehVFaiXhBpYXYMu8YQmMQ',
    channelId: 'UC1ehVFaiXhBpYXYMu8YQmMQ',
    category: 'nft_gaming',
    weight: 0.6,
    niches: ['nft', 'gaming', 'web3', 'metaverse'],
  },
  {
    name: 'NFT Evening',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtMZnNQo4WnKs8o47QPCq4g',
    channelId: 'UCtMZnNQo4WnKs8o47QPCq4g',
    category: 'nft_gaming',
    weight: 0.5,
    niches: ['nft', 'news', 'collectibles', 'art'],
  },

  // ── Macro / Bitcoin (weight: 0.8) ─────────────────────────────────
  {
    name: 'Andrei Jikh',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCTZMRH9npOQxoKCeExhHZEA',
    channelId: 'UCTZMRH9npOQxoKCeExhHZEA',
    category: 'macro_bitcoin',
    weight: 0.8,
    niches: ['bitcoin', 'macro', 'personal-finance', 'investing'],
  },
  {
    name: 'Mark Moss',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZO1Cs7iN3pZc6t5vM5J0EA',
    channelId: 'UCZO1Cs7iN3pZc6t5vM5J0EA',
    category: 'macro_bitcoin',
    weight: 0.8,
    niches: ['macro', 'bitcoin', 'economy', 'investing'],
  },
  {
    name: 'British HODL',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCk3y2GtdStFaQcMkTpNjfIQ',
    channelId: 'UCk3y2GtdStFaQcMkTpNjfIQ',
    category: 'macro_bitcoin',
    weight: 0.7,
    niches: ['bitcoin', 'macro', 'crypto', 'news'],
  },
  {
    name: 'Crypto Casey',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCW8zQLw5KQ3F4KgeJzxJ7jA',
    channelId: 'UCW8zQLw5KQ3F4KgeJzxJ7jA',
    category: 'macro_bitcoin',
    weight: 0.8,
    niches: ['bitcoin', 'crypto', 'tutorial', 'passive-income'],
  },

  // ── Security / Technical (weight: 0.5) ────────────────────────────
  {
    name: 'John Hammond',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNcbElfFqNdiHISGcLlYwOw',
    channelId: 'UCNcbElfFqNdiHISGcLlYwOw',
    category: 'security_tech',
    weight: 0.5,
    niches: ['security', 'hacking', 'malware', 'cybersecurity'],
  },
  {
    name: 'NetworkChuck',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCi8w8ZzM2QFczjRxq0R_wjA',
    channelId: 'UCi8w8ZzM2QFczjRxq0R_wjA',
    category: 'security_tech',
    weight: 0.5,
    niches: ['networking', 'security', 'linux', 'tutorial'],
  },
  {
    name: 'Smart Contract Programmer',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCJWh7F3AFyQ_x01VK6-7cZw',
    channelId: 'UCJWh7F3AFyQ_x01VK6-7cZw',
    category: 'security_tech',
    weight: 0.5,
    niches: ['solidity', 'smart-contracts', 'ethereum', 'security'],
  },
  {
    name: 'Dapp University',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC6jH2FqQyN9x_4f7bK7Jvwg',
    channelId: 'UC6jH2FqQyN9x_4f7bK7Jvwg',
    category: 'security_tech',
    weight: 0.6,
    niches: ['solidity', 'dapps', 'ethereum', 'tutorial'],
  },
  {
    name: 'Ethereum Foundation',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNOfzGXD_C9YMYmnefmPH0g',
    channelId: 'UCNOfzGXD_C9YMYmnefmPH0g',
    category: 'security_tech',
    weight: 0.7,
    niches: ['ethereum', 'development', 'research', 'protocol'],
  },

  // ── Bonus additions ───────────────────────────────────────────────
  {
    name: 'Miles Deutscher',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4yQ6DlPjVJ-FnUa7SeSCjA',
    channelId: 'UC4yQ6DlPjVJ-FnUa7SeSCjA',
    category: 'trading',
    weight: 0.7,
    niches: ['crypto', 'trading', 'altcoins', 'alpha'],
  },
  {
    name: 'Lark Davis',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCk8ZW4PpRLtYk5Ro9d5I5Yg',
    channelId: 'UCk8ZW4PpRLtYk5Ro9d5I5Yg',
    category: 'market_analysis',
    weight: 0.8,
    niches: ['crypto', 'defi', 'news', 'altcoins'],
  },
  {
    name: 'Chico Crypto',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC4w76QvEWXgVgRq2kH_VfQg',
    channelId: 'UC4w76QvEWXgVgRq2kH_VfQg',
    category: 'market_analysis',
    weight: 0.7,
    niches: ['crypto', 'investigative', 'scams', 'news'],
  },
  {
    name: 'Virtual Bacon',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwCqdF7K_myWRTvGyg-Mn6g',
    channelId: 'UCwCqdF7K_myWRTvGyg-Mn6g',
    category: 'trading',
    weight: 0.6,
    niches: ['trading', 'technical-analysis', 'bitcoin', 'onchain'],
  },
  {
    name: 'Sheldon Evans',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCQ8q0L19AHZQ7bA7hr54lSg',
    channelId: 'UCQ8q0L19AHZQ7bA7hr54lSg',
    category: 'nft_gaming',
    weight: 0.6,
    niches: ['nft', 'solana', 'collectibles', 'market-analysis'],
  },
];

// ─── Channel lookup helper ────────────────────────────────────────────

/** Map channel name → YouTubeChannel for O(1) lookups during filtering */
export const CHANNEL_BY_NAME: Record<string, YouTubeChannel> = {};
for (const ch of CRYPTO_CHANNELS) {
  CHANNEL_BY_NAME[ch.name] = ch;
}

// ─── Category keywords mapping ───────────────────────────────────────

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto: [
    'bitcoin',
    'btc',
    'crypto',
    'ethereum',
    'eth',
    'blockchain',
    'coin',
    'token',
    'digital asset',
    'bear market',
    'bull run',
  ],
  defi: [
    'defi',
    'decentralized finance',
    'liquidity',
    'yield',
    'staking',
    'lending',
    'borrowing',
    'amm',
    'dex',
    'swap',
    'pool',
    'farm',
  ],
  nft: [
    'nft',
    'nfts',
    'collectible',
    'digital art',
    'marketplace',
    'blue chip',
    'ape',
    'pixel',
    'mint',
    'metadata',
  ],
  tutorial: [
    'tutorial',
    'guide',
    'how to',
    'learn',
    'beginner',
    'explained',
    'walkthrough',
    'setup',
    'step by step',
    'getting started',
  ],
  news: [
    'news',
    'update',
    'latest',
    'breaking',
    'report',
    'analysis',
    'recap',
    'weekly',
    'daily',
    'roundup',
  ],
  entertainment: [
    'entertainment',
    'podcast',
    'interview',
    'discussion',
    'debate',
    'funny',
    'meme',
    'reaction',
    'vlog',
  ],
  trading: [
    'trade',
    'trading',
    'chart',
    'technical analysis',
    'support',
    'resistance',
    'entry',
    'exit',
    'swing',
    'scalp',
    'futures',
  ],
  macro: [
    'macro',
    'fed',
    'federal reserve',
    'inflation',
    'interest rate',
    'gdp',
    'recession',
    'monetary policy',
    'qe',
    'dollar',
  ],
};

// ─── Quality filtering ───────────────────────────────────────────────

/**
 * Determine whether a video entry should be filtered out based on quality
 * heuristics. Uses title patterns + duration (when available from RSS)
 * + freshness (max age).
 */
export function isLowQualityVideo(
  entry: RSSEntry,
  channel: YouTubeChannel,
  nowMs: number = Date.now(),
  maxAgeDays: number = QUALITY_FILTERS.MAX_AGE_DAYS,
): boolean {
  const titleLower = entry.title.toLowerCase();

  // 1. Filter explicit Shorts markers
  if (
    titleLower.includes('#shorts') ||
    titleLower.includes('shorts') ||
    titleLower.startsWith('shorts ')
  ) {
    return true;
  }

  // 2. Filter by duration when available in RSS (<60s = likely Short)
  if (entry.duration !== undefined && entry.duration < QUALITY_FILTERS.SHORTS_MAX_DURATION) {
    // Exception: high-weight channels with substantial content
    if (entry.duration >= 30 && channel.weight >= 0.9) {
      // Keep 30-59s videos from top-tier channels if they're not explicitly #shorts
    } else {
      return true;
    }
  }

  // 3. Filter livestream recordings unless channel is exempt
  const isLivestream =
    /[🔴📡]/u.test(entry.title) ||
    /\blive\s*(stream|now|broadcast)\b/i.test(entry.title) ||
    /\blivestream\b/i.test(entry.title) ||
    /\bpremier(e|ing)\b/i.test(entry.title);

  if (isLivestream && !QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS.includes(channel.name)) {
    return true;
  }

  // 4. Filter by freshness (max age)
  const publishedMs = new Date(entry.published).getTime();
  if (Number.isNaN(publishedMs)) return true;

  const ageMs = nowMs - publishedMs;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  if (ageMs > maxAgeMs) return true;

  return false;
}

// ─── RSS XML Parsing ─────────────────────────────────────────────────

interface RSSEntry {
  videoId: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  description?: string;
  channelName?: string;
  channelId?: string;
  thumbnail?: string;
  /** Duration in seconds (from yt:duration in RSS) — optional */
  duration?: number;
  /** View count (from media:statistics in RSS) — rarely available */
  views?: number;
}

/**
 * Parse YouTube Atom RSS feed XML into structured entries.
 * YouTube RSS uses Atom format (not RSS 2.0).
 */
function parseYouTubeRss(xml: string, channel: YouTubeChannel): RSSEntry[] {
  const entries: RSSEntry[] = [];

  // Extract <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const matches = Array.from(xml.matchAll(entryRegex));

  for (const match of matches) {
    const entryXml = match[1];
    if (!entryXml) continue;

    try {
      const videoId = extractXmlTag(entryXml, 'yt:videoId') ?? '';
      const title = decodeXmlEntities(extractXmlTag(entryXml, 'title') ?? '');
      const link = extractLinkHref(entryXml);
      const published = extractXmlTag(entryXml, 'published') ?? '';
      const description = decodeXmlEntities(extractXmlTag(entryXml, 'media:description') ?? '');
      const thumbnail = extractThumbnailUrl(entryXml) ?? undefined;

      if (!videoId || !title) continue;

      // Parse optional duration from <yt:duration seconds="123"/>
      const durationStr = extractXmlTag(entryXml, 'yt:duration');
      const duration = durationStr ? parseDurationAttribute(durationStr) : undefined;

      // Parse optional view count from <media:statistics views="12345"/>
      const views = extractMediaStatisticsViews(entryXml);

      entries.push({
        videoId,
        title,
        link: link ?? `https://www.youtube.com/watch?v=${videoId}`,
        published,
        updated: extractXmlTag(entryXml, 'updated') ?? published,
        description,
        channelName: channel.name,
        channelId: channel.channelId,
        thumbnail,
        duration,
        views,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return entries;
}

/**
 * Parse the `seconds` attribute from `<yt:duration seconds="123"/>` element content.
 * The tag content looks like: `123` (just a number string) since yt:duration
 * has no text content, only attributes. We extract the full element and grab the attribute.
 */
function parseDurationAttribute(xml: string): number | undefined {
  // Try matching <yt:duration seconds="123"/>
  const match = xml.match(/seconds\s*=\s*["'](\d+)["']/i);
  if (match?.[1]) {
    const val = Number.parseInt(match[1], 10);
    return Number.isFinite(val) ? val : undefined;
  }
  return undefined;
}

/**
 * Extract view count from <media:statistics views="12345"/> inside <media:community>.
 */
function extractMediaStatisticsViews(xml: string): number | undefined {
  const match = xml.match(/<media:statistics[^>]*views\s*=\s*["'](\d+)["']/i);
  if (match?.[1]) {
    const val = Number.parseInt(match[1], 10);
    return Number.isFinite(val) ? val : undefined;
  }
  return undefined;
}

function extractXmlTag(xml: string, tag: string): string | null {
  // Handle both <tag>content</tag> and <ns:tag>content</ns:tag>
  const escaped = tag.replace(':', '\\:');
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`);
  const match = xml.match(re);
  return match?.[1]?.trim() ?? null;
}

function extractLinkHref(xml: string): string | null {
  const match = xml.match(/<link[^>]*href="([^"]+)"/);
  return match?.[1] ?? null;
}

function extractThumbnailUrl(xml: string): string | null {
  // media:thumbnail url="..."
  const match = xml.match(/<media:thumbnail[^>]*url="([^"]+)"/);
  if (match?.[1]) return match[1];

  // Also check media:content with thumbnail
  const contentMatch = xml.match(/<media:content[^>]*url="([^"]+)"/);
  return contentMatch?.[1] ?? null;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .trim();
}

/**
 * Fetch a single YouTube RSS feed and parse it.
 */
async function fetchChannelFeed(
  channel: YouTubeChannel,
  signal?: AbortSignal,
): Promise<RSSEntry[]> {
  try {
    const response = await fetch(channel.feed, {
      signal,
      headers: {
        'User-Agent': 'DegenFeed/1.0 (+https://degenfeed.xyz)',
        Accept: 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.warn(`[youtube-provider] HTTP ${response.status} for ${channel.name}`);
      return [];
    }

    const xml = await response.text();
    if (!xml || xml.length < 100) return [];

    return parseYouTubeRss(xml, channel);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Silently handle abort
      return [];
    }
    console.warn(`[youtube-provider] Failed to fetch ${channel.name}:`, err);
    return [];
  }
}

// ─── Main fetch function ────────────────────────────────────────────

export interface FetchYouTubeOptions {
  /** Category filter (crypto, defi, nft, tutorial, news, entertainment, trading, macro) */
  category?: string;
  /** Max number of videos to return */
  limit?: number;
  /** Array of channel names to include (default: all) */
  channels?: string[];
  /** Array of channel categories to include (default: all) */
  channelCategories?: ChannelCategory[];
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Sort order */
  sort?: 'recent' | 'popular' | 'trending';
  /** Override max age in days (default: 7) */
  maxAgeDays?: number;
  /** Disable quality filtering (default: false) */
  disableQualityFilter?: boolean;
}

/**
 * Fetch YouTube videos from curated crypto channels.
 * Returns normalized YouTubeVideoItem[] sorted by publish date
 * with quality filters applied.
 */
export async function fetchYouTubeFeed(
  options: FetchYouTubeOptions = {},
): Promise<YouTubeVideoItem[]> {
  const {
    category,
    limit = 20,
    channels: channelFilter,
    channelCategories,
    signal,
    sort = 'recent',
    maxAgeDays,
    disableQualityFilter = false,
  } = options;

  // Filter channels if requested
  let channels = [...CRYPTO_CHANNELS];

  if (channelFilter) {
    channels = channels.filter((c) => channelFilter.includes(c.name));
  }

  if (channelCategories && channelCategories.length > 0) {
    channels = channels.filter((c) => channelCategories.includes(c.category));
  }

  if (channels.length === 0) return [];

  // Apply override max age if provided
  const effectiveMaxAgeDays = maxAgeDays ?? QUALITY_FILTERS.MAX_AGE_DAYS;
  const nowMs = Date.now();

  // Fetch all channel feeds with concurrency limit
  const concurrency = 4;
  const results: RSSEntry[][] = [];
  const queue = [...channels];

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const channel = queue.shift();
      if (!channel) break;
      const entries = await fetchChannelFeed(channel, signal);
      if (entries.length > 0) {
        // Apply quality filter per-channel
        const filtered = disableQualityFilter
          ? entries
          : entries.filter((e) => !isLowQualityVideo(e, channel, nowMs, effectiveMaxAgeDays));

        if (filtered.length > 0) {
          results.push(filtered);
        }
      }
    }
  });

  await Promise.all(workers);

  // Flatten and map to VideoItem
  const allEntries = results.flat();

  // Deduplicate by videoId
  const seen = new Set<string>();
  const items: YouTubeVideoItem[] = [];

  for (const entry of allEntries) {
    if (seen.has(entry.videoId)) continue;
    seen.add(entry.videoId);

    const publishedMs = new Date(entry.published).getTime();
    const channelInfo = CHANNEL_BY_NAME[entry.channelName ?? ''];

    items.push({
      id: entry.videoId,
      title: entry.title,
      channelName: entry.channelName ?? 'Unknown',
      channelUrl: `https://www.youtube.com/channel/${entry.channelId ?? ''}`,
      thumbnailUrl:
        entry.thumbnail ?? `https://img.youtube.com/vi/${entry.videoId}/maxresdefault.jpg`,
      url: entry.link ?? `https://www.youtube.com/watch?v=${entry.videoId}`,
      publishedAt: entry.published,
      publishedMs,
      duration: entry.duration !== undefined ? formatDuration(entry.duration) : undefined,
      views: entry.views,
      description: entry.description,
      category: category ?? detectCategory(entry.title, entry.description),
      channelCategory: channelInfo?.category,
      channelWeight: channelInfo?.weight,
      niches: channelInfo?.niches,
      source: 'youtube',
    });
  }

  // Sort
  if (sort === 'recent') {
    items.sort((a, b) => b.publishedMs - a.publishedMs);
  } else if (sort === 'popular') {
    items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  } else if (sort === 'trending') {
    // Trending = recent + high engagement proxy
    items.sort((a, b) => {
      const scoreA = (a.views ?? 0) / Math.max(1, (Date.now() - a.publishedMs) / 3600000);
      const scoreB = (b.views ?? 0) / Math.max(1, (Date.now() - b.publishedMs) / 3600000);
      return scoreB - scoreA;
    });
  }

  // Filter by category if specified
  const filtered =
    category && category !== 'all' ? items.filter((v) => v.category === category) : items;

  // If no category filter but we have channel categories, sort by weight descending
  // so highest-quality channels appear first
  if (!category && !channelCategories) {
    filtered.sort((a, b) => {
      // Primary sort: channel weight descending
      const weightDiff = (b.channelWeight ?? 0) - (a.channelWeight ?? 0);
      if (weightDiff !== 0) return weightDiff;
      // Secondary sort: recency
      return b.publishedMs - a.publishedMs;
    });
  }

  return filtered.slice(0, limit);
}

/**
 * Format seconds to HH:MM:SS or MM:SS string.
 */
function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Detect video category from title + description.
 */
function detectCategory(title: string, description?: string): string {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }
  return 'crypto';
}

// ─── Single video lookup ─────────────────────────────────────────────

/**
 * Get a single YouTube video's details by ID.
 * Uses the oEmbed endpoint for quick metadata.
 */
export async function getYouTubeVideoInfo(
  videoId: string,
  signal?: AbortSignal,
): Promise<YouTubeVideoItem | null> {
  try {
    // oEmbed is a simple JSON endpoint
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      type: string;
    };

    return {
      id: videoId,
      title: data.title ?? 'Untitled',
      channelName: data.author_name ?? 'Unknown',
      channelUrl: data.author_url ?? '',
      thumbnailUrl: data.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: new Date().toISOString(),
      publishedMs: Date.now(),
      source: 'youtube',
    };
  } catch {
    return null;
  }
}

// ─── Utility: Get channels by category ───────────────────────────────

/**
 * Get all channels in a given category, sorted by weight descending.
 */
export function getChannelsByCategory(category: ChannelCategory): YouTubeChannel[] {
  return CRYPTO_CHANNELS.filter((c) => c.category === category).sort((a, b) => b.weight - a.weight);
}

/**
 * Get total channel stats.
 */
export function getChannelStats() {
  const categories: Partial<Record<ChannelCategory, number>> = {};
  for (const ch of CRYPTO_CHANNELS) {
    categories[ch.category] = (categories[ch.category] ?? 0) + 1;
  }

  return {
    total: CRYPTO_CHANNELS.length,
    categories,
    nicheCount: new Set(CRYPTO_CHANNELS.flatMap((c) => c.niches)).size,
    livestreamExempt: QUALITY_FILTERS.LIVESTREAM_EXEMPT_CHANNELS.length,
    maxAgeDays: QUALITY_FILTERS.MAX_AGE_DAYS,
  };
}
