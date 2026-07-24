/**
 * @degenfeed/api-worker — Scheduled post route
 *
 * POST /api/schedule   — Schedule a cross-platform post
 * GET  /api/scheduled  — List active scheduled posts for the current user
 *
 * Premium gating:
 *   Free users:   max 5 active scheduled posts
 *   Pro+:         unlimited
 *
 * The GET endpoint requires authentication and returns all scheduled posts
 * (pending, published, failed) for the requesting user, newest first.
 */

import { type Env, jsonResponse } from '../index';
import { requirePremiumTier } from '../premium';
import { requireSession } from '../session';

/** Scheduled post KV prefix */
const SCHEDULED_PREFIX = 'scheduled:';
/** Per-user index KV key */
function userScheduledKey(wallet: string): string {
  return `user:scheduled:${wallet.toLowerCase()}`;
}
/** Full KV key for a scheduled post */
function scheduledKey(id: string): string {
  return `${SCHEDULED_PREFIX}${id}`;
}

export interface ScheduledEntry {
  id: string;
  text: string;
  targets: string[];
  scheduledAt: string;
  createdAt: string;
  status: 'pending' | 'published' | 'failed';
  wallet: string;
  retries?: number;
  lastError?: string;
}

export async function handleSchedulePost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ── Require authentication ──────────────────────────────────────
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  // ── Parse body ──────────────────────────────────────────────────
  let body: {
    text: string;
    targets: string[];
    scheduledAt: string;
  };
  try {
    body = (await request.json()) as {
      text: string;
      targets: string[];
      scheduledAt: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { text, targets, scheduledAt } = body;

  if (!text || !targets?.length || !scheduledAt) {
    return jsonResponse({ error: 'text, targets, and scheduledAt required' }, 400);
  }

  // ── Premium gate: free users limited to 5 active scheduled posts ──
  const activeCount = await countActiveScheduledPosts(env, wallet);
  const gate = await requirePremiumTier(wallet, env, 'pro');
  if (gate && activeCount >= 5) {
    return gate;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entry: ScheduledEntry = {
    id,
    text,
    targets,
    scheduledAt,
    createdAt: now,
    status: 'pending',
    wallet,
  };

  try {
    // Store the scheduled post with 30-day TTL
    await env.CACHE?.put(scheduledKey(id), JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });

    // Add to user's scheduled post index
    await addToUserIndex(env, wallet, id);

    return jsonResponse({ ok: true, id, status: 'pending' });
  } catch {
    return jsonResponse({ error: 'Failed to persist scheduled post' }, 500);
  }
}

// ─── GET /api/scheduled — List user's scheduled posts ────────────────

// ─── PUT /api/schedule/:id — Update scheduled post ───────────────────────

export async function handleUpdateScheduledPost(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  // Parse body
  let body: {
    text?: string;
    targets?: string[];
    scheduledAt?: string;
  };
  try {
    body = (await request.json()) as {
      text?: string;
      targets?: string[];
      scheduledAt?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Fetch existing entry
  try {
    const raw = await env.CACHE?.get(scheduledKey(postId));
    if (!raw) {
      return jsonResponse({ error: 'Scheduled post not found' }, 404);
    }
    const existing = JSON.parse(raw) as ScheduledEntry;

    // Verify ownership
    if (existing.wallet.toLowerCase() !== wallet) {
      return jsonResponse({ error: 'Not your scheduled post' }, 403);
    }

    if (existing.status !== 'pending') {
      return jsonResponse({ error: 'Can only update pending scheduled posts' }, 400);
    }

    // Merge updates
    const updated: ScheduledEntry = {
      ...existing,
      text: body.text ?? existing.text,
      targets: body.targets ?? existing.targets,
      scheduledAt: body.scheduledAt ?? existing.scheduledAt,
    };

    await env.CACHE?.put(scheduledKey(postId), JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 30,
    });

    return jsonResponse({ ok: true, id: postId, status: 'updated' });
  } catch {
    return jsonResponse({ error: 'Failed to update scheduled post' }, 500);
  }
}

// ─── DELETE /api/schedule/:id — Delete scheduled post ─────────────────────

export async function handleDeleteScheduledPost(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  try {
    const raw = await env.CACHE?.get(scheduledKey(postId));
    if (!raw) {
      return jsonResponse({ error: 'Scheduled post not found' }, 404);
    }
    const existing = JSON.parse(raw) as ScheduledEntry;

    if (existing.wallet.toLowerCase() !== wallet) {
      return jsonResponse({ error: 'Not your scheduled post' }, 403);
    }

    await env.CACHE?.delete(scheduledKey(postId));
    await removeFromUserIndex(env, wallet, postId);

    return jsonResponse({ ok: true, id: postId, status: 'deleted' });
  } catch {
    return jsonResponse({ error: 'Failed to delete scheduled post' }, 500);
  }
}

// ─── POST /api/schedule/:id/publish-now — Publish immediately ────────────

export async function handlePublishNow(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  try {
    const raw = await env.CACHE?.get(scheduledKey(postId));
    if (!raw) {
      return jsonResponse({ error: 'Scheduled post not found' }, 404);
    }
    const entry = JSON.parse(raw) as ScheduledEntry;

    if (entry.wallet.toLowerCase() !== wallet) {
      return jsonResponse({ error: 'Not your scheduled post' }, 403);
    }

    if (entry.status !== 'pending') {
      return jsonResponse({ error: 'Post already published or failed' }, 400);
    }

    // Create synthetic request for the publish handler
    const publishBody = JSON.stringify({
      text: entry.text,
      targets: entry.targets,
    });

    // Import and call the publish handler
    const { handlePublish } = await import('./publish');
    const syntheticRequest = new Request(request.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('Cookie') || '',
        'X-CSRF-Token': request.headers.get('X-CSRF-Token') || '',
      },
      body: publishBody,
    });

    const result = await handlePublish(syntheticRequest, env);
    const resultData = (await result.json()) as {
      ok?: boolean;
      results?: Record<string, unknown>;
      error?: string;
    };

    if (result.ok && resultData.ok) {
      // Mark as published
      entry.status = 'published';
      await env.CACHE?.put(scheduledKey(postId), JSON.stringify(entry), {
        expirationTtl: 60 * 60 * 24 * 30,
      });
      await removeFromUserIndex(env, wallet, postId);

      return jsonResponse({
        ok: true,
        id: postId,
        status: 'published',
        results: resultData.results,
      });
    }

    // Mark as failed
    entry.status = 'failed';
    entry.lastError = resultData.error || 'Publish returned error';
    entry.retries = (entry.retries || 0) + 1;
    await env.CACHE?.put(scheduledKey(postId), JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 30,
    });

    return jsonResponse(
      {
        ok: false,
        id: postId,
        status: 'failed',
        error: resultData.error || 'Publish failed',
      },
      502,
    );
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to publish now',
    });
  }
}

// ─── POST /api/schedule — List user's scheduled posts ────────────────

export async function handleListScheduledPosts(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();
  const ids = await getUserScheduledIds(env, wallet);

  const posts: Array<{
    id: string;
    text: string;
    targets: string[];
    scheduledAt: string;
    createdAt: string;
    status: string;
    retries?: number;
    lastError?: string;
  }> = [];

  for (const id of ids) {
    try {
      const raw = await env.CACHE?.get(scheduledKey(id));
      if (!raw) continue;
      const entry = JSON.parse(raw) as ScheduledEntry;
      posts.push({
        id: entry.id,
        text: entry.text.slice(0, 200),
        targets: entry.targets,
        scheduledAt: entry.scheduledAt,
        createdAt: entry.createdAt,
        status: entry.status,
        retries: entry.retries,
        lastError: entry.lastError,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return jsonResponse({ posts });
}

// ─── User index helpers ─────────────────────────────────────────

export async function getUserScheduledIds(env: Env, wallet: string): Promise<string[]> {
  if (!env.CACHE) return [];
  try {
    const raw = await env.CACHE.get(userScheduledKey(wallet));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Remove a post ID from the user's scheduled index.
 * Called by the cron executor after a successful publish.
 */
export async function removeFromUserIndex(env: Env, wallet: string, postId: string): Promise<void> {
  try {
    const key = userScheduledKey(wallet);
    const ids = await getUserScheduledIds(env, wallet);
    const filtered = ids.filter((id) => id !== postId);
    await env.CACHE?.put(key, JSON.stringify(filtered), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch {
    // Non-fatal
  }
}

async function addToUserIndex(env: Env, wallet: string, id: string): Promise<void> {
  const ids = await getUserScheduledIds(env, wallet);
  ids.unshift(id);
  // Keep at most 100 entries per user
  const trimmed = ids.slice(0, 100);
  try {
    await env.CACHE?.put(userScheduledKey(wallet), JSON.stringify(trimmed), {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  } catch {
    // Non-fatal — the post is already stored
  }
}

/**
 * Count active (pending) scheduled posts for a wallet.
 * Returns a number; on error returns 0 (fail open for count purposes,
 * but premium gate still catches free users).
 */
async function countActiveScheduledPosts(env: Env, wallet: string): Promise<number> {
  const ids = await getUserScheduledIds(env, wallet);
  if (ids.length === 0) return 0;

  let active = 0;
  const now = new Date().toISOString();

  for (const id of ids) {
    try {
      const raw = await env.CACHE?.get(scheduledKey(id));
      if (!raw) continue;
      const entry = JSON.parse(raw) as ScheduledEntry;
      // Count only pending posts that haven't passed their scheduled time
      if (entry.status === 'pending' && entry.scheduledAt > now) {
        active++;
      }
    } catch {
      // Skip malformed entries
    }
  }

  return active;
}
