/**
 * /api/chat/dm — Standardized Private Chat (Matrix-Backed)
 *
 * Every DM goes through a Matrix E2E room (Olm/Megolm).
 * Messages bridge to the recipient's preferred protocol automatically.
 *
 * POST   /api/chat/dm/create     — Create DM room with another user
 * POST   /api/chat/dm/send       — Send message to DM room
 * GET    /api/chat/dm/messages    — Get messages from DM room
 * GET    /api/chat/dm/list        — List all DM conversations
 *
 * Identity resolution: any identifier (wallet, npub, handle) → Matrix ID
 * Encryption: E2E via Matrix Olm/Megolm (m.megolm.v1.aes-sha2)
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { badRequest, methodNotAllowed, notFound, serverError } from '../response-helpers';
import { requireSession } from '../session';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/dm/create
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDMCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { recipient: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.recipient?.trim()) {
    return badRequest('recipient wallet/identifier is required');
  }

  if (body.recipient.toLowerCase() === session.address.toLowerCase()) {
    return badRequest('Cannot create DM with yourself');
  }

  try {
    const { resolveMatrixAccount, createDMRoom, resolveBestProtocol } = await import(
      '../lib/chat-matrix'
    );

    // Resolve sender's Matrix account (auto-provision)
    const senderAccount = await resolveMatrixAccount(env, session.address);

    // Resolve recipient's best protocol
    const recipientProtocol = await resolveBestProtocol(env, body.recipient);

    // Create the Matrix DM room with E2EE
    const room = await createDMRoom(env, session.address, body.recipient, senderAccount);

    return noCacheJsonResponse({
      ok: true,
      roomId: room.roomId,
      type: 'dm',
      name: room.name,
      encrypted: room.encrypted,
      recipientProtocol,
      members: room.members,
      createdAt: room.createdAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'DM creation failed';
    if (msg.includes('rate limit') || msg.includes('429')) {
      return jsonResponse({ error: msg }, 429);
    }
    return serverError(msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/dm/send
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDMSend(request: Request, env: Env): Promise<Response> {
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
    const { resolveMatrixAccount, sendRoomMessage } = await import('../lib/chat-matrix');

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
        bridged: message.isBridged,
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Send failed';
    if (msg.includes('rate limit') || msg.includes('429')) {
      return jsonResponse({ error: msg, retryAfter: 5 }, 429);
    }
    return serverError(msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/dm/messages
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDMMessages(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  if (!roomId) {
    return badRequest('roomId query parameter is required');
  }

  try {
    const { resolveMatrixAccount, getRoomMessages } = await import('../lib/chat-matrix');

    const account = await resolveMatrixAccount(env, session.address);
    const messages = await getRoomMessages(env, roomId, account, limit);

    // Filter out messages from self and format
    const formatted = messages.map((m) => ({
      eventId: m.eventId,
      senderId: m.senderId,
      body: m.body,
      msgType: m.msgType,
      timestamp: m.timestamp,
      sourceProtocol: m.sourceProtocol,
      isBridged: m.isBridged,
      bridgedFrom: m.bridgedFrom,
      reactions: m.reactions,
    }));

    return noCacheJsonResponse({
      messages: formatted,
      total: formatted.length,
      roomId,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to get messages');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/dm/list
// ═══════════════════════════════════════════════════════════════════════════

export async function handleDMList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getUserRooms } = await import('../lib/chat-matrix');

    const allRooms = await getUserRooms(env, session.address);
    const dmRooms = allRooms
      .filter((r) => r.type === 'dm')
      .sort((a, b) => b.lastActivity - a.lastActivity);

    const formatted = dmRooms.map((r) => ({
      roomId: r.roomId,
      name: r.name,
      members: r.members,
      lastActivity: r.lastActivity,
      createdAt: r.createdAt,
      encrypted: r.encrypted,
      unreadCount: 0, // Filled by sync
    }));

    return noCacheJsonResponse({
      dms: formatted,
      total: formatted.length,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to list DMs');
  }
}
