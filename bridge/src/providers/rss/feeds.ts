import {
  ACADEMIC_FEEDS,
  AI_FEEDS,
  BEEHIIV_PUBLICATIONS,
  BUSINESS_FEEDS,
  CRYPTO_NEWS_FEEDS,
  CULTURE_FEEDS,
  DEFI_FEEDS,
  DEV_FEEDS,
  GEOPOLITICS_FEEDS,
  GHOST_BLOGS,
  L1_L2_FEEDS,
  MEDIUM_PUBLICATIONS,
  MIRROR_WRITERS,
  NFT_FEEDS,
  PARAGRAPH_NEWSLETTERS,
  PODCAST_FEEDS,
  REGULATION_FEEDS,
  RESEARCH_FEEDS,
  SCIENCE_FEEDS,
  SCIENCE_TECH_FEEDS,
  SECURITY_FEEDS,
  SUBSTACK_WRITERS,
  TECH_FEEDS,
  VC_FEEDS,
  WORLD_FEEDS,
} from '../rss';
import type { FeedCategory, FeedSource } from './types';

export const ALL_FEEDS: FeedSource[] = [
  ...CRYPTO_NEWS_FEEDS,
  ...RESEARCH_FEEDS,
  ...VC_FEEDS,
  ...DEV_FEEDS,
  ...L1_L2_FEEDS,
  ...SECURITY_FEEDS,
  ...ACADEMIC_FEEDS,
  ...TECH_FEEDS,
  ...SCIENCE_FEEDS,
  ...GEOPOLITICS_FEEDS,
  ...BUSINESS_FEEDS,
  ...WORLD_FEEDS,
  ...SCIENCE_TECH_FEEDS,
  ...CULTURE_FEEDS,
  ...DEFI_FEEDS,
  ...NFT_FEEDS,
  ...AI_FEEDS,
  ...SUBSTACK_WRITERS,
  ...MEDIUM_PUBLICATIONS,
  ...MIRROR_WRITERS,
  ...PARAGRAPH_NEWSLETTERS,
  ...GHOST_BLOGS,
  ...BEEHIIV_PUBLICATIONS,
  ...REGULATION_FEEDS,
  ...PODCAST_FEEDS,
];

export const FEED_COUNT = ALL_FEEDS.length;

/** Get feeds by category */
export function getFeedsByCategory(category: FeedCategory): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.category === category);
}

/** Get featured feeds (high-priority sources) */
export function getFeaturedFeeds(): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.featured);
}

/** Get newsletters only */
export function getNewsletterFeeds(): FeedSource[] {
  return ALL_FEEDS.filter(
    (f) =>
      f.platform === 'substack' ||
      f.platform === 'medium' ||
      f.platform === 'mirror' ||
      f.platform === 'paragraph' ||
      f.platform === 'ghost' ||
      f.platform === 'beehiiv',
  );
}

/** Get podcast feeds only */
export function getPodcastFeeds(): FeedSource[] {
  return ALL_FEEDS.filter((f) => f.category === 'podcast' || f.platform === 'podcast');
}

// ─── Helpers ───────────────────────────────────────────────────────────
