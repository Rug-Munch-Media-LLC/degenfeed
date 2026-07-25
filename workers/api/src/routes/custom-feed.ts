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

import { scorePost } from '@degenfeed/ranking';
import type { CustomFeed, FeedRecipe, Protocol, UnifiedPost } from '@degenfeed/types';
import { ContentPipeline } from '../feed/content-pipeline';
import { type Env, jsonResponse, log, noCacheJsonResponse } from '../index';
import { requirePremiumTier } from '../premium';
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
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'reddit',
  'rss',
  'lemmy',
  'peertube',
  'youtube',
] as const;

const VALID_CONTENT_TYPES = ['text', 'image', 'video', 'link', 'thread'] as const;

function validateRecipe(config: unknown): config is FeedRecipe {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  if (!Array.isArray(c.sources) || c.sources.length === 0) return false;
  if (
    !c.sources.every((s: unknown) => VALID_SOURCES.includes(s as (typeof VALID_SOURCES)[number]))
  ) {
    return false;
  }
  if (!c.topics || typeof c.topics !== 'object') return false;
  if (c.minEngagement !== undefined && (typeof c.minEngagement !== 'number' || c.minEngagement < 0))
    return false;
  if (
    c.contentTypes &&
    (!Array.isArray(c.contentTypes) ||
      !c.contentTypes.every((t: unknown) =>
        VALID_CONTENT_TYPES.includes(t as (typeof VALID_CONTENT_TYPES)[number]),
      ))
  )
    return false;
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

    // ── Premium gate: free users limited to 2 feeds, Pro+ unlimited ──
    const existingIds = await getUserFeedIds(env, session.address);
    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate && existingIds.length >= 2) {
      // Free user at limit — block with premium upgrade prompt
      return gate;
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
    try {
      publicIds = JSON.parse(indexRaw) as string[];
    } catch {
      /* KV operation failed -- non-critical, continue */
    }
  }

  // If no index, we can't scan KV — return empty with a note
  if (publicIds.length === 0) {
    return noCacheJsonResponse({
      feeds: [],
      meta: { note: 'No public feeds yet' },
    });
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
 * Supports ?preview=true to include the first 5 posts as a preview.
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
  const response: Record<string, unknown> = {
    feed,
    subscriberCount: subscribers.length,
  };

  // Include preview posts when ?preview=true
  const url = new URL(request.url);
  if (url.searchParams.get('preview') === 'true') {
    try {
      const pipeline = new ContentPipeline(env);
      const feedResult = await pipeline.buildFeed({
        protocols: feed.config.sources as Protocol[],
        sort: 'trending',
        limit: 5,
        niches: Object.entries(feed.config.topics)
          .filter(([, w]) => w > 0)
          .map(([t]) => t),
        contentTypes: feed.config.contentTypes.length > 0 ? feed.config.contentTypes : undefined,
        minEngagement: feed.config.minEngagement > 0 ? feed.config.minEngagement : undefined,
        excludeTopics: feed.config.excludeTopics.length > 0 ? feed.config.excludeTopics : undefined,
        excludeWords: feed.config.excludeWords.length > 0 ? feed.config.excludeWords : undefined,
        language: feed.config.language || undefined,
        creatorFilter: feed.config.creatorFilter?.length ? feed.config.creatorFilter : undefined,
      });
      response.preview = feedResult.posts.slice(0, 5);
    } catch (err) {
      log('warn', `[custom-feed] preview failed for ${id}`, err);
      response.preview = [];
    }
  }

  return noCacheJsonResponse(response);
}

// ─── Execute cache helpers ────────────────────────────────────────

const EXECUTE_CACHE_TTL = 60; // 60s primary TTL
const EXECUTE_STALE_TTL = 300; // 5min stale-while-revalidate window

function executeCacheKey(id: string, sort: string, cursor: string): string {
  return `custom-feed:execute:${id}:${sort}:${cursor || '0'}`;
}

/**
 * GET /api/custom-feeds/:id/execute — Execute a custom feed recipe
 *
 * Loads the recipe from KV, runs the content pipeline with the recipe's
 * filters, scores results with the unified scorer, caches in KV, and
 * returns paginated posts.
 *
 * Query params:
 *   sort   — recent | trending | top  (default: trending)
 *   limit  — max posts per page (max 100, default 50)
 *   cursor — pagination cursor
 */
export async function handleCustomFeedExecute(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const feed = await getFeed(env, id);
  if (!feed) {
    return jsonResponse({ error: 'Feed not found' }, 404);
  }

  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') || 'trending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
  const cursor = url.searchParams.get('cursor') || '';

  // Build sort mode for pipeline
  let pipelineSort: 'trending' | 'newest' | 'curated' | 'for-you';
  switch (sort) {
    case 'recent':
      pipelineSort = 'newest';
      break;
    case 'top':
      // Top = highest engagement, treated as trending but without freshness boost
      pipelineSort = 'trending';
      break;
    default:
      pipelineSort = 'trending';
      break;
  }

  // ── Check KV cache (with stale-while-revalidate) ──────────────
  const cacheKey = executeCacheKey(id, sort, cursor);
  const cachedRaw = await env.CUSTOM_FEEDS?.get(cacheKey);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as {
        posts: UnifiedPost[];
        nextCursor?: string;
        cachedAt: number;
      };
      // Serve fresh if within TTL
      if (Date.now() - cached.cachedAt < EXECUTE_CACHE_TTL * 1000) {
        return jsonResponse({
          data: cached.posts,
          meta: {
            total: cached.posts.length,
            nextCursor: cached.nextCursor,
            sort,
            generatedAt: cached.cachedAt,
          },
        });
      }
      // Stale but serve while revalidating in background
      if (Date.now() - cached.cachedAt < EXECUTE_STALE_TTL * 1000) {
        // Trigger background refresh (fire-and-forget)
        void refreshExecuteCache(env, feed, cacheKey, sort, pipelineSort, limit).catch(() => {});
        return jsonResponse({
          data: cached.posts,
          meta: {
            total: cached.posts.length,
            nextCursor: cached.nextCursor,
            sort,
            generatedAt: cached.cachedAt,
            stale: true,
          },
        });
      }
    } catch {
      // Corrupted cache — ignore and rebuild
    }
  }

  // ── Execute feed pipeline ───────────────────────────────────────
  try {
    const pipeline = new ContentPipeline(env);

    // Build niche preference set from recipe topics
    const boostedNiches = Object.entries(feed.config.topics)
      .filter(([, w]) => w > 0)
      .map(([t]) => t);

    const feedResult = await pipeline.buildFeed({
      protocols: feed.config.sources as Protocol[],
      sort: pipelineSort,
      limit,
      cursor: cursor || undefined,
      niches: boostedNiches.length > 0 ? boostedNiches : undefined,
      contentTypes: feed.config.contentTypes.length > 0 ? feed.config.contentTypes : undefined,
      minEngagement: feed.config.minEngagement > 0 ? feed.config.minEngagement : undefined,
      excludeTopics: feed.config.excludeTopics.length > 0 ? feed.config.excludeTopics : undefined,
      excludeWords: feed.config.excludeWords.length > 0 ? feed.config.excludeWords : undefined,
      language: feed.config.language || undefined,
      creatorFilter: feed.config.creatorFilter?.length ? feed.config.creatorFilter : undefined,
    });

    // Apply unified scorer to each post for ranking transparency
    const scored = feedResult.posts.map((post) => {
      const result = scorePost(post, {
        mode: 'standard',
        now: Date.now(),
      });
      return {
        ...post,
        score: {
          total: result.total,
          recency: result.breakdown.recency,
          engagement: result.breakdown.engagement,
          relevance: result.breakdown.relevance,
          quality: result.breakdown.quality,
          diversity: result.breakdown.diversity,
          source: result.breakdown.source,
          velocity: result.breakdown.velocity,
          reasons: result.breakdown.reasons,
        },
      };
    });

    // For "top" sort: re-rank by raw engagement (ignoring freshness)
    let sorted = scored;
    if (sort === 'top') {
      sorted = [...scored].sort((a, b) => {
        const aEng = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3;
        const bEng = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3;
        return bEng - aEng;
      });
    }

    const response = {
      data: sorted.slice(0, limit),
      meta: {
        total: sorted.slice(0, limit).length,
        nextCursor: sorted.length > limit ? String(sorted[limit - 1]?.createdAt ?? '') : undefined,
        sort,
        generatedAt: Date.now(),
      },
    };

    // ── Cache the result ─────────────────────────────────────────
    if (env.CUSTOM_FEEDS) {
      const cachePayload = {
        posts: response.data,
        nextCursor: response.meta.nextCursor,
        cachedAt: Date.now(),
      };
      void env.CUSTOM_FEEDS.put(cacheKey, JSON.stringify(cachePayload), {
        expirationTtl: EXECUTE_CACHE_TTL,
      });
    }

    return jsonResponse(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    log('error', `[custom-feed] execute failed for ${id}`, err);
    return jsonResponse({ error: message, meta: { sort, total: 0 } }, 500);
  }
}

/**
 * Background refresh for stale cache entries.
 */
async function refreshExecuteCache(
  env: Env,
  feed: CustomFeed,
  cacheKey: string,
  _sort: string,
  pipelineSort: 'trending' | 'newest' | 'curated' | 'for-you',
  limit: number,
): Promise<void> {
  try {
    const pipeline = new ContentPipeline(env);

    const boostedNiches = Object.entries(feed.config.topics)
      .filter(([, w]) => w > 0)
      .map(([t]) => t);

    const feedResult = await pipeline.buildFeed({
      protocols: feed.config.sources as Protocol[],
      sort: pipelineSort,
      limit,
      niches: boostedNiches.length > 0 ? boostedNiches : undefined,
      contentTypes: feed.config.contentTypes.length > 0 ? feed.config.contentTypes : undefined,
      minEngagement: feed.config.minEngagement > 0 ? feed.config.minEngagement : undefined,
      excludeTopics: feed.config.excludeTopics.length > 0 ? feed.config.excludeTopics : undefined,
      excludeWords: feed.config.excludeWords.length > 0 ? feed.config.excludeWords : undefined,
      language: feed.config.language || undefined,
      creatorFilter: feed.config.creatorFilter?.length ? feed.config.creatorFilter : undefined,
    });

    const payload = {
      posts: feedResult.posts.slice(0, limit),
      nextCursor: feedResult.nextCursor,
      cachedAt: Date.now(),
    };

    await env.CUSTOM_FEEDS?.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: EXECUTE_CACHE_TTL,
    });
  } catch {
    // Background refresh failure is non-critical
  }
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
  await env.CUSTOM_FEEDS?.delete(subscribersKey(id));

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
