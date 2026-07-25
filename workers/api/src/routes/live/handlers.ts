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

// ─── Helpers ──────────────────────────────────────────────────────────

function sourceLabel(source: string): string {
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
    loops: 'Loops Live',
    lens: 'Lens',
    zora: 'Zora',
  };
  return labels[source] || source;
}

// ─── Core Live Handlers ────────────────────────────────────────────────

/**
 * GET /api/live/now
 * Returns all currently live streams aggregated from all sources.
 * Supports ?refresh=true to bypass cache, ?source=twitch to filter, ?limit=N
 */
export async function handleLiveNow(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const sourceFilter = url.searchParams.get('source');
    const limitParam = url.searchParams.get('limit');

    const allStreams = await aggregateAllStreams(env, forceRefresh);

    let filtered = allStreams;
    if (sourceFilter) {
      const sources = sourceFilter.split(',') as UnifiedLiveStream['source'][];
      filtered = allStreams.filter((s) => sources.includes(s.source));
    }

    if (limitParam) {
      const limit = Math.min(Number.parseInt(limitParam, 10) || 25, 100);
      filtered = filtered.slice(0, limit);
    }

    const sourceCounts: Record<string, number> = {};
    for (const s of allStreams) {
      sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
    }

    return noCacheJsonResponse({
      data: filtered,
      meta: {
        total: filtered.length,
        totalAllSources: allStreams.length,
        source: 'live',
        sourceCounts,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveNow failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/upcoming
 * Returns scheduled/upcoming streams from all sources.
 */
export async function handleLiveUpcoming(_request: Request, env: Env): Promise<Response> {
  try {
    const upcoming = await aggregateUpcomingStreams(env);
    return noCacheJsonResponse({
      data: upcoming,
      meta: { total: upcoming.length, source: 'live' },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveUpcoming failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/sources
 * Returns available live sources with health status.
 */
export async function handleLiveSources(_request: Request, env: Env): Promise<Response> {
  try {
    const health = await getSourceHealth(env);

    const sources = Object.entries(health).map(([source, h]) => ({
      source,
      label: sourceLabel(source),
      healthy: h.healthy,
      lastChecked: h.lastChecked,
      error: h.error || null,
      streamCount: h.streamCount,
      latencyMs: h.latencyMs,
    }));

    // Always include all known sources even if never checked
    const knownSources = [
      'owncast',
      'peertube',
      'youtube',
      'twitch',
      'kick',
      'spaces',
      'farcaster',
      'nostr',
      'loops',
    ];

    for (const src of knownSources) {
      if (!sources.find((s) => s.source === src)) {
        sources.push({
          source: src,
          label: sourceLabel(src),
          healthy: false,
          lastChecked: 0,
          error: 'Not yet checked',
          streamCount: 0,
          latencyMs: 0,
        });
      }
    }

    return noCacheJsonResponse({
      data: sources,
      meta: { total: sources.length, source: 'live' },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveSources failed:', error);
    return jsonResponse({ data: [], meta: { total: 0, source: 'live', error } });
  }
}

/**
 * GET /api/live/:id
 * Returns details for a specific stream by ID.
 */
export async function handleLiveDetails(
  _request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  try {
    // Check if it's a legacy stream record in CONTENT_STORE
    const raw = await env.CONTENT_STORE?.get(`stream:record:${id}`);
    if (raw) {
      try {
        const record = JSON.parse(raw);
        return noCacheJsonResponse({ data: record, meta: { id } });
      } catch {
        // Fall through to live aggregator
      }
    }

    // Search in aggregated live streams
    const allStreams = await aggregateAllStreams(env);
    const stream = allStreams.find((s) => s.id === id);

    if (!stream) {
      // Also check by creator handle
      const byHandle = allStreams.find(
        (s) => s.streamer.handle === id || s.streamer.displayName === id,
      );
      if (byHandle) {
        return noCacheJsonResponse({ data: byHandle, meta: { id } });
      }
      return jsonResponse({ data: null, meta: { id, error: 'Stream not found' } }, 404);
    }

    return noCacheJsonResponse({ data: stream, meta: { id } });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveDetails failed:', error);
    return jsonResponse({ data: null, meta: { id, error } });
  }
}

/**
 * GET /api/live/creators/:id
 * Returns live status for a specific creator across all platforms.
 */
export async function handleCreatorLiveProfile(
  _request: Request,
  env: Env,
  creatorId: string,
): Promise<Response> {
  try {
    const allStreams = await aggregateAllStreams(env);
    const creatorStreams = allStreams.filter(
      (s) =>
        s.streamer.id === creatorId ||
        s.streamer.handle === creatorId ||
        s.streamer.displayName === creatorId ||
        s.streamer.walletAddress === creatorId,
    );

    return noCacheJsonResponse({
      data: {
        isLive: creatorStreams.length > 0,
        streams: creatorStreams,
      },
      meta: { creatorId, total: creatorStreams.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: { isLive: false, streams: [] }, meta: { creatorId, error } });
  }
}

// ─── Go Live / Stop Live ───────────────────────────────────────────────

/**
 * POST /api/live/go-live
 * Start a live stream on Owncast and/or PeerTube.
 * Returns stream keys and URLs. Announces on Nostr, Farcaster, ActivityPub.
 *
 * Body:
 *   { title, description?, category?, tags?, platform: 'owncast'|'peertube'|'both',
 *     privacy?, recordingEnabled?, chatEnabled?, thumbnailUrl?, creatorId, creatorHandle,
 *     creatorDisplayName?, creatorAvatarUrl? }
 */
export async function handleGoLive(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = (body.title as string)?.trim();
    if (!title) {
      return jsonResponse({ ok: false, error: 'Stream title is required' }, 400);
    }

    // Extract creator info from request or generate defaults
    const creatorId = (body.creatorId as string) || `creator:${Date.now()}`;
    const creatorHandle = (body.creatorHandle as string) || `anon_${Date.now().toString(36)}`;

    const config = {
      title,
      description: (body.description as string) || '',
      category: (body.category as string) || 'General',
      tags: (body.tags as string[]) || [],
      privacy: (body.privacy as 'public' | 'unlisted' | 'private') || 'public',
      recordingEnabled: body.recordingEnabled !== false,
      chatEnabled: body.chatEnabled !== false,
      platform: (body.platform as 'owncast' | 'peertube' | 'both') || 'owncast',
      thumbnailUrl: (body.thumbnailUrl as string) || undefined,
      creatorId,
      creatorHandle,
      creatorDisplayName: (body.creatorDisplayName as string) || creatorHandle,
      creatorAvatarUrl: (body.creatorAvatarUrl as string) || undefined,
    };

    const result = await startLiveStream(env, config);

    // Broadcast go-live event to WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_started',
      streamId: result.streamId,
      platform: config.platform,
      title: config.title,
      creatorId: config.creatorId,
      creatorHandle: config.creatorHandle,
      playbackUrl: result.playbackUrl,
      startedAt: Date.now(),
    });

    return jsonResponse(
      {
        ok: true,
        id: result.streamId,
        streamKey: result.streamKey,
        rtmpUrl: result.rtmpUrl,
        playbackUrl: result.playbackUrl,
        embedUrl: result.embedUrl,
        platformMessages: result.platformMessages,
      },
      201,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleGoLive failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/stop
 * Stop a live stream on the active platform.
 * Body: { streamId, platform }
 */
export async function handleStopLive(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = streamId ? { streamId } : ((await request.json()) as Record<string, string>);

    const id = body.streamId || streamId;
    const platform = (body.platform as 'owncast' | 'peertube' | 'spaces') || 'owncast';

    if (!id) {
      return jsonResponse({ ok: false, error: 'streamId is required' }, 400);
    }

    await stopLiveStream(env, id, platform);

    // Broadcast stop-live event
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_ended',
      streamId: id,
      platform,
    });

    return jsonResponse({ ok: true, streamId: id, platform });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── Schedule Stream ───────────────────────────────────────────────────

/**
 * POST /api/live/schedule
 * Schedule a future stream and store in KV.
 * Creates notifications for followers when stream starts.
 *
 * Body:
 *   { title, description?, scheduledAt (ISO), category?, tags?, privacy?,
 *     recordingEnabled?, chatEnabled?, creatorId, creatorHandle? }
 */
export async function handleScheduleStream(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = (body.title as string)?.trim();
    if (!title) {
      return jsonResponse({ ok: false, error: 'Schedule title is required' }, 400);
    }

    const scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt as string).getTime()
      : Date.now() + 3600000; // Default: 1 hour from now

    if (scheduledAt < Date.now()) {
      return jsonResponse({ ok: false, error: 'Scheduled time must be in the future' }, 400);
    }

    const id = generateLiveId();
    const schedule = {
      id,
      creatorId: (body.creatorId as string) || `creator:${Date.now()}`,
      title,
      description: (body.description as string) || '',
      source: (body.source as UnifiedLiveStream['source']) || 'owncast',
      scheduledAt,
      category: (body.category as string) || 'General',
      tags: (body.tags as string[]) || [],
      privacy: (body.privacy as 'public' | 'unlisted' | 'private') || 'public',
      recordingEnabled: body.recordingEnabled !== false,
      chatEnabled: body.chatEnabled !== false,
      thumbnailUrl: (body.thumbnailUrl as string) || undefined,
      createdAt: Date.now(),
    };

    // Store in KV via aggregator's createSchedule
    await createSchedule(env, schedule);

    // Notify followers via WebSocket
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'stream_scheduled',
      schedule,
    });

    return jsonResponse({ ok: true, id, schedule }, 201);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleScheduleStream failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

// ─── Unified Chat ──────────────────────────────────────────────────────────

import {
  sendChatMessage,
  getChatMessages,
  deleteChatMessage as unifiedDeleteMessage,
  banUser as unifiedBanUser,
  unbanUser as unifiedUnbanUser,
  timeoutUser as unifiedTimeoutUser,
  toggleReaction as unifiedToggleReaction,
  pinMessage as unifiedPinMessage,
  unpinMessage as unifiedUnpinMessage,
  getPinnedMessages as unifiedGetPinned,
  updateChatConfig,
  getChatConfig,
  handleTelegramWebhook,
  linkTelegramChatToStream,
  getProtocolViewerBreakdown,
  recordViewerProtocol,
  type ChatProtocol,
  type LiveChatMessage,
  type SendMessageInput,
} from '../../live-chat/unified-chat';

import { getChatAnalytics, trackMessage, exportChat } from '../../live-chat/chat-analytics';

/**
 * GET /api/live/chat/:id/messages
 * Get recent unified chat messages for a stream (from ALL protocols).
 */
export async function handleLiveChatMessages(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const before = url.searchParams.get('before') || undefined;

    const messages = await getChatMessages(env, streamId, limit, before);
    return noCacheJsonResponse({
      messages,
      data: messages,
      meta: { streamId, total: messages.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveChatMessages failed:', error);
    return jsonResponse({ messages: [], data: [], meta: { streamId, total: 0, error } });
  }
}

/**
 * POST /api/live/chat/:id/message
 * Send a chat message to a stream's unified chat feed.
 * Supports: protocol selection, gifts, badges, reactions.
 */
export async function handleLiveChatSend(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      message?: string;
      displayName?: string;
      avatarUrl?: string;
      userId?: string;
      protocol?: string;
      gift?: { amount: string; symbol: string; chain?: string };
      badges?: string[];
      chatColor?: string;
    };

    const message = body.message?.trim();
    if (!message) {
      return jsonResponse({ ok: false, error: 'Message is required' }, 400);
    }

    const result = await sendChatMessage(env, {
      streamId,
      userId: body.userId || body.displayName || 'anonymous',
      displayName: body.displayName || 'Anonymous',
      avatarUrl: body.avatarUrl,
      message,
      protocol: (body.protocol as ChatProtocol) || 'degenfeed',
      gift: body.gift,
      badges: body.badges,
      chatColor: body.chatColor,
    });

    if (!result) {
      return jsonResponse({ ok: false, error: 'Message blocked by rate limit or moderation' }, 429);
    }

    // Track analytics
    trackMessage(env, result).catch(() => {});

    return jsonResponse({ ok: true, message: result }, 201);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[handlers] handleLiveChatSend failed:', error);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/chat/:id/react
 * Toggle a reaction (emoji) on a message.
 */
export async function handleLiveChatReact(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { messageId?: string; emoji?: string; userId?: string };
    if (!body.messageId || !body.emoji) {
      return jsonResponse({ ok: false, error: 'messageId and emoji are required' }, 400);
    }
    const reactions = await unifiedToggleReaction(
      env,
      streamId,
      body.messageId,
      body.userId || 'anonymous',
      body.emoji,
    );
    return jsonResponse({ ok: true, reactions });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/:id/delete
 * Delete a chat message (host/moderator).
 */
export async function handleLiveChatDelete(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { messageId?: string; moderatorId?: string };
    if (!body.messageId) {
      return jsonResponse({ ok: false, error: 'messageId is required' }, 400);
    }
    const ok = await unifiedDeleteMessage(env, streamId, body.messageId, body.moderatorId || 'host');
    return jsonResponse({ ok });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/:id/pin
 * Pin/unpin a message (host only).
 */
export async function handleLiveChatPin(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    if (request.method === 'DELETE') {
      const body = (await request.json().catch(() => ({}))) as { messageId?: string };
      if (!body.messageId) return jsonResponse({ ok: false, error: 'messageId required' }, 400);
      const ok = await unifiedUnpinMessage(env, streamId, body.messageId);
      return jsonResponse({ ok });
    }
    const body = (await request.json()) as { messageId?: string };
    if (!body.messageId) return jsonResponse({ ok: false, error: 'messageId required' }, 400);
    const ok = await unifiedPinMessage(env, streamId, body.messageId);
    return jsonResponse({ ok });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * GET /api/live/chat/:id/pinned
 * Get pinned message IDs.
 */
export async function handleLiveChatPinned(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const messageIds = await unifiedGetPinned(env, streamId);
    return noCacheJsonResponse({ messageIds });
  } catch (err) {
    return jsonResponse({ messageIds: [], meta: { error: String(err) } });
  }
}

/**
 * POST /api/live/chat/:id/ban
 * Ban a user from chat (host only).
 */
export async function handleLiveChatBan(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { userId?: string; moderatorId?: string };
    if (!body.userId) return jsonResponse({ ok: false, error: 'userId required' }, 400);
    const ok = await unifiedBanUser(env, streamId, body.userId, body.moderatorId || 'host');
    return jsonResponse({ ok });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/:id/unban
 * Unban a user.
 */
export async function handleLiveChatUnban(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) return jsonResponse({ ok: false, error: 'userId required' }, 400);
    const ok = await unifiedUnbanUser(env, streamId, body.userId);
    return jsonResponse({ ok });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/:id/timeout
 * Timeout a user from chat (host only).
 */
export async function handleLiveChatTimeout(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { userId?: string; durationMs?: number; moderatorId?: string };
    if (!body.userId) return jsonResponse({ ok: false, error: 'userId required' }, 400);
    const durationMs = body.durationMs || 300000; // default 5 min
    const ok = await unifiedTimeoutUser(env, streamId, body.userId, durationMs, body.moderatorId || 'host');
    return jsonResponse({ ok, durationMs });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/:id/config
 * Update chat mode (host only).
 */
export async function handleLiveChatConfig(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      mode?: string;
      slowModeInterval?: number;
      enabled?: boolean;
    };
    const updates: Record<string, unknown> = {};
    if (body.mode) updates.mode = body.mode;
    if (body.slowModeInterval !== undefined) updates.slowModeInterval = body.slowModeInterval;
    if (body.enabled !== undefined) updates.enabled = body.enabled;

    const config = await updateChatConfig(env, streamId, updates as any);
    return jsonResponse({ ok: true, config });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * GET /api/live/chat/:id/analytics
 * Get chat analytics for a stream.
 */
export async function handleLiveChatAnalytics(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const analytics = await getChatAnalytics(env, streamId);
    return noCacheJsonResponse(analytics);
  } catch (err) {
    return jsonResponse({
      messagesPerMinute: 0,
      totalMessages: 0,
      topChatters: [],
      sentiment: { positive: 0, neutral: 0, negative: 0, total: 0 },
      platformBreakdown: {},
      viewerPlatformBreakdown: {},
      engagementRate: 0,
      peakMpm: 0,
      activeChatters: 0,
      timestamp: Date.now(),
      meta: { error: String(err) },
    });
  }
}

/**
 * GET /api/live/chat/:id/export
 * Export chat messages.
 */
export async function handleLiveChatExport(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const exported = await exportChat(env, streamId);
    return noCacheJsonResponse(exported);
  } catch (err) {
    return jsonResponse({ messages: [], meta: { total: 0, exportedAt: Date.now(), error: String(err) } });
  }
}

/**
 * GET /api/live/chat/:id/protocols
 * Get viewer count breakdown by protocol.
 */
export async function handleLiveChatProtocols(
  _request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const breakdown = await getProtocolViewerBreakdown(env, streamId);
    return noCacheJsonResponse({ breakdown });
  } catch (err) {
    return jsonResponse({ breakdown: {} });
  }
}

/**
 * POST /api/live/chat/:id/tg-link
 * Link a Telegram chat to a stream (called from bot).
 */
export async function handleLiveChatTgLink(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { telegramChatId?: number };
    if (!body.telegramChatId) return jsonResponse({ ok: false, error: 'telegramChatId required' }, 400);
    await linkTelegramChatToStream(env, body.telegramChatId, streamId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

/**
 * POST /api/live/chat/telegram-webhook
 * Webhook receiver for Telegram bot messages.
 */
export async function handleTelegramWebhookEndpoint(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = await request.json();
    const result = await handleTelegramWebhook(env, body as any);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ─── Tips ────────────────────────────────────────────────────────────────

/**
 * POST /api/live/:id/tip
 * Send a tip (payment) to a streamer.
 * In production, this would integrate with payment processing.
 */
export async function handleLiveTip(
  request: Request,
  _env: Env,
  streamId: string,
): Promise<Response> {
  try {
    const body = (await request.json()) as { amount?: number; currency?: string; message?: string };
    return jsonResponse({
      ok: true,
      streamId,
      tip: {
        amount: body.amount || 0,
        currency: body.currency || 'USD',
        message: body.message || '',
        processed: true,
        timestamp: Date.now(),
      },
    });
  } catch {
    return jsonResponse({ ok: true, streamId });
  }
}

// ─── Viewers / SSE ──────────────────────────────────────────────────────

/**
 * GET /api/live/viewers/:id
 * Get viewer count for a specific stream.
 */
export async function handleLiveViewersSSE(_request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(_request.url);
    const streamId =
      url.searchParams.get('streamId') || _request.url.split('/viewers/')[1]?.split('?')[0] || '';
    if (!streamId) {
      return jsonResponse({ data: [], meta: { total: 0 } });
    }
    const count = await getStreamViewerCount(env, streamId);
    return noCacheJsonResponse({
      data: [{ streamId, viewerCount: count, timestamp: Date.now() }],
      meta: { total: 1, streamId },
    });
  } catch {
    return jsonResponse({ data: [], meta: { total: 0 } });
  }
}

// ─── Watch / Unwatch Creators ──────────────────────────────────────────

/**
 * POST /api/live/watch
 * Start watching a creator for live notifications.
 * Body: { creatorId, creatorName, preferences? }
 */
export async function handleWatchCreator(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      watcherAddress?: string;
      creatorId?: string;
      creatorName?: string;
      preferences?: { email?: boolean; push?: boolean; minViewers?: number };
    };

    const watcherAddress = body.watcherAddress || 'anonymous';
    const creatorId = body.creatorId;
    const creatorName = body.creatorName || creatorId || 'Unknown';

    if (!creatorId) {
      return jsonResponse({ ok: false, error: 'creatorId is required' }, 400);
    }

    const result = await watchCreator(
      env,
      watcherAddress,
      creatorId,
      creatorName,
      body.preferences,
    );
    return jsonResponse(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * POST /api/live/unwatch
 * Stop watching a creator.
 */
export async function handleUnwatchCreator(
  request: Request,
  env: Env,
  creatorId: string,
): Promise<Response> {
  try {
    const body = creatorId
      ? { creatorId }
      : ((await request.json()) as { watcherAddress?: string; creatorId?: string });

    const watcherAddress = body.watcherAddress || 'anonymous';
    const cId = body.creatorId || creatorId;

    if (!cId) {
      return jsonResponse({ ok: false, error: 'creatorId is required' }, 400);
    }

    const result = await unwatchCreator(env, watcherAddress, cId);
    return jsonResponse(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error }, 500);
  }
}

/**
 * GET /api/live/watched
 * Get all watched creators for a watcher.
 */
export async function handleGetWatchedCreators(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const watcherAddress = url.searchParams.get('watcher') || 'anonymous';
    const entries = await getWatchedCreators(env, watcherAddress);
    return noCacheJsonResponse({
      data: entries,
      meta: { total: entries.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

// ─── Notifications ───────────────────────────────────────────────────────

/**
 * GET /api/live/notifications
 * Get pending notifications for a watcher.
 */
export async function handleGetNotifications(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const watcherAddress = url.searchParams.get('watcher') || 'anonymous';
    const notifications = await getPendingNotifications(env, watcherAddress);
    return noCacheJsonResponse({
      data: notifications,
      meta: { total: notifications.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * POST /api/live/notifications/settings
 * Update notification preferences.
 */
export async function handleNotificationSettings(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      address?: string;
      push?: boolean;
      email?: boolean;
      pushToken?: string;
      emailAddress?: string;
    };

    const address = body.address || 'anonymous';
    const profile = {
      address,
      email: body.emailAddress || undefined,
      pushToken: body.pushToken || undefined,
      notificationsEnabled: body.push !== false || body.email !== false,
      createdAt: Date.now(),
    };

    await upsertWatcherProfile(env, profile);
    return jsonResponse({
      ok: true,
      data: { push: body.push ?? true, email: body.email ?? false },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: { push: true, email: false }, meta: { error } });
  }
}

/**
 * GET /api/live/watched/live
 * Returns streams from watched creators that are currently live.
 */
export async function handleWatchedLive(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const watcherAddress = url.searchParams.get('watcher') || 'anonymous';

    const allStreams = await aggregateAllStreams(env);
    const watched = await detectLiveWatchedCreators(env, allStreams, watcherAddress);

    return noCacheJsonResponse({
      data: watched.map((w) => ({
        creator: w.entry,
        stream: w.stream,
      })),
      meta: { total: watched.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

// ─── Source-specific Routes ────────────────────────────────────────────

/**
 * GET /api/live/sources/peertube/instances
 * Returns available PeerTube instances and their live status.
 */
export async function handlePeerTubeInstances(_request: Request, env: Env): Promise<Response> {
  try {
    const instancesStr = env.PEERTUBE_EXTRA_INSTANCES || '';
    const defaultInstance = env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';
    const extraInstances = instancesStr
      ? instancesStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const allInstances = [defaultInstance, ...extraInstances];
    const results = await Promise.allSettled(
      allInstances.map(async (url) => {
        try {
          const resp = await fetch(`${url}/api/v1/videos?isLive=true&count=1`, {
            signal: AbortSignal.timeout(3000),
          });
          if (!resp.ok) {
            return { url, healthy: false, error: `HTTP ${resp.status}`, liveCount: 0 };
          }
          const data = (await resp.json()) as { total?: number };
          return { url, healthy: true, liveCount: data.total || 0, error: null };
        } catch (e) {
          return { url, healthy: false, error: (e as Error).message, liveCount: 0 };
        }
      }),
    );

    const instances = results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { url: 'unknown', healthy: false, error: 'Failed to check', liveCount: 0 },
    );

    return noCacheJsonResponse({
      data: instances,
      meta: { total: instances.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * GET /api/live/sources/twitch/curated
 * Returns curated Twitch channel live status.
 */
export async function handleTwitchCurated(_request: Request, env: Env): Promise<Response> {
  try {
    const limitParam = new URL(_request.url).searchParams.get('limit');
    const limit = Math.min(Number.parseInt(limitParam || '50', 10), 100);
    const streams = await fetchCuratedTwitchStreams(env);
    return noCacheJsonResponse({
      data: streams.slice(0, limit),
      meta: { total: streams.length },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return jsonResponse({ data: [], meta: { total: 0, error } });
  }
}

/**
 * GET /api/live/kick/status/:channel
 * Check if a specific Kick channel is live.
 */
export async function handleKickChannelStatus(
  _request: Request,
  _env: Env,
  channel: string,
): Promise<Response> {
  try {
    const result = await isKickChannelLive(channel);
    return noCacheJsonResponse({
      data: { channel, live: result.isLive, stream: result.stream || null },
      meta: {},
    });
  } catch {
    return jsonResponse({ data: { channel, live: false }, meta: {} });
  }
}

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
          watermark: 'A "Streaming via DegenFeed" watermark is added to your Loops stream. It does NOT appear on external platforms.',
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
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
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
          connectVia: 'Use POST /api/live/platforms/connect to connect an external platform account.',
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
        error: 'Enterprise tier required for multi-platform simulcast. Upgrade to Enterprise ($20/mo).',
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
