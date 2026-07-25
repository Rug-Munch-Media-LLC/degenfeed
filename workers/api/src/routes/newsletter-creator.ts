/**
 * /api/newsletter/creator — Creator-facing newsletter endpoints
 *
 * Handles sending newsletters, subscriber management, analytics,
 * and Mailgun webhook processing for DegenFeed's email distribution system.
 *
 * Endpoints:
 *   POST   /api/newsletter/creator/send           Send newsletter to subscribers
 *   GET    /api/newsletter/creator/subscribers     List subscribers for creator
 *   POST   /api/newsletter/creator/subscribe       Subscribe to creator
 *   DELETE /api/newsletter/creator/subscribe       Unsubscribe from creator
 *   GET    /api/newsletter/creator/stats/:postId   Newsletter analytics per post
 *   GET    /api/newsletter/creator/count           Subscriber count breakdown
 *   POST   /api/newsletter/creator/webhook/mailgun Mailgun event webhook
 *   GET    /api/newsletter/creator/health          EmailEngine health check
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { EmailEngine, type EmailEngineConfig } from '../lib/email-engine';
import { methodNotAllowed } from '../response-helpers';

// ─── Helpers ─────────────────────────────────────────────────

function safeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

function isValidEmail(s: string): boolean {
  if (typeof s !== 'string') return false;
  if (s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
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

function getCreatorId(request: Request, env: Env): string | null {
  // Check session first
  const userId = getUserId(request, env);
  if (userId) return userId;

  // Check Authorization header for API key usage
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    // For API key requests, the creator ID must be in the body or header
    const creatorId = request.headers.get('x-creator-id');
    if (creatorId) return creatorId;
  }

  return null;
}

function createEngine(env: Env): EmailEngine | null {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN || !env.EMAIL_FROM_ADDRESS) {
    return null;
  }

  const kv: EmailEngineConfig['kv'] = env.CACHE
    ? {
        get: (key: string) => (env.CACHE as KVNamespace).get(key),
        put: (key: string, value: string, opts?: { expirationTtl?: number }) =>
          (env.CACHE as KVNamespace).put(key, value, opts),
        delete: (key: string) => (env.CACHE as KVNamespace).delete(key),
      }
    : {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      };

  return new EmailEngine({
    mailgunKey: env.MAILGUN_API_KEY,
    mailgunDomain: env.MAILGUN_DOMAIN,
    sendgridKey: env.SENDGRID_API_KEY,
    fromAddress: env.EMAIL_FROM_ADDRESS,
    fromName: env.EMAIL_FROM_NAME ?? 'DegenFeed',
    kv,
    enableTracking: true,
    log: (level, msg, data) => {
      console.log(JSON.stringify({ l: level, m: `[EmailEngine] ${msg}`, d: data, t: Date.now() }));
    },
  });
}

// ─── POST /api/newsletter/creator/send ──────────────────────

export async function handleCreatorNewsletterSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const creatorId = getCreatorId(request, env);
  if (!creatorId && !isAdmin(request, env)) {
    return jsonResponse({ error: 'Session required' }, 401);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse(
      {
        error:
          'Email engine not configured (MAILGUN_API_KEY, MAILGUN_DOMAIN, EMAIL_FROM_ADDRESS required)',
      },
      500,
    );
  }

  let body: {
    subject: string;
    html: string;
    tier: 'free' | 'paid' | 'token-gated';
    postId?: string;
    minTokenHold?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.subject || !body.html) {
    return jsonResponse({ error: 'subject and html required' }, 400);
  }
  if (body.subject.length > 200) {
    return jsonResponse({ error: 'Subject too long (max 200)' }, 400);
  }
  if (body.html.length > 500_000) {
    return jsonResponse({ error: 'HTML content too large (max 500KB)' }, 400);
  }
  if (!['free', 'paid', 'token-gated'].includes(body.tier ?? '')) {
    return jsonResponse({ error: 'tier must be free, paid, or token-gated' }, 400);
  }

  const resolvedCreatorId = creatorId ?? `admin-${safeKey(body.subject)}`;
  const postId = body.postId ?? `manual-${Date.now()}`;

  try {
    const result = await engine.sendNewsletter({
      creatorId: resolvedCreatorId,
      postId,
      subject: body.subject,
      html: body.html,
      tier: body.tier,
      minTokenHold: body.minTokenHold,
    });

    return jsonResponse(
      {
        ok: true,
        result,
      },
      result.success ? 200 : 500,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Send failed: ${msg}` }, 500);
  }
}

// ─── GET /api/newsletter/creator/subscribers ────────────────

export async function handleCreatorNewsletterSubscribers(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const creatorId = getCreatorId(request, env);
  if (!creatorId) {
    return jsonResponse({ error: 'Session required' }, 401);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  const url = new URL(request.url);
  const tier = url.searchParams.get('tier') ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get('page')) ?? 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) ?? 50));

  try {
    const subs = await engine.getSubscribers(creatorId, { tier });
    const total = subs.length;
    const start = (page - 1) * limit;
    const paged = subs.slice(start, start + limit);

    return noCacheJsonResponse({
      subscribers: paged.map((s) => ({
        email: s.email,
        tier: s.tier,
        subscribedAt: s.subscribedAt,
        active: s.active,
      })),
      total,
      page,
      limit,
      hasMore: start + limit < total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get subscribers: ${msg}` }, 500);
  }
}

// ─── POST /api/newsletter/creator/subscribe ─────────────────

export async function handleCreatorNewsletterSubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  let body: { email: string; creatorId?: string; tier?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email' }, 400);
  }

  const tier = body.tier ?? 'free';
  if (!['free', 'paid', 'token-gated'].includes(tier)) {
    return jsonResponse({ error: 'tier must be free, paid, or token-gated' }, 400);
  }

  // Resolve creator ID: from body, session, or admin header
  const sessionCreatorId = getCreatorId(request, env);
  const creatorId = body.creatorId ?? sessionCreatorId;
  if (!creatorId) {
    return jsonResponse({ error: 'creatorId required' }, 400);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  try {
    // Check if already unsubscribed globally
    const unsubscribed = await engine.isUnsubscribed(email);
    if (unsubscribed) {
      // Re-allow if they explicitly resubscribe
      // Remove from global unsubscribed list
    }

    await engine.addSubscriber(creatorId, email, tier);

    // Send welcome email for free tier
    if (tier === 'free') {
      // Fire and forget — don't block on welcome email
      engine.sendWelcomeEmail(email, creatorId).catch(() => {});
    }

    return jsonResponse(
      {
        ok: true,
        email,
        tier,
        creatorId,
        action: 'subscribed',
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── DELETE /api/newsletter/creator/subscribe ───────────────

export async function handleCreatorNewsletterUnsubscribe(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  let body: { email: string; creatorId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Invalid email' }, 400);
  }

  const sessionCreatorId = getCreatorId(request, env);
  const creatorId = body.creatorId ?? sessionCreatorId;
  if (!creatorId) {
    return jsonResponse({ error: 'creatorId or session required' }, 400);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  try {
    await engine.removeSubscriber(creatorId, email);
    await engine.handleUnsubscribe(email);
    return jsonResponse({ ok: true, email, creatorId, action: 'unsubscribed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/newsletter/creator/count ──────────────────────

export async function handleCreatorNewsletterCount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const creatorId = getCreatorId(request, env);
  if (!creatorId) {
    return jsonResponse({ error: 'Session required' }, 401);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  try {
    const counts = await engine.getSubscriberCount(creatorId);
    return noCacheJsonResponse({
      total: counts.free + counts.paid + counts.token,
      ...counts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/newsletter/creator/stats/:postId ──────────────

export async function handleCreatorNewsletterStats(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const postId = url.pathname.split('/').pop();
  if (!postId || postId === 'stats') {
    return jsonResponse({ error: 'postId required' }, 400);
  }

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  try {
    const stats = await engine.getNewsletterStats(postId);
    return noCacheJsonResponse(stats);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── POST /api/newsletter/creator/webhook/mailgun ──────────

export async function handleMailgunWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const engine = createEngine(env);
  if (!engine) {
    return jsonResponse({ error: 'Email engine not configured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Mailgun sends webhooks with signature verification
  const signature = body.signature as Record<string, string> | undefined;
  if (signature) {
    // Verify Mailgun webhook signature
    const token = signature.token ?? '';
    const timestamp = signature.timestamp ?? '';
    const sig = signature.signature ?? '';
    const apiKey = env.MAILGUN_API_KEY ?? '';

    // Simple HMAC verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(apiKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const data = encoder.encode(`${timestamp}${token}`);
    const expectedSig = await crypto.subtle.sign('HMAC', key, data);
    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (sig !== expectedHex) {
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }
  }

  const eventData = body['event-data'] as Record<string, unknown> | undefined;
  const event = (eventData?.event as string) ?? (body.event as string);

  if (event) {
    await engine.processMailgunWebhook(event, body);
  }

  // Always return 200 to acknowledge receipt
  return jsonResponse({ ok: true });
}

// ─── GET /api/newsletter/creator/health ─────────────────────

export async function handleCreatorNewsletterHealth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const engine = createEngine(env);
  const status = engine
    ? await engine.healthCheck()
    : { mailgun: false, sendgrid: false, configured: false, mode: 'none' as const };

  return jsonResponse({
    status: status.configured ? 'ok' : 'not_configured',
    engine: status,
    env: {
      mailgunKey: env.MAILGUN_API_KEY ? '✓ configured' : '✗ missing',
      mailgunDomain: env.MAILGUN_DOMAIN ? '✓ configured' : '✗ missing',
      sendgridKey: env.SENDGRID_API_KEY ? '✓ configured' : '✗ missing',
      fromAddress: env.EMAIL_FROM_ADDRESS ? '✓ configured' : '✗ missing',
    },
  });
}
