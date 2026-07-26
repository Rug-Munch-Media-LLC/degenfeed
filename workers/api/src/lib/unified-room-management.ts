/**
 * @degenfeed/api-worker — Unified Room CRUD & Member Management
 *
 * Create, get, join, leave, and update rooms and their members.
 */

import type { Env } from '../types';
import { seal } from './crypto-seal';
import {
  computeTransportState,
  MAX_ROOM_SIZE,
  mentionIndexKey,
  normalizeMention,
  roomKey,
  userRoomsKey,
} from './unified-room-constants';
import { exportRoomKey, generateRoomKey } from './unified-room-crypto';
import { rotateRoomKey } from './unified-room-keys';
import type { RoomMember, RoomTransport, UnifiedRoom } from './unified-room-types';

// ─── Room CRUD ─────────────────────────────────────────

export async function createUnifiedRoom(
  env: Env,
  creatorId: string,
  name: string,
  description: string,
  members: Array<{
    id: string;
    transport: RoomTransport;
    identity?: Partial<RoomMember['identity']>;
  }>,
): Promise<UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const allMemberIds = [...new Set([creatorId, ...members.map((m) => m.id)])];
  if (allMemberIds.length > MAX_ROOM_SIZE) {
    throw new Error(`[uroom] Room exceeds max size of ${MAX_ROOM_SIZE}`);
  }
  if (allMemberIds.length < 1) {
    throw new Error('[uroom] Room must have at least 1 member');
  }

  const roomId = crypto.randomUUID();
  const roomKeyObj = await generateRoomKey();
  const roomKeyStr = await exportRoomKey(roomKeyObj);
  const encryptedKey = await seal(env, roomKeyStr, `uroom:key:${roomId}`);

  const now = Date.now();
  const roomMembers: RoomMember[] = allMemberIds.map((id) => {
    const m = members.find((x) => x.id === id);
    return {
      id: id.toLowerCase(),
      displayName: m?.id?.slice(0, 10) || id.slice(0, 10),
      transport: m?.transport || 'web',
      identity: (m?.identity ? { ...m.identity } : {}) as RoomMember['identity'],
      role: id === creatorId ? 'admin' : 'member',
      joinedAt: now,
      lastActive: now,
    };
  });

  const room: UnifiedRoom = {
    id: roomId,
    name,
    description,
    creator: creatorId.toLowerCase(),
    members: roomMembers,
    transports: computeTransportState(roomMembers),
    encryptedKey,
    keyVersion: 1,
    createdAt: now,
    lastActivity: now,
  };

  await env.CACHE.put(roomKey(roomId), JSON.stringify(room), { expirationTtl: 86400 * 365 });
  for (const member of roomMembers) {
    await addRoomToUserIndex(env, member.id, roomId);
    if (member.displayName) {
      await env.CACHE.put(
        mentionIndexKey(normalizeMention(member.displayName)),
        JSON.stringify({ roomId, memberId: member.id }),
        { expirationTtl: 86400 * 365 },
      ).catch(() => {});
    }
  }

  return room;
}

export async function getUnifiedRoom(env: Env, roomId: string): Promise<UnifiedRoom | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(roomKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as UnifiedRoom;
  } catch {
    return null;
  }
}

async function saveRoom(env: Env, room: UnifiedRoom): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(roomKey(room.id), JSON.stringify(room), { expirationTtl: 86400 * 365 });
}

// ─── Member Management ─────────────────────────────────

export async function joinUnifiedRoom(
  env: Env,
  roomId: string,
  userId: string,
  transport: RoomTransport,
  identity?: Partial<RoomMember['identity']>,
): Promise<UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');
  if (room.members.some((m) => m.id === userId.toLowerCase())) {
    throw new Error('[uroom] Already a member');
  }
  if (room.members.length >= MAX_ROOM_SIZE) {
    throw new Error(`[uroom] Room full (max ${MAX_ROOM_SIZE})`);
  }

  const now = Date.now();
  room.members.push({
    id: userId.toLowerCase(),
    displayName: userId.slice(0, 10),
    transport,
    identity: identity || ({} as RoomMember['identity']),
    role: 'member',
    joinedAt: now,
    lastActive: now,
  });
  room.transports = computeTransportState(room.members);

  if (room.members.length > 1) {
    await rotateRoomKey(env, roomId);
    const rotated = await getUnifiedRoom(env, roomId);
    if (rotated) Object.assign(room, rotated);
  }

  room.lastActivity = now;
  await saveRoom(env, room);
  await addRoomToUserIndex(env, userId, roomId);
  if (userId) {
    await env.CACHE.put(
      mentionIndexKey(normalizeMention(userId)),
      JSON.stringify({ roomId, memberId: userId.toLowerCase() }),
      { expirationTtl: 86400 * 365 },
    ).catch(() => {});
  }

  return room;
}

export async function leaveUnifiedRoom(env: Env, roomId: string, userId: string): Promise<void> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const idx = room.members.findIndex((m) => m.id === userId.toLowerCase());
  if (idx < 0) throw new Error('[uroom] Not a member');
  room.members.splice(idx, 1);
  room.transports = computeTransportState(room.members);

  await saveRoom(env, room);
  if (room.members.length > 0) {
    await rotateRoomKey(env, roomId);
  }

  await removeRoomFromUserIndex(env, userId, roomId);
  await env.CACHE.delete(mentionIndexKey(normalizeMention(userId))).catch(() => {});
}

export async function updateMemberTransport(
  env: Env,
  roomId: string,
  userId: string,
  transport: RoomTransport,
): Promise<UnifiedRoom> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');
  const member = room.members.find((m) => m.id === userId.toLowerCase());
  if (!member) throw new Error('[uroom] Not a member');
  member.transport = transport;
  room.transports = computeTransportState(room.members);
  member.lastActive = Date.now();
  await saveRoom(env, room);
  return room;
}

// ─── User Room Index ───────────────────────────────────

async function addRoomToUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    const rooms: string[] = raw ? JSON.parse(raw) : [];
    if (!rooms.includes(roomId)) {
      rooms.push(roomId);
      await env.CACHE.put(key, JSON.stringify(rooms), { expirationTtl: 86400 * 365 });
    }
  } catch {
    /* non-critical */
  }
}

async function removeRoomFromUserIndex(env: Env, userId: string, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    if (!raw) return;
    const rooms: string[] = JSON.parse(raw);
    const idx = rooms.indexOf(roomId);
    if (idx >= 0) {
      rooms.splice(idx, 1);
      await env.CACHE.put(key, JSON.stringify(rooms), { expirationTtl: 86400 * 365 });
    }
  } catch {
    /* non-critical */
  }
}
