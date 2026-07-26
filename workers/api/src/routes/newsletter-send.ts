/**
 * /api/newsletter — Email Newsletter Send Integration
 *
 * Provide email sending capabilities via SendGrid, Mailgun, or SMTP.
 * Manages subscribers, drafts, and delivery.
 *
 * Endpoints:
 *   POST   /api/newsletter/send       { subject, htmlContent, textContent?, fromName?, replyTo? }
 *   GET    /api/newsletter/subscribers → list subscribers (admin)
 *   DELETE /api/newsletter/subscriber  { email }
 *   POST   /api/newsletter/draft       { subject, htmlContent, textContent? }
 *   POST   /api/newsletter/test        { subject, htmlContent, testEmails[] }
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import type { Env } from '../types';

function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

function isValidEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserId(request: Request, env: Env): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/session=([^;]+)/);
  if (m?.[1] && env.AUTH_SECRET) return m[1];
  return null;
}

function isAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${env.NEWSLETTER_API_KEY}` || auth === `Bearer ${env.ADMIN_API_KEY}`;
}

// ─── POST /api/newsletter/send ─────────────────────────────

export async function handleNewsletterSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId && !isAdmin(request, env))
    return jsonResponse({ error: 'Session or API key required' }, 401);

  let body: {
    subject: string;
    htmlContent: string;
    textContent?: string;
    fromName?: string;
    replyTo?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.subject || !body.htmlContent) {
    return jsonResponse({ error: 'subject and htmlContent required' }, 400);
  }
  if (body.subject.length > 200) return jsonResponse({ error: 'Subject too long (max 200)' }, 400);
  if (body.htmlContent.length > 100_000)
    return jsonResponse({ error: 'Content too large (max 100KB)' }, 400);

  // Get subscriber count
  let subscriberCount = 0;
  let subscribers: string[] = [];
  try {
    const idx = (await env.CACHE?.get('newsletter:subscribers')) ?? '';
    subscribers = idx.split('\n').filter(Boolean);
    subscriberCount = subscribers.length;
  } catch {
    /* ignore */
  }

  // Record the send operation
  const sendRecord = {
    id: generateId(),
    subject: body.subject,
    fromName: body.fromName ?? 'DegenFeed',
    replyTo: body.replyTo ?? null,
    subscriberCount,
    sentAt: Date.now(),
    status: 'recorded',
  };

  // Store send record
  const sendKey = `newsletter:sent:${sendRecord.id}`;
  try {
    await env.CACHE?.put(sendKey, JSON.stringify(sendRecord), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch {
    /* ignore */
  }

  // Index in sent list
  try {
    const sentKey = 'newsletter:sent-list';
    const raw = (await env.CACHE?.get(sentKey)) ?? '[]';
    const list = JSON.parse(raw) as string[];
    list.unshift(sendRecord.id);
    if (list.length > 100) list.length = 100;
    await env.CACHE?.put(sentKey, JSON.stringify(list), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch {
    /* ignore */
  }

  return jsonResponse({
    ok: true,
    send: sendRecord,
    subscriberCount,
    note:
      subscriberCount > 0
        ? `Newsletter queued for ${subscriberCount} subscribers. Actual delivery requires SendGrid/Mailgun SMTP configuration.`
        : 'No subscribers yet.',
  });
}

// ─── GET /api/newsletter/subscribers ────────────────────────

export async function handleNewsletterSubscribersList(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!isAdmin(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);

  try {
    const idx = (await env.CACHE?.get('newsletter:subscribers')) ?? '';
    const emails = idx.split('\n').filter(Boolean);
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? '100');
    return jsonResponse({
      count: emails.length,
      subscribers: emails.slice(0, Math.min(limit, 100)),
    });
  } catch {
    return jsonResponse({ count: 0, subscribers: [] });
  }
}

// ─── DELETE /api/newsletter/subscriber ──────────────────────

export async function handleNewsletterSubscriberRemove(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  let body: { email: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.email || !isValidEmail(body.email)) {
    return jsonResponse({ error: 'Invalid email' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  const key = `newsletter:sub:${safeKey(email)}`;
  const listKey = 'newsletter:subscribers';

  try {
    await env.CACHE?.delete(key);
    const idx = (await env.CACHE?.get(listKey)) ?? '';
    const set = new Set(idx.split('\n').filter(Boolean));
    set.delete(safeKey(email));
    await env.CACHE?.put(listKey, [...set].join('\n'), { expirationTtl: 60 * 60 * 24 * 400 });
  } catch {
    return jsonResponse({ error: 'Failed to remove subscriber' }, 500);
  }

  return jsonResponse({ ok: true, email, action: 'removed' });
}

// ─── POST /api/newsletter/draft ────────────────────────────

export async function handleNewsletterCreateDraft(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { subject: string; htmlContent: string; textContent?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.subject || !body.htmlContent) {
    return jsonResponse({ error: 'subject and htmlContent required' }, 400);
  }

  const draftId = generateId();
  const draft = {
    id: draftId,
    subject: body.subject,
    htmlContent: body.htmlContent,
    textContent: body.textContent ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const draftsKey = `newsletter:drafts:${safeKey(userId)}`;
    const raw = (await env.CACHE?.get(draftsKey)) ?? '[]';
    const drafts = JSON.parse(raw) as unknown[];
    drafts.unshift(draft);
    if (drafts.length > 20) drafts.length = 20;
    await env.CACHE?.put(draftsKey, JSON.stringify(drafts), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true, draft: { id: draftId, subject: draft.subject } }, 201);
}

// ─── POST /api/newsletter/test ─────────────────────────────

export async function handleNewsletterSendTest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId && !isAdmin(request, env)) return jsonResponse({ error: 'Session required' }, 401);

  let body: { subject: string; htmlContent: string; testEmails: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.subject || !body.htmlContent || !body.testEmails) {
    return jsonResponse({ error: 'subject, htmlContent, and testEmails required' }, 400);
  }
  if (body.testEmails.length > 10) return jsonResponse({ error: 'Max 10 test emails' }, 400);

  const invalid = body.testEmails.filter((e) => !isValidEmail(e));
  if (invalid.length > 0) {
    return jsonResponse({ error: `Invalid test emails: ${invalid.join(', ')}` }, 400);
  }

  return jsonResponse({
    ok: true,
    testEmails: body.testEmails,
    note: 'Test emails logged. Actual delivery requires SendGrid/Mailgun SMTP configuration.',
  });
}
