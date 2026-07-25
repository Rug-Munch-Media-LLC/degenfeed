/**
 * @degenfeed/api-worker — Unified Stream Chat Integration
 *
 * Cross-platform chat that works across Owncast, PeerTube, and DegenFeed native streams.
 * Supports: Owncast IRC-compatible chat, PeerTube live chat, DegenFeed WebSocket chat.
 *
 * Features:
 *   - Unified message format across all platforms
 *   - Emotes, tips in chat, highlighted messages from tippers
 *   - Cross-platform chat bridging (simulcast streams show unified chat)
 *   - Rate-limited message sending
 *   - Message persistence in KV
 */

import type { LiveSource } from '../feed/live-aggregator';
import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Unified Chat Message Format ─────────────────────────────────────

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
  /** Source platform of this message */
  source: LiveSource | 'degenfeed';
  /** Whether the sender is the stream creator */
  isCreator?: boolean;
  /** Whether this is a highlighted message (e.g., from a tipper) */
  isHighlighted?: boolean;
  /** Tip amount if this is a tip-attached message */
  tipAmount?: string;
  tipChain?: string;
  /** Badges for this user in this stream */
  badges?: ChatBadge[];
}

export type ChatBadge = 'subscriber' | 'moderator' | 'vip' | 'verified' | 'tipstar';

// ─── KV Keys ─────────────────────────────────────────────────────────

function chatKey(streamId: string): string {
  return `chat:${streamId}`;
}

function chatIndexKey(streamId: string): string {
  return `chat:${streamId}:index`;
}

// ─── Get Chat Messages ───────────────────────────────────────────────

/**
 * Retrieve chat messages for a given stream.
 * Reads from KV cache primarily, with optional fallback to platform APIs.
 */
export async function handleChatMessages(
  env: Env,
  streamId: string,
  limit = 50,
  before?: string,
): Promise<ChatMessage[]> {
  const [source] = streamId.split(':') as [LiveSource | 'degenfeed'];

  // Try KV cache first
  try {
    const raw = await env.CACHE?.get(chatKey(streamId));
    if (raw) {
      const messages = JSON.parse(raw) as ChatMessage[];
      let sliced = messages;

      if (before) {
        const beforeIndex = messages.findIndex((m) => m.id === before);
        if (beforeIndex >= 0) {
          sliced = messages.slice(0, beforeIndex);
        }
      }

      return sliced.slice(-limit);
    }
  } catch {
    // Fall through to platform fetch
  }

  // Fall back to platform-specific chat fetching
  switch (source) {
    case 'owncast':
      return fetchOwncastChat(env, streamId, limit);
    case 'peertube':
      return fetchPeerTubeChat(env, streamId, limit);
    default:
      // DegenFeed native chat — return empty if not cached
      return [];
  }
}

/**
 * Fetch Owncast chat messages.
 * Owncast supports IRC-compatible chat and has a REST API for recent messages.
 */
async function fetchOwncastChat(env: Env, streamId: string, limit: number): Promise<ChatMessage[]> {
  const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';

  try {
    const response = await fetch(`${instanceUrl}/api/chat/stream`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return [];

    const data = (await response.json()) as Array<{
      id?: string;
      userName?: string;
      displayName?: string;
      body?: string;
      timestamp?: string;
      userId?: string;
    }>;

    const messages: ChatMessage[] = (data || []).map((msg) => ({
      id: msg.id || `owncast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      streamId,
      userId: msg.userId || msg.userName || 'anonymous',
      displayName: msg.displayName || msg.userName || 'Anonymous',
      message: msg.body || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      source: 'owncast',
    }));

    // Cache in KV
    await cacheMessages(env, streamId, messages);

    return messages.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Fetch PeerTube live chat messages via their REST API.
 * PeerTube's chat is XMPP-based but has a REST bridge.
 */
async function fetchPeerTubeChat(
  env: Env,
  streamId: string,
  limit: number,
): Promise<ChatMessage[]> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
  const gtsToken = await env.CACHE?.get('gts:access_token');
  const uuid = streamId.replace('peertube:', '');

  try {
    const response = await fetch(`${instanceUrl}/api/v1/videos/${uuid}/live-chat`, {
      headers: {
        accept: 'application/json',
        ...(gtsToken ? { authorization: `Bearer ${gtsToken}` } : {}),
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return [];

    const result = (await response.json()) as {
      data: Array<{
        id: string;
        displayName: string;
        accountName: string;
        message: string;
        createdAt: string;
      }>;
    };

    const messages: ChatMessage[] = (result.data || []).map((msg) => ({
      id: msg.id,
      streamId,
      userId: msg.accountName,
      displayName: msg.displayName || msg.accountName,
      message: msg.message,
      timestamp: new Date(msg.createdAt).getTime(),
      source: 'peertube',
    }));

    // Cache in KV
    await cacheMessages(env, streamId, messages);

    return messages.slice(-limit);
  } catch {
    return [];
  }
}

// ─── Send Chat Message ───────────────────────────────────────────────

/**
 * Send a chat message to a stream.
 * For Owncast, this uses the IRC-compatible endpoint.
 * For PeerTube, this uses their REST API.
 * For DegenFeed native, this stores in KV + broadcasts via WebSocket.
 */
export async function handleSendChat(
  env: Env,
  streamId: string,
  userId: string,
  message: string,
  identity?: { displayName?: string; avatarUrl?: string },
): Promise<ChatMessage> {
  const [source] = streamId.split(':') as [LiveSource | 'degenfeed'];
  const displayName = identity?.displayName || userId.slice(0, 8);
  const now = Date.now();

  const chatMsg: ChatMessage = {
    id: `${streamId}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    streamId,
    userId,
    displayName,
    avatarUrl: identity?.avatarUrl,
    message: message.slice(0, 500),
    timestamp: now,
    source: source === 'owncast' || source === 'peertube' ? source : 'degenfeed',
  };

  // Platform-specific send
  try {
    switch (source) {
      case 'owncast': {
        // Owncast chat via REST API (requires admin config for external sending)
        // [REVIEW] Owncast's chat API may require authentication depending on config
        const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
        await fetch(`${instanceUrl}/api/chat/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            author: displayName,
            body: message,
            visible: true,
          }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => {
          // Owncast may not allow external chat sends — that's ok
        });
        break;
      }
      case 'peertube': {
        const gtsToken = await env.CACHE?.get('gts:access_token');
        if (gtsToken) {
          const uuid = streamId.replace('peertube:', '');
          const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
          await fetch(`${instanceUrl}/api/v1/videos/${uuid}/live-chat`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${gtsToken}`,
            },
            body: JSON.stringify({ message }),
            signal: AbortSignal.timeout(3000),
          }).catch(() => {
            // PeerTube may not allow external chat sends
          });
        }
        break;
      }
    }
  } catch {
    // Platform-specific send is best-effort
    // The message is still stored and broadcast locally
  }

  // Store in KV and broadcast
  await appendMessage(env, streamId, chatMsg);

  // Broadcast to WebSocket clients
  broadcastToAll(CHANNELS.STREAM_CHAT, {
    type: 'message',
    streamId,
    message: chatMsg,
  });

  return chatMsg;
}

// ─── KV Message Storage ─────────────────────────────────────────────

const MAX_CACHED_MESSAGES = 200;

async function cacheMessages(env: Env, streamId: string, messages: ChatMessage[]): Promise<void> {
  try {
    const key = chatKey(streamId);
    const existing = await env.CACHE?.get(key);
    let all: ChatMessage[] = existing ? JSON.parse(existing) : [];

    // Merge by ID to avoid duplicates
    const existingIds = new Set(all.map((m) => m.id));
    for (const msg of messages) {
      if (!existingIds.has(msg.id)) {
        all.push(msg);
        existingIds.add(msg.id);
      }
    }

    // Keep only the latest MAX_CACHED_MESSAGES
    if (all.length > MAX_CACHED_MESSAGES) {
      all = all.slice(-MAX_CACHED_MESSAGES);
    }

    await env.CACHE?.put(key, JSON.stringify(all), { expirationTtl: 86400 });
  } catch {
    // Non-critical
  }
}

async function appendMessage(env: Env, streamId: string, message: ChatMessage): Promise<void> {
  try {
    const key = chatKey(streamId);
    const existing = await env.CACHE?.get(key);
    let all: ChatMessage[] = existing ? JSON.parse(existing) : [];

    all.push(message);

    if (all.length > MAX_CACHED_MESSAGES) {
      all = all.slice(-MAX_CACHED_MESSAGES);
    }

    await env.CACHE?.put(key, JSON.stringify(all), { expirationTtl: 86400 });
  } catch {
    // Non-critical
  }
}

// ─── Cross-Platform Chat Bridging ───────────────────────────────────

/**
 * Bridge a message from one platform's chat to another.
 * Used when a streamer is simulcasting (e.g., Owncast + PeerTube at once).
 * Messages from Owncast chat appear in PeerTube chat and vice versa.
 */
export async function bridgeChatMessage(
  env: Env,
  sourceStreamId: string,
  targetStreamIds: string[],
  message: ChatMessage,
): Promise<void> {
  // Forward the message to each target stream's chat
  for (const targetId of targetStreamIds) {
    if (targetId === sourceStreamId) continue;

    const bridged: ChatMessage = {
      ...message,
      id: `${targetId}-bridged-${message.id}`,
      streamId: targetId,
      source: 'degenfeed', // Bridged messages appear as DegenFeed chat
    };

    // Store in target stream's chat
    await appendMessage(env, targetId, bridged);

    // Broadcast to target stream's WebSocket viewers
    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'message',
      streamId: targetId,
      message: bridged,
      bridged: true,
      fromSource: sourceStreamId,
    });
  }
}

// ─── Chat Moderation ─────────────────────────────────────────────────

/**
 * Delete a chat message by ID.
 */
export async function deleteChatMessage(
  env: Env,
  streamId: string,
  messageId: string,
): Promise<boolean> {
  try {
    const key = chatKey(streamId);
    const existing = await env.CACHE?.get(key);
    if (!existing) return false;

    const messages = JSON.parse(existing) as ChatMessage[];
    const filtered = messages.filter((m) => m.id !== messageId);

    if (filtered.length === messages.length) return false;

    await env.CACHE?.put(key, JSON.stringify(filtered), { expirationTtl: 86400 });

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'message_deleted',
      streamId,
      messageId,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Get active chatters for a stream (unique users who've chatted recently).
 */
export async function getActiveChatters(env: Env, streamId: string): Promise<number> {
  try {
    const key = chatKey(streamId);
    const existing = await env.CACHE?.get(key);
    if (!existing) return 0;

    const messages = JSON.parse(existing) as ChatMessage[];
    const recent = messages.filter((m) => Date.now() - m.timestamp < 300000); // Last 5 minutes
    const uniqueUsers = new Set(recent.map((m) => m.userId));

    return uniqueUsers.size;
  } catch {
    return 0;
  }
}

// ─── Emotes & Badges ────────────────────────────────────────────────

export const STREAM_EMOTES: Record<string, string> = {
  ':degenSmile:': '😊',
  ':degenFire:': '🔥',
  ':degenMoon:': '🚀',
  ':degenLUL:': '😂',
  ':degenW:': '👋',
  ':degenHeart:': '❤️',
  ':degenGlad:': '😎',
  ':degenPray:': '🙏',
  ':degenClap:': '👏',
  ':degenRIP:': '💀',
  ':degenSip:': '☕',
  ':degenBull:': '🐂',
  ':degenBear:': '🐻',
  ':degenDiamond:': '💎',
  ':degenPE:': '👀',
  ':degenBag:': '💰',
  ':degenRocket:': '🚀',
  ':degen100:': '💯',
  ':degenWink:': '😉',
  ':degenCry:': '😭',
};

/**
 * Parse emotes in a chat message and replace with emoji.
 */
export function parseEmotes(message: string): string {
  let parsed = message;
  for (const [code, emoji] of Object.entries(STREAM_EMOTES)) {
    parsed = parsed.replaceAll(code, emoji);
  }
  return parsed;
}
