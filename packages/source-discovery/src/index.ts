/**
 * @degenfeed/source-discovery — Auto-discovery engine for new content sources.
 *
 * Discovers new sources across Reddit, YouTube, RSS feeds, Lemmy communities,
 * PeerTube channels, and newsletters. Scores each source with quality heuristics
 * and returns candidates for auto-approval or manual review.
 */

export type { DiscoveredSource, DiscoveryConfig, DiscoveryStatus, Platform } from './types';
export { CRYPTO_KEYWORDS, DEFAULT_DISCOVERY_CONFIG, SEARCH_KEYWORDS } from './types';
export { computeQualityScore, estimateRelevance, isBlocklisted } from './quality';
export { discoverRedditSubreddits } from './reddit';
export { discoverYouTubeChannels } from './youtube';
export { discoverRSSFeeds } from './rss';
export { discoverLemmyCommunities } from './lemmy';
export { discoverPeerTubeChannels } from './peertube';
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
