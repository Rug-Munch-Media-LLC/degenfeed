/**
 * @degenfeed/api-worker — Unified Room Query Functions
 *
 * Retrieve messages, user rooms, unread counts, and membership checks.
 */

import type { Env } from '../types';
import { messagesKey } from './unified-room-constants';
import { getUnifiedRoom } from './unified-room-management';
import type { RoomMessage, UnreadCount } from './unified-room-types';

/**
 * Get messages for a room.
 */
export async function getRoomMessages(
  env: Env,
  roomId: string,
  limit = 50,
  before?: number,
): Promise<RoomMessage[]> {
  if (!env.CACHE) return [];
  const key = messagesKey(roomId);
  const raw = await env.CACHE.get(key);
  if (!raw) return [];
  const messages: RoomMessage[] = JSON.parse(raw);
  let filtered = messages;
  if (before) {
    filtered = filtered.filter((m) => m.createdAt < before);
  }
  return filtered.slice(-limit);
}

/**
 * Get all rooms for a user.
 */
export async function getUserRooms(
  env: Env,
  userId: string,
): Promise<import('./unified-room-types').UnifiedRoom[]> {
  if (!env.CACHE) return [];
  try {
    const { userRoomsKey } = await import('./unified-room-constants');
    const key = userRoomsKey(userId);
    const raw = await env.CACHE.get(key);
    if (!raw) return [];
    const roomIds: string[] = JSON.parse(raw);
    const rooms: import('./unified-room-types').UnifiedRoom[] = [];
    for (const roomId of roomIds) {
      const room = await getUnifiedRoom(env, roomId);
      if (room) rooms.push(room);
    }
    return rooms.sort((a, b) => b.lastActivity - a.lastActivity);
  } catch {
    return [];
  }
}

/**
 * Get unread counts for all rooms a user is in.
 */
export async function getUnreadCounts(env: Env, userId: string): Promise<UnreadCount[]> {
  const rooms = await getUserRooms(env, userId);
  const counts: UnreadCount[] = [];

  for (const room of rooms) {
    const messages = await getRoomMessages(env, room.id, 1);
    const lastMsg = messages[messages.length - 1];
    const isRead = !lastMsg || lastMsg.fromId === userId.toLowerCase();
    counts.push({
      roomId: room.id,
      count: isRead ? 0 : 1,
      lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 80) : undefined,
      lastMessageAt: lastMsg?.createdAt,
    });
  }

  return counts;
}

/**
 * Check if a user is a member of a room.
 */
export async function isRoomMember(env: Env, roomId: string, userId: string): Promise<boolean> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) return false;
  return room.members.some((m) => m.id === userId.toLowerCase());
}
