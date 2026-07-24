/**
 * /api/notify — Landing page email subscription
 *
 * The landing page at degenfeed.xyz posts { email, source } to this
 * endpoint. Emails are stored in the SUBSCRIPTIONS KV namespace under
 * `notify:sub:<safeKey(email)>`. A Notion/Postmark integration can
 * then pull and send launch emails.
 */

import { type Env, jsonResponse } from '../index';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAILS = 10000;

function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

export async function handleNotify(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let email = '';
  try {
    const body = (await request.json()) as { email?: string; source?: string };
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'Invalid email' }, 400);
  }

  if (!env.SUBSCRIPTIONS) {
    // KV not bound — acknowledged locally, no persistence.
    return jsonResponse({ ok: true, stored: false }, 200);
  }

  try {
    // Guard against abuse: cap at MAX_EMAILS
    const countKey = 'notify:count';
    const countRaw = await env.SUBSCRIPTIONS.get(countKey);
    const current = countRaw ? Number.parseInt(countRaw, 10) : 0;
    if (current >= MAX_EMAILS) {
      return jsonResponse({ error: 'Email list full' }, 429);
    }

    const key = `notify:sub:${safeKey(email)}`;
    const existing = await env.SUBSCRIPTIONS.get(key);
    if (!existing) {
      await env.SUBSCRIPTIONS.put(countKey, String(current + 1));
    }

    await env.SUBSCRIPTIONS.put(
      key,
      JSON.stringify({
        email,
        subscribedAt: Date.now(),
        source: 'landing' as const,
      }),
      { expirationTtl: 60 * 60 * 24 * 400 },
    );

    return jsonResponse({ ok: true, stored: true }, 200);
  } catch {
    return jsonResponse({ ok: true, stored: false }, 200);
  }
}
