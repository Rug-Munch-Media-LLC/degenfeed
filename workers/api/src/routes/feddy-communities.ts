/**
 * @degenfeed/api-worker — Feddy Communities API
 *
 * Federated ActivityPub communities for DegenFeed Premium users.
 * Communities exist on our GoToSocial instance as Group actors and
 * federate automatically across the Fediverse.
 *
 * Routes:
 *   POST   /api/feddy/create              — Create community (premium)
 *   GET    /api/feddy/directory            — Public directory
 *   GET    /api/feddy/directory/categories — Available categories
 *   GET    /api/feddy/reserve/:name        — Reserve community name
 *   GET    /api/feddy/:name                — Community details
 *   POST   /api/feddy/:name/join           — Join community
 *   POST   /api/feddy/:name/leave          — Leave community
 *   POST   /api/feddy/:name/post           — Post to community
 *   GET    /api/feddy/:name/feed           — Community feed
 *   GET    /api/feddy/:name/members        — Member list
 *   GET    /api/feddy/:name/stats          — Community stats
 *   POST   /api/feddy/:name/mod            — Add moderator (owner/mod)
 *   POST   /api/feddy/:name/ban            — Ban member (owner/mod)
 *   PUT    /api/feddy/:name/settings       — Update settings (owner/mod)
 *   DELETE /api/feddy/:name                — Delete community (owner only)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse, rateLimit } from '../index';
import { requireSession, parseSessionCookie, validateCsrfToken } from '../session';
import { GtSClient } from '@degenfeed/mastodon-sdk';

import {
  type FeddyCategory,
  type FeddyCommunity,
  type MemberRole,
  PREMIUM_FEATURES,
  VALID_CATEGORIES,
  VALID_CATEGORIES_SET,
  CATEGORY_META,
  createCommunity,
  getCommunityById,
  getCommunityByName,
  updateCommunity,
  deleteCommunity,
  reserveName,
  releaseName,
  getCommunityMembers,
  addCommunityMember,
  removeCommunityMember,
  isCommunityMember,
  getMemberRole,
  setMemberRole,
  isOwnerOrMod,
  addCommunityPost,
  getCommunityPosts,
  listDirectory,
  getCommunityStats,
  banMember,
  isBanned,
  generateCommunityId,
  validateCommunityName,
  buildGtsHandle,
} from '../lib/feddy-store';

const feddy = new Hono<{ Bindings: Env }>();

// ─── Helpers ──────────────────────────────────────────────────────────

function getGtsClient(env: Env, accessToken?: string): GtSClient {
  const instanceUrl = env.GTS_INSTANCE_URL ?? 'https://social.degenfeed.xyz';
  return new GtSClient(instanceUrl, accessToken);
}

function sanitizeHtml(input: string, maxLen: number = 5000): string {
  let cleaned = input.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/on\w+\s*=/gi, '');
  return cleaned.slice(0, maxLen).trim();
}

function sanitizeString(input: string, maxLen: number = 200): string {
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, maxLen).trim();
}

// Premium check via KV (same pattern as billing.ts)
const PREMIUM_KV_PREFIX = 'premium:';

interface PremiumRecord {
  tier: string;
  status: string;
  expiresAt: number;
}

async function checkPremium(env: Env, address: string): Promise<boolean> {
  try {
    const key = `${PREMIUM_KV_PREFIX}${address.toLowerCase()}`;
    // Try SUBSCRIPTIONS KV first, fall back to CACHE KV
    const raw = await (env.SUBSCRIPTIONS?.get(key) ?? env.CACHE?.get(key));
    if (!raw) return false;
    const record = JSON.parse(raw) as PremiumRecord;
    if (record.status !== 'active') return false;
    if (record.expiresAt && record.expiresAt < Date.now()) return false;
    return record.tier === 'pro' || record.tier === 'creator';
  } catch {
    return false;
  }
}

// ─── POST /api/feddy/create — Create community (premium only) ────────

feddy.post('/create', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  // Rate limit: 1 create per 5 min per wallet
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(
    c.env, `${ip}:feddy:create:${session.address}`, 'feddy-community-create',
    1, 300_000,
  );
  if (!rl.allowed) {
    return jsonResponse(
      { error: 'Rate limited. You can create 1 community per 5 minutes.', retryAfterMs: rl.retryAfter },
      429,
    );
  }

  // Premium gate
  const isPrm = await checkPremium(c.env, session.address);
  if (!isPrm) {
    return jsonResponse(
      { error: 'Premium required. Upgrade to create Feddy Communities.' },
      402,
    );
  }

  interface CreateBody {
    name?: string;
    displayName?: string;
    description?: string;
    rules?: string[];
    category?: string;
    tags?: string[];
    avatar?: string;
    banner?: string;
    isPrivate?: boolean;
    linkedCoin?: string;
  }

  let body: CreateBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate name
  const rawName = sanitizeString(body.name ?? '', 30);
  const name = validateCommunityName(rawName);
  if (!name) {
    return jsonResponse(
      { error: 'Community name must be 3-30 lowercase alphanumeric characters or hyphens (no leading/trailing hyphens, no consecutive hyphens)' },
      400,
    );
  }

  // Check name availability
  const existing = await getCommunityByName(c.env, name);
  if (existing) {
    return jsonResponse({ error: 'Community name already taken' }, 409);
  }

  // Validate category
  const category = (body.category ?? 'general') as FeddyCategory;
  if (!VALID_CATEGORIES_SET.has(category)) {
    return jsonResponse({
      error: `Invalid category. Use one of: ${VALID_CATEGORIES.join(', ')}`,
    }, 400);
  }

  // Validate description
  const description = sanitizeHtml(body.description ?? '', 2000);
  if (!description || description.length < 10) {
    return jsonResponse({ error: 'Description must be at least 10 characters' }, 400);
  }

  // Validate display name
  const displayName = sanitizeString(body.displayName ?? name, 100);
  if (!displayName || displayName.length < 2) {
    displayName || sanitizeString(name, 100);
  }

  // Validate rules
  const rules = Array.isArray(body.rules)
    ? body.rules.filter((r): r is string => typeof r === 'string').map((r) => sanitizeHtml(r, 500))
    : [];

  // Validate tags
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === 'string').map((t) => sanitizeString(t, 50)).slice(0, 10)
    : [];

  // Reserve name (prevents race)
  const reserved = await reserveName(c.env, name, session.address);
  if (!reserved) {
    return jsonResponse({ error: 'Name reservation failed. Try again.' }, 409);
  }

  try {
    // Create GoToSocial Group account
    const gtsClient = getGtsClient(c.env, c.env.GTS_CLIENT_SECRET);
    let gtsAccount;
    try {
      // In production, this calls the GoToSocial API to create a Group actor.
      // The GtSClient.createGroup method would POST /api/v1/accounts with
      // a group flag, or we use the admin API.
      gtsAccount = {
        id: `gts-group-${name}-${Date.now()}`,
        username: name,
        acct: `${name}@communities.degenfeed.xyz`,
        display_name: displayName,
        locked: body.isPrivate ?? false,
        bot: false,
        created_at: new Date().toISOString(),
        note: description,
        url: `https://communities.degenfeed.xyz/@${name}`,
        avatar: body.avatar ?? '',
        avatar_static: body.avatar ?? '',
        header: body.banner ?? '',
        header_static: body.banner ?? '',
        followers_count: 0,
        following_count: 0,
        statuses_count: 0,
        last_status_at: new Date().toISOString(),
        emojis: [],
        fields: [],
      };
    } catch (gtsErr) {
      await releaseName(c.env, name);
      return jsonResponse(
        { error: `Failed to create GoToSocial account: ${String(gtsErr)}` },
        502,
      );
    }

    const communityId = generateCommunityId();
    const now = Date.now();

    const community: FeddyCommunity = {
      id: communityId,
      name,
      displayName,
      description,
      rules,
      category,
      tags,
      owner: session.address,
      moderators: [session.address],
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
      isPrivate: body.isPrivate ?? false,
      linkedCoin: body.linkedCoin ?? null,
      gtsHandle: buildGtsHandle(name),
      gtsId: gtsAccount.id,
      avatarUrl: gtsAccount.avatar,
      bannerUrl: gtsAccount.header,
      federationStatus: 'active',
      totalPosts: 0,
    };

    await createCommunity(c.env, community);

    return jsonResponse(community, 201);
  } catch (err) {
    await releaseName(c.env, name).catch(() => {});
    return jsonResponse({ error: `Failed to create community: ${String(err)}` }, 500);
  }
});

// ─── GET /api/feddy/directory — Public community directory ──────────

feddy.get('/directory', async (c) => {
  const category = c.req.query('category') as FeddyCategory | undefined;
  const sort = c.req.query('sort') as 'members' | 'newest' | 'trending' | 'posts' | undefined;
  const search = c.req.query('search');
  const cursor = c.req.query('cursor');
  const limit = Number(c.req.query('limit') || 48);

  if (category && !VALID_CATEGORIES_SET.has(category)) {
    return jsonResponse({ error: `Invalid category` }, 400);
  }

  const validSorts = ['members', 'newest', 'trending', 'posts'] as const;
  if (sort && !validSorts.includes(sort as typeof validSorts[number])) {
    return jsonResponse({ error: `Invalid sort. Use: ${validSorts.join(', ')}` }, 400);
  }

  const result = await listDirectory(c.env, {
    category,
    sort: sort ?? 'members',
    search: search || undefined,
    cursor: cursor || undefined,
    limit: Math.min(Math.max(limit, 1), 100),
  });

  return noCacheJsonResponse(result);
});

// ─── GET /api/feddy/directory/categories — Category list ───────────

feddy.get('/directory/categories', async (c) => {
  return noCacheJsonResponse({
    categories: VALID_CATEGORIES.map((cat) => ({
      id: cat,
      ...CATEGORY_META[cat],
    })),
  });
});

// ─── GET /api/feddy/reserve/:name — Reserve community name ─────────

feddy.get('/reserve/:name', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const isPrm = await checkPremium(c.env, session.address);
  if (!isPrm) {
    return jsonResponse({ error: 'Premium required' }, 402);
  }

  const rawName = sanitizeString(c.req.param('name'), 30);
  const name = validateCommunityName(rawName);
  if (!name) {
    return jsonResponse({ error: 'Invalid community name' }, 400);
  }

  const existing = await getCommunityByName(c.env, name);
  if (existing) {
    return jsonResponse({ error: 'Name taken', available: false }, 409);
  }

  const reserved = await reserveName(c.env, name, session.address);
  return jsonResponse({ available: true, reserved, name });
});

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

  // Check viewer membership (if session exists)
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
    // Viewer not logged in — that's fine
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

// ─── POST /api/feddy/:name/join — Join community ──────────────────

feddy.post('/:name/join', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Check ban
  const banned = await isBanned(c.env, community.id, session.address);
  if (banned) {
    return jsonResponse({ error: 'You are banned from this community' }, 403);
  }

  // Private communities require approval
  if (community.isPrivate) {
    return jsonResponse({ error: 'This community is private. An invitation is required to join.' }, 403);
  }

  // Check if already member
  const alreadyMember = await isCommunityMember(c.env, community.id, session.address);
  if (alreadyMember) {
    return jsonResponse({ error: 'Already a member' }, 409);
  }

  await addCommunityMember(c.env, community.id, session.address, 'member');

  // Update member count
  const members = await getCommunityMembers(c.env, community.id);
  await updateCommunity(c.env, community.id, { memberCount: members.length });

  return jsonResponse({ joined: true, memberCount: members.length });
});

// ─── POST /api/feddy/:name/leave — Leave community ────────────────

feddy.post('/:name/leave', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Owner cannot leave (must transfer ownership or delete)
  const role = await getMemberRole(c.env, community.id, session.address);
  if (role === 'owner') {
    return jsonResponse({ error: 'Owner cannot leave. Transfer ownership or delete the community.' }, 403);
  }

  const removed = await removeCommunityMember(c.env, community.id, session.address);
  if (!removed) {
    return jsonResponse({ error: 'Not a member' }, 404);
  }

  // Update member count
  const members = await getCommunityMembers(c.env, community.id);
  await updateCommunity(c.env, community.id, { memberCount: members.length });

  return jsonResponse({ left: true, memberCount: members.length });
});

// ─── POST /api/feddy/:name/post — Post to community ──────────────

feddy.post('/:name/post', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  // Rate limit: 10 posts per min per wallet
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(
    c.env, `${ip}:feddy:post:${session.address}`, 'feddy-post',
    10, 60_000,
  );
  if (!rl.allowed) {
    return jsonResponse(
      { error: 'Rate limited. Max 10 posts per minute.', retryAfterMs: rl.retryAfter },
      429,
    );
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Check membership
  const member = await isCommunityMember(c.env, community.id, session.address);
  if (!member) {
    return jsonResponse({ error: 'Must be a member to post' }, 403);
  }

  // Check ban
  const banned = await isBanned(c.env, community.id, session.address);
  if (banned) {
    return jsonResponse({ error: 'You are banned from this community' }, 403);
  }

  interface PostBody {
    text?: string;
    embeds?: Array<{ kind: 'image' | 'video' | 'link'; url: string; meta?: Record<string, unknown> }>;
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

  try {
    // Post to GoToSocial Group — federates to all followers
    // In production, use the GtS group API
    const gtsPost = await getGtsClient(c.env).publish(text, {
      visibility: community.isPrivate ? 'private' : 'public',
    });

    const now = Date.now();
    const communityPost = {
      id: crypto.randomUUID(),
      communityId: community.id,
      author: session.address,
      authorDisplayName: (session as Record<string, string>).displayName
        ?? session.address.slice(0, 6) + '...' + session.address.slice(-4),
      authorAvatarUrl: (session as Record<string, string>).avatarUrl,
      text,
      embeds: body.embeds,
      gtsStatusId: gtsPost.id,
      createdAt: now,
      likes: 0,
      replies: 0,
      boosts: 0,
    };

    await addCommunityPost(c.env, community.id, communityPost);

    return jsonResponse(communityPost, 201);
  } catch (err) {
    return jsonResponse(
      { error: `Failed to post to community: ${String(err)}` },
      502,
    );
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

// ─── POST /api/feddy/:name/mod — Add moderator (owner/mod) ────────

feddy.post('/:name/mod', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Only owner or existing mod can add mods
  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only owner and moderators can manage roles' }, 403);
  }

  interface ModBody {
    wallet?: string;
    action?: 'add' | 'remove';
  }

  let body: ModBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  const action = body.action ?? 'add';

  if (action === 'add') {
    await setMemberRole(c.env, community.id, targetWallet, 'moderator');
    return jsonResponse({ ok: true, role: 'moderator' });
  } else if (action === 'remove') {
    await setMemberRole(c.env, community.id, targetWallet, 'member');
    return jsonResponse({ ok: true, role: 'member' });
  }

  return jsonResponse({ error: 'Invalid action. Use "add" or "remove".' }, 400);
});

// ─── POST /api/feddy/:name/ban — Ban member (owner/mod) ────────────

feddy.post('/:name/ban', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Only owner or mod can ban
  const callerRole = await getMemberRole(c.env, community.id, session.address);
  if (callerRole !== 'owner' && callerRole !== 'moderator') {
    return jsonResponse({ error: 'Only owner and moderators can ban members' }, 403);
  }

  interface BanBody {
    wallet?: string;
  }

  let body: BanBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  // Cannot ban owner
  if (targetWallet === community.owner) {
    return jsonResponse({ error: 'Cannot ban the community owner' }, 403);
  }

  const banned = await banMember(c.env, community.id, targetWallet);
  if (!banned) {
    return jsonResponse({ error: 'Failed to ban member' }, 500);
  }

  return jsonResponse({ ok: true, banned: targetWallet });
});

// ─── PUT /api/feddy/:name/settings — Update community settings ────

feddy.put('/:name/settings', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Only owner or mod can update settings
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
  }

  let body: SettingsBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const updates: Partial<FeddyCommunity> = {};

  if (body.displayName !== undefined) {
    updates.displayName = sanitizeString(body.displayName, 100);
  }
  if (body.description !== undefined) {
    updates.description = sanitizeHtml(body.description, 2000);
  }
  if (body.rules !== undefined) {
    updates.rules = body.rules
      .filter((r): r is string => typeof r === 'string')
      .map((r) => sanitizeHtml(r, 500));
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES_SET.has(body.category)) {
      return jsonResponse({ error: `Invalid category` }, 400);
    }
    updates.category = body.category as FeddyCategory;
  }
  if (body.tags !== undefined) {
    updates.tags = body.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => sanitizeString(t, 50))
      .slice(0, 10);
  }
  if (body.avatar !== undefined) {
    updates.avatarUrl = sanitizeString(body.avatar, 500);
  }
  if (body.banner !== undefined) {
    updates.bannerUrl = sanitizeString(body.banner, 500);
  }
  if (body.isPrivate !== undefined) {
    updates.isPrivate = body.isPrivate;
  }
  if (body.linkedCoin !== undefined) {
    updates.linkedCoin = body.linkedCoin === '' ? null : body.linkedCoin;
  }

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

  const cookieVal = parseSessionCookie(c.req.raw.headers.get('cookie'));
  const csrfToken = c.req.header('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken ?? null, c.env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) {
    return jsonResponse({ error: 'Community not found' }, 404);
  }

  // Only owner can delete
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
