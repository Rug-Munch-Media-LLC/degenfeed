/**
 * @degenfeed/api-worker — Loops Live Bridge Handlers
 *
 * Bridge routes between DegenFeed and the Loops live streaming system.
 * Handles cross-platform broadcasting, stream lifecycle, and feed integration.
 *
 * Key endpoints:
 *   POST /api/loops/live/start      — Creator goes live on Loops
 *   POST /api/loops/live/stop       — Creator stops their Loops stream
 *   GET  /api/loops/live/active     — All active Loops streams
 *   POST /api/loops/live/broadcast  — Broadcast to 7+ platforms
 *   GET  /api/loops/live/broadcast/:id — Broadcast status
 *   GET  /api/loops/live/platforms  — Available broadcast platforms
 */

import { fetchLoopsLiveStreams, getLoopsLiveHealth } from '../feed/live-sources/loops';
import {
  broadcastToAllPlatforms,
  getAllPlatforms,
  getBroadcastRecord,
  getPlatformEmoji,
  getPlatformLabel,
  type LoopsBroadcastConfig,
  markStreamEnded,
  type TargetPlatform,
} from '../lib/loops-broadcaster';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Helpers ──────────────────────────────────────────────────────────────

const DEFAULT_LOOPS_INSTANCE = 'https://loops.video';

async function loopsFetch(env: Env, path: string, options?: RequestInit): Promise<Response> {
  const instance = env.LOOPS_INSTANCE_URL || DEFAULT_LOOPS_INSTANCE;
  return fetch(`${instance}/api/loops/live${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(options?.headers as Record<string, string>),
    },
    signal: options?.signal || AbortSignal.timeout(10000),
  });
}

// ─── 1. Start Live Stream on Loops ───────────────────────────────────────

/**
 * POST /api/loops/live/start
 *
 * Creator starts a live stream on Loops.
 * Proxies to Loops API, then broadcasts to all configured platforms.
 *
 * Body: {
 *   title: string,
 *   description?: string,
 *   category?: string,
 *   tags?: string[],
 *   isVertical?: boolean,
 *   chatEnabled?: boolean,
 *   recordingEnabled?: boolean,
 *   broadcastTargets?: TargetPlatform[]
 * }
 */
export async function handleLoopsGoLive(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = (body.title as string)?.trim();

    if (!title) {
      return jsonResponse({ ok: false, error: 'Stream title is required' }, 400);
    }

    const creatorId = (body.creatorId as string) || `creator:${Date.now()}`;
    const creatorHandle = (body.creatorHandle as string) || `anon_${Date.now().toString(36)}`;
    const creatorDisplayName = (body.creatorDisplayName as string) || creatorHandle;

    // 1. Start the stream on Loops
    const loopsResp = await loopsFetch(env, '/start', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: (body.description as string) || '',
        category: (body.category as string) || 'General',
        tags: (body.tags as string[]) || [],
        is_vertical: body.isVertical !== false,
        chat_enabled: body.chatEnabled !== false,
        recording_enabled: body.recordingEnabled !== false,
      }),
    });

    if (!loopsResp.ok) {
      const errBody = await loopsResp.json().catch(() => ({ error: 'Loops API error' }));
      return jsonResponse(
        {
          ok: false,
          error: (errBody as Record<string, unknown>).message || 'Failed to start stream on Loops',
        },
        loopsResp.status,
      );
    }

    const loopsData = (await loopsResp.json()) as {
      ok: boolean;
      data: {
        id: string;
        streamKey: string;
        rtmpUrl: string;
        playbackUrl: string;
        title: string;
        isVertical: boolean;
        chatEnabled: boolean;
      };
    };

    const streamData = loopsData.data;

    // 2. Broadcast to multi-platform targets
    const targets = (body.broadcastTargets as TargetPlatform[]) || getAllPlatforms();

    // Fire broadcast in background (don't block response)
    const broadcastPromise = broadcastToAllPlatforms(env, {
      loopsStreamId: streamData.id,
      creatorId,
      creatorDisplayName,
      creatorUsername: creatorHandle,
      title,
      description: (body.description as string) || '',
      playbackUrl: streamData.playbackUrl,
      thumbnailUrl: (body.thumbnailUrl as string) || undefined,
      category: (body.category as string) || 'General',
      tags: (body.tags as string[]) || [],
      isVertical: body.isVertical !== false,
      targets,
    });

    // Don't await — broadcast happens asynchronously
    broadcastPromise
      .then((result) => {
        broadcastToAll(CHANNELS.FEED_NEW, {
          type: 'loops_broadcast_complete',
          streamId: streamData.id,
          successCount: result.successCount,
          failureCount: result.failureCount,
          platforms: result.results.map((r) => ({
            platform: r.platform,
            ok: r.ok,
            label: getPlatformLabel(r.platform),
            emoji: getPlatformEmoji(r.platform),
            url: r.url,
          })),
        });
      })
      .catch((err) => {
        console.error('[loops-live] Background broadcast failed:', err);
      });

    // 3. Return stream info to the creator
    return jsonResponse(
      {
        ok: true,
        id: streamData.id,
        streamKey: streamData.streamKey,
        rtmpUrl: streamData.rtmpUrl,
        playbackUrl: streamData.playbackUrl,
        title: streamData.title,
        isVertical: streamData.isVertical,
        chatEnabled: streamData.chatEnabled,
        broadcastTargets: targets,
      },
      201,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[loops-live] handleLoopsGoLive failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── 2. Stop Live Stream on Loops ────────────────────────────────────────

/**
 * POST /api/loops/live/stop
 *
 * Stop a Loops live stream.
 * Body: { streamId }
 */
export async function handleLoopsStopLive(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, string>;
    const streamId = body.streamId;

    if (!streamId) {
      return jsonResponse({ ok: false, error: 'streamId is required' }, 400);
    }

    const loopsResp = await loopsFetch(env, '/stop', {
      method: 'POST',
      body: JSON.stringify({ stream_id: streamId }),
    });

    // Mark broadcast as ended
    await markStreamEnded(env, streamId);

    // Broadcast stream ended event via WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_ended',
      streamId,
      source: 'loops',
    });

    if (!loopsResp.ok) {
      const errBody = await loopsResp.json().catch(() => ({ error: 'Loops API error' }));
      return jsonResponse(
        {
          ok: false,
          error: (errBody as Record<string, unknown>).message || 'Failed to stop stream',
        },
        loopsResp.status,
      );
    }

    const data = (await loopsResp.json()) as { ok: boolean; data?: Record<string, unknown> };
    return jsonResponse(data);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[loops-live] handleLoopsStopLive failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── 3. Get Active Loops Streams ─────────────────────────────────────────

/**
 * GET /api/loops/live/active
 *
 * Returns all currently active Loops live streams.
 * Supports ?refresh=true, ?limit=N
 */
export async function handleLoopsActive(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    if (forceRefresh) {
      // Bypass cache by fetching directly from Loops
      const loopsResp = await loopsFetch(env, `/active?limit=${limit}&refresh=1`);
      if (loopsResp.ok) {
        const data = (await loopsResp.json()) as { data: unknown[]; meta: { total: number } };
        return noCacheJsonResponse({
          data: data.data,
          meta: { ...data.meta, source: 'loops' },
        });
      }
    }

    // Use the aggregator's cached Loops feed
    const streams = await fetchLoopsLiveStreams(env);
    const limited = streams.slice(0, limit);

    return noCacheJsonResponse({
      data: limited,
      meta: { total: limited.length, source: 'loops', limit },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[loops-live] handleLoopsActive failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'loops', error } });
  }
}

// ─── 4. Broadcast to Platforms ───────────────────────────────────────────

/**
 * POST /api/loops/live/broadcast
 *
 * Manually trigger a multi-platform broadcast for a Loops stream.
 * Useful for re-broadcasting or targeting specific platforms.
 *
 * Body: { streamId, title, creatorId, creatorDisplayName, playbackUrl, targets? }
 */
export async function handleLoopsBroadcast(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as LoopsBroadcastConfig & {
      creatorId: string;
      creatorUsername: string;
    };

    if (!body.loopsStreamId || !body.title || !body.playbackUrl) {
      return jsonResponse(
        { ok: false, error: 'loopsStreamId, title, and playbackUrl are required' },
        400,
      );
    }

    const result = await broadcastToAllPlatforms(env, body);

    return jsonResponse({
      ok: true,
      data: {
        streamId: body.loopsStreamId,
        results: result.results.map((r) => ({
          platform: r.platform,
          label: getPlatformLabel(r.platform),
          emoji: getPlatformEmoji(r.platform),
          ok: r.ok,
          url: r.url,
          error: r.error,
        })),
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalPlatforms: result.totalPlatforms,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[loops-live] handleLoopsBroadcast failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── 5. Get Broadcast Status ─────────────────────────────────────────────

/**
 * GET /api/loops/live/broadcast/:id
 *
 * Get the broadcast status/results for a Loops stream.
 */
export async function handleLoopsBroadcastStatus(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const record = await getBroadcastRecord(env, streamId);
    if (!record) {
      return jsonResponse(
        { data: null, meta: { streamId, error: 'No broadcast record found' } },
        404,
      );
    }

    return noCacheJsonResponse({
      data: {
        streamId,
        results: record.results.map((r) => ({
          platform: r.platform,
          label: getPlatformLabel(r.platform),
          emoji: getPlatformEmoji(r.platform),
          ok: r.ok,
          url: r.url,
          error: r.error,
          latencyMs: r.latencyMs,
        })),
        successCount: record.successCount,
        failureCount: record.failureCount,
        totalPlatforms: record.totalPlatforms,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: null, meta: { streamId, error } });
  }
}

// ─── 6. Get Available Platforms ──────────────────────────────────────────

/**
 * GET /api/loops/live/platforms
 *
 * Get all available broadcast platforms with their status.
 */
export async function handleLoopsPlatforms(_request: Request, env: Env): Promise<Response> {
  const platforms = getAllPlatforms().map((p) => ({
    id: p,
    label: getPlatformLabel(p),
    emoji: getPlatformEmoji(p),
    // Check if configured
    configured: isPlatformConfigured(env, p),
  }));

  return noCacheJsonResponse({
    data: platforms,
    meta: { total: platforms.length },
  });
}

function isPlatformConfigured(env: Env, platform: TargetPlatform): boolean {
  switch (platform) {
    case 'farcaster':
      return !!(env.FARCASTER_BOT_SIGNER_KEY && env.FARCASTER_BOT_FID);
    case 'nostr':
      return !!env.NOSTR_PRIVATE_KEY;
    case 'bluesky':
      return !!(env.BSKY_ACCESS_TOKEN && env.BSKY_DID);
    case 'mastodon':
      return !!(env.GTS_ACCESS_TOKEN && env.GOTOSOCIAL_INSTANCE_URL);
    case 'peertube':
      return !!env.PEERTUBE_INSTANCE_URL;
    case 'owncast':
      return !!env.OWNCAST_INSTANCE_URL;
    case 'telegram':
      return !!env.TELEGRAM_BOT_TOKEN;
    default:
      return false;
  }
}

// ─── 7. Loops Live Health ────────────────────────────────────────────────

/**
 * GET /api/loops/live/health
 *
 * Get health status of the Loops live system.
 */
export async function handleLoopsHealth(_request: Request, env: Env): Promise<Response> {
  try {
    const health = await getLoopsLiveHealth(env);
    return noCacheJsonResponse({ data: health });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: { healthy: false, activeStreams: 0, error } });
  }
}
