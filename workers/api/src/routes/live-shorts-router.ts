/**
 * @degenfeed/api-worker — Live Shorts: Main Router
 *
 * CRUD and interaction routes for live short sessions.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import {
  activeIndexKey,
  broadcastTipToStream,
  creatorIndexKey,
  endLiveShortInternal,
  executeTip,
  getAggregatedViewerCount,
  handleLiveShortEnded,
  liveShortKey,
  readStringArray,
  startLiveShort,
} from './live-shorts-engine';
import type { LiveShortRecord, Protocol } from './live-shorts-types';

const liveShorts = new Hono<{ Bindings: Env }>();
// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/start
// Start a live short broadcast to all selected protocols.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/start', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: {
    title?: string;
    protocols?: Protocol[];
    hasCoinLinked?: boolean;
    coinAddress?: string;
  };
  try {
    body = await c.req.json<{
      title?: string;
      protocols?: Protocol[];
      hasCoinLinked?: boolean;
      coinAddress?: string;
    }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = body.title?.trim();
  if (!title) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }
  if (title.length > 100) {
    return jsonResponse({ error: 'Title too long (max 100 chars)' }, 400);
  }

  const protocols =
    body.protocols && body.protocols.length > 0 ? body.protocols : DEFAULT_PROTOCOLS;

  // Validate protocols
  const validProtocols: Protocol[] = [
    'activitypub',
    'atproto',
    'nostr',
    'farcaster',
    'lens',
    'zora',
    'degenfeed',
  ];
  for (const p of protocols) {
    if (!validProtocols.includes(p)) {
      return jsonResponse(
        { error: `Invalid protocol: ${p}. Valid: ${validProtocols.join(', ')}` },
        400,
      );
    }
  }

  // Check if creator already has an active live short
  const creatorIds = await readStringArray(c.env, creatorIndexKey(session.address));
  for (const existingId of creatorIds) {
    try {
      const existingRaw = await c.env.CONTENT_STORE?.get(liveShortKey(existingId));
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as LiveShortRecord;
        if (existing.isLive) {
          return jsonResponse(
            {
              error: 'You already have an active live short',
              existingSessionId: existing.id,
            },
            409,
          );
        }
      }
    } catch {
      // Stale entry — continue
    }
  }

  // Derive a creator handle from the wallet or session
  const creatorHandle =
    session.displayName || `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;

  try {
    const record = await startLiveShort(c.env, {
      creator: session.address,
      creatorHandle,
      title,
      protocols,
      hasCoinLinked: body.hasCoinLinked ?? false,
      coinAddress: body.coinAddress,
    });

    return noCacheJsonResponse(
      {
        sessionId: record.id,
        streamKey: record.streamKey,
        rtmpUrl: record.rtmpUrl,
        playbackUrl: record.playbackUrl,
        title: record.title,
        protocols: record.protocols,
        hasCoinLinked: record.hasCoinLinked,
        timeRemaining: MAX_LIVE_SHORT_DURATION_SECONDS,
        startedAt: record.startedAt,
        endsAt: record.endsAt,
        protocolPosts: record.protocolPosts,
        setup: {
          obs: {
            server: record.rtmpUrl,
            streamKey: record.streamKey,
          },
          instructions: [
            '1. Open OBS Studio or any RTMP client',
            `2. Set Server to: ${record.rtmpUrl}`,
            `3. Set Stream Key to: ${record.streamKey}`,
            '4. Click Start Streaming',
            `5. You have ${MAX_LIVE_SHORT_DURATION_SECONDS} seconds — go!`,
          ],
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to start live short: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/active
// Get all currently active live shorts, optionally filtered by protocol.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/active', async (c) => {
  const protocolFilter = c.req.query('protocol') as Protocol | undefined;
  const cursor = c.req.query('cursor');

  try {
    const activeIds = await readStringArray(c.env, activeIndexKey());
    if (activeIds.length === 0) {
      return noCacheJsonResponse({ shorts: [], total: 0 });
    }

    let targetIds = activeIds;

    // Paginate
    if (cursor) {
      const cursorIdx = activeIds.indexOf(cursor);
      if (cursorIdx >= 0) {
        targetIds = activeIds.slice(cursorIdx + 1);
      }
    }

    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    targetIds = targetIds.slice(0, limit);

    // Fetch all in parallel
    const results = await Promise.all(
      targetIds.map(async (id) => {
        try {
          const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
          if (!raw) return null;
          const record = JSON.parse(raw) as LiveShortRecord;
          if (!record.isLive) return null;

          // Apply protocol filter if specified
          if (protocolFilter && !record.protocols.includes(protocolFilter)) {
            return null;
          }

          // Get viewer count
          const viewers = await getAggregatedViewerCount(c.env, id);

          return {
            id: record.id,
            creator: record.creator,
            creatorHandle: record.creatorHandle,
            title: record.title,
            protocols: record.protocols,
            playbackUrl: record.playbackUrl,
            hasCoinLinked: record.hasCoinLinked,
            startedAt: record.startedAt,
            endsAt: record.endsAt,
            timeRemaining: Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000)),
            viewerCount: viewers.total,
          };
        } catch {
          return null;
        }
      }),
    );

    const shorts = results.filter((s): s is ActiveLiveShortResponse => s !== null);

    return noCacheJsonResponse({
      shorts,
      total: shorts.length,
      nextCursor: targetIds.length > 0 ? targetIds[targetIds.length - 1] : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch active shorts: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/tip
// Send a tip to the creator of a live short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/tip', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  let body: { amount?: string; chain?: string; message?: string };
  try {
    body = await c.req.json<{
      amount?: string;
      chain?: string;
      message?: string;
    }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const amount = body.amount;
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return jsonResponse({ error: 'Valid tip amount is required' }, 400);
  }
  const chain = body.chain || 'solana';

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;
    if (!record.isLive) {
      return jsonResponse({ error: 'This live short has ended' }, 400);
    }

    // Execute the tip
    const tipResult = await executeTip({
      from: session.address,
      to: record.creator,
      amount,
      chain,
      message: body.message,
    });

    if (!tipResult.success) {
      return jsonResponse({ error: 'Tip execution failed' }, 502);
    }

    // Update tip counters on the record
    record.tipCount += 1;
    record.tipTotalUsdCents += Math.round(Number(amount) * 100);
    await c.env.CONTENT_STORE?.put(liveShortKey(id), JSON.stringify(record), {
      expirationTtl: record.isLive ? 86400 : 86400 * 7,
    }).catch(() => {});

    // Broadcast tip to stream overlay (non-blocking)
    broadcastTipToStream(id, {
      amount,
      chain,
      from: session.address,
      message: body.message,
    });

    return noCacheJsonResponse({
      success: true,
      txHash: tipResult.txHash,
      amount,
      chain,
      to: record.creator,
      message: body.message || `Live short tip! 🎁`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Tip failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/end
// End a live short. Only the creator can end their own live short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/end', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;

    // Verify the caller is the creator
    if (record.creator.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the creator can end this live short' }, 403);
    }

    if (!record.isLive) {
      return jsonResponse({ error: 'This live short has already ended' }, 400);
    }

    await endLiveShortInternal(c.env, id);

    // Trigger post-processing (non-blocking)
    // Use waitUntil if available (Cloudflare Workers)
    const endPromise = handleLiveShortEnded(c.env, id);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(endPromise);
    } else {
      // Fire and forget
      endPromise.catch((err) => {
        console.error('[live-shorts] post-processing failed:', err);
      });
    }

    return jsonResponse({
      ended: true,
      sessionId: id,
      duration: Math.round((Date.now() - record.startedAt) / 1000),
      tipCount: record.tipCount,
      tipTotalUsdCents: record.tipTotalUsdCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to end live short: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/viewers
// Get aggregated viewer counts by protocol.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/viewers', async (c) => {
  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const counts = await getAggregatedViewerCount(c.env, id);

    return noCacheJsonResponse({
      sessionId: id,
      counts,
      total: counts.total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get viewer count: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/recording
// Called by the transcoder when the recording is ready.
// Marks the recording as available and publishes as a regular short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/recording', async (c) => {
  // This endpoint is called by the internal transcoder — API key protected
  const authHeader = c.req.header('authorization');
  const internalKey = c.env.PUSH_API_KEY || c.env.ADMIN_API_KEY;
  if (internalKey && (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== internalKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  let body: { recordingUrl?: string; duration?: number };
  try {
    body = await c.req.json<{ recordingUrl?: string; duration?: number }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;
    record.recordingUrl = body.recordingUrl || record.playbackUrl;

    await c.env.CONTENT_STORE?.put(liveShortKey(id), JSON.stringify(record), {
      expirationTtl: 86400 * 30,
    });

    // Publish recording as short (non-blocking)
    const publishPromise = handleLiveShortEnded(c.env, id);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(publishPromise);
    } else {
      publishPromise.catch((err) => {
        console.error('[live-shorts] recording publish failed:', err);
      });
    }

    return jsonResponse({
      ok: true,
      sessionId: id,
      recordingUrl: record.recordingUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to store recording: ${msg}` }, 500);
  }
});

export default liveShorts;
