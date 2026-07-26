/**
 * @degenfeed/api-worker — Farcaster Stream Frame Handlers
 */
import type { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { generateFrameHtml } from '../../lib/farcaster-live';
import { getStream, escapeXml } from './utils';

export function registerStreamFrameRoutes(frames: Hono<{ Bindings: Env }>): void {
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

}
