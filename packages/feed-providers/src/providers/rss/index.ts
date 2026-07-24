// ── Thin re-export barrel ──────────────────────────────────────────────
export type { QualityScore, RssCategory, RssFeedConfig, RssProviderOptions } from './types';
export { DEFAULT_CRYPTO_FEEDS } from './config';
export { computeQualityScore } from './quality';
export { deduplicateRssPosts } from './dedup';
export { normalizeFeedInput, getFeedsByCategory, getFeedCategories, getNewsletterFeeds } from './helpers';
export { parseRss, feedToUnifiedPosts } from './parsers';
export { RssProvider } from './provider';
