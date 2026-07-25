/**
 * @degenfeed/api-worker — Ghost CMS Headless Routes
 *
 * Endpoints for the headless Ghost integration:
 *   GET    /api/ghost/posts           — List published articles
 *   GET    /api/ghost/posts/:slug     — Single article
 *   POST   /api/ghost/posts           — Create article (premium/admin)
 *   POST   /api/ghost/posts/:id/tip   — Tip the author
 *   POST   /api/ghost/posts/:id/cross-post — Cross-post to protocols
 *   POST   /api/ghost/newsletter/send — Send newsletter
 *   POST   /api/ghost/subscribe       — Subscribe to newsletter
 *   POST   /api/ghost/unsubscribe     — Unsubscribe from newsletter
 *   GET    /api/ghost/subscribers     — List subscribers (admin)
 */

import { GhostBridge, type Protocol } from '@degenfeed/ghost-bridge';
import type { Env } from '../index';
import { requireSession } from '../session';

// ─── Types ─────────────────────────────────────────────────────────

interface GhostEnv extends Env {
  GHOST_URL?: string;
  GHOST_ADMIN_KEY?: string;
  GHOST_CONTENT_KEY?: string;
  /** KV namespace for subscriber data */
  GHOST_SUBSCRIBERS?: KVNamespace;
  /** KV namespace for tip records */
  GHOST_TIPS?: KVNamespace;
  /** SendGrid/Mailgun API key for email */
  EMAIL_API_KEY?: string;
  /** Email provider: 'sendgrid' | 'mailgun' */
  EMAIL_PROVIDER?: string;
  /** From address for newsletter emails */
  EMAIL_FROM?: string;
}

function getBridge(env: GhostEnv): GhostBridge {
  const ghostUrl = env.GHOST_URL;
  const ghostAdminKey = env.GHOST_ADMIN_KEY;
  const ghostContentKey = env.GHOST_CONTENT_KEY;

  if (!ghostUrl || !ghostAdminKey) {
    const _throwErr = new Error('GHOST_URL and GHOST_ADMIN_KEY must be configured'); throw _throwErr;
  }

  return new GhostBridge({
    ghostUrl,
    ghostAdminKey,
    ghostContentKey,
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  const _respData = JSON.stringify(data); return new Response(_respData, {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
}

function noCacheJsonResponse(data: unknown, status = 200): Response {
  const _respData = JSON.stringify(data); return new Response(_respData, {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store, must-revalidate' },
  });
}

// ─── GET /api/ghost/posts — List published articles ───────────────

export async function handleGhostPosts(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit')) || 20;
    const tag = url.searchParams.get('tag') || undefined;
    const page = Number(url.searchParams.get('page')) || 1;

    const bridge = getBridge(env);
    const posts = await bridge.getPosts({ limit, tag });

    return noCacheJsonResponse({
      posts,
      meta: { total: posts.length, limit, page },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/ghost/posts/:slug — Single article ─────────────────

export async function handleGhostPostBySlug(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const slug = new URL(request.url).pathname.split('/').pop();
    if (!slug) return jsonResponse({ error: 'Slug required' }, 400);

    const bridge = getBridge(env);
    const post = await bridge.getPost(slug);

    return noCacheJsonResponse({ post });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      return jsonResponse({ error: 'Post not found' }, 404);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/posts — Create article ──────────────────────

export async function handleGhostPostCreate(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as {
      title: string;
      html: string;
      excerpt?: string;
      featuredImage?: string;
      tags?: string[];
      publishedAt?: string;
      subscriberOnly?: boolean;
      minTokenHold?: string;
    };

    if (!body.title || !body.html) {
      return jsonResponse({ error: 'title and html are required' }, 400);
    }

    const bridge = getBridge(env);
    const post = await bridge.createPost({
      title: body.title,
      html: body.html,
      excerpt: body.excerpt,
      featuredImage: body.featuredImage,
      tags: body.tags,
      publishedAt: body.publishedAt,
      subscriberOnly: body.subscriberOnly,
      minTokenHold: body.minTokenHold,
    });

    return jsonResponse({ post }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/posts/:id/tip — Tip the author ──────────────

export async function handleGhostTip(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const postId = new URL(request.url).pathname.split('/').slice(-2, -1)[0];
    if (!postId) return jsonResponse({ error: 'Post ID required' }, 400);

    const body = (await request.json()) as {
      currency: string;
      amount: string;
      fromAddress?: string;
      protocol?: string;
    };

    if (!body.currency || !body.amount) {
      return jsonResponse({ error: 'currency and amount are required' }, 400);
    }

    // Record tip in KV
    const tipRecord = {
      postId,
      tipper: session.address,
      currency: body.currency,
      amount: body.amount,
      fromAddress: body.fromAddress || session.address,
      protocol: body.protocol || 'direct',
      tippedAt: new Date().toISOString(),
    };

    if (env.GHOST_TIPS) {
      const tipKey = `tip:${postId}:${Date.now()}`;
      await env.GHOST_TIPS.put(tipKey, JSON.stringify(tipRecord));
    }

    return jsonResponse({
      ok: true,
      tip: tipRecord,
      message: `Tip of ${body.amount} ${body.currency} recorded. Thank you!`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/posts/:id/cross-post — Cross-post to protocols ──

export async function handleGhostCrossPost(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const postId = new URL(request.url).pathname.split('/').slice(-2, -1)[0];
    if (!postId) return jsonResponse({ error: 'Post ID required' }, 400);

    const body = (await request.json()) as { protocols?: Protocol[] };
    const protocols = body.protocols || ['nostr', 'farcaster', 'bluesky'];

    const bridge = getBridge(env);
    const result = await bridge.crossPublish(postId, protocols);

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/newsletter/send — Send newsletter ───────────

export async function handleGhostNewsletterSend(
  request: Request,
  env: GhostEnv,
): Promise<Response> {
  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const body = (await request.json()) as { postId: string; tier?: 'free' | 'paid' };
    if (!body.postId) return jsonResponse({ error: 'postId required' }, 400);

    const bridge = getBridge(env);
    const result = await bridge.sendNewsletter(body.postId);

    // Cross-post summary to all protocols
    try {
      const _post = await bridge.getPost(body.postId);
      await bridge.crossPublish(body.postId, ['nostr', 'farcaster', 'bluesky']);
    } catch {
      // Non-fatal — newsletter still sent
    }

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/subscribe — Subscribe to newsletter ─────────

export async function handleGhostSubscribe(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const body = (await request.json()) as {
      email: string;
      name?: string;
      tier?: 'free' | 'paid';
    };

    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
      return jsonResponse({ error: 'Valid email required' }, 400);
    }

    const tier = body.tier || 'free';

    // Store subscriber in KV
    const subscriber = {
      email: body.email.toLowerCase(),
      name: body.name || '',
      tier,
      subscribedAt: new Date().toISOString(),
      active: true,
    };

    if (env.GHOST_SUBSCRIBERS) {
      const key = `sub:${subscriber.email.replace(/[^a-z0-9@._-]/g, '_')}`;
      await env.GHOST_SUBSCRIBERS.put(key, JSON.stringify(subscriber));
    }

    // Also register with Ghost if Admin API is configured
    try {
      const bridge = getBridge(env);
      await bridge.subscribeMember(subscriber.email, tier === 'paid' ? 'Premium' : 'Free');
    } catch {
      // Ghost Admin API may not be available — KV storage is sufficient
    }

    return jsonResponse({
      ok: true,
      email: subscriber.email,
      tier,
      message:
        tier === 'paid'
          ? 'Subscribed to paid newsletter! Check your email for payment details.'
          : 'Subscribed to free newsletter! Check your email for confirmation.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/ghost/unsubscribe — Unsubscribe from newsletter ────

export async function handleGhostUnsubscribe(request: Request, env: GhostEnv): Promise<Response> {
  try {
    const body = (await request.json()) as { email: string };
    if (!body.email) return jsonResponse({ error: 'Email required' }, 400);

    const email = body.email.toLowerCase();

    if (env.GHOST_SUBSCRIBERS) {
      const key = `sub:${email.replace(/[^a-z0-9@._-]/g, '_')}`;
      const existing = await env.GHOST_SUBSCRIBERS.get(key);
      if (existing) {
        const sub = JSON.parse(existing) as Record<string, unknown>;
        sub.active = false;
        sub.unsubscribedAt = new Date().toISOString();
        await env.GHOST_SUBSCRIBERS.put(key, JSON.stringify(sub));
      }
    }

    return jsonResponse({ ok: true, email, message: 'Unsubscribed successfully.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── GET /api/ghost/subscribers — List subscribers (admin) ────────

export async function handleGhostSubscribers(_request: Request, env: GhostEnv): Promise<Response> {
  try {
    const subscribers: Array<Record<string, unknown>> = [];

    if (env.GHOST_SUBSCRIBERS) {
      const list = await env.GHOST_SUBSCRIBERS.list({ prefix: 'sub:' });
      for (const key of list.keys) {
        const raw = await env.GHOST_SUBSCRIBERS.get(key.name);
        if (raw) subscribers.push(JSON.parse(raw) as Record<string, unknown>);
      }
    }

    // Also try Ghost Admin API
    try {
      const bridge = getBridge(env);
      const members = await bridge.getSubscribers();
      for (const m of members) {
        if (!subscribers.some((s) => s.email === m.email)) {
          subscribers.push({
            email: m.email,
            name: m.name || '',
            tier: m.tier || 'free',
            subscribedAt: m.createdAt,
            active: m.subscribed,
          });
        }
      }
    } catch {
      // Ghost API may not be available — use KV data only
    }

    return noCacheJsonResponse({
      total: subscribers.length,
      subscribers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}
