/**
 * @degenfeed/api-worker — Live Shorts: Display & Metadata
 *
 * OG tags, Frame tags, manifest, and live-meta routes.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import { liveShortKey } from './live-shorts-engine';
import type { LiveShortRecord } from './live-shorts-types';

const liveShorts = new Hono<{ Bindings: Env }>();
// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/og
// JSON OG meta data for Bluesky embed cards and link previews.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/og', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;
    const status = record.isLive ? 'live' : 'ended';

    return noCacheJsonResponse({
      title: record.isLive ? `🔴 LIVE: ${record.title}` : `✅ ${record.title}`,
      description: record.isLive
        ? `${record.creatorHandle} is streaming live on DegenFeed! ${timeRemaining}s remaining`
        : `Recording available: ${record.title} by ${record.creatorHandle}`,
      image: `https://app.degenfeed.xyz/og/live/${id}.png`,
      url: record.playbackUrl,
      type: 'video.other',
      video: { url: record.playbackUrl, type: 'application/x-mpegURL', width: 1080, height: 1920 },
      live: record.isLive,
      status,
      creator: record.creatorHandle,
      creatorAddress: record.creator,
      timeRemaining,
      platforms: record.protocols,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get OG data: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/frame
// HTML page with Farcaster Frame tags (FIP #269 live activity).
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/frame', async (c) => {
  const { id } = c.req.param();
  if (!id) return c.text('Missing session ID', 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return c.text('Live short not found', 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;
    const remainingMinutes = Math.floor(timeRemaining / 60);
    const remainingSeconds = timeRemaining % 60;
    const hostFid = Number(c.env.FARCASTER_FID ?? '0');

    const isLive = record.isLive;
    const h = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="${h(isLive ? `🔴 LIVE: ${record.title}` : record.title)}" />
  <meta property="og:description" content="${h(isLive ? `${record.creatorHandle} is live! ${timeRemaining}s left` : `Recording: ${record.title}`)}" />
  <meta property="og:image" content="https://app.degenfeed.xyz/og/live/${id}.png" />
  <meta property="og:type" content="video.other" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://app.degenfeed.xyz/og/live/${id}.png" />
  <meta property="fc:frame:image:aspect_ratio" content="9:16" />
  <meta property="fc:frame:video" content="${h(record.playbackUrl)}" />
  <meta property="fc:frame:video:type" content="application/x-mpegURL" />
  <meta property="fc:live" content="${isLive ? '1' : '0'}" />
  <meta property="fc:live:hostFid" content="${hostFid}" />
  ${isLive ? `<meta property="fc:live:startedAt" content="${new Date(record.startedAt).toISOString()}" />` : ''}
  <meta property="fc:live:participantCount" content="${isLive ? '1' : '0'}" />
  <meta property="fc:live:expectedDurationSec" content="${timeRemaining}" />
  ${record.recordingUrl ? `<meta property="fc:live:recordingUrl" content="${h(record.recordingUrl)}" />` : ''}
  <meta property="fc:live:protocol" content="hls" />
  <link rel="farcaster-live-activity-manifest" href="https://app.degenfeed.xyz/api/live-shorts/${id}/manifest" />
  <meta property="fc:frame:button:1" content="${isLive ? `⏱ ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}` : '▶ Watch Recording'}" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${h(record.playbackUrl)}" />
  <meta property="fc:frame:button:2" content="${record.hasCoinLinked ? '💎 Tip' : '🔗 Share'}" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${h(`https://app.degenfeed.xyz/live/${id}`)}" />
  ${isLive ? '<meta property="fc:frame:refresh_period" content="5" />' : ''}
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
</head>
<body><p>DegenFeed Live Short</p></body>
</html>`;

    return c.html(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.text(`Error: ${msg}`, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/manifest
// Live Activity Manifest per FIP #269.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/manifest', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const hostFid = Number(c.env.FARCASTER_FID ?? '0');

    return c.json({
      type: 'live-video',
      version: '2026.1',
      hostAttestation: null,
      metadata: {
        title: record.title,
        description: `Live short by ${record.creatorHandle} on DegenFeed`,
        image: `https://app.degenfeed.xyz/og/live/${id}.png`,
      },
      state: {
        startedAt: record.startedAt,
        participantCount: record.isLive ? 1 : 0,
        speakerFids: hostFid > 0 ? [hostFid] : [],
      },
      protocols: [{ type: 'hls', playlist: record.playbackUrl, privacy: 'public' }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get manifest: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/live-meta
// Optimized metadata for feed generators (Bluesky, Nostr feed lists, etc.).
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/live-meta', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;

    return noCacheJsonResponse({
      id: record.id,
      title: record.title,
      creator: record.creatorHandle,
      creatorAddress: record.creator,
      isLive: record.isLive,
      startedAt: record.startedAt,
      endsAt: record.endsAt,
      timeRemaining,
      playbackUrl: record.playbackUrl,
      recordingUrl: record.recordingUrl ?? null,
      protocols: record.protocols,
      hasCoinLinked: record.hasCoinLinked,
      tipCount: (record as Record<string, unknown>).tipCount ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get live meta: ${msg}` }, 500);
  }
});

export default liveShorts;
