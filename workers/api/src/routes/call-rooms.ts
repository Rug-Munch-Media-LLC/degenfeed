/**
 * @degenfeed/api-worker — Persistent Group Call Rooms
 *
 * Persistent rooms that anyone can join, like Discord voice channels.
 * Rooms persist until manually deleted or pruned after inactivity.
 *
 * Routes:
 *   POST /api/rooms/create        — Create a persistent room
 *   GET  /api/rooms/:id            — Room info
 *   POST /api/rooms/:id/join       — Join room
 *   GET  /api/rooms/active         — Active rooms
 *   POST /api/rooms/:id/invite     — Invite someone to room
 *   POST /api/rooms/:id/leave      — Leave room
 *   POST /api/rooms/:id/delete     — Delete room (creator only)
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { CHANNELS } from '../ws-channels';
import { broadcastToUser } from '../ws-broadcast';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CallRoom {
  roomId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  participants: RoomParticipant[];
  type: 'video' | 'audio';
  maxParticipants: number;
  isPrivate: boolean;
  allowedWallets?: string[]; // for private rooms
  lastActivity: number;
}

export interface RoomParticipant {
  wallet: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: number;
  audioMuted: boolean;
  videoMuted: boolean;
}

// ─── KV Key Helpers ─────────────────────────────────────────────────────

const ROOM_TTL = 7 * 86400; // 7 days since last activity

function roomKey(roomId: string): string {
  return `room:${roomId}`;
}

function roomIndexKey(): string {
  return 'rooms:active';
}

// ─── Call Room Manager ──────────────────────────────────────────────────

export class CallRoomManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Create a persistent call room.
   */
  async createRoom(
    createdBy: string,
    name: string,
    options?: {
      description?: string;
      type?: 'video' | 'audio';
      maxParticipants?: number;
      isPrivate?: boolean;
      allowedWallets?: string[];
    },
  ): Promise<CallRoom> {
    const roomId = crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const room: CallRoom = {
      roomId,
      name,
      description: options?.description,
      createdBy,
      createdAt: Date.now(),
      participants: [
        {
          wallet: createdBy,
          joinedAt: Date.now(),
          audioMuted: false,
          videoMuted: false,
        },
      ],
      type: options?.type || 'video',
      maxParticipants: options?.maxParticipants || 50,
      isPrivate: options?.isPrivate || false,
      allowedWallets: options?.allowedWallets,
      lastActivity: Date.now(),
    };

    await this.env.CACHE?.put(roomKey(roomId), JSON.stringify(room), {
      expirationTtl: ROOM_TTL,
    });

    await this.addToIndex(roomId);

    return room;
  }

  /**
   * Get room by ID.
   */
  async getRoom(roomId: string): Promise<CallRoom | null> {
    try {
      const raw = await this.env.CACHE?.get(roomKey(roomId));
      if (!raw) return null;
      return JSON.parse(raw) as CallRoom;
    } catch {
      return null;
    }
  }

  /**
   * Join a room.
   */
  async joinRoom(
    roomId: string,
    wallet: string,
    profile?: { displayName?: string; avatarUrl?: string },
  ): Promise<CallRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    // Check private room access
    if (
      room.isPrivate &&
      room.allowedWallets &&
      !room.allowedWallets.includes(wallet) &&
      room.createdBy !== wallet
    ) {
      return null;
    }

    // Check max participants
    if (
      room.maxParticipants > 0 &&
      room.participants.length >= room.maxParticipants &&
      !room.participants.find((p) => p.wallet === wallet)
    ) {
      return null;
    }

    // Add or update participant
    const existing = room.participants.find((p) => p.wallet === wallet);
    if (existing) {
      existing.joinedAt = Date.now();
    } else {
      room.participants.push({
        wallet,
        displayName: profile?.displayName,
        avatarUrl: profile?.avatarUrl,
        joinedAt: Date.now(),
        audioMuted: false,
        videoMuted: false,
      });
    }

    room.lastActivity = Date.now();

    await this.env.CACHE?.put(roomKey(roomId), JSON.stringify(room), {
      expirationTtl: ROOM_TTL,
    });

    // Notify other participants
    for (const p of room.participants) {
      if (p.wallet !== wallet) {
        broadcastToUser(p.wallet, CHANNELS.CALL_STATE, {
          type: 'room_joined',
          roomId,
          wallet,
          displayName: profile?.displayName,
        });
      }
    }

    return room;
  }

  /**
   * Leave a room.
   */
  async leaveRoom(roomId: string, wallet: string): Promise<CallRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    room.participants = room.participants.filter((p) => p.wallet !== wallet);

    // If no participants left, mark inactive but keep room for 24h
    if (room.participants.length === 0) {
      room.lastActivity = Date.now();
    }

    await this.env.CACHE?.put(roomKey(roomId), JSON.stringify(room), {
      expirationTtl: ROOM_TTL,
    });

    // Notify remaining participants
    for (const p of room.participants) {
      broadcastToUser(p.wallet, CHANNELS.CALL_STATE, {
        type: 'room_left',
        roomId,
        wallet,
      });
    }

    return room;
  }

  /**
   * Update participant mute state.
   */
  async updateMuteState(
    roomId: string,
    wallet: string,
    audio: boolean,
    video: boolean,
  ): Promise<CallRoom | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    const participant = room.participants.find((p) => p.wallet === wallet);
    if (participant) {
      participant.audioMuted = audio;
      participant.videoMuted = video;
    }

    room.lastActivity = Date.now();

    await this.env.CACHE?.put(roomKey(roomId), JSON.stringify(room), {
      expirationTtl: ROOM_TTL,
    });

    return room;
  }

  /**
   * Delete a room (creator only).
   */
  async deleteRoom(roomId: string, wallet: string): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;
    if (room.createdBy !== wallet) return false;

    // Notify all participants
    for (const p of room.participants) {
      if (p.wallet !== wallet) {
        broadcastToUser(p.wallet, CHANNELS.CALL_STATE, {
          type: 'room_deleted',
          roomId,
        });
      }
    }

    await this.env.CACHE?.delete(roomKey(roomId));
    await this.removeFromIndex(roomId);
    return true;
  }

  /**
   * Invite someone to a room (creates a notification).
   */
  async inviteToRoom(
    roomId: string,
    invitedWallet: string,
    inviterWallet: string,
    inviterDisplayName?: string,
  ): Promise<boolean> {
    const room = await this.getRoom(roomId);
    if (!room) return false;

    broadcastToUser(invitedWallet, CHANNELS.CALL_INCOMING, {
      type: 'room_invite',
      roomId,
      roomName: room.name,
      from: inviterWallet,
      displayName: inviterDisplayName || inviterWallet.slice(0, 8),
    });

    return true;
  }

  /**
   * List active rooms (with participants).
   */
  async listActiveRooms(limit = 20): Promise<CallRoom[]> {
    try {
      const raw = await this.env.CACHE?.get(roomIndexKey());
      if (!raw) return [];
      const ids: string[] = JSON.parse(raw);
      const rooms: CallRoom[] = [];
      for (const id of ids.slice(0, limit)) {
        const room = await this.getRoom(id);
        if (room && room.participants.length > 0) {
          rooms.push(room);
        }
      }
      return rooms;
    } catch {
      return [];
    }
  }

  // ─── Index Management ────────────────────────────────────────────

  private async addToIndex(roomId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(roomIndexKey());
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(roomId)) {
        ids.push(roomId);
        await this.env.CACHE?.put(roomIndexKey(), JSON.stringify(ids), {
          expirationTtl: ROOM_TTL,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async removeFromIndex(roomId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(roomIndexKey());
      if (!raw) return;
      const ids: string[] = JSON.parse(raw).filter((id: string) => id !== roomId);
      await this.env.CACHE?.put(roomIndexKey(), JSON.stringify(ids), {
        expirationTtl: ROOM_TTL,
      });
    } catch {
      // Non-critical
    }
  }
}

// ─── Route Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/rooms/create — Create a persistent room
 */
export async function handleRoomCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      type?: 'video' | 'audio';
      maxParticipants?: number;
      isPrivate?: boolean;
      allowedWallets?: string[];
    };

    if (!body.name?.trim()) {
      return jsonResponse({ error: 'Room name is required' }, 400);
    }

    const manager = new CallRoomManager(env);
    const room = await manager.createRoom(session.address, body.name.trim(), {
      description: body.description,
      type: body.type || 'video',
      maxParticipants: body.maxParticipants || 50,
      isPrivate: body.isPrivate || false,
      allowedWallets: body.allowedWallets,
    });

    return jsonResponse({ ok: true, room }, 201);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] create failed:', error);
    return jsonResponse({ error: `Failed to create room: ${error}` }, 500);
  }
}

/**
 * GET /api/rooms/active — Active rooms
 */
export async function handleRoomsActive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const manager = new CallRoomManager(env);
    const rooms = await manager.listActiveRooms(50);

    return noCacheJsonResponse({
      rooms: rooms.map((r) => ({
        roomId: r.roomId,
        name: r.name,
        description: r.description,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        participantCount: r.participants.length,
        participants: r.participants.map((p) => ({
          wallet: p.wallet,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
        })),
        type: r.type,
        maxParticipants: r.maxParticipants,
        isPrivate: r.isPrivate,
        lastActivity: r.lastActivity,
      })),
      total: rooms.length,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] list failed:', error);
    return jsonResponse({ error: `Failed to list rooms: ${error}` }, 500);
  }
}

/**
 * GET /api/rooms/:id — Room info
 */
export async function handleRoomInfo(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const manager = new CallRoomManager(env);
    const room = await manager.getRoom(roomId);

    if (!room) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }

    return noCacheJsonResponse({ room });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] info failed:', error);
    return jsonResponse({ error: `Failed to get room: ${error}` }, 500);
  }
}

/**
 * POST /api/rooms/:id/join — Join a room
 */
export async function handleRoomJoin(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new CallRoomManager(env);
    const room = await manager.joinRoom(roomId, session.address, {
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
    });

    if (!room) {
      return jsonResponse({ error: 'Room not found or full' }, 404);
    }

    return jsonResponse({ ok: true, room });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] join failed:', error);
    return jsonResponse({ error: `Failed to join room: ${error}` }, 500);
  }
}

/**
 * POST /api/rooms/:id/leave — Leave a room
 */
export async function handleRoomLeave(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new CallRoomManager(env);
    const room = await manager.leaveRoom(roomId, session.address);

    if (!room) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }

    return jsonResponse({ ok: true, room });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] leave failed:', error);
    return jsonResponse({ error: `Failed to leave room: ${error}` }, 500);
  }
}

/**
 * POST /api/rooms/:id/invite — Invite someone to a room
 */
export async function handleRoomInvite(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { wallet?: string };
    if (!body.wallet) {
      return jsonResponse({ error: 'wallet is required' }, 400);
    }

    const manager = new CallRoomManager(env);
    const success = await manager.inviteToRoom(
      roomId,
      body.wallet,
      session.address,
      session.displayName,
    );

    if (!success) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }

    return jsonResponse({ ok: true, invited: body.wallet });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] invite failed:', error);
    return jsonResponse({ error: `Failed to invite: ${error}` }, 500);
  }
}

/**
 * POST /api/rooms/:id/delete — Delete a room (creator only)
 */
export async function handleRoomDelete(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new CallRoomManager(env);
    const deleted = await manager.deleteRoom(roomId, session.address);

    if (!deleted) {
      return jsonResponse(
        { error: 'Room not found or you are not the creator' },
        403,
      );
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] delete failed:', error);
    return jsonResponse({ error: `Failed to delete room: ${error}` }, 500);
  }
}

/**
 * POST /api/rooms/:id/mute — Update mute state in a room
 */
export async function handleRoomMute(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { audio?: boolean; video?: boolean };

    const manager = new CallRoomManager(env);
    const room = await manager.updateMuteState(
      roomId,
      session.address,
      body.audio ?? false,
      body.video ?? false,
    );

    if (!room) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[rooms] mute failed:', error);
    return jsonResponse({ error: `Failed to update mute: ${error}` }, 500);
  }
}
