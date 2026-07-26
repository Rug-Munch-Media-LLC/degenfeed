/**
 * /api/voice — Voice & Video Room Management
 *
 * POST   /api/voice/create            — Create voice/video room
 * POST   /api/voice/:id/join          — Join a room
 * POST   /api/voice/:id/leave         — Leave a room
 * POST   /api/voice/:id/update        — Update participant state
 * GET    /api/voice/:id/participants  — Who's in the room
 * GET    /api/voice/:id/invite        — Generate invite link
 * GET    /api/voice/active            — Active voice rooms
 * GET    /api/voice/invite/:code      — Resolve invite code
 * POST   /api/voice/:id/signal        — Send WebRTC signal
 * GET    /api/voice/:id/signals       — Get pending signals
 */

import type { RoomType, VoiceRoomParticipant } from '../lib/voice-rooms';
import {
  createRoom,
  generateInvite,
  getActiveRooms,
  getRoom,
  getRoomParticipants,
  getSignals,
  joinRoom,
  leaveRoom,
  resolveInvite,
  storeSignal,
  updateParticipantState,
} from '../lib/voice-rooms';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/voice/create ─────────────────────────────────────────────────

export async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: {
    name?: string;
    type?: RoomType;
    maxParticipants?: number;
    password?: string;
    inviteOnly?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const name = (body.name ?? 'My Room').trim().slice(0, 100);
  const type: RoomType = body.type === 'video' ? 'video' : 'voice';

  if (!name) {
    return jsonResponse({ error: 'Room name is required' }, 400);
  }

  try {
    const room = await createRoom(env, userId, name, type, {
      maxParticipants: body.maxParticipants,
      password: body.password,
      inviteOnly: body.inviteOnly ?? false,
    });
    return noCacheJsonResponse({ ok: true, room });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create room';
    return jsonResponse({ error: msg }, 400);
  }
}

// ─── POST /api/voice/:id/join ───────────────────────────────────────────────

export async function handleJoinRoom(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { displayName?: string; password?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const room = await joinRoom(env, roomId, userId, body.displayName, body.password);
    return noCacheJsonResponse({ ok: true, room });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to join room';
    return jsonResponse({ error: msg }, 400);
  }
}

// ─── POST /api/voice/:id/leave ──────────────────────────────────────────────

export async function handleLeaveRoom(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const room = await leaveRoom(env, roomId, userId);
    return noCacheJsonResponse({ ok: true, room });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to leave room';
    return jsonResponse({ error: msg }, 400);
  }
}

// ─── POST /api/voice/:id/update ─────────────────────────────────────────────

export async function handleUpdateState(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: Partial<VoiceRoomParticipant>;
  try {
    body = (await request.json()) as Partial<VoiceRoomParticipant>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const room = await updateParticipantState(env, roomId, userId, body);
    if (!room) {
      return jsonResponse({ error: 'Room not found or not a participant' }, 404);
    }
    return noCacheJsonResponse({ ok: true, room });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update state';
    return jsonResponse({ error: msg }, 400);
  }
}

// ─── GET /api/voice/:id/participants ────────────────────────────────────────

export async function handleGetParticipants(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const room = await getRoom(env, roomId);
    if (!room) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }
    const participants = await getRoomParticipants(env, roomId);
    return noCacheJsonResponse({ participants, roomName: room.name, roomType: room.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get participants';
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/voice/:id/invite ──────────────────────────────────────────────

export async function handleGenerateInvite(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const code = await generateInvite(env, roomId, userId);
    return noCacheJsonResponse({
      ok: true,
      code,
      inviteUrl: `/messages/voice?invite=${code}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate invite';
    return jsonResponse({ error: msg }, 400);
  }
}

// ─── GET /api/voice/active ──────────────────────────────────────────────────

export async function handleGetActiveRooms(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') as RoomType | null;

  try {
    const rooms = await getActiveRooms(env, type ?? undefined);
    return noCacheJsonResponse({ rooms, count: rooms.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get active rooms';
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/voice/invite/:code ────────────────────────────────────────────

export async function handleResolveInvite(
  _request: Request,
  env: Env,
  code: string,
): Promise<Response> {
  try {
    const room = await resolveInvite(env, code);
    if (!room) {
      return jsonResponse({ error: 'Invite not found or expired' }, 404);
    }
    return noCacheJsonResponse({
      ok: true,
      room: {
        id: room.id,
        name: room.name,
        type: room.type,
        participantCount: room.participants.length,
        hasPassword: !!room.passwordHash,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to resolve invite';
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── POST /api/voice/:id/signal ─────────────────────────────────────────────

export async function handleSendSignal(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { toId: string; signal: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.toId || !body.signal) {
    return jsonResponse({ error: 'toId and signal are required' }, 400);
  }

  try {
    await storeSignal(env, roomId, userId, body.toId, body.signal);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send signal';
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/voice/:id/signals ─────────────────────────────────────────────

export async function handleGetSignals(
  request: Request,
  env: Env,
  roomId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  const room = await getRoom(env, roomId);
  if (!room) {
    return jsonResponse({ error: 'Room not found' }, 404);
  }

  const signals = await getSignals(env, roomId, userId);
  return noCacheJsonResponse({ signals });
}
