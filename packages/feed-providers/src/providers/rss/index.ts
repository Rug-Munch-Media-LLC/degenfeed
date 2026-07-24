// ── Thin re-export barrel ──────────────────────────────────────────────

export { DEFAULT_CRYPTO_FEEDS } from './config';
export { deduplicateRssPosts } from './dedup';
export {
  getFeedCategories,
  getFeedsByCategory,
  getNewsletterFeeds,
  normalizeFeedInput,
} from './helpers';
export { feedToUnifiedPosts, parseRss } from './parsers';
export { RssProvider } from './provider';
export { computeQualityScore } from './quality';
export type { QualityScore, RssCategory, RssFeedConfig, RssProviderOptions } from './types';
