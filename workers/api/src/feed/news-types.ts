/**
 * news-types — Shared types for the news aggregation pipeline.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * All interfaces, types, and enums used across the news pipeline.
 */

import type { Protocol } from '@degenfeed/types';

// ─── News Source Meta ────────────────────────────────────────────────

export interface NewsSourceMeta {
  id: string;
  name: string;
  category: string;
  tier: 1 | 2 | 3 | 4;
  credibility: number;
  weight: number;
  url: string;
  type: 'rss' | 'reddit' | 'hackernews' | 'nostr' | 'farcaster' | 'bluesky' | 'lemmy';
  nicheTags?: string[];
  imageSupport?: boolean;
}

// ─── Aggregated Story ────────────────────────────────────────────────

export interface AggregatedStory {
  id: string;
  title: string;
  summary: string;
  body: string;
  url: string;
  source: string;
  sourceMeta: NewsSourceMeta;
  protocol: Protocol;
  allUrls: string[];
  alsoCoveredBy: string[];
  categories: string[];
  entities: StoryEntities;
  sentiment: SentimentResult;
  credibility: number;
  score: number;
  publishedAt: number;
  fetchedAt: number;
  imageUrl?: string;
  author: string;
  niches: string[];
  clusterId?: string;
  velocity: number;
  isBreaking: boolean;
  readingTime?: number;
  heroImage?: string;
  metaDescription?: string;
  authorName?: string;
  aiTags?: string[];
  alsoCoveredByDisplay?: string;
  alsoCoveredByCount?: number;
  contentHash?: string;
  dedupSimilarity?: number;
}

// ─── Story Entities ──────────────────────────────────────────────────

export interface StoryEntities {
  tokens: string[];
  protocols: string[];
  people: string[];
  companies: string[];
  chains: string[];
  nfts: string[];
}

// ─── Sentiment Result ────────────────────────────────────────────────

export interface SentimentResult {
  label: 'bullish' | 'bearish' | 'neutral';
  score: number;
  confidence: number;
  signals: string[];
}

// ─── Story Cluster ───────────────────────────────────────────────────

export interface StoryCluster {
  id: string;
  title: string;
  stories: AggregatedStory[];
  topCategories: string[];
  topEntities: StoryEntities;
  totalCoverage: number;
  firstSeen: number;
  lastSeen: number;
  aggregateSentiment: SentimentResult;
}

// ─── Article Enrichment ─────────────────────────────────────────────

export interface ArticleEnrichment {
  heroImage: string;
  metaDescription: string;
  authorName: string;
  readingTime: number;
}

// ─── Aggregation Options ────────────────────────────────────────────

export interface AggregationOptions {
  limit?: number;
  category?: string;
  query?: string;
  minTier?: number;
  includeNewsletters?: boolean;
  sourceIds?: string[];
  sort?: 'score' | 'newest' | 'trending';
}

// ─── Aggregation Result ─────────────────────────────────────────────

export interface AggregationResult {
  stories: AggregatedStory[];
  clusters: StoryCluster[];
  meta: {
    total: number;
    sourceCount: number;
    fetchedAt: number;
    errors: string[];
    sentiment: { bullish: number; bearish: number; neutral: number };
    trending: Array<{ topic: string; count: number; score: number }>;
  };
}

// ─── Parsed RSS Item (internal) ─────────────────────────────────────

export interface ParsedRssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
  content?: string;
  image?: string;
  categories: string[];
  mediaThumbnail?: string;
  enclosureUrl?: string;
  enclosureType?: string;
}
