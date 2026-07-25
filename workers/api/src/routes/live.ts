/**
 * @degenfeed/api-worker — Live Streaming Hub API Routes
 *
 * Unified live streaming API across Owncast, PeerTube, YouTube, Twitch, and Spaces.
 * Every response is validated with proper error handling and cache control.
 *
 * Routes:
 *   GET    /api/live/now                   — All currently live streams
 *   GET    /api/live/upcoming              — Scheduled upcoming streams
 *   GET    /api/live/sources               — Available live sources + health
 *   GET    /api/live/:id                   — Stream details
 *   GET    /api/live/creators/:id          — Creator's schedule + past streams
 *   POST   /api/live/go-live              — Start streaming
 *   POST   /api/live/stop                  — Stop streaming
 *   POST   /api/live/schedule              — Schedule a future stream
 *   GET    /api/live/chat/:id/messages     — Chat messages
 *   POST   /api/live/chat/:id/message      — Send chat message
 *   POST   /api/live/:id/tip               — Tip the streamer
 *   GET    /api/live/viewers/:id           — Real-time viewer count (SSE)
 */

import {
  aggregateAllStreams,
  aggregateUpcomingStreams,
  createSchedule,
  formatViewerSSE,
  type GoLiveConfig,
  generateLiveId,
  getCreatorSchedules,
  getSourceHealth,
  getStreamViewerCount,
  startLiveStream,
  stopLiveStream,
  type UnifiedLiveStream,
  type UpcomingStream,
} from '../feed/live-aggregator';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { handleChatMessages, handleSendChat } from '../lib/stream-chat';
import { requireSession } from '../session';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── GET /api/live/now ──────────────────────────────────────────────
// All currently live streams across all platforms

export async function handleLiveNow(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source'); // optional filter: owncast, peertube, youtube, twitch, spaces
    const category = url.searchParams.get('category');
    const sort = url.searchParams.get('sort') || 'viewers'; // viewers, recent, category
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    let streams = await aggregateAllStreams(env);

    // Apply filters
    if (source) {
      streams = streams.filter((s) => s.source === source);
    }
    if (category) {
      streams = streams.filter((s) => s.category.toLowerCase() === category.toLowerCase());
    }

    // Apply sorting
    switch (sort) {
      case 'recent':
        streams.sort((a, b) => b.startedAt - a.startedAt);
        break;
      case 'category':
        streams.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'viewers':
      default:
        streams.sort((a, b) => b.viewerCount - a.viewerCount);
        break;
    }

    const sliced = streams.slice(0, limit);

    return noCacheJsonResponse({
      streams: sliced,
      total: streams.length,
      sources: aggregateSourceCounts(streams),
      fetchedAt: Date.now(),
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/live/upcoming ─────────────────────────────────────────
// Scheduled upcoming streams

export async function handleLiveUpcoming(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const upcoming = await aggregateUpcomingStreams(env);
    return noCacheJsonResponse({ upcoming, total: upcoming.length });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/live/sources ──────────────────────────────────────────
// Available live sources + health status

export async function handleLiveSources(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const streams = await aggregateAllStreams(env);
    const sourceHealth = getSourceHealth(env);

    // Also fetch fresh health data
    const health = await sourceHealth;

    const sourceInfo = SOURCE_CONFIGS.map((cfg) => ({
      ...cfg,
      healthy: health[cfg.id]?.healthy ?? false,
      lastChecked: health[cfg.id]?.lastChecked ?? null,
      error: health[cfg.id]?.error ?? null,
      streamCount: streams.filter((s) => s.source === cfg.id).length,
      latencyMs: health[cfg.id]?.latencyMs ?? null,
    }));

    return noCacheJsonResponse({ sources: sourceInfo });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

const SOURCE_CONFIGS = [
  {
    id: 'owncast' as const,
    name: 'Owncast',
    description: 'Self-hosted live streaming',
    icon: '📡',
    color: '#00ff41',
    enabled: true,
  },
  {
    id: 'peertube' as const,
    name: 'PeerTube',
    description: 'Federated video platform',
    icon: '🎥',
    color: '#F1684B',
    enabled: true,
  },
  {
    id: 'youtube' as const,
    name: 'YouTube Live',
    description: 'Google YouTube live streams',
    icon: '▶️',
    color: '#FF0000',
    enabled: true,
  },
  {
    id: 'twitch' as const,
    name: 'Twitch',
    description: 'Twitch interactive streaming',
    icon: '📺',
    color: '#9146FF',
    enabled: true,
  },
  {
    id: 'spaces' as const,
    name: 'Spaces',
    description: 'DegenFeed Audio Spaces',
    icon: '🎙️',
    color: '#00BCD4',
    enabled: true,
  },
  {
    id: 'farcaster' as const,
    name: 'Farcaster Live',
    description: 'Farcaster Frame live streams',
    icon: '📱',
    color: '#8A63D2',
    enabled: true,
  },
  {
    id: 'nostr' as const,
    name: 'Nostr Live',
    description: 'Nostr NIP-53 live events',
    icon: '⚡',
    color: '#E87928',
    enabled: true,
  },
];

// ─── GET /api/live/:id ──────────────────────────────────────────────
// Stream details + chat + viewer count

export async function handleLiveDetails(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const streams = await aggregateAllStreams(env);
    const stream = streams.find((s) => s.id === streamId);

    if (!stream) {
      return jsonResponse({ error: 'Stream not found' }, 404);
    }

    // Get fresh viewer count
    const viewerCount = await getStreamViewerCount(env, streamId);

    // Get recent chat messages if applicable
    let chat: unknown[] = [];
    try {
      chat = await handleChatMessages(env, streamId, 50);
    } catch {
      // Chat is optional
    }

    return noCacheJsonResponse({
      stream: { ...stream, viewerCount },
      chat,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/live/creators/:id ─────────────────────────────────────
// Creator's live schedule + past streams

export async function handleCreatorLiveProfile(
  request: Request,
  env: Env,
  creatorId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    // Get currently live streams by this creator
    const streams = await aggregateAllStreams(env);
    const activeStreams = streams.filter(
      (s) =>
        s.streamer.id.toLowerCase().includes(creatorId.toLowerCase()) ||
        s.streamer.walletAddress?.toLowerCase() === creatorId.toLowerCase() ||
        s.streamer.handle.toLowerCase() === creatorId.toLowerCase(),
    );

    // Get scheduled streams
    const schedules = await getCreatorSchedules(env, creatorId);

    return noCacheJsonResponse({
      creator: { id: creatorId },
      currentlyLive: activeStreams,
      isLive: activeStreams.length > 0,
      upcoming: schedules,
      totalLive: activeStreams.length,
      totalScheduled: schedules.length,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/live/go-live ─────────────────────────────────────────
// Start streaming (Owncast/PeerTube)

export async function handleGoLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as Partial<GoLiveConfig>;

    if (!body.title?.trim()) {
      return jsonResponse({ error: 'Title is required' }, 400);
    }
    if (!body.platform) {
      return jsonResponse({ error: 'Platform is required (owncast, peertube, or both)' }, 400);
    }
    if (!['owncast', 'peertube', 'both'].includes(body.platform)) {
      return jsonResponse({ error: 'Invalid platform. Must be owncast, peertube, or both' }, 400);
    }

    const config: GoLiveConfig = {
      title: body.title.trim(),
      description: body.description?.trim(),
      category: body.category || 'General',
      tags: body.tags || [],
      privacy: body.privacy || 'public',
      recordingEnabled: body.recordingEnabled ?? true,
      chatEnabled: body.chatEnabled ?? true,
      platform: body.platform,
      thumbnailUrl: body.thumbnailUrl,
      creatorId: session.address,
      creatorHandle: session.displayName || session.address.slice(0, 8),
      creatorDisplayName: session.displayName || session.address.slice(0, 8),
      creatorAvatarUrl: session.avatarUrl,
    };

    const result = await startLiveStream(env, config);

    return jsonResponse({ ok: true, ...result }, 201);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/live/stop ────────────────────────────────────────────
// Stop streaming

export async function handleStopLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      streamId?: string;
      platform?: 'owncast' | 'peertube' | 'spaces';
    };

    if (!body.streamId || !body.platform) {
      return jsonResponse({ error: 'streamId and platform are required' }, 400);
    }

    await stopLiveStream(env, body.streamId, body.platform);

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/live/schedule ────────────────────────────────────────
// Schedule a future stream

export async function handleScheduleStream(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      scheduledAt?: string;
      category?: string;
      tags?: string[];
      privacy?: 'public' | 'unlisted' | 'private';
      recordingEnabled?: boolean;
      chatEnabled?: boolean;
      source?: 'owncast' | 'peertube';
    };

    if (!body.title?.trim()) {
      return jsonResponse({ error: 'Title is required' }, 400);
    }
    if (!body.scheduledAt) {
      return jsonResponse({ error: 'scheduledAt is required (ISO 8601)' }, 400);
    }

    const scheduledTime = new Date(body.scheduledAt).getTime();
    if (scheduledTime <= Date.now()) {
      return jsonResponse({ error: 'scheduledAt must be in the future' }, 400);
    }

    const schedule = {
      id: generateLiveId(),
      creatorId: session.address,
      title: body.title.trim(),
      description: body.description?.trim(),
      source: body.source || 'owncast',
      scheduledAt: scheduledTime,
      category: body.category || 'General',
      tags: body.tags || [],
      privacy: body.privacy || 'public',
      recordingEnabled: body.recordingEnabled ?? true,
      chatEnabled: body.chatEnabled ?? true,
      createdAt: Date.now(),
    };

    const created = await createSchedule(env, schedule);

    return jsonResponse({ schedule: created, ok: true }, 201);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/live/chat/:id/messages ─────────────────────────────────
// Chat messages for a stream

export async function handleLiveChatMessages(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const before = url.searchParams.get('before') || undefined;

    const messages = await handleChatMessages(env, streamId, limit, before);
    return noCacheJsonResponse({ messages, total: messages.length, streamId });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/live/chat/:id/message ─────────────────────────────────
// Send a chat message to a stream

export async function handleLiveChatSend(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { message?: string };

    if (!body.message?.trim()) {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    const sanitized = body.message.trim().slice(0, 500);
    const message = await handleSendChat(env, streamId, session.address, sanitized, {
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
    });

    return jsonResponse({ message, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/live/:id/tip ─────────────────────────────────────────
// Tip the streamer during live

export async function handleLiveTip(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      amount?: string;
      chain?: string;
      message?: string;
    };

    if (!body.amount || !body.chain) {
      return jsonResponse({ error: 'amount and chain are required' }, 400);
    }

    // Delegate to the unified tip system
    // [REVIEW] This delegates to the existing tip system — the actual
    // tip execution happens in the cross-chain tip engine.
    broadcastToAll(CHANNELS.TIP_RECEIVED, {
      type: 'live_stream_tip',
      streamId,
      from: session.address,
      amount: body.amount,
      chain: body.chain,
      message: body.message || 'Live stream tip! 🎁',
    });

    return jsonResponse({
      ok: true,
      message: 'Tip sent',
      streamId,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/live/viewers/:id (SSE) ─────────────────────────────────
// Real-time viewer count via Server-Sent Events

export async function handleLiveViewersSSE(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const accept = request.headers.get('accept');
  if (!accept?.includes('text/event-stream')) {
    // Return single viewer count for non-SSE clients
    try {
      const count = await getStreamViewerCount(env, streamId);
      return noCacheJsonResponse({ streamId, viewerCount: count });
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const running = true;

      const poll = async () => {
        try {
          const count = await getStreamViewerCount(env, streamId);
          const data = formatViewerSSE(streamId, count);
          controller.enqueue(encoder.encode(data));
        } catch {
          // Keep polling even if one request fails
        }

        if (running) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        }
      };

      // Send initial count immediately
      await poll();
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

interface SourceCount {
  source: string;
  count: number;
  label: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Farcaster Live Routes
// ═══════════════════════════════════════════════════════════════════════

/**
 * POST /api/live/farcaster/start — Start restreaming a Farcaster live
 */
export async function handleFarcasterLiveStart(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { fid?: number; username?: string; title?: string };

    if (!body.fid) {
      return jsonResponse({ error: 'fid is required' }, 400);
    }

    const { detectFarcasterLives, startFarcasterRestream } = await import(
      '../lib/farcaster-live-wrapper'
    );

    // Detect the live stream
    const detected = await detectFarcasterLives(env);
    const live = detected.find((l) => l.fid === body.fid);

    if (!live) {
      return jsonResponse({ error: 'No active Farcaster live found for this FID' }, 404);
    }

    // Start restreaming through PeerTube
    const result = await startFarcasterRestream(env, live);

    return jsonResponse(
      {
        ok: true,
        session: {
          id: result.session.id,
          fid: result.session.fid,
          username: result.session.username,
          title: result.session.title,
          embedUrl: result.session.peerTubeEmbedUrl || result.session.activityUrl,
          viewerCount: result.session.viewerCount,
          startedAt: result.session.startedAt,
        },
        peertube: result.peerTubeResult,
      },
      201,
    );
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/live/farcaster/active — Active Farcaster lives being restreamed
 */
export async function handleFarcasterLiveActive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const { getActiveFarcasterLives } = await import('../lib/farcaster-live-wrapper');
    const sessions = await getActiveFarcasterLives(env);

    return noCacheJsonResponse({
      sessions: sessions.map((s) => ({
        id: s.id,
        fid: s.fid,
        username: s.username,
        displayName: s.displayName,
        title: s.title,
        thumbnailUrl: s.avatarUrl,
        embedUrl: s.peerTubeEmbedUrl || s.activityUrl,
        viewerCount: s.viewerCount,
        startedAt: s.startedAt,
        isRestreaming: s.isRestreaming,
      })),
      total: sessions.length,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/live/farcaster/chat — Send chat to Farcaster live
 */
export async function handleFarcasterLiveChatSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { sessionId?: string; message?: string };
    const sessionId = body.sessionId || request.url.split('/').pop() || '';

    if (!body.message?.trim()) {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    const { sendFarcasterChat } = await import('../lib/farcaster-live-wrapper');
    const chatMsg = await sendFarcasterChat(
      env,
      sessionId,
      session.address,
      body.message.trim(),
      session.displayName || session.address.slice(0, 8),
      session.avatarUrl,
    );

    return jsonResponse({ message: chatMsg, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

function aggregateSourceCounts(streams: UnifiedLiveStream[]): SourceCount[] {
  const counts: Record<string, { count: number; label: string }> = {};
  for (const s of streams) {
    if (!counts[s.source]) {
      counts[s.source] = { count: 0, label: s.source.charAt(0).toUpperCase() + s.source.slice(1) };
    }
    counts[s.source]!.count++;
  }
  return Object.entries(counts).map(([source, info]) => ({
    source,
    count: info.count,
    label: info.label,
  }));
}
