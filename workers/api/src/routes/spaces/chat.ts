/**
 * @degenfeed/api-worker — Spaces Chat & Reactions
 *
 * Emoji reactions, recording metadata, and AI transcript/summary.
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import { getSpace, saveSpace, requireSessionAddr, isHostOrCoHost } from './utils';
import { methodNotAllowed } from '../response-helpers';

export async function handleSpaceReact(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; emoji?: string };
    if (!body.emoji) return jsonResponse({ error: 'emoji is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);
    space.reactions.push({ userId: sessionAddr, emoji: body.emoji, createdAt: Date.now() });
    if (space.reactions.length > 50) space.reactions = space.reactions.slice(-50);
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'react', userId: sessionAddr, emoji: body.emoji });
    return jsonResponse({ space, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceRecording(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!space.recording?.url) return jsonResponse({ error: 'Recording not available yet' }, 404);
    return noCacheJsonResponse({
      recording: space.recording,
      space: { id: space.id, title: space.title, hostName: space.hostName, hostAvatarUrl: space.hostAvatarUrl, createdAt: space.createdAt },
    });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceTranscript(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'GET') return methodNotAllowed(['GET', 'POST']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (request.method === 'GET') {
      if (space.transcript) return noCacheJsonResponse({ transcript: space.transcript, summary: space.summary });
      return jsonResponse({ error: 'Transcript not available yet' }, 404);
    }
    const sessionAddr = await requireSessionAddr(request, env);
    if (sessionAddr instanceof Response) return sessionAddr;
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can request transcript' }, 403);
    if (space.status !== 'ended') return jsonResponse({ error: 'Space must be ended before generating transcript' }, 400);
    if (!space.recording?.url) return jsonResponse({ error: 'No recording available to transcribe' }, 400);
    space.transcript = 'Transcript generation pending — AI service integration required.';
    space.summary = 'Summary generation pending — AI service integration required.';
    await saveSpace(env, space, 604800);
    return jsonResponse({ ok: true, message: 'Transcript generation queued', spaceId });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}
