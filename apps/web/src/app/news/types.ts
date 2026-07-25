/**
 * Shared types for DegenFeed News components.
 */

export interface NewsSourceMeta {
  id: string;
  name: string;
  tier: number;
  credibility: number;
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
}
