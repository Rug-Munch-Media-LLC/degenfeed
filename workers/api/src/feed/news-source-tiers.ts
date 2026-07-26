/**
 * news-source-tiers — Combined news source arrays by tier.
 *
 * Extracted from news-aggregator.ts during de-godding.
 * Combines all tier-specific source files into NEWS_SOURCES
 * and NEWSLETTER_FEEDS for backward compatibility.
 */

import type { NewsSourceMeta } from './news-types';
import { TIER_1_SOURCES } from './news-source-tier-1';
import { TIER_2_SOURCES } from './news-source-tier-2';
import { TIER_3_SOURCES } from './news-source-tier-3';
import { TIER_4_SOURCES } from './news-source-tier-4';
import { NEWSLETTER_TIER_1 } from './newsletter-tier-1';
import { NEWSLETTER_TIER_2 } from './newsletter-tier-2';
import { NEWSLETTER_TIER_3 } from './newsletter-tier-3';

/** All news sources combined by tier */
export const NEWS_SOURCES: NewsSourceMeta[] = [
  ...TIER_1_SOURCES,
  ...TIER_2_SOURCES,
  ...TIER_3_SOURCES,
  ...TIER_4_SOURCES,
];

/** Newsletter feeds */
export const NEWSLETTER_FEEDS: NewsSourceMeta[] = [
  ...NEWSLETTER_TIER_1,
  ...NEWSLETTER_TIER_2,
  ...NEWSLETTER_TIER_3,
];

export const NEWS_SOURCE_COUNT = NEWS_SOURCES.length + NEWSLETTER_FEEDS.length;
