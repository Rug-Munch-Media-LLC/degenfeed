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
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';

// ─── Helpers ──────────────────────────────────────────────────────────

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    owncast: 'Owncast',
    peertube: 'PeerTube',
    youtube: 'YouTube',
    twitch: 'Twitch',
    kick: 'Kick',
    spaces: 'Spaces',
    farcaster: 'Farcaster',
    nostr: 'Nostr',
    degenfeed: 'DegenFeed',
    loops: 'Loops Live',
    lens: 'Lens',
    zora: 'Zora',
  };
  return labels[source] || source;
}

// ─── Core Live Handlers ────────────────────────────────────────────────

/**
 * GET /api/live/now
 * Returns all currently live streams aggregated from all sources.
 * Supports ?refresh=true to bypass cache, ?source=twitch to filter, ?limit=N
 */
export async function handleLiveNow(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const sourceFilter = url.searchParams.get('source');
    const limitParam = url.searchParams.get('limit');

    const allStreams = await aggregateAllStreams(env, forceRefresh);

    let filtered = allStreams;
    if (sourceFilter) {
      const sources = sourceFilter.split(',') as UnifiedLiveStream['source'][];
      filtered = allStreams.filter((s) => sources.includes(s.source));
    }

    if (limitParam) {
      const limit = Math.min(Number.parseInt(limitParam, 10) || 25, 100);
      filtered = filtered.slice(0, limit);
    }

    const sourceCounts: Record<string, number> = {};
    for (const s of allStreams) {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
    }

    return noCacheJsonResponse({
      data: filtered,
      meta: {
        total: filtered.length,
        totalAllSources: allStreams.length,
        source: 'live',
        sourceCounts,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveNow failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/upcoming
 * Returns scheduled/upcoming streams from all sources.
 */
export async function handleLiveUpcoming(_request: Request, env: Env): Promise<Response> {
  try {
    const upcoming = await aggregateUpcomingStreams(env);
    return noCacheJsonResponse({
      data: upcoming,
      meta: { total: upcoming.length, source: 'live' },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveUpcoming failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/sources
 * Returns available live sources with health status.
 */
export async function handleLiveSources(_request: Request, env: Env): Promise<Response> {
  try {
    const health = await getSourceHealth(env);

    const sources = Object.entries(health).map(([source, h]) => ({
      source,
      label: sourceLabel(source),
      healthy: h.healthy,
      lastChecked: h.lastChecked,
      error: h.error || null,
      streamCount: h.streamCount,
      latencyMs: h.latencyMs,
    }));

    // Always include all known sources even if never checked
    const knownSources = [
      'owncast',
      'peertube',
      'youtube',
      'twitch',
      'kick',
      'spaces',
      'farcaster',
      'nostr',
      'loops',
    ];

    for (const src of knownSources) {
      if (!sources.find((s) => s.source === src)) {
        sources.push({
          source: src,
          label: sourceLabel(src),
          healthy: false,
          lastChecked: 0,
          error: 'Not yet checked',
          streamCount: 0,
          latencyMs: 0,
        });
      }
    }

    return noCacheJsonResponse({
      data: sources,
      meta: { total: sources.length, source: 'live' },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveSources failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/:id
 * Returns details for a specific stream by ID.
 */
export async function handleLiveDetails(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  try {
    // Check if it's a legacy stream record in CONTENT_STORE
    const raw = await env.CONTENT_STORE?.get(`stream:record:${id}`);
    if (raw) {
      try {
        const record = JSON.parse(raw);
        return noCacheJsonResponse({ data: record, meta: { id } });
      } catch {
        // Fall through to live aggregator
      }
    }

    // Search in aggregated live streams
    const allStreams = await aggregateAllStreams(env);
    const stream = allStreams.find((s) => s.id === id);

    if (!stream) {
      // Also check by creator handle
      const byHandle = allStreams.find(
        (s) => s.streamer.handle === id || s.streamer.displayName === id,
      );
      if (byHandle) {
        return noCacheJsonResponse({ data: byHandle, meta: { id } });
      }
      return jsonResponse({ data: null, meta: { id, error: 'Stream not found' } }, 404);
    }

    return noCacheJsonResponse({ data: stream, meta: { id } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveDetails failed:', error);
    return jsonResponse({ data: null, meta: { id, error } });
  }
}

/**
 * GET /api/live/creators/:id
 * Returns live status for a specific creator across all platforms.
 */
export async function handleCreatorLiveProfile(
  _request: Request,
  env: Env,
  creatorId: string,
): Promise<Response> {
  try {
    const allStreams = await aggregateAllStreams(env);
    const creatorStreams = allStreams.filter(
      (s) =>
        s.streamer.id === creatorId ||
        s.streamer.handle === creatorId ||
        s.streamer.displayName === creatorId ||
        s.streamer.walletAddress === creatorId,
    );

    return noCacheJsonResponse({
      data: {
        isLive: creatorStreams.length > 0,
        streams: creatorStreams,
      },
      meta: { creatorId, total: creatorStreams.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: { isLive: false, streams: [] }, meta: { creatorId, error } });
  }
}

// ─── Go Live / Stop Live ───────────────────────────────────────────────

/**
 * POST /api/live/go-live
 * Start a live stream on Owncast and/or PeerTube.
 * Returns stream keys and URLs. Announces on Nostr, Farcaster, ActivityPub.
 *
 * Body:
 *   { title, description?, category?, tags?, platform: 'owncast'|'peertube'|'both',
 *     privacy?, recordingEnabled?, chatEnabled?, thumbnailUrl?, creatorId, creatorHandle,
 *     creatorDisplayName?, creatorAvatarUrl? }
 */
export async function handleGoLive(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = (body.title as string)?.trim();
    if (!title) {
      return jsonResponse({ ok: false, error: 'Stream title is required' }, 400);
    }

    // Extract creator info from request or generate defaults
    const creatorId = (body.creatorId as string) || `creator:${Date.now()}`;
    const creatorHandle = (body.creatorHandle as string) || `anon_${Date.now().toString(36)}`;

    const config = {
      title,
      description: (body.description as string) || '',
      category: (body.category as string) || 'General',
      tags: (body.tags as string[]) || [],
      privacy: (body.privacy as 'public' | 'unlisted' | 'private') || 'public',
      recordingEnabled: body.recordingEnabled !== false,
      chatEnabled: body.chatEnabled !== false,
      platform: (body.platform as 'owncast' | 'peertube' | 'both') || 'owncast',
      thumbnailUrl: (body.thumbnailUrl as string) || undefined,
      creatorId,
      creatorHandle,
      creatorDisplayName: (body.creatorDisplayName as string) || creatorHandle,
      creatorAvatarUrl: (body.creatorAvatarUrl as string) || undefined,
    };

    const result = await startLiveStream(env, config);

    // Broadcast go-live event to WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_started',
      streamId: result.streamId,
      platform: config.platform,
      title: config.title,
      creatorId: config.creatorId,
      creatorHandle: config.creatorHandle,
      playbackUrl: result.playbackUrl,
      startedAt: Date.now(),
    });

    return jsonResponse(
      {
        ok: true,
        id: result.streamId,
        streamKey: result.streamKey,
        rtmpUrl: result.rtmpUrl,
        playbackUrl: result.playbackUrl,
        embedUrl: result.embedUrl,
        platformMessages: result.platformMessages,
      },
      201,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleGoLive failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/stop
 * Stop a live stream on the active platform.
 * Body: { streamId, platform }
 */
export async function handleStopLive(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = streamId ? { streamId } : ((await request.json()) as Record<string, string>);

    const id = body.streamId || streamId;
    const platform = (body.platform as 'owncast' | 'peertube' | 'spaces') || 'owncast';

    if (!id) {
      return jsonResponse({ ok: false, error: 'streamId is required' }, 400);
    }

    await stopLiveStream(env, id, platform);

    // Broadcast stop-live event
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_ended',
      streamId: id,
      platform,
    });

    return jsonResponse({ ok: true, streamId: id, platform });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── Schedule Stream ───────────────────────────────────────────────────

/**
 * POST /api/live/schedule
 * Schedule a future stream and store in KV.
 * Creates notifications for followers when stream starts.
 *
 * Body:
 *   { title, description?, scheduledAt (ISO), category?, tags?, privacy?,
 *     recordingEnabled?, chatEnabled?, creatorId, creatorHandle? }
 */
export async function handleScheduleStream(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = (body.title as string)?.trim();
    if (!title) {
      return jsonResponse({ ok: false, error: 'Schedule title is required' }, 400);
    }

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt as string).getTime()
      : Date.now() + 3600000; // Default: 1 hour from now

    if (scheduledAt < Date.now()) {
      return jsonResponse({ ok: false, error: 'Scheduled time must be in the future' }, 400);
    }

    const id = generateLiveId();
    const schedule = {
      id,
      creatorId: (body.creatorId as string) || `creator:${Date.now()}`,
      title,
      description: (body.description as string) || '',
      source: (body.source as UnifiedLiveStream['source']) || 'owncast',
      scheduledAt,
      category: (body.category as string) || 'General',
      tags: (body.tags as string[]) || [],
      privacy: (body.privacy as 'public' | 'unlisted' | 'private') || 'public',
      recordingEnabled: body.recordingEnabled !== false,
      chatEnabled: body.chatEnabled !== false,
      thumbnailUrl: (body.thumbnailUrl as string) || undefined,
      createdAt: Date.now(),
    };

    // Store in KV via aggregator's createSchedule
    await createSchedule(env, schedule);

    // Notify followers via WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_scheduled',
      schedule,
    });

    return jsonResponse({ ok: true, id, schedule }, 201);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleScheduleStream failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}
