/**
 * @degenfeed/source-discovery — Auto-discovery engine for new content sources.
 *
 * Discovers new sources across Reddit, YouTube, RSS feeds, Lemmy communities,
 * PeerTube channels, and newsletters. Scores each source with quality heuristics
 * and returns candidates for auto-approval or manual review.
 *
 * v2: Also provides source health scoring, trending detection, stale source
 * detection, and discovery stats aggregation for the auto-discovery pipeline.
 */

import type { DiscoveredSource } from './types';

export {
  aggregateStats,
  buildTrendingSource,
  computeQualityScore,
  computeSourceHealthScore,
  computeTrendingScore,
  detectStaleSources,
  estimateRelevance,
  getNewThisWeek,
  isBlocklisted,
} from './quality';
export type {
  DiscoveredSource,
  DiscoveryConfig,
  DiscoveryRun,
  DiscoveryStats,
  DiscoveryStatus,
  Platform,
  SourceHealth,
  SourceLifecycle,
  TrendingSource,
} from './types';
export {
  CRYPTO_KEYWORDS,
  DEFAULT_DISCOVERY_CONFIG,
  SEARCH_KEYWORDS,
} from './types';

import { discoverRedditSubreddits } from './reddit';

export { discoverRedditSubreddits } from './reddit';

import { discoverYouTubeChannels } from './youtube';

export { discoverYouTubeChannels } from './youtube';

import { discoverRSSFeeds } from './rss';

export { discoverRSSFeeds } from './rss';

import { discoverLemmyCommunities } from './lemmy';

export { discoverLemmyCommunities } from './lemmy';

import { discoverPeerTubeChannels } from './peertube';

export { discoverPeerTubeChannels } from './peertube';

import { discoverNewsletters } from './newsletter';

export { discoverNewsletters } from './newsletter';

/**
 * Run discovery across all platforms.
 * Returns all discovered sources, sorted by score descending.
 *
 * @param existingSources - Map of platform → list of source identifiers already known
 * @param youtubeApiKey - Optional YouTube Data API v3 key
 */
export async function discoverNewSources(
  existingSources: Partial<Record<string, string[]>> = {},
  youtubeApiKey?: string,
): Promise<DiscoveredSource[]> {
  const allSources: DiscoveredSource[] = [];

  const results = await Promise.allSettled([
    discoverRedditSubreddits(existingSources.reddit),
    discoverYouTubeChannels(youtubeApiKey, existingSources.youtube),
    discoverRSSFeeds(existingSources.rss),
    discoverLemmyCommunities(existingSources.lemmy),
    discoverPeerTubeChannels(existingSources.peertube),
    discoverNewsletters(existingSources.newsletter),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allSources.push(...result.value);
    } else {
      console.error('[source-discovery] discoverer failed:', result.reason);
    }
  }

  return allSources.sort((a, b) => b.score - a.score);
}
