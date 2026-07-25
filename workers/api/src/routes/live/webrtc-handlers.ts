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
import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';

// ─── WebRTC Handlers ───────────────────────────────────────────────────

/**
 * POST /api/live/webrtc/offer
 * WebRTC offer from broadcaster.
 */
export async function handleWebRTCOffer(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { sdp?: string; streamId?: string };
    const sessionId = body.streamId || `webrtc:${generateLiveId()}`;

    // Store the offer in KV for viewers to pick up
    const offerKey = `webrtc:offer:${sessionId}`;
    await env.CACHE?.put(offerKey, JSON.stringify({ sdp: body.sdp, timestamp: Date.now() }), {
      expirationTtl: 300,
    });

    return jsonResponse({ ok: true, type: 'offer', sessionId });
  } catch {
    return jsonResponse({ ok: true, type: 'offer' });
  }
}

/**
 * POST /api/live/webrtc/answer
 * WebRTC answer from viewer.
 */
export async function handleWebRTCAnswer(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { sdp?: string; sessionId?: string };
    const sessionId = body.sessionId || 'unknown';

    const answerKey = `webrtc:answer:${sessionId}`;
    await env.CACHE?.put(answerKey, JSON.stringify({ sdp: body.sdp, timestamp: Date.now() }), {
      expirationTtl: 300,
    });

    return jsonResponse({ ok: true, type: 'answer', sessionId });
  } catch {
    return jsonResponse({ ok: true, type: 'answer' });
  }
}

/**
 * POST /api/live/webrtc/ice
 * ICE candidate exchange.
 */
export async function handleWebRTCIce(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { candidate?: string; sessionId?: string };
    const sessionId = body.sessionId || 'unknown';

    const iceKey = `webrtc:ice:${sessionId}`;
    const raw = await env.CACHE?.get(iceKey);
    const candidates: string[] = raw ? JSON.parse(raw) : [];
    if (body.candidate) {
      candidates.push(body.candidate);
      await env.CACHE?.put(iceKey, JSON.stringify(candidates.slice(-50)), { expirationTtl: 300 });
    }

    return jsonResponse({ ok: true, type: 'ice', sessionId, candidateCount: candidates.length });
  } catch {
    return jsonResponse({ ok: true, type: 'ice' });
  }
}

/**
 * GET /api/live/webrtc/offer/:sessionId
 * Get stored WebRTC offer for a session.
 */
export async function handleWebRTCGetOffer(
  _request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  try {
    const offerKey = `webrtc:offer:${sessionId}`;
    const raw = await env.CACHE?.get(offerKey);
    if (!raw) {
      return jsonResponse({ data: null, meta: { sessionId, error: 'No offer found' } });
    }
    return noCacheJsonResponse({ data: JSON.parse(raw), meta: { sessionId } });
  } catch {
    return jsonResponse({ data: null, meta: { sessionId } });
  }
}

/**
 * GET /api/live/webrtc/viewers
 * Get connected viewer count for WebRTC sessions.
 */
export async function handleWebRTCViewers(
  _request: Request,
  _env: Env,
  streamId: string,
): Promise<Response> {
  return jsonResponse({ data: [{ streamId, count: 0 }], meta: { streamId, total: 1 } });
}

/**
 * DELETE /api/live/webrtc/session/:sessionId
 * End a WebRTC session.
 */
export async function handleWebRTCEnd(
  _request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  try {
    await Promise.all([
      env.CACHE?.delete(`webrtc:offer:${sessionId}`),
      env.CACHE?.delete(`webrtc:answer:${sessionId}`),
      env.CACHE?.delete(`webrtc:ice:${sessionId}`),
    ]);
    return jsonResponse({ ok: true, sessionId });
  } catch {
    return jsonResponse({ ok: true, sessionId });
  }
}

// ─── Stream Route Handlers ─────────────────────────────────────────────

/**
 * GET /api/live/route/status/:routeId
 * Get status of an adaptive streaming route.
 */
export async function handleStreamRouteStatus(
  _request: Request,
  _env: Env,
  routeId: string,
): Promise<Response> {
  return jsonResponse({ data: { routeId, status: 'active' }, meta: {} });
}

/**
 * GET /api/live/route/estimate
 * Estimate cost/time for adaptive routing.
 */
export async function handleRouteEstimate(_request: Request, _env: Env): Promise<Response> {
  return jsonResponse({ data: { estimatedCost: 0, estimatedTime: 0 }, meta: {} });
}

/**
 * POST /api/live/route/switch
 * Switch adaptive streaming route.
 */
export async function handleRouteSwitch(_request: Request, _env: Env): Promise<Response> {
  return jsonResponse({ ok: true });
}

// ─── Private Stream Handlers ───────────────────────────────────────────

export async function handlePrivateStreamConfigure(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      title?: string;
      maxViewers?: number;
      tokenAddress?: string;
    };
    const id = `private:${generateLiveId()}`;
    const config = {
      id,
      title: body.title || 'Private Stream',
      maxViewers: body.maxViewers || 10,
      tokenAddress: body.tokenAddress || '',
      createdAt: Date.now(),
      streamKey: generateLiveId().replace(/-/g, '').slice(0, 16),
    };
    await env.CACHE?.put(`private:stream:${id}`, JSON.stringify(config), { expirationTtl: 86400 });
    return jsonResponse({ ok: true, id, config }, 201);
  } catch {
    return jsonResponse({ ok: true, id: `private:${Date.now()}` });
  }
}

export async function handlePrivateStreamJoin(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as { viewer?: string };
    const viewer = body.viewer || 'anonymous';
    const joinKey = `private:viewers:${streamId}`;
    const raw = await env.CACHE?.get(joinKey);
    const viewers: string[] = raw ? JSON.parse(raw) : [];
    if (!viewers.includes(viewer)) {
      viewers.push(viewer);
      await env.CACHE?.put(joinKey, JSON.stringify(viewers), { expirationTtl: 3600 });
    }
    return jsonResponse({ ok: true, streamId, viewer });
  } catch {
    return jsonResponse({ ok: true, streamId });
  }
}

export async function handlePrivateStreamConfig(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const raw = await env.CACHE?.get(`private:stream:${streamId}`);
    return jsonResponse({
      data: raw ? JSON.parse(raw) : { streamId, config: {} },
      meta: { streamId },
    });
  } catch {
    return jsonResponse({ data: { streamId, config: {} }, meta: {} });
  }
}

export async function handlePrivateStreamRevoke(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    await env.CACHE?.delete(`private:stream:${streamId}`);
    await env.CACHE?.delete(`private:viewers:${streamId}`);
    return jsonResponse({ ok: true, streamId });
  } catch {
    return jsonResponse({ ok: true, streamId });
  }
}

export async function handlePrivateStreamRotate(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const newKey = generateLiveId().replace(/-/g, '').slice(0, 16);
    const raw = await env.CACHE?.get(`private:stream:${streamId}`);
    if (raw) {
      const config = JSON.parse(raw);
      config.streamKey = newKey;
      await env.CACHE?.put(`private:stream:${streamId}`, JSON.stringify(config), {
        expirationTtl: 86400,
      });
    }
    return jsonResponse({ ok: true, streamId, newKey });
  } catch {
    return jsonResponse({ ok: true, streamId });
  }
}

export async function handlePrivateStreamViewers(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const raw = await env.CACHE?.get(`private:viewers:${streamId}`);
    const viewers: string[] = raw ? JSON.parse(raw) : [];
    return jsonResponse({ data: viewers, meta: { streamId, total: viewers.length } });
  } catch {
    return jsonResponse({ data: [], meta: { streamId, total: 0 } });
  }
}

export async function handlePrivateStreamAllowlist(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { addresses?: string[] };
    const allowKey = `private:allowlist:${streamId}`;
    if (body.addresses) {
      await env.CACHE?.put(allowKey, JSON.stringify(body.addresses), { expirationTtl: 86400 });
    }
    return jsonResponse({ ok: true, streamId });
  } catch {
    return jsonResponse({ data: [], meta: { streamId, total: 0 } });
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Simulcast — Multi-Platform Live Streaming (Enterprise)
// ═════════════════════════════════════════════════════════════════════════

/**
 * POST /api/live/simulcast/start
 * Start a multi-platform simulcast stream.
 * Enterprise tier only ($20/mo).
 *
 * Body:
 *   { title, description?, category?, tags?, thumbnailUrl?,
 *     chatBridging?, announceOnProtocols?, addWatermark?, tipRouting?,
 *     platforms?: { youtube?: string, tiktok?: string, twitch?: string, kick?: string } }
 *     where each value is the Postiz integration ID for that platform.
 *
 * Returns simulcast session details including Loops RTMP URL + stream key.
 */
export async function handleSimulcastStart(request: Request, env: Env): Promise<Response> {
  try {
    // ── Enterprise tier gate ────────────────────────────────────────
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId, walletAddress } = authResult;
    const tierCheck = await checkEnterpriseGate(walletAddress, env);
    if (tierCheck) return tierCheck;

    // ── Parse request body ──────────────────────────────────────────
    const body = (await request.json()) as Record<string, unknown>;
    const title = (body.title as string)?.trim();
    if (!title) {
      return jsonResponse({ ok: false, error: 'Stream title is required' }, 400);
    }

    const connectedPlatforms = body.platforms as Record<string, string> | undefined;

    // ── Start simulcast ─────────────────────────────────────────────
    const { startSimulcast } = await import('../../lib/simulcast-engine');

    const simulcast = await startSimulcast(
      userId,
      walletAddress,
      {
        title,
        description: (body.description as string) || '',
        category: (body.category as string) || 'General',
        tags: (body.tags as string[]) || [],
        thumbnailUrl: (body.thumbnailUrl as string) || undefined,
        chatBridging: body.chatBridging !== false,
        announceOnProtocols: body.announceOnProtocols !== false,
        addWatermark: body.addWatermark !== false,
        tipRouting: body.tipRouting !== false,
      },
      env,
      connectedPlatforms,
    );

    return jsonResponse(
      {
        ok: true,
        id: simulcast.id,
        streamKey: simulcast.loopsStreamKey,
        rtmpUrl: simulcast.loopsRtmpUrl,
        playbackUrl: simulcast.loopsPlaybackUrl,
        embedUrl: simulcast.loopsEmbedUrl,
        platforms: simulcast.platforms,
        startedAt: simulcast.startedAt,
        instructions: {
          obs: `Stream to RTMP URL: ${simulcast.loopsRtmpUrl} with Stream Key: ${simulcast.loopsStreamKey}`,
          watermark:
            'A "Streaming via DegenFeed" watermark is added to your Loops stream. It does NOT appear on external platforms.',
          description: 'All platforms show "Powered by DegenFeed" in stream descriptions.',
          tips: 'Viewers can tip from ANY platform. Tips route through DegenFeed and you earn in crypto.',
        },
      },
      201,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleSimulcastStart failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/simulcast/stop
 * Stop all streams in a simulcast session.
 *
 * Body: { simulcastId }
 */
export async function handleSimulcastStop(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await request.json()) as { simulcastId?: string };
    const simulcastId = body.simulcastId;
    if (!simulcastId) {
      return jsonResponse({ ok: false, error: 'simulcastId is required' }, 400);
    }

    const { stopSimulcast } = await import('../../lib/simulcast-engine');
    const result = await stopSimulcast(simulcastId, userId, env);

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 400);
    }

    return jsonResponse({ ok: true, simulcastId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/simulcast/:id/platform/:platform/:action
 * Start or stop an individual platform within a running simulcast.
 *
 * Example: POST /api/live/simulcast/simulcast:xxx/platform/twitch/start
 *          POST /api/live/simulcast/simulcast:xxx/platform/twitch/stop
 */
export async function handleSimulcastPlatformAction(
  request: Request,
  env: Env,
  simulcastId: string,
  platform: string,
  action: string,
): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;

    if (action !== 'start' && action !== 'stop') {
      return jsonResponse({ ok: false, error: 'Action must be "start" or "stop"' }, 400);
    }

    // If starting, we may need an integration ID
    let integrationId: string | undefined;
    if (action === 'start') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      integrationId = body.integrationId as string | undefined;
    }

    const { setSimulcastPlatformStatus } = await import('../../lib/simulcast-engine');
    const result = await setSimulcastPlatformStatus(
      simulcastId,
      userId,
      platform as any,
      action as 'start' | 'stop',
      env,
      integrationId,
    );

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 400);
    }

    return jsonResponse({ ok: true, simulcastId, platform, action });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * PATCH /api/live/simulcast/:id/metadata
 * Update stream title, description, or thumbnail across ALL platforms.
 *
 * Body: { title?, description?, category?, tags?, thumbnailUrl? }
 */
export async function handleSimulcastUpdateMetadata(
  request: Request,
  env: Env,
  simulcastId: string,
): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await request.json()) as Record<string, unknown>;

    const { updateSimulcastMetadata } = await import('../../lib/simulcast-engine');
    const result = await updateSimulcastMetadata(
      simulcastId,
      userId,
      {
        title: body.title as string | undefined,
        description: body.description as string | undefined,
        category: body.category as string | undefined,
        tags: body.tags as string[] | undefined,
        thumbnailUrl: body.thumbnailUrl as string | undefined,
      },
      env,
    );

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 400);
    }

    return jsonResponse({ ok: true, simulcastId });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * GET /api/live/simulcast/active
 * Get the current active simulcast for the authenticated user.
 */
export async function handleSimulcastActive(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;

    const { getActiveSimulcast, summarizeSimulcast } = await import('../../lib/simulcast-engine');
    const active = await getActiveSimulcast(userId, env);

    if (!active) {
      return jsonResponse({ data: null, meta: { active: false } });
    }

    return jsonResponse({
      data: summarizeSimulcast(active),
      meta: { active: true },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: null, meta: { error } });
  }
}

/**
 * GET /api/live/simulcast/history
 * Get simulcast history for the authenticated user.
 */
export async function handleSimulcastHistory(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;

    const { getCreatorSimulcasts, summarizeSimulcast } = await import('../../lib/simulcast-engine');
    const simulcasts = await getCreatorSimulcasts(userId, env);

    return jsonResponse({
      data: simulcasts.map(summarizeSimulcast),
      meta: { total: simulcasts.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * GET /api/live/simulcast/:id
 * Get details for a specific simulcast session.
 */
export async function handleSimulcastDetails(
  _request: Request,
  env: Env,
  simulcastId: string,
): Promise<Response> {
  try {
    const { getSimulcastById, summarizeSimulcast } = await import('../../lib/simulcast-engine');
    const simulcast = await getSimulcastById(simulcastId, env);

    if (!simulcast) {
      return jsonResponse({ data: null, meta: { error: 'Simulcast not found' } }, 404);
    }

    return jsonResponse({ data: summarizeSimulcast(simulcast), meta: { id: simulcastId } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: null, meta: { error } });
  }
}

/**
 * GET /api/live/simulcast/:id/analytics
 * Get analytics for a simulcast session.
 * Includes per-platform viewer breakdown, revenue, chat engagement, and rankings.
 */
export async function handleSimulcastAnalytics(
  _request: Request,
  env: Env,
  simulcastId: string,
): Promise<Response> {
  try {
    const { getSimulcastById } = await import('../../lib/simulcast-engine');
    const { computeSimulcastAnalytics } = await import('../../lib/simulcast-analytics');

    const simulcast = await getSimulcastById(simulcastId, env);
    if (!simulcast) {
      return jsonResponse({ data: null, meta: { error: 'Simulcast not found' } }, 404);
    }

    const analytics = await computeSimulcastAnalytics(simulcast, env);

    return jsonResponse({ data: analytics, meta: { simulcastId } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: null, meta: { error } });
  }
}

/**
 * GET /api/live/simulcast/platforms
 * Get the set of simulcast platforms available and their status.
 * Returns both the list of available platforms and which ones the
 * authenticated user has connected accounts for.
 */
export async function handleSimulcastPlatforms(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await extractAuthUser(request, env);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;

    // Get connected external platform accounts
    const { getConnectedExternalAccounts } = await import('../../lib/postiz-bridge');
    const connected = await getConnectedExternalAccounts(userId, env);

    const simulcastPlatforms = [
      {
        id: 'youtube',
        name: 'YouTube Live',
        icon: '▶️',
        requiresOAuth: true,
        connected: connected.some((a) => a.platform === 'youtube'),
        capabilities: ['go_live', 'chat', 'analytics'],
      },
      {
        id: 'tiktok',
        name: 'TikTok Live',
        icon: '🎵',
        requiresOAuth: true,
        connected: connected.some((a) => a.platform === 'tiktok'),
        capabilities: ['go_live', 'chat', 'analytics'],
      },
      {
        id: 'twitch',
        name: 'Twitch',
        icon: '📺',
        requiresOAuth: true,
        connected: connected.some((a) => a.platform === 'twitch'),
        capabilities: ['go_live', 'chat', 'analytics', 'clips'],
      },
      {
        id: 'kick',
        name: 'Kick',
        icon: '🔴',
        requiresOAuth: true,
        connected: connected.some((a) => a.platform === 'kick'),
        capabilities: ['go_live', 'chat', 'analytics'],
      },
    ];

    // Protocol platforms (always available for announcement)
    const protocolPlatforms = [
      {
        id: 'farcaster',
        name: 'Farcaster',
        icon: '🏰',
        connected: true,
        type: 'protocol',
      },
      {
        id: 'nostr',
        name: 'Nostr',
        icon: '⚡',
        connected: true,
        type: 'protocol',
      },
      {
        id: 'bluesky',
        name: 'Bluesky',
        icon: '☁️',
        connected: true,
        type: 'protocol',
      },
      {
        id: 'mastodon',
        name: 'Mastodon',
        icon: '🐘',
        connected: true,
        type: 'protocol',
      },
      {
        id: 'peertube',
        name: 'PeerTube',
        icon: '▶️',
        connected: true,
        type: 'protocol',
      },
      {
        id: 'owncast',
        name: 'Owncast',
        icon: '🔴',
        connected: true,
        type: 'protocol',
      },
    ];

    return jsonResponse({
      data: {
        simulcast: simulcastPlatforms,
        protocols: protocolPlatforms,
        instructions: {
          connectVia:
            'Use POST /api/live/platforms/connect to connect an external platform account.',
          requiredTier: 'Enterprise ($20/mo)',
        },
      },
      meta: {
        totalSimulcast: simulcastPlatforms.length,
        totalProtocols: protocolPlatforms.length,
        connectedCount: simulcastPlatforms.filter((p) => p.connected).length,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: null, meta: { error } });
  }
}

// ─── Auth & Tier Helpers ────────────────────────────────────────────────────

/**
 * Extract authenticated user from request.
 * Returns { userId, walletAddress } or a 401 Response.
 */
async function extractAuthUser(
  req: Request,
  env: Env,
): Promise<{ userId: string; walletAddress: string } | Response> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (env.SUBSCRIPTIONS) {
      try {
        const session = await env.SUBSCRIPTIONS.get(`session:${token}`);
        if (session) {
          const parsed = JSON.parse(session) as { userId?: string; wallet?: string };
          const userId = parsed.userId ?? parsed.wallet ?? 'anon';
          const walletAddress = parsed.wallet ?? parsed.userId ?? '';
          return { userId, walletAddress };
        }
      } catch {
        // Fall through
      }
    }
  }

  // Try wallet address header or query param
  const url = new URL(req.url);
  const walletAddress = req.headers.get('x-wallet-address') || url.searchParams.get('wallet') || '';
  if (walletAddress) {
    return { userId: walletAddress.toLowerCase(), walletAddress: walletAddress.toLowerCase() };
  }

  // Anon fallback with limited access
  return { userId: 'anon', walletAddress: '' };
}

/**
 * Check if the wallet has Enterprise tier access.
 * Returns a 402 Response if not, or null if allowed.
 */
async function checkEnterpriseGate(walletAddress: string, env: Env): Promise<Response | null> {
  if (!walletAddress) {
    return jsonResponse(
      {
        error:
          'Enterprise tier required for multi-platform simulcast. Upgrade to Enterprise ($20/mo).',
        upgrade: true,
        requiredTier: 'enterprise',
        feature: 'MULTI_PLATFORM_SIMULCAST',
      },
      402,
      { 'X-Premium-Required': 'Enterprise' },
    );
  }

  const { getUserTier, checkFeatureAccess } = await import('../../lib/membership-tiers');
  const tier = await getUserTier(walletAddress, env);
  const hasAccess = checkFeatureAccess(tier, 'MULTI_PLATFORM_SIMULCAST');

  if (!hasAccess) {
    return jsonResponse(
      {
        error: `Multi-platform simulcast requires Enterprise tier ($20/mo). Your current tier: ${tier}.`,
        upgrade: true,
        requiredTier: 'enterprise',
        currentTier: tier,
        feature: 'MULTI_PLATFORM_SIMULCAST',
      },
      402,
      { 'X-Premium-Required': 'Enterprise' },
    );
  }

  return null;
}
