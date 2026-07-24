/**
 * @degenfeed/api-worker — Feddy Communities: Membership & Content
 *
 * Join/leave community, post to community, cross-post from protocol,
 * community feed, member list, and community stats.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse, rateLimit } from '../index';
import type { CommunityPost } from '../lib/feddy-store';
import {
  addCommunityMember,
  addCommunityPost,
  addModLogEntry,
  buildGtsHandle,
  getCommunityByName,
  getCommunityMembers,
  getCommunityPosts,
  getCommunityStats,
  isBanned,
  isCommunityMember,
  removeCommunityMember,
  getMemberRole,
  updateCommunity,
  checkTokenGate,
  getKeywordFilters,
  getWebhooks,
} from '../lib/feddy-store';
import {
  checkPremium,
  csrfCheck,
  getGtsClient,
  requireSession,
  sanitizeHtml,
  sanitizeString,
  shortenWallet,
} from './feddy-helpers';
import { fireWebhook } from './feddy-webhooks';

const feddy = new Hono<{ Bindings: Env }>();

// ─── POST /api/feddy/:name/join — Join community ──────────────────

feddy.post('/:name/join', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const banned = await isBanned(c.env, community.id, session.address);
  if (banned) {
    return jsonResponse({ error: 'You are banned from this community' }, 403);
  }

  if (community.isPrivate) {
    return jsonResponse(
      {
        error: 'This community is private. An invitation is required to join.',
      },
      403,
    );
  }

  const alreadyMember = await isCommunityMember(c.env, community.id, session.address);
  if (alreadyMember) {
    return jsonResponse({ error: 'Already a member' }, 409);
  }

  // Check token gates
  const gateCheck = await checkTokenGate(c.env, community.id, session.address);
  if (!gateCheck.passed) {
    const failedGates = gateCheck.gates.filter((g) => !g.passed);
    return jsonResponse(
      {
        error: 'Token gated community',
        gates: failedGates,
      },
      403,
    );
  }

  await addCommunityMember(c.env, community.id, session.address, 'member');
  const members = await getCommunityMembers(c.env, community.id);
  await updateCommunity(c.env, community.id, { memberCount: members.length });

  // Log moderation event
  await addModLogEntry(c.env, {
    id: crypto.randomUUID(),
    communityId: community.id,
    action: 'change_role',
    moderatorWallet: session.address,
    targetWallet: session.address,
    reason: 'Member joined',
    details: { newRole: 'member' },
    createdAt: Date.now(),
  });

  return jsonResponse({ joined: true, memberCount: members.length });
});

// ─── POST /api/feddy/:name/leave — Leave community ────────────────

feddy.post('/:name/leave', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const role = await getMemberRole(c.env, community.id, session.address);
  if (role === 'owner') {
    return jsonResponse(
      {
        error: 'Owner cannot leave. Transfer ownership or delete the community.',
      },
      403,
    );
  }

  const removed = await removeCommunityMember(c.env, community.id, session.address);
  if (!removed) {
    return jsonResponse({ error: 'Not a member' }, 404);
  }

  const members = await getCommunityMembers(c.env, community.id);
  await updateCommunity(c.env, community.id, { memberCount: members.length });

  return jsonResponse({ left: true, memberCount: members.length });
});

// ─── POST /api/feddy/:name/post — Post to community ──────────────

feddy.post('/:name/post', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(
    c.env,
    `${ip}:feddy:post:${session.address}`,
    'feddy-post',
    10,
    60_000,
  );
  if (!rl.allowed) {
    return jsonResponse(
      {
        error: 'Rate limited. Max 10 posts per minute.',
        retryAfterMs: rl.retryAfter,
      },
      429,
    );
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const member = await isCommunityMember(c.env, community.id, session.address);
  if (!member) {
    return jsonResponse({ error: 'Must be a member to post' }, 403);
  }

  const banned = await isBanned(c.env, community.id, session.address);
  if (banned) {
    return jsonResponse({ error: 'You are banned from this community' }, 403);
  }

  // Check token gates for posting
  const gateCheck = await checkTokenGate(c.env, community.id, session.address);
  if (!gateCheck.passed) {
    return jsonResponse({ error: 'Token gated — insufficient balance to post' }, 403);
  }

  // Check keyword filters
  interface PostBody {
    text?: string;
    embeds?: Array<{
      kind: 'image' | 'video' | 'link';
      url: string;
      meta?: Record<string, unknown>;
    }>;
  }

  let body: PostBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const text = sanitizeHtml(body.text ?? '', 5000);
  if (!text || text.length < 1) {
    return jsonResponse({ error: 'Post text is required' }, 400);
  }

  // Check keyword/auto-mod filters
  const filterCheck = await getKeywordFilters(c.env, community.id).then(async (filters) => {
    for (const f of filters) {
      try {
        if (f.action === 'block') {
          const matches = f.isRegex
            ? new RegExp(f.pattern, 'i').test(text)
            : text.toLowerCase().includes(f.pattern.toLowerCase());
          if (matches) return { blocked: true, filter: f };
        }
      } catch {
        /* invalid regex */
      }
    }
    return { blocked: false };
  });
  if (filterCheck.blocked) {
    return jsonResponse(
      {
        error: 'Post blocked by community filter',
        filter: filterCheck.filter?.pattern,
      },
      403,
    );
  }

  try {
    const gtsPost = await getGtsClient(c.env).publish(text, {
      visibility: community.isPrivate ? 'private' : 'public',
    });

    const now = Date.now();
    const communityPost: CommunityPost = {
      id: crypto.randomUUID(),
      communityId: community.id,
      author: session.address,
      authorDisplayName: session.displayName ?? shortenWallet(session.address),
      authorAvatarUrl: session.avatarUrl,
      text,
      embeds: body.embeds,
      gtsStatusId: gtsPost.id,
      createdAt: now,
      likes: 0,
      replies: 0,
      boosts: 0,
    };

    await addCommunityPost(c.env, community.id, communityPost);

    // Fire webhook for post.created
    const webhooks = await getWebhooks(c.env, community.id);
    for (const hook of webhooks) {
      if (hook.isActive && hook.events.includes('post.created')) {
        fireWebhook(hook.url, hook.secret, 'post.created', communityPost).catch(() => {});
      }
    }

    return jsonResponse(communityPost, 201);
  } catch (err) {
    return jsonResponse({ error: `Failed to post to community: ${String(err)}` }, 502);
  }
});

// ─── POST /api/feddy/:name/cross-post — Cross-post from protocol ──

feddy.post('/:name/cross-post', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const member = await isCommunityMember(c.env, community.id, session.address);
  if (!member) return jsonResponse({ error: 'Must be a member' }, 403);

  interface CrossPostBody {
    text?: string;
    sourceProtocol?: string;
    sourceUrl?: string;
    embeds?: Array<{
      kind: 'image' | 'video' | 'link';
      url: string;
      meta?: Record<string, unknown>;
    }>;
  }

  let body: CrossPostBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const text = sanitizeHtml(body.text ?? '', 5000);
  if (!text) return jsonResponse({ error: 'Text is required' }, 400);

  try {
    const gtsPost = await getGtsClient(c.env).publish(
      `[Cross-post from ${body.sourceProtocol || 'external'}]\n\n${text}`,
      { visibility: 'public' },
    );

    const now = Date.now();
    const communityPost: CommunityPost = {
      id: crypto.randomUUID(),
      communityId: community.id,
      author: session.address,
      authorDisplayName: session.displayName ?? shortenWallet(session.address),
      authorAvatarUrl: session.avatarUrl,
      text,
      embeds: body.embeds,
      gtsStatusId: gtsPost.id,
      createdAt: now,
      likes: 0,
      replies: 0,
      boosts: 0,
      crossPostSource: body.sourceProtocol ?? null,
    };

    await addCommunityPost(c.env, community.id, communityPost);
    return jsonResponse(communityPost, 201);
  } catch (err) {
    return jsonResponse({ error: `Failed to cross-post: ${String(err)}` }, 502);
  }
});

// ─── GET /api/feddy/:name/feed — Community feed ──────────────────

feddy.get('/:name/feed', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const cursor = c.req.query('cursor');
  const limit = Number(c.req.query('limit') || 50);

  const result = await getCommunityPosts(c.env, community.id, Math.min(limit, 100), cursor);
  return noCacheJsonResponse(result);
});

// ─── GET /api/feddy/:name/members — Member list ──────────────────

feddy.get('/:name/members', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const limit = Number(c.req.query('limit') || 100);
  const members = await getCommunityMembers(c.env, community.id, Math.min(limit, 500));

  return noCacheJsonResponse({ members, total: members.length });
});

// ─── GET /api/feddy/:name/stats — Community stats ────────────────

feddy.get('/:name/stats', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const stats = await getCommunityStats(c.env, community.id);
  return noCacheJsonResponse(stats);
});

export default feddy;
