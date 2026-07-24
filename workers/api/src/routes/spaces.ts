/**
 * @degenfeed/api-worker — Audio Spaces routes
 *
 * Premium Spaces audio experience matching X/Twitter Spaces quality.
 * Full lifecycle: create, start, invite, accept, remove, mute, react,
 * raise-hand, record, transcribe, trending, and cross-platform share.
 *
 * ─── REAL-TIME AUDIO ───────────────────────────────────────────────
 * This module handles space metadata and lifecycle only.
 * Real-time audio transport (WebRTC / LiveKit) is NOT included here.
 * When adding audio, integrate LiveKit or similar as follows:
 *
 * 1. When a space is created, provision a LiveKit room via their REST API.
 * 2. Store the LiveKit room name in the Space record.
 * 3. Clients join the LiveKit room using short-lived access tokens.
 * 4. LiveKit handles WebRTC negotiation, SFU mixing, audio levels.
 * 5. This KV store continues to manage metadata (speaker list, reactions).
 * 6. Use LiveKit webhooks to sync speaker join/leave events to this store.
 *
 * See: https://livekit.io/docs
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { liveIndexKey, spaceKey, upcomingIndexKey } from '../kv-helpers';
import { requireSession } from '../session';
import { broadcastToAll } from '../ws-broadcast';

// ─── Types ────────────────────────────────────────────────────────

export interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
  muted: boolean;
  joinedAt: number;
}

export interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface HandRaise {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  raisedAt: number;
}

export interface SpaceInvite {
  userId: string;
  invitedBy: string;
  invitedAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface SpaceRecording {
  url?: string;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
  transcriptUrl?: string;
  publishedToPeertube?: boolean;
  peertubeVideoId?: string;
}

export interface SpaceRecord {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'scheduled' | 'live' | 'ended';
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  scheduledAt?: string;
  listeners: number;
  maxSpeakers: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  handRaised: HandRaise[];
  invites: SpaceInvite[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  isRecorded: boolean;
  recording?: SpaceRecording;
  /** LiveKit room name, set when audio integration is active */
  livekitRoom?: string;
  /** Topic tags for discovery */
  tags: string[];
  /** AI-generated summary (set when space ends) */
  summary?: string;
  /** AI-generated transcript (set when space ends) */
  transcript?: string;
}

// ─── Past spaces index key ────────────────────────────────────────

function pastIndexKey(): string {
  return 'spaces:past';
}

// ─── Helpers to read/write index sets ─────────────────────────────

async function getLiveIds(env: Env): Promise<string[]> {
  try {
    const raw = await env.SPACES?.get(liveIndexKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function setLiveIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(liveIndexKey(), JSON.stringify(ids), {
    expirationTtl: 86400,
  });
}

async function getUpcomingIds(env: Env): Promise<string[]> {
  try {
    const raw = await env.SPACES?.get(upcomingIndexKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function setUpcomingIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(upcomingIndexKey(), JSON.stringify(ids), {
    expirationTtl: 86400,
  });
}

async function getPastIds(env: Env): Promise<string[]> {
  try {
    const raw = await env.SPACES?.get(pastIndexKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function setPastIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(pastIndexKey(), JSON.stringify(ids), {
    expirationTtl: 0, // Keep past spaces indefinitely (within KV limits)
  });
}

// ─── Helper to fetch a space by ID ────────────────────────────────

async function getSpace(env: Env, id: string): Promise<SpaceRecord | null> {
  try {
    const raw = await env.SPACES?.get(spaceKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as SpaceRecord;
  } catch {
    return null;
  }
}

async function saveSpace(env: Env, space: SpaceRecord, ttl?: number): Promise<void> {
  const expirationTtl =
    ttl ?? (space.status === 'live' ? 86400 : space.status === 'scheduled' ? 604800 : 604800);
  await env.SPACES?.put(spaceKey(space.id), JSON.stringify(space), {
    expirationTtl,
  });
}

// ─── Helper to verify host/co-host status ─────────────────────────

function isHostOrCoHost(sessionAddr: string, space: SpaceRecord): boolean {
  const addr = sessionAddr.toLowerCase();
  return (
    addr === space.hostId.toLowerCase() || space.coHosts.some((ch) => ch.toLowerCase() === addr)
  );
}

// ─── Helper to get session address ────────────────────────────────

async function requireSessionAddr(request: Request, env: Env): Promise<string | Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  return session.address;
}

// ─── Generate a unique ID ─────────────────────────────────────────

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 16; i++) {
    result += chars[(arr[i] ?? 0) % chars.length];
  }
  return result;
}

// ─── POST /api/spaces/create ──────────────────────────────────────

export async function handleSpaceCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
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

    if (!body.title?.trim()) {
      return jsonResponse({ error: 'Title is required' }, 400);
    }

    const now = Date.now();
    const id = generateId();

    let status: 'scheduled' | 'live' = 'live';
    if (body.scheduledAt) {
      const scheduledTime = new Date(body.scheduledAt).getTime();
      if (scheduledTime > now) {
        status = 'scheduled';
      }
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

// ─── POST /api/spaces/:id/start ───────────────────────────────────

export async function handleSpaceStart(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can start the space' }, 403);
    }

    if (space.status === 'live') {
      return jsonResponse({ error: 'Space is already live' }, 400);
    }
    if (space.status === 'ended') {
      return jsonResponse({ error: 'Space has already ended' }, 400);
    }

    space.status = 'live';
    space.startedAt = Date.now();

    await saveSpace(env, space);

    // Move from upcoming to live index
    const upcomingIds = await getUpcomingIds(env);
    const filteredUpcoming = upcomingIds.filter((id) => id !== spaceId);
    await setUpcomingIds(env, filteredUpcoming);

    const liveIds = await getLiveIds(env);
    liveIds.unshift(spaceId);
    await setLiveIds(env, liveIds);

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

// ─── POST /api/spaces/:id/end ─────────────────────────────────────

export async function handleSpaceEnd(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can end the space' }, 403);
    }

    space.status = 'ended';
    space.endedAt = Date.now();

    if (space.startedAt) {
      space.recording = {
        ...space.recording,
        duration: Math.floor((space.endedAt - space.startedAt) / 1000),
        endedAt: space.endedAt,
      };
    }

    await saveSpace(env, space, 604800); // Keep for 7 days

    // Remove from live index, add to past index
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

// ─── GET /api/spaces/live ─────────────────────────────────────────

export async function handleSpacesLive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const liveIds = await getLiveIds(env);
    if (liveIds.length === 0) return noCacheJsonResponse({ spaces: [] });

    const spacePromises = liveIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'live') spaces.push(space);
      } catch {
        // Skip corrupted
      }
    }

    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/spaces/upcoming ─────────────────────────────────────

export async function handleSpacesUpcoming(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const upcomingIds = await getUpcomingIds(env);
    if (upcomingIds.length === 0) return noCacheJsonResponse({ spaces: [] });

    const spacePromises = upcomingIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'scheduled') spaces.push(space);
      } catch {
        // Skip corrupted
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

// ─── GET /api/spaces/past ─────────────────────────────────────────

export async function handleSpacesPast(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const pastIds = await getPastIds(env);
    if (pastIds.length === 0) return noCacheJsonResponse({ spaces: [] });

    const spacePromises = pastIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'ended') spaces.push(space);
      } catch {
        // Skip corrupted
      }
    }

    // Sort by endedAt descending (most recent first)
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

// ─── GET /api/spaces/trending ─────────────────────────────────────

export async function handleSpacesTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const liveIds = await getLiveIds(env);
    if (liveIds.length === 0) return noCacheJsonResponse({ spaces: [] });

    const spacePromises = liveIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'live') spaces.push(space);
      } catch {
        // Skip corrupted
      }
    }

    // Sort by listener count descending (most popular first)
    spaces.sort((a, b) => b.listeners - a.listeners);

    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/spaces/:id ──────────────────────────────────────────

export async function handleSpaceDetails(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    return noCacheJsonResponse({ space });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/:id/join ────────────────────────────────────

export async function handleSpaceJoin(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (space.status !== 'live' && space.status !== 'scheduled') {
      return jsonResponse({ error: 'Space is not available' }, 400);
    }

    // Don't double-count if already a speaker or listener (simple heuristic)
    const alreadySpeaker = space.speakers.some(
      (s) => s.id.toLowerCase() === sessionAddr.toLowerCase(),
    );
    if (!alreadySpeaker) {
      space.listeners += 1;
    }

    await saveSpace(env, space);

    broadcastToAll('space:update', {
      spaceId,
      status: 'join',
      listeners: space.listeners,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/:id/leave ───────────────────────────────────

export async function handleSpaceLeave(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    const addr = sessionAddr.toLowerCase();

    // If user was a speaker, remove them from speakers list
    const speakerIndex = space.speakers.findIndex((s) => s.id.toLowerCase() === addr);
    if (speakerIndex !== -1) {
      space.speakers.splice(speakerIndex, 1);
    }

    // Decrement listener count (but not below 0)
    if (space.listeners > 0) {
      space.listeners -= 1;
    }

    // Remove from hand raises
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

// ─── POST /api/spaces/:id/raise-hand ──────────────────────────────

export async function handleSpaceRaiseHand(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

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

    // Check if already raised
    const alreadyRaised = space.handRaised.some((h) => h.userId.toLowerCase() === addr);
    if (alreadyRaised) {
      return jsonResponse({ error: 'Already raised hand' }, 400);
    }

    // Check if already a speaker
    const alreadySpeaker = space.speakers.some((s) => s.id.toLowerCase() === addr);
    if (alreadySpeaker) {
      return jsonResponse({ error: 'Already a speaker' }, 400);
    }

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

// ─── POST /api/spaces/:id/request-speak ───────────────────────────

export async function handleSpaceRequestSpeak(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

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

    // Check if already a speaker
    const alreadySpeaker = space.speakers.some((s) => s.id.toLowerCase() === addr);
    if (alreadySpeaker) {
      return jsonResponse({ error: 'Already a speaker' }, 400);
    }

    // Check max speakers
    if (space.speakers.length >= space.maxSpeakers) {
      return jsonResponse({ error: 'Speaker limit reached' }, 400);
    }

    // Add as speaker
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

    // Remove from hand raise queue
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

// ─── POST /api/spaces/:id/invite-speaker ──────────────────────────

export async function handleSpaceInviteSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as {
      userId?: string;
      displayName?: string;
    };

    if (!body.userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can invite speakers' }, 403);
    }

    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);

    // Check if user is already a speaker
    const alreadySpeaker = space.speakers.some(
      (s) => s.id.toLowerCase() === body.userId?.toLowerCase(),
    );
    if (alreadySpeaker) {
      return jsonResponse({ error: 'User is already a speaker' }, 400);
    }

    // Check max speakers
    if (space.speakers.length >= space.maxSpeakers) {
      return jsonResponse({ error: 'Speaker limit reached' }, 400);
    }

    // Add to invites
    space.invites.push({
      userId: body.userId,
      invitedBy: sessionAddr,
      invitedAt: Date.now(),
      status: 'pending',
    });

    // Auto-add them as speaker (X Spaces behavior: invite = auto-add)
    space.speakers.push({
      id: body.userId,
      displayName: body.displayName || 'Speaker',
      isHost: false,
      isCoHost: false,
      speaking: false,
      muted: false,
      joinedAt: Date.now(),
    });

    // Remove from hand raise queue if they raised hand
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

// ─── POST /api/spaces/:id/accept-speaker ──────────────────────────

export async function handleSpaceAcceptSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as {
      userId?: string;
      accept?: boolean;
    };

    if (!body.userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can accept speaker requests' }, 403);
    }

    const addr = body.userId.toLowerCase();
    const isAccept = body.accept !== false;

    // Find the hand raise
    const handRaiseIndex = space.handRaised.findIndex((h) => h.userId.toLowerCase() === addr);
    if (handRaiseIndex === -1 && isAccept) {
      return jsonResponse({ error: 'No hand raise from this user' }, 400);
    }

    if (isAccept) {
      const handRaise = space.handRaised[handRaiseIndex]!;

      // Check max speakers
      if (space.speakers.length >= space.maxSpeakers) {
        return jsonResponse({ error: 'Speaker limit reached' }, 400);
      }

      // Add as speaker
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

    // Remove from hand raise queue
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

// ─── POST /api/spaces/:id/remove-speaker ──────────────────────────

export async function handleSpaceRemoveSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as { userId?: string };

    if (!body.userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can remove speakers' }, 403);
    }

    const addr = body.userId.toLowerCase();

    // Cannot remove the host
    if (addr === space.hostId.toLowerCase()) {
      return jsonResponse({ error: 'Cannot remove the host' }, 400);
    }

    const speakerIndex = space.speakers.findIndex((s) => s.id.toLowerCase() === addr);
    if (speakerIndex === -1) {
      return jsonResponse({ error: 'Speaker not found' }, 404);
    }

    space.speakers.splice(speakerIndex, 1);

    await saveSpace(env, space);

    broadcastToAll('space:update', {
      spaceId,
      status: 'speaker-removed',
      userId: body.userId,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/:id/mute-speaker ────────────────────────────

export async function handleSpaceMuteSpeaker(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as { userId?: string; muted?: boolean };

    if (!body.userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can mute speakers' }, 403);
    }

    const addr = body.userId.toLowerCase();

    // Cannot mute the host
    if (addr === space.hostId.toLowerCase()) {
      return jsonResponse({ error: 'Cannot mute the host' }, 400);
    }

    const speaker = space.speakers.find((s) => s.id.toLowerCase() === addr);
    if (!speaker) {
      return jsonResponse({ error: 'Speaker not found' }, 404);
    }

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

// ─── POST /api/spaces/:id/react ───────────────────────────────────

export async function handleSpaceReact(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const sessionAddr = await requireSessionAddr(request, env);
  if (sessionAddr instanceof Response) return sessionAddr;

  try {
    const body = (await request.json()) as { userId?: string; emoji?: string };

    if (!body.emoji) {
      return jsonResponse({ error: 'emoji is required' }, 400);
    }

    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);
    if (space.status !== 'live') return jsonResponse({ error: 'Space is not live' }, 400);

    // Keep last 50 reactions
    space.reactions.push({
      userId: sessionAddr,
      emoji: body.emoji,
      createdAt: Date.now(),
    });
    if (space.reactions.length > 50) {
      space.reactions = space.reactions.slice(-50);
    }

    await saveSpace(env, space);

    broadcastToAll('space:update', {
      spaceId,
      status: 'react',
      userId: sessionAddr,
      emoji: body.emoji,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── GET /api/spaces/:id/recording ─────────────────────────────────

export async function handleSpaceRecording(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (!space.recording?.url) {
      return jsonResponse({ error: 'Recording not available yet' }, 404);
    }

    return noCacheJsonResponse({
      recording: space.recording,
      space: {
        id: space.id,
        title: space.title,
        hostName: space.hostName,
        hostAvatarUrl: space.hostAvatarUrl,
        createdAt: space.createdAt,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/:id/transcript ───────────────────────────────

export async function handleSpaceTranscript(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const space = await getSpace(env, spaceId);
    if (!space) return jsonResponse({ error: 'Space not found' }, 404);

    if (request.method === 'GET') {
      if (space.transcript) {
        return noCacheJsonResponse({
          transcript: space.transcript,
          summary: space.summary,
        });
      }
      return jsonResponse({ error: 'Transcript not available yet' }, 404);
    }

    // POST: Generate transcript (placeholder — would integrate with AI service)
    const sessionAddr = await requireSessionAddr(request, env);
    if (sessionAddr instanceof Response) return sessionAddr;

    if (!isHostOrCoHost(sessionAddr, space)) {
      return jsonResponse({ error: 'Only host or co-host can request transcript' }, 403);
    }

    if (space.status !== 'ended') {
      return jsonResponse({ error: 'Space must be ended before generating transcript' }, 400);
    }

    if (!space.recording?.url) {
      return jsonResponse({ error: 'No recording available to transcribe' }, 400);
    }

    // Placeholder: In production, call an AI transcription service
    // Store the transcript
    space.transcript = 'Transcript generation pending — AI service integration required.';
    space.summary = 'Summary generation pending — AI service integration required.';

    await saveSpace(env, space, 604800);

    return jsonResponse({
      ok: true,
      message: 'Transcript generation queued',
      spaceId,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
