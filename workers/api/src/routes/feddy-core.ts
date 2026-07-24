/**
 * @degenfeed/api-worker — Feddy Communities: Core CRUD & Directory
 *
 * Community creation, directory browsing, trending, autocomplete,
 * similar communities, follower communities, discover, and name reservation.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse, rateLimit } from '../index';
import type { FeddyCategory, FeddyCommunity } from '../lib/feddy-store';
import {
  autocompleteSearch,
  CATEGORY_META,
  createCommunity,
  generateCommunityId,
  getCommunityByName,
  getFollowerCommunities,
  getSimilarCommunities,
  getTrendingCommunities,
  listDirectory,
  releaseName,
  reserveName,
  VALID_CATEGORIES,
  VALID_CATEGORIES_SET,
  validateCommunityName,
  buildGtsHandle,
} from '../lib/feddy-store';
import {
  checkPremium,
  csrfCheck,
  getGtsClient,
  requireSession,
  sanitizeHtml,
  sanitizeString,
} from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── POST /api/feddy/create — Create community (premium only) ────────

feddy.post('/create', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const rl = await rateLimit(
    c.env,
    `${ip}:feddy:create:${session.address}`,
    'feddy-community-create',
    1,
    300_000,
  );
  if (!rl.allowed) {
    return jsonResponse(
      {
        error: 'Rate limited. You can create 1 community per 5 minutes.',
        retryAfterMs: rl.retryAfter,
      },
      429,
    );
  }

  const isPrm = await checkPremium(c.env, session.address);
  if (!isPrm) {
    return jsonResponse({ error: 'Premium required. Upgrade to create Feddy Communities.' }, 402);
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

  const rawName = sanitizeString(body.name ?? '', 30);
  const name = validateCommunityName(rawName);
  if (!name) {
    return jsonResponse(
      {
        error:
          'Community name must be 3-30 lowercase alphanumeric characters or hyphens (no leading/trailing hyphens, no consecutive hyphens)',
      },
      400,
    );
  }

  const existing = await getCommunityByName(c.env, name);
  if (existing) {
    return jsonResponse({ error: 'Community name already taken' }, 409);
  }

  const category = (body.category ?? 'general') as FeddyCategory;
  if (!VALID_CATEGORIES_SET.has(category)) {
    return jsonResponse(
      {
        error: `Invalid category. Use one of: ${VALID_CATEGORIES.join(', ')}`,
      },
      400,
    );
  }

  const description = sanitizeHtml(body.description ?? '', 2000);
  if (!description || description.length < 10) {
    return jsonResponse({ error: 'Description must be at least 10 characters' }, 400);
  }

  let displayName = sanitizeString(body.displayName ?? name, 100);
  if (!displayName || displayName.length < 2) {
    displayName = sanitizeString(name, 100);
  }

  const rules = Array.isArray(body.rules)
    ? body.rules.filter((r): r is string => typeof r === 'string').map((r) => sanitizeHtml(r, 500))
    : [];

  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => sanitizeString(t, 50))
        .slice(0, 10)
    : [];

  const reserved = await reserveName(c.env, name, session.address);
  if (!reserved) {
    return jsonResponse({ error: 'Name reservation failed. Try again.' }, 409);
  }

  try {
    const _gtsClient = getGtsClient(c.env, c.env.GTS_CLIENT_SECRET);
    let gtsAccount;
    try {
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
      return jsonResponse({ error: `Failed to create GoToSocial account: ${String(gtsErr)}` }, 502);
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
    return jsonResponse({ error: 'Invalid category' }, 400);
  }

  const validSorts = ['members', 'newest', 'trending', 'posts'] as const;
  if (sort && !validSorts.includes(sort as (typeof validSorts)[number])) {
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

feddy.get('/directory/categories', async (_c) => {
  return noCacheJsonResponse({
    categories: VALID_CATEGORIES.map((cat) => ({
      id: cat,
      ...CATEGORY_META[cat],
    })),
  });
});

// ─── GET /api/feddy/trending — Trending communities ────────────────

feddy.get('/trending', async (c) => {
  const limit = Number(c.req.query('limit') || 20);
  const trending = await getTrendingCommunities(c.env, Math.min(limit, 50));
  return noCacheJsonResponse({ entries: trending, total: trending.length });
});

// ─── GET /api/feddy/autocomplete — Autocomplete search ─────────────

feddy.get('/autocomplete', async (c) => {
  const q = sanitizeString(c.req.query('q') ?? '', 30).toLowerCase();
  if (!q || q.length < 2) {
    return noCacheJsonResponse({ results: [] });
  }
  const results = await autocompleteSearch(c.env, q, 10);
  return noCacheJsonResponse({ results });
});

// ─── GET /api/feddy/similar/:id — Similar communities ──────────────

feddy.get('/similar/:id', async (c) => {
  const communityId = sanitizeString(c.req.param('id'), 64);
  const limit = Number(c.req.query('limit') || 6);
  const similar = await getSimilarCommunities(c.env, communityId, Math.min(limit, 20));
  return noCacheJsonResponse({ entries: similar });
});

// ─── GET /api/feddy/follower-communities — Communities your followers are in ──

feddy.get('/follower-communities', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const limit = Number(c.req.query('limit') || 20);
  const communities = await getFollowerCommunities(c.env, session.address, Math.min(limit, 50));
  return noCacheJsonResponse({ entries: communities });
});

// ─── GET /api/feddy/discover — Federated community discovery ──────

feddy.get('/discover', async (c) => {
  const instance = c.req.query('instance');
  const limit = Number(c.req.query('limit') || 20);

  if (instance) {
    // Discover communities on a specific remote Fediverse instance
    try {
      // Use WebFinger / nodeinfo to discover groups
      const nodeInfoUrl = `https://${instance}/.well-known/nodeinfo`;
      const nodeRes = await fetch(nodeInfoUrl);
      if (!nodeRes.ok) {
        return jsonResponse({ error: `Cannot reach instance ${instance}` }, 502);
      }
      // Return discovered info — in production this would parse nodeinfo
      // and search for Group actors
      return noCacheJsonResponse({
        instance,
        discovered: true,
        communities: [],
        note: 'Full remote discovery requires admin API access on the remote instance',
      });
    } catch {
      return jsonResponse({ error: `Failed to contact ${instance}` }, 502);
    }
  }

  // Return locally known remote communities
  const { getDiscoveredRemoteCommunities } = await import('../lib/feddy-store');
  const remote = await getDiscoveredRemoteCommunities(c.env, Math.min(limit, 50));
  return noCacheJsonResponse({ entries: remote, total: remote.length });
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

export default feddy;
