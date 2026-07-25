/**
 * @degenfeed/api-worker — DAO Activity Feed
 *
 * Provides a unified activity feed for DAOs and per-user activity across DAOs.
 *
 * KV schema:
 *   dao:activity:{daoId}:{eventId}   → Activity event
 *   dao:activity:idx:{daoId}         → Array of event IDs for a DAO
 *   dao:activity:mine:{wallet}       → Array of "daoId:eventId" references
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Types ──────────────────────────────────────────────────────────────

export type ActivityType =
  | 'proposal_created'
  | 'proposal_passed'
  | 'proposal_failed'
  | 'proposal_executed'
  | 'vote_cast'
  | 'member_joined'
  | 'member_left'
  | 'treasury_transfer'
  | 'treasury_stream_started'
  | 'delegation_changed'
  | 'grant_created'
  | 'grant_milestone_completed';

export interface ActivityEvent {
  id: string;
  daoId: string;
  type: ActivityType;
  actor: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

// ─── KV Helpers ─────────────────────────────────────────────────────────

async function getEventIds(kv: KVNamespace, key: string): Promise<string[]> {
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function getEvent(kv: KVNamespace, key: string): Promise<ActivityEvent | null> {
  try {
    const raw = await kv.get(key);
    return raw ? (JSON.parse(raw) as ActivityEvent) : null;
  } catch {
    return null;
  }
}

// ─── GET /api/dao/:daoId/activity — DAO activity feed ───────────────

export async function handleDaoActivity(
  request: Request,
  env: Env,
  daoId: string,
): Promise<Response> {
  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  // Verify DAO exists
  const daoRaw = await kv.get(`dao:${daoId}`).catch(() => null);
  if (!daoRaw) return jsonResponse({ error: 'DAO not found' }, 404);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const type = url.searchParams.get('type') as ActivityType | null;

  const eventIds = await getEventIds(kv, `dao:activity:idx:${daoId}`);

  // Reverse to get newest first
  eventIds.reverse();

  const events: ActivityEvent[] = [];
  for (const eventId of eventIds) {
    const event = await getEvent(kv, `dao:activity:${daoId}:${eventId}`);
    if (!event) continue;

    // Filter by type
    if (type && event.type !== type) continue;

    events.push(event);
    if (events.length >= limit) break;
  }

  const nextCursor = events.length > 0 ? events[events.length - 1]?.id : undefined;

  return jsonResponse({
    data: events,
    meta: { total: events.length, daoId, nextCursor },
  });
}

// ─── GET /api/dao/activity/mine — My activity across all DAOs ──────

export async function handleMyDaoActivity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const kv = env.GOVERNANCE;
  if (!kv) return jsonResponse({ error: 'Governance KV not configured' }, 500);

  const wallet = session.address.toLowerCase();
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const type = url.searchParams.get('type') as ActivityType | null;

  const refs = await getEventIds(kv, `dao:activity:mine:${wallet}`);

  // Reverse to get newest first
  refs.reverse();

  const events: ActivityEvent[] = [];
  for (const ref of refs) {
    const [daoId, eventId] = ref.split(':');
    if (!daoId || !eventId) continue;

    const event = await getEvent(kv, `dao:activity:${daoId}:${eventId}`);
    if (!event) continue;

    // Filter by type
    if (type && event.type !== type) continue;

    events.push(event);
    if (events.length >= limit) break;
  }

  return jsonResponse({
    data: events,
    meta: { total: events.length },
  });
}
