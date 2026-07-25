/**
 * Huddle01 Provider
 *
 * Huddle01 provides decentralized video/audio calling infrastructure.
 * Uses WebRTC for peer-to-peer media with a relay network for NAT traversal.
 *
 * For the bridge, we:
 * 1. Monitor active rooms and sessions
 * 2. Provide room management API integration
 * 3. Track meeting summaries and recordings
 *
 * API: Huddle01 REST + SDK
 *   Create room: POST /api/v2/sdk/rooms
 *   List rooms: GET /api/v2/sdk/rooms
 *   Get room: GET /api/v2/sdk/rooms/{roomId}
 *
 * Since rooms are ephemeral, we track public rooms and their metadata.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const HUDDLE_API = 'https://api.huddle01.com/api/v2/sdk';
const HUDDLE_PROJECT_ID = process.env.HUDDLE_PROJECT_ID || '';

// ─── Types ─────────────────────────────────────────────────────────────

interface HuddleRoom {
  roomId: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'ended' | 'scheduled';
  hostAddress?: string;
  participantCount?: number;
  maxParticipants?: number;
  recordingUrl?: string;
  metadata?: Record<string, unknown>;
}

interface HuddleRoomResponse {
  rooms?: HuddleRoom[];
  data?: HuddleRoom[];
}

// ─── Mapping ──────────────────────────────────────────────────────────

function huddleRoomToPost(room: HuddleRoom): UnifiedPost {
  const title = room.title || `Room ${room.roomId?.slice(0, 8)}`;
  const statusEmoji = room.status === 'active' ? '🟢' : room.status === 'scheduled' ? '📅' : '🔴';
  const text = [
    `${statusEmoji} ${title}`,
    room.description || '',
    `👥 ${room.participantCount || 0}/${room.maxParticipants || '∞'} participants`,
    room.status ? `Status: ${room.status}` : '',
    `Room ID: ${room.roomId}`,
  ].filter(Boolean).join('\n');

  return {
    id: `huddle01:room:${room.roomId}`,
    protocol: 'huddle01',
    author: {
      id: `huddle01:host:${room.hostAddress || 'system'}`,
      primary: { protocol: 'huddle01', id: room.hostAddress || 'system' },
      handles: { huddle01: room.hostAddress?.slice(0, 10) || null },
      displayName: room.hostAddress ? `${room.hostAddress.slice(0, 6)}...${room.hostAddress.slice(-4)}` : 'Huddle01 System',
      bio: '', avatarUrl: '', followerCount: 0, followingCount: 0, links: [], keys: {},
    },
    text,
    embeds: [
      ...(room.recordingUrl ? [{ kind: 'video' as const, url: room.recordingUrl }] : []),
    ],
    contentType: room.status === 'active' ? 'live' : 'scheduled',
    createdAt: room.createdAt ? new Date(room.createdAt).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: room.participantCount || 0 },
    engagement: {
      viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: room,
    niches: ['video', 'communication'],
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchActiveRooms(limit: number): Promise<UnifiedPost[]> {
  if (!HUDDLE_PROJECT_ID) {
    // Return demo room if no API key configured
    return [{
      id: `huddle01:demo:${Date.now()}`,
      protocol: 'huddle01',
      author: {
        id: 'huddle01:system',
        primary: { protocol: 'huddle01', id: 'system' },
        handles: {},
        displayName: 'DegenFeed Video',
        bio: 'Decentralized video calls powered by Huddle01',
        avatarUrl: '', followerCount: 0, followingCount: 0, links: [], keys: {},
      },
      text: '📹 DegenFeed Video Calls ready. Configure HUDDLE_PROJECT_ID to enable.',
      embeds: [],
      contentType: 'status',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: { status: 'awaiting_config' },
      niches: ['video', 'communication'],
    }];
  }

  try {
    const res = await $fetch(`${HUDDLE_API}/rooms?limit=${limit}`, {
      headers: {
        'x-api-key': HUDDLE_PROJECT_ID,
        'User-Agent': 'DegenFeed-Bridge/0.1 (Huddle01)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as HuddleRoomResponse;
    const rooms = data.rooms || data.data || [];
    if (!Array.isArray(rooms)) return [];
    return rooms.slice(0, limit).map(huddleRoomToPost);
  } catch (err) {
    console.log(`[bridge] Huddle01 API error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'huddle01',
  name: 'Huddle01',
  description: 'Decentralized video/audio calling infrastructure',
  endpoint: '/api/feed/huddle01',
  requiresAuth: true,
  authEnvVar: 'HUDDLE_PROJECT_ID',
  contentType: 'live',
};

export async function fetchHuddle01Posts(limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchActiveRooms(limit);
  console.log(`[bridge] Huddle01: ${posts.length} rooms`);
  return posts;
}

export const fetch = fetchHuddle01Posts;
