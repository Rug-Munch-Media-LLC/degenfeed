/**
 * @degenfeed/api-worker — Lemmy Routes
 *
 * Comprehensive API for reading and writing to Lemmy communities.
 *
 * Endpoints:
 *   GET  /api/lemmy/feed            — Lemmy discussion feed (with "💬 Lemmy" badge)
 *   GET  /api/lemmy/community/:name — Community info + recent posts
 *   POST /api/lemmy/post            — Create post on Lemmy (cross-post from DegenFeed)
 *   POST /api/lemmy/comment         — Comment on a Lemmy post
 *   GET  /api/lemmy/trending        — Trending across Lemmy instances
 *   GET  /api/lemmy/instances       — List known healthy instances
 *   GET  /api/lemmy/post/:id        — Get single post with comments
 *
 * Integration notes:
 *   - Lemmy is already a feed provider (LemmyProvider in feed-providers).
 *     This route file adds targeted querying, write operations, and
 *     trending detection on top of the existing provider.
 *   - The main feed already includes Lemmy posts via the pipeline.
 *     These routes are for direct interaction.
 *   - Write operations require Lemmy auth credentials (configured via
 *     env vars or passed in the request body for user-write).
 */

import { LemmyClient, lemmyToUnifiedPost } from '@degenfeed/lemmy-sdk';
import { type Env, jsonResponse } from '../index';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';

// ─── Constants ─────────────────────────────────────────────────────────

const INSTANCES = [
  'https://community.degenfeed.xyz',
  'https://talk.degenfeed.xyz',
  'https://lemmy.ml',
  'https://programming.dev',
  'https://beehaw.org',
  'https://sh.itjust.works',
];

const DEFAULT_FEED_LIMIT = 30;
const MAX_FEED_LIMIT = 100;
const _TRENDING_COMMUNITIES = [
  'crypto',
  'defi',
  'technology',
  'bitcoin',
  'ethereum',
  'solana',
  'security',
  'privacy',
  'ai',
  'opensource',
];

// ─── Helpers ───────────────────────────────────────────────────────────

function getClient(instanceUrl: string, jwt?: string): LemmyClient {
  return new LemmyClient(instanceUrl, jwt);
}

function parseLimit(raw: string | null, defaultVal: number = DEFAULT_FEED_LIMIT): number {
  const n = Number(raw);
  return Number.isNaN(n) || n < 1 ? defaultVal : Math.min(n, MAX_FEED_LIMIT);
}

// ─── GET /api/lemmy/feed — Discussion feed ────────────────────────────

export async function handleLemmyFeed(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.searchParams.get('instance') || INSTANCES[0];
  const sort = url.searchParams.get('sort') || 'Hot';
  const limit = parseLimit(url.searchParams.get('limit'), DEFAULT_FEED_LIMIT);

  try {
    const client = getClient(instance);
    const posts = await client.getPosts('all', {
      sort: sort as 'Hot' | 'New' | 'Active' | 'TopAll' | 'MostComments',
      limit: Math.min(limit, 50),
    });

    const unified = posts.map((pv) =>
      lemmyToUnifiedPost(pv, {
        instanceUrl: instance,
        community: {
          name: pv.community.name,
          title: pv.community.title,
          icon: pv.community.icon,
          actorId: pv.community.actor_id,
          subscriberCount: pv.counts ? undefined : undefined,
        },
      }),
    );

    return jsonResponse({
      data: unified,
      meta: {
        total: unified.length,
        instance,
        sort,
        limit,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to fetch Lemmy feed',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── GET /api/lemmy/community/:name — Community info + posts ──────────

export async function handleLemmyCommunity(
  request: Request,
  _env: Env,
  name: string,
): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.searchParams.get('instance') || INSTANCES[0];
  const sort = url.searchParams.get('sort') || 'Hot';
  const limit = parseLimit(url.searchParams.get('limit'), 20);

  try {
    const client = getClient(instance);

    // Get community details
    const communityView = await client.getCommunity(name);
    const posts = await client.getPosts(name, {
      sort: sort as 'Hot' | 'New' | 'Active' | 'TopAll' | 'MostComments',
      limit,
    });

    const unified = posts.map((pv) =>
      lemmyToUnifiedPost(pv, {
        instanceUrl: instance,
        community: {
          name: pv.community.name,
          title: pv.community.title,
          icon: pv.community.icon,
          actorId: pv.community.actor_id,
          subscriberCount: communityView.counts.subscribers,
          usersActiveMonth: communityView.counts.users_active_month,
        },
      }),
    );

    return jsonResponse({
      community: {
        id: communityView.community.id,
        name: communityView.community.name,
        title: communityView.community.title,
        description: communityView.community.description,
        icon: communityView.community.icon,
        actorId: communityView.community.actor_id,
        local: communityView.community.local,
        nsfw: communityView.community.nsfw,
        subscribers: communityView.counts.subscribers,
        usersActiveMonth: communityView.counts.users_active_month,
        posts: communityView.counts.posts,
        comments: communityView.counts.comments,
      },
      posts: unified,
      meta: {
        total: unified.length,
        instance,
        sort,
        limit,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to fetch community',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── POST /api/lemmy/post — Create post on Lemmy (cross-post) ────────

export async function handleLemmyPostCreate(request: Request, env: Env): Promise<Response> {
  // Requires session for authenticated user
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      instance?: string;
      communityId?: number;
      communityName?: string;
      title?: string;
      body?: string;
      url?: string;
      nsfw?: boolean;
      jwt?: string;
    };

    const instance = body.instance || INSTANCES[0];
    const communityId = body.communityId;
    const communityName = body.communityName;
    const name = sanitizeString(body.title, 250);
    const postBody = sanitizeString(body.body, 50000) || undefined;
    const url = body.url ? sanitizeString(body.url, 2048) : undefined;
    const nsfw = body.nsfw ?? false;
    const jwt = body.jwt || env.LEMMY_BOT_JWT;

    if (!name) {
      return jsonResponse({ error: 'title is required' }, 400);
    }

    if (!communityId && !communityName) {
      return jsonResponse({ error: 'communityId or communityName is required' }, 400);
    }

    if (!jwt) {
      return jsonResponse(
        { error: 'Lemmy auth required. Provide jwt or configure LEMMY_BOT_JWT' },
        401,
      );
    }

    const client = getClient(instance, jwt);

    // If only communityName provided, resolve to communityId
    let resolvedCommunityId = communityId;
    if (!resolvedCommunityId && communityName) {
      const communityView = await client.getCommunity(communityName);
      resolvedCommunityId = communityView.community.id;
    }

    if (!resolvedCommunityId) {
      return jsonResponse({ error: 'Could not resolve community' }, 400);
    }

    const created = await client.createPost({
      communityId: resolvedCommunityId,
      name,
      body: postBody,
      url,
      nsfw,
      languageId: 37, // English
    });

    return jsonResponse({
      success: true,
      post: {
        id: created.post.id,
        name: created.post.name,
        url: created.post.ap_id,
        communityName: created.community.name,
        instance,
        permalink: `${instance}/post/${created.post.id}`,
      },
      meta: {
        createdAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to create post',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── POST /api/lemmy/comment — Comment on a Lemmy post ───────────────

export async function handleLemmyCommentCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      instance?: string;
      postId?: number;
      content?: string;
      parentId?: number;
      jwt?: string;
    };

    const instance = body.instance || INSTANCES[0];
    const postId = body.postId;
    const content = sanitizeString(body.content, 50000);
    const parentId = body.parentId;
    const jwt = body.jwt || env.LEMMY_BOT_JWT;

    if (!postId) {
      return jsonResponse({ error: 'postId is required' }, 400);
    }

    if (!content) {
      return jsonResponse({ error: 'content is required' }, 400);
    }

    if (!jwt) {
      return jsonResponse(
        { error: 'Lemmy auth required. Provide jwt or configure LEMMY_BOT_JWT' },
        401,
      );
    }

    const client = getClient(instance, jwt);
    const created = await client.createComment(postId, content, parentId);

    return jsonResponse({
      success: true,
      comment: {
        id: created.comment.id,
        content: created.comment.content,
        postId: created.comment.post_id,
        permalink: `${instance}/comment/${created.comment.id}`,
      },
      meta: {
        createdAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to create comment',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── GET /api/lemmy/trending — Trending across Lemmy instances ───────

export async function handleLemmyTrending(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'), 20);

  try {
    const results: Array<{
      post: {
        id: number;
        name: string;
        url?: string;
        communityName: string;
        instance: string;
        score: number;
        comments: number;
        published: string;
      };
      signal: string;
    }> = [];

    // Fetch Hot + MostComments from curated communities across instances
    const fetchPromises = INSTANCES.slice(0, 4).map(async (instance) => {
      const client = getClient(instance);

      // Try a few high-traffic communities for trending detection
      const communitySamples = ['crypto', 'technology', 'all'];
      const batch: Array<{ post: (typeof results)[0]['post']; signal: string }> = [];

      for (const comm of communitySamples) {
        try {
          const posts = await client.getPosts(comm, {
            sort: 'Hot',
            limit: 5,
          });

          for (const pv of posts) {
            const _engagementSignal =
              pv.counts.upvotes +
              pv.counts.comments * 3 +
              (pv.counts.score > 0 ? pv.counts.score * 2 : 0);

            batch.push({
              post: {
                id: pv.post.id,
                name: pv.post.name,
                url: pv.post.ap_id,
                communityName: pv.community.name,
                instance: new URL(instance).hostname,
                score: pv.counts.score,
                comments: pv.counts.comments,
                published: pv.post.published,
              },
              signal: `score=${pv.counts.score}+comments=${pv.counts.comments}`,
            });
          }
        } catch {
          // Skip failed communities
        }
      }

      return batch;
    });

    const settled = await Promise.allSettled(fetchPromises);
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value);
    }

    // Sort by engagement signal (descending)
    results.sort((a, b) => {
      const signalA = a.post.score + a.post.comments * 3;
      const signalB = b.post.score + b.post.comments * 3;
      return signalB - signalA;
    });

    const top = results.slice(0, limit);

    return jsonResponse({
      data: top,
      meta: {
        total: top.length,
        limit,
        instances: INSTANCES,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to fetch trending',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

// ─── GET /api/lemmy/instances — List known healthy instances ─────────

export async function handleLemmyInstances(_request: Request, _env: Env): Promise<Response> {
  const results: Array<{
    url: string;
    hostname: string;
    healthy: boolean;
    latencyMs?: number;
  }> = [];

  for (const instance of INSTANCES) {
    const start = performance.now();
    try {
      const client = getClient(instance);
      await client.getSite();
      results.push({
        url: instance,
        hostname: new URL(instance).hostname,
        healthy: true,
        latencyMs: Math.round(performance.now() - start),
      });
    } catch {
      results.push({
        url: instance,
        hostname: new URL(instance).hostname,
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
      });
    }
  }

  const healthy = results.filter((r) => r.healthy);

  return jsonResponse({
    instances: results,
    healthyCount: healthy.length,
    totalCount: results.length,
    checkedAt: Date.now(),
  });
}

// ─── GET /api/lemmy/post/:id — Get single post with comments ─────────

export async function handleLemmyPostById(
  request: Request,
  _env: Env,
  idParam: string,
): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.searchParams.get('instance') || INSTANCES[0];
  const postId = Number(idParam);

  if (Number.isNaN(postId) || postId < 1) {
    return jsonResponse({ error: 'Invalid post ID' }, 400);
  }

  try {
    const client = getClient(instance);
    const postView = await client.getPost(postId);
    const comments = await client.getComments(postId, { sort: 'Hot' });

    const unified = lemmyToUnifiedPost(postView, {
      instanceUrl: instance,
      community: {
        name: postView.community.name,
        title: postView.community.title,
        icon: postView.community.icon,
        subscriberCount: postView.counts ? undefined : undefined,
      },
    });

    return jsonResponse({
      post: unified,
      comments: comments.map((cv) => ({
        id: `lemmy:comment:${cv.comment.id}`,
        content: cv.comment.content,
        path: cv.comment.path,
        published: cv.comment.published,
        author: {
          name: cv.creator.name,
          displayName: cv.creator.display_name,
          avatar: cv.creator.avatar,
          actorId: cv.creator.actor_id,
        },
        score: cv.counts.score,
        upvotes: cv.counts.upvotes,
        downvotes: cv.counts.downvotes,
        myVote: cv.my_vote,
      })),
      meta: {
        instance,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to fetch post',
        message: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}
