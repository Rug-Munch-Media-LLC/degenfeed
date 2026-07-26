/**
 * @degenfeed/api-worker — Chat Reactions, Edit, Unsend, Delete, Mark Read
 */

import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { requireSession } from '../../session';

let _chatTimers: typeof import('../../lib/chat-timers') | null = null;

async function getChatTimers() {
  if (!_chatTimers) _chatTimers = await import('../../lib/chat-timers');
  return _chatTimers;
}

/**
 * POST /api/messages/react — Toggle reaction on a message.
 */
export async function handleToggleReaction(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { conversationId: string; messageId: string; emoji: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.messageId || !body.emoji) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const reactionKey = `chat:reaction:${body.conversationId}:${body.messageId}:${body.emoji}`;
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return jsonResponse({ error: 'Storage unavailable' }, 503);

  try {
    const existing = await kv.get(reactionKey);
    const voters: string[] = existing ? JSON.parse(existing) : [];
    const idx = voters.indexOf(userId);

    if (idx >= 0) {
      voters.splice(idx, 1);
      if (voters.length === 0) {
        await kv.delete(reactionKey);
      } else {
        await kv.put(reactionKey, JSON.stringify(voters), { expirationTtl: 86400 * 90 });
      }
      return noCacheJsonResponse({
        ok: true,
        reaction: body.emoji,
        active: false,
        count: voters.length,
      });
    } else {
      voters.push(userId);
      await kv.put(reactionKey, JSON.stringify(voters), { expirationTtl: 86400 * 90 });
      return noCacheJsonResponse({
        ok: true,
        reaction: body.emoji,
        active: true,
        count: voters.length,
      });
    }
  } catch {
    return jsonResponse({ error: 'Failed to toggle reaction' }, 500);
  }
}

/**
 * POST /api/messages/edit — Edit a sent message.
 */
export async function handleEditMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { conversationId: string; messageId: string; content: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.content?.trim()) {
    return jsonResponse({ error: 'Missing messageId or content' }, 400);
  }

  try {
    const { editMessage } = await getChatTimers();
    const meta = await editMessage(env, body.messageId, userId, body.content.trim());
    if (!meta) {
      return jsonResponse({ error: 'Message not found or not owned by you' }, 404);
    }
    return noCacheJsonResponse({ ok: true, edited: true, editedAt: meta.editedAt });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Edit failed' }, 400);
  }
}

/**
 * POST /api/messages/unsend — Unsend a message within 5 seconds.
 */
export async function handleUnsendMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string; createdAt: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'Missing messageId or conversationId' }, 400);
  }

  try {
    const { unsendMessage } = await getChatTimers();
    const result = await unsendMessage(
      env,
      body.messageId,
      userId,
      body.conversationId,
      body.createdAt ?? Date.now(),
    );
    if (!result) {
      return jsonResponse({ error: 'Failed to unsend message' }, 500);
    }
    return noCacheJsonResponse({ ok: true, unsent: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unsend failed' }, 400);
  }
}

/**
 * POST /api/messages/delete-for-me — Delete a message for me only.
 */
export async function handleDeleteForMe(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'Missing messageId or conversationId' }, 400);
  }

  try {
    const { deleteForMe } = await getChatTimers();
    await deleteForMe(env, body.messageId, userId, body.conversationId);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to delete message' }, 500);
  }
}

/**
 * POST /api/messages/mark-read/:messageId — Mark message as read (handles disappearing).
 */
export async function handleMarkMessageRead(
  request: Request,
  env: Env,
  messageId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { conversationId: string; timerSeconds?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const { handleDisappearingMessage } = await getChatTimers();
    if (body.timerSeconds) {
      await handleDisappearingMessage(
        env,
        messageId,
        body.conversationId,
        Date.now(),
        body.timerSeconds,
      );
    }
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to mark read' }, 500);
  }
}
