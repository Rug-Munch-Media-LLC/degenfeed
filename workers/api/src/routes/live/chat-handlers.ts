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
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';

// ─── Unified Chat ──────────────────────────────────────────────────────────

import { exportChat, getChatAnalytics, trackMessage } from '../../live-chat/chat-analytics';
import {
  type ChatProtocol,
  getChatConfig,
  getChatMessages,
  getProtocolViewerBreakdown,
  handleTelegramWebhook,
  type LiveChatMessage,
  linkTelegramChatToStream,
  recordViewerProtocol,
  type SendMessageInput,
  sendChatMessage,
  banUser as unifiedBanUser,
  deleteChatMessage as unifiedDeleteMessage,
  getPinnedMessages as unifiedGetPinned,
  pinMessage as unifiedPinMessage,
  timeoutUser as unifiedTimeoutUser,
  toggleReaction as unifiedToggleReaction,
  unbanUser as unifiedUnbanUser,
  unpinMessage as unifiedUnpinMessage,
  updateChatConfig,
} from '../../live-chat/unified-chat';

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
    const ok = await unifiedDeleteMessage(
      env,
      streamId,
      body.messageId,
      body.moderatorId || 'host',
    );
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
    const body = (await request.json()) as {
      userId?: string;
      durationMs?: number;
      moderatorId?: string;
    };
    if (!body.userId) return jsonResponse({ ok: false, error: 'userId required' }, 400);
    const durationMs = body.durationMs || 300000; // default 5 min
    const ok = await unifiedTimeoutUser(
      env,
      streamId,
      body.userId,
      durationMs,
      body.moderatorId || 'host',
    );
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
    return jsonResponse({
      messages: [],
      meta: { total: 0, exportedAt: Date.now(), error: String(err) },
    });
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
    if (!body.telegramChatId)
      return jsonResponse({ ok: false, error: 'telegramChatId required' }, 400);
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
export async function handleTelegramWebhookEndpoint(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json();
    const result = await handleTelegramWebhook(env, body as any);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}
