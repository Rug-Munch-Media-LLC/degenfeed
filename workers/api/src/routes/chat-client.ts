/**
 * /api/chat/client — Unified Chat Client
 *
 * Login with DegenFeed wallet → auto-provisions Matrix account.
 * Sync messages via Matrix /sync API (long-poll for real-time updates).
 * Chat list: all DMs and groups in one feed.
 *
 * POST /api/chat/client/login  — Login wallet → provision Matrix account
 * GET  /api/chat/client/sync   — Matrix /sync (long-poll for new messages)
 * GET  /api/chat/client/rooms  — All rooms (DMs + groups)
 * POST /api/chat/client/logout — Clear Matrix session
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { badRequest, methodNotAllowed, notFound, serverError } from '../response-helpers';
import { requireSession } from '../session';

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/client/login
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClientLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { resolveMatrixAccount } = await import('../lib/chat-matrix');

    // Auto-provision or retrieve existing Matrix account
    const account = await resolveMatrixAccount(env, session.address);

    return jsonResponse(
      {
        ok: true,
        matrixUserId: account.userId,
        accessToken: account.accessToken,
        deviceId: account.deviceId,
        homeserverUrl: process.env.CONDUIT_URL || 'http://localhost:8448',
        encrypted: account.encrypted,
        createdAt: account.createdAt,
        message: 'Matrix client authenticated. Use the access token for direct Matrix API calls.',
      },
      200,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Login failed';
    if (msg.includes('already exists') || msg.includes('409')) {
      return jsonResponse(
        { error: 'Account already exists. Use /api/chat/client/sync to refresh.' },
        409,
      );
    }
    return serverError(msg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/client/sync
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClientSync(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const timeout = Math.min(parseInt(url.searchParams.get('timeout') || '30000', 10), 60000);

  try {
    const { getMatrixAccount, syncMessages } = await import('../lib/chat-matrix');

    const account = await getMatrixAccount(env, session.address);
    if (!account) {
      return jsonResponse(
        {
          ok: false,
          error: 'No Matrix account. Login first with POST /api/chat/client/login',
        },
        401,
      );
    }

    // Long-poll Matrix sync
    const result = await syncMessages(env, session.address, account, timeout);

    // Enrich messages with room metadata
    const enrichedMessages = await enrichMessages(env, result.messages);

    return noCacheJsonResponse({
      ok: true,
      messages: enrichedMessages,
      nextBatch: result.nextBatch,
      hasMore: result.messages.length > 0,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Sync failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/client/rooms
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClientRooms(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getMatrixAccount, getUserRooms } = await import('../lib/chat-matrix');

    const account = await getMatrixAccount(env, session.address);
    if (!account) {
      return jsonResponse(
        {
          ok: false,
          error: 'No Matrix account. Login first with POST /api/chat/client/login',
        },
        401,
      );
    }

    const allRooms = await getUserRooms(env, session.address);

    // Sort: most recent activity first
    const sorted = allRooms.sort((a, b) => b.lastActivity - a.lastActivity);

    return noCacheJsonResponse({
      ok: true,
      matrixUserId: account.userId,
      rooms: sorted.map((r) => ({
        roomId: r.roomId,
        name: r.name,
        type: r.type,
        topic: r.topic,
        memberCount: r.members.length,
        isAdmin: r.admins.includes(session.address.toLowerCase()),
        lastActivity: r.lastActivity,
        createdAt: r.createdAt,
        encrypted: r.encrypted,
      })),
      total: sorted.length,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to get rooms');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/chat/client/logout
// ═══════════════════════════════════════════════════════════════════════════

export async function handleClientLogout(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getMatrixAccount } = await import('../lib/chat-matrix');

    const account = await getMatrixAccount(env, session.address);
    if (account) {
      // Invalidate Matrix access token
      await fetch(
        `${process.env.CONDUIT_URL || 'http://localhost:8448'}/_matrix/client/v3/logout`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${account.accessToken}` },
        },
      ).catch(() => {});

      // Remove from KV
      const kv = env.CACHE ?? env.CONTENT_LIBRARY;
      if (kv) {
        await kv.delete(`matrix:chat:account:${session.address.toLowerCase()}`).catch(() => {});
      }
    }

    return noCacheJsonResponse({
      ok: true,
      message: 'Matrix session terminated. Login again to re-provision.',
    });
  } catch (err) {
    // Even if Conduit logout fails, clear local state
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.delete(`matrix:chat:account:${session.address.toLowerCase()}`).catch(() => {});
    }

    return noCacheJsonResponse({
      ok: true,
      message:
        'Matrix session cleared (token invalidation may have failed, but local state is removed)',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function enrichMessages(
  env: Env,
  messages: Array<{
    eventId: string;
    roomId: string;
    senderId: string;
    body: string;
    msgType: string;
    timestamp: number;
    sourceProtocol: string;
    isBridged: boolean;
    bridgedFrom?: string;
    reactions?: Record<string, number>;
  }>,
): Promise<Array<unknown>> {
  const { getRoomMeta } = await import('../lib/chat-matrix');

  const enriched = [];
  for (const msg of messages) {
    const meta = await getRoomMeta(env, msg.roomId);
    enriched.push({
      ...msg,
      roomName: meta?.name || 'Unknown Room',
      roomType: meta?.type || 'unknown',
    });
  }
  return enriched;
}
