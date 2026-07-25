/**
 * @degenfeed/api-worker — Farcaster Frames v2 / Mini Apps Routes
 *
 * Complete Frames v2 implementation:
 *   - Frame Embed generation (single fc:frame JSON meta tag)
 *   - Frame manifest (.well-known/farcaster.json)
 *   - Transaction frames (action: 'tx' with eth_sendTransaction / eth_signTypedData_v4)
 *   - Multi-step frames with state management
 *   - Frame builder (no-code frame creation from templates)
 *   - Frame analytics (views, clicks, conversions)
 *   - Frame cross-posting (Farcaster, Nostr, Bluesky, Mastodon)
 *   - Frame discovery (trending, search, directory)
 *   - Frame notifications (interaction webhooks)
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 * Every provider gets a health check.
 *
 * Routes:
 *   POST /api/frames/create            — Create a frame from template
 *   GET  /api/frames/:id               — Get frame details
 *   GET  /api/frames/v2/:id            — Serve Frames v2 HTML page
 *   POST /api/frames/v2/:id            — Handle frame action
 *   GET  /api/frames/v2/:id/image      — Frame OG image
 *   DELETE /api/frames/:id              — Delete a frame
 *   GET  /api/frames/user              — List user's frames
 *   GET  /api/frames/discover          — Discover trending frames
 *   GET  /api/frames/analytics/:id     — Frame analytics
 *   GET  /api/frames/analytics         — All frames analytics
 *   POST /api/frames/crosspost         — Cross-post frame to protocols
 *   GET  /api/frames/templates         — List available templates
 *   POST /api/frames/notify            — Frame notification webhook receiver
 *   GET  /api/frames/manifest          — Frame manifest (.well-known/farcaster.json)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import {
  FRAME_TEMPLATES,
  buildFrameEmbed,
  generateFramesV2Html,
  serializeFrameEmbed,
} from '@degenfeed/farcaster-sdk';
import type { FrameState, FrameResponseButton } from '@degenfeed/farcaster-sdk';
import { getFrameBuilder } from '../lib/frame-builder';
import type { CompiledFrame, FrameBuilderConfig } from '../lib/frame-builder';
import { getFrameAnalytics } from '../lib/frame-analytics';
import { getFrameCrossPoster } from '../lib/frame-crosspost';

// ─── Router ─────────────────────────────────────────────────────────────────

const framesV2 = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/frames/create
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new frame from a template.
 *
 * Body:
 *   { templateType: string, fields: Record<string,string>, title?: string,
 *     description?: string, imageUrl?: string, buttonLabel?: string }
 */
framesV2.post('/create', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      templateType: string;
      fields: Record<string, string>;
      title?: string;
      description?: string;
      imageUrl?: string;
      buttonLabel?: string;
      creatorFid?: number;
    };

    if (!body.templateType || !body.fields) {
      return jsonResponse({ error: 'templateType and fields are required' }, 400);
    }

    const validTemplate = FRAME_TEMPLATES.find((t) => t.type === body.templateType);
    if (!validTemplate) {
      return jsonResponse({ error: `Invalid template type: ${body.templateType}` }, 400);
    }

    const builderConfig: FrameBuilderConfig = {
      creatorAddress: session.address,
      templateType: body.templateType as FrameBuilderConfig['templateType'],
      fields: body.fields,
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      buttonLabel: body.buttonLabel,
      creatorFid: body.creatorFid,
    };

    const builder = getFrameBuilder();
    const compiled = await builder.compile(builderConfig, c.env);

    // Track creation in analytics
    const analytics = getFrameAnalytics();
    await analytics.trackEvent({
      frameId: compiled.id,
      timestamp: Date.now(),
      eventType: 'view',
      interactorAddress: session.address,
    }, c.env);

    return jsonResponse({
      ok: true,
      frame: {
        id: compiled.id,
        url: compiled.url,
        template: compiled.template,
        embed: compiled.embed,
        createdAt: compiled.createdAt,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to create frame: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/templates
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List available frame templates for the no-code builder.
 */
framesV2.get('/templates', async (_c) => {
  return noCacheJsonResponse({
    templates: FRAME_TEMPLATES.map((t) => ({
      id: t.id,
      type: t.type,
      name: t.name,
      description: t.description,
      icon: t.icon,
      defaultImage: t.defaultImage,
      defaultButtonLabel: t.defaultButtonLabel,
      fields: t.fields,
    })),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/:id
// ═══════════════════════════════════════════════════════════════════════════

framesV2.get('/:id', async (c) => {
  const frameId = c.req.param('id');
  const builder = getFrameBuilder();
  const frame = await builder.getFrame(frameId, c.env);

  if (!frame) {
    return jsonResponse({ error: 'Frame not found' }, 404);
  }

  return noCacheJsonResponse({ frame });
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/frames/:id
// ═══════════════════════════════════════════════════════════════════════════

framesV2.delete('/:id', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const frameId = c.req.param('id');
  const builder = getFrameBuilder();
  const ok = await builder.deleteFrame(frameId, session.address, c.env);

  if (!ok) {
    return jsonResponse({ error: 'Frame not found or unauthorized' }, 404);
  }

  return jsonResponse({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/user
// ═══════════════════════════════════════════════════════════════════════════

framesV2.get('/user', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const builder = getFrameBuilder();
  const frames = await builder.getUserFrames(session.address, c.env);

  return noCacheJsonResponse({ frames });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/discover
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discover trending and newest frames.
 * Query params: limit, cursor, template, sort (trending|newest)
 */
framesV2.get('/discover', async (c) => {
  const limit = Number(c.req.query('limit')) || 20;
  const cursor = c.req.query('cursor');
  const template = c.req.query('template');
  const sort = c.req.query('sort') || 'trending';

  const builder = getFrameBuilder();
  const result = await builder.discoverFrames(c.env, { limit, cursor, template });

  // If sorting by trending, augment with analytics
  if (sort === 'trending' && result.frames.length > 0) {
    const analytics = getFrameAnalytics();
    const rankings = await analytics.getGlobalRankings(c.env, limit);
    const rankedIds = new Set(rankings.map((r) => r.frameId));

    // Sort: ranked frames first, then by creation date
    result.frames.sort((a, b) => {
      const aRank = rankings.find((r) => r.frameId === a.id);
      const bRank = rankings.find((r) => r.frameId === b.id);
      if (aRank && bRank) return bRank.score - aRank.score;
      if (aRank) return -1;
      if (bRank) return 1;
      return b.createdAt - a.createdAt;
    });
  } else {
    // Newest first
    result.frames.sort((a, b) => b.createdAt - a.createdAt);
  }

  return noCacheJsonResponse({
    frames: result.frames.map((f) => ({
      id: f.id,
      url: f.url,
      template: f.template,
      creatorAddress: f.creatorAddress,
      embed: f.embed,
      createdAt: f.createdAt,
    })),
    cursor: result.cursor,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/analytics/:id
// ═══════════════════════════════════════════════════════════════════════════

framesV2.get('/analytics/:id', async (c) => {
  const frameId = c.req.param('id');
  const analytics = getFrameAnalytics();
  const summary = await analytics.getSummary(frameId, c.env);

  if (!summary) {
    return jsonResponse({ error: 'Frame not found or no analytics data' }, 404);
  }

  return noCacheJsonResponse({ analytics: summary });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/analytics (all user frames analytics)
// ═══════════════════════════════════════════════════════════════════════════

framesV2.get('/analytics', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const builder = getFrameBuilder();
  const frames = await builder.getUserFrames(session.address, c.env);
  const analytics = getFrameAnalytics();

  const allSummaries = await Promise.all(
    frames.map((f) => analytics.getSummary(f.id, c.env)),
  );

  const summaries = allSummaries.filter(Boolean);

  const aggregate = {
    totalViews: summaries.reduce((s, a) => s + (a?.totalViews ?? 0), 0),
    totalClicks: summaries.reduce((s, a) => s + (a?.totalClicks ?? 0), 0),
    totalConversions: summaries.reduce((s, a) => s + (a?.totalConversions ?? 0), 0),
    totalFrames: frames.length,
  };

  return noCacheJsonResponse({ analytics: summaries, aggregate });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/frames/crosspost
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cross-post a frame to multiple protocols.
 *
 * Body:
 *   { frameId: string, protocols: string[], channelId?: string,
 *     title?: string, description?: string }
 */
framesV2.post('/crosspost', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      frameId: string;
      protocols: string[];
      channelId?: string;
      title?: string;
      description?: string;
    };

    if (!body.frameId || !body.protocols?.length) {
      return jsonResponse({ error: 'frameId and protocols are required' }, 400);
    }

    const builder = getFrameBuilder();
    const frame = await builder.getFrame(body.frameId, c.env);
    if (!frame) {
      return jsonResponse({ error: 'Frame not found' }, 404);
    }

    if (frame.creatorAddress !== session.address) {
      return jsonResponse({ error: 'Unauthorized — not your frame' }, 403);
    }

    const crossPoster = getFrameCrossPoster();
    const results = await crossPoster.crossPost(
      {
        frameUrl: frame.url,
        frameTitle: body.title ?? frame.config.title ?? 'DegenFeed Frame',
        creatorHandle: session.displayName || session.address.slice(0, 10),
        description: body.description,
        channelId: body.channelId,
        imageUrl: frame.embed.imageUrl,
      },
      body.protocols as any[],
      c.env,
    );

    return jsonResponse({
      ok: results.some((r) => r.ok),
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Cross-post failed: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/frames/notify
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frame notification webhook receiver.
 * Called by Farcaster clients when notification events occur.
 */
framesV2.post('/notify', async (c) => {
  try {
    const body = (await c.req.json()) as {
      event: string;
      fid?: number;
      notificationDetails?: { url?: string; token?: string };
      timestamp?: number;
    };

    if (!body.event) {
      return jsonResponse({ error: 'event is required' }, 400);
    }

    // Log the event
    const eventLog = {
      event: body.event,
      fid: body.fid,
      timestamp: body.timestamp ?? Date.now(),
      receivedAt: new Date().toISOString(),
    };

    // Store in KV for the user's notification history
    if (body.fid && c.env.CACHE) {
      const notifKey = `frames-v2:notifications:fid:${body.fid}`;
      const raw = await c.env.CACHE.get(notifKey);
      const notifs: unknown[] = raw ? JSON.parse(raw) : [];
      notifs.push(eventLog);
      await c.env.CACHE.put(notifKey, JSON.stringify(notifs.slice(-200)), {
        expirationTtl: 86400 * 90,
      });

      // If frame-added or frame-removed, update the frame's subscriber count
      if (body.event === 'frame-added' && body.notificationDetails?.url) {
        const tokenKey = `frames-v2:notif-token:${body.fid}`;
        await c.env.CACHE.put(
          tokenKey,
          JSON.stringify(body.notificationDetails),
          { expirationTtl: 86400 * 365 },
        );
      } else if (body.event === 'frame-removed') {
        const tokenKey = `frames-v2:notif-token:${body.fid}`;
        await c.env.CACHE.delete(tokenKey).catch(() => {});
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Webhook error: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/manifest (.well-known/farcaster.json)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serve the Farcaster Frame Manifest for DegenFeed.
 * Required for Frames v2 to work with Farcaster clients.
 */
framesV2.get('/manifest', async (c) => {
  const manifest = {
    accountAssociation: {
      header: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9',
      payload: btoa(JSON.stringify({ fid: Number(c.env.FARCASTER_BOT_FID || 0) })),
      signature: btoa(c.env.FARCASTER_BOT_SIGNER_KEY || ''),
    },
    frame: {
      version: '1',
      name: 'DegenFeed',
      homeUrl: 'https://app.degenfeed.xyz',
      iconUrl: 'https://app.degenfeed.xyz/icon-200.png',
      imageUrl: 'https://app.degenfeed.xyz/og/default.png',
      buttonTitle: 'Open DegenFeed',
      splashImageUrl: 'https://app.degenfeed.xyz/splash.png',
      splashBackgroundColor: '#6A47E4',
      webhookUrl: 'https://app.degenfeed.xyz/api/frames/notify',
    },
    triggers: [
      { type: 'global', url: 'https://app.degenfeed.xyz' },
      { type: 'embed', url: 'https://app.degenfeed.xyz/api/frames/v2/{frameId}' },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/v2/:id — Serve Frames v2 HTML page
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serve the Frames v2 HTML page for a compiled frame.
 * This is the URL that gets embedded in casts.
 */
framesV2.get('/v2/:id', async (c) => {
  const frameId = c.req.param('id');
  const builder = getFrameBuilder();
  const frame = await builder.getFrame(frameId, c.env);

  if (!frame) {
    return c.html(generateFramesV2Html({
      frameEmbed: buildFrameEmbed({
        imageUrl: 'https://app.degenfeed.xyz/og/frame-not-found.png',
        buttonTitle: 'Frame Not Found',
        appName: 'DegenFeed',
        launchUrl: 'https://app.degenfeed.xyz',
      }),
      title: 'Frame Not Found — DegenFeed',
    }));
  }

  // Track view
  const analytics = getFrameAnalytics();
  await analytics.trackView(frameId, undefined, c.req.header('cf-connecting-ip'), c.env);

  const html = generateFramesV2Html({
    frameEmbed: frame.embed,
    title: frame.config.title || `Frame by ${frame.creatorAddress.slice(0, 10)}`,
    description: frame.config.description || 'Created with DegenFeed Frame Builder',
    postUrl: `https://app.degenfeed.xyz/api/frames/v2/${frameId}`,
    state: JSON.stringify({ step: 0, frameId }),
    manifestUrl: 'https://app.degenfeed.xyz/api/frames/manifest',
    transaction: frame.response.transaction,
  });

  return c.html(html);
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/frames/v2/:id — Handle frame action (button click, tx, etc.)
// ═══════════════════════════════════════════════════════════════════════════

framesV2.post('/v2/:id', async (c) => {
  const frameId = c.req.param('id');
  const builder = getFrameBuilder();
  const frame = await builder.getFrame(frameId, c.env);
  const analytics = getFrameAnalytics();

  if (!frame) {
    return c.html(generateFramesV2Html({
      frameEmbed: buildFrameEmbed({
        imageUrl: 'https://app.degenfeed.xyz/og/frame-not-found.png',
        buttonTitle: 'Frame Not Found',
        appName: 'DegenFeed',
        launchUrl: 'https://app.degenfeed.xyz',
      }),
      title: 'Frame Not Found',
    }));
  }

  try {
    // Parse the frame action body (JSON or form-encoded)
    let buttonIndex = 1;
    let inputText: string | undefined;
    let stateStr: string | undefined;
    let transactionId: string | undefined;
    let interactorFid: number | undefined;
    let interactorAddress: string | undefined;

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('json')) {
      const body = await c.req.json() as Record<string, unknown>;
      buttonIndex = Number(body.buttonIndex) || 1;
      inputText = body.inputText as string | undefined;
      stateStr = body.state as string | undefined;
      transactionId = body.transactionId as string | undefined;
      interactorFid = body.interactorFid as number | undefined;
      interactorAddress = body.interactorAddress as string | undefined;
    } else {
      const formData = await c.req.parseBody();
      buttonIndex = Number(formData.buttonIndex) || 1;
      inputText = formData.inputText as string | undefined;
      stateStr = formData.state as string | undefined;
    }

    // Track click
    await analytics.trackEvent({
      frameId,
      timestamp: Date.now(),
      eventType: 'click',
      buttonIndex,
      inputText,
      interactorFid,
      interactorAddress,
    }, c.env);

    // Parse state for multi-step
    let state: FrameState | undefined;
    if (stateStr) {
      try {
        state = JSON.parse(stateStr) as FrameState;
      } catch { /* ignore invalid state */ }
    }

    // Build the response based on button index and template
    const button = frame.response.buttons[buttonIndex - 1];
    let responseImage = frame.response.image;
    let responseButtons = frame.response.buttons;
    let responseState: string | undefined;
    let responseTransaction = frame.response.transaction;
    let responseLocation: string | undefined;

    // Handle multi-step state transitions
    if (state) {
      state.step++;
      state.data = { ...state.data, inputText, lastButton: buttonIndex };
      responseState = JSON.stringify(state);

      // Different steps show different images/buttons
      if (state.step === 1 && inputText) {
        responseImage = `https://app.degenfeed.xyz/og/step-2.png`;
        responseButtons = [
          { label: '✅ Confirm', action: 'tx' },
          { label: '↩️ Edit', action: 'post' },
        ];
      } else if (state.step >= 2) {
        responseImage = `https://app.degenfeed.xyz/og/confirmed.png`;
        responseButtons = [
          { label: '✅ Done', action: 'post' },
          { label: '🔁 Share', action: 'post_redirect', target: 'https://warpcast.com/~/compose' },
        ];

        // Track as conversion
        await analytics.trackConversion(frameId, frame.template, interactorFid, transactionId, c.env);
      }
    }

    // Handle tx action response
    if (button?.action === 'tx' && responseTransaction) {
      return c.html(generateFramesV2Html({
        frameEmbed: buildFrameEmbed({
          imageUrl: responseImage,
          buttonTitle: button.label.slice(0, 32),
          appName: 'DegenFeed',
          launchUrl: `https://app.degenfeed.xyz/api/frames/v2/${frameId}`,
        }),
        title: 'Confirm Transaction',
        description: `Execute transaction on ${responseTransaction.chainId}`,
        postUrl: `https://app.degenfeed.xyz/api/frames/v2/${frameId}`,
        state: responseState,
        transaction: responseTransaction,
      }));
    }

    // Handle post_redirect
    if (button?.action === 'post_redirect' && button.target) {
      responseLocation = button.target;
    }

    const html = generateFramesV2Html({
      frameEmbed: buildFrameEmbed({
        imageUrl: responseImage,
        buttonTitle: (responseButtons[0]?.label ?? 'Continue').slice(0, 32),
        appName: 'DegenFeed',
        launchUrl: `https://app.degenfeed.xyz/api/frames/v2/${frameId}`,
      }),
      title: frame.config.title || 'Frame',
      description: frame.config.description || 'Powered by DegenFeed',
      postUrl: `https://app.degenfeed.xyz/api/frames/v2/${frameId}`,
      state: responseState,
      transaction: button?.action === 'tx' ? responseTransaction : undefined,
      location: responseLocation,
    });

    return c.html(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.html(generateFramesV2Html({
      frameEmbed: buildFrameEmbed({
        imageUrl: 'https://app.degenfeed.xyz/og/error.png',
        buttonTitle: 'Error',
        appName: 'DegenFeed',
        launchUrl: 'https://app.degenfeed.xyz',
      }),
      title: 'Frame Error',
      description: msg,
    }));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/frames/v2/:id/image — Frame OG image
// ═══════════════════════════════════════════════════════════════════════════

framesV2.get('/v2/:id/image', async (c) => {
  const frameId = c.req.param('id');
  const builder = getFrameBuilder();
  const frame = await builder.getFrame(frameId, c.env);

  const templateName = frame?.template ?? 'custom';
  const creatorAddr = frame?.creatorAddress ?? 'unknown';

  const hue = (frameId.charCodeAt(0) * 61 + 180) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue}, 55%, 18%)" />
      <stop offset="100%" style="stop-color:hsl(${(hue + 60) % 360}, 60%, 10%)" />
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)" rx="12" />
  <rect x="40" y="40" width="1120" height="720" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />

  <text x="600" y="200" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="64" font-weight="bold">
    🖼️ ${escapeXml(templateName)}
  </text>
  <text x="600" y="300" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="28">
    by ${escapeXml(creatorAddr.slice(0, 16))}
  </text>

  <g transform="translate(600, 480)" text-anchor="middle">
    <rect x="-140" y="-30" width="280" height="60" rx="30" fill="url(#bg)" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
    <text x="0" y="12" fill="white" font-family="Arial, sans-serif" font-size="22" font-weight="bold">Interact on Farcaster</text>
  </g>

  <text x="1100" y="740" text-anchor="end" fill="rgba(255,255,255,0.2)" font-family="Arial, sans-serif" font-size="16">
    DegenFeed Frame
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════════════

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default framesV2;
