/**
 * @degenfeed/api-worker — Unified Room Key Rotation
 *
 * Rotate encryption keys and retrieve room keys for members.
 * Uses direct KV access to avoid circular dependencies with management module.
 */

import type { Env } from '../types';
import { seal, unseal } from './crypto-seal';
import { roomKey } from './unified-room-constants';
import { exportRoomKey, generateRoomKey } from './unified-room-crypto';
import type { UnifiedRoom } from './unified-room-types';

async function readRoomDirect(env: Env, id: string): Promise<UnifiedRoom | null> {
  try {
    const raw = await env.CACHE?.get(roomKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as UnifiedRoom;
  } catch {
    return null;
  }
}

async function saveRoomDirect(env: Env, room: UnifiedRoom): Promise<void> {
  await env.CACHE?.put(roomKey(room.id), JSON.stringify(room), { expirationTtl: 86400 * 365 });
}

export async function rotateRoomKey(env: Env, roomId: string): Promise<void> {
  if (!env.CACHE) return;
  const room = await readRoomDirect(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');

  const newKey = await generateRoomKey();
  const newKeyStr = await exportRoomKey(newKey);
  const encryptedKey = await seal(env, newKeyStr, `uroom:key:${roomId}`);

  room.encryptedKey = encryptedKey;
  room.keyVersion += 1;
  await saveRoomDirect(env, room);
}

export async function getRoomKey(env: Env, roomId: string, userId: string): Promise<string | null> {
  if (!env.CACHE) return null;
  try {
    const room = await readRoomDirect(env, roomId);
    if (!room) return null;
    if (!room.members.some((m) => m.id === userId.toLowerCase())) return null;
    return await unseal(env, room.encryptedKey, `uroom:key:${roomId}`);
  } catch {
    return null;
  }
}
