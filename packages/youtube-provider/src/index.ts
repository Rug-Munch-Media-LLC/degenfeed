// ── God code split: moved to youtube/ directory ─────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under youtube/:
//   types.ts   — ChannelCategory, YouTubeVideoItem, YouTubeChannel, RSSEntry
//   config.ts  — CRYPTO_CHANNELS data + CHANNEL_BY_NAME lookup
//   filters.ts — QUALITY_FILTERS, CATEGORY_KEYWORDS, isLowQualityVideo, computeQualityScore, etc.
//   parser.ts  — parseYouTubeRss, fetchChannelFeed
//   index.ts   — Circuit breaker, fetchYouTubeFeed, getYouTubeVideoInfo, trending, discovery

export { CHANNEL_BY_NAME, CRYPTO_CHANNELS } from './youtube/config';
export {
  CATEGORY_KEYWORDS,
  computeEngagementSignals,
  computeQualityScore,
  detectContentType,
  isLowQualityVideo,
  QUALITY_FILTERS,
  scoreCreatorRelevance,
} from './youtube/filters';
export {
  autoDiscoverAndIntegrate,
  discoverCreators,
  fetchTrendingByCategory,
  fetchYouTubeFeed,
  getChannelStats,
  getChannelsByCategory,
  getChannelsBySubcategory,
  getYouTubeVideoInfo,
} from './youtube/index';
export { fetchChannelFeed } from './youtube/parser';
export type {
  ChannelCategory,
  ChannelSubcategory,
  DiscoveredCreator,
  EngagementSignals,
  FetchYouTubeOptions,
  QualityScore,
  RSSEntry,
  TrendingCategory,
  VideoContentType,
  YouTubeChannel,
  YouTubeVideoItem,
} from './youtube/types';
