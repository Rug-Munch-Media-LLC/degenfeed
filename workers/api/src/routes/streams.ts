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
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import {
  announceStreamToAllProtocols,
  type StreamAnnouncement,
  type StreamType,
} from '../lib/stream-announcer';

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

// ─── Router ──────────────────────────────────────────────────────────────

const streams = new Hono<{ Bindings: Env }>();

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
    const creatorHandle = body.creatorHandle?.trim() || session.displayName || session.address.slice(0, 10);

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
    c.env.CONTENT_STORE?.get(creatorStreamsKey(session.address)).then(
      (raw) => {
        const list: string[] = raw ? JSON.parse(raw) : [];
        list.unshift(streamId);
        c.env.CONTENT_STORE?.put(
          creatorStreamsKey(session.address),
          JSON.stringify(list.slice(0, 100)),
          { expirationTtl: STREAM_TTL },
        ).catch(() => {});
      },
    ).catch(() => {});

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
