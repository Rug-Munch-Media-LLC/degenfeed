/**
 * @degenfeed/youtube-provider — public surface.
 *
 * `youtube/`  — legacy feed/provider layer (RSS parse, filters, trending).
 * `ingest/`   — self-hosted ingest: records, extraction, shill candidates.
 * `catalogue/`— top-250 channel catalogue with provenance + dedupe.
 */

export { CURATED_ROWS } from './catalogue/data';
export {
  buildCatalogue,
  buildCatalogueFromRows,
  buildDefaultCatalogue,
  normaliseKey,
} from './catalogue/index';
export { parseRows } from './catalogue/parse';
export { CATEGORIES, SUBCATEGORIES } from './catalogue/schema';
export type { Catalogue, CatalogueEntry, CatalogueProvenance } from './catalogue/types';

// ─── Ingest layer ────────────────────────────────────────────────────
export * from './ingest';
export {
  CHANNEL_BY_NAME,
  CRYPTO_CHANNELS,
} from './youtube/config';
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
