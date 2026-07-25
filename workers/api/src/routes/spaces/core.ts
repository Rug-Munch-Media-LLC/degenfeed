/**
 * @degenfeed/api-worker — Spaces Core (CRUD + listing)
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { broadcastToAll } from '../ws-broadcast';
import type { SpaceRecord } from './types';
import { getSpace, saveSpace, generateId, requireSessionAddr, getLiveIds, setLiveIds, getUpcomingIds, setUpcomingIds, getPastIds, setPastIds } from './utils';

export async function handleSpaceCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const body = (await request.json()) as {
      title?: string; description?: string; hostId?: string; hostName?: string;
      hostAvatarUrl?: string; coHosts?: string[]; protocols?: string[]; scheduledAt?: string;
      tipTokenAddress?: string; tippingEnabled?: boolean; isRecorded?: boolean;
      maxSpeakers?: number; tags?: string[];
    };
    if (!body.title?.trim()) return jsonResponse({ error: 'Title is required' }, 400);
    const now = Date.now();
    const id = generateId();
    let status: 'scheduled' | 'live' = 'live';
    if (body.scheduledAt) { const scheduledTime = new Date(body.scheduledAt).getTime(); if (scheduledTime > now) status = 'scheduled'; }
    const space: SpaceRecord = {
      id, title: body.title.trim(), description: body.description?.trim(), hostId: sessionAddr,
      hostName: body.hostName || 'Anonymous', hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [], protocols: body.protocols || [], status, createdAt: now,
      scheduledAt: body.scheduledAt, listeners: 1, maxSpeakers: body.maxSpeakers ?? 10,
      speakers: [{ id: sessionAddr, displayName: body.hostName || 'Host', avatarUrl: body.hostAvatarUrl, isHost: true, isCoHost: false, speaking: false, muted: false, joinedAt: now }],
      reactions: [], handRaised: [], invites: [], tipTokenAddress: body.tipTokenAddress,
      tippingEnabled: body.tippingEnabled ?? true, isRecorded: body.isRecorded ?? true,
      recording: undefined, tags: body.tags || [],
    };
    await saveSpace(env, space);
    if (status === 'live') { const liveIds = await getLiveIds(env); liveIds.unshift(id); await setLiveIds(env, liveIds); }
    else { const upcomingIds = await getUpcomingIds(env); upcomingIds.push(id); await setUpcomingIds(env, upcomingIds); }
    broadcastToAll('space:update', { spaceId: id, status: 'created', title: space.title, hostId: sessionAddr, hostName: body.hostName || 'Anonymous', createdAt: Date.now() });
    return jsonResponse({ space, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceStart(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can start the space' }, 403);
    if (space.status === 'live') return jsonResponse({ error: 'Space is already live' }, 400);
    if (space.status === 'ended') return jsonResponse({ error: 'Space has already ended' }, 400);
    space.status = 'live'; space.startedAt = Date.now();
    await saveSpace(env, space);
    const upcomingIds = await getUpcomingIds(env);
    await setUpcomingIds(env, upcomingIds.filter((id) => id !== spaceId));
    const liveIds = await getLiveIds(env); liveIds.unshift(spaceId); await setLiveIds(env, liveIds);
    broadcastToAll('space:update', { spaceId, status: 'started', title: space.title, hostId: space.hostId });
    return jsonResponse({ space, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceEnd(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;
  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (!isHostOrCoHost(sessionAddr, space)) return jsonResponse({ error: 'Only host or co-host can end the space' }, 403);
    space.status = 'ended'; space.endedAt = Date.now();
    if (space.startedAt) { space.recording = { ...space.recording, duration: Math.floor((space.endedAt - space.startedAt) / 1000), endedAt: space.endedAt }; }
    await saveSpace(env, space, 604800);
    const liveIds = await getLiveIds(env);
    await setLiveIds(env, liveIds.filter((id) => id !== spaceId));
    const pastIds = await getPastIds(env); pastIds.unshift(spaceId); await setPastIds(env, pastIds);
    broadcastToAll('space:update', { spaceId, status: 'ended', hostId: space.hostId, title: space.title, duration: space.recording?.duration });
    return jsonResponse({ space, ok: true });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpaceDetails(request: Request, env: Env, spaceId: string): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  try { const space = await getSpace(env, spaceId); if (!space) return jsonResponse({ error: 'Space not found' }, 404); return noCacheJsonResponse({ space }); }
  catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpacesLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const liveIds = await getLiveIds(env);
    if (liveIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(liveIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) { if (!raw) continue; try { const space = JSON.parse(raw) as SpaceRecord; if (space.status === 'live') spaces.push(space); } catch { /* skip */ } }
    return noCacheJsonResponse({ spaces });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpacesUpcoming(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const upcomingIds = await getUpcomingIds(env);
    if (upcomingIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(upcomingIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) { if (!raw) continue; try { const space = JSON.parse(raw) as SpaceRecord; if (space.status === 'scheduled') spaces.push(space); } catch { /* skip */ } }
    spaces.sort((a, b) => { if (!a.scheduledAt || !b.scheduledAt) return 0; return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(); });
    return noCacheJsonResponse({ spaces });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpacesPast(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const pastIds = await getPastIds(env);
    if (pastIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(pastIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) { if (!raw) continue; try { const space = JSON.parse(raw) as SpaceRecord; if (space.status === 'ended') spaces.push(space); } catch { /* skip */ } }
    spaces.sort((a, b) => { const aTime = a.endedAt ?? a.createdAt; const bTime = b.endedAt ?? b.createdAt; return bTime - aTime; });
    return noCacheJsonResponse({ spaces });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}

export async function handleSpacesTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const liveIds = await getLiveIds(env);
    if (liveIds.length === 0) return noCacheJsonResponse({ spaces: [] });
    const spaceResults = await Promise.all(liveIds.map((id) => env.SPACES?.get(spaceKey(id))));
    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) { if (!raw) continue; try { const space = JSON.parse(raw) as SpaceRecord; if (space.status === 'live') spaces.push(space); } catch { /* skip */ } }
    spaces.sort((a, b) => b.listeners - a.listeners);
    return noCacheJsonResponse({ spaces });
  } catch (e) { return jsonResponse({ error: String(e) }, 500); }
}


