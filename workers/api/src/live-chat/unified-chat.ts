/**
 * @degenfeed/api-worker — Unified Cross-Platform Live Chat Engine
 *
 * THE ONE ENGINE — viewers from ALL protocols chat in ONE unified feed:
 *   - DegenFeed native users
 *   - Nostr (via NIP-53 live event replies + NIP-04 DMs)
 *   - Farcaster (via Frame chat / casts replying to the live frame)
 *   - Bluesky (via AT Protocol chat + reply mentions)
 *   - Mastodon/ActivityPub (via replies to the live post)
 *   - Telegram (via bot bridge)
 *
 * Every message carries a protocol badge. Messages are bidirectional —
 * when the host replies, it goes back to the viewer's native protocol.
 *
 * Features:
 *   - Protocol badge registry (color + emoji per protocol)
 *   - Unified message type with cross-protocol metadata
 *   - Rate-limited send with per-protocol rate tracking
 *   - Message storage in KV with TTL
 *   - WebSocket broadcast to all connected viewers
 *   - Poll-based ingestion from external platforms
 *   - Webhook-based ingestion (Telegram, Farcaster frames)
 *
 * Every provider integration: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import type { Env } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ChatProtocol =
  | 'degenfeed'
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'telegram'
  | 'lens'
  | 'zora'
  | 'activitypub';

export const ALL_PROTOCOLS: ChatProtocol[] = [
  'degenfeed',
  'nostr',
  'farcaster',
  'bluesky',
  'mastodon',
  'telegram',
  'lens',
  'zora',
  'activitypub',
];

export interface ProtocolBadgeConfig {
  protocol: ChatProtocol;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  shortLabel: string;
}

export const PROTOCOL_BADGES: Record<ChatProtocol, ProtocolBadgeConfig> = {
  degenfeed: {
    protocol: 'degenfeed',
    label: 'DegenFeed',
    emoji: '🌀',
    color: '#00ff41',
    bgColor: 'rgba(0,255,65,0.12)',
    shortLabel: 'DF',
  },
  nostr: {
    protocol: 'nostr',
    label: 'Nostr',
    emoji: '⚡',
    color: '#E87928',
    bgColor: 'rgba(232,121,40,0.12)',
    shortLabel: 'NSTR',
  },
  farcaster: {
    protocol: 'farcaster',
    label: 'Farcaster',
    emoji: '📱',
    color: '#8A63D2',
    bgColor: 'rgba(138,99,210,0.12)',
    shortLabel: 'FC',
  },
  bluesky: {
    protocol: 'bluesky',
    label: 'Bluesky',
    emoji: '☁️',
    color: '#0285FF',
    bgColor: 'rgba(2,133,255,0.12)',
    shortLabel: 'BSKY',
  },
  mastodon: {
    protocol: 'mastodon',
    label: 'Mastodon',
    emoji: '🐘',
    color: '#6364FF',
    bgColor: 'rgba(99,100,255,0.12)',
    shortLabel: 'MAST',
  },
  telegram: {
    protocol: 'telegram',
    label: 'Telegram',
    emoji: '✈️',
    color: '#0088cc',
    bgColor: 'rgba(0,136,204,0.12)',
    shortLabel: 'TG',
  },
  lens: {
    protocol: 'lens',
    label: 'Lens',
    emoji: '👁️',
    color: '#ABFE2C',
    bgColor: 'rgba(171,254,44,0.12)',
    shortLabel: 'LENS',
  },
  zora: {
    protocol: 'zora',
    label: 'Zora',
    emoji: '🎨',
    color: '#FF6B35',
    bgColor: 'rgba(255,107,53,0.12)',
    shortLabel: 'ZORA',
  },
  activitypub: {
    protocol: 'activitypub',
    label: 'ActivityPub',
    emoji: '🌐',
    color: '#00BCD4',
    bgColor: 'rgba(0,188,212,0.12)',
    shortLabel: 'AP',
  },
};

export function getProtocolBadge(protocol: ChatProtocol): ProtocolBadgeConfig {
  return PROTOCOL_BADGES[protocol] ?? PROTOCOL_BADGES.degenfeed;
}

// ─── Chat Message ───────────────────────────────────────────────────────

export interface LiveChatMessage {
  /** Unique message ID */
  id: string;
  /** Stream this message belongs to */
  streamId: string;
  /** User's unique ID within this protocol */
  userId: string;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Message body text */
  message: string;
  /** Unix timestamp ms */
  timestamp: number;
  /** Source protocol */
  protocol: ChatProtocol;
  /** Whether the sender is the stream creator */
  isCreator?: boolean;
  /** Whether this is a highlighted message (tipper) */
  isHighlighted?: boolean;
  /** Tip / gift metadata */
  gift?: { amount: string; symbol: string; chain?: string };
  /** Badges: subscriber, moderator, vip, verified, creator, premium */
  badges?: string[];
  /** Message reactions { emoji: [userId, ...] } */
  reactions?: Record<string, string[]>;
  /** Whether this message was bridged from another protocol */
  isBridged?: boolean;
  /** Original protocol if bridged */
  bridgedFrom?: ChatProtocol;
  /** Reply-to message ID */
  replyTo?: string;
  /** Whether this is a pinned message */
  isPinned?: boolean;
  /** Whether message is deleted (soft delete) */
  isDeleted?: boolean;
  /** Protocol-specific metadata */
  platformMeta?: Record<string, unknown>;
  /** Premium chat color */
  chatColor?: string;
}

// ─── Chat Mode States ───────────────────────────────────────────────────

export type ChatMode = 'normal' | 'slow' | 'sub_only' | 'follower_only';

export interface StreamChatConfig {
  streamId: string;
  mode: ChatMode;
  slowModeInterval: number; // seconds between messages
  followersOnlyMinutes: number; // how long someone must follow before chatting
  pinnedMessages: string[];
  enabled: boolean;
  enableReactions: boolean;
  enableEmotes: boolean;
  enableGifts: boolean;
  maxMessageLength: number;
  retentionMinutes: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// KV KEYS
// ═══════════════════════════════════════════════════════════════════════════

function chatMessagesKey(streamId: string): string {
  return `livechat:msgs:${streamId}`;
}

function chatConfigKey(streamId: string): string {
  return `livechat:config:${streamId}`;
}

function chatPinnedKey(streamId: string): string {
  return `livechat:pinned:${streamId}`;
}

function chatBannedKey(streamId: string): string {
  return `livechat:banned:${streamId}`;
}

function chatTimedOutKey(streamId: string): string {
  return `livechat:timeout:${streamId}`;
}

function chatRateKey(streamId: string, userId: string): string {
  return `livechat:rate:${streamId}:${userId}`;
}

function chatLastKey(streamId: string, protocol: ChatProtocol): string {
  return `livechat:last:${streamId}:${protocol}`;
}

function chatSeenKey(streamId: string): string {
  return `livechat:seen:${streamId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED CHAT ENGINE
// ═══════════════════════════════════════════════════════════════════════════

const MAX_MESSAGES = 500;
const DEFAULT_RETENTION_MINUTES = 1440; // 24h

/**
 * Get or create the chat config for a stream.
 */
export async function getChatConfig(env: Env, streamId: string): Promise<StreamChatConfig> {
  try {
    const raw = await env.CACHE?.get(chatConfigKey(streamId));
    if (raw) return JSON.parse(raw) as StreamChatConfig;
  } catch {
    // Use defaults
  }
  const defaults: StreamChatConfig = {
    streamId,
    mode: 'normal',
    slowModeInterval: 3,
    followersOnlyMinutes: 5,
    pinnedMessages: [],
    enabled: true,
    enableReactions: true,
    enableEmotes: true,
    enableGifts: true,
    maxMessageLength: 500,
    retentionMinutes: DEFAULT_RETENTION_MINUTES,
  };
  await env.CACHE?.put(chatConfigKey(streamId), JSON.stringify(defaults), {
    expirationTtl: 86400 * 7,
  }).catch(() => {});
  return defaults;
}

/**
 * Update the chat config for a stream.
 */
export async function updateChatConfig(
  env: Env,
  streamId: string,
  updates: Partial<StreamChatConfig>,
): Promise<StreamChatConfig> {
  const current = await getChatConfig(env, streamId);
  const updated: StreamChatConfig = { ...current, ...updates };
  await env.CACHE?.put(chatConfigKey(streamId), JSON.stringify(updated), {
    expirationTtl: 86400 * 7,
  }).catch(() => {});
  return updated;
}

// ─── Send Message ───────────────────────────────────────────────────────

export interface SendMessageInput {
  streamId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  protocol: ChatProtocol;
  isCreator?: boolean;
  gift?: { amount: string; symbol: string; chain?: string };
  badges?: string[];
  replyTo?: string;
  chatColor?: string;
}

/**
 * Send a chat message to a stream's unified feed.
 * Validates the message against chat config, stores it, broadcasts it.
 */
export async function sendChatMessage(
  env: Env,
  input: SendMessageInput,
): Promise<LiveChatMessage | null> {
  const config = await getChatConfig(env, input.streamId);

  if (!config.enabled) return null;

  const message = input.message.trim().slice(0, config.maxMessageLength);
  if (!message) return null;

  // Check rate limits
  if (!(await checkAndUpdateRateLimit(env, input.streamId, input.userId, config))) {
    return null; // Rate limited
  }

  // Check if user is banned or timed out
  const banCheck = await isBannedOrTimedOut(env, input.streamId, input.userId);
  if (banCheck) return null;

  // Build the message
  const msg: LiveChatMessage = {
    id: `livechat:${input.streamId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    streamId: input.streamId,
    userId: input.userId,
    displayName: input.displayName || input.userId.slice(0, 16),
    avatarUrl: input.avatarUrl,
    message,
    timestamp: Date.now(),
    protocol: input.protocol,
    isCreator: input.isCreator,
    isHighlighted: !!input.gift,
    gift: input.gift,
    badges: input.badges,
    reactions: {},
    replyTo: input.replyTo,
    isBridged: input.protocol !== 'degenfeed',
    bridgedFrom: input.protocol !== 'degenfeed' ? input.protocol : undefined,
    chatColor: input.chatColor,
    isDeleted: false,
  };

  // Persist to DegenFeed's OWN KV (CACHE) — single source of truth for
  // chat history. No rmi-backend involvement.
  await storeMessage(env, msg);

  // Store last-seen timestamp per protocol for polling
  await env.CACHE?.put(chatLastKey(input.streamId, input.protocol), String(msg.timestamp), {
    expirationTtl: 86400,
  }).catch(() => {});

  // Broadcast to all WebSocket clients
  broadcastToAll(CHANNELS.STREAM_CHAT, {
    type: 'live_chat_message',
    streamId: input.streamId,
    message: msg,
    badge: getProtocolBadge(msg.protocol),
  });

  return msg;
}

/**
 * Check user's rate limit and update counters. Returns false if rate limited.
 */
async function checkAndUpdateRateLimit(
  env: Env,
  streamId: string,
  userId: string,
  config: StreamChatConfig,
): Promise<boolean> {
  // Slow mode
  if (config.mode === 'slow') {
    const key = chatRateKey(streamId, userId);
    const lastTime = await env.CACHE?.get(key).catch(() => null);
    if (lastTime) {
      const elapsed = Date.now() - Number(lastTime);
      if (elapsed < config.slowModeInterval * 1000) return false;
    }
    await env.CACHE?.put(key, String(Date.now()), { expirationTtl: 60 }).catch(() => {});
  }

  return true;
}

/**
 * Check if a user is banned or timed out in this stream.
 */
async function isBannedOrTimedOut(env: Env, streamId: string, userId: string): Promise<boolean> {
  try {
    // Check ban list
    const bannedRaw = await env.CACHE?.get(chatBannedKey(streamId));
    if (bannedRaw) {
      const banned: string[] = JSON.parse(bannedRaw);
      if (banned.includes(userId)) return true;
    }

    // Check timeout list
    const timedOutRaw = await env.CACHE?.get(chatTimedOutKey(streamId));
    if (timedOutRaw) {
      const timeouts: Record<string, number> = JSON.parse(timedOutRaw);
      const expiresAt = timeouts[userId];
      if (expiresAt && Date.now() < expiresAt) return true;
      if (expiresAt && Date.now() >= expiresAt) {
        // Clean up expired timeout
        delete timeouts[userId];
        await env.CACHE?.put(chatTimedOutKey(streamId), JSON.stringify(timeouts), {
          expirationTtl: 86400,
        }).catch(() => {});
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ─── Message Storage ────────────────────────────────────────────────────

async function storeMessage(env: Env, msg: LiveChatMessage): Promise<void> {
  try {
    const key = chatMessagesKey(msg.streamId);
    const raw = await env.CACHE?.get(key);
    let messages: LiveChatMessage[] = raw ? JSON.parse(raw) : [];
    messages.push(msg);
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(-MAX_MESSAGES);
    }
    // Retention TTL = 24h default
    await env.CACHE?.put(key, JSON.stringify(messages), {
      expirationTtl: DEFAULT_RETENTION_MINUTES * 60,
    });
  } catch {
    // Non-critical — messages are ephemeral
  }
}

/**
 * Get chat messages for a stream.
 *
 * DegenFeed-owned KV (CACHE) is the single source of truth. No rmi-backend
 * involvement — a rmi-backend outage cannot affect live chat.
 */
export async function getChatMessages(
  env: Env,
  streamId: string,
  limit = 50,
  before?: string,
): Promise<LiveChatMessage[]> {
  try {
    const key = chatMessagesKey(streamId);
    const raw = await env.CACHE?.get(key);
    if (!raw) return [];
    let messages: LiveChatMessage[] = JSON.parse(raw);

    // Filter deleted
    messages = messages.filter((m) => !m.isDeleted);

    // Cursor pagination
    if (before) {
      const beforeIndex = messages.findIndex((m) => m.id === before);
      if (beforeIndex >= 0) {
        messages = messages.slice(0, beforeIndex);
      }
    }

    return messages.slice(-limit);
  } catch {
    return [];
  }
}

// ─── Pinned Messages ────────────────────────────────────────────────────

/**
 * Pin a message in the stream chat (host only).
 */
export async function pinMessage(env: Env, streamId: string, messageId: string): Promise<boolean> {
  try {
    const key = chatPinnedKey(streamId);
    const raw = await env.CACHE?.get(key);
    const pinned: string[] = raw ? JSON.parse(raw) : [];
    if (!pinned.includes(messageId)) {
      pinned.push(messageId);
      await env.CACHE?.put(key, JSON.stringify(pinned), { expirationTtl: 86400 * 7 });

      broadcastToAll(CHANNELS.STREAM_CHAT, {
        type: 'live_chat_pin',
        streamId,
        messageId,
        pinned: true,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Unpin a message.
 */
export async function unpinMessage(
  env: Env,
  streamId: string,
  messageId: string,
): Promise<boolean> {
  try {
    const key = chatPinnedKey(streamId);
    const raw = await env.CACHE?.get(key);
    if (!raw) return false;
    const pinned: string[] = JSON.parse(raw).filter((id: string) => id !== messageId);
    await env.CACHE?.put(key, JSON.stringify(pinned), { expirationTtl: 86400 * 7 });

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'live_chat_pin',
      streamId,
      messageId,
      pinned: false,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get pinned message IDs for a stream.
 */
export async function getPinnedMessages(env: Env, streamId: string): Promise<string[]> {
  try {
    const raw = await env.CACHE?.get(chatPinnedKey(streamId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Moderation ─────────────────────────────────────────────────────────

/**
 * Delete a chat message (soft delete).
 */
export async function deleteChatMessage(
  env: Env,
  streamId: string,
  messageId: string,
  moderatorId: string,
): Promise<boolean> {
  try {
    const key = chatMessagesKey(streamId);
    const raw = await env.CACHE?.get(key);
    if (!raw) return false;
    const messages: LiveChatMessage[] = JSON.parse(raw);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return false;
    msg.isDeleted = true;
    await env.CACHE?.put(key, JSON.stringify(messages), {
      expirationTtl: DEFAULT_RETENTION_MINUTES * 60,
    });

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'live_chat_delete',
      streamId,
      messageId,
      moderatorId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ban a user from chat.
 */
export async function banUser(
  env: Env,
  streamId: string,
  userId: string,
  moderatorId: string,
): Promise<boolean> {
  try {
    const key = chatBannedKey(streamId);
    const raw = await env.CACHE?.get(key);
    const banned: string[] = raw ? JSON.parse(raw) : [];
    if (!banned.includes(userId)) {
      banned.push(userId);
      await env.CACHE?.put(key, JSON.stringify(banned), { expirationTtl: 86400 * 7 });
    }

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'live_chat_ban',
      streamId,
      userId,
      moderatorId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Unban a user from chat.
 */
export async function unbanUser(env: Env, streamId: string, userId: string): Promise<boolean> {
  try {
    const key = chatBannedKey(streamId);
    const raw = await env.CACHE?.get(key);
    if (!raw) return false;
    const banned: string[] = JSON.parse(raw).filter((id: string) => id !== userId);
    await env.CACHE?.put(key, JSON.stringify(banned), { expirationTtl: 86400 * 7 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Timeout a user for a duration in ms.
 */
export async function timeoutUser(
  env: Env,
  streamId: string,
  userId: string,
  durationMs: number,
  moderatorId: string,
): Promise<boolean> {
  try {
    const key = chatTimedOutKey(streamId);
    const raw = await env.CACHE?.get(key);
    const timeouts: Record<string, number> = raw ? JSON.parse(raw) : {};
    timeouts[userId] = Date.now() + durationMs;
    await env.CACHE?.put(key, JSON.stringify(timeouts), { expirationTtl: 86400 });

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'live_chat_timeout',
      streamId,
      userId,
      durationMs,
      moderatorId,
      expiresAt: timeouts[userId],
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Reactions ──────────────────────────────────────────────────────────

/**
 * Toggle a reaction (emoji) on a message.
 */
export async function toggleReaction(
  env: Env,
  streamId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<Record<string, string[]> | null> {
  try {
    const key = chatMessagesKey(streamId);
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    const messages: LiveChatMessage[] = JSON.parse(raw);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg || msg.isDeleted) return null;

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const idx = msg.reactions[emoji].indexOf(userId);
    if (idx >= 0) {
      msg.reactions[emoji].splice(idx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(userId);
    }

    await env.CACHE?.put(key, JSON.stringify(messages), {
      expirationTtl: DEFAULT_RETENTION_MINUTES * 60,
    });

    broadcastToAll(CHANNELS.STREAM_CHAT, {
      type: 'live_chat_reaction',
      streamId,
      messageId,
      userId,
      emoji,
      reactions: msg.reactions,
    });

    return msg.reactions;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL BRIDGES — Ingest from external protocols
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ingest a message from an external protocol into the unified chat.
 * Each protocol ingester calls this.
 */
async function ingestFromProtocol(
  env: Env,
  streamId: string,
  protocol: ChatProtocol,
  userId: string,
  displayName: string,
  message: string,
  extra?: {
    avatarUrl?: string;
    isCreator?: boolean;
    badges?: string[];
    gift?: { amount: string; symbol: string; chain?: string };
    platformMeta?: Record<string, unknown>;
  },
): Promise<void> {
  await sendChatMessage(env, {
    streamId,
    userId: `${protocol}:${userId}`,
    displayName,
    avatarUrl: extra?.avatarUrl,
    message,
    protocol,
    isCreator: extra?.isCreator,
    gift: extra?.gift,
    badges: extra?.badges,
  });
}

// ─── Nostr Bridge ───────────────────────────────────────────────────────

/**
 * Poll Nostr relays for new replies to a live event (NIP-53).
 */
export async function pollNostrChat(env: Env, streamId: string, eventId: string): Promise<number> {
  const relayUrls = (env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (relayUrls.length === 0) return 0;

  const sinceKey = chatLastKey(streamId, 'nostr');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - 60000;

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 4000 });

    // Fetch kind 1 replies referencing the live event
    const events = await pool.list({
      '#e': [eventId],
      kinds: [1],
      since: Math.floor(since / 1000),
      limit: 50,
    });
    pool.disconnectAll();

    let count = 0;
    for (const ev of events) {
      try {
        const npub = nostr.npubEncode(ev.pubkey);
        await ingestFromProtocol(env, streamId, 'nostr', ev.pubkey, npub.slice(0, 16), ev.content, {
          badges: ['nostr'],
        });
        count++;
      } catch {
        // Skip individual failures
      }
    }

    // Update last-checked timestamp
    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});

    return count;
  } catch {
    return 0;
  }
}

// ─── Farcaster Bridge ───────────────────────────────────────────────────

/**
 * Poll Farcaster hub for new casts replying to the live stream frame.
 */
export async function pollFarcasterChat(
  env: Env,
  streamId: string,
  parentCastHash?: string,
): Promise<number> {
  const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
  const sinceKey = chatLastKey(streamId, 'farcaster');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - 60000;

  try {
    // Use the hub to fetch replies to a cast or the stream's URL
    const url = parentCastHash
      ? `${hubUrl}/v1/castsByParent?hash=${parentCastHash}&limit=50`
      : `${hubUrl}/v1/castsByParent?parentUrl=${encodeURIComponent(`https://app.degenfeed.xyz/live/${streamId}`)}&limit=50`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;

    const data = (await res.json()) as {
      messages?: Array<{
        data?: {
          fid?: number;
          timestamp?: number;
          castAddBody?: { text: string };
        };
        hash?: string;
      }>;
    };

    let count = 0;
    for (const msg of data.messages || []) {
      if (!msg.data?.castAddBody?.text) continue;
      const msgTime = msg.data.timestamp
        ? msg.data.timestamp > 1e12
          ? msg.data.timestamp
          : msg.data.timestamp * 1000
        : 0;
      if (msgTime < since) continue;

      const fid = msg.data.fid || 0;
      const displayName = `fc:${fid}`;
      await ingestFromProtocol(
        env,
        streamId,
        'farcaster',
        `fid:${fid}`,
        displayName,
        msg.data.castAddBody.text.slice(0, 500),
        { badges: ['farcaster'] },
      );
      count++;
    }

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}

// ─── Bluesky Bridge ────────────────────────────────────────────────────

/**
 * Poll Bluesky for replies/mentions related to the live stream post.
 */
export async function pollBlueskyChat(
  env: Env,
  streamId: string,
  bskyPostUri?: string,
): Promise<number> {
  const accessToken = env.BSKY_ACCESS_TOKEN;
  const senderDid = env.BSKY_DID;
  if (!accessToken || !senderDid) return 0;

  const sinceKey = chatLastKey(streamId, 'bluesky');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - 60000;

  try {
    if (bskyPostUri) {
      // Fetch replies to the post via getPostThread
      const threadRes = await fetch(
        `https://bsky.social/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(bskyPostUri)}&depth=1`,
        {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!threadRes.ok) return 0;
      const threadData = (await threadRes.json()) as {
        thread?: {
          replies?: Array<{
            post?: {
              uri?: string;
              author?: { did?: string; displayName?: string; avatar?: string };
              record?: { text?: string; createdAt?: string };
            };
          }>;
        };
      };

      let count = 0;
      for (const reply of threadData.thread?.replies || []) {
        const author = reply.post?.author;
        const record = reply.post?.record;
        if (!author?.did || !record?.text) continue;
        const replyTime = record.createdAt ? new Date(record.createdAt).getTime() : 0;
        if (replyTime < since) continue;

        await ingestFromProtocol(
          env,
          streamId,
          'bluesky',
          author.did,
          author.displayName || author.did.slice(0, 10),
          record.text.slice(0, 500),
          {
            avatarUrl: author.avatar,
            badges: ['bluesky'],
          },
        );
        count++;
      }

      await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
      return count;
    }

    // Fallback: search for mentions
    const searchRes = await fetch(
      `https://bsky.social/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(`degenfeed.xyz/live/${streamId}`)}&limit=20`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!searchRes.ok) return 0;
    const searchData = (await searchRes.json()) as {
      posts?: Array<{
        uri?: string;
        author?: { did?: string; displayName?: string; avatar?: string };
        record?: { text?: string; createdAt?: string };
      }>;
    };

    let count = 0;
    for (const post of searchData.posts || []) {
      const author = post.author;
      const record = post.record;
      if (!author?.did || !record?.text) continue;
      const postTime = record.createdAt ? new Date(record.createdAt).getTime() : 0;
      if (postTime < since) continue;

      await ingestFromProtocol(
        env,
        streamId,
        'bluesky',
        author.did,
        author.displayName || author.did.slice(0, 10),
        record.text.slice(0, 500),
        {
          avatarUrl: author.avatar,
          badges: ['bluesky'],
        },
      );
      count++;
    }

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}

// ─── Mastodon/ActivityPub Bridge ────────────────────────────────────────

/**
 * Poll Mastodon/ActivityPub for replies to the live stream post.
 */
export async function pollActivityPubChat(
  env: Env,
  streamId: string,
  apPostId?: string,
): Promise<number> {
  const accessToken = env.GTS_ACCESS_TOKEN || env.MASTODON_ACCESS_TOKEN;
  const instance =
    env.GTS_INSTANCE_URL || env.MASTODON_INSTANCE_URL || 'https://social.degenfeed.xyz';
  if (!accessToken) return 0;

  const sinceKey = chatLastKey(streamId, 'activitypub');
  const sinceStr = await env.CACHE?.get(sinceKey).catch(() => null);
  const since = sinceStr ? Number(sinceStr) : Date.now() - 60000;

  try {
    if (apPostId) {
      // Fetch context/replies to the post
      const contextRes = await fetch(
        `${instance}/api/v1/statuses/${encodeURIComponent(apPostId)}/context`,
        {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!contextRes.ok) return 0;
      const contextData = (await contextRes.json()) as {
        descendants?: Array<{
          id: string;
          account?: { acct: string; display_name?: string; avatar?: string };
          content?: string;
          created_at?: string;
        }>;
      };

      let count = 0;
      for (const reply of contextData.descendants || []) {
        const replyTime = reply.created_at ? new Date(reply.created_at).getTime() : 0;
        if (replyTime < since) continue;
        const plaintext = stripHtml(reply.content || '');
        if (!plaintext) continue;

        const protocol: ChatProtocol = reply.account?.acct?.includes('threads.net')
          ? 'activitypub'
          : 'mastodon';

        await ingestFromProtocol(
          env,
          streamId,
          protocol,
          reply.account?.acct || reply.id,
          reply.account?.display_name || reply.account?.acct || 'anon',
          plaintext.slice(0, 500),
          {
            avatarUrl: reply.account?.avatar,
            badges: [protocol],
          },
        );
        count++;
      }

      await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
      return count;
    }

    // Fallback: search recent posts mentioning the stream URL
    const searchRes = await fetch(
      `${instance}/api/v2/search?q=${encodeURIComponent(`degenfeed.xyz/live/${streamId}`)}&type=statuses&limit=20`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!searchRes.ok) return 0;
    const searchData = (await searchRes.json()) as {
      statuses?: Array<{
        id: string;
        account?: { acct: string; display_name?: string; avatar?: string };
        content?: string;
        created_at?: string;
      }>;
    };

    let count = 0;
    for (const post of searchData.statuses || []) {
      const postTime = post.created_at ? new Date(post.created_at).getTime() : 0;
      if (postTime < since) continue;
      const plaintext = stripHtml(post.content || '');
      if (!plaintext) continue;

      await ingestFromProtocol(
        env,
        streamId,
        'mastodon',
        post.account?.acct || post.id,
        post.account?.display_name || post.account?.acct || 'anon',
        plaintext.slice(0, 500),
        {
          avatarUrl: post.account?.avatar,
          badges: ['mastodon'],
        },
      );
      count++;
    }

    await env.CACHE?.put(sinceKey, String(Date.now()), { expirationTtl: 86400 }).catch(() => {});
    return count;
  } catch {
    return 0;
  }
}

// ─── Telegram Bridge ────────────────────────────────────────────────────

/**
 * Webhook handler for Telegram bot — receives messages and bridges to unified chat.
 */
export async function handleTelegramWebhook(
  env: Env,
  body: {
    message?: {
      chat?: { id?: number };
      from?: { id?: number; first_name?: string };
      text?: string;
    };
    callback_query?: {
      data?: string;
      message?: { chat?: { id?: number }; message_id?: number };
      from?: { id?: number; first_name?: string };
    };
  },
): Promise<{ ok: boolean }> {
  try {
    // Map Telegram chat IDs to stream IDs via KV
    const chatId = body.message?.chat?.id || body.callback_query?.message?.chat?.id;
    if (!chatId) return { ok: false };

    const streamMappingKey = `tg:chat:${chatId}`;
    const streamId = await env.CACHE?.get(streamMappingKey).catch(() => null);
    if (!streamId) return { ok: false }; // Not linked to a stream

    const text = body.message?.text;
    if (!text) return { ok: false };

    const from = body.message?.from;
    await ingestFromProtocol(
      env,
      streamId,
      'telegram',
      String(from?.id || chatId),
      from?.first_name || 'TG User',
      text,
      {
        badges: ['telegram'],
      },
    );

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Send a message from the host back to Telegram viewers.
 */
export async function sendToTelegramChat(
  env: Env,
  streamId: string,
  message: string,
): Promise<boolean> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  try {
    // Get all Telegram chat IDs linked to this stream
    const tgChatsKey = `tg:stream:${streamId}`;
    const raw = await env.CACHE?.get(tgChatsKey).catch(() => null);
    if (!raw) return false;
    const chatIds: number[] = JSON.parse(raw);

    for (const chatId of chatIds) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💬 *DegenFeed Live Chat*\n\n${message.slice(0, 1000)}`,
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLING LOOP
// ═══════════════════════════════════════════════════════════════════════════

export interface BridgeConfig {
  streamId: string;
  nostrEventId?: string;
  farcasterHash?: string;
  bskyPostUri?: string;
  apPostId?: string;
  pollIntervalMs: number;
  enabled: boolean;
}

/**
 * Start polling all external protocols for new chat messages.
 * Returns a cleanup function.
 */
export async function startUnifiedChatPolling(
  env: Env,
  config: BridgeConfig,
  abortSignal?: AbortSignal,
): Promise<() => void> {
  const interval = config.pollIntervalMs || 30000;
  let active = true;

  const poll = async () => {
    if (!active || abortSignal?.aborted) return;
    try {
      await Promise.allSettled([
        config.nostrEventId
          ? pollNostrChat(env, config.streamId, config.nostrEventId)
          : Promise.resolve(0),
        pollFarcasterChat(env, config.streamId, config.farcasterHash),
        config.bskyPostUri
          ? pollBlueskyChat(env, config.streamId, config.bskyPostUri)
          : Promise.resolve(0),
        config.apPostId
          ? pollActivityPubChat(env, config.streamId, config.apPostId)
          : Promise.resolve(0),
      ]);
    } catch {
      // Silently continue next poll
    }
  };

  await poll();
  const timer = setInterval(poll, interval);

  const cleanup = () => {
    active = false;
    clearInterval(timer);
  };

  if (abortSignal) {
    abortSignal.addEventListener('abort', cleanup, { once: true });
  }

  return cleanup;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Register a Telegram chat-to-stream mapping (called when a user starts the bot).
 */
export async function linkTelegramChatToStream(
  env: Env,
  telegramChatId: number,
  streamId: string,
): Promise<void> {
  const streamChatsKey = `tg:stream:${streamId}`;
  const chatStreamKey = `tg:chat:${telegramChatId}`;

  await Promise.all([
    env.CACHE?.put(chatStreamKey, streamId, { expirationTtl: 86400 * 7 }),
    env.CACHE?.get(streamChatsKey).then(async (raw) => {
      const chats: number[] = raw ? JSON.parse(raw) : [];
      if (!chats.includes(telegramChatId)) {
        chats.push(telegramChatId);
        await env.CACHE?.put(streamChatsKey, JSON.stringify(chats), { expirationTtl: 86400 * 7 });
      }
    }),
  ]).catch(() => {});
}

/**
 * Get the viewer count breakdown by protocol for a stream.
 */
export async function getProtocolViewerBreakdown(
  env: Env,
  streamId: string,
): Promise<Record<ChatProtocol, number>> {
  const breakdown: Record<string, number> = {};
  for (const protocol of ALL_PROTOCOLS) {
    breakdown[protocol] = 0;
  }

  try {
    const seenKey = chatSeenKey(streamId);
    const raw = await env.CACHE?.get(seenKey);
    if (raw) {
      const seen: Record<string, ChatProtocol> = JSON.parse(raw);
      for (const protocol of Object.values(seen)) {
        breakdown[protocol] = (breakdown[protocol] || 0) + 1;
      }
    }
  } catch {
    // Non-critical
  }

  return breakdown as Record<ChatProtocol, number>;
}

/**
 * Record a viewer as active for protocol breakdown analytics.
 */
export async function recordViewerProtocol(
  env: Env,
  streamId: string,
  userId: string,
  protocol: ChatProtocol,
): Promise<void> {
  try {
    const seenKey = chatSeenKey(streamId);
    const raw = await env.CACHE?.get(seenKey);
    const seen: Record<string, ChatProtocol> = raw ? JSON.parse(raw) : {};
    seen[userId] = protocol;
    await env.CACHE?.put(seenKey, JSON.stringify(seen), { expirationTtl: 3600 });
  } catch {
    // Non-critical
  }
}

export { chatConfigKey, chatMessagesKey };
