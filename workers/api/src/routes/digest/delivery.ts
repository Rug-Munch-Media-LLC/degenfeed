/**
 * @degenfeed/api-worker — Digest Delivery
 *
 * Email subscription management and digest delivery.
 */

import type { Protocol } from '@degenfeed/types';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import type { Env } from '../../types';
import { DEFAULT_PROTOCOLS } from '../feed';
import { isValidEmail, safeKey } from './types';

export async function handleDigestSubscribeEmail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  let body: { email?: string; timezone?: string; niches?: string[]; protocols?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return jsonResponse({ error: 'Invalid email' }, 400);

  const record = {
    email,
    timezone: body.timezone ?? 'UTC',
    niches: Array.isArray(body.niches) ? body.niches.map((n) => n.toLowerCase()) : [],
    protocols: Array.isArray(body.protocols)
      ? body.protocols.filter((p): p is Protocol => DEFAULT_PROTOCOLS.includes(p as Protocol))
      : DEFAULT_PROTOCOLS,
    subscribedAt: Date.now(),
  };

  try {
    await env.CACHE?.put(`digest:sub:${safeKey(email)}`, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
    const idx = (await env.CACHE?.get('digest:subscribers')) ?? '';
    const set = new Set(idx.split('\n').filter(Boolean));
    set.add(safeKey(email));
    await env.CACHE?.put('digest:subscribers', [...set].join('\n'), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    /* non-critical */
  }

  return jsonResponse({ ok: true, email, action: 'subscribed', timezone: record.timezone });
}

export async function handleDigestUnsubscribeEmail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  let body: { email?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return jsonResponse({ error: 'Invalid email' }, 400);

  try {
    await env.CACHE?.delete(`digest:sub:${safeKey(email)}`);
    const idx = (await env.CACHE?.get('digest:subscribers')) ?? '';
    const set = new Set(idx.split('\n').filter(Boolean));
    set.delete(safeKey(email));
    await env.CACHE?.put('digest:subscribers', [...set].join('\n'), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    /* KV operation failed */
  }

  return jsonResponse({ ok: true, email, action: 'unsubscribed' });
}

export async function handleDigestStatus(_request: Request, env: Env): Promise<Response> {
  try {
    const idx = (await env.CACHE?.get('digest:subscribers')) ?? '';
    return jsonResponse({ count: idx.split('\n').filter(Boolean).length });
  } catch {
    return jsonResponse({ count: 0, warning: 'KV unavailable' });
  }
}
