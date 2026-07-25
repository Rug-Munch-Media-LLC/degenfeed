/**
 * /api/chat/group — Standardized Group Chat (Matrix-Backed)
 *
 * Every group chat is a Matrix E2E room (Olm/Megolm).
 * Each member receives messages via their preferred protocol.
 * Moderation: kick, ban, promote to admin.
 *
 * POST   /api/chat/group/create      — Create E2E group room
 * POST   /api/chat/group/send        — Send message to group
 * POST   /api/chat/group/invite      — Invite new member
 * POST   /api/chat/group/kick        — Remove member
 * POST   /api/chat/group/promote     — Promote to admin
 * GET    /api/chat/group/messages    — Get group messages
 * GET    /api/chat/group/list        — List user's groups
 * GET    /api/chat/group/info        — Get group metadata
 * PUT    /api/chat/group/settings    — Update group settings
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  badRequest,
  forbidden,
  methodNotAllowed,
  notFound,
  serverError,
} from '../response-helpers';
import { requireSession } from '../session';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/group/create
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { name: string; members: string[]; topic?: string; avatarUrl?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.name?.trim()) {
    return badRequest('Group name is required');
  }

  if (!body.members?.length) {
    return badRequest('At least one additional member is required');
  }

  if (body.members.length > 99) {
    return badRequest('Maximum 100 members per group (including creator)');
  }

  try {
    const { resolveMatrixAccount, createGroupRoom, getProtocolPreferences } = await import(
      '../lib/chat-matrix'
    );

    const account = await resolveMatrixAccount(env, session.address);

    // Resolve each member's preferred protocol
    const memberProtocols: Record<string, string> = {};
    for (const wallet of body.members) {
      try {
        memberProtocols[wallet.toLowerCase()] = await getProtocolPreferences(env, wallet).then(
          (p) => p.primary,
        );
      } catch {
        memberProtocols[wallet.toLowerCase()] = 'matrix';
      }
    }

    const room = await createGroupRoom(
      env,
      session.address,
      body.name.trim(),
      body.members,
      account,
      { topic: body.topic, avatarUrl: body.avatarUrl },
    );

    return jsonResponse(
      {
        ok: true,
        roomId: room.roomId,
        type: 'group',
        name: room.name,
        memberCount: room.members.length,
        members: room.members.map((m) => ({
          wallet: m,
          protocol: memberProtocols[m] || 'matrix',
        })),
        encrypted: room.encrypted,
        createdAt: room.createdAt,
      },
      201,
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Group creation failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/group/send
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { roomId: string; body: string; msgType?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.roomId || !body.body?.trim()) {
    return badRequest('roomId and body are required');
  }

  if (body.body.length > 65536) {
    return badRequest('Message exceeds maximum length (65536 chars)');
  }

  try {
    const { resolveMatrixAccount, sendRoomMessage, getRoomMeta } = await import(
      '../lib/chat-matrix'
    );

    // Verify membership
    const meta = await getRoomMeta(env, body.roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.members.includes(session.address.toLowerCase())) {
      return forbidden('You are not a member of this group');
    }

    const account = await resolveMatrixAccount(env, session.address);
    const message = await sendRoomMessage(
      env,
      body.roomId,
      session.address,
      account,
      body.body.trim(),
      body.msgType || 'm.text',
    );

    return jsonResponse(
      {
        ok: true,
        eventId: message.eventId,
        timestamp: message.timestamp,
        groupName: meta.name,
      },
      201,
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Send failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/group/invite
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupInvite(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { roomId: string; target: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.roomId || !body.target?.trim()) {
    return badRequest('roomId and target wallet are required');
  }

  try {
    const { getRoomMeta, inviteToRoom } = await import('../lib/chat-matrix');

    // Verify admin
    const meta = await getRoomMeta(env, body.roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.admins.includes(session.address.toLowerCase())) {
      return forbidden('Only admins can invite members');
    }

    const updated = await inviteToRoom(env, body.roomId, session.address, body.target);

    return jsonResponse(
      {
        ok: true,
        roomId: body.roomId,
        newMember: body.target.toLowerCase(),
        memberCount: updated.members.length,
      },
      200,
    );
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Invite failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/group/kick
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupKick(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { roomId: string; target: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.roomId || !body.target?.trim()) {
    return badRequest('roomId and target wallet are required');
  }

  try {
    const { getRoomMeta, kickFromRoom } = await import('../lib/chat-matrix');

    const meta = await getRoomMeta(env, body.roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.admins.includes(session.address.toLowerCase())) {
      return forbidden('Only admins can kick members');
    }

    if (body.target.toLowerCase() === session.address.toLowerCase()) {
      return badRequest('Cannot kick yourself');
    }

    await kickFromRoom(env, body.roomId, session.address, body.target);

    return noCacheJsonResponse({
      ok: true,
      roomId: body.roomId,
      removed: body.target.toLowerCase(),
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Kick failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/group/promote
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupPromote(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { roomId: string; target: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.roomId || !body.target?.trim()) {
    return badRequest('roomId and target wallet are required');
  }

  try {
    const { getRoomMeta, promoteToAdmin } = await import('../lib/chat-matrix');

    const meta = await getRoomMeta(env, body.roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.admins.includes(session.address.toLowerCase())) {
      return forbidden('Only admins can promote members');
    }

    await promoteToAdmin(env, body.roomId, session.address, body.target);

    return noCacheJsonResponse({
      ok: true,
      roomId: body.roomId,
      promoted: body.target.toLowerCase(),
      role: 'admin',
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Promotion failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/group/messages
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupMessages(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  if (!roomId) return badRequest('roomId query parameter is required');

  try {
    const { resolveMatrixAccount, getRoomMessages, getRoomMeta } = await import(
      '../lib/chat-matrix'
    );

    const meta = await getRoomMeta(env, roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.members.includes(session.address.toLowerCase())) {
      return forbidden('You are not a member of this group');
    }

    const account = await resolveMatrixAccount(env, session.address);
    const messages = await getRoomMessages(env, roomId, account, limit);

    return noCacheJsonResponse({
      messages: messages.reverse(),
      total: messages.length,
      roomId,
      groupName: meta.name,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to get messages');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/group/list
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getUserRooms } = await import('../lib/chat-matrix');

    const allRooms = await getUserRooms(env, session.address);
    const groupRooms = allRooms
      .filter((r) => r.type === 'group')
      .sort((a, b) => b.lastActivity - a.lastActivity);

    return noCacheJsonResponse({
      groups: groupRooms.map((r) => ({
        roomId: r.roomId,
        name: r.name,
        topic: r.topic,
        memberCount: r.members.length,
        memberWallets: r.members,
        adminWallets: r.admins,
        lastActivity: r.lastActivity,
        createdAt: r.createdAt,
        encrypted: r.encrypted,
        isAdmin: r.admins.includes(session.address.toLowerCase()),
      })),
      total: groupRooms.length,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to list groups');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/group/info
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupInfo(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');

  if (!roomId) return badRequest('roomId query parameter is required');

  try {
    const { getRoomMeta } = await import('../lib/chat-matrix');

    const meta = await getRoomMeta(env, roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.members.includes(session.address.toLowerCase())) {
      return forbidden('You are not a member of this group');
    }

    return noCacheJsonResponse({
      ok: true,
      roomId: meta.roomId,
      name: meta.name,
      topic: meta.topic,
      type: meta.type,
      createdBy: meta.createdBy,
      memberCount: meta.members.length,
      members: meta.members,
      admins: meta.admins,
      isAdmin: meta.admins.includes(session.address.toLowerCase()),
      isCreator: meta.createdBy === session.address.toLowerCase(),
      createdAt: meta.createdAt,
      lastActivity: meta.lastActivity,
      encrypted: meta.encrypted,
      bridgedProtocols: meta.bridgedProtocols,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to get group info');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/chat/group/settings
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGroupSettings(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { roomId: string; name?: string; topic?: string; avatarUrl?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.roomId) return badRequest('roomId is required');

  try {
    const lib = await import('../lib/chat-matrix');
    const { resolveMatrixAccount, getRoomMeta } = lib;

    const meta = await getRoomMeta(env, body.roomId);
    if (!meta) return notFound('Room not found');
    if (!meta.admins.includes(session.address.toLowerCase())) {
      return forbidden('Only admins can update group settings');
    }

    const account = await resolveMatrixAccount(env, session.address);

    // Update room name on Matrix
    if (body.name) {
      meta.name = body.name;
      await fetch(
        `${process.env.CONDUIT_URL || 'http://localhost:8448'}/_matrix/client/v3/rooms/${encodeURIComponent(body.roomId)}/state/m.room.name`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${account.accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ name: body.name }),
        },
      );
    }

    if (body.topic !== undefined) {
      meta.topic = body.topic;
    }
    if (body.avatarUrl !== undefined) {
      meta.avatarUrl = body.avatarUrl;
    }

    // Save updated metadata
    (await lib.saveRoomMeta?.(env, body.roomId, meta)) ??
      // Fallback: write directly to KV
      (env.CACHE ?? env.CONTENT_LIBRARY)?.put(
        `matrix:chat:room:meta:${body.roomId}`,
        JSON.stringify(meta),
        { expirationTtl: 86400 * 365 },
      );

    return noCacheJsonResponse({
      ok: true,
      roomId: body.roomId,
      name: meta.name,
      topic: meta.topic,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to update settings');
  }
}
