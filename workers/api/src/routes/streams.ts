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
import { aggregateAllStreams } from '../feed/live-aggregator';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  announceStreamToAllProtocols,
  type StreamAnnouncement,
  type StreamType,
} from '../lib/stream-announcer';
import { requireSession } from '../session';
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
