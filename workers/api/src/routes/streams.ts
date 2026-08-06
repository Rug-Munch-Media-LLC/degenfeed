/**
 * @degenfeed/api-worker — Stream Management & Announcement
 *
 * When a creator goes live, this module handles:
 *   1. Recording the stream metadata
 *   2. Announcing the stream to ALL linked protocols
 *   3. Broadcasting to the DegenFeed WebSocket
 *
 * Routes:
 *   POST /announce  — create and announce a stream to all linked protocols
 *   GET  /:id       — get stream record by ID
 */

import { Hono } from 'hono';
import { aggregateAllStreams, aggregateUpcomingStreams } from '../feed/live-aggregator';
import { listPostizSchedules, scheduleCrossPlatformPost } from '../lib/postiz-bridge';
import {
  startRestreamProcess,
  type RestreamerTarget,
} from '../lib/restreamer';
import {
  announceStreamToAllProtocols,
  type StreamAnnouncement,
  type StreamType,
} from '../lib/stream-announcer';
import { requirePremiumTier } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { handleGoLive } from './live/handlers-core';
import { requireSession } from '../session';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Router ──────────────────────────────────────────────────────────────

const streams = new Hono<{ Bindings: Env }>();

// ─── Frontend Live API ─────────────────────────────────────────────────────

/**
 * GET /live — Unified live stream feed for the frontend.
 *
 * Returns aggregated live streams from all sources (Owncast, PeerTube, YouTube,
 * Twitch, Kick, Spaces, Farcaster, Nostr) formatted for the /live page.
 *
 * Query params:
 *   ?refresh=true  — bypass cache
 *   ?source=twitch — filter by source (comma-separated)
 *   ?limit=N       — max items (default 50, max 100)
 */
streams.get('/live', async (c) => {
  try {
    const url = new URL(c.req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const sourceFilter = url.searchParams.get('source');
    const limitParam = url.searchParams.get('limit');

    const allStreams = await aggregateAllStreams(c.env, forceRefresh);

    let filtered = allStreams;
    if (sourceFilter) {
      const sources = sourceFilter.split(',');
      filtered = allStreams.filter((s) => sources.includes(s.source));
    }

    if (limitParam) {
      const limit = Math.min(Number.parseInt(limitParam, 10) || 50, 100);
      filtered = filtered.slice(0, limit);
    }

    // Sort by viewer count descending
    const sorted = [...filtered].sort((a, b) => b.viewerCount - a.viewerCount);

    // Top 5 for featured
    const featured = sorted.slice(0, 5);

    // Aggregate source counts
    const sourceCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const s of allStreams) {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
      const cat = (s.category || 'general').toLowerCase();
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // Convert to frontend-friendly format
    const sourceLabel = (src: string): string => {
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
      };
      return labels[src] || src;
    };

    const formattedStreams = sorted.map((s) => ({
      id: s.id,
      title: s.title,
      creatorId: s.streamer.id,
      creatorHandle: s.streamer.handle,
      creatorAvatar: s.streamer.avatarUrl,
      streamType: s.source === 'spaces' ? 'spaces' : s.source === 'farcaster' ? 'collab' : 'solo',
      source: s.source,
      sourceLabel: sourceLabel(s.source),
      sourceColor: sourceColorMap(s.source),
      viewerCount: s.viewerCount,
      thumbnailUrl: s.thumbnailUrl,
      isLive: s.isLive,
      startedAt: s.startedAt,
      tags: s.tags,
      category: s.category,
      embedUrl: s.embedUrl,
      platformMeta: s.platformMeta,
      streamer: s.streamer,
    }));

    return noCacheJsonResponse({
      streams: formattedStreams,
      featured: featured.map((s) => ({
        id: s.id,
        title: s.title,
        creatorId: s.streamer.id,
        creatorHandle: s.streamer.handle,
        creatorAvatar: s.streamer.avatarUrl,
        streamType: s.source === 'spaces' ? 'spaces' : 'solo',
        source: s.source,
        sourceLabel: sourceLabel(s.source),
        sourceColor: sourceColorMap(s.source),
        viewerCount: s.viewerCount,
        thumbnailUrl: s.thumbnailUrl,
        isLive: s.isLive,
        startedAt: s.startedAt,
        tags: s.tags,
        category: s.category,
        embedUrl: s.embedUrl,
        platformMeta: s.platformMeta,
        streamer: s.streamer,
      })),
      total: allStreams.length,
      sourceCounts,
      categoryCounts,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[streams] GET /live failed:', error);
    return jsonResponse({
      streams: [],
      featured: [],
      total: 0,
      sourceCounts: {},
      categoryCounts: {},
      error,
    });
  }
});

function sourceColorMap(source: string): string {
  const colors: Record<string, string> = {
    twitch: '#9146FF',
    kick: '#53FC18',
    peertube: '#F1684B',
    owncast: '#00ff41',
    youtube: '#FF0000',
    spaces: '#00BCD4',
    farcaster: '#8A63D2',
    nostr: '#E87928',
    degenfeed: '#00ff41',
  };
  return colors[source] || '#888';
}

// ═══════════════════════════════════════════════════════════════════════
// GET /schedule — Scheduled / upcoming streams (aggregator + Postiz)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /schedule — Upcoming streams from all sources, plus Postiz-scheduled
 * cross-platform posts (premium scheduling).
 *
 * Query params:
 *   ?source=spaces — filter by source (comma-separated)
 *   ?includePostiz=true — include Postiz schedules (default true)
 *   ?limit=N — max items (default 50)
 */
streams.get('/schedule', async (c) => {
  try {
    const url = new URL(c.req.url);
    const sourceFilter = url.searchParams.get('source');
    const includePostiz = url.searchParams.get('includePostiz') !== 'false';
    const limit = Math.min(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 100);

    const [upcoming, postizSchedules] = await Promise.all([
      aggregateUpcomingStreams(c.env),
      includePostiz
        ? listPostizSchedules(c.env, 'scheduled', limit).catch(() => [])
        : Promise.resolve([]),
    ]);

    let items: Array<{
      id: string;
      title: string;
      source: string;
      streamer: { id: string; handle: string; displayName: string };
      scheduledAt: number;
      category: string;
      tags: string[];
      thumbnailUrl: string;
      platformMeta?: Record<string, unknown>;
    }> = upcoming.map((s) => ({
      id: s.id,
      title: s.title,
      source: s.source,
      streamer: s.streamer,
      scheduledAt: s.scheduledAt,
      category: s.category,
      tags: s.tags,
      thumbnailUrl: s.thumbnailUrl,
    }));

    // Merge Postiz schedules as 'postiz' source entries
    const postizItems = postizSchedules.map((p) => ({
      id: `postiz:${p.id}`,
      title: p.platforms?.join(' + ') || 'Scheduled post',
      source: 'postiz',
      streamer: { id: 'postiz', handle: 'Postiz', displayName: 'Postiz' },
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).getTime() : Date.now(),
      category: 'general',
      tags: [],
      thumbnailUrl: '',
      platformMeta: { postiz: true, status: p.status, platforms: p.platforms },
    }));

    items = [...items, ...postizItems];

    if (sourceFilter) {
      const sources = sourceFilter.split(',');
      items = items.filter((s) => sources.includes(s.source));
    }

    items.sort((a, b) => a.scheduledAt - b.scheduledAt);

    return noCacheJsonResponse({
      streams: items.slice(0, limit),
      total: items.length,
      sources: { aggregator: upcoming.length, postiz: postizItems.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[streams] GET /schedule failed:', error);
    return jsonResponse({ streams: [], total: 0, sources: {}, error });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /go-live — Premium: start a live stream on Owncast/PeerTube
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /go-live — Start a live stream. Requires a logged-in session; the
 * multi-platform (Owncast + PeerTube) path is premium-gated.
 *
 * Body (same shape as POST /api/live/go-live):
 *   { title, description?, category?, tags?, platform: 'owncast'|'peertube'|'both'|'multi' }
 *
 * Premium 'multi' path (Restreamer → Postiz → Go Live):
 *   1. Postiz schedules the stream announcement on the creator's social platforms
 *   2. Restreamer (via the bridge) starts the multi-platform RTMP push to
 *      Twitch/Kick/YouTube
 *   3. The stream appears in /api/streams/live (Owncast aggregator)
 *
 * Delegates single-platform starts to the shared handler in
 * routes/live/handlers-core.ts — no duplicated orchestration logic.
 */
streams.post('/go-live', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const platform = (body.platform as string) || 'owncast';

    // Multi-platform ('both') and Restreamer multi-push ('multi') require premium
    if (platform === 'both' || platform === 'multi' || platform === 'restreamer') {
      const gate = await requirePremiumTier(session.address, c.env, 'pro');
      if (gate) return gate;
    }

    // ── Restreamer → Postiz → Go Live flow (premium) ───────────────────
    if (platform === 'multi' || platform === 'restreamer') {
      const title = (body.title as string)?.trim();
      if (!title) {
        return jsonResponse({ ok: false, error: 'Stream title is required' }, 400);
      }

      const results: Record<string, unknown> = {};

      // 1. Postiz schedules the stream announcement on social platforms
      const announcePlatforms = Array.isArray(body.announceTo)
        ? (body.announceTo as string[]).map((p) => String(p))
        : [];
      if (announcePlatforms.length > 0) {
        const announcement = await scheduleCrossPlatformPost(
          {
            text: `🔴 LIVE NOW: ${title} — watch on DegenFeed!\nhttps://app.degenfeed.xyz/live\n#DegenFeed #Live`,
            title,
            platforms: announcePlatforms,
            scheduledAt: null, // immediate
            hashtags: ['DegenFeed', 'Live'],
          },
          c.env,
        );
        results.announcement = announcement;
      } else {
        results.announcement = { ok: true, skipped: 'No announceTo platforms provided' };
      }

      // 2. Restreamer starts the multi-platform RTMP push (via bridge)
      const targets: RestreamerTarget[] = Array.isArray(body.restreamTargets)
        ? (body.restreamTargets as Array<{
            platform?: string;
            rtmpUrl?: string;
            streamKey?: string;
          }>)
            .filter((t) => t && t.platform && t.rtmpUrl && t.streamKey)
            .map((t) => ({
              platform: String(t.platform),
              rtmpUrl: String(t.rtmpUrl),
              streamKey: String(t.streamKey),
            }))
        : [];

      const owncastUrl = (c.env as Record<string, string>).OWNCAST_INSTANCE_URL
        || 'https://owncast.degenfeed.xyz';
      const restream = await startRestreamProcess(c.env, {
        streamId: `live-${Date.now().toString(36)}`,
        title,
        owncastHlsUrl: `${owncastUrl}/hls/stream.m3u8`,
        targets:
          targets.length > 0
            ? targets
            : [{ platform: 'peertube', rtmpUrl: 'rtmp://live.degenfeed.xyz/live', streamKey: 'degenfeed' }],
      });
      results.restream = restream;

      // 3. Delegate Owncast setup to the shared handler so the stream key is real
      const coreResult = await handleGoLive(c.req.raw, c.env);
      const coreBody = await coreResult.json().catch(() => ({}));

      return jsonResponse(
        {
          ok: true,
          platform: 'multi',
          announcement: results.announcement,
          restream: results.restream,
          stream: coreBody,
          note: 'Stream announcement scheduled via Postiz; Restreamer multi-platform push triggered via bridge.',
        },
        201,
      );
    }

    return await handleGoLive(c.req.raw, c.env);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: `Go live failed: ${msg}` }, 500);
  }
});

// ─── Constants ───────────────────────────────────────────────────────────

/** KV key prefix for stream records */
const STREAM_PREFIX = 'stream:record:';
/** Stream records expire after 7 days */
const STREAM_TTL = 86400 * 7;

// ─── KV helpers ──────────────────────────────────────────────────────────

function streamKey(streamId: string): string {
  return `${STREAM_PREFIX}${streamId}`;
}

function creatorStreamsKey(creator: string): string {
  return `stream:creator:${creator.toLowerCase()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────

interface StreamRecord {
  id: string;
  creator: string;
  creatorHandle: string;
  title: string;
  streamType: StreamType;
  streamUrl: string;
  thumbnail?: string;
  startedAt: number;
}

// ═══════════════════════════════════════════════════════════════════════
// POST /announce — Announce a stream to all linked protocols
// ═══════════════════════════════════════════════════════════════════════

/**
 * Announce a stream to all linked protocols.
 *
 * Flow:
 *   1. Validate the request body
 *   2. Store the stream record in KV
 *   3. Announce to ALL linked protocols in parallel (non-blocking via waitUntil)
 *   4. Broadcast to DegenFeed WebSocket
 *   5. Return the stream info
 */
streams.post('/announce', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    interface StreamAnnounceBody {
      title?: string;
      streamType?: string;
      streamUrl?: string;
      thumbnail?: string;
      creatorHandle?: string;
    }

    const body: StreamAnnounceBody = await c.req.json();
    const title = body.title?.trim();
    const streamType = (body.streamType || 'live') as StreamType;
    const streamUrl = body.streamUrl?.trim();
    const thumbnail = body.thumbnail?.trim();
    const creatorHandle =
      body.creatorHandle?.trim() || session.displayName || session.address.slice(0, 10);

    if (!title) {
      return jsonResponse({ error: 'Stream title is required' }, 400);
    }

    // Build the stream announcement
    const streamId = crypto.randomUUID();
    const fullStreamUrl = streamUrl || `https://app.degenfeed.xyz/live/${streamId}`;

    const announcement: StreamAnnouncement = {
      streamId,
      creator: session.address,
      creatorHandle,
      title,
      streamType,
      streamUrl: fullStreamUrl,
      ...(thumbnail ? { thumbnail } : {}),
    };

    // Store stream record in KV (fire-and-forget)
    const record: StreamRecord = {
      id: streamId,
      creator: session.address,
      creatorHandle,
      title,
      streamType,
      streamUrl: fullStreamUrl,
      ...(thumbnail ? { thumbnail } : {}),
      startedAt: Date.now(),
    };

    c.env.CONTENT_STORE?.put(streamKey(streamId), JSON.stringify(record), {
      expirationTtl: STREAM_TTL,
    }).catch(() => {});

    // Add to creator's stream index
    c.env.CONTENT_STORE?.get(creatorStreamsKey(session.address))
      .then((raw) => {
        const list: string[] = raw ? JSON.parse(raw) : [];
        list.unshift(streamId);
        c.env.CONTENT_STORE?.put(
          creatorStreamsKey(session.address),
          JSON.stringify(list.slice(0, 100)),
          { expirationTtl: STREAM_TTL },
        ).catch(() => {});
      })
      .catch(() => {});

    // Broadcast to DegenFeed WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_announced',
      stream: {
        id: streamId,
        title,
        creator: session.address,
        creatorHandle,
        streamType,
        streamUrl: fullStreamUrl,
        ...(thumbnail ? { thumbnail } : {}),
      },
    });

    // Announce to ALL linked protocols (non-blocking)
    const resultsPromise = announceStreamToAllProtocols(c.env, announcement);

    if (c.executionCtx) {
      // Fire-and-forget: let the runtime finish in the background
      c.executionCtx.waitUntil(resultsPromise);
      return jsonResponse(
        {
          ok: true,
          streamId,
          streamUrl: fullStreamUrl,
          note: 'Stream announcement dispatched to all linked protocols',
        },
        201,
      );
    }

    // No executionCtx — await results and include them
    const results = await resultsPromise;
    const successCount = Object.values(results).filter((r) => r.ok).length;
    const failureCount = Object.values(results).filter((r) => !r.ok).length;

    return jsonResponse(
      {
        ok: true,
        streamId,
        streamUrl: fullStreamUrl,
        announcements: {
          results,
          successCount,
          failureCount,
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Stream announce failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /:id — Get a stream record by ID
// ═══════════════════════════════════════════════════════════════════════

streams.get('/:id', async (c) => {
  const streamId = c.req.param('id');
  if (!streamId) {
    return jsonResponse({ error: 'Stream ID is required' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(streamKey(streamId));
    if (!raw) {
      return jsonResponse({ error: 'Stream not found' }, 404);
    }

    const record = JSON.parse(raw) as StreamRecord;
    return noCacheJsonResponse({ stream: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get stream: ${msg}` }, 500);
  }
});

export default streams;
