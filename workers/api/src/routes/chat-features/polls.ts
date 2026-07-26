/**
 * @degenfeed/api-worker — Chat Polls
 */

import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { requireSession } from '../../session';

let _chatMedia: typeof import('../../lib/chat-media') | null = null;

async function getChatMedia() {
  if (!_chatMedia) _chatMedia = await import('../../lib/chat-media');
  return _chatMedia;
}

/**
 * POST /api/chat/polls/create — Create a poll.
 */
export async function handleCreatePoll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: {
    conversationId: string;
    question: string;
    options: string[];
    multipleChoice?: boolean;
    endsAt?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.question || !body.options || body.options.length < 2) {
    return jsonResponse({ error: 'question and at least 2 options required' }, 400);
  }

  try {
    const { createPoll } = await getChatMedia();
    const endsInMinutes = body.endsAt ? Math.ceil((body.endsAt - Date.now()) / 60000) : undefined;
    const poll = await createPoll(
      env,
      body.conversationId,
      userId,
      body.question,
      body.options,
      body.multipleChoice ?? false,
      endsInMinutes,
    );
    return noCacheJsonResponse({ ok: true, poll });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Poll creation failed' },
      400,
    );
  }
}

/**
 * POST /api/chat/polls/vote — Vote on a poll.
 */
export async function handleVotePoll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { pollId: string; optionIds: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.pollId || !body.optionIds?.length) {
    return jsonResponse({ error: 'pollId and optionIds required' }, 400);
  }

  try {
    const { votePoll } = await getChatMedia();
    const poll = await votePoll(env, body.pollId, userId, body.optionIds);
    if (!poll) return jsonResponse({ error: 'Poll not found' }, 404);
    return noCacheJsonResponse({ ok: true, poll });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Vote failed' }, 400);
  }
}

/**
 * GET /api/chat/polls/:pollId — Get poll.
 */
export async function handleGetPoll(
  _request: Request,
  env: Env,
  pollId: string,
): Promise<Response> {
  try {
    const { getPoll } = await getChatMedia();
    const poll = await getPoll(env, pollId);
    if (!poll) return jsonResponse({ error: 'Poll not found' }, 404);
    return noCacheJsonResponse({ poll });
  } catch {
    return jsonResponse({ error: 'Failed to get poll' }, 500);
  }
}
