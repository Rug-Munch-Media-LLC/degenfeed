/**
 * Shared types for DegenFeed News components.
 */

export interface NewsSourceMeta {
  id: string;
  name: string;
  tier: number;
  credibility: number;
  category?: string;
}

export interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  signals: string[];
}

export interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

export interface StoryCluster {
  id: string;
  title: string;
  storyCount: number;
  topCategories: string[];
  topEntities: StoryEntities;
  aggregateSentiment: SentimentResult;
}

export interface NewsStory {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceMeta: NewsSourceMeta;
  author: string;
  publishedAt: number;
  imageUrl?: string;
  categories: string[];
  niches: string[];
  sentiment: SentimentResult;
  entities: StoryEntities;
  alsoCoveredBy: string[];
  isBreaking: boolean;
  velocity: number;
  score: number;
  readingTime?: number;
  heroImage?: string;
  authorName?: string;
  metaDescription?: string;
  isDiscovery?: boolean;
  scoreComponents?: {
    topicalRelevance: number;
    sourceCredibility: number;
    freshness: number;
    engagementVelocity: number;
    depthMatch: number;
    total: number;
  };
  // Ground News-style rating fields (mirror of components/news types —
  // the bridge/worker attach these from SOURCE_BIAS_SCORE et al.)
  bias?: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  /** Numeric bias score from SOURCE_BIAS_SCORE: -1.0 (left) .. +1.0 (right). */
  biasScore?: number;
  sentimentScore?: number; // -100 to +100
  factualRating?: 'high' | 'medium' | 'low' | 'unrated';
  sourceTier?: number; // 1-3
  ratingConfidence?: number; // 0-1
}

export interface NewsMeta {
  total: number;
  sourceCount: number;
  fetchedAt: number;
  errors: string[];
  sentiment: { bullish: number; bearish: number; neutral: number };
  trending: Array<{ topic: string; count: number; score: number }>;
  category: string;
  query?: string;
  personalized: boolean;
  topCategories: Array<{
    categoryId: string;
    label: string;
    emoji: string;
    count: number;
    avgConfidence: number;
  }>;
  /** 3-bucket bias distribution computed from SOURCE_BIAS_SCORE. */
  biasDistribution?: { left: number; center: number; right: number };
}
