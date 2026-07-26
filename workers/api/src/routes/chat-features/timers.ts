/**
 * @degenfeed/api-worker — Conversation Timers (auto-delete)
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

let _chatTimers: typeof import('../../lib/chat-timers') | null = null;

async function getChatTimers() {
  if (!_chatTimers) _chatTimers = await import('../../lib/chat-timers');
  return _chatTimers;
}

/**
 * GET /api/chat/timer/:conversationId — Get conversation auto-delete timer.
 */
export async function handleGetTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getConversationTimer, getTimerDisplayLabel } = await getChatTimers();
    const timer = await getConversationTimer(env, conversationId);
    const label = await getTimerDisplayLabel(env, conversationId);
    return noCacheJsonResponse({ timer, label });
  } catch {
    return jsonResponse({ error: 'Failed to get timer' }, 500);
  }
}

/**
 * POST /api/chat/timer/:conversationId — Set conversation auto-delete timer.
 */
export async function handleSetTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { durationSeconds: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const validDurations = [0, 5, 60, 300, 3600, 86400, 604800, 2592000];
  if (!validDurations.includes(body.durationSeconds)) {
    return jsonResponse(
      { error: 'Invalid duration. Valid: 0, 5, 60, 300, 3600, 86400, 604800, 2592000' },
      400,
    );
  }

  try {
    const { setConversationTimer, removeConversationTimer } = await getChatTimers();
    if (body.durationSeconds === 0) {
      await removeConversationTimer(env, conversationId);
      return noCacheJsonResponse({ ok: true, timer: null });
    }
    const timer = await setConversationTimer(env, conversationId, body.durationSeconds, userId);
    return noCacheJsonResponse({ ok: true, timer });
  } catch {
    return jsonResponse({ error: 'Failed to set timer' }, 500);
  }
}

/**
 * DELETE /api/chat/timer/:conversationId — Remove timer.
 */
export async function handleRemoveTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { removeConversationTimer } = await getChatTimers();
    await removeConversationTimer(env, conversationId);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to remove timer' }, 500);
  }
}
