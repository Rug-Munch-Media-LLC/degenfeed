/**
 * @degenfeed/api-worker — Podcast Episode Aggregation Cron
 *
 * Runs daily to:
 *   1. Fetch latest episodes from all 100 curated podcast RSS feeds
 *   2. Deduplicate (same episode from multiple sources via GUID)
 *   3. Store new episodes in KV
 *   4. Refresh trending based on play count
 *   5. Update the latest episodes index
 *
 * Called from the main cron dispatcher at 14:00 UTC daily.
 * Can also be triggered via POST /api/podcast/curated/refresh (admin).
 */

import { ALL_CURATED_PODCASTS } from '../feed/podcast-curation';
import {
  CURATED_LAST_FETCH_KEY,
  fetchAllCuratedEpisodes,
  recalculateTrending,
  seedCuratedPodcasts,
} from '../lib/curated-rss-fetcher';
import type { Env } from '../types';

/**
 * Main entry point: fetch + store + re-rank.
 * Called from the daily cron tick.
 */
export async function handlePodcastAggregation(env: Env): Promise<{
  ok: boolean;
  totalFetched: number;
  totalPodcasts: number;
  durationMs: number;
  errors: string[];
}> {
  const start = Date.now();
  const errors: string[] = [];

  if (!env.CACHE) {
    return {
      ok: false,
      totalFetched: 0,
      totalPodcasts: 0,
      durationMs: Date.now() - start,
      errors: ['KV namespace not available'],
    };
  }

  // Step 1: Ensure curated podcast metadata is seeded in KV
  try {
    const seeded = await env.CACHE.get('podcast:curated:seed:done');
    if (!seeded) {
      await seedCuratedPodcasts(env.CACHE);
      await env.CACHE.put('podcast:curated:seed:done', '1', { expirationTtl: 86400 * 365 });
    }
  } catch (err) {
    errors.push(`Seed failed: ${String(err)}`);
  }

  // Step 2: Fetch new episodes from all curated feeds
  let newEpisodes = 0;
  try {
    const episodes = await fetchAllCuratedEpisodes(env.CACHE);
    newEpisodes = episodes.length;
    console.log(
      `[podcast-cron] Fetched ${newEpisodes} new episodes from ${ALL_CURATED_PODCASTS.length} feeds`,
    );
  } catch (err) {
    errors.push(`Fetch failed: ${String(err)}`);
  }

  // Step 3: Recalculate trending
  try {
    await recalculateTrending(env.CACHE);
  } catch (err) {
    errors.push(`Trending recalculation failed: ${String(err)}`);
  }

  // Step 4: Record last fetch timestamp
  try {
    await env.CACHE.put(CURATED_LAST_FETCH_KEY, new Date().toISOString());
  } catch {
    /* non-critical */
  }

  const durationMs = Date.now() - start;

  return {
    ok: errors.length === 0,
    totalFetched: newEpisodes,
    totalPodcasts: ALL_CURATED_PODCASTS.length,
    durationMs,
    errors,
  };
}

/**
 * Trigger a full refresh of the curated podcast cache.
 * Can be called from an admin endpoint.
 */
export async function handleFullPodcastRefresh(env: Env): Promise<{
  ok: boolean;
  totalFetched: number;
  totalPodcasts: number;
  errors: string[];
}> {
  if (!env.CACHE) {
    return { ok: false, totalFetched: 0, totalPodcasts: 0, errors: ['KV not available'] };
  }

  // Re-seed then re-fetch everything
  await seedCuratedPodcasts(env.CACHE);

  // Force re-fetch by clearing fetch timestamps
  for (const podcast of ALL_CURATED_PODCASTS) {
    podcast.lastFetchAt = 0;
  }

  const result = await handlePodcastAggregation(env);
  return result;
}
