/**
 * /api/webhooks — Webhook System
 *
 * Let users connect ANY external service via webhooks.
 * Supports configurable triggers and JSON POST delivery.
 *
 * Endpoints:
 *   POST   /api/webhooks/create    { name, url, triggers[], secret? }
 *   POST   /api/webhooks/test      { id }
 *   GET    /api/webhooks           → list user's webhooks
 *   DELETE /api/webhooks           { id }
 *   POST   /api/webhooks/trigger   { trigger, payload } (internal)
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

const VALID_TRIGGERS = new Set([
  'new_post',
  'new_follower',
  'new_tip',
  'stream_start',
  'coin_milestone',
  'mention',
]);

function safeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSecret(): string {
  return `whsec_${crypto.randomUUID?.() ?? Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('')}`;
}

function getUserId(request: Request, env: Env): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/session=([^;]+)/);
  if (m?.[1] && env.AUTH_SECRET) return m[1];
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return `apikey:${auth.slice(7).slice(0, 8)}`;
  return null;
}

function isValidUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// ─── POST /api/webhooks/create ──────────────────────────────

export async function handleWebhookCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { name: string; url: string; triggers: string[]; secret?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.name || !body.url || !body.triggers) {
    return jsonResponse({ error: 'name, url, and triggers required' }, 400);
  }
  if (!isValidUrl(body.url)) {
    return jsonResponse({ error: 'Invalid webhook URL' }, 400);
  }
  const invalidTriggers = body.triggers.filter((t) => !VALID_TRIGGERS.has(t));
  if (invalidTriggers.length > 0) {
    return jsonResponse({ error: `Invalid triggers: ${invalidTriggers.join(', ')}` }, 400);
  }

  const webhookId = generateId();
  const secret = body.secret ?? generateSecret();
  const record = {
    id: webhookId,
    name: body.name,
    url: body.url,
    triggers: body.triggers,
    secret,
    createdAt: Date.now(),
    lastTriggeredAt: null,
    lastStatus: null,
  };

  try {
    // Store webhook config
    await env.CACHE?.put(`webhook:config:${webhookId}`, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    // Index in user's webhook list
    const listKey = `webhook:user:${safeKey(userId)}`;
    const raw = (await env.CACHE?.get(listKey)) ?? '[]';
    const list = JSON.parse(raw) as string[];
    list.push(webhookId);
    await env.CACHE?.put(listKey, JSON.stringify(list), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    // Index by trigger for efficient dispatch
    for (const trigger of body.triggers) {
      const triggerKey = `webhook:trigger:${trigger}`;
      const tRaw = (await env.CACHE?.get(triggerKey)) ?? '[]';
      const tList = JSON.parse(tRaw) as string[];
      if (!tList.includes(webhookId)) {
        tList.push(webhookId);
        await env.CACHE?.put(triggerKey, JSON.stringify(tList), {
          expirationTtl: 60 * 60 * 24 * 365,
        });
      }
    }
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true, webhook: { id: webhookId, secret, name: body.name } }, 201);
}

// ─── POST /api/webhooks/test ────────────────────────────────

export async function handleWebhookTest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let body: { id: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.id) return jsonResponse({ error: 'id required' }, 400);

  let record: { url: string; secret?: string; name?: string } | null = null;
  try {
    const raw = await env.CACHE?.get(`webhook:config:${body.id}`);
    if (raw) record = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!record) return jsonResponse({ error: 'Webhook not found' }, 404);

  const testPayload = {
    event: 'test',
    webhookId: body.id,
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test from DegenFeed' },
  };

  try {
    const res = await fetch(record.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-degenfeed-event': 'test',
        ...(record.secret ? { 'x-degenfeed-signature': record.secret } : {}),
        'user-agent': 'DegenFeed-Webhook/1.0',
      },
      body: JSON.stringify(testPayload),
    });

    // Update last status
    await env.CACHE?.put(
      `webhook:config:${body.id}`,
      JSON.stringify({
        ...record,
        lastTriggeredAt: Date.now(),
        lastStatus: res.status,
      }),
      { expirationTtl: 60 * 60 * 24 * 365 },
    ).catch(() => {});

    return jsonResponse({
      ok: res.ok,
      statusCode: res.status,
      statusText: res.statusText,
      body: await res.text().catch(() => null),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ ok: false, error: msg }, 502);
  }
}

// ─── GET /api/webhooks ─────────────────────────────────────

export async function handleWebhookList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  const listKey = `webhook:user:${safeKey(userId)}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];

    const webhooks = await Promise.all(
      ids.map(async (id) => {
        const rec = await env.CACHE?.get(`webhook:config:${id}`);
        return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
      }),
    );

    // Mask secrets
    const sanitized = webhooks.filter(Boolean).map((w) => {
      const { secret, ...rest } = w as Record<string, unknown>;
      return {
        ...rest,
        secret: secret ? `${String(secret).slice(0, 12)}...` : null,
      };
    });

    return noCacheJsonResponse({ webhooks: sanitized });
  } catch {
    return jsonResponse({ webhooks: [] });
  }
}

// ─── DELETE /api/webhooks ──────────────────────────────────

export async function handleWebhookDelete(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { id: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.id) return jsonResponse({ error: 'id required' }, 400);

  try {
    const raw = await env.CACHE?.get(`webhook:config:${body.id}`);
    if (raw) {
      const record = JSON.parse(raw) as { triggers?: string[] };
      // Remove from trigger indices
      for (const trigger of record.triggers ?? []) {
        const triggerKey = `webhook:trigger:${trigger}`;
        const tRaw = (await env.CACHE?.get(triggerKey)) ?? '[]';
        const tList = JSON.parse(tRaw) as string[];
        const updated = tList.filter((id) => id !== body.id);
        await env.CACHE?.put(triggerKey, JSON.stringify(updated), {
          expirationTtl: 60 * 60 * 24 * 365,
        });
      }
    }
    await env.CACHE?.delete(`webhook:config:${body.id}`);

    // Remove from user's list
    const listKey = `webhook:user:${safeKey(userId)}`;
    const uRaw = (await env.CACHE?.get(listKey)) ?? '[]';
    const uList = JSON.parse(uRaw) as string[];
    const updated = uList.filter((id) => id !== body.id);
    await env.CACHE?.put(listKey, JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    return jsonResponse({ error: 'Failed to delete webhook' }, 500);
  }

  return jsonResponse({ ok: true });
}

// ─── POST /api/webhooks/trigger (internal) ──────────────────

export async function handleWebhookTrigger(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let body: { trigger: string; payload: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.trigger || !VALID_TRIGGERS.has(body.trigger)) {
    return jsonResponse(
      {
        error: `Invalid trigger. Must be one of: ${[...VALID_TRIGGERS].join(', ')}`,
      },
      400,
    );
  }

  // Find all webhooks registered for this trigger
  let webhookIds: string[] = [];
  try {
    const raw = await env.CACHE?.get(`webhook:trigger:${body.trigger}`);
    if (raw) webhookIds = JSON.parse(raw) as string[];
  } catch {
    /* ignore */
  }

  if (webhookIds.length === 0) {
    return jsonResponse({ ok: true, delivered: 0 });
  }

  // Load each webhook config and POST in parallel
  const results = await Promise.allSettled(
    webhookIds.map(async (id) => {
      const raw = await env.CACHE?.get(`webhook:config:${id}`);
      if (!raw) return { id, ok: false, error: 'config not found' };
      const config = JSON.parse(raw) as {
        url: string;
        secret?: string;
        name?: string;
      };

      const signature = config.secret ? config.secret : '';

      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-degenfeed-event': body.trigger,
          'x-degenfeed-signature': signature,
          'user-agent': 'DegenFeed-Webhook/1.0',
        },
        body: JSON.stringify({
          event: body.trigger,
          timestamp: new Date().toISOString(),
          data: body.payload,
        }),
      });

      // Update last status
      await env.CACHE?.put(
        `webhook:config:${id}`,
        JSON.stringify({
          ...config,
          lastTriggeredAt: Date.now(),
          lastStatus: res.status,
        }),
        { expirationTtl: 60 * 60 * 24 * 365 },
      ).catch(() => {});

      return { id, ok: res.ok, statusCode: res.status };
    }),
  );

  const delivered = results.filter((r: unknown) => {
    const settled = r as { status: string; value?: Record<string, unknown> };
    return settled.status === 'fulfilled' && settled.value?.ok === true;
  }).length;
  const errors = results
    .filter((r: unknown) => {
      const settled = r as { status: string; value?: Record<string, unknown> };
      return settled.status === 'fulfilled' && settled.value?.ok !== true;
    })
    .map((r: unknown) => {
      const settled = r as { status: string; value?: { id?: string; error?: string } };
      return { id: settled.value?.id ?? 'unknown', error: settled.value?.error ?? 'HTTP error' };
    });

  return jsonResponse({
    ok: true,
    trigger: body.trigger,
    delivered,
    total: webhookIds.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
