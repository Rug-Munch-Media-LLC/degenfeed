import type { UnifiedPost } from '@degenfeed/types';

// ── Feed Configuration Types ───────────────────────────────────────────

export interface RssFeedConfig {
  /** RSS/Atom feed URL */
  url: string;
  /** Authority tier 1-5 (1 = highest authority, e.g. CoinDesk; 5 = long-tail) */
  tier: number;
  /** Base weight 0.0-1.0 used in quality scoring */
  weight: number;
  /** Content category: news, analysis, research, development, markets, security, policy, tech, ai, video, social, newsletter */
  category: string;
  /** Topic tags for filtering / discovery */
  tags: string[];
  /** Authority bonus (3 = Tier 1, 2 = Tier 2-3, 1 = Tier 4-5) */
  authority: number;
  /** Newsletter-specific: has a paid subscription tier (quality signal) */
  isPaid?: boolean;
  /** Newsletter-specific: publishing schedule for consistency scoring */
  schedule?: 'daily' | 'weekly' | 'monthly' | 'irregular';
}

export interface QualityScore {
  /** Sum of all signal scores */
  total: number;
  signals: {
    /** Source tier weight (0.6-1.0) */
    weight: number;
    /** Post freshness: <1h=3, <6h=2, <24h=1, >24h=0 */
    freshness: number;
    /** Content length: >500=2, >200=1, else 0 */
    length: number;
    /** Has image/video embed: 1 or 0 */
    hasMedia: number;
    /** Source authority bonus (3, 2, or 1) */
    authority: number;
    /** Newsletter-specific: paid tier bonus (2 if isPaid, else 0) */
    newsletterPaid: number;
    /** Newsletter-specific: deep content bonus (2 if >2000 chars, 1 if >1000) */
    newsletterDepth: number;
    /** Newsletter-specific: schedule consistency bonus (1 if daily/weekly, else 0) */
    newsletterConsistency: number;
  };
}

export type RssCategory =
  | 'news'
  | 'analysis'
  | 'research'
  | 'development'
  | 'markets'
  | 'security'
  | 'policy'
  | 'tech'
  | 'ai'
  | 'science'
  | 'startups'
  | 'video'
  | 'social'
  | 'newsletter'
  | 'podcast'
  | 'dao';

export const RSS_CATEGORIES: Record<string, string> = {
  news: 'Breaking news, market coverage, industry updates',
  analysis: 'Deep dives, on-chain analysis, market research',
  research: 'Academic research, institutional reports, technical papers',
  development: 'Protocol blogs, dev updates, EIPs, SDK releases',
  markets: 'Price data, trading volumes, exchange flows, derivatives',
  security: 'Hacks, exploits, audits, vulnerability disclosures',
  policy: 'Regulation, compliance, legal, government policy',
  tech: 'General technology, programming, engineering blogs',
  ai: 'Artificial intelligence, machine learning, LLMs',
  science: 'Scientific research, discoveries, academic papers',
  startups: 'Startup and VC news, product launches, founder stories',
  video: 'YouTube channels, video content, podcasts',
  social: 'Reddit, Lemmy, community discussions',
  newsletter: 'Curated newsletters from Substack, Medium, Paragraph, Mirror',
  podcast: 'Crypto podcast episodes, interviews, panel discussions',
  dao: 'DAO governance proposals, forum discussions, community votes',
};

export interface RssProviderOptions {
  /** Feed URLs (plain strings) or fully configured RssFeedConfig objects */
  feeds?: (string | RssFeedConfig)[];
}

export interface ScoredRssPost {
  post: UnifiedPost;
  config: RssFeedConfig;
  quality: QualityScore;
}

export interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  creator?: string;
  categories?: string[];
  enclosure?: { url?: string; type?: string };
}
