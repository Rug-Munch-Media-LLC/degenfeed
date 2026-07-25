/**
 * news-sources — News source registry.
 *
 * Re-exports from the split modules for backward compatibility.
 * All types, helpers, and data have been extracted to:
 *   - news-types.ts (interfaces)
 *   - news-helpers.ts (functions)
 *   - news-source-tiers.ts (data arrays split by tier)
 */

export type {
  NewsSourceMeta,
  AggregatedStory,
  SentimentResult,
  StoryCluster,
  StoryEntities,
  AggregationOptions,
  AggregationResult,
  ArticleEnrichment,
  ParsedRssItem,
} from './news-types';
export {
  NEWS_SOURCES,
  NEWSLETTER_FEEDS,
  NEWS_SOURCE_COUNT,
} from './news-source-tiers';
