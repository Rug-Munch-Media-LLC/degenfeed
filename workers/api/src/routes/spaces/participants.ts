/**
 * @degenfeed/api-worker — Spaces Participants
 *
 * Join/leave, speaker management (add/remove), hand raises, invites, muting.
 */

import type { Env } from '../../index';
import { jsonResponse } from '../../index';
import { methodNotAllowed } from '../../response-helpers';
import { broadcastToAll } from '../../ws-broadcast';
import { getSpace, isHostOrCoHost, requireSessionAddr, saveSpace } from './utils';

export async function handleSpaceJoin(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live' && space.status !== 'scheduled')
      return jsonResponse({ error: 'Space is not available' }, 400);
    const alreadySpeaker = space.speakers.some(
      (s) => s.id.toLowerCase() === sessionAddr.toLowerCase(),
    );
    if (!alreadySpeaker) space.listeners += 1;
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'join', listeners: space.listeners });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceLeave(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    const addr = sessionAddr.toLowerCase();
    const speakerIndex = space.speakers.findIndex((s) => s.id.toLowerCase() === addr);
    if (speakerIndex !== -1) space.speakers.splice(speakerIndex, 1);
    if (space.listeners > 0) space.listeners -= 1;
    space.handRaised = space.handRaised.filter((h) => h.userId.toLowerCase() !== addr);
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: 'leave',
      listeners: space.listeners,
      userId: sessionAddr,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceRaiseHand(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      displayName?: string;
      avatarUrl?: string;
      handle?: string;
    };
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);
    const addr = sessionAddr.toLowerCase();
    if (space.handRaised.some((h) => h.userId.toLowerCase() === addr))
      return jsonResponse({ error: 'Already raised hand' }, 400);
    if (space.speakers.some((s) => s.id.toLowerCase() === addr))
      return jsonResponse({ error: 'Already a speaker' }, 400);
    space.handRaised.push({
      userId: sessionAddr,
      displayName: body.displayName || 'Listener',
      avatarUrl: body.avatarUrl,
      handle: body.handle,
      raisedAt: Date.now(),
    });
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: 'raise-hand',
      userId: sessionAddr,
      displayName: body.displayName || 'Listener',
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceRequestSpeak(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
      avatarUrl?: string;
      handle?: string;
    };
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);
    const addr = sessionAddr.toLowerCase();
    if (space.speakers.some((s) => s.id.toLowerCase() === addr))
      return jsonResponse({ error: 'Already a speaker' }, 400);
    if (space.speakers.length >= space.maxSpeakers)
      return jsonResponse({ error: 'Speaker limit reached' }, 400);
    space.speakers.push({
      id: sessionAddr,
      displayName: body.displayName || 'Speaker',
      avatarUrl: body.avatarUrl,
      handle: body.handle,
      isHost: false,
      isCoHost: false,
      speaking: false,
      muted: false,
      joinedAt: Date.now(),
    });
    space.handRaised = space.handRaised.filter((h) => h.userId.toLowerCase() !== addr);
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: 'speaker-added',
      userId: sessionAddr,
      displayName: body.displayName || 'Speaker',
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ── SPEAKERS: ADD (alias for request-speak, used by host to add someone) ──

export async function handleSpaceSpeakersAdd(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
      avatarUrl?: string;
      handle?: string;
    };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can add speakers' }, 403);
    if (space.speakers.some((s) => s.id.toLowerCase() === body.userId?.toLowerCase())) {
      return jsonResponse({ error: 'User is already a speaker' }, 400);
    }
    if (space.speakers.length >= space.maxSpeakers)
      return jsonResponse({ error: 'Speaker limit reached' }, 400);
    space.speakers.push({
      id: body.userId,
      displayName: body.displayName || 'Speaker',
      avatarUrl: body.avatarUrl,
      handle: body.handle,
      isHost: false,
      isCoHost: false,
      speaking: false,
      muted: false,
      joinedAt: Date.now(),
    });
    space.handRaised = space.handRaised.filter(
      (h) => h.userId.toLowerCase() !== body.userId?.toLowerCase(),
    );
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: 'speaker-added',
      userId: body.userId,
      displayName: body.displayName || 'Speaker',
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ── SPEAKERS: REMOVE ──

export async function handleSpaceSpeakersRemove(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can remove speakers' }, 403);
    const addr = body.userId.toLowerCase();
    if (addr === space.hostId.toLowerCase())
      return jsonResponse({ error: 'Cannot remove the host' }, 400);
    const speakerIndex = space.speakers.findIndex((s) => s.id.toLowerCase() === addr);
    if (speakerIndex === -1) return jsonResponse({ error: 'Speaker not found' }, 404);
    space.speakers.splice(speakerIndex, 1);
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'speaker-removed', userId: body.userId });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceInviteSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; displayName?: string };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can invite speakers' }, 403);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);
    if (space.speakers.some((s) => s.id.toLowerCase() === body.userId?.toLowerCase()))
      return jsonResponse({ error: 'User is already a speaker' }, 400);
    if (space.speakers.length >= space.maxSpeakers)
      return jsonResponse({ error: 'Speaker limit reached' }, 400);
    space.invites.push({
      userId: body.userId,
      invitedBy: sessionAddr,
      invitedAt: Date.now(),
      status: 'pending',
    });
    space.speakers.push({
      id: body.userId,
      displayName: body.displayName || 'Speaker',
      isHost: false,
      isCoHost: false,
      speaking: false,
      muted: false,
      joinedAt: Date.now(),
    });
    space.handRaised = space.handRaised.filter(
      (h) => h.userId.toLowerCase() !== body.userId?.toLowerCase(),
    );
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: 'speaker-invited',
      userId: body.userId,
      invitedBy: sessionAddr,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceAcceptSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; accept?: boolean };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can accept speaker requests' }, 403);
    const addr = body.userId.toLowerCase();
    const isAccept = body.accept !== false;
    const handRaiseIndex = space.handRaised.findIndex((h) => h.userId.toLowerCase() === addr);
    if (handRaiseIndex === -1 && isAccept)
      return jsonResponse({ error: 'No hand raise from this user' }, 400);
    if (isAccept) {
      const handRaise = space.handRaised[handRaiseIndex]!;
      if (space.speakers.length >= space.maxSpeakers)
        return jsonResponse({ error: 'Speaker limit reached' }, 400);
      space.speakers.push({
        id: handRaise.userId,
        displayName: handRaise.displayName,
        avatarUrl: handRaise.avatarUrl,
        handle: handRaise.handle,
        isHost: false,
        isCoHost: false,
        speaking: false,
        muted: false,
        joinedAt: Date.now(),
      });
    }
    space.handRaised.splice(handRaiseIndex, 1);
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: isAccept ? 'speaker-accepted' : 'speaker-declined',
      userId: body.userId,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceRemoveSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can remove speakers' }, 403);
    const addr = body.userId.toLowerCase();
    if (addr === space.hostId.toLowerCase())
      return jsonResponse({ error: 'Cannot remove the host' }, 400);
    const speakerIndex = space.speakers.findIndex((s) => s.id.toLowerCase() === addr);
    if (speakerIndex === -1) return jsonResponse({ error: 'Speaker not found' }, 404);
    space.speakers.splice(speakerIndex, 1);
    await saveSpace(env, space);
    broadcastToAll('space:update', { spaceId, status: 'speaker-removed', userId: body.userId });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceMuteSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { userId?: string; muted?: boolean };
    if (!body.userId) return jsonResponse({ error: 'userId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can mute speakers' }, 403);
    const addr = body.userId.toLowerCase();
    if (addr === space.hostId.toLowerCase())
      return jsonResponse({ error: 'Cannot mute the host' }, 400);
    const speaker = space.speakers.find((s) => s.id.toLowerCase() === addr);
    if (!speaker) return jsonResponse({ error: 'Speaker not found' }, 404);
    speaker.muted = body.muted ?? true;
    speaker.speaking = false;
    await saveSpace(env, space);
    broadcastToAll('space:update', {
      spaceId,
      status: body.muted ? 'speaker-muted' : 'speaker-unmuted',
      userId: body.userId,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
