/**
 * @degenfeed/api-worker — Stream Data Layer (KV-backed)
 *
 * All CRUD operations for the DegenFeed multi-type streaming system.
 * Supports: solo video, audio spaces, collab streams, coin-launch hype,
 * and profile streams. Stores metadata in CONTENT_STORE KV with TTL-based
 * expiration for live streams (24h) and extended retention for ended streams (7d).
 *
 * KV Key Schema:
 *   stream:{id}                   — LiveStream record JSON
 *   stream:live                   — JSON array of all live stream IDs
 *   stream:live:{type}            — JSON array of live stream IDs by type
 *   stream:creator:{wallet}       — JSON array of creator stream IDs
 *   stream:past:{wallet}          — JSON array of ended stream IDs for creator
 *   stream:chat:{streamId}        — JSON array of ChatMessage (capped 200)
 *   stream:reactions:{streamId}   — JSON array of StreamReaction (capped 100)
 *   stream:tip:{streamId}         — JSON array of StreamTip (capped 200)
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamType = 'solo' | 'spaces' | 'collab' | 'coin-launch' | 'profile';
export type StreamSurface =
  | 'profile'
  | 'coin-page'
  | 'community'
  | 'visual-feed'
  | 'discover'
  | 'spaces-hub';
export type StreamHost = 'peertube' | 'huddle01';

export interface LiveStream {
  id: string;
  type: StreamType;
  creator: string;
  coHosts: string[];
  title: string;
  description: string;
  host: StreamHost;
  streamKey?: string;
  streamUrl?: string;
  roomId?: string;
  surfaces: StreamSurface[];
  thumbnail?: string;
  isTokenGated: boolean;
  minTokenHold?: string;
  linkedCoin?: string;
  isLive: boolean;
  viewerCount: number;
  speakerCount: number;
  listenerCount: number;
  chatMessageCount: number;
  reactionCount: number;
  startedAt: number;
  crossPostedTo: string[];
  federatedVia: string;
  /** Set after stream ends — URL to the VOD recording */
  recordingUrl?: string;
  /** Duration in seconds (set after end) */
  recordingDuration?: number;
  /** When the stream ended (Unix ms) */
  endedAt?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
}

export interface StreamReaction {
  userId: string;
  type: 'like' | 'heart' | 'fire' | 'clap' | 'rocket' | 'moon';
  createdAt: number;
}

export interface StreamTip {
  id: string;
  userId: string;
  displayName: string;
  amount: string;
  tokenSymbol: string;
  tokenAddress?: string;
  txSignature?: string;
  createdAt: number;
}

export interface StreamRecording {
  url: string;
  duration: number;
  thumbnailUrl?: string;
  ready: boolean;
}

// ─── KV key helpers ─────────────────────────────────────────────────────

function streamKey(id: string): string {
  return `stream:${id}`;
}

function liveIndexKey(): string {
  return 'stream:live';
}

function liveTypeIndexKey(type: StreamType): string {
  return `stream:live:${type}`;
}

function creatorIndexKey(wallet: string): string {
  return `stream:creator:${wallet.toLowerCase()}`;
}

function pastIndexKey(wallet: string): string {
  return `stream:past:${wallet.toLowerCase()}`;
}

function chatKey(streamId: string): string {
  return `stream:chat:${streamId}`;
}

function reactionsKey(streamId: string): string {
  return `stream:reactions:${streamId}`;
}

function tipKey(streamId: string): string {
  return `stream:tip:${streamId}`;
}

// ─── KV helper: read/write JSON arrays ─────────────────────────────────

async function readArray(
  env: Env,
  key: string,
): Promise<string[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function writeArray(
  env: Env,
  key: string,
  arr: string[],
  ttl: number,
): Promise<void> {
  await env.CONTENT_STORE?.put(key, JSON.stringify(arr), { expirationTtl: ttl });
}

// ─── Stream CRUD ────────────────────────────────────────────────────────

/**
 * Create a new stream record and index it as live.
 */
export async function createStream(env: Env, stream: LiveStream): Promise<void> {
  const record: LiveStream = {
    ...stream,
    isLive: true,
    viewerCount: 0,
    speakerCount: stream.type === 'spaces' ? 1 : 0,
    listenerCount: 0,
    chatMessageCount: 0,
    reactionCount: 0,
    crossPostedTo: [],
    federatedVia: '',
  };

  // Store the stream record — 24h TTL for live, 7d after end
  await env.CONTENT_STORE?.put(streamKey(stream.id), JSON.stringify(record), {
    expirationTtl: 86400,
  });

  // Add to live index
  const allLive = await readArray(env, liveIndexKey());
  if (!allLive.includes(stream.id)) {
    allLive.unshift(stream.id);
    await writeArray(env, liveIndexKey(), allLive, 86400);
  }

  // Add to type-specific live index
  const typeLive = await readArray(env, liveTypeIndexKey(stream.type));
  if (!typeLive.includes(stream.id)) {
    typeLive.unshift(stream.id);
    await writeArray(env, liveTypeIndexKey(stream.type), typeLive, 86400);
  }

  // Add to creator index
  const creatorStreams = await readArray(env, creatorIndexKey(stream.creator));
  if (!creatorStreams.includes(stream.id)) {
    creatorStreams.unshift(stream.id);
    await writeArray(env, creatorIndexKey(stream.creator), creatorStreams, 86400 * 30);
  }
}

/**
 * Get a single stream by ID.
 */
export async function getStream(env: Env, id: string): Promise<LiveStream | null> {
  try {
    const raw = await env.CONTENT_STORE?.get(streamKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as LiveStream;
  } catch {
    return null;
  }
}

/**
 * List all live streams, optionally filtered by type with pagination.
 */
export async function getLiveStreams(
  env: Env,
  opts?: { type?: StreamType; limit?: number; cursor?: string },
): Promise<LiveStream[]> {
  const indexKey = opts?.type ? liveTypeIndexKey(opts.type) : liveIndexKey();
  const ids = await readArray(env, indexKey);

  if (ids.length === 0) return [];

  let targetIds = ids;

  // Pagination: find starting index from cursor
  if (opts?.cursor) {
    const cursorIdx = ids.indexOf(opts.cursor);
    if (cursorIdx >= 0) {
      targetIds = ids.slice(cursorIdx + 1);
    } else {
      // Cursor not found — reset to full list (safety fallback)
      targetIds = ids;
    }
  }

  const limit = opts?.limit ?? 50;
  targetIds = targetIds.slice(0, limit);

  // Fetch all in parallel
  const results = await Promise.all(
    targetIds.map((id) =>
      env.CONTENT_STORE?.get(streamKey(id)).then(
        (raw) => {
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as LiveStream;
            return parsed.isLive ? parsed : null;
          } catch {
            return null;
          }
        },
      ),
    ),
  );

  return results.filter((s): s is LiveStream => s !== null);
}

/**
 * Get all live streams for a specific creator wallet.
 */
export async function getCreatorLiveStreams(env: Env, wallet: string): Promise<LiveStream[]> {
  const ids = await readArray(env, creatorIndexKey(wallet));
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map((id) =>
      env.CONTENT_STORE?.get(streamKey(id)).then(
        (raw) => {
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as LiveStream;
            return parsed.isLive ? parsed : null;
          } catch {
            return null;
          }
        },
      ),
    ),
  );

  return results.filter((s): s is LiveStream => s !== null);
}

/**
 * Get currently-live coin-launch streams (hype/launch events).
 */
export async function getCoinLaunchStreams(env: Env): Promise<LiveStream[]> {
  return getLiveStreams(env, { type: 'coin-launch' });
}

/**
 * Update viewer count for a live stream.
 */
export async function updateStreamViewerCount(
  env: Env,
  id: string,
  count: number,
): Promise<void> {
  try {
    const raw = await env.CONTENT_STORE?.get(streamKey(id));
    if (!raw) return;
    const stream = JSON.parse(raw) as LiveStream;
    stream.viewerCount = Math.max(0, Math.floor(count));
    await env.CONTENT_STORE?.put(streamKey(id), JSON.stringify(stream), {
      expirationTtl: stream.isLive ? 86400 : 86400 * 7,
    });
  } catch {
    // Silently ignore KV errors for viewer count updates
  }
}

/**
 * End a stream — marks isLive=false, records end time, keeps for 7d.
 * Removes from live indexes.
 */
export async function endStream(env: Env, id: string): Promise<void> {
  const raw = await env.CONTENT_STORE?.get(streamKey(id));
  if (!raw) return;

  const stream = JSON.parse(raw) as LiveStream;
  stream.isLive = false;
  stream.endedAt = Date.now();

  // Retention: 7 days after end
  await env.CONTENT_STORE?.put(streamKey(id), JSON.stringify(stream), {
    expirationTtl: 86400 * 7,
  });

  // Remove from live index
  const allLive = await readArray(env, liveIndexKey());
  const filteredAll = allLive.filter((sid) => sid !== id);
  await writeArray(env, liveIndexKey(), filteredAll, 86400);

  // Remove from type-specific live index
  const typeLive = await readArray(env, liveTypeIndexKey(stream.type));
  const filteredType = typeLive.filter((sid) => sid !== id);
  await writeArray(env, liveTypeIndexKey(stream.type), filteredType, 86400);

  // Add to past index for creator
  const past = await readArray(env, pastIndexKey(stream.creator));
  if (!past.includes(id)) {
    past.unshift(id);
    await writeArray(env, pastIndexKey(stream.creator), past, 86400 * 30);
  }
}

/**
 * Add a chat message to a stream's chat log.
 * Capped at 200 messages — oldest are dropped.
 */
export async function addChatMessage(
  env: Env,
  streamId: string,
  msg: ChatMessage,
): Promise<void> {
  const key = chatKey(streamId);
  const messages = await getChatMessages(env, streamId);

  messages.push(msg);

  // Cap at 200 messages
  const trimmed = messages.length > 200 ? messages.slice(-200) : messages;

  await env.CONTENT_STORE?.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400,
  });

  // Update chat message count on the stream record
  try {
    const raw = await env.CONTENT_STORE?.get(streamKey(streamId));
    if (raw) {
      const stream = JSON.parse(raw) as LiveStream;
      stream.chatMessageCount = (stream.chatMessageCount ?? 0) + 1;
      await env.CONTENT_STORE?.put(streamKey(streamId), JSON.stringify(stream), {
        expirationTtl: stream.isLive ? 86400 : 86400 * 7,
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get chat messages for a stream, with optional cursor (message ID).
 */
export async function getChatMessages(
  env: Env,
  streamId: string,
  cursor?: string,
): Promise<ChatMessage[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(chatKey(streamId));
    if (!raw) return [];
    const messages = JSON.parse(raw) as ChatMessage[];

    if (cursor) {
      const cursorIdx = messages.findIndex((m) => m.id === cursor);
      if (cursorIdx >= 0) {
        return messages.slice(cursorIdx + 1);
      }
    }

    return messages;
  } catch {
    return [];
  }
}

/**
 * Add a reaction to a stream. Capped at 100 reactions.
 */
export async function addReaction(
  env: Env,
  streamId: string,
  reaction: StreamReaction,
): Promise<void> {
  const key = reactionsKey(streamId);
  const current = await getReactions(env, streamId);

  current.push(reaction);

  // Cap at 100 reactions
  const trimmed = current.length > 100 ? current.slice(-100) : current;

  await env.CONTENT_STORE?.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400,
  });

  // Update reaction count on the stream record
  try {
    const raw = await env.CONTENT_STORE?.get(streamKey(streamId));
    if (raw) {
      const stream = JSON.parse(raw) as LiveStream;
      stream.reactionCount = (stream.reactionCount ?? 0) + 1;
      await env.CONTENT_STORE?.put(streamKey(streamId), JSON.stringify(stream), {
        expirationTtl: stream.isLive ? 86400 : 86400 * 7,
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get all reactions for a stream.
 */
export async function getReactions(
  env: Env,
  streamId: string,
): Promise<StreamReaction[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(reactionsKey(streamId));
    if (!raw) return [];
    return JSON.parse(raw) as StreamReaction[];
  } catch {
    return [];
  }
}

/**
 * Record a tip during a stream. Capped at 200 tips.
 */
export async function addTip(
  env: Env,
  streamId: string,
  tip: StreamTip,
): Promise<void> {
  const key = tipKey(streamId);
  let tips: StreamTip[] = [];
  try {
    const raw = await env.CONTENT_STORE?.get(key);
    if (raw) {
      tips = JSON.parse(raw) as StreamTip[];
    }
  } catch {
    // Fresh array
  }

  tips.push(tip);

  // Cap at 200
  const trimmed = tips.length > 200 ? tips.slice(-200) : tips;

  await env.CONTENT_STORE?.put(key, JSON.stringify(trimmed), {
    expirationTtl: 86400,
  });
}

/**
 * Get all tips received during a stream.
 */
export async function getTips(
  env: Env,
  streamId: string,
): Promise<StreamTip[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(tipKey(streamId));
    if (!raw) return [];
    return JSON.parse(raw) as StreamTip[];
  } catch {
    return [];
  }
}

/**
 * Get past (ended) streams for a creator wallet.
 */
export async function getCreatorPastStreams(
  env: Env,
  wallet: string,
  limit = 20,
): Promise<LiveStream[]> {
  const pastIds = await readArray(env, pastIndexKey(wallet));

  // Also check creator index for any ended streams not yet in past index
  const creatorIds = await readArray(env, creatorIndexKey(wallet));
  const allCandidateIds = [...new Set([...pastIds, ...creatorIds])];

  if (allCandidateIds.length === 0) return [];

  const results = await Promise.all(
    allCandidateIds.slice(0, Math.max(limit * 2, 50)).map((id) =>
      env.CONTENT_STORE?.get(streamKey(id)).then(
        (raw) => {
          if (!raw) return null;
          try {
            const parsed = JSON.parse(raw) as LiveStream;
            return parsed; // Return all — caller filters
          } catch {
            return null;
          }
        },
      ),
    ),
  );

  const past = results.filter(
    (s): s is LiveStream => s != null && !s.isLive,
  );

  // Sort by startedAt descending (most recent first)
  past.sort((a, b) => b.startedAt - a.startedAt);

  return past.slice(0, limit);
}

/**
 * Upsert recording metadata on a stream record (after stream ends).
 */
export async function setStreamRecording(
  env: Env,
  id: string,
  recording: StreamRecording,
): Promise<void> {
  try {
    const raw = await env.CONTENT_STORE?.get(streamKey(id));
    if (!raw) return;
    const stream = JSON.parse(raw) as LiveStream;
    stream.recordingUrl = recording.url;
    stream.recordingDuration = recording.duration;
    await env.CONTENT_STORE?.put(streamKey(id), JSON.stringify(stream), {
      expirationTtl: 86400 * 7,
    });
  } catch {
    // Non-critical
  }
}

/**
 * Generate a unique stream ID.
 */
export function generateStreamId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[(arr[i] ?? 0) % chars.length];
  }
  return result;
}
