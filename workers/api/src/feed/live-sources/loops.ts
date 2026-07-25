/**
 * @degenfeed/api-worker — Loops Live Source Fetcher
 *
 * Fetches active live streams from the Loops API and normalizes them
 * into UnifiedLiveStream format for the DegenFeed live aggregator.
 *
 * Every Loops live stream is vertical (9:16) TikTok-style.
 * Includes: HLS playback URL, viewer count, chat status, gift count, etc.
 *
 * Error handling: transient errors logged, never blocks aggregation,
 * source health tracked independently.
 */

import type { Env } from '../../index';
import type { LiveSource, UnifiedLiveStream } from '../live-aggregator';
import { trackSourceHealth } from '../live-aggregator';

interface LoopsLiveStreamData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  status: string;
  isLive: boolean;
  streamKey: string;
  rtmpUrl: string;
  hlsUrl?: string;
  playbackUrl: string;
  previewUrl?: string;
  thumbnail?: string;
  viewerCount: number;
  peakViewerCount: number;
  likeCount: number;
  shareCount: number;
  giftCount: number;
  isVertical: boolean;
  chatEnabled: boolean;
  simulcastTargets: Array<{ platform: string; status: string }>;
  broadcastPlatforms: string[];
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  } | null;
  startedAt: string;
}

interface LoopsLiveApiResponse {
  data: LoopsLiveStreamData[];
  meta: { total: number; source: string; limit: number };
}

/**
 * DEFAULT_LOOPS_INSTANCE — our self-hosted Loops instance.
 * Override via env.LOOPS_INSTANCE_URL for staging/dev.
 */
const DEFAULT_LOOPS_INSTANCE = 'https://loops.video';

/**
 * Cache TTL for Loops live list (5 seconds — lives change fast).
 */
const CACHE_TTL = 5;

/**
 * KV key for cached Loops live streams.
 */
function loopsLiveCacheKey(): string {
  return 'loops:live:active';
}

/**
 * Fetch currently active Loops live streams from the Loops API.
 *
 * The Loops API returns TikTok-style vertical live streams.
 * We normalize them into the DegenFeed UnifiedLiveStream format.
 */
export async function fetchLoopsLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const startTime = Date.now();
  const loopsInstance = env.LOOPS_INSTANCE_URL || DEFAULT_LOOPS_INSTANCE;
  const streams: UnifiedLiveStream[] = [];

  try {
    // Check KV cache first for performance
    const cached = await env.CACHE?.get(loopsLiveCacheKey());
    if (cached) {
      const parsed = JSON.parse(cached) as UnifiedLiveStream[];
      if (parsed.length > 0) {
        return parsed;
      }
    }

    // Fetch active streams from Loops
    const response = await fetch(
      `${loopsInstance}/api/loops/live/active?limit=50`,
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'DegenFeed/1.0 (live-aggregator)',
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      throw new Error(`Loops API returned ${response.status}`);
    }

    const result = (await response.json()) as LoopsLiveApiResponse;
    const activeStreams = result.data || [];

    for (const ls of activeStreams) {
      if (!ls.isLive || ls.status !== 'live') continue;

      // Determine simulcast sources this stream is broadcasting to
      const simulcastSources: LiveSource[] = [];
      if (ls.broadcastPlatforms) {
        if (ls.broadcastPlatforms.includes('farcaster')) simulcastSources.push('farcaster' as LiveSource);
        if (ls.broadcastPlatforms.includes('nostr')) simulcastSources.push('nostr' as LiveSource);
      }

      const stream: UnifiedLiveStream = {
        id: `loops:${ls.id}`,
        source: 'degenfeed' as LiveSource,
        title: ls.title,
        streamer: {
          id: `loops:profile:${ls.creator?.id || 'unknown'}`,
          handle: ls.creator?.username || 'anonymous',
          displayName: ls.creator?.displayName || 'Anonymous Streamer',
          avatarUrl: ls.creator?.avatar,
        },
        thumbnailUrl: ls.thumbnail || ls.previewUrl || '',
        viewerCount: ls.viewerCount || 0,
        startedAt: ls.startedAt ? new Date(ls.startedAt).getTime() : Date.now(),
        category: ls.category || 'General',
        tags: ['loops', 'live', 'vertical', ...(ls.tags || [])],
        isLive: true,
        embedUrl: ls.playbackUrl || ls.hlsUrl || '',
        chatEnabled: ls.chatEnabled !== false,
        platformMeta: {
          hlsUrl: ls.hlsUrl,
          rtmpUrl: ls.rtmpUrl,
          loopsId: ls.id,
          likeCount: ls.likeCount,
          giftCount: ls.giftCount,
          shareCount: ls.shareCount,
          peakViewerCount: ls.peakViewerCount,
          isVertical: ls.isVertical,
          simulcastTargets: ls.simulcastTargets,
          broadcastPlatforms: ls.broadcastPlatforms,
        },
        simulcastSources: simulcastSources.length > 0 ? simulcastSources : undefined,
      };

      streams.push(stream);
    }

    // Cache for 5 seconds
    if (streams.length > 0) {
      await env.CACHE?.put(loopsLiveCacheKey(), JSON.stringify(streams), {
        expirationTtl: CACHE_TTL,
      });
    }

    await trackSourceHealth(env, 'degenfeed' as LiveSource, streams.length, Date.now() - startTime);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[loops-live-source] Failed to fetch Loops live streams:', error);
    await trackSourceHealth(env, 'degenfeed' as LiveSource, 0, Date.now() - startTime, error);
  }

  return streams;
}

/**
 * Get Loops live system health status.
 */
export async function getLoopsLiveHealth(env: Env): Promise<{
  healthy: boolean;
  activeStreams: number;
  error?: string;
}> {
  const loopsInstance = env.LOOPS_INSTANCE_URL || DEFAULT_LOOPS_INSTANCE;

  try {
    const response = await fetch(`${loopsInstance}/api/loops/live/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = (await response.json()) as { data: { activeStreams: number } };
      return { healthy: true, activeStreams: data.data?.activeStreams || 0 };
    }
    return { healthy: false, activeStreams: 0, error: `HTTP ${response.status}` };
  } catch (err) {
    return {
      healthy: false,
      activeStreams: 0,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}
