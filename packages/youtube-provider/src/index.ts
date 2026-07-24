// ── God code split: moved to youtube/ directory ─────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under youtube/:
//   types.ts   — ChannelCategory, YouTubeVideoItem, YouTubeChannel, RSSEntry
//   config.ts  — CRYPTO_CHANNELS data + CHANNEL_BY_NAME lookup
//   filters.ts — QUALITY_FILTERS, CATEGORY_KEYWORDS, isLowQualityVideo
//   parser.ts  — parseYouTubeRss, fetchChannelFeed
//   index.ts   — Circuit breaker, fetchYouTubeFeed, getYouTubeVideoInfo, utilities

export type { ChannelCategory, ChannelSubcategory, YouTubeVideoItem, YouTubeChannel, FetchYouTubeOptions, RSSEntry } from './youtube/types';
export { CRYPTO_CHANNELS, CHANNEL_BY_NAME } from './youtube/config';
export { QUALITY_FILTERS, CATEGORY_KEYWORDS, isLowQualityVideo } from './youtube/filters';
export { fetchChannelFeed } from './youtube/parser';
export { fetchYouTubeFeed, getYouTubeVideoInfo, getChannelsByCategory, getChannelsBySubcategory, getChannelStats } from './youtube/index';
