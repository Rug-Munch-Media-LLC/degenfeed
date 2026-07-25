/**
 * @degenfeed/api-worker — Live Route Handlers
 *
 * Live/streaming route handlers. All endpoints are wired to the live
 * aggregator which fetches from Owncast, PeerTube, YouTube, Twitch, Kick,
 * Spaces, Farcaster, and Nostr in parallel.
 *
 * Rules:
 *   - Every provider integration has: error handling, rate limit tracking,
 *     response validation, fallback
 *   - No silent failures. No unhandled API changes.
 *   - All provider responses validated before passing to scanners
 */

import {
  aggregateAllStreams,
  aggregateUpcomingStreams,
  createSchedule,
  generateLiveId,
  getSourceHealth,
  getStreamViewerCount,
  startLiveStream,
  stopLiveStream,
  type UnifiedLiveStream,
} from '../../feed/live-aggregator';
import { isKickChannelLive } from '../../feed/live-sources/kick';
import {
  detectLiveWatchedCreators,
  getPendingNotifications,
  getWatchedCreators,
  unwatchCreator,
  upsertWatcherProfile,
  watchCreator,
} from '../../feed/live-sources/notifications';
import { fetchCuratedTwitchStreams } from '../../feed/live-sources/twitch';
import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';

// ─── Source-specific Routes ────────────────────────────────────────────

/**
 * GET /api/live/sources/peertube/instances
 * Returns available PeerTube instances and their live status.
 */
export async function handlePeerTubeInstances(_request: Request, env: Env): Promise<Response> {
  try {
    const instancesStr = env.PEERTUBE_EXTRA_INSTANCES || '';
    const defaultInstance = env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';
    const extraInstances = instancesStr
      ? instancesStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const allInstances = [defaultInstance, ...extraInstances];
    const results = await Promise.allSettled(
      allInstances.map(async (url) => {
        try {
          const resp = await fetch(`${url}/api/v1/videos?isLive=true&count=1`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!resp.ok) {
            return { url, healthy: false, error: `HTTP ${resp.status}`, liveCount: 0 };
          }
          const data = (await resp.json()) as { total?: number };
          return { url, healthy: true, liveCount: data.total || 0, error: null };
        } catch (e) {
          return { url, healthy: false, error: (e as Error).message, liveCount: 0 };
        }
      }),
    );

    const instances = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { url: 'unknown', healthy: false, error: 'Failed to check', liveCount: 0 },
    );

    return noCacheJsonResponse({
      data: instances,
      meta: { total: instances.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * GET /api/live/sources/twitch/curated
 * Returns curated Twitch channel live status.
 */
export async function handleTwitchCurated(_request: Request, env: Env): Promise<Response> {
  try {
    const limitParam = new URL(_request.url).searchParams.get('limit');
    const limit = Math.min(Number.parseInt(limitParam || '50', 10), 100);
    const streams = await fetchCuratedTwitchStreams(env);
    return noCacheJsonResponse({
      data: streams.slice(0, limit),
      meta: { total: streams.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * GET /api/live/kick/status/:channel
 * Check if a specific Kick channel is live.
 */
export async function handleKickChannelStatus(
  _request: Request,
  _env: Env,
  channel: string,
): Promise<Response> {
  try {
    const result = await isKickChannelLive(channel);
    return noCacheJsonResponse({
      data: { channel, live: result.isLive, stream: result.stream || null },
      meta: {},
    });
  } catch {
    return jsonResponse({ data: { channel, live: false }, meta: {} });
  }
}
