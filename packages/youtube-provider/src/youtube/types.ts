// ─── Types ───────────────────────────────────────────────────────────

export type ChannelCategory =
  | 'market_analysis'
  | 'defi'
  | 'trading'
  | 'nft_gaming'
  | 'macro_bitcoin'
  | 'security_tech'
  | 'ai_ml'
  | 'general_tech'
  | 'science'
  | 'startups';

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
  | 'layer2-scaling'
  // ── Additional subcategories used in config ──────────────────
  | 'swing-trading'
  | 'futures-trading'
  | 'crypto-gaming'
  | 'nft-market'
  | 'nft-trading'
  | 'nft-insights'
  | 'nft-gaming'
  | 'web3-gaming'
  | 'nft-education'
  | 'bitcoin-macro'
  | 'bitcoin-philosophy'
  | 'bitcoin-education'
  | 'beginner-friendly'
  | 'scam-awareness'
  | 'cybersecurity'
  | 'smart-contracts'
  | 'blockchain-dev'
  | 'web3-dev'
  // ── New subcategories ─────────────────────────────────────
  | 'ai-research'
  | 'ai-tools'
  | 'llm-benchmarks'
  | 'agent-dev'
  | 'startup-fundraising'
  | 'startup-interviews'
  | 'science-breakthroughs'
  | 'devops'
  | 'opensource-dev';

/** Content type classification — auto-detected from metadata */
export type VideoContentType =
  | 'tutorial'
  | 'review'
  | 'news'
  | 'interview'
  | 'vlog'
  | 'short'
  | 'livestream'
  | 'podcast'
  | 'educational'
  | 'entertainment'
  | 'unboxing'
  | 'commentary'
  | 'analysis'
  | 'unknown';

/** Engagement signal enrichment */
export interface EngagementSignals {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  estimatedEngagementRate: number; // (likes+comments)/views as ratio
  growthVelocity: number; // views per hour since publish
  momentum: 'viral' | 'trending' | 'steady' | 'stale';
}

/** Quality assessment */
export interface QualityScore {
  overall: number; // 0-1 composite
  productionQuality: number; // 0-1 — based on resolution, editing markers
  engagementRateScore: number; // 0-1
  recencyScore: number; // 0-1
  completeness: number; // 0-1 — has description, tags, chapters
  clickbaitPenalty: number; // 0-1, higher = more clickbaity
  confidence: number; // 0-1 how confident we are in this score
}

/** Trending by category — YouTube category IDs used by Invidious API */
export type TrendingCategory =
  | 'all'
  | 'crypto'
  | 'tech'
  | 'ai'
  | 'gaming'
  | 'music'
  | 'news'
  | 'science'
  | 'education'
  | 'entertainment'
  | 'sports';

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
  likes?: number;
  comments?: number;
  description?: string;
  category?: string;
  channelCategory?: ChannelCategory;
  channelSubcategory?: ChannelSubcategory;
  channelWeight?: number;
  niches?: string[];
  source: string;
  /** Enhanced fields */
  contentType?: VideoContentType;
  engagement?: EngagementSignals;
  qualityScore?: QualityScore;
  tags?: string[];
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
  /** Creator discovery fields */
  subscriberCount?: number;
  totalVideos?: number;
  avgViews?: number;
  growthRate?: number; // weekly subscriber growth
  lastActive?: string; // date of last upload
  topics?: string[];
}

export interface FetchYouTubeOptions {
  category?: string;
  limit?: number;
  channels?: string[];
  channelCategories?: ChannelCategory[];
  channelSubcategories?: ChannelSubcategory[];
  signal?: AbortSignal;
  sort?: 'recent' | 'popular' | 'trending' | 'engagement';
  maxAgeDays?: number;
  disableQualityFilter?: boolean;
  /** Enable creator discovery mode — fetches from non-curated sources */
  enableDiscovery?: boolean;
  /** Min engagement rate threshold (0-1) */
  minEngagementRate?: number;
  /** Content type filter */
  contentType?: VideoContentType | VideoContentType[];
  /** Don't enrich with engagement/quality data */
  skipEnrichment?: boolean;
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
  /** Enhanced RSS fields */
  likes?: number;
  comments?: number;
  tags?: string[];
}

/** Creator discovery result */
export interface DiscoveredCreator {
  name: string;
  channelId: string;
  category: ChannelCategory;
  subcategory: ChannelSubcategory;
  weight: number;
  niches: string[];
  subscriberCount?: number;
  totalVideos?: number;
  avgViews?: number;
  relevanceScore: number; // 0-1 how relevant to our niches
  discoverySource: 'invidious' | 'rss' | 'youtube-api' | 'community';
}
