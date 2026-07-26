/**
 * @degenfeed/api-worker — Curated Podcast RSS Fetcher
 *
 * Fetches episode data from external podcast RSS feeds and normalizes
 * them into UnifiedPodcastEpisode format for storage in KV.
 *
 * KV schema:
 *   podcast:curated:{podcastId}         → CuratedPodcast metadata
 *   podcast:curated:episode:{episodeId} → UnifiedPodcastEpisode
 *   podcast:curated:index:all           → JSON array of all curated podcast IDs
 *   podcast:curated:index:crypto        → JSON array of crypto podcast IDs
 *   podcast:curated:index:tech          → JSON array of tech podcast IDs
 *   podcast:curated:index:ai            → JSON array of AI podcast IDs
 *   podcast:curated:latest              → Latest 100 episodes (sorted)
 *   podcast:curated:trending            → Trending episodes (sorted by plays)
 *   podcast:curated:last-fetch          → ISO timestamp
 */

import type { CuratedPodcast, UnifiedPodcastEpisode } from '../feed/podcast-curation';
import { ALL_CURATED_PODCASTS, CURATED_PODCASTS_BY_CATEGORY } from '../feed/podcast-curation';

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_EPISODES_PER_FETCH = 20;
const MAX_EPISODES_PER_PODCAST = 50;
const USER_AGENT = 'DegenFeed/1.0 CuratedPodcastAggregator';

// ─── KV Key Helpers ──────────────────────────────────────────────────────

export const curatedPodcastKey = (id: string) => `podcast:curated:${id}`;
export const curatedEpisodeKey = (id: string) => `podcast:curated:episode:${id}`;
export const CURATED_INDEX_KEY_ALL = 'podcast:curated:index:all';
export const CURATED_INDEX_KEY_CRYPTO = 'podcast:curated:index:crypto';
export const CURATED_INDEX_KEY_TECH = 'podcast:curated:index:tech';
export const CURATED_INDEX_KEY_AI = 'podcast:curated:index:ai';
export const CURATED_LATEST_KEY = 'podcast:curated:latest';
export const CURATED_TRENDING_KEY = 'podcast:curated:trending';
export const CURATED_LAST_FETCH_KEY = 'podcast:curated:last-fetch';

// ─── RSS Parsing ─────────────────────────────────────────────────────────

type RawRssFeed = {}
