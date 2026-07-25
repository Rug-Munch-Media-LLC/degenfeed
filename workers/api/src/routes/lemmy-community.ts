/**
 * @degenfeed/api-worker — Lemmy Community Management
 *
 * Create, moderate, and manage Lemmy communities on our instance
 * and across the fediverse.
 *
 * Endpoints:
 *   POST /api/lemmy/community/create        — Create community on our instance
 *   POST /api/lemmy/community/follow        — Subscribe/unsubscribe to community
 *   POST /api/lemmy/community/moderate      — Moderate: remove posts, ban users
 *   GET  /api/lemmy/community/:name/settings — Get community settings
 *   PUT  /api/lemmy/community/:name/settings — Update community settings
 *   POST /api/lemmy/post/vote               — Upvote/downvote a post
 *   POST /api/lemmy/comment/create          — Create a comment
 *
 * All write operations require a valid Lemmy JWT (from POST /api/lemmy/auth).
 */

import { type Env, jsonResponse, log } from '../index';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';

// ─── Constants ─────────────────────────────────────────────────────────

const LEMMY_INSTANCE_URL = 'https://community.degenfeed.xyz';
const LEMMY_API = `${LEMMY_INSTANCE_URL}/api/v3`;
const USER_AGENT = 'DegenFeed/0.1';
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 50000;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_SIDEBAR_LENGTH = 10000;

// ─── Helpers ───────────────────────────────────────────────────────────

function getJwtFromAuth(env: Env, bodyJwt?: string): string | null {
  return bodyJwt || env.LEMMY_BOT_JWT || null;
}

async function lemmyFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; jwt?: string } = {},
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': USER_AGENT,
  };
  if (options.jwt) headers.authorization = `Bearer ${options.jwt}`;

  try {
    const res = await fetch(`${LEMMY_API}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      data: { error: err instanceof Error ? err.message : 'Upstream error' },
    };
  }
}

// ─── POST /api/lemmy/community/create — Create community ─────────────

export async function handleLemmyCommunityCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    name?: string;
    title?: string;
    description?: string;
    sidebar?: string;
    nsfw?: boolean;
    discussionLanguages?: number[];
    jwt?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) {
    return jsonResponse(
      {
        error:
          'Lemmy auth required. Register via POST /api/lemmy/register or provide LEMMY_BOT_JWT',
      },
      401,
    );
  }

  const name = sanitizeString(body.name, 20)?.toLowerCase();
  if (!name || !/^[a-z0-9_]+$/.test(name)) {
    return jsonResponse(
      { error: 'Community name: lowercase letters, numbers, underscores only. 1-20 chars.' },
      400,
    );
  }

  const title = sanitizeString(body.title, MAX_TITLE_LENGTH);
  if (!title) {
    return jsonResponse({ error: 'Community title is required' }, 400);
  }

  try {
    const result = await lemmyFetch('/community', {
      method: 'POST',
      jwt,
      body: {
        name,
        title,
        description: sanitizeString(body.description, MAX_DESCRIPTION_LENGTH),
        sidebar: sanitizeString(body.sidebar, MAX_SIDEBAR_LENGTH),
        nsfw: body.nsfw ?? false,
        discussion_languages: body.discussionLanguages || [37], // English
      },
    });

    if (!result.ok) {
      const errData = result.data as { error?: string } | null;
      return jsonResponse(
        { error: errData?.error || `Failed to create community (${result.status})` },
        result.status === 409 ? 409 : 400,
      );
    }

    const created = result.data as {
      community_view?: {
        community?: {
          id: number;
          name: string;
          title: string;
          actor_id: string;
          published: string;
        };
      };
    };

    const comm = created?.community_view?.community;
    log('info', 'Lemmy community created', { name, title });

    return jsonResponse(
      {
        success: true,
        community: {
          id: comm?.id,
          name: comm?.name || name,
          title: comm?.title || title,
          actorId: comm?.actor_id || `${LEMMY_INSTANCE_URL}/c/${name}`,
          instance: LEMMY_INSTANCE_URL,
          url: `${LEMMY_INSTANCE_URL}/c/${name}`,
          created_at: comm?.published,
          discussionLanguages: body.discussionLanguages || [37],
        },
        meta: {
          note: 'Community is federated. Users from lemmy.ml, lemmy.world, and all fediverse instances can access it.',
          federationEnabled: true,
          visibleTo: 'All federated instances (federation allowlist configured)',
        },
      },
      201,
    );
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to create community' },
      502,
    );
  }
}

// ─── POST /api/lemmy/community/follow — Subscribe/unsubscribe ─────────

export async function handleLemmyCommunityFollow(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    communityId?: number;
    communityName?: string;
    instance?: string;
    follow?: boolean;
    jwt?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.communityId && !body.communityName) {
    return jsonResponse({ error: 'communityId or communityName is required' }, 400);
  }

  const follow = body.follow ?? true;
  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) {
    return jsonResponse({ error: 'Lemmy auth required' }, 401);
  }

  try {
    let communityId = body.communityId;

    // Resolve community name to ID if needed
    if (!communityId && body.communityName) {
      const instance = body.instance || LEMMY_INSTANCE_URL;
      const apiBase = `${instance.replace(/\/$/, '')}/api/v3`;
      const commRes = await fetch(
        `${apiBase}/community?name=${encodeURIComponent(body.communityName)}`,
        {
          headers: { authorization: `Bearer ${jwt}`, 'user-agent': USER_AGENT },
        },
      );
      if (commRes.ok) {
        const commData = (await commRes.json()) as {
          community_view?: { community?: { id: number } };
        };
        communityId = commData?.community_view?.community?.id;
      }
    }

    if (!communityId) {
      return jsonResponse(
        { error: 'Could not resolve community. Check the name and try again.' },
        404,
      );
    }

    const result = await lemmyFetch('/community/follow', {
      method: 'POST',
      jwt,
      body: { community_id: communityId, follow },
    });

    if (!result.ok) {
      return jsonResponse(
        { error: `Failed to ${follow ? 'subscribe to' : 'unsubscribe from'} community` },
        400,
      );
    }

    return jsonResponse({
      success: true,
      action: follow ? 'subscribed' : 'unsubscribed',
      communityId,
      communityName: body.communityName,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to follow/unfollow community' },
      502,
    );
  }
}

// ─── POST /api/lemmy/community/moderate — Moderate community ──────────

export async function handleLemmyCommunityModerate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    action: 'remove_post' | 'ban_user' | 'feature_post' | 'lock_post';
    postId?: number;
    personId?: number;
    communityId?: number;
    reason?: string;
    removeData?: boolean;
    expires?: number;
    jwt?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) {
    return jsonResponse({ error: 'Lemmy auth with moderator privileges required' }, 401);
  }

  if (!body.action) {
    return jsonResponse(
      { error: 'action is required: remove_post, ban_user, feature_post, lock_post' },
      400,
    );
  }

  try {
    let endpoint = '';
    const payload: Record<string, unknown> = {};

    switch (body.action) {
      case 'remove_post':
        endpoint = '/post/remove';
        if (!body.postId) return jsonResponse({ error: 'postId required for remove_post' }, 400);
        payload.post_id = body.postId;
        payload.removed = true;
        if (body.reason) payload.reason = body.reason;
        break;

      case 'ban_user':
        endpoint = '/user/ban';
        if (!body.personId || !body.communityId) {
          return jsonResponse({ error: 'personId and communityId required for ban_user' }, 400);
        }
        payload.person_id = body.personId;
        payload.community_id = body.communityId;
        payload.ban = true;
        if (body.reason) payload.reason = body.reason;
        if (body.removeData) payload.remove_data = body.removeData;
        if (body.expires) payload.expires = body.expires;
        break;

      case 'feature_post':
        endpoint = '/post/feature';
        if (!body.postId) return jsonResponse({ error: 'postId required for feature_post' }, 400);
        payload.post_id = body.postId;
        payload.featured = true;
        payload.feature_type = 'Community';
        break;

      case 'lock_post':
        endpoint = '/post/lock';
        if (!body.postId) return jsonResponse({ error: 'postId required for lock_post' }, 400);
        payload.post_id = body.postId;
        payload.locked = true;
        break;

      default:
        return jsonResponse({ error: `Unknown action: ${body.action}` }, 400);
    }

    const result = await lemmyFetch(endpoint, { method: 'POST', jwt, body: payload });

    if (!result.ok) {
      return jsonResponse({ error: `Moderation action failed: ${body.action}` }, 400);
    }

    log('info', 'Lemmy moderation action', { action: body.action, postId: body.postId });

    return jsonResponse({
      success: true,
      action: body.action,
      postId: body.postId,
      personId: body.personId,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Moderation action failed' },
      502,
    );
  }
}

// ─── POST /api/lemmy/post/vote — Vote on a post ─────────────────────

export async function handleLemmyPostVote(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { postId?: number; score?: number; jwt?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.postId) return jsonResponse({ error: 'postId is required' }, 400);
  const score = body.score;
  if (score === undefined || ![1, 0, -1].includes(score)) {
    return jsonResponse(
      { error: 'score must be 1 (upvote), 0 (remove vote), or -1 (downvote)' },
      400,
    );
  }

  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) return jsonResponse({ error: 'Lemmy auth required' }, 401);

  try {
    const result = await lemmyFetch('/post/like', {
      method: 'POST',
      jwt,
      body: { post_id: body.postId, score },
    });

    if (!result.ok) {
      return jsonResponse({ error: 'Failed to vote on post' }, 400);
    }

    return jsonResponse({
      success: true,
      postId: body.postId,
      score,
      action: score === 1 ? 'upvoted' : score === -1 ? 'downvoted' : 'vote_removed',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Vote failed' }, 502);
  }
}

// ─── POST /api/lemmy/comment/create — Create a comment ──────────────

export async function handleLemmyCommentCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { postId?: number; content?: string; parentId?: number; jwt?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.postId) return jsonResponse({ error: 'postId is required' }, 400);

  const content = sanitizeString(body.content, MAX_BODY_LENGTH);
  if (!content) return jsonResponse({ error: 'content is required' }, 400);

  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) return jsonResponse({ error: 'Lemmy auth required' }, 401);

  try {
    const payload: Record<string, unknown> = { post_id: body.postId, content };
    if (body.parentId) payload.parent_id = body.parentId;

    const result = await lemmyFetch('/comment', { method: 'POST', jwt, body: payload });

    if (!result.ok) {
      return jsonResponse({ error: 'Failed to create comment' }, 400);
    }

    const created = result.data as {
      comment_view?: {
        comment?: { id: number; content: string; path: string; published: string; ap_id: string };
        creator?: { id: number; name: string; actor_id: string };
      };
    };

    const cv = created?.comment_view;

    return jsonResponse(
      {
        success: true,
        comment: {
          id: cv?.comment?.id,
          content: cv?.comment?.content || content,
          path: cv?.comment?.path,
          postId: body.postId,
          published: cv?.comment?.published,
          apId: cv?.comment?.ap_id,
          creator: cv?.creator ? { id: cv.creator.id, name: cv.creator.name } : undefined,
        },
      },
      201,
    );
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to create comment' },
      502,
    );
  }
}

// ─── GET /api/lemmy/community/:name/settings — Get community settings ─

export async function handleLemmyCommunitySettings(
  request: Request,
  _env: Env,
  name: string,
): Promise<Response> {
  try {
    const result = await lemmyFetch(`/community?name=${encodeURIComponent(name)}`);

    if (!result.ok) {
      return jsonResponse({ error: `Community '${name}' not found` }, 404);
    }

    const data = result.data as {
      community_view?: {
        community?: Record<string, unknown>;
        counts?: Record<string, unknown>;
      };
      moderators?: Array<{ moderator?: Record<string, unknown> }>;
      online?: number;
      discussion_languages?: number[];
    };

    const cv = data?.community_view;
    const community = cv?.community || {};
    const counts = cv?.counts || {};

    return jsonResponse({
      community: {
        id: community.id,
        name: community.name,
        title: community.title,
        description: community.description,
        sidebar: community.sidebar,
        icon: community.icon,
        banner: community.banner,
        actorId: community.actor_id,
        local: community.local,
        nsfw: community.nsfw,
        postingRestrictedToMods: community.posting_restricted_to_mods,
        published: community.published,
      },
      counts: {
        subscribers: counts.subscribers,
        posts: counts.posts,
        comments: counts.comments,
        usersActiveDay: counts.users_active_day,
        usersActiveWeek: counts.users_active_week,
        usersActiveMonth: counts.users_active_month,
      },
      moderators: (data?.moderators || []).map((m: { moderator?: Record<string, unknown> }) => ({
        id: m.moderator?.id,
        name: m.moderator?.name,
        avatar: m.moderator?.avatar,
      })),
      online: data?.online || 0,
      discussionLanguages: data?.discussion_languages || [],
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to fetch community settings' },
      502,
    );
  }
}

// ─── PUT /api/lemmy/community/:name/settings — Update community settings

export async function handleLemmyCommunityUpdate(
  request: Request,
  env: Env,
  name: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    title?: string;
    description?: string;
    sidebar?: string;
    icon?: string;
    banner?: string;
    nsfw?: boolean;
    postingRestrictedToMods?: boolean;
    discussionLanguages?: number[];
    jwt?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const jwt = getJwtFromAuth(env, body.jwt);
  if (!jwt) {
    return jsonResponse({ error: 'Lemmy auth with moderator privileges required' }, 401);
  }

  try {
    // First resolve community ID
    const commRes = await lemmyFetch(`/community?name=${encodeURIComponent(name)}`);
    if (!commRes.ok) {
      return jsonResponse({ error: `Community '${name}' not found` }, 404);
    }

    const commData = commRes.data as {
      community_view?: { community?: { id: number } };
    };
    const communityId = commData?.community_view?.community?.id;
    if (!communityId) {
      return jsonResponse({ error: 'Could not resolve community ID' }, 404);
    }

    const payload: Record<string, unknown> = { community_id: communityId };
    if (body.title !== undefined) payload.title = sanitizeString(body.title, MAX_TITLE_LENGTH);
    if (body.description !== undefined)
      payload.description = sanitizeString(body.description, MAX_DESCRIPTION_LENGTH);
    if (body.sidebar !== undefined)
      payload.sidebar = sanitizeString(body.sidebar, MAX_SIDEBAR_LENGTH);
    if (body.icon !== undefined) payload.icon = body.icon;
    if (body.banner !== undefined) payload.banner = body.banner;
    if (body.nsfw !== undefined) payload.nsfw = body.nsfw;
    if (body.postingRestrictedToMods !== undefined)
      payload.posting_restricted_to_mods = body.postingRestrictedToMods;
    if (body.discussionLanguages !== undefined)
      payload.discussion_languages = body.discussionLanguages;

    const result = await lemmyFetch('/community', {
      method: 'PUT',
      jwt,
      body: payload,
    });

    if (!result.ok) {
      return jsonResponse({ error: 'Failed to update community settings' }, 400);
    }

    log('info', 'Lemmy community updated', { name });

    return jsonResponse({ success: true, name });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to update community' },
      502,
    );
  }
}
