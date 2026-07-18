/**
 * /api/custom-feeds — Custom feed recipes (Bluesky-style feed builder)
 *
 * POST   /api/custom-feeds            — Create a custom feed
 * GET    /api/custom-feeds            — List my custom feeds
 * GET    /api/custom-feeds/public     — List public feeds (discoverable)
 * GET    /api/custom-feeds/:id        — Get feed details
 * PUT    /api/custom-feeds/:id        — Update feed recipe
 * DELETE /api/custom-feeds/:id        — Delete feed
 * POST   /api/custom-feeds/:id/subscribe   — Subscribe to a public feed
 *
 * KV keys:
 *   custom-feed:{id}              → JSON CustomFeed
 *   user:custom-feeds:{wallet}    → JSON array of feed IDs (created by user)
 *   custom-feed:subscribers:{id}  → JSON array of wallet addresses
 *   user:subscriptions:{wallet}   → JSON array of feed IDs (subscribed to)
 */

import type { CustomFeed, FeedRecipe } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Helpers ──────────────────────────────────────────────────

function feedKey(id: string): string {
  return `custom-feed:${id}`;
}

function userFeedsKey(wallet: string): string {
  return `user:custom-feeds:${wallet.toLowerCase()}`;
}

function subscribersKey(id: string): string {
  return `custom-feed:subscribers:${id}`;
}

function subscriptionsKey(wallet: string): string {
  return `user:subscriptions:${wallet.toLowerCase()}`;
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const VALID_SOURCES = [
  'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon',
  'threads', 'reddit', 'rss', 'lemmy', 'peertube', 'youtube',
] as const;

const VALID_CONTENT_TYPES = ['text', 'image', 'video', 'link', 'thread'] as const;

function validateRecipe(config: unknown): config is FeedRecipe {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  if (!Array.isArray(c.sources) || c.sources.length === 0) return false;
  if (!c.sources.every((s: unknown) => VALID_SOURCES.includes(s as typeof VALID_SOURCES[number]))) {
    return false;
  }
  if (!c.topics || typeof c.topics !== 'object') return false;
  if (c.minEngagement !== undefined && (typeof c.minEngagement !== 'number' || c.minEngagement < 0)) return false;
  if (c.contentTypes && (!Array.isArray(c.contentTypes) || !c.contentTypes.every(
    (t: unknown) => VALID_CONTENT_TYPES.includes(t as typeof VALID_CONTENT_TYPES[number]),
  ))) return false;
  if (c.excludeTopics && !Array.isArray(c.excludeTopics)) return false;
  if (c.excludeWords && !Array.isArray(c.excludeWords)) return false;
  if (c.language !== undefined && typeof c.language !== 'string') return false;
  if (c.creatorFilter !== undefined && !Array.isArray(c.creatorFilter)) return false;
  return true;
}

// ─── KV helpers ───────────────────────────────────────────────

async function getFeed(env: Env, id: string): Promise<CustomFeed | null> {
  if (!env.CUSTOM_FEEDS) return null;
  const raw = await env.CUSTOM_FEEDS.get(feedKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomFeed;
  } catch {
    return null;
  }
}

async function putFeed(env: Env, feed: CustomFeed): Promise<void> {
  if (!env.CUSTOM_FEEDS) return;
  await env.CUSTOM_FEEDS.put(feedKey(feed.id), JSON.stringify(feed));
}

async function deleteFeed(env: Env, id: string): Promise<void> {
  if (!env.CUSTOM_FEEDS) return;
  await env.CUSTOM_FEEDS.delete(feedKey(id));
}

async function getUserFeedIds(env: Env, wallet: string): Promise<string[]> {
  if (!env.CUSTOM_FEEDS) return [];
  const raw = await env.CUSTOM_FEEDS.get(userFeedsKey(wallet));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function setUserFeedIds(env: Env, wallet: string, ids: string[]): Promise<void> {
  if (!env.CUSTOM_FEEDS) return;
  if (ids.length === 0) {
    await env.CUSTOM_FEEDS.delete(userFeedsKey(wallet));
  } else {
    await env.CUSTOM_FEEDS.put(userFeedsKey(wallet), JSON.stringify(ids));
  }
}

async function getSubscribers(env: Env, id: string): Promise<string[]> {
  if (!env.CUSTOM_FEEDS) return [];
  const raw = await env.CUSTOM_FEEDS.get(subscribersKey(id));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function setSubscribers(env: Env, id: string, wallets: string[]): Promise<void> {
  if (!env.CUSTOM_FEEDS) return;
  if (wallets.length === 0) {
    await env.CUSTOM_FEEDS.delete(subscribersKey(id));
  } else {
    await env.CUSTOM_FEEDS.put(subscribersKey(id), JSON.stringify(wallets));
  }
}

async function getUserSubscriptionIds(env: Env, wallet: string): Promise<string[]> {
  if (!env.CUSTOM_FEEDS) return [];
  const raw = await env.CUSTOM_FEEDS.get(subscriptionsKey(wallet));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function setUserSubscriptionIds(env: Env, wallet: string, ids: string[]): Promise<void> {
  if (!env.CUSTOM_FEEDS) return;
  if (ids.length === 0) {
    await env.CUSTOM_FEEDS.delete(subscriptionsKey(wallet));
  } else {
    await env.CUSTOM_FEEDS.put(subscriptionsKey(wallet), JSON.stringify(ids));
  }
}

// ─── Handlers ─────────────────────────────────────────────────

/**
 * POST /api/custom-feeds — Create a custom feed
 * Body: { name, description, isPublic, config }
 */
export async function handleCustomFeedCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.CUSTOM_FEEDS) {
    return jsonResponse({ error: 'Custom feeds storage not configured' }, 500);
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      isPublic?: boolean;
      config?: unknown;
    };

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return jsonResponse({ error: 'Feed name is required' }, 400);
    }
    if (body.name.length > 100) {
      return jsonResponse({ error: 'Feed name must be 100 characters or fewer' }, 400);
    }
    if (body.description && body.description.length > 500) {
      return jsonResponse({ error: 'Description must be 500 characters or fewer' }, 400);
    }
    if (!body.config || !validateRecipe(body.config)) {
      return jsonResponse({ error: 'Valid feed recipe config is required (sources, topics)' }, 400);
    }

    const id = generateId();
    const now = Date.now();
    const feed: CustomFeed = {
      id,
      name: body.name.trim(),
      description: (body.description || '').trim(),
      creator: session.address.toLowerCase(),
      isPublic: body.isPublic === true,
      config: body.config as FeedRecipe,
      createdAt: now,
      updatedAt: now,
      subscribers: 0,
    };

    await putFeed(env, feed);

    // Add to user's feed index
    const userIds = await getUserFeedIds(env, session.address);
    userIds.unshift(id);
    await setUserFeedIds(env, session.address, userIds);

    return jsonResponse({ ok: true, feed }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * GET /api/custom-feeds — List my custom feeds
 */
export async function handleCustomFeedList(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!env.CUSTOM_FEEDS) {
    return noCacheJsonResponse({ feeds: [] });
  }

  const ids = await getUserFeedIds(env, session.address);
  const feeds: CustomFeed[] = [];

  for (const id of ids) {
    const feed = await getFeed(env, id);
    if (feed) feeds.push(feed);
  }

  return noCacheJsonResponse({ feeds });
}

/**
 * GET /api/custom-feeds/public — List public custom feeds (discoverable)
 * Supports ?limit and ?cursor for pagination
 */
export async function handleCustomFeedPublic(request: Request, env: Env): Promise<Response> {
  // This is a simplified approach — in production you'd maintain a public feed index.
  // For now we scan the KVs that exist. With KV, a dedicated index is needed for scale.
  // We use a separate KV key `custom-feed:public-index` for paginated discovery.
  if (!env.CUSTOM_FEEDS) {
    return noCacheJsonResponse({ feeds: [] });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
  const cursor = url.searchParams.get('cursor') || '';

  // Try to get cached public index
  const indexRaw = await env.CUSTOM_FEEDS.get('custom-feed:public-index');
  let publicIds: string[] = [];
  if (indexRaw) {
    try { publicIds = JSON.parse(indexRaw) as string[]; } catch { /* ignore */ }
  }

  // If no index, we can't scan KV — return empty with a note
  if (publicIds.length === 0) {
    return noCacheJsonResponse({ feeds: [], meta: { note: 'No public feeds yet' } });
  }

  const startIdx = cursor ? publicIds.indexOf(cursor) + 1 : 0;
  if (startIdx < 0) {
    return noCacheJsonResponse({ feeds: [] });
  }

  const batch = publicIds.slice(startIdx, startIdx + limit);
  const feeds: CustomFeed[] = [];

  for (const id of batch) {
    const feed = await getFeed(env, id);
    if (feed) feeds.push(feed);
  }

  const nextCursor = startIdx + limit < publicIds.length ? publicIds[startIdx + limit] : undefined;

  return noCacheJsonResponse({
    feeds,
    meta: {
      total: publicIds.length,
      nextCursor,
    },
  });
}

/**
 * GET /api/custom-feeds/:id — Get feed details
 */
export async function handleCustomFeedGet(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const feed = await getFeed(env, id);
  if (!feed) {
    return jsonResponse({ error: 'Feed not found' }, 404);
  }

  const subscribers = await getSubscribers(env, id);

  return noCacheJsonResponse({ feed, subscriberCount: subscribers.length });
}

/**
 * PUT /api/custom-feeds/:id — Update feed recipe (creator only)
 * Body: { name?, description?, isPublic?, config? }
 */
export async function handleCustomFeedUpdate(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const feed = await getFeed(env, id);
  if (!feed) {
    return jsonResponse({ error: 'Feed not found' }, 404);
  }
  if (feed.creator.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the feed creator can update this feed' }, 403);
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      isPublic?: boolean;
      config?: unknown;
    };

    const now = Date.now();

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return jsonResponse({ error: 'Feed name cannot be empty' }, 400);
      }
      if (body.name.length > 100) {
        return jsonResponse({ error: 'Feed name must be 100 characters or fewer' }, 400);
      }
      feed.name = body.name.trim();
      feed.updatedAt = now;
    }

    if (body.description !== undefined) {
      if (body.description.length > 500) {
        return jsonResponse({ error: 'Description must be 500 characters or fewer' }, 400);
      }
      feed.description = body.description.trim();
      feed.updatedAt = now;
    }

    if (body.isPublic !== undefined) {
      feed.isPublic = body.isPublic;
      feed.updatedAt = now;
    }

    if (body.config !== undefined) {
      if (!validateRecipe(body.config)) {
        return jsonResponse({ error: 'Invalid feed recipe' }, 400);
      }
      feed.config = body.config as FeedRecipe;
      feed.updatedAt = now;
    }

    await putFeed(env, feed);

    return jsonResponse({ ok: true, feed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * DELETE /api/custom-feeds/:id — Delete feed (creator only)
 */
export async function handleCustomFeedDelete(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const feed = await getFeed(env, id);
  if (!feed) {
    return jsonResponse({ error: 'Feed not found' }, 404);
  }
  if (feed.creator.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'Only the feed creator can delete this feed' }, 403);
  }

  await deleteFeed(env, id);

  // Remove from user's feed index
  const userFeeds = await getUserFeedIds(env, session.address);
  const filtered = userFeeds.filter((fid) => fid !== id);
  await setUserFeedIds(env, session.address, filtered);

  // Remove subscribers index
  await env.CUSTOM_FEEDS!.delete(subscribersKey(id));

  return jsonResponse({ ok: true });
}

/**
 * POST /api/custom-feeds/:id/subscribe — Subscribe to a public feed
 */
export async function handleCustomFeedSubscribe(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const feed = await getFeed(env, id);
  if (!feed) {
    return jsonResponse({ error: 'Feed not found' }, 404);
  }
  if (!feed.isPublic) {
    return jsonResponse({ error: 'This feed is not public' }, 403);
  }

  const wallet = session.address.toLowerCase();

  // Check if already subscribed
  const subscribers = await getSubscribers(env, id);
  if (subscribers.includes(wallet)) {
    return jsonResponse({ error: 'Already subscribed' }, 409);
  }

  subscribers.push(wallet);
  await setSubscribers(env, id, subscribers);

  // Count is approximate but sufficient
  feed.subscribers = subscribers.length;
  await putFeed(env, feed);

  // Add to user's subscriptions
  const subs = await getUserSubscriptionIds(env, wallet);
  subs.push(id);
  await setUserSubscriptionIds(env, wallet, subs);

  return jsonResponse({ ok: true, subscribers: subscribers.length });
}
