/**
 * @degenfeed/api-worker — Feddy Communities: Community Details & Settings
 *
 * Community detail view, settings update, and community deletion.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { parseSessionCookie } from '../session';
import {
  deleteCommunity,
  getCommunityByName,
  getCommunityMembers,
  getCommunityPosts,
  getCommunityStats,
  getMemberRole,
  type FeddyCategory,
  type FeddyCommunity,
  type MemberRole,
  updateCommunity,
  VALID_CATEGORIES_SET,
} from '../lib/feddy-store';
import {
  checkPremium,
  csrfCheck,
  requireOwnerOrResponse,
  requireSession,
  sanitizeHtml,
  sanitizeString,
} from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── GET /api/feddy/:name — Community details ──────────────────────

feddy.get('/:name', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const [postsResult, members, stats] = await Promise.all([
    getCommunityPosts(c.env, community.id, 20),
    getCommunityMembers(c.env, community.id, 50),
    getCommunityStats(c.env, community.id),
  ]);

  let viewerRole: MemberRole | null = null;
  try {
    const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
    if (cookieVal) {
      const { requireSession: reqSess } = await import('../session');
      const sess = await reqSess(c.req.raw, c.env);
      if (!(sess instanceof Response)) {
        viewerRole = await getMemberRole(c.env, community.id, sess.address);
      }
    }
  } catch {
    // Viewer not logged in
  }

  return noCacheJsonResponse({
    community: {
      ...community,
      viewerRole,
    },
    posts: postsResult.posts,
    members,
    stats,
  });
});

// ─── PUT /api/feddy/:name/settings — Update community settings ────

feddy.put('/:name/settings', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only owner and moderators can update settings' }, 403);
  }

  interface SettingsBody {
    displayName?: string;
    description?: string;
    rules?: string[];
    category?: string;
    tags?: string[];
    avatar?: string;
    banner?: string;
    isPrivate?: boolean;
    linkedCoin?: string | null;
    discordLink?: string | null;
    telegramLink?: string | null;
    featuredUntil?: number;
    featuredPosition?: number;
  }

  let body: SettingsBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const updates: Partial<FeddyCommunity> = {};

  if (body.displayName !== undefined) updates.displayName = sanitizeString(body.displayName, 100);
  if (body.description !== undefined) updates.description = sanitizeHtml(body.description, 2000);
  if (body.rules !== undefined) {
    updates.rules = body.rules
      .filter((r): r is string => typeof r === 'string')
      .map((r) => sanitizeHtml(r, 500));
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES_SET.has(body.category)) {
      return jsonResponse({ error: 'Invalid category' }, 400);
    }
    updates.category = body.category as FeddyCategory;
  }
  if (body.tags !== undefined) {
    updates.tags = body.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => sanitizeString(t, 50))
      .slice(0, 10);
  }
  if (body.avatar !== undefined) updates.avatarUrl = sanitizeString(body.avatar, 500);
  if (body.banner !== undefined) updates.bannerUrl = sanitizeString(body.banner, 500);
  if (body.isPrivate !== undefined) updates.isPrivate = body.isPrivate;
  if (body.linkedCoin !== undefined)
    updates.linkedCoin = body.linkedCoin === '' ? null : body.linkedCoin;
  if (body.discordLink !== undefined) updates.discordLink = body.discordLink || null;
  if (body.telegramLink !== undefined) updates.telegramLink = body.telegramLink || null;
  if (body.featuredUntil !== undefined) updates.featuredUntil = body.featuredUntil;
  if (body.featuredPosition !== undefined) updates.featuredPosition = body.featuredPosition;

  const updated = await updateCommunity(c.env, community.id, updates);
  if (!updated) {
    return jsonResponse({ error: 'Failed to update community' }, 500);
  }

  return jsonResponse({ ok: true, community: updated });
});

// ─── DELETE /api/feddy/:name — Delete community (owner only) ──────

feddy.delete('/:name', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  if (community.owner !== session.address) {
    return jsonResponse({ error: 'Only the owner can delete this community' }, 403);
  }

  const deleted = await deleteCommunity(c.env, community.id);
  if (!deleted) {
    return jsonResponse({ error: 'Failed to delete community' }, 500);
  }

  return jsonResponse({ ok: true, deleted: community.name });
});

export default feddy;
