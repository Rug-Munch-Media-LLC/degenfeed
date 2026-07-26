/**
 * @degenfeed/api-worker — Spaces Core (CRUD + listing + cross-protocol + scheduling)
 */

import { spaceKey } from '../../kv-helpers';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import type { SpaceCategory, SpaceRecord, SpaceVisibility } from './types';
import {
  generateId,
  getLiveIds,
  getPastIds,
  getSpace,
  getUpcomingIds,
  isHostOrCoHost,
  requireSessionAddr,
  saveSpace,
  setLiveIds,
  setPastIds,
  setUpcomingIds,
} from './utils';

// ──────────────────────────────────────────────
//  ROOM CREATION
// ──────────────────────────────────────────────

export async function handleSpaceCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      category?: SpaceCategory;
      visibility?: SpaceVisibility;
      coverColor?: string;
      coverUrl?: string;
      hostId?: string;
      hostName?: string;
      hostAvatarUrl?: string;
      coHosts?: string[];
      protocols?: string[];
      scheduledAt?: string;
      tipTokenAddress?: string;
      tippingEnabled?: boolean;
      isRecorded?: boolean;
      maxSpeakers?: number;
      tags?: string[];
    };
    if (!body.title?.trim()) return jsonResponse({ error: 'Title is required' }, 400);
    const now = Date.now();
    const id = generateId();
    let status: 'scheduled' | 'live' = 'live';
    if (body.scheduledAt) {
      const scheduledTime = new Date(body.scheduledAt).getTime();
      if (scheduledTime > now) status = 'scheduled';
    }
    const space: SpaceRecord = {
      id,
      title: body.title.trim(),
      description: body.description?.trim(),
      hostId: sessionAddr,
      hostName: body.hostName || 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [],
      protocols: body.protocols || [],
      status,
      createdAt: now,
      scheduledAt: body.scheduledAt,
      listeners: 1,
      maxSpeakers: body.maxSpeakers ?? 10,
      speakers: [
        {
          id: sessionAddr,
          displayName: body.hostName || 'Host',
          avatarUrl: body.hostAvatarUrl,
          isHost: true,
          isCoHost: false,
          speaking: false,
          muted: false,
          joinedAt: now,
        },
      ],
      reactions: [],
      handRaised: [],
      invites: [],
      tipTokenAddress: body.tipTokenAddress,
      tippingEnabled: body.tippingEnabled ?? true,
      isRecorded: body.isRecorded ?? true,
      recording: undefined,
      tags: body.tags || [],
      category: body.category || 'talk',
      visibility: body.visibility || 'public',
      coverColor: body.coverColor || '#1e1b4b',
      coverUrl: body.coverUrl,
      chatMessages: [],
      pinnedMessages: [],
      chatMutedUsers: [],
      clips: [],
      reminders: [],
    };
    await saveSpace(env, space);
    if (status === 'live') {
      const liveIds = await getLiveIds(env);
      liveIds.unshift(id);
      await setLiveIds(env, liveIds);
    } else {
      const upcomingIds = await getUpcomingIds(env);
      upcomingIds.push(id);
      await setUpcomingIds(env, upcomingIds);
    }
    broadcastToAll('space:update', {
      spaceId: id,
      status: 'created',
      title: space.title,
      hostId: sessionAddr,
      hostName: body.hostName || 'Anonymous',
      createdAt: Date.now(),
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  START / END
// ──────────────────────────────────────────────

export async function handleSpaceStart(
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
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can start the space' }, 403);
    if (space.status === 'live') return jsonResponse({ error: 'Space is already live' }, 400);
    if (space.status === 'ended') return jsonResponse({ error: 'Space has already ended' }, 400);
    space.status = 'live';
    space.startedAt = Date.now();
    await saveSpace(env, space);
    const upcomingIds = await getUpcomingIds(env);
    await setUpcomingIds(
      env,
      upcomingIds.filter((id) => id !== spaceId),
    );
    const liveIds = await getLiveIds(env);
    liveIds.unshift(spaceId);
    await setLiveIds(env, liveIds);

    // Notify all followers who set reminders
    for (const reminder of space.reminders || []) {
      broadcastToAll('space:update', {
        spaceId,
        status: 'space-started-notification',
        title: space.title,
        hostName: space.hostName,
        userId: reminder.userId,
      });
    }

    broadcastToAll('space:update', {
      spaceId,
      status: 'started',
      title: space.title,
      hostId: space.hostId,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceEnd(
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
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can end the space' }, 403);
    space.status = 'ended';
    space.endedAt = Date.now();
    if (space.startedAt) {
      space.recording = {
        ...space.recording,
        duration: Math.floor((space.endedAt - space.startedAt) / 1000),
        endedAt: space.endedAt,
      };
    }
    await saveSpace(env, space, 604800);
    const liveIds = await getLiveIds(env);
    await setLiveIds(
      env,
      liveIds.filter((id) => id !== spaceId),
    );
    const pastIds = await getPastIds(env);
    pastIds.unshift(spaceId);
    await setPastIds(env, pastIds);
    broadcastToAll('space:update', {
      spaceId,
      status: 'ended',
      hostId: space.hostId,
      title: space.title,
      duration: space.recording?.duration,
    });
    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  SPACE DETAILS
// ──────────────────────────────────────────────

export async function handleSpaceDetails(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    return noCacheJsonResponse({ space });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  LISTING: LIVE / UPCOMING / PAST / TRENDING
// ──────────────────────────────────────────────

export async function handleSpacesLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const liveIds = await getLiveIds(env);
    if (liveIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(liveIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'live') spaces.push(space);
      } catch {
        /* skip */
      }
    }
    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpacesUpcoming(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const upcomingIds = await getUpcomingIds(env);
    if (upcomingIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(upcomingIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'scheduled') spaces.push(space);
      } catch {
        /* skip */
      }
    }
    spaces.sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpacesPast(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const pastIds = await getPastIds(env);
    if (pastIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(pastIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'ended') spaces.push(space);
      } catch {
        /* skip */
      }
    }
    spaces.sort((a, b) => {
      const aTime = a.endedAt ?? a.createdAt;
      const bTime = b.endedAt ?? b.createdAt;
      return bTime - aTime;
    });
    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpacesTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const liveIds = await getLiveIds(env);
    const upcomingIds = await getUpcomingIds(env);
    const pastIds = await getPastIds(env);
    const allIds = [...liveIds, ...upcomingIds, ...pastIds].slice(0, 50);
    if (allIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(allIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        spaces.push(JSON.parse(raw) as SpaceRecord);
      } catch {
        /* skip */
      }
    }
    // Score: live spaces get highest, then by listeners * 2 + engagement
    spaces.sort((a, b) => {
      const aScore =
        (a.status === 'live' ? 10000 : a.status === 'scheduled' ? 5000 : 0) + a.listeners * 2;
      const bScore =
        (b.status === 'live' ? 10000 : b.status === 'scheduled' ? 5000 : 0) + b.listeners * 2;
      return bScore - aScore;
    });
    return noCacheJsonResponse({ spaces: spaces.slice(0, 30) });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  SCHEDULING: SET REMINDER
// ──────────────────────────────────────────────

export async function handleSpaceSetReminder(
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
    if (!space.reminders) space.reminders = [];
    const already = space.reminders.some(
      (r) => r.userId.toLowerCase() === sessionAddr.toLowerCase(),
    );
    if (already) return jsonResponse({ error: 'Reminder already set' }, 400);
    space.reminders.push({ userId: sessionAddr, spaceId, reminded: false });
    await saveSpace(env, space);
    return jsonResponse({ ok: true, message: 'Reminder set' });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  CROSS-PROTOCOL: Set Nostr / Farcaster IDs
// ──────────────────────────────────────────────

export async function handleSpaceSetNostrEvent(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { nostrEventId?: string };
    if (!body.nostrEventId) return jsonResponse({ error: 'nostrEventId is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can set Nostr event' }, 403);
    space.nostrEventId = body.nostrEventId;
    await saveSpace(env, space);
    return jsonResponse({ ok: true, nostrEventId: space.nostrEventId });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleSpaceSetFarcasterCast(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as { farcasterCastHash?: string };
    if (!body.farcasterCastHash)
      return jsonResponse({ error: 'farcasterCastHash is required' }, 400);
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space))
      return jsonResponse({ error: 'Only host or co-host can set Farcaster cast' }, 403);
    space.farcasterCastHash = body.farcasterCastHash;
    await saveSpace(env, space);
    return jsonResponse({ ok: true, farcasterCastHash: space.farcasterCastHash });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ──────────────────────────────────────────────
//  ROOM DISCOVERY: categories
// ──────────────────────────────────────────────

export async function handleSpacesByCategory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || '';
    const liveIds = await getLiveIds(env);
    const upcomingIds = await getUpcomingIds(env);
    const pastIds = await getPastIds(env);
    const allIds = [...liveIds, ...upcomingIds, ...pastIds];
    if (allIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(allIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const s = JSON.parse(raw) as SpaceRecord;
        if (!category || s.category === category) spaces.push(s);
      } catch {
        /* skip */
      }
    }
    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
