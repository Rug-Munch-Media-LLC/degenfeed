/**
 * @degenfeed/api-worker — rmi-backend persistent storage client
 *
 * Typed wrappers for the rmi-backend KV-migration API
 * (`https://api.rugmunch.io/api/v1`), which persists the namespaces that
 * used to live in Cloudflare KV:
 *
 *   GET/POST /api/v1/bookmarks    — persistent bookmark list per address
 *   GET/POST /api/v1/identities   — persistent identity mapping (address → JSON)
 *   GET/POST /api/v1/chat-history — persistent chat history per room
 *   GET/POST/DELETE /api/v1/sessions — generic key/value sessions with TTL
 *
 * Contract verified against rmi-backend `app/api/v1/kv_migration.py`
 * (2026-08-06). Note the actual backend contract differs from the original
 * wiring spec in four places:
 *   - Sessions use `session_id` (query param + body field), not `id`.
 *   - Chat-history returns `{ items: [...] }`, not `{ messages: [...] }`.
 *   - Bookmarks returns `{ items: [{ post_id, ... }] }`, not `{ post_ids }`.
 *   - There is NO DELETE /bookmarks endpoint (see removeBookmark below).
 *
 * Auth: X-API-Key header, same as lib/queue-client.ts. The backend's
 * `_auth_dependency` accepts `X-API-Key` or `Authorization: Bearer`.
 */

import type { Env } from '../types';

const API_BASE = 'https://api.rugmunch.io/api/v1';

export function getApiKey(env: Env): string {
  return env.RMI_API_KEY || env.RMI_INTERNAL_KEY || '';
}

async function rmiFetch(env: Env, path: string, opts: RequestInit = {}): Promise<Response> {
  // Fail fast when no API key is configured — an unauthenticated call to the
  // internal API would 401 anyway. Callers fall back to KV by design.
  const apiKey = getApiKey(env);
  if (!apiKey) throw new Error('RMI_API_KEY not configured — skipping backend session lookup');
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...opts.headers,
    },
  });
}

/**
 * Writes throw on HTTP failure (mirrors lib/queue-client.ts) so callers can
 * fall back to KV. Reads return empty/null on failure by design.
 */
async function rmiFetchOrThrow(env: Env, path: string, opts: RequestInit): Promise<Response> {
  const res = await rmiFetch(env, path, opts);
  if (!res.ok) {
    throw new Error(`[rmi-client] ${opts.method ?? 'GET'} ${path} failed: HTTP ${res.status}`);
  }
  return res;
}

// ─── Bookmarks ─────────────────────────────────────────────────────────
// Backend: GET  /bookmarks?address=&limit= → { items: [{ post_id }] }
//          POST /bookmarks { address, post_id }

export async function getBookmarks(env: Env, address: string): Promise<string[]> {
  const res = await rmiFetch(env, `/bookmarks?address=${encodeURIComponent(address)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: Array<{ post_id?: string; postId?: string }>;
    post_ids?: string[];
  };
  // Backend returns { items: [{ post_id }] }; tolerate { post_ids } too.
  if (Array.isArray(data.items)) {
    return data.items.map((b) => b.post_id ?? b.postId ?? '').filter((id: string) => id.length > 0);
  }
  return data.post_ids ?? [];
}

export async function addBookmark(env: Env, address: string, postId: string): Promise<void> {
  await rmiFetchOrThrow(env, '/bookmarks', {
    method: 'POST',
    body: JSON.stringify({ address: address.toLowerCase(), post_id: postId }),
  });
}

/**
 * Best-effort removal. [REVIEW] The deployed rmi-backend has no
 * DELETE /bookmarks endpoint (only GET/POST). This call is kept for
 * forward-compatibility with the intended contract and is a harmless no-op
 * today (405). Removal remains KV-authoritative until the backend endpoint
 * is added — see routes/bookmarks.ts removeBookmarkWithFallback.
 */
export async function removeBookmark(env: Env, address: string, postId: string): Promise<void> {
  await rmiFetchOrThrow(
    env,
    `/bookmarks?address=${encodeURIComponent(address)}&post_id=${encodeURIComponent(postId)}`,
    { method: 'DELETE' },
  );
}

// ─── Identities ────────────────────────────────────────────────────────
// Backend: GET  /identities?address= → { data } (404 when absent)
//          POST /identities { address, data }

export async function getIdentity(
  env: Env,
  address: string,
): Promise<Record<string, unknown> | null> {
  const res = await rmiFetch(env, `/identities?address=${encodeURIComponent(address)}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { data: Record<string, unknown> };
  return data.data ?? null;
}

export async function setIdentity(
  env: Env,
  address: string,
  data: Record<string, unknown>,
): Promise<void> {
  await rmiFetchOrThrow(env, '/identities', {
    method: 'POST',
    body: JSON.stringify({ address: address.toLowerCase(), data }),
  });
}

// ─── Chat history ──────────────────────────────────────────────────────
// Backend: GET  /chat-history?room_id=&limit= → { items: [{ sender, content, created_at }] }
//          POST /chat-history { room_id, sender, content }

export interface ChatHistoryMessage {
  sender: string;
  content: string;
  created_at: string;
}

export async function getChatHistory(
  env: Env,
  roomId: string,
  limit = 50,
): Promise<ChatHistoryMessage[]> {
  const res = await rmiFetch(
    env,
    `/chat-history?room_id=${encodeURIComponent(roomId)}&limit=${limit}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: ChatHistoryMessage[];
    messages?: ChatHistoryMessage[];
  };
  return data.items ?? data.messages ?? [];
}

export async function sendChatMessage(
  env: Env,
  roomId: string,
  sender: string,
  content: string,
): Promise<void> {
  await rmiFetchOrThrow(env, '/chat-history', {
    method: 'POST',
    body: JSON.stringify({ room_id: roomId, sender, content }),
  });
}

// ─── Sessions ──────────────────────────────────────────────────────────
// Backend: GET    /sessions?session_id= → { data } (200 + {} when unknown)
//          POST   /sessions { session_id, data, ttl }
//          DELETE /sessions?session_id=
// NOTE: the backend parameter is `session_id` (not `id`), and an unknown
// session returns HTTP 200 with `data: {}` — so callers must check fields,
// not mere presence, to distinguish "absent" from "empty record".

export async function getSession(env: Env, id: string): Promise<Record<string, unknown> | null> {
  const res = await rmiFetch(env, `/sessions?session_id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { data: Record<string, unknown> };
  return data.data ?? null;
}

export async function setSession(
  env: Env,
  id: string,
  data: Record<string, unknown>,
  ttl = 86400,
): Promise<void> {
  await rmiFetchOrThrow(env, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ session_id: id, data, ttl }),
  });
}

export async function deleteSession(env: Env, id: string): Promise<void> {
  await rmiFetchOrThrow(env, `/sessions?session_id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
