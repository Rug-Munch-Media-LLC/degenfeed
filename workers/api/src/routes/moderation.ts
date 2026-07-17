import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

interface SyncBody {
  targetId: string;
  targetHandle?: string;
  protocol: string;
  action: 'block' | 'unblock' | 'mute' | 'unmute';
}

function modKey(address: string): string {
  return `user:moderation:${address.toLowerCase()}`;
}

interface ModEntry {
  targetId: string;
  targetHandle: string;
  protocol: string;
  action: 'block' | 'mute';
  timestamp: number;
}

interface ModStore {
  entries: ModEntry[];
}

export async function handleBlockSync(request: Request, env: Env): Promise<Response> {
  // ── GET: return blocked/muted lists for the authenticated user ──
  if (request.method === 'GET') {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const raw = await env.CACHE?.get(modKey(session.address));
    const store: ModStore = raw ? JSON.parse(raw) : { entries: [] };

    // Split entries by type for the client
    const blocked = store.entries
      .filter((e) => e.action === 'block')
      .map((e) => ({
        targetId: e.targetId,
        targetHandle: e.targetHandle,
        protocol: e.protocol,
        blockedAt: e.timestamp,
      }));
    const muted = store.entries
      .filter((e) => e.action === 'mute')
      .map((e) => ({ targetId: e.targetId, targetHandle: e.targetHandle, mutedAt: e.timestamp }));

    return noCacheJsonResponse({ blocked, muted });
  }

  // ── POST: sync a block/mute action from the client ──
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Session is optional for POST (unauthenticated users still get local persistence)
  const session = await requireSession(request, env);
  const address = session instanceof Response ? 'anonymous' : session.address;

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { targetId, targetHandle, protocol, action } = body;

  if (!targetId || !action) {
    return jsonResponse({ error: 'targetId and action required' }, 400);
  }

  if (!['block', 'unblock', 'mute', 'unmute'].includes(action)) {
    return jsonResponse({ error: 'Invalid action' }, 400);
  }

  try {
    const raw = await env.CACHE?.get(modKey(address));
    const store: ModStore = raw ? JSON.parse(raw) : { entries: [] };

    if (action === 'block' || action === 'mute') {
      // Remove any existing entry for the same target, then add new one
      store.entries = store.entries.filter((e) => e.targetId !== targetId);
      store.entries.push({
        targetId,
        targetHandle: targetHandle || '',
        protocol,
        action,
        timestamp: Date.now(),
      });
    } else if (action === 'unblock') {
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'block'),
      );
    } else if (action === 'unmute') {
      store.entries = store.entries.filter(
        (e) => !(e.targetId === targetId && e.action === 'mute'),
      );
    }

    await env.CACHE?.put(modKey(address), JSON.stringify(store), {
      expirationTtl: 60 * 60 * 24 * 400, // ~13 months
    });

    return jsonResponse({ ok: true, action, targetId, protocol });
  } catch {
    return jsonResponse({ error: 'Failed to persist moderation state' }, 500);
  }
}
