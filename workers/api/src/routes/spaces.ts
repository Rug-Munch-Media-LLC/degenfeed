/**
 * @degenfeed/api-worker — Audio Spaces routes
 *
 * Manages live audio room lifecycle using KV storage.
 * POST /api/spaces/create    — Create a space (stores in KV)
 * GET  /api/spaces/live      — List live spaces
 * GET  /api/spaces/upcoming  — List scheduled spaces
 * POST /api/spaces/{id}/join — Join a space
 * POST /api/spaces/{id}/request-speak — Request to speak
 * POST /api/spaces/{id}/react — Send an emoji reaction
 * POST /api/spaces/{id}/end  — End a live space
 *
 * ─── REAL-TIME AUDIO NOTE ─────────────────────────────────────────
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
import { broadcastToAll } from '../ws-broadcast';

// ─── Types ────────────────────────────────────────────────────────

interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
}

interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

interface SpaceRecord {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'live' | 'scheduled' | 'ended';
  createdAt: number;
  scheduledAt?: string;
  listeners: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  /** LiveKit room name, set when audio integration is active */
  livekitRoom?: string;
}

import { liveIndexKey, spaceKey, upcomingIndexKey } from '../kv-helpers';

// ─── Generate a unique ID ─────────────────────────────────────────

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 16; i++) {
    result += chars[(arr[i] ?? 0) % chars.length]!;
  }
  return result;
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
    expirationTtl: 86400, // 24h TTL
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

// ─── POST /api/spaces/create ──────────────────────────────────────

export async function handleSpaceCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    interface CreateRequest {
      title?: string;
      description?: string;
      hostId?: string;
      hostName?: string;
      hostAvatarUrl?: string;
      coHosts?: string[];
      protocols?: string[];
      scheduledAt?: string; // ISO string for scheduled spaces
      tipTokenAddress?: string;
      tippingEnabled?: boolean;
    }

    const body: CreateRequest = (await request.json()) as CreateRequest;

    if (!body.title?.trim()) {
      return jsonResponse({ error: 'Title is required' }, 400);
    }
    if (!body.hostId) {
      return jsonResponse({ error: 'hostId is required' }, 400);
    }

    const now = Date.now();
    const id = generateId();

    // Determine status: if scheduledAt is in the future → 'scheduled', else 'live'
    let status: 'live' | 'scheduled' = 'live';
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
      hostId: body.hostId,
      hostName: body.hostName || 'Anonymous',
      hostAvatarUrl: body.hostAvatarUrl,
      coHosts: body.coHosts || [],
      protocols: body.protocols || [],
      status,
      createdAt: now,
      scheduledAt: body.scheduledAt,
      listeners: 1, // Host is the first listener
      speakers: [
        {
          id: body.hostId,
          displayName: body.hostName || 'Host',
          avatarUrl: body.hostAvatarUrl,
          isHost: true,
          isCoHost: false,
          speaking: false,
        },
      ],
      reactions: [],
      tipTokenAddress: body.tipTokenAddress,
      tippingEnabled: body.tippingEnabled ?? true,
    };

    // Store space record
    await env.SPACES?.put(spaceKey(id), JSON.stringify(space), {
      expirationTtl: status === 'live' ? 86400 : 604800, // 24h live, 7d scheduled
    });

    // Update index
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
      hostId: body.hostId,
      hostName: body.hostName || 'Anonymous',
      createdAt: Date.now(),
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

    if (liveIds.length === 0) {
      return noCacheJsonResponse({ spaces: [] });
    }

    // Fetch all live spaces in parallel
    const spacePromises = liveIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'live') {
          spaces.push(space);
        }
      } catch {
        // Skip corrupted entries
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

    if (upcomingIds.length === 0) {
      return noCacheJsonResponse({ spaces: [] });
    }

    const spacePromises = upcomingIds.map((id) => env.SPACES?.get(spaceKey(id)));
    const spaceResults = await Promise.all(spacePromises);

    const spaces: SpaceRecord[] = [];
    for (const raw of spaceResults) {
      if (!raw) continue;
      try {
        const space = JSON.parse(raw) as SpaceRecord;
        if (space.status === 'scheduled') {
          spaces.push(space);
        }
      } catch {
        // Skip corrupted entries
      }
    }

    // Sort by scheduledAt ascending
    spaces.sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

    return noCacheJsonResponse({ spaces });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/{id}/join ───────────────────────────────────

export async function handleSpaceJoin(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const raw = await env.SPACES?.get(spaceKey(spaceId));
    if (!raw) return jsonResponse({ error: 'Space not found' }, 404);

    const space = JSON.parse(raw) as SpaceRecord;
    if (space.status !== 'live') {
      return jsonResponse({ error: 'Space is not live' }, 400);
    }

    // Increment listener count
    space.listeners += 1;

    await env.SPACES?.put(spaceKey(spaceId), JSON.stringify(space), {
      expirationTtl: 86400,
    });

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

// ─── POST /api/spaces/{id}/request-speak ──────────────────────────

export async function handleSpaceRequestSpeak(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    interface SpeakRequest {
      userId?: string;
      displayName?: string;
      avatarUrl?: string;
      handle?: string;
    }

    const body: SpeakRequest = (await request.json()) as SpeakRequest;
    if (!body.userId) {
      return jsonResponse({ error: 'userId is required' }, 400);
    }

    const raw = await env.SPACES?.get(spaceKey(spaceId));
    if (!raw) return jsonResponse({ error: 'Space not found' }, 404);

    const space = JSON.parse(raw) as SpaceRecord;
    if (space.status !== 'live') {
      return jsonResponse({ error: 'Space is not live' }, 400);
    }

    // Check if already a speaker
    const alreadySpeaker = space.speakers.some((s) => s.id === body.userId);
    if (alreadySpeaker) {
      return jsonResponse({ error: 'Already a speaker' }, 400);
    }

    // Add as speaker
    space.speakers.push({
      id: body.userId,
      displayName: body.displayName || 'Speaker',
      avatarUrl: body.avatarUrl,
      handle: body.handle,
      isHost: false,
      isCoHost: false,
      speaking: false,
    });

    await env.SPACES?.put(spaceKey(spaceId), JSON.stringify(space), {
      expirationTtl: 86400,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/{id}/react ──────────────────────────────────

export async function handleSpaceReact(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    interface ReactRequest {
      userId?: string;
      emoji?: string;
    }

    const body: ReactRequest = (await request.json()) as ReactRequest;
    if (!body.userId || !body.emoji) {
      return jsonResponse({ error: 'userId and emoji are required' }, 400);
    }

    const raw = await env.SPACES?.get(spaceKey(spaceId));
    if (!raw) return jsonResponse({ error: 'Space not found' }, 404);

    const space = JSON.parse(raw) as SpaceRecord;
    if (space.status !== 'live') {
      return jsonResponse({ error: 'Space is not live' }, 400);
    }

    // Keep last 50 reactions
    space.reactions.push({
      userId: body.userId,
      emoji: body.emoji,
      createdAt: Date.now(),
    });
    if (space.reactions.length > 50) {
      space.reactions = space.reactions.slice(-50);
    }

    await env.SPACES?.put(spaceKey(spaceId), JSON.stringify(space), {
      expirationTtl: 86400,
    });

    broadcastToAll('space:update', {
      spaceId,
      status: 'react',
      userId: body.userId,
      emoji: body.emoji,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── POST /api/spaces/{id}/end ────────────────────────────────────

export async function handleSpaceEnd(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    interface EndRequest {
      hostId?: string;
    }

    const body: EndRequest = (await request.json()) as EndRequest;

    const raw = await env.SPACES?.get(spaceKey(spaceId));
    if (!raw) return jsonResponse({ error: 'Space not found' }, 404);

    const space = JSON.parse(raw) as SpaceRecord;

    // Only host or co-host can end
    if (body.hostId && body.hostId !== space.hostId && !space.coHosts.includes(body.hostId)) {
      return jsonResponse({ error: 'Only host or co-host can end the space' }, 403);
    }

    space.status = 'ended';

    await env.SPACES?.put(spaceKey(spaceId), JSON.stringify(space), {
      expirationTtl: 604800, // Keep for 7 days after ending
    });

    // Remove from live index
    const liveIds = await getLiveIds(env);
    const filtered = liveIds.filter((id) => id !== spaceId);
    await setLiveIds(env, filtered);

    broadcastToAll('space:update', {
      spaceId,
      status: 'ended',
      hostId: space.hostId,
      title: space.title,
    });

    return jsonResponse({ space, ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
