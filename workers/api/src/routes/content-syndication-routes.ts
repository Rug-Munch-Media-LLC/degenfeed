/**
 * @degenfeed/api-worker — Content Syndication API Routes
 *
 * POST /api/content/syndication/rules                — Set syndication rules
 * GET  /api/content/syndication/rules                — Get syndication rules
 * PUT  /api/content/syndication/rules/:protocol      — Update per-protocol rule
 *
 * POST /api/content/syndication/queue                — Queue content for syndication
 * GET  /api/content/syndication/queue                — List queued syndications
 * POST /api/content/syndication/queue/:queueId       — Execute a queued syndication
 *
 * GET  /api/content/syndication/history              — Get syndication history
 * GET  /api/content/syndication/can/:protocol        — Check if can syndicate to protocol
 */

import { type Env, jsonResponse } from '../index';
import { getContent } from '../lib/content-library';
import {
  canSyndicate,
  executeDueSyndications,
  executeSyndication,
  getQueuedSyndication,
  getSyndicationHistory,
  getSyndicationRules,
  queueSyndication,
  setSyndicationRules,
  updateProtocolSyndicationRule,
} from '../lib/content-syndication';
import { requireSession } from '../session';

/**
 * POST /api/content/syndication/rules — Set syndication rules.
 */
export async function handleSetSyndicationRules(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const _rules = await setSyndicationRules(env, session.address, {
      defaultMode: body.defaultMode as 'auto' | 'manual-review' | 'never' | undefined,
      globalCooldownMinutes: body.globalCooldownMinutes as number | undefined,
      crossPlatformThreading: body.crossPlatformThreading as boolean | undefined,
    });

    // Update per-protocol rules if provided
    if (body.protocols && typeof body.protocols === 'object') {
      for (const [protocol, rule] of Object.entries(body.protocols as Record<string, unknown>)) {
        if (typeof rule === 'object') {
          const r = rule as Record<string, unknown>;
          await updateProtocolSyndicationRule(env, session.address, protocol, {
            mode: r.mode as 'auto' | 'manual-review' | 'never',
            preferredTime: r.preferredTime as string,
            preferredDays: r.preferredDays as number[],
            minIntervalMinutes: r.minIntervalMinutes as number,
            autoAdaptFormat: r.autoAdaptFormat as boolean,
            includeMedia: r.includeMedia as boolean,
            includeHashtags: r.includeHashtags as boolean,
          });
        }
      }
    }

    const updated = await getSyndicationRules(env, session.address);
    return jsonResponse({ data: updated });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/syndication/rules — Get syndication rules.
 */
export async function handleGetSyndicationRules(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const rules = await getSyndicationRules(env, session.address);
    return jsonResponse({ data: rules });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * PUT /api/content/syndication/rules/:protocol — Update per-protocol rule.
 */
export async function handleUpdateProtocolRule(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'PUT') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const protocol = parts[parts.length - 1];

    if (!protocol) return jsonResponse({ error: 'Protocol is required' }, 400);

    const body = (await request.json()) as Record<string, unknown>;

    const rules = await updateProtocolSyndicationRule(env, session.address, protocol, {
      mode: body.mode as 'auto' | 'manual-review' | 'never' | undefined,
      preferredTime: body.preferredTime as string,
      preferredDays: body.preferredDays as number[],
      minIntervalMinutes: body.minIntervalMinutes as number,
      autoAdaptFormat: body.autoAdaptFormat as boolean,
      includeMedia: body.includeMedia as boolean,
      includeHashtags: body.includeHashtags as boolean,
    });

    return jsonResponse({ data: rules });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/syndication/queue — Queue content for syndication.
 */
export async function handleQueueSyndication(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      contentId: string;
      sourceProtocol: string;
      targetProtocols: string[];
      scheduledAt?: number;
      auth?: Record<string, string>;
    };

    if (!body.contentId || !body.sourceProtocol || !body.targetProtocols?.length) {
      return jsonResponse(
        { error: 'contentId, sourceProtocol, and targetProtocols are required' },
        400,
      );
    }

    // Verify content exists and belongs to user
    const content = await getContent(env, session.address, body.contentId);
    if (!content) return jsonResponse({ error: 'Content not found' }, 404);

    // Check syndication rules for each target
    for (const protocol of body.targetProtocols) {
      const check = await canSyndicate(env, session.address, protocol);
      if (!check.allowed) {
        return jsonResponse(
          {
            error: `Cannot syndicate to ${protocol}`,
            detail: check,
          },
          400,
        );
      }
    }

    const entry = await queueSyndication(
      env,
      session.address,
      body.contentId,
      body.sourceProtocol,
      body.targetProtocols,
      {
        scheduledAt: body.scheduledAt,
        auth: body.auth,
      },
    );

    // If immediate, execute now
    if (!body.scheduledAt || body.scheduledAt <= Date.now()) {
      // Execute in background
      executeSyndication(env, entry.queueId).catch((err) =>
        console.error(`[syndication] Background execution of ${entry.queueId} failed:`, err),
      );
    }

    return jsonResponse({ data: entry });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/syndication/queue — List queued syndications.
 */
export async function handleListSyndicationQueue(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    // biome-ignore lint/style/noNonNullAssertion: KV namespace is always bound in production
    const store = env.CONTENT_LIBRARY || env.CACHE!;
    const queued: Array<{
      queueId: string;
      contentId: string;
      targetProtocols: string[];
      status: string;
      scheduledAt: number;
      createdAt: number;
    }> = [];

    let cursor: string | undefined;
    do {
      const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } =
        await store.list({ prefix: 'syndication:queue:', cursor, limit: 100 });

      for (const key of page.keys) {
        const raw = await store.get(key.name);
        if (!raw) continue;
        const entry = JSON.parse(raw) as {
          wallet: string;
          queueId: string;
          contentId: string;
          targetProtocols: string[];
          status: string;
          scheduledAt: number;
          createdAt: number;
          results: Record<string, unknown>;
        };

        // Only show the user's own items
        if (entry.wallet !== session.address.toLowerCase()) continue;

        queued.push({
          queueId: entry.queueId,
          contentId: entry.contentId,
          targetProtocols: entry.targetProtocols,
          status: entry.status,
          scheduledAt: entry.scheduledAt,
          createdAt: entry.createdAt,
        });
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    // Sort by createdAt descending
    queued.sort((a, b) => b.createdAt - a.createdAt);

    return jsonResponse({ data: queued });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/syndication/queue/:queueId — Execute a queued syndication.
 */
export async function handleExecuteSyndication(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const queueId = parts[parts.length - 1];

    if (!queueId) return jsonResponse({ error: 'queueId is required' }, 400);

    const entry = await getQueuedSyndication(env, queueId);
    if (!entry) return jsonResponse({ error: 'Syndication queue entry not found' }, 404);

    if (entry.wallet !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const result = await executeSyndication(env, queueId);
    return jsonResponse({ data: result });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/syndication/history — Get syndication history.
 */
export async function handleGetSyndicationHistory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    const history = await getSyndicationHistory(env, session.address, limit);
    return jsonResponse({ data: history });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/syndication/can/:protocol — Check if can syndicate to protocol.
 */
export async function handleCanSyndicate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const protocol = parts[parts.length - 1];

    if (!protocol) return jsonResponse({ error: 'Protocol is required' }, 400);

    const result = await canSyndicate(env, session.address, protocol);
    return jsonResponse({ data: result });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * Cron executor: process due syndications.
 */
export async function executeDueSyndicationRules(env: Env): Promise<number> {
  return executeDueSyndications(env);
}
