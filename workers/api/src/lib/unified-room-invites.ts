/**
 * @degenfeed/api-worker — Unified Room Invite System
 *
 * Invite members and accept invitations.
 */

import type { Env } from '../types';
import { INVITE_TTL_MS, inviteKey } from './unified-room-constants';
import { getUnifiedRoom, joinUnifiedRoom } from './unified-room-management';
import type { RoomInvite, RoomMember, RoomTransport } from './unified-room-types';

export async function inviteToRoom(
  env: Env,
  roomId: string,
  fromId: string,
  target: string,
): Promise<RoomInvite> {
  const room = await getUnifiedRoom(env, roomId);
  if (!room) throw new Error('[uroom] Room not found');
  if (!room.members.some((m) => m.id === fromId.toLowerCase())) {
    throw new Error('[uroom] Only members can invite');
  }

  const invite: RoomInvite = {
    id: crypto.randomUUID(),
    roomId,
    fromId: fromId.toLowerCase(),
    target: target.trim(),
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + INVITE_TTL_MS,
  };

  await env.CACHE?.put(inviteKey(roomId, invite.id), JSON.stringify(invite), {
    expirationTtl: Math.ceil(INVITE_TTL_MS / 1000),
  });

  return invite;
}

export async function acceptInvite(
  env: Env,
  inviteId: string,
  roomId: string,
  userId: string,
  transport: RoomTransport,
  identity?: Partial<RoomMember['identity']>,
): Promise<import('./unified-room-types').UnifiedRoom> {
  if (!env.CACHE) throw new Error('[uroom] KV not available');

  const raw = await env.CACHE.get(inviteKey(roomId, inviteId));
  if (!raw) throw new Error('[uroom] Invite not found or expired');

  const invite = JSON.parse(raw) as RoomInvite;
  if (invite.status !== 'pending') throw new Error('[uroom] Invite already processed');

  invite.status = 'accepted';
  invite.resolvedMemberId = userId.toLowerCase();
  await env.CACHE.put(inviteKey(roomId, inviteId), JSON.stringify(invite), {
    expirationTtl: Math.ceil(INVITE_TTL_MS / 1000),
  });

  return joinUnifiedRoom(env, roomId, userId, transport, identity);
}
