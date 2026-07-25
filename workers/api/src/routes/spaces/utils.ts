/**
 * @degenfeed/api-worker — Spaces Utils
 */

import type { Env } from '../index';
import { liveIndexKey, spaceKey, upcomingIndexKey } from '../kv-helpers';
import { requireSession } from '../session';
import type { SpaceRecord, SpaceChatMessage } from './types';

function pastIndexKey(): string { return 'spaces:past'; }
function chatIndexKey(spaceId: string): string { return `spaces:chat:${spaceId}`; }

async function getLiveIds(env: Env): Promise<string[]> {
  try { const raw = await env.SPACES?.get(liveIndexKey()); return raw ? (JSON.parse(raw) as string[]) : []; }
  catch { return []; }
}

async function setLiveIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(liveIndexKey(), JSON.stringify(ids), { expirationTtl: 86400 });
}

async function getUpcomingIds(env: Env): Promise<string[]> {
  try { const raw = await env.SPACES?.get(upcomingIndexKey()); return raw ? (JSON.parse(raw) as string[]) : []; }
  catch { return []; }
}

async function setUpcomingIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(upcomingIndexKey(), JSON.stringify(ids), { expirationTtl: 86400 });
}

async function getPastIds(env: Env): Promise<string[]> {
  try { const raw = await env.SPACES?.get(pastIndexKey()); return raw ? (JSON.parse(raw) as string[]) : []; }
  catch { return []; }
}

async function setPastIds(env: Env, ids: string[]): Promise<void> {
  await env.SPACES?.put(pastIndexKey(), JSON.stringify(ids), { expirationTtl: 0 });
}

export async function getSpace(env: Env, id: string): Promise<SpaceRecord | null> {
  try { const raw = await env.SPACES?.get(spaceKey(id)); return raw ? JSON.parse(raw) as SpaceRecord : null; }
  catch { return null; }
}

export async function saveSpace(env: Env, space: SpaceRecord, ttl?: number): Promise<void> {
  const expirationTtl = ttl ?? (space.status === 'live' ? 86400 : space.status === 'scheduled' ? 604800 : 604800);
  await env.SPACES?.put(spaceKey(space.id), JSON.stringify(space), { expirationTtl });
}

export function isHostOrCoHost(sessionAddr: string, space: SpaceRecord): boolean {
  const addr = sessionAddr.toLowerCase();
  return addr === space.hostId.toLowerCase() || space.coHosts.some((ch) => ch.toLowerCase() === addr);
}

export async function requireSessionAddr(request: Request, env: Env): Promise<string | Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  return session.address;
}

export function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 16; i++) result += chars[(arr[i] ?? 0) % chars.length];
  return result;
}

/**
 * Push a chat message to the KV-backed chat log for a space.
 * Stores in a separate KV key to avoid bloating the main space record.
 */
export async function pushChatMessage(env: Env, spaceId: string, msg: SpaceChatMessage): Promise<void> {
  const key = chatIndexKey(spaceId);
  let messages: SpaceChatMessage[] = [];
  try {
    const raw = await env.SPACES?.get(key);
    if (raw) messages = JSON.parse(raw) as SpaceChatMessage[];
  } catch { /* start fresh */ }
  messages.push(msg);
  // Keep max 500 messages in KV
  if (messages.length > 500) messages = messages.slice(-500);
  await env.SPACES?.put(key, JSON.stringify(messages), { expirationTtl: 604800 });
}

/**
 * Get all chat messages for a space from KV.
 */
export async function getChatMessages(env: Env, spaceId: string): Promise<SpaceChatMessage[]> {
  try {
    const key = chatIndexKey(spaceId);
    const raw = await env.SPACES?.get(key);
    return raw ? (JSON.parse(raw) as SpaceChatMessage[]) : [];
  } catch { return []; }
}

/**
 * Update a specific chat message in place (for pinning, reactions, deletion, editing).
 */
export async function updateChatMessage(
  env: Env, spaceId: string, messageId: string,
  updater: (msg: SpaceChatMessage) => SpaceChatMessage,
): Promise<SpaceChatMessage | null> {
  const messages = await getChatMessages(env, spaceId);
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  messages[idx] = updater(messages[idx]);
  const key = chatIndexKey(spaceId);
  await env.SPACES?.put(key, JSON.stringify(messages), { expirationTtl: 604800 });
  return messages[idx];
}

export { getLiveIds, setLiveIds, getUpcomingIds, setUpcomingIds, getPastIds, setPastIds };
