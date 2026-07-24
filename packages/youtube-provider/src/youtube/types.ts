// ─── Types ───────────────────────────────────────────────────────────

export type ChannelCategory =
  | 'market_analysis'
  | 'defi'
  | 'trading'
  | 'nft_gaming'
  | 'macro_bitcoin'
  | 'security_tech';

export type ChannelSubcategory =
  | 'daily-news'
  | 'market-commentary'
  | 'interviews'
  | 'altcoin-research'
  | 'market-sentiment'
  | 'protocol-deep-dives'
  | 'yield-farming'
  | 'defi-alpha'
  | 'defi-analysis'
  | 'defi-math'
  | 'crypto-research'
  | 'technical-analysis'
  | 'trading-psychology'
  | 'algorithmic-trading'
  | 'futures-options'
  | 'nft-art'
  | 'nft-news'
  | 'blockchain-gaming'
  | 'metaverse'
  | 'bitcoin-maximalism'
  | 'macro-economics'
  | 'monetary-policy'
  | 'smart-contract-audits'
  | 'defi-hacks'
  | 'privacy-tech'
  | 'infrastructure'
  | 'layer2-scaling';

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
  channelSubcategory?: ChannelSubcategory;
  channelWeight?: number;
  niches?: string[];
  source: string;
}

export interface YouTubeChannel {
  name: string;
  channelId: string;
  category: ChannelCategory;
  subcategory: ChannelSubcategory;
  weight: number;
  niches: string[];
  livestream?: boolean;
  feed?: string;
}

export interface FetchYouTubeOptions {
  category?: string;
  limit?: number;
  channels?: string[];
  channelCategories?: ChannelCategory[];
  channelSubcategories?: ChannelSubcategory[];
  signal?: AbortSignal;
  sort?: 'recent' | 'popular' | 'trending';
  maxAgeDays?: number;
  disableQualityFilter?: boolean;
}

export interface RSSEntry {
  videoId: string;
  title: string;
  link: string;
  published: string;
  updated: string;
  description?: string;
  channelName?: string;
  channelId?: string;
  thumbnail?: string;
  duration?: number;
  views?: number;
}
