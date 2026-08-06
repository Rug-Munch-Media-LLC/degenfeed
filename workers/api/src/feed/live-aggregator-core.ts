/**
 * @degenfeed/api-worker — Live Aggregator Core
 *
 * Master aggregation functions that combine all sources.
 */

import { edgeCacheGet, edgeCacheGetOr, edgeCachePut } from '../lib/edge-cache';
import type { Env } from '../types';
import { getAggregatedCache, setAggregatedCache, upcomingCacheKey } from './live-aggregator-health';
import {
  fetchDegenFeedSpaces,
  fetchFarcasterLiveStreams,
  fetchNostrLiveStreams,
  fetchOwncastStreams,
  fetchPeerTubeStreams,
  fetchTwitchStreams,
} from './live-aggregator-sources-platform';
import { fetchYouTubeLiveStreams } from './live-aggregator-sources-youtube';
import type { UnifiedLiveStream, UpcomingStream } from './live-aggregator-types';
import { fetchKickLiveStreams } from './live-sources/kick';
import { fetchLoopsLiveStreams } from './live-sources/loops';
import { processLiveNotifications } from './live-sources/notifications';
import { fetchCuratedTwitchStreams } from './live-sources/twitch';

/**
 * Fetch all live streams from every source in parallel.
 * Results are cached in KV for 15 seconds.
 */
export async function aggregateAllStreams(
  env: Env,
  forceRefresh = false,
): Promise<UnifiedLiveStream[]> {
  if (!forceRefresh) {
    const cached = await getAggregatedCache(env);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const results = await Promise.allSettled([
    fetchOwncastStreams(env),
    fetchPeerTubeStreams(env),
    fetchYouTubeLiveStreams(env),
    fetchTwitchStreams(env),
    fetchCuratedTwitchStreams(env),
    fetchKickLiveStreams(env),
    fetchDegenFeedSpaces(env),
    fetchFarcasterLiveStreams(env),
    fetchNostrLiveStreams(env),
    fetchLoopsLiveStreams(env),
  ]);

  const allStreams: UnifiedLiveStream[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allStreams.push(...result.value);
    }
  }

  allStreams.sort((a, b) => b.viewerCount - a.viewerCount);

  if (allStreams.length > 0) {
    await setAggregatedCache(env, allStreams, 15);
  }

  if (
    typeof (env as Record<string, string | undefined>).IS_CRON !== 'undefined' &&
    (env as Record<string, string | undefined>).IS_CRON
  ) {
    processLiveNotifications(env, allStreams).catch((e) =>
      console.error('[live-aggregator] Notification processing failed:', e),
    );
  }

  return allStreams;
}

/**
 * Fetch upcoming/scheduled streams from all sources.
 */
export async function aggregateUpcomingStreams(env: Env): Promise<UpcomingStream[]> {
  const upcoming: UpcomingStream[] = [];

  try {
    const cached = await edgeCacheGet(env, upcomingCacheKey());
    if (cached) return JSON.parse(cached) as UpcomingStream[];
  } catch {
    // Fall through
  }

  // PeerTube upcoming
  try {
    const peertubeUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
    const resp = await fetch(
      `${peertubeUrl}/api/v1/videos?isLive=false&sort=-publishedAt&count=10`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (resp.ok) {
      // Placeholder — PeerTube doesn't natively expose scheduled live
    }
  } catch {
    // Non-critical
  }

  // DegenFeed Spaces upcoming
  try {
    const raw = await edgeCacheGetOr(
      env,
      'spaces:upcoming',
      60,
      () => env.SPACES?.get('spaces:upcoming') ?? null,
    );
    if (raw) {
      const upcomingIds = JSON.parse(raw) as string[];
      const results = await Promise.all(
        upcomingIds.map((id) =>
          edgeCacheGetOr(env, `spaces:${id}`, 60, () => env.SPACES?.get(`spaces:${id}`) ?? null),
        ),
      );
      for (const raw of results) {
        if (!raw) continue;
        try {
          const space = JSON.parse(raw) as {
            id: string;
            title: string;
            hostName: string;
            hostId: string;
            hostAvatarUrl?: string;
            scheduledAt: string;
            tags: string[];
            status: string;
          };
          if (space.status !== 'scheduled') continue;
          upcoming.push({
            id: `spaces:${space.id}`,
            source: 'spaces',
            title: space.title,
            streamer: {
              id: `spaces:host:${space.hostId}`,
              handle: space.hostName,
              displayName: space.hostName,
              avatarUrl: space.hostAvatarUrl,
              walletAddress: space.hostId,
            },
            thumbnailUrl: space.hostAvatarUrl || '',
            scheduledAt: new Date(space.scheduledAt).getTime(),
            category: 'Talk Shows & Podcasts',
            tags: space.tags || ['spaces', 'upcoming'],
          });
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    // Non-critical
  }

  upcoming.sort((a, b) => a.scheduledAt - b.scheduledAt);

  if (upcoming.length > 0) {
    await edgeCachePut(env, upcomingCacheKey(), JSON.stringify(upcoming), 60);
  }

  return upcoming;
}
