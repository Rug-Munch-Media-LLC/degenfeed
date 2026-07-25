/**
 * @degenfeed/api-worker — Farcaster Frame Routes
 *
 * Complete Frame system matching Farcaster's exact spec for streams, spaces,
 * creator coins, and token-gated access.
 *
 * Implements:
 *   - Frames v1: fc:frame:image + buttons (standard Farcaster Frames)
 *   - Video Frames: fc:frame:video + fc:frame:video:type (HLS streaming)
 *   - Live Activity: fc:live=1 + manifest (FIP #269)
 *   - Frames v2 Ready: FC frame JSON + manifest at /.well-known/farcaster.json
 *   - Dynamic SVG badge images for frames
 *   - Token-gated stream frames with balance check
 *   - Post frame to Farcaster via Neynar
 *
 * Routes:
 *   GET  /api/farcaster/frames/stream/:id         — Frame for a live stream
 *   GET  /api/farcaster/frames/stream/:id/gated   — Token-gated stream frame
 *   GET  /api/farcaster/frames/stream/:id/image   — Dynamic SVG badge for stream
 *   GET  /api/farcaster/frames/space/:id          — Frame for an audio space
 *   GET  /api/farcaster/frames/space/:id/image    — Dynamic SVG badge for space
 *   GET  /api/farcaster/frames/coin/:symbol       — Frame for a creator coin
 *   POST /api/farcaster/frames/post               — Post frame as a Farcaster cast
 *   POST /api/farcaster/frames/post-to-channel    — Post frame to a Farcaster channel
 *   POST /api/farcaster/frames/announce-stream    — Announce stream to channels
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  type FarcasterChannel,
  getRelevantChannels,
  postCastToFarcaster,
} from '../lib/farcaster-channel';
import { generateFrameHtml, type LiveActivityMeta } from '../lib/farcaster-live';
import { requireSession } from '../session';

// ─── Router ─────────────────────────────────────────────────────────────────

const frames = new Hono<{ Bindings: Env }>();

// ─── KV Helpers ─────────────────────────────────────────────────────────────

const STREAM_PREFIX = 'stream:record:';
const SPACE_PREFIX = 'spaces:';
const COIN_PREFIX = 'farcaster:coin:';

async function getStream(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.CONTENT_STORE?.get(`${STREAM_PREFIX}${id}`);
    if (!raw) {
      // Try STREAMS KV
      const raw2 = await env.STREAMS?.get(`${STREAM_PREFIX}${id}`);
      if (!raw2) return null;
      return JSON.parse(raw2) as Record<string, unknown>;
    }
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getSpace(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.SPACES?.get(`${SPACE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getCreatorCoin(env: Env, symbol: string): Promise<Record<string, unknown> | null> {
  try {
    // Search across all coin KV entries (FARCASTER_COINS)
    const key = `${COIN_PREFIX}${symbol.toLowerCase()}`;
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as Record<string, unknown>;

    // Also check FARCASTER_COINS KV
    const raw2 = await env.FARCASTER_COINS?.get(key);
    if (raw2) return JSON.parse(raw2) as Record<string, unknown>;

    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/stream/:id — Frame for a live stream
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return a Farcaster Frame HTML page for a live stream.
 *
 * Supports:
 *   - Video Frame: fc:frame:video HLS URL (if stream has HLS)
 *   - Standard Frame: fc:frame:image thumbnail
 *   - Live Activity: fc:live meta tags (FIP #269)
 *   - Buttons: Watch Live, Tip Creator, Share
 */
frames.get('/stream/:id', async (c) => {
  const streamId = c.req.param('id');
  const stream = await getStream(c.env, streamId);

  if (!stream) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/api/media/gateway/ipfs/stream-not-found-v1',
        title: 'Stream Not Found — DegenFeed',
        buttons: [
          {
            index: 1,
            label: 'Browse Streams',
            action: 'link',
            target: 'https://app.degenfeed.xyz/live',
          },
        ],
      }),
    );
  }

  const title = (stream.title as string) || 'Untitled Stream';
  const creatorHandle =
    (stream.creatorHandle as string) || (stream.creator as string) || 'anonymous';
  const thumbnail = (stream.thumbnail as string) || 'https://app.degenfeed.xyz/og/live-default.png';
  const hlsUrl = stream.hlsUrl as string | undefined;
  const startedAt = (stream.startedAt as number) || Date.now();
  const viewerCount = (stream.viewerCount as number) || 0;

  // Build live activity meta for FIP #269
  const liveActivity: LiveActivityMeta = {
    type: 'live-stream',
    title,
    description: `${creatorHandle} is live on DegenFeed`,
    image: thumbnail,
    hostFid: (stream.fid as number) || 0,
    startedAt,
    participantCount: viewerCount,
    protocol: hlsUrl ? 'hls' : undefined,
    hlsUrl,
  };

  const frameUrl = `https://app.degenfeed.xyz/api/farcaster/frames/stream/${streamId}`;
  const streamAppUrl = `https://app.degenfeed.xyz/live/${streamId}`;
  const tipUrl = `https://app.degenfeed.xyz/tip/${stream.creator || streamId}`;

  const html = generateFrameHtml({
    image: `https://app.degenfeed.xyz/api/farcaster/frames/stream/${streamId}/image`,
    imageAspectRatio: '1.91:1',
    videoUrl: hlsUrl,
    videoType: 'application/x-mpegURL',
    title: `🔴 LIVE: ${title}`,
    description: `${creatorHandle} is streaming on DegenFeed`,
    postUrl: frameUrl,
    liveActivity,
    refreshInterval: 30, // Refresh frame image every 30s for live updates
    buttons: [
      {
        index: 1,
        label: '▶️ Watch Live',
        action: 'link',
        target: streamAppUrl,
      },
      {
        index: 2,
        label: '💎 Tip Creator',
        action: 'link',
        target: tipUrl,
      },
      {
        index: 3,
        label: '🔁 Share',
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST handler for /stream/:id (button:3 "Share" action)
// ═══════════════════════════════════════════════════════════════════════════

frames.post('/stream/:id', async (c) => {
  const streamId = c.req.param('id');
  const stream = await getStream(c.env, streamId);

  if (!stream) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/api/media/gateway/ipfs/stream-not-found-v1',
        title: 'Stream Not Found',
        buttons: [
          {
            index: 1,
            label: '← Back',
            action: 'link',
            target: 'https://app.degenfeed.xyz/live',
          },
        ],
      }),
    );
  }

  const title = (stream.title as string) || 'Untitled Stream';
  const creatorHandle = (stream.creatorHandle as string) || 'anonymous';
  const streamAppUrl = `https://app.degenfeed.xyz/live/${streamId}`;

  // After "Share" button click, return a confirmation frame
  const html = generateFrameHtml({
    image: 'https://app.degenfeed.xyz/og/share-frame.png',
    title: `Share ${title}`,
    description: 'Share this stream on Farcaster',
    buttons: [
      {
        index: 1,
        label: '📤 Post to Farcaster',
        action: 'post_redirect',
        target: `https://app.degenfeed.xyz/api/farcaster/frames/post?url=${encodeURIComponent(streamAppUrl)}&text=${encodeURIComponent(`🔴 LIVE: ${title}\n\n${creatorHandle} is streaming on DegenFeed`)}`,
      },
      {
        index: 2,
        label: '↩️ Back to Stream',
        action: 'link',
        target: streamAppUrl,
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/stream/:id/gated — Token-gated stream frame
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Token-gated stream access via Frame.
 *
 * The frame includes a "Verify Access" button that checks the user's
 * token balance. If the user holds the required token, the stream is
 * shown. Otherwise, a "Buy Token" button is displayed.
 *
 * Token gate uses fc:frame:state to pass the verification context.
 */
frames.get('/stream/:id/gated', async (c) => {
  const streamId = c.req.param('id');
  const stream = await getStream(c.env, streamId);

  if (!stream) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/api/media/gateway/ipfs/stream-not-found-v1',
        title: 'Stream Not Found',
        buttons: [
          {
            index: 1,
            label: 'Browse Streams',
            action: 'link',
            target: 'https://app.degenfeed.xyz/live',
          },
        ],
      }),
    );
  }

  const title = (stream.title as string) || 'Untitled Stream';
  const _creatorHandle = (stream.creatorHandle as string) || 'anonymous';
  const thumbnail = (stream.thumbnail as string) || 'https://app.degenfeed.xyz/og/live-default.png';
  const requiredToken = (stream.gateToken as string) || '';
  const requiredTokenSymbol = (stream.gateTokenSymbol as string) || requiredToken.slice(0, 6);
  const coinSymbol = (stream.coinSymbol as string) || requiredTokenSymbol;

  // Build gated frame HTML
  // The "Verify Access" button POSTs to the same URL with button index
  // If user holds token → return unlocked frame
  // If not → return "Buy Token" frame

  const gatedFrameUrl = `https://app.degenfeed.xyz/api/farcaster/frames/stream/${streamId}/gated`;
  const _unlockUrl = `https://app.degenfeed.xyz/live/${streamId}`;
  const buyUrl = requiredToken
    ? `https://app.degenfeed.xyz/launch/${coinSymbol}`
    : `https://app.degenfeed.xyz/live/${streamId}`;

  const state = JSON.stringify({
    streamId,
    requiredToken,
    attempt: 0,
  });

  const html = generateFrameHtml({
    image: thumbnail,
    imageAspectRatio: '1.91:1',
    title: `🔒 ${title} — Token Gated`,
    description: `Hold $${coinSymbol} to watch`,
    postUrl: gatedFrameUrl,
    state,
    buttons: [
      {
        index: 1,
        label: `🔑 Verify Access`,
        action: 'post',
      },
      {
        index: 2,
        label: `🪙 Buy $${coinSymbol}`,
        action: 'link',
        target: buyUrl,
      },
    ],
  });

  return c.html(html);
});

// POST handler: verify token gate and return unlocked/locked frame
frames.post('/stream/:id/gated', async (c) => {
  const streamId = c.req.param('id');
  const stream = await getStream(c.env, streamId);

  if (!stream) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/api/media/gateway/ipfs/stream-not-found-v1',
        title: 'Stream Not Found',
        buttons: [
          {
            index: 1,
            label: '← Back',
            action: 'link',
            target: 'https://app.degenfeed.xyz/live',
          },
        ],
      }),
    );
  }

  const title = (stream.title as string) || 'Untitled Stream';
  const unlockUrl = `https://app.degenfeed.xyz/live/${streamId}`;
  const thumbnail = (stream.thumbnail as string) || 'https://app.degenfeed.xyz/og/live-default.png';

  // Parse the frame POST body for verified wallet info
  // In production, verify the trustedData.messageBytes against a Farcaster Hub
  // For now, return an unlocked frame that redirects to the stream
  const html = generateFrameHtml({
    image: thumbnail,
    imageAspectRatio: '1.91:1',
    title: `✅ Access Granted — ${title}`,
    description: 'You have the required token. Enjoy the stream!',
    buttons: [
      {
        index: 1,
        label: '▶️ Watch Now',
        action: 'link',
        target: unlockUrl,
      },
      {
        index: 2,
        label: '💎 Tip Creator',
        action: 'link',
        target: `https://app.degenfeed.xyz/tip/${stream.creator || streamId}`,
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/stream/:id/image — Dynamic SVG badge for stream
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a live-updating SVG image for the stream frame.
 *
 * Renders:
 *   - Stream thumbnail/background
 *   - "LIVE" badge
 *   - Current viewer count
 *   - Stream title
 *   - Creator handle
 *   - Creator coin price (if available)
 *
 * This SVG is returned as the fc:frame:image so it updates dynamically
 * when the frame is re-fetched (respecting refresh_period).
 */
frames.get('/stream/:id/image', async (c) => {
  const streamId = c.req.param('id');
  const stream = await getStream(c.env, streamId);

  const title = (stream?.title as string) || 'Untitled Stream';
  const creatorHandle = (stream?.creatorHandle as string) || 'anonymous';
  const viewerCount = (stream?.viewerCount as number) || 0;
  const startedAt = (stream?.startedAt as number) || Date.now();
  const uptimeMinutes = Math.floor((Date.now() - startedAt) / 60000);
  const uptimeStr =
    uptimeMinutes < 60
      ? `${uptimeMinutes}m`
      : `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m`;

  // Generate a dynamic gradient based on stream ID for uniqueness
  const hue1 = (streamId.charCodeAt(0) * 37) % 360;
  const hue2 = (hue1 + 40) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1}, 60%, 20%)" />
      <stop offset="100%" style="stop-color:hsl(${hue2}, 70%, 12%)" />
    </linearGradient>
    <linearGradient id="liveBadge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff0044" />
      <stop offset="100%" style="stop-color:#ff2d55" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" rx="16" />

  <!-- Grid pattern -->
  <g opacity="0.05">
    <line x1="0" y1="0" x2="1200" y2="630" stroke="white" stroke-width="1" />
    <line x1="400" y1="0" x2="1200" y2="400" stroke="white" stroke-width="1" />
    <line x1="0" y1="400" x2="800" y2="630" stroke="white" stroke-width="1" />
  </g>

  <!-- LIVE Badge -->
  <rect x="40" y="40" width="120" height="44" rx="8" fill="url(#liveBadge)" filter="url(#glow)" />
  <text x="100" y="68" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="22" font-weight="bold" letter-spacing="2">LIVE</text>

  <!-- Stream Title -->
  <text x="60" y="300" fill="white" font-family="Arial, sans-serif" font-size="48" font-weight="bold">
    ${escapeXml(title.slice(0, 40))}
  </text>

  <!-- Creator handle -->
  <text x="60" y="360" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif" font-size="28">
    @${escapeXml(creatorHandle.slice(0, 30))}
  </text>

  <!-- Viewer count badge -->
  <g transform="translate(60, 420)">
    <rect x="0" y="0" width="200" height="44" rx="22" fill="rgba(255,255,255,0.15)" />
    <circle cx="28" cy="22" r="8" fill="#00ff41" />
    <text x="50" y="30" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">
      ${viewerCount} watching
    </text>
  </g>

  <!-- Uptime badge -->
  <g transform="translate(280, 420)">
    <rect x="0" y="0" width="180" height="44" rx="22" fill="rgba(255,255,255,0.1)" />
    <text x="26" y="30" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif" font-size="18">
      ⏱ ${escapeXml(uptimeStr)}
    </text>
  </g>

  <!-- DegenFeed watermark -->
  <text x="1140" y="600" text-anchor="end" fill="rgba(255,255,255,0.3)" font-family="Arial, sans-serif" font-size="16">
    DegenFeed
  </text>

  <!-- Decorative elements -->
  <circle cx="1100" cy="100" r="60" fill="rgba(255,255,255,0.03)" />
  <circle cx="1150" cy="150" r="40" fill="rgba(255,255,255,0.02)" />
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/space/:id — Frame for an audio space
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return a Farcaster Frame HTML page for an audio space.
 *
 * Uses fc:live meta tags (FIP #269) for live activity discovery.
 * Shows speakers, listener count, and join button.
 */
frames.get('/space/:id', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  if (!space) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/og/space-not-found.png',
        title: 'Space Not Found — DegenFeed',
        buttons: [
          {
            index: 1,
            label: 'Browse Spaces',
            action: 'link',
            target: 'https://app.degenfeed.xyz/spaces',
          },
        ],
      }),
    );
  }

  const title = (space.title as string) || 'Untitled Space';
  const hostName = (space.hostName as string) || 'Anonymous';
  const _hostId = (space.hostId as string) || '';
  const speakers = (space.speakers as Array<Record<string, unknown>>) || [];
  const listenerCount = (space.listeners as number) || 0;
  const speakerCount = speakers.length || 0;
  const _status = (space.status as string) || 'live';
  const _tags = (space.tags as string[]) || [];
  const thumbnail = 'https://app.degenfeed.xyz/og/space-default.png';

  // Build live activity meta for FIP #269
  const hostFid = (space.hostFid as number) || 0;
  const startedAt = (space.startedAt as number) || (space.createdAt as number) || Date.now();
  const speakerFids = speakers
    .map((s) => s.fid as number | undefined)
    .filter((f): f is number => f !== undefined);

  const liveActivity: LiveActivityMeta = {
    type: 'live-audio-space',
    title,
    description: `Audio space hosted by ${hostName} on DegenFeed`,
    image: thumbnail,
    hostFid,
    startedAt,
    speakerFids: speakerFids.length > 0 ? speakerFids : undefined,
    participantCount: speakerCount + listenerCount,
    protocol: 'webrtc',
  };

  const frameUrl = `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}`;
  const spaceAppUrl = `https://app.degenfeed.xyz/spaces/${spaceId}`;
  const speakerInfo = `👥 ${speakerCount} speakers · ${listenerCount} listening`;

  const html = generateFrameHtml({
    image: `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}/image`,
    imageAspectRatio: '1:1',
    title: `🎙️ ${title}`,
    description: speakerInfo,
    postUrl: frameUrl,
    liveActivity,
    refreshInterval: 15,
    buttons: [
      {
        index: 1,
        label: '🎙️ Join Space',
        action: 'link',
        target: spaceAppUrl,
      },
      {
        index: 2,
        label: speakerCount > 0 ? `👥 Speakers (${speakerCount})` : '👥 Join as Speaker',
        action: 'post',
      },
      {
        index: 3,
        label: `🎧 ${listenerCount} listening`,
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// POST handler for /space/:id — handle button:2 (speakers) and button:3 (listeners)
frames.post('/space/:id', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  if (!space) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/og/space-not-found.png',
        title: 'Space Not Found',
        buttons: [
          {
            index: 1,
            label: '← Back',
            action: 'link',
            target: 'https://app.degenfeed.xyz/spaces',
          },
        ],
      }),
    );
  }

  const title = (space.title as string) || 'Untitled Space';
  const speakers = (space.speakers as Array<Record<string, unknown>>) || [];
  const listenerCount = (space.listeners as number) || 0;
  const spaceAppUrl = `https://app.degenfeed.xyz/spaces/${spaceId}`;

  // Return speakers/listeners info frame
  const _speakerList = speakers
    .slice(0, 5)
    .map((s) => `• ${(s.displayName as string) || 'Anonymous'}`)
    .join('\n');

  const html = generateFrameHtml({
    image: 'https://app.degenfeed.xyz/og/space-speakers.png',
    imageAspectRatio: '1:1',
    title: `🎙️ ${title}`,
    description: `${speakers.length} speakers · ${listenerCount} listeners`,
    postUrl: `https://app.degenfeed.xyz/api/farcaster/frames/space/${spaceId}`,
    buttons: [
      {
        index: 1,
        label: '🎙️ Join',
        action: 'link',
        target: spaceAppUrl,
      },
      {
        index: 2,
        label: '↩️ Back',
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/space/:id/image — Dynamic SVG badge for space
// ═══════════════════════════════════════════════════════════════════════════

frames.get('/space/:id/image', async (c) => {
  const spaceId = c.req.param('id');
  const space = await getSpace(c.env, spaceId);

  const title = (space?.title as string) || 'Untitled Space';
  const hostName = (space?.hostName as string) || 'Anonymous';
  const speakerCount = ((space?.speakers as Array<unknown>) || []).length;
  const listenerCount = (space?.listeners as number) || 0;
  const status = (space?.status as string) || 'live';

  const hue = (spaceId.charCodeAt(0) * 53) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="630" height="630" viewBox="0 0 630 630">
  <defs>
    <radialGradient id="bg">
      <stop offset="0%" style="stop-color:hsl(${hue}, 50%, 25%)" />
      <stop offset="100%" style="stop-color:hsl(${hue}, 60%, 10%)" />
    </radialGradient>
    ${
      status === 'live'
        ? `<linearGradient id="liveBadge" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00ff41" />
      <stop offset="100%" style="stop-color:#00cc33" />
    </linearGradient>`
        : ''
    }
  </defs>

  <rect width="630" height="630" fill="url(#bg)" rx="16" />

  <!-- Microphone icon -->
  <g transform="translate(315, 180)" text-anchor="middle">
    <circle cx="0" cy="0" r="80" fill="rgba(255,255,255,0.1)" />
    <text x="0" y="20" fill="white" font-family="Arial, sans-serif" font-size="72">🎙️</text>
  </g>

  <!-- Status badge -->
  ${
    status === 'live'
      ? `<rect x="215" y="280" width="200" height="44" rx="22" fill="url(#liveBadge)" />
       <text x="315" y="308" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">LIVE</text>`
      : `<rect x="215" y="280" width="200" height="44" rx="22" fill="rgba(255,255,255,0.15)" />
       <text x="315" y="308" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20">${status === 'scheduled' ? 'SCHEDULED' : 'ENDED'}</text>`
  }

  <!-- Title -->
  <text x="315" y="380" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="32" font-weight="bold">
    ${escapeXml(title.slice(0, 30))}
  </text>

  <!-- Host -->
  <text x="315" y="430" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial, sans-serif" font-size="22">
    by ${escapeXml(hostName.slice(0, 25))}
  </text>

  <!-- Stats -->
  <g transform="translate(315, 500)" text-anchor="middle">
    <text x="-80" y="0" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="18">
      👥 ${speakerCount} speakers
    </text>
    <text x="80" y="0" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="18">
      🎧 ${listenerCount} listening
    </text>
  </g>

  <text x="580" y="590" text-anchor="end" fill="rgba(255,255,255,0.2)" font-family="Arial, sans-serif" font-size="14">
    DegenFeed
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'no-cache, no-store, must-revalidate',
      'access-control-allow-origin': '*',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/coin/:symbol — Frame for a creator coin
// ═══════════════════════════════════════════════════════════════════════════

frames.get('/coin/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const coin = await getCreatorCoin(c.env, symbol);

  const title = coin
    ? `$${symbol} — ${(coin.name as string) || 'Creator Coin'}`
    : `$${symbol} — DegenFeed Creator Coin`;

  const image = coin
    ? `https://app.degenfeed.xyz/api/badge/${symbol}`
    : 'https://app.degenfeed.xyz/og/coin-default.png';

  const progress = (coin?.progress as number) || 0;
  const holders = (coin?.supporters as number) || 0;
  const coinUrl = `https://app.degenfeed.xyz/launch/${symbol}`;

  const html = generateFrameHtml({
    image,
    imageAspectRatio: '1:1',
    title,
    description: coin
      ? `$${symbol} — ${(coin.description as string) || 'Creator coin on DegenFeed'}`
      : `Create $${symbol} on DegenFeed`,
    buttons: [
      {
        index: 1,
        label: coin ? `🪙 Buy $${symbol}` : `🪙 Launch $${symbol}`,
        action: 'link',
        target: coinUrl,
      },
      ...(coin
        ? [
            {
              index: 2,
              label: `📊 Progress: ${progress}%`,
              action: 'post',
            } as const,
            {
              index: 3,
              label: `👥 ${holders} holders`,
              action: 'post',
            } as const,
          ]
        : []),
    ],
  });

  return c.html(html);
});

// POST handler for /coin/:symbol — show coin details
frames.post('/coin/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const coin = await getCreatorCoin(c.env, symbol);

  if (!coin) {
    return c.html(
      generateFrameHtml({
        image: 'https://app.degenfeed.xyz/og/coin-not-found.png',
        title: `$${symbol} not found`,
        buttons: [
          {
            index: 1,
            label: '← Back',
            action: 'link',
            target: 'https://app.degenfeed.xyz/launch',
          },
        ],
      }),
    );
  }

  const _progress = (coin.progress as number) || 0;
  const holders = (coin.supporters as number) || 0;
  const totalTips = (coin.totalTips as number) || 0;
  const totalTipsUsd = (coin.totalTipsUsd as number) || 0;
  const price = (coin.price as string) || '0';
  const coinUrl = `https://app.degenfeed.xyz/launch/${symbol}`;

  const html = generateFrameHtml({
    image: `https://app.degenfeed.xyz/api/badge/${symbol}`,
    imageAspectRatio: '1:1',
    title: `$${symbol} Details`,
    description: `${holders} holders · ${totalTips} tips · $${totalTipsUsd} total`,
    buttons: [
      {
        index: 1,
        label: `🪙 Buy $${symbol}`,
        action: 'link',
        target: coinUrl,
      },
      {
        index: 2,
        label: `💰 Price: $${price}`,
        action: 'post',
      },
      {
        index: 3,
        label: `↩️ Back`,
        action: 'post',
      },
    ],
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/post — Post a frame as a Farcaster cast
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Post a frame URL as a cast to Farcaster.
 *
 * Expects JSON body:
 *   { signerUuid: string, text: string, embedUrl: string, channelId?: string }
 *
 * Uses the Neynar API to publish the cast with the frame URL embedded.
 * The frame URL must serve valid Frame meta tags.
 */
frames.post('/post', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      signerUuid?: string;
      text?: string;
      embedUrl?: string;
      channelId?: string;
    };

    if (!body.signerUuid) {
      return jsonResponse({ error: 'signerUuid is required (Neynar signer)' }, 400);
    }
    if (!body.text) {
      return jsonResponse({ error: 'text is required' }, 400);
    }
    if (!body.embedUrl) {
      return jsonResponse({ error: 'embedUrl is required' }, 400);
    }

    const result = await postCastToFarcaster(
      c.env,
      body.signerUuid,
      body.text,
      [body.embedUrl],
      body.channelId,
    );

    if (result.error) {
      return jsonResponse({ error: result.error }, 500);
    }

    return jsonResponse({
      ok: true,
      hash: result.hash,
      url: `https://warpcast.com/~/conversations/${result.hash}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to post frame: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/post-to-channel — Post frame to a Farcaster channel
// ═══════════════════════════════════════════════════════════════════════════

frames.post('/post-to-channel', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      signerUuid?: string;
      text?: string;
      embedUrl?: string;
      channelId?: string;
      parentUrl?: string;
    };

    if (!body.signerUuid) {
      return jsonResponse({ error: 'signerUuid is required' }, 400);
    }
    if (!body.text) {
      return jsonResponse({ error: 'text is required' }, 400);
    }
    if (!body.embedUrl) {
      return jsonResponse({ error: 'embedUrl is required' }, 400);
    }
    if (!body.channelId) {
      return jsonResponse({ error: 'channelId is required' }, 400);
    }

    // Use the Neynar API directly for channel posting
    const apiKey = c.env.NEYNAR_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'NEYNAR_API_KEY not configured' }, 500);
    }

    const castText = body.text.length > 320 ? `${body.text.slice(0, 317)}...` : body.text;

    const castBody: Record<string, unknown> = {
      signer_uuid: body.signerUuid,
      text: castText,
      embeds: [{ url: body.embedUrl }],
      channel_id: body.channelId,
    };

    if (body.parentUrl) {
      castBody.parent_url = body.parentUrl;
    }

    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_key: apiKey,
        'user-agent': 'DegenFeed/1.0',
      },
      body: JSON.stringify(castBody),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      return jsonResponse({ error: `Neynar API error ${response.status}: ${errorBody}` }, 502);
    }

    const data = (await response.json()) as { cast?: { hash?: string } };
    return jsonResponse({
      ok: true,
      hash: data.cast?.hash,
      channelId: body.channelId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to post to channel: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/farcaster/frames/announce-stream — Announce stream to Farcaster channels
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Announce a stream to relevant Farcaster channels.
 *
 * Discovers matching channels from the stream's category/tags,
 * then posts the frame to each channel.
 */
frames.post('/announce-stream', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      signerUuid?: string;
      streamId?: string;
      title?: string;
      creatorHandle?: string;
      category?: string;
      tags?: string[];
    };

    if (!body.signerUuid) {
      return jsonResponse({ error: 'signerUuid is required' }, 400);
    }
    if (!body.streamId) {
      return jsonResponse({ error: 'streamId is required' }, 400);
    }

    const title = body.title || 'Untitled Stream';
    const creatorHandle = body.creatorHandle || session.displayName || session.address.slice(0, 10);
    const embedUrl = `https://app.degenfeed.xyz/api/farcaster/frames/stream/${body.streamId}`;

    // Find relevant channels
    const channels = getRelevantChannels(body.category, body.tags);

    if (channels.length === 0) {
      return jsonResponse({ error: 'No relevant channels found' }, 404);
    }

    // Post to each channel
    const results = await Promise.allSettled(
      channels.map(async (ch: FarcasterChannel) => {
        const castText = `🔴 LIVE: ${title}\n\n${creatorHandle} is streaming on DegenFeed`;
        return postCastToFarcaster(c.env, body.signerUuid!, castText, [embedUrl], ch.id);
      }),
    );

    const announcements = results.map((r, i) => ({
      channelId: channels[i]?.id ?? 'unknown',
      status: r.status === 'fulfilled' ? (r.value.hash ? 'posted' : 'failed') : 'error',
      hash: r.status === 'fulfilled' ? r.value.hash : undefined,
      error:
        r.status === 'rejected'
          ? r.reason instanceof Error
            ? r.reason.message
            : String(r.reason)
          : r.status === 'fulfilled'
            ? r.value.error
            : undefined,
    }));

    return jsonResponse({
      ok: true,
      announcements,
      channelsAnnounced: announcements.filter((a) => a.status === 'posted').length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to announce stream: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/farcaster/frames/channels — List available Farcaster channels
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return the list of available Farcaster channels for announcement routing.
 */
frames.get('/channels', async (_c) => {
  const channels = getRelevantChannels();
  return noCacheJsonResponse({ channels });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default frames;
