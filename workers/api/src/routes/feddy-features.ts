/**
 * @degenfeed/api-worker — Feddy Communities: Features
 *
 * Pinned posts, events, polls, wiki pages, badges, and extended roles.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import type { CommunityEvent, CommunityPoll } from '../lib/feddy-store';
import {
  addModLogEntry,
  createBadge,
  createEvent,
  createPoll,
  getBadges,
  getCommunityByName,
  getCommunityEvents,
  getCommunityPolls,
  getEventRSVPs,
  getMemberRole,
  getPinnedPosts,
  getUpcomingEvents,
  getWikiPages,
  isCommunityMember,
  type MemberRole,
  pinPost,
  rsvpEvent,
  setMemberRole,
  setWikiPages,
  unpinPost,
  votePoll,
} from '../lib/feddy-store';
import {
  csrfCheck,
  requireModOrResponse,
  requireOwnerOrResponse,
  requireSession,
  sanitizeHtml,
  sanitizeString,
} from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── Pinned Posts ─────────────────────────────────────────────────────

feddy.post('/:name/pin', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface PinBody {
    postId?: string;
  }
  let body: PinBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postId) return jsonResponse({ error: 'postId required' }, 400);

  await pinPost(c.env, community.id, body.postId);
  await addModLogEntry(c.env, {
    id: crypto.randomUUID(),
    communityId: community.id,
    action: 'pin',
    moderatorWallet: session.address,
    reason: 'Pinned post',
    details: { postId: body.postId },
    createdAt: Date.now(),
  });
  return jsonResponse({ ok: true, pinned: body.postId });
});

feddy.post('/:name/unpin', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface UnpinBody {
    postId?: string;
  }
  let body: UnpinBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.postId) return jsonResponse({ error: 'postId required' }, 400);

  await unpinPost(c.env, community.id, body.postId);
  return jsonResponse({ ok: true, unpinned: body.postId });
});

feddy.get('/:name/pinned', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const posts = await getPinnedPosts(c.env, community.id);
  return noCacheJsonResponse({ posts });
});

// ─── Events ────────────────────────────────────────────────────────────

feddy.post('/:name/events', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface EventBody {
    title?: string;
    description?: string;
    startTime?: number;
    endTime?: number;
    location?: string;
    maxAttendees?: number;
    coverUrl?: string;
    isVirtual?: boolean;
    tags?: string[];
  }
  let body: EventBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const title = sanitizeString(body.title ?? '', 200);
  if (!title || title.length < 3)
    return jsonResponse({ error: 'Title must be at least 3 characters' }, 400);
  if (!body.startTime || !body.endTime)
    return jsonResponse({ error: 'startTime and endTime required' }, 400);
  if (body.endTime <= body.startTime)
    return jsonResponse({ error: 'endTime must be after startTime' }, 400);

  const event: CommunityEvent = {
    id: crypto.randomUUID(),
    communityId: community.id,
    title,
    description: sanitizeHtml(body.description ?? '', 2000),
    startTime: body.startTime,
    endTime: body.endTime,
    location: sanitizeString(body.location ?? '', 500),
    createdBy: session.address,
    createdAt: Date.now(),
    maxAttendees: Math.min(body.maxAttendees ?? 100, 10000),
    rsvpCount: 0,
    coverUrl: body.coverUrl ? sanitizeString(body.coverUrl, 500) : undefined,
    isVirtual: body.isVirtual ?? true,
    tags: (body.tags ?? []).map((t) => sanitizeString(t, 50)).slice(0, 10),
  };

  await createEvent(c.env, event);
  return jsonResponse(event, 201);
});

feddy.get('/:name/events', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const upcoming = c.req.query('upcoming') === 'true';
  const limit = Number(c.req.query('limit') || 20);

  const events = upcoming
    ? await getUpcomingEvents(c.env, community.id, Math.min(limit, 50))
    : await getCommunityEvents(c.env, community.id, Math.min(limit, 50));

  return noCacheJsonResponse({ events });
});

feddy.post('/:name/events/:eid/rsvp', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const eventId = sanitizeString(c.req.param('eid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const member = await isCommunityMember(c.env, community.id, session.address);
  if (!member) return jsonResponse({ error: 'Must be a member' }, 403);

  interface RSVPBody {
    status?: 'going' | 'maybe' | 'declined';
  }
  let body: RSVPBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const status = body.status ?? 'going';
  if (!['going', 'maybe', 'declined'].includes(status)) {
    return jsonResponse({ error: 'Status must be: going, maybe, or declined' }, 400);
  }

  await rsvpEvent(c.env, eventId, {
    wallet: session.address,
    displayName: session.displayName,
    status,
    respondedAt: Date.now(),
  });

  return jsonResponse({ ok: true, status });
});

feddy.get('/:name/events/:eid/rsvps', async (c) => {
  const eventId = sanitizeString(c.req.param('eid'), 64);
  const rsvps = await getEventRSVPs(c.env, eventId);
  return noCacheJsonResponse({ rsvps, count: rsvps.length });
});

// ─── Polls ─────────────────────────────────────────────────────────────

feddy.post('/:name/polls', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const member = await isCommunityMember(c.env, community.id, session.address);
  if (!member) return jsonResponse({ error: 'Must be a member' }, 403);

  interface PollBody {
    question?: string;
    options?: string[];
    expiresInMs?: number;
    isMultipleChoice?: boolean;
  }
  let body: PollBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const question = sanitizeString(body.question ?? '', 500);
  if (!question || question.length < 3)
    return jsonResponse({ error: 'Question must be at least 3 characters' }, 400);

  const options = (body.options ?? []).filter(
    (o): o is string => typeof o === 'string' && o.trim().length > 0,
  );
  if (options.length < 2) return jsonResponse({ error: 'At least 2 options required' }, 400);
  if (options.length > 20) return jsonResponse({ error: 'Maximum 20 options' }, 400);

  const poll: CommunityPoll = {
    id: crypto.randomUUID(),
    communityId: community.id,
    question,
    options: options.map((text) => ({
      id: crypto.randomUUID(),
      text: sanitizeString(text, 200),
      votes: 0,
    })),
    createdBy: session.address,
    createdAt: Date.now(),
    expiresAt: Date.now() + Math.min(body.expiresInMs ?? 86400000, 604800000), // max 7 days
    isMultipleChoice: body.isMultipleChoice ?? false,
    totalVotes: 0,
    isClosed: false,
  };

  await createPoll(c.env, poll);
  return jsonResponse(poll, 201);
});

feddy.get('/:name/polls', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const polls = await getCommunityPolls(c.env, community.id);
  return noCacheJsonResponse({ polls });
});

feddy.post('/:name/polls/:pid/vote', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const pollId = sanitizeString(c.req.param('pid'), 64);
  const _member = await isCommunityMember(c.env, 'polls-community-check', session.address);
  // In production, properly resolve community from poll

  interface VoteBody {
    optionId?: string;
  }
  let body: VoteBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.optionId) return jsonResponse({ error: 'optionId required' }, 400);

  const voted = await votePoll(c.env, pollId, {
    wallet: session.address,
    optionId: body.optionId,
    votedAt: Date.now(),
  });

  if (!voted) return jsonResponse({ error: 'Already voted or poll closed' }, 409);
  return jsonResponse({ ok: true });
});

// ─── Wiki ──────────────────────────────────────────────────────────────

feddy.get('/:name/wiki', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const pages = await getWikiPages(c.env, community.id);
  return noCacheJsonResponse({ wiki: pages });
});

feddy.put('/:name/wiki', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface WikiBody {
    pages?: Array<{ title?: string; content?: string; slug?: string }>;
  }
  let body: WikiBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const now = Date.now();
  const wikiPages = (body.pages ?? []).map((p) => ({
    id: crypto.randomUUID(),
    title: sanitizeString(p.title ?? '', 200),
    content: sanitizeHtml(p.content ?? '', 50000),
    slug: sanitizeString(p.slug ?? '', 100),
    createdBy: session.address,
    updatedBy: session.address,
    createdAt: now,
    updatedAt: now,
  }));

  if (wikiPages.length > 50) return jsonResponse({ error: 'Maximum 50 wiki pages' }, 400);

  await setWikiPages(c.env, community.id, wikiPages);
  return jsonResponse({ ok: true, pages: wikiPages.length });
});

// ─── Badges ────────────────────────────────────────────────────────────

feddy.post('/:name/badges', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const ownerCheck = await requireOwnerOrResponse(c.env, community.id, session.address);
  if (ownerCheck.error) return ownerCheck.error;

  interface BadgeBody {
    name?: string;
    description?: string;
    iconUrl?: string;
    criteria?: string;
  }
  let body: BadgeBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const badgeName = sanitizeString(body.name ?? '', 100);
  if (!badgeName) return jsonResponse({ error: 'Badge name required' }, 400);

  await createBadge(c.env, community.id, {
    id: crypto.randomUUID(),
    name: badgeName,
    description: sanitizeString(body.description ?? '', 500),
    iconUrl: sanitizeString(body.iconUrl ?? '', 500),
    criteria: sanitizeString(body.criteria ?? '', 200),
    createdAt: Date.now(),
    createdBy: session.address,
  });

  return jsonResponse({ ok: true }, 201);
});

feddy.get('/:name/badges', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const badges = await getBadges(c.env, community.id);
  return noCacheJsonResponse({ badges });
});

// ─── Roles (Extended) ──────────────────────────────────────────────────

feddy.post('/:name/role', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only moderators can manage roles' }, 403);
  }

  interface RoleBody {
    wallet?: string;
    role?: MemberRole;
  }
  let body: RoleBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) return jsonResponse({ error: 'Wallet required' }, 400);

  const validRoles: MemberRole[] = ['contributor', 'vip', 'og', 'member', 'moderator'];
  const newRole = body.role;
  if (!newRole || !validRoles.includes(newRole)) {
    return jsonResponse({ error: `Invalid role. Use one of: ${validRoles.join(', ')}` }, 400);
  }

  // Only owner can assign moderator
  if (newRole === 'moderator' && callerRole !== 'owner') {
    return jsonResponse({ error: 'Only the owner can assign moderator role' }, 403);
  }

  await setMemberRole(c.env, community.id, targetWallet, newRole);
  await addModLogEntry(c.env, {
    id: crypto.randomUUID(),
    communityId: community.id,
    action: 'change_role',
    moderatorWallet: session.address,
    targetWallet,
    reason: `Role changed to ${newRole}`,
    details: { newRole },
    createdAt: Date.now(),
  });

  return jsonResponse({ ok: true, role: newRole });
});

export default feddy;
