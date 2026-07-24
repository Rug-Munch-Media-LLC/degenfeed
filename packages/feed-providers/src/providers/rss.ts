// ── God code split: moved to rss/ directory ────────────────────────────
// This file is now a thin re-export barrel for backward compatibility.
// Each concern lives in its own module under rss/:
//   types.ts    — RssFeedConfig, QualityScore, ScoredRssPost, etc.
//   config.ts   — cfg() helper + DEFAULT_CRYPTO_FEEDS data
//   quality.ts  — computeQualityScore, computeFreshnessScore, etc.
//   dedup.ts    — deduplicateRssPosts with Jaccard similarity
//   helpers.ts   — normalizeFeedInput, getFeedsByCategory, etc.
//   parsers.ts  — parseRss, parseRss2, parseAtom, feedToUnifiedPosts
//   provider.ts — RssProvider class

export type { QualityScore, RssCategory, RssFeedConfig, RssProviderOptions } from './rss/types';
export { DEFAULT_CRYPTO_FEEDS } from './rss/config';
export { computeQualityScore } from './rss/quality';
export { normalizeFeedInput, getFeedsByCategory, getFeedCategories, getNewsletterFeeds } from './rss/helpers';
export { RssProvider } from './rss/provider';
