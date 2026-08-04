export interface FeedSource {
  url: string;
  label: string;
  category: FeedCategory;
  niches: string[];
  platform?:
    | 'rss'
    | 'atom'
    | 'substack'
    | 'medium'
    | 'mirror'
    | 'paragraph'
    | 'ghost'
    | 'beehiiv'
    | 'podcast';
  language?: string;
  ttlMinutes?: number;
  featured?: boolean;
}

export type FeedCategory =
  | 'crypto-news'
  | 'crypto-research'
  | 'vc-investment'
  | 'dev-technical'
  | 'security'
  | 'academic'
  | 'tech'
  | 'newsletter'
  | 'defi'
  | 'nft'
  | 'ai'
  | 'regulation'
  | 'bitcoin'
  | 'ethereum'
  | 'solana'
  | 'science'
  | 'geopolitics'
  | 'business'
  | 'world'
  | 'culture'
  | 'politics'
  | 'podcast';

// ═══════════════════════════════════════════════════════════════════════════
// CRYPTO NEWS (25 feeds)
// ═══════════════════════════════════════════════════════════════════════════
