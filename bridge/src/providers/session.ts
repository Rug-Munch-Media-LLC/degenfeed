/**
 * Session Open Groups (SOGS) Provider
 *
 * Fetches messages from Session's Open Group Servers.
 * Session is a decentralized, privacy-focused messenger built on the
 * Oxen Service Node network. Open Groups are public chat rooms that
 * anyone can join and read without registration.
 *
 * API: SOGS REST API (OpenAPI v3 documented)
 *   GET /room/{roomToken}/messages/recent — recent messages
 *   GET /room/{roomToken} — room info
 *   GET /rooms — list public rooms
 *   GET /room/{roomToken}/pollInfo — room details with message count
 *
 * Strategy:
 * 1. Curated public open group rooms (crypto/tech focused)
 * 2. Recent messages from each room
 * 3. Room metadata for community context
 *
 * Reference: https://github.com/oxen-io/session-pysogs
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Known public SOGS instances ──────────────────────────────────────
// Session open group servers are self-hosted; these are well-known public ones.
const _SOGS_INSTANCES = ['https://sogs.session.foundation', 'https://discuss.oxen.io'];

// ─── Crypto/tech focused open rooms on public SOGS ────────────────────
interface RoomConfig {
  room: string;
  instance: string;
  displayName: string;
}

const CURATED_ROOMS: RoomConfig[] = [
  { room: 'session', instance: 'https://sogs.session.foundation', displayName: 'Session General' },
  { room: 'oxen', instance: 'https://sogs.session.foundation', displayName: 'Oxen Chat' },
  { room: 'crypto', instance: 'https://sogs.session.foundation', displayName: 'Crypto Discussion' },
  { room: 'general', instance: 'https://discuss.oxen.io', displayName: 'Oxen General' },
  { room: 'dev', instance: 'https://discuss.oxen.io', displayName: 'Oxen Dev' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface SOGSMessage {
  id: number;
  sender: string;
  display_name?: string;
  profile_picture?: string;
  data: string; // base64 encoded message content
  signature?: string;
  posted_at: number; // unix timestamp (seconds)
  edited_at?: number;
  seqno: number;
  whisper_to?: string;
  reactions?: Record<string, number>;
}

interface SOGSRoom {
  id: number;
  token: string;
  name: string;
  description?: string;
  image_id?: number;
  image_url?: string;
  message_count: number;
  active_users?: number;
  moderators?: string[];
  admin?: string;
  default_read?: boolean;
}

interface SOGSRecentMessagesResponse {
  messages: SOGSMessage[];
  room?: SOGSRoom;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function decodeBase64Data(data: string): string {
  try {
    // SOGS stores message data as base64
    const decoded = atob(data);
    try {
      const parsed = JSON.parse(decoded);
      return typeof parsed === 'string' ? parsed : parsed.text || decoded;
    } catch {
      return decoded;
    }
  } catch {
    return data;
  }
}

function guessNiches(text: string, roomName: string): string[] {
  const niches: string[] = [];
  const lower = `${text} ${roomName}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(session|oxen|sogs|onion|service.node)\b/.test(lower)) niches.push('privacy');
  if (/\b(privacy|anonymity|surveillance|censorship|encryption|secure)\b/.test(lower))
    niches.push('privacy');
  if (/\b(sec|regulation|etf|congress)\b/.test(lower)) niches.push('regulation');
  if (/\b(security|hack|exploit|audit|scam|phishing)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');
  if (/\b(tech|technology|programming|code|software|dev|rust)\b/.test(lower)) niches.push('tech');
  if (/\b(news|breaking|discussion|debate|opinion)\b/.test(lower)) niches.push('news');
  if (/\b(session|oxen)\b/i.test(roomName)) niches.push('privacy');

  if (niches.length === 0) niches.push('general');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function sogsMessageToPost(
  msg: SOGSMessage,
  room: RoomConfig,
  roomInfo?: SOGSRoom,
): UnifiedPost | null {
  if (msg.whisper_to) return null; // skip whispers (private within room)

  const content = decodeBase64Data(msg.data);
  if (!content || content.length < 2) return null;

  const senderName = msg.display_name || msg.sender.slice(0, 12) || 'Session User';
  const avatarUrl = msg.profile_picture || '';

  return {
    id: `session:${room.room}:${msg.id}`,
    protocol: 'session',
    author: {
      id: `session:${msg.sender}`,
      primary: { protocol: 'session', id: msg.sender },
      handles: { session: msg.sender },
      displayName: senderName,
      bio: '',
      avatarUrl: avatarUrl ? `https://${avatarUrl}` : '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { ssbFeedId: msg.sender },
    },
    text: content.slice(0, 2000),
    embeds: [],
    contentType: content.length > 500 ? 'article' : 'text',
    createdAt: msg.posted_at * 1000, // convert to ms
    metrics: {
      likes: msg.reactions
        ? Object.values(msg.reactions).reduce((a: number, b: number) => a + b, 0)
        : 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: msg.reactions
          ? Object.values(msg.reactions).reduce((a: number, b: number) => a + b, 0)
          : 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    },
    raw: msg,
    niches: guessNiches(content, room.displayName),
    community: roomInfo
      ? { name: roomInfo.name || room.room, title: roomInfo.name || room.displayName }
      : { name: room.room, title: room.displayName },
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchRoomMessages(room: RoomConfig, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${room.instance}/room/${room.room}/messages/recent?limit=${Math.min(limit, 50)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Session)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as SOGSRecentMessagesResponse;
    const messages = data.messages || [];
    const roomInfo = data.room;

    return messages
      .map((m: SOGSMessage) => sogsMessageToPost(m, room, roomInfo))
      .filter((p: UnifiedPost | null): p is UnifiedPost => p !== null)
      .slice(0, limit);
  } catch (err) {
    //     console.log(
    //       `[bridge] Session room error (${room.room}@${room.instance}): ${(err as Error).message}`,
    //     );
    return [];
  }
}

async function fetchRoomInfo(room: RoomConfig): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${room.instance}/room/${room.room}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Session)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const roomInfo = (await res.json()) as SOGSRoom;
    if (!roomInfo) return [];

    // Create a system post about the room (useful for feed discovery)
    return [
      {
        id: `session:room:${room.room}`,
        protocol: 'session',
        author: {
          id: `session:room:${room.room}`,
          primary: { protocol: 'session', id: room.room },
          handles: {},
          displayName: roomInfo.name || room.room,
          bio: roomInfo.description || '',
          avatarUrl: roomInfo.image_url || '',
          followerCount: roomInfo.active_users || 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: roomInfo.description || `Session open group: ${roomInfo.name || room.room}`,
        embeds: [],
        contentType: 'text',
        createdAt: Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: roomInfo,
        niches: guessNiches(roomInfo.description || roomInfo.name || '', room.room),
        community: { name: roomInfo.name || room.room, title: roomInfo.name || room.room },
      },
    ];
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'session',
  name: 'Session (SOGS)',
  description: 'Decentralized privacy-focused messenger — public open groups',
  endpoint: '/api/feed/session',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchSessionPosts(limit = 20): Promise<UnifiedPost[]> {
  const perRoom = Math.max(3, Math.ceil(limit / CURATED_ROOMS.length));
  const _roomLimit = Math.max(1, Math.ceil(perRoom * 0.3));

  const results = await Promise.allSettled(
    CURATED_ROOMS.map(async (room) => {
      const [messages, roomPosts] = await Promise.all([
        fetchRoomMessages(room, perRoom),
        fetchRoomInfo(room),
      ]);
      // Only include room info post occasionally
      return [...messages, ...roomPosts.slice(0, 1)];
    }),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Session: ${deduped.length} posts from ${CURATED_ROOMS.length} rooms`);
  return deduped;
}

/** @alias */
export const fetch = fetchSessionPosts;
