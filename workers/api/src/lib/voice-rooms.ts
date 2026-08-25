/**
 * @degenfeed/api-worker — Voice & Video Room Management
 *
 * Server-side state for voice/video rooms using KV.
 * WebRTC signaling is handled client-to-client via the realtime WebSocket.
 * This module manages room lifecycle, participant tracking, and metadata.
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoomType = 'voice' | 'video';

export interface VoiceRoom {
  /** Unique room ID */
  id: string;
  /** Room name */
  name: string;
  /** Room type */
  type: RoomType;
  /** Creator wallet address */
  createdBy: string;
  /** When created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Whether room is active */
  active: boolean;
  /** Max participants (0 = unlimited) */
  maxParticipants: number;
  /** Room password hash (optional, empty string = no password) */
  passwordHash: string;
  /** Room is invite-only */
  inviteOnly: boolean;
  /** Current participants */
  participants: VoiceRoomParticipant[];
}

export interface VoiceRoomParticipant {
  /** Wallet address */
  walletAddress: string;
  /** Display name */
  displayName: string;
  /** When they joined */
  joinedAt: number;
  /** Audio muted */
  muted: boolean;
  /** Video muted (for video rooms) */
  videoMuted: boolean;
  /** Deafened (can't hear others) */
  deafened: boolean;
  /** Screen sharing */
  screenSharing: boolean;
  /** Hand raised */
  handRaised: boolean;
  /** WebRTC ICE candidate / connection state */
  connected: boolean;
}

export interface VoiceRoomSummary {
  id: string;
  name: string;
  type: RoomType;
  participantCount: number;
  maxParticipants: number;
  hasPassword: boolean;
  inviteOnly: boolean;
  createdBy: string;
  lastActivity: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const VOICE_ROOM_PREFIX = 'voice:room:';
const VOICE_ROOM_ACTIVE_SET = 'voice:rooms:active';
const VOICE_ROOM_INVITE_PREFIX = 'voice:invite:';

const MAX_ROOMS_PER_USER = 5;
const MAX_PARTICIPANTS_DEFAULT = 0; // unlimited
const ROOM_TTL_SECONDS = 86400 * 7; // 7 days
const INACTIVE_TIMEOUT_MS = 3600000; // 1 hour

// ─── Room CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new voice/video room.
 */
export async function createRoom(
  env: Env,
  creatorId: string,
  name: string,
  type: RoomType,
  options?: {
    maxParticipants?: number;
    password?: string;
    inviteOnly?: boolean;
  },
): Promise<VoiceRoom> {
  if (!env.CACHE) throw new Error('[voice] KV not available');

  // Check user's active room count
  const userRooms = await getUserActiveRooms(env, creatorId);
  if (userRooms.length >= MAX_ROOMS_PER_USER) {
    throw new Error(`[voice] Max ${MAX_ROOMS_PER_USER} active rooms per user`);
  }

  const roomId = crypto.randomUUID();
  const passwordHash = options?.password ? await hashPassword(options.password) : '';

  const room: VoiceRoom = {
    id: roomId,
    name: name.trim().slice(0, 100),
    type,
    createdBy: creatorId.toLowerCase(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    active: true,
    maxParticipants: options?.maxParticipants ?? MAX_PARTICIPANTS_DEFAULT,
    passwordHash,
    inviteOnly: options?.inviteOnly ?? false,
    participants: [
      {
        walletAddress: creatorId.toLowerCase(),
        displayName: creatorId.slice(0, 10),
        joinedAt: Date.now(),
        muted: false,
        videoMuted: false,
        deafened: false,
        screenSharing: false,
        handRaised: false,
        connected: true,
      },
    ],
  };

  // Store room
  await env.CACHE.put(`${VOICE_ROOM_PREFIX}${roomId}`, JSON.stringify(room), {
    expirationTtl: ROOM_TTL_SECONDS,
  });

  // Add to active set
  await addToActiveSet(env, roomId);
  // Add to user's rooms
  await addRoomToUserIndex(env, creatorId, roomId);

  return room;
}

/**
 * Join a voice/video room.
 */
export async function joinRoom(
  env: Env,
  roomId: string,
  userId: string,
  displayName?: string,
  password?: string,
): Promise<VoiceRoom> {
  if (!env.CACHE) throw new Error('[voice] KV not available');

  const room = await getRoom(env, roomId);
  if (!room) throw new Error('[voice] Room not found');
  if (!room.active) throw new Error('[voice] Room is not active');

  // Check password
  if (room.passwordHash) {
    if (!password) throw new Error('[voice] Password required');
    const valid = await verifyPassword(password, room.passwordHash);
    if (!valid) throw new Error('[voice] Invalid password');
  }

  // Check if already in room
  const existing = room.participants.find((p) => p.walletAddress === userId.toLowerCase());
  if (existing) {
    existing.connected = true;
    existing.joinedAt = Date.now();
    await saveRoom(env, room);
    return room;
  }

  // Check max participants
  if (room.maxParticipants > 0 && room.participants.length >= room.maxParticipants) {
    throw new Error('[voice] Room is full');
  }

  room.participants.push({
    walletAddress: userId.toLowerCase(),
    displayName: displayName ?? userId.slice(0, 10),
    joinedAt: Date.now(),
    muted: false,
    videoMuted: false,
    deafened: false,
    screenSharing: false,
    handRaised: false,
    connected: true,
  });
  room.lastActivity = Date.now();

  await saveRoom(env, room);
  await addRoomToUserIndex(env, userId, roomId);

  return room;
}

/**
 * Leave a voice/video room.
 */
export async function leaveRoom(
  env: Env,
  roomId: string,
  userId: string,
): Promise<VoiceRoom | null> {
  if (!env.CACHE) return null;

  const room = await getRoom(env, roomId);
  if (!room) return null;

  const idx = room.participants.findIndex((p) => p.walletAddress === userId.toLowerCase());
  if (idx >= 0) {
    room.participants.splice(idx, 1);
  }

  room.lastActivity = Date.now();

  // If no participants left, deactivate after timeout
  if (room.participants.length === 0) {
    room.active = false;
    await removeFromActiveSet(env, roomId);
  }

  await saveRoom(env, room);
  await removeRoomFromUserIndex(env, userId, roomId);

  // If creator left and there are other participants, assign new creator
  if (
    room.createdBy === userId.toLowerCase() &&
    room.participants.length > 0 &&
    room.participants[0]
  ) {
    room.createdBy = room.participants[0].walletAddress;
    await saveRoom(env, room);
  }

  return room;
}

/**
 * Update participant state (mute, deafen, hand raise, etc).
 */
export async function updateParticipantState(
  env: Env,
  roomId: string,
  userId: string,
  updates: Partial<VoiceRoomParticipant>,
): Promise<VoiceRoom | null> {
  if (!env.CACHE) return null;

  const room = await getRoom(env, roomId);
  if (!room) return null;

  const participant = room.participants.find((p) => p.walletAddress === userId.toLowerCase());
  if (!participant) return null;

  Object.assign(participant, updates);
  room.lastActivity = Date.now();
  await saveRoom(env, room);

  return room;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Get a room by ID.
 */
export async function getRoom(env: Env, roomId: string): Promise<VoiceRoom | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${VOICE_ROOM_PREFIX}${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as VoiceRoom;
  } catch {
    return null;
  }
}

/**
 * Get active voice rooms (summaries).
 */
export async function getActiveRooms(env: Env, type?: RoomType): Promise<VoiceRoomSummary[]> {
  if (!env.CACHE) return [];

  try {
    const raw = await env.CACHE.get(VOICE_ROOM_ACTIVE_SET);
    if (!raw) return [];

    const roomIds: string[] = JSON.parse(raw);
    const summaries: VoiceRoomSummary[] = [];

    for (const roomId of roomIds) {
      const room = await getRoom(env, roomId);
      if (!room?.active) continue;
      if (type && room.type !== type) continue;

      // Skip stale rooms
      if (Date.now() - room.lastActivity > INACTIVE_TIMEOUT_MS) {
        room.active = false;
        await saveRoom(env, room);
        await removeFromActiveSet(env, roomId);
        continue;
      }

      summaries.push({
        id: room.id,
        name: room.name,
        type: room.type,
        participantCount: room.participants.length,
        maxParticipants: room.maxParticipants,
        hasPassword: !!room.passwordHash,
        inviteOnly: room.inviteOnly,
        createdBy: room.createdBy,
        lastActivity: room.lastActivity,
      });
    }

    return summaries.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

/**
 * Get all active rooms a user is in.
 */
export async function getUserActiveRooms(env: Env, userId: string): Promise<VoiceRoomSummary[]> {
  if (!env.CACHE) return [];

  try {
    const key = `${VOICE_ROOM_PREFIX}user:${userId.toLowerCase()}`;
    const raw = await env.CACHE.get(key);
    if (!raw) return [];

    const roomIds: string[] = JSON.parse(raw);
    const summaries: VoiceRoomSummary[] = [];

    for (const roomId of roomIds) {
      const room = await getRoom(env, roomId);
      if (!room?.active) continue;
      summaries.push({
        id: room.id,
        name: room.name,
        type: room.type,
        participantCount: room.participants.length,
        maxParticipants: room.maxParticipants,
        hasPassword: !!room.passwordHash,
        inviteOnly: room.inviteOnly,
        createdBy: room.createdBy,
        lastActivity: room.lastActivity,
      });
    }

    return summaries;
  } catch {
    return [];
  }
}

/**
 * Get participants for a specific room.
 */
export async function getRoomParticipants(
  env: Env,
  roomId: string,
): Promise<VoiceRoomParticipant[]> {
  if (!env.CACHE) return [];
  const room = await getRoom(env, roomId);
  if (!room) return [];
  // Return participants excluding sensitive data
  return room.participants.map((p) => ({
    ...p,
  }));
}

/**
 * Generate an invite link for a room.
 */
export async function generateInvite(env: Env, roomId: string, createdBy: string): Promise<string> {
  if (!env.CACHE) throw new Error('[voice] KV not available');

  const room = await getRoom(env, roomId);
  if (!room) throw new Error('[voice] Room not found');

  const code = crypto.randomUUID().slice(0, 8);
  const inviteData = {
    roomId,
    code,
    createdBy: createdBy.toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000, // 24h
  };

  await env.CACHE.put(`${VOICE_ROOM_INVITE_PREFIX}${code}`, JSON.stringify(inviteData), {
    expirationTtl: 86400,
  });

  return code;
}

/**
 * Resolve an invite code to a room.
 */
export async function resolveInvite(env: Env, code: string): Promise<VoiceRoom | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${VOICE_ROOM_INVITE_PREFIX}${code}`);
    if (!raw) return null;
    const invite = JSON.parse(raw) as {
      roomId: string;
      expiresAt: number;
    };
    if (Date.now() > invite.expiresAt) return null;
    return getRoom(env, invite.roomId);
  } catch {
    return null;
  }
}

// ─── WebRTC Signaling ───────────────────────────────────────────────────────

/**
 * Store a WebRTC signaling message for a room participant.
 * These are used for the SFU or mesh signaling exchange.
 */
export async function storeSignal(
  env: Env,
  roomId: string,
  fromId: string,
  toId: string,
  signal: unknown,
): Promise<void> {
  if (!env.CACHE) return;
  const key = `${VOICE_ROOM_PREFIX}signal:${roomId}:${toId}`;
  const raw = await env.CACHE.get(key);
  const signals: Array<{ fromId: string; signal: unknown; timestamp: number }> = raw
    ? JSON.parse(raw)
    : [];
  signals.push({ fromId, signal, timestamp: Date.now() });
  // Keep last 50 signals
  await env.CACHE.put(key, JSON.stringify(signals.slice(-50)), {
    expirationTtl: 300, // 5 min TTL for signals
  });
}

/**
 * Get pending signaling messages for a participant.
 */
export async function getSignals(
  env: Env,
  roomId: string,
  userId: string,
): Promise<Array<{ fromId: string; signal: unknown }>> {
  if (!env.CACHE) return [];
  const key = `${VOICE_ROOM_PREFIX}signal:${roomId}:${userId}`;
  const raw = await env.CACHE.get(key);
  if (!raw) return [];
  await env.CACHE.delete(key);
  const all = JSON.parse(raw) as Array<{
    fromId: string;
    signal: unknown;
  }>;
  return all;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

async function saveRoom(env: Env, room: VoiceRoom): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(`${VOICE_ROOM_PREFIX}${room.id}`, JSON.stringify(room), {
    expirationTtl: ROOM_TTL_SECONDS,
  });
}

async function addToActiveSet(env: Env, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(VOICE_ROOM_ACTIVE_SET);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(roomId)) {
    ids.push(roomId);
    await env.CACHE.put(VOICE_ROOM_ACTIVE_SET, JSON.stringify(ids), {
      expirationTtl: ROOM_TTL_SECONDS,
    });
  }
}

async function removeFromActiveSet(env: Env, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  const raw = await env.CACHE.get(VOICE_ROOM_ACTIVE_SET);
  if (!raw) return;
  const ids: string[] = JSON.parse(raw);
  const idx = ids.indexOf(roomId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    await env.CACHE.put(VOICE_ROOM_ACTIVE_SET, JSON.stringify(ids), {
      expirationTtl: ROOM_TTL_SECONDS,
    });
  }
}

async function addRoomToUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  const key = `${VOICE_ROOM_PREFIX}user:${userId.toLowerCase()}`;
  const raw = await env.CACHE.get(key);
  const ids: string[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(roomId)) {
    ids.push(roomId);
    await env.CACHE.put(key, JSON.stringify(ids), {
      expirationTtl: ROOM_TTL_SECONDS,
    });
  }
}

async function removeRoomFromUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  const key = `${VOICE_ROOM_PREFIX}user:${userId.toLowerCase()}`;
  const raw = await env.CACHE.get(key);
  if (!raw) return;
  const ids: string[] = JSON.parse(raw);
  const idx = ids.indexOf(roomId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    await env.CACHE.put(key, JSON.stringify(ids), {
      expirationTtl: ROOM_TTL_SECONDS,
    });
  }
}

// ─── Password helpers (simple SHA-256 for lightweight auth) ────────────────

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}degenfeed-voice-salt`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}
