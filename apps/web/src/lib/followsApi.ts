/**
 * @degenfeed/web — followsApi
 *
 * Thin client for the server-side follow graph (/api/follows).
 *
 * The feed's "Following" tab uses this when a session is available so
 * follows sync across devices. Every call is best-effort: when the API is
 * unreachable, unauthenticated, or offline, callers fall back to the
 * IndexedDB follow store (see @degenfeed/storage).
 *
 * Endpoints (self-hosted API, proxied by Next.js):
 *   GET    /api/follows       → { follows: FollowEntry[], total }
 *   PUT    /api/follows/:id   → follow targetId=:id (body: { protocol, displayName? })
 *   DELETE /api/follows/:id   → unfollow targetId=:id (?protocol=...)
 */

export interface ServerFollowEntry {
  targetId: string;
  protocol: string;
  displayName?: string;
  followedAt: number;
}

const FOLLOWS_TIMEOUT_MS = 8_000;

async function followsFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FOLLOWS_TIMEOUT_MS);
    try {
      return await fetch(url, {
        credentials: 'include',
        cache: 'no-store',
        ...init,
        signal: controller.signal,
        headers: { 'content-type': 'application/json', ...init?.headers },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Network error / offline / timeout — caller falls back to IndexedDB.
    return null;
  }
}

/**
 * Fetch the server-side follow list. Returns null when the server is
 * unreachable or the session is missing (401) — never throws.
 */
export async function fetchServerFollows(): Promise<ServerFollowEntry[] | null> {
  const res = await followsFetch('/api/follows');
  if (!res?.ok) return null;
  try {
    const data = (await res.json()) as { follows?: ServerFollowEntry[]; total?: number };
    return Array.isArray(data.follows) ? data.follows : null;
  } catch {
    return null;
  }
}

/**
 * Follow an identity on the server. Best-effort — returns false when the
 * server cannot be reached or the session is missing.
 */
export async function putServerFollow(
  targetId: string,
  protocol: string,
  displayName?: string,
): Promise<boolean> {
  if (!targetId || !protocol) return false;
  const res = await followsFetch(`/api/follows/${encodeURIComponent(targetId)}`, {
    method: 'PUT',
    body: JSON.stringify({ protocol, displayName: displayName ?? '' }),
  });
  return Boolean(res?.ok);
}

/**
 * Unfollow an identity on the server. Best-effort — returns false when the
 * server cannot be reached or the session is missing.
 */
export async function deleteServerFollow(targetId: string, protocol: string): Promise<boolean> {
  if (!targetId || !protocol) return false;
  const res = await followsFetch(
    `/api/follows/${encodeURIComponent(targetId)}?protocol=${encodeURIComponent(protocol)}`,
    { method: 'DELETE' },
  );
  return Boolean(res?.ok);
}
