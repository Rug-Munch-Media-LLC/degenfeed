/**
 * @degenfeed/api-worker — Cross-Platform Unified Room API Routes
 *
 * POST   /api/rooms/unified/create           — Create cross-platform room
 * POST   /api/rooms/unified/:id/join         — Join with protocol preference
 * POST   /api/rooms/unified/:id/leave        — Leave room
 * POST   /api/rooms/unified/:id/message      — Send message (routes to all members)
 * GET    /api/rooms/unified/:id/messages     — Get room messages
 * POST   /api/rooms/unified/:id/invite       — Invite someone
 * GET    /api/rooms/unified/mine             — My rooms
 * PUT    /api/rooms/unified/:id/transport    — Update transport preference
 * GET    /api/rooms/unified/:id              — Get room info
 * GET    /api/rooms/unified/:id/unread       — Get unread counts
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import type { RoomTransport } from '../lib/unified-room';

// ─── POST /api/rooms/unified/create — Create Room ─────────────────────────

export async function handleUnifiedRoomCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    name: string;
    description?: string;
    members?: Array<{
      id: string;
      transport: RoomTransport;
    }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.name?.trim()) {
    return jsonResponse({ error: 'Room name is required' }, 400);
  }

  try {
    const { createUnifiedRoom } = await import('../lib/unified-room');
    const room = await createUnifiedRoom(
      env,
      userId,
      body.name.trim(),
      body.description?.trim() || '',
      body.members?.map((m) => ({
        id: m.id,
        transport: m.transport || 'web',
      })) || [],
    );

    return noCacheJsonResponse({
      ok: true,
      roomId: room.id,
      name: room.name,
      memberCount: room.members.length,
      transports: room.transports,
      createdAt: room.createdAt,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Room creation failed',
    }, 500);
  }
}

// ─── POST /api/rooms/unified/:id/join — Join Room ─────────────────────────

export async function handleUnifiedRoomJoin(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    transport?: RoomTransport;
    nostr?: { npub: string; pubkey: string; relays?: string[] };
    matrix?: { userId: string; homeserver: string };
    farcaster?: { fid: number; username?: string };
    bluesky?: { did: string; handle?: string };
    telegram?: { chatId: string; userId?: string };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const { joinUnifiedRoom } = await import('../lib/unified-room');
    const room = await joinUnifiedRoom(
      env,
      roomId,
      userId,
      body.transport || 'web',
      {
        ...(body.nostr ? { nostr: body.nostr } : {}),
        ...(body.matrix ? { matrix: body.matrix } : {}),
        ...(body.farcaster ? { farcaster: body.farcaster } : {}),
        ...(body.bluesky ? { bluesky: body.bluesky } : {}),
        ...(body.telegram ? { telegram: body.telegram } : {}),
      },
    );

    return noCacheJsonResponse({
      ok: true,
      roomId: room.id,
      memberCount: room.members.length,
      joinedVia: body.transport || 'web',
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to join room',
    }, 500);
  }
}

// ─── POST /api/rooms/unified/:id/leave — Leave Room ───────────────────────

export async function handleUnifiedRoomLeave(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const { leaveUnifiedRoom } = await import('../lib/unified-room');
    await leaveUnifiedRoom(env, roomId, userId);

    return noCacheJsonResponse({ ok: true, left: true });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to leave room',
    }, 500);
  }
}

// ─── POST /api/rooms/unified/:id/message — Send Message ───────────────────

export async function handleUnifiedRoomMessage(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    content: string;
    sourceTransport?: RoomTransport;
    replyTo?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.content?.trim()) {
    return jsonResponse({ error: 'Message content is required' }, 400);
  }

  try {
    const { sendRoomMessage } = await import('../lib/unified-room');

    // Resolve mentions in content before sending
    const msg = await sendRoomMessage(
      env,
      roomId,
      userId,
      body.content.trim(),
      body.sourceTransport || 'web',
      body.replyTo,
    );

    // Summarize delivery status
    const deliverySummary = Object.entries(msg.deliveryStatus).map(([memberId, status]) => ({
      memberId,
      transport: status.transport,
      ok: status.ok,
      error: status.ok ? undefined : status.error,
    }));

    return noCacheJsonResponse({
      ok: true,
      messageId: msg.id,
      createdAt: msg.createdAt,
      mentions: msg.mentions,
      deliveryStatus: deliverySummary,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to send message',
    }, 500);
  }
}

// ─── GET /api/rooms/unified/:id/messages — Get Messages ────────────────────

export async function handleUnifiedRoomMessages(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const { getRoomMessages, isRoomMember } = await import('../lib/unified-room');

    if (!await isRoomMember(env, roomId, userId)) {
      return jsonResponse({ error: 'Not a room member' }, 403);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const before = url.searchParams.get('before')
      ? parseInt(url.searchParams.get('before')!, 10)
      : undefined;

    const messages = await getRoomMessages(env, roomId, limit, before);

    return noCacheJsonResponse({
      messages: messages.reverse(),
      total: messages.length,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to get messages',
    }, 500);
  }
}

// ─── POST /api/rooms/unified/:id/invite — Invite Someone ──────────────────

export async function handleUnifiedRoomInvite(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { target: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.target?.trim()) {
    return jsonResponse({ error: 'Invite target is required' }, 400);
  }

  try {
    const { inviteToRoom } = await import('../lib/unified-room');
    const invite = await inviteToRoom(env, roomId, userId, body.target);

    return noCacheJsonResponse({
      ok: true,
      inviteId: invite.id,
      target: invite.target,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to create invite',
    }, 500);
  }
}

// ─── PUT /api/rooms/unified/:id/transport — Update Transport ──────────────

export async function handleUnifiedRoomTransport(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { transport: RoomTransport };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.transport) {
    return jsonResponse({ error: 'Transport is required' }, 400);
  }

  const validTransports = ['nostr', 'matrix', 'farcaster', 'bluesky', 'telegram', 'web'];
  if (!validTransports.includes(body.transport)) {
    return jsonResponse({ error: `Invalid transport. Must be one of: ${validTransports.join(', ')}` }, 400);
  }

  try {
    const { updateMemberTransport } = await import('../lib/unified-room');
    const room = await updateMemberTransport(env, roomId, userId, body.transport);

    return noCacheJsonResponse({
      ok: true,
      transport: body.transport,
      roomTransports: room.transports,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to update transport',
    }, 500);
  }
}

// ─── GET /api/rooms/unified/mine — My Rooms ──────────────────────────────

export async function handleUnifiedRoomMine(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const { getUserRooms, getUnreadCounts } = await import('../lib/unified-room');
    const rooms = await getUserRooms(env, userId);
    const unread = await getUnreadCounts(env, userId);

    const unreadMap = new Map(unread.map((u) => [u.roomId, u]));

    const roomList = rooms.map((room) => {
      const member = room.members.find((m) => m.id === userId);
      const unreadInfo = unreadMap.get(room.id);
      return {
        id: room.id,
        name: room.name,
        description: room.description,
        memberCount: room.members.length,
        transports: room.transports,
        myTransport: member?.transport || 'web',
        myRole: member?.role || 'member',
        lastActivity: room.lastActivity,
        createdAt: room.createdAt,
        iconUrl: room.iconUrl,
        unreadCount: unreadInfo?.count || 0,
        lastMessagePreview: unreadInfo?.lastMessagePreview,
        lastMessageAt: unreadInfo?.lastMessageAt,
      };
    });

    return noCacheJsonResponse({
      rooms: roomList,
      total: roomList.length,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to get rooms',
    }, 500);
  }
}

// ─── GET /api/rooms/unified/:id — Get Room Info ───────────────────────────

export async function handleUnifiedRoomInfo(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const { getUnifiedRoom, isRoomMember } = await import('../lib/unified-room');

    if (!await isRoomMember(env, roomId, userId)) {
      return jsonResponse({ error: 'Not a room member' }, 403);
    }

    const room = await getUnifiedRoom(env, roomId);
    if (!room) {
      return jsonResponse({ error: 'Room not found' }, 404);
    }

    const myMembership = room.members.find((m) => m.id === userId);
    const memberList = room.members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      transport: m.transport,
      role: m.role,
      joinedAt: m.joinedAt,
      lastActive: m.lastActive,
      identity: {
        nostr: m.identity.nostr ? { npub: m.identity.nostr.npub } : undefined,
        matrix: m.identity.matrix ? { userId: m.identity.matrix.userId } : undefined,
        farcaster: m.identity.farcaster ? { fid: m.identity.farcaster.fid, username: m.identity.farcaster.username } : undefined,
        bluesky: m.identity.bluesky ? { handle: m.identity.bluesky.handle } : undefined,
        telegram: m.identity.telegram ? { chatId: m.identity.telegram.chatId } : undefined,
      },
    }));

    return noCacheJsonResponse({
      id: room.id,
      name: room.name,
      description: room.description,
      creator: room.creator,
      transports: room.transports,
      members: memberList,
      memberCount: room.members.length,
      myTransport: myMembership?.transport || 'web',
      myRole: myMembership?.role || null,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      iconUrl: room.iconUrl,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to get room info',
    }, 500);
  }
}

// ─── GET /api/rooms/unified/:id/unread — Unread Count ─────────────────────

export async function handleUnifiedRoomUnread(request: Request, env: Env, roomId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  try {
    const { getRoomMessages, isRoomMember } = await import('../lib/unified-room');

    if (!await isRoomMember(env, roomId, userId)) {
      return jsonResponse({ error: 'Not a room member' }, 403);
    }

    const messages = await getRoomMessages(env, roomId, 50);
    const unreadCount = messages.filter((m) => m.fromId !== userId).length;
    const lastMsg = messages[messages.length - 1];

    return noCacheJsonResponse({
      roomId,
      unreadCount,
      lastMessagePreview: lastMsg ? lastMsg.content.slice(0, 80) : null,
      lastMessageAt: lastMsg?.createdAt || null,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to get unread count',
    }, 500);
  }
}
