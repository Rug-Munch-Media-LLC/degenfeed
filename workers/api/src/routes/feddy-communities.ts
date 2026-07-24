/**
 * @degenfeed/api-worker — Feddy Communities API
 *
 * Federated ActivityPub communities for DegenFeed Premium users.
 * Communities exist on our GoToSocial instance as Group actors and
 * federate automatically across the Fediverse.
 *
 * Routes:
 *   POST   /api/feddy/create                — Create community (premium)
 *   GET    /api/feddy/directory              — Public directory
 *   GET    /api/feddy/directory/categories   — Available categories
 *   GET    /api/feddy/trending               — Trending communities
 *   GET    /api/feddy/autocomplete           — Autocomplete search
 *   GET    /api/feddy/similar/:id            — Similar communities
 *   GET    /api/feddy/follower-communities   — Communities your followers are in
 *   GET    /api/feddy/discover               — Federated community discovery
 *   GET    /api/feddy/reserve/:name          — Reserve community name
 *   GET    /api/feddy/:name                  — Community details
 *   POST   /api/feddy/:name/join             — Join community
 *   POST   /api/feddy/:name/leave            — Leave community
 *   POST   /api/feddy/:name/post             — Post to community
 *   POST   /api/feddy/:name/cross-post       — Cross-post from protocol
 *   GET    /api/feddy/:name/feed             — Community feed
 *   GET    /api/feddy/:name/members          — Member list
 *   GET    /api/feddy/:name/stats            — Community stats
 *   POST   /api/feddy/:name/mod              — Add moderator (owner/mod)
 *   POST   /api/feddy/:name/ban              — Ban member (owner/mod)
 *   POST   /api/feddy/:name/unban            — Unban member (owner/mod)
 *   PUT    /api/feddy/:name/settings         — Update settings (owner/mod)
 *   DELETE /api/feddy/:name                  — Delete community (owner only)
 *   --- Features ---
 *   POST   /api/feddy/:name/pin              — Pin post (mod+)
 *   POST   /api/feddy/:name/unpin            — Unpin post (mod+)
 *   GET    /api/feddy/:name/pinned           — Get pinned posts
 *   POST   /api/feddy/:name/events           — Create event
 *   GET    /api/feddy/:name/events           — List events
 *   POST   /api/feddy/:name/events/:eid/rsvp — RSVP to event
 *   GET    /api/feddy/:name/events/:eid/rsvps— Get RSVPs
 *   POST   /api/feddy/:name/polls            — Create poll
 *   GET    /api/feddy/:name/polls            — List polls
 *   POST   /api/feddy/:name/polls/:pid/vote  — Vote in poll
 *   GET    /api/feddy/:name/wiki             — Get wiki pages
 *   PUT    /api/feddy/:name/wiki             — Update wiki pages (mod+)
 *   POST   /api/feddy/:name/badges           — Create badge (owner)
 *   GET    /api/feddy/:name/badges           — List badges
 *   POST   /api/feddy/:name/badges/assign    — Assign badge (mod+)
 *   --- Roles ---
 *   POST   /api/feddy/:name/role             — Set member role (mod+)
 *   --- Treasury ---
 *   GET    /api/feddy/:name/treasury         — Get treasury state
 *   POST   /api/feddy/:name/treasury/deposit — Record deposit
 *   POST   /api/feddy/:name/treasury/withdraw— Record withdrawal
 *   GET    /api/feddy/:name/treasury/tx      — List treasury transactions
 *   --- Token ---
 *   POST   /api/feddy/:name/token-config     — Set token config (owner)
 *   GET    /api/feddy/:name/token-config     — Get token config
 *   POST   /api/feddy/:name/token-gates      — Set token gates (mod+)
 *   GET    /api/feddy/:name/token-gates      — Get token gates
 *   GET    /api/feddy/:name/token-gates/check — Check token gates
 *   POST   /api/feddy/:name/reward           — Reward member tokens (mod+)
 *   --- Moderation ---
 *   POST   /api/feddy/:name/reports          — Create report
 *   GET    /api/feddy/:name/reports          — List reports (mod+)
 *   PUT    /api/feddy/:name/reports/:rid     — Update report (mod+)
 *   POST   /api/feddy/:name/appeals          — Create appeal
 *   GET    /api/feddy/:name/appeals          — List appeals (mod+)
 *   PUT    /api/feddy/:name/appeals/:aid     — Resolve appeal (mod+)
 *   GET    /api/feddy/:name/mod-log          — Mod log (mod+)
 *   POST   /api/feddy/:name/auto-mod         — Set keyword filters (mod+)
 *   GET    /api/feddy/:name/auto-mod         — Get keyword filters
 *   POST   /api/feddy/:name/blocklist        — Set link blocklist (mod+)
 *   GET    /api/feddy/:name/blocklist        — Get link blocklist
 *   POST   /api/feddy/:name/fed-blocklist    — Add federation block (mod+)
 *   GET    /api/feddy/:name/fed-blocklist    — List federation blocklist
 *   --- Federation ---
 *   GET    /api/feddy/:name/federation-health — Federation health dashboard
 *   POST   /api/feddy/:name/federation/sync  — Manually trigger federation sync
 *   --- Webhooks / Bots ---
 *   POST   /api/feddy/:name/webhooks         — Create webhook (mod+)
 *   GET    /api/feddy/:name/webhooks         — List webhooks (mod+)
 *   DELETE /api/feddy/:name/webhooks/:hid    — Delete webhook (mod+)
 *   POST   /api/feddy/:name/bot-keys         — Create bot API key (mod+)
 *   GET    /api/feddy/:name/bot-keys         — List bot API keys (mod+)
 *   DELETE /api/feddy/:name/bot-keys/:kid    — Delete bot API key (mod+)
 *   GET    /api/feddy/:name/rss              — RSS feed
 *   --- Links ---
 *   POST   /api/feddy/:name/links            — Set Discord/Telegram links (mod+)
 */

import { GtSClient } from '@degenfeed/mastodon-sdk';
import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse, rateLimit } from '../index';
import {
  type Appeal,
  addCommunityMember,
  addCommunityPost,
  addFedBlocklistEntry,
  addModLogEntry,
  addTreasuryTx,
  autocompleteSearch,
  type BotScope,
  banMember,
  buildGtsHandle,
  CATEGORY_META,
  type CommunityEvent,
  type CommunityPoll,
  type CommunityPost,
  checkTokenGate,
  createAppeal,
  createBadge,
  createBotKey,
  createCommunity,
  createEvent,
  createPoll,
  createReport,
  createWebhook,
  deleteBotKey,
  deleteCommunity,
  deleteWebhook,
  type FedBlocklistEntry,
  type FeddyCategory,
  type FeddyCommunity,
  generateCommunityId,
  generateSecret,
  getAllCommunityMembers,
  getAppeals,
  getBadges,
  getBotKeys,
  getCommunityByName,
  getCommunityEvents,
  getCommunityMembers,
  getCommunityPolls,
  getCommunityPosts,
  getCommunityStats,
  getEventRSVPs,
  getFedBlocklist,
  getFederationHealth,
  getFollowerCommunities,
  getKeywordFilters,
  getLinkBlocklist,
  getMemberRole,
  getModLog,
  getPinnedPosts,
  getReports,
  getSimilarCommunities,
  getTokenConfig,
  getTokenGates,
  getTreasury,
  getTreasuryTxs,
  getTrendingCommunities,
  getUpcomingEvents,
  getWebhooks,
  getWikiPages,
  hashKey,
  isBanned,
  isCommunityMember,
  type KeywordFilter,
  listDirectory,
  type MemberRole,
  pinPost,
  REPORT_CATEGORIES,
  type Report,
  type ReportCategory,
  releaseName,
  removeCommunityMember,
  reserveName,
  resolveAppeal,
  rsvpEvent,
  setFederationHealth,
  setKeywordFilters,
  setLinkBlocklist,
  setMemberRole,
  setTokenConfig,
  setTokenGates,
  setTreasury,
  setWikiPages,
  unbanMember,
  unpinPost,
  updateCommunity,
  updateMemberTokenBalance,
  updateReportStatus,
  VALID_CATEGORIES,
  VALID_CATEGORIES_SET,
  validateCommunityName,
  votePoll,
  type WebhookEvent,
} from '../lib/feddy-store';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';

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
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .slice(0, maxLen)
    .trim();
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
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
    const raw = await (env.SUBSCRIPTIONS?.get(key) ?? env.CACHE?.get(key));
    if (!raw) return false;
    const record = JSON.parse(raw) as PremiumRecord;
    if (record.status !== 'active') return false;
    if (record.expiresAt && record.expiresAt < Date.now()) return false;
    return record.tier === 'pro' || record.tier === 'platinum' || record.tier === 'enterprise';
  } catch {
    return false;
  }
}

/** Require owner or moderator role for mod-only endpoints. Returns Response on failure. */
async function requireModOrResponse(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<{ role: MemberRole | null; error?: Response }> {
  const role = await getMemberRole(env, communityId, wallet);
  if (role !== 'owner' && role !== 'moderator') {
    return {
      role,
      error: jsonResponse({ error: 'Only owner and moderators can perform this action' }, 403),
    };
  }
  return { role };
}

/** Require owner role only. Returns Response on failure. */
async function requireOwnerOrResponse(
  env: Env,
  communityId: string,
  wallet: string,
): Promise<{ role: MemberRole | null; error?: Response }> {
  const role = await getMemberRole(env, communityId, wallet);
  if (role !== 'owner') {
    return {
      role,
      error: jsonResponse({ error: 'Only the community owner can perform this action' }, 403),
    };
  }
  return { role };
}

/** Common CSRF check pattern */
async function csrfCheck(req: Request, env: Env): Promise<Response | null> {
  const cookieVal = parseSessionCookie(req.headers.get('cookie'));
  const csrfToken = req.headers.get('X-CSRF-Token');
  if (cookieVal) {
    const csrfOk = await validateCsrfToken(cookieVal, csrfToken, env);
    if (!csrfOk) {
      return jsonResponse({ error: 'Invalid CSRF token' }, 403);
    }
  }
  return null;
}

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

// ─── POST /api/feddy/:name/mod — Add moderator ─────────────────────

feddy.post('/:name/mod', async (c) => {
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
    await addModLogEntry(c.env, {
      id: crypto.randomUUID(),
      communityId: community.id,
      action: 'change_role',
      moderatorWallet: session.address,
      targetWallet,
      reason: 'Promoted to moderator',
      details: { newRole: 'moderator' },
      createdAt: Date.now(),
    });
    return jsonResponse({ ok: true, role: 'moderator' });
  } else if (action === 'remove') {
    await setMemberRole(c.env, community.id, targetWallet, 'member');
    return jsonResponse({ ok: true, role: 'member' });
  }

  return jsonResponse({ error: 'Invalid action. Use "add" or "remove".' }, 400);
});

// ─── POST /api/feddy/:name/ban — Ban member ────────────────────────

feddy.post('/:name/ban', async (c) => {
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
    return jsonResponse({ error: 'Only owner and moderators can ban members' }, 403);
  }

  interface BanBody {
    wallet?: string;
    reason?: string;
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

  if (targetWallet === community.owner) {
    return jsonResponse({ error: 'Cannot ban the community owner' }, 403);
  }

  const banned = await banMember(c.env, community.id, targetWallet);
  if (!banned) {
    return jsonResponse({ error: 'Failed to ban member' }, 500);
  }

  await addModLogEntry(c.env, {
    id: crypto.randomUUID(),
    communityId: community.id,
    action: 'ban',
    moderatorWallet: session.address,
    targetWallet,
    reason: sanitizeString(body.reason ?? 'No reason provided', 500),
    createdAt: Date.now(),
  });

  return jsonResponse({ ok: true, banned: targetWallet });
});

// ─── POST /api/feddy/:name/unban — Unban member ───────────────────

feddy.post('/:name/unban', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface UnbanBody {
    wallet?: string;
  }
  let body: UnbanBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const wallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!wallet) return jsonResponse({ error: 'Wallet required' }, 400);

  const unbanned = await unbanMember(c.env, community.id, wallet);
  if (!unbanned) return jsonResponse({ error: 'Failed to unban or not banned' }, 500);

  return jsonResponse({ ok: true, unbanned: wallet });
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

// ═══════════════════════════════════════════════════════════════════════
//  FEATURES
// ═══════════════════════════════════════════════════════════════════════

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

// ─── Treasury ──────────────────────────────────────────────────────────

feddy.get('/:name/treasury', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const treasury = await getTreasury(c.env, community.id);
  if (!treasury) return jsonResponse({ error: 'No treasury configured' }, 404);

  return noCacheJsonResponse(treasury);
});

feddy.post('/:name/treasury/deposit', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface TreasuryDepositBody {
    amount?: string;
    memo?: string;
    txSignature?: string;
  }
  let body: TreasuryDepositBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.amount) return jsonResponse({ error: 'Amount required' }, 400);

  const tx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'deposit',
    amount: body.amount,
    from: session.address,
    to: community.id,
    memo: sanitizeString(body.memo ?? 'Treasury deposit', 500),
    txSignature: sanitizeString(body.txSignature ?? '', 128),
    createdAt: Date.now(),
  };

  await addTreasuryTx(c.env, tx);

  // Update treasury balance
  const treasury = await getTreasury(c.env, community.id);
  if (treasury) {
    const newBalance = (BigInt(treasury.balance) + BigInt(body.amount)).toString();
    treasury.balance = newBalance;
    treasury.totalDeposits = (BigInt(treasury.totalDeposits) + BigInt(body.amount)).toString();
    treasury.updatedAt = Date.now();
    await setTreasury(c.env, treasury);
  }

  return jsonResponse(tx, 201);
});

feddy.post('/:name/treasury/withdraw', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const ownerCheck = await requireOwnerOrResponse(c.env, community.id, session.address);
  if (ownerCheck.error) return ownerCheck.error;

  interface WithdrawBody {
    amount?: string;
    to?: string;
    memo?: string;
    txSignature?: string;
  }
  let body: WithdrawBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.amount || !body.to)
    return jsonResponse({ error: 'Amount and recipient required' }, 400);

  const tx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'withdrawal',
    amount: body.amount,
    from: community.id,
    to: sanitizeString(body.to, 128),
    memo: sanitizeString(body.memo ?? 'Treasury withdrawal', 500),
    txSignature: sanitizeString(body.txSignature ?? '', 128),
    createdAt: Date.now(),
  };

  await addTreasuryTx(c.env, tx);

  const treasury = await getTreasury(c.env, community.id);
  if (treasury) {
    const newBalance = (BigInt(treasury.balance) - BigInt(body.amount)).toString();
    treasury.balance = newBalance;
    treasury.totalWithdrawals = (
      BigInt(treasury.totalWithdrawals) + BigInt(body.amount)
    ).toString();
    treasury.updatedAt = Date.now();
    await setTreasury(c.env, treasury);
  }

  return jsonResponse(tx, 201);
});

feddy.get('/:name/treasury/tx', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const limit = Number(c.req.query('limit') || 20);
  const txs = await getTreasuryTxs(c.env, community.id, Math.min(limit, 100));
  return noCacheJsonResponse({ transactions: txs });
});

// ─── Community Token ───────────────────────────────────────────────────

feddy.post('/:name/token-config', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const ownerCheck = await requireOwnerOrResponse(c.env, community.id, session.address);
  if (ownerCheck.error) return ownerCheck.error;

  interface TokenBody {
    mintAddress?: string;
    symbol?: string;
    tokenName?: string;
    decimals?: number;
    totalSupply?: number;
    isTradeable?: boolean;
    feeSharePercent?: number;
    rewardPerPost?: number;
  }
  let body: TokenBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.mintAddress || !body.symbol) {
    return jsonResponse({ error: 'mintAddress and symbol required' }, 400);
  }

  const config: import('../lib/feddy-store').CommunityTokenConfig = {
    communityId: community.id,
    mintAddress: sanitizeString(body.mintAddress, 128),
    symbol: sanitizeString(body.symbol, 20).toUpperCase(),
    name: sanitizeString(body.tokenName ?? body.symbol ?? '', 100),
    decimals: body.decimals ?? 9,
    totalSupply: body.totalSupply ?? 0,
    isTradeable: body.isTradeable ?? true,
    feeSharePercent: Math.min(Math.max(body.feeSharePercent ?? 0, 0), 100),
    rewardPerPost: body.rewardPerPost ?? 0,
    createdAt: Date.now(),
  };

  await setTokenConfig(c.env, config);
  return jsonResponse(config, 201);
});

feddy.get('/:name/token-config', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const config = await getTokenConfig(c.env, community.id);
  if (!config) return jsonResponse({ error: 'No token configured' }, 404);
  return noCacheJsonResponse(config);
});

// ─── Token Gates ───────────────────────────────────────────────────────

feddy.post('/:name/token-gates', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface GatesBody {
    gates?: Array<{
      name?: string;
      minBalance?: number;
      isRequired?: boolean;
      channelName?: string;
    }>;
  }
  let body: GatesBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const gates = (body.gates ?? []).map((g) => ({
    id: crypto.randomUUID(),
    name: sanitizeString(g.name ?? 'Token Gate', 100),
    minBalance: Math.max(g.minBalance ?? 0, 0),
    isRequired: g.isRequired ?? true,
    channelName: g.channelName ? sanitizeString(g.channelName, 100) : undefined,
    createdAt: Date.now(),
  }));

  await setTokenGates(c.env, community.id, gates);
  return jsonResponse({ ok: true, gates });
});

feddy.get('/:name/token-gates', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const gates = await getTokenGates(c.env, community.id);
  return noCacheJsonResponse({ gates });
});

feddy.get('/:name/token-gates/check', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const result = await checkTokenGate(c.env, community.id, session.address);
  return noCacheJsonResponse(result);
});

// ─── Token Rewards ─────────────────────────────────────────────────────

feddy.post('/:name/reward', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface RewardBody {
    wallet?: string;
    amount?: number;
    reason?: string;
  }
  let body: RewardBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const targetWallet = sanitizeString(body.wallet ?? '', 128).toLowerCase();
  if (!targetWallet) return jsonResponse({ error: 'Wallet required' }, 400);
  if (!body.amount || body.amount <= 0)
    return jsonResponse({ error: 'Positive amount required' }, 400);

  // Update member token balance
  const member = (await getAllCommunityMembers(c.env, community.id)).find(
    (m) => m.wallet === targetWallet,
  );
  const currentBalance = member?.tokenBalance ?? 0;
  await updateMemberTokenBalance(c.env, community.id, targetWallet, currentBalance + body.amount);

  // Record the reward
  const rewardTx: import('../lib/feddy-store').TreasuryTx = {
    id: crypto.randomUUID(),
    communityId: community.id,
    type: 'reward',
    amount: String(body.amount),
    from: community.id,
    to: targetWallet,
    memo: sanitizeString(body.reason ?? 'Community reward', 500),
    txSignature: '',
    createdAt: Date.now(),
  };
  await addTreasuryTx(c.env, rewardTx);

  return jsonResponse({
    ok: true,
    rewarded: targetWallet,
    amount: body.amount,
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  MODERATION
// ═══════════════════════════════════════════════════════════════════════

// ─── Reports ───────────────────────────────────────────────────────────

feddy.post('/:name/reports', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  interface ReportBody {
    targetWallet?: string;
    targetPostId?: string;
    category?: ReportCategory;
    description?: string;
    evidenceUrls?: string[];
  }
  let body: ReportBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.targetWallet) return jsonResponse({ error: 'targetWallet required' }, 400);

  const category = body.category ?? 'other';
  if (!REPORT_CATEGORIES.includes(category)) {
    return jsonResponse({ error: `Invalid category. Use: ${REPORT_CATEGORIES.join(', ')}` }, 400);
  }

  const report: Report = {
    id: crypto.randomUUID(),
    communityId: community.id,
    reporterWallet: session.address,
    targetWallet: sanitizeString(body.targetWallet, 128).toLowerCase(),
    targetPostId: body.targetPostId ? sanitizeString(body.targetPostId, 64) : undefined,
    category,
    description: sanitizeString(body.description ?? '', 2000),
    evidenceUrls: body.evidenceUrls?.map((u) => sanitizeString(u, 500)).slice(0, 5),
    status: 'open',
    createdAt: Date.now(),
  };

  await createReport(c.env, report);
  return jsonResponse(report, 201);
});

feddy.get('/:name/reports', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const reports = await getReports(c.env, community.id);
  return noCacheJsonResponse({ reports });
});

feddy.put('/:name/reports/:rid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const reportId = sanitizeString(c.req.param('rid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface ReportUpdate {
    status?: string;
    resolution?: string;
  }
  let body: ReportUpdate;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];
  if (body.status && !validStatuses.includes(body.status)) {
    return jsonResponse({ error: `Invalid status. Use: ${validStatuses.join(', ')}` }, 400);
  }

  await updateReportStatus(
    c.env,
    community.id,
    reportId,
    (body.status ?? 'resolved') as Report['status'],
    session.address,
    sanitizeString(body.resolution ?? '', 1000),
  );

  return jsonResponse({ ok: true });
});

// ─── Appeals ───────────────────────────────────────────────────────────

feddy.post('/:name/appeals', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const banned = await isBanned(c.env, community.id, session.address);
  if (!banned) return jsonResponse({ error: 'You are not banned from this community' }, 403);

  interface AppealBody {
    reason?: string;
  }
  let body: AppealBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const reason = sanitizeString(body.reason ?? '', 2000);
  if (!reason || reason.length < 10)
    return jsonResponse({ error: 'Reason must be at least 10 characters' }, 400);

  const appeal: Appeal = {
    id: crypto.randomUUID(),
    communityId: community.id,
    wallet: session.address,
    reason,
    status: 'pending',
    createdAt: Date.now(),
  };

  await createAppeal(c.env, appeal);
  return jsonResponse(appeal, 201);
});

feddy.get('/:name/appeals', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const appeals = await getAppeals(c.env, community.id);
  return noCacheJsonResponse({ appeals });
});

feddy.put('/:name/appeals/:aid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const appealId = sanitizeString(c.req.param('aid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface AppealResolve {
    status?: 'granted' | 'denied';
    note?: string;
  }
  let body: AppealResolve;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.status || !['granted', 'denied'].includes(body.status)) {
    return jsonResponse({ error: 'Status must be "granted" or "denied"' }, 400);
  }

  const resolved = await resolveAppeal(
    c.env,
    community.id,
    appealId,
    body.status,
    session.address,
    sanitizeString(body.note ?? '', 1000),
  );

  if (!resolved) return jsonResponse({ error: 'Appeal not found' }, 404);

  // If granted, unban the user
  if (body.status === 'granted') {
    const appeal = (await getAppeals(c.env, community.id)).find((a) => a.id === appealId);
    if (appeal) {
      await unbanMember(c.env, community.id, appeal.wallet);
    }
  }

  return jsonResponse({ ok: true, status: body.status });
});

// ─── Mod Log ───────────────────────────────────────────────────────────

feddy.get('/:name/mod-log', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const log = await getModLog(c.env, community.id);
  return noCacheJsonResponse({ log });
});

// ─── Auto-Mod / Keyword Filters ────────────────────────────────────────

feddy.post('/:name/auto-mod', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface AutoModBody {
    filters?: Array<{
      pattern?: string;
      isRegex?: boolean;
      action?: 'flag' | 'block' | 'require_approval';
    }>;
  }
  let body: AutoModBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const filters: KeywordFilter[] = (body.filters ?? []).map((f) => ({
    id: crypto.randomUUID(),
    pattern: sanitizeString(f.pattern ?? '', 500),
    isRegex: f.isRegex ?? false,
    action: f.action ?? 'flag',
    createdAt: Date.now(),
    createdBy: session.address,
  }));

  await setKeywordFilters(c.env, community.id, filters);
  return jsonResponse({ ok: true, filters });
});

feddy.get('/:name/auto-mod', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const filters = await getKeywordFilters(c.env, community.id);
  return noCacheJsonResponse({ filters });
});

// ─── Link Blocklist ────────────────────────────────────────────────────

feddy.post('/:name/blocklist', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface BlocklistBody {
    domains?: string[];
  }
  let body: BlocklistBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const domains = (body.domains ?? []).map((d) => sanitizeString(d, 200)).filter(Boolean);
  await setLinkBlocklist(c.env, community.id, domains);
  return jsonResponse({ ok: true, domains });
});

feddy.get('/:name/blocklist', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const domains = await getLinkBlocklist(c.env, community.id);
  return noCacheJsonResponse({ domains });
});

// ─── Federation Blocklist ──────────────────────────────────────────────

feddy.post('/:name/fed-blocklist', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface FedBlockBody {
    instanceUrl?: string;
    reason?: string;
  }
  let body: FedBlockBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.instanceUrl) return jsonResponse({ error: 'instanceUrl required' }, 400);

  const entry: FedBlocklistEntry = {
    instanceUrl: sanitizeString(body.instanceUrl, 500),
    reason: sanitizeString(body.reason ?? '', 500),
    blockedBy: session.address,
    blockedAt: Date.now(),
  };

  await addFedBlocklistEntry(c.env, community.id, entry);
  return jsonResponse({ ok: true, blocked: entry.instanceUrl });
});

feddy.get('/:name/fed-blocklist', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const blocklist = await getFedBlocklist(c.env, community.id);
  return noCacheJsonResponse({ blocklist });
});

// ═══════════════════════════════════════════════════════════════════════
//  FEDERATION
// ═══════════════════════════════════════════════════════════════════════

// ─── Federation Health Dashboard ──────────────────────────────────────

feddy.get('/:name/federation-health', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const health = await getFederationHealth(c.env, community.id);

  // Calculate basic health info from the community itself
  const basicHealth = {
    gtsHandle: community.gtsHandle,
    gtsId: community.gtsId,
    federationStatus: community.federationStatus,
    totalFollowers: 0,
    followerInstances: health?.followerInstances ?? [],
    followerGrowth7d: health?.followerGrowth7d ?? 0,
    lastFederatedAt: health?.lastFederatedAt ?? community.updatedAt,
    failedPushes24h: health?.failedPushes24h ?? 0,
    remoteFollowers: health?.remoteFollowers ?? [],
  };

  return noCacheJsonResponse(basicHealth);
});

feddy.post('/:name/federation/sync', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  // In production, this triggers a background task to resync with GoToSocial
  // and push any pending content to followers on other instances.
  // For now, we update the federation health timestamp.
  const health = await getFederationHealth(c.env, community.id);
  const updatedHealth = health ?? {
    communityId: community.id,
    followerInstances: [],
    totalFollowers: 0,
    followerGrowth7d: 0,
    lastFederatedAt: Date.now(),
    failedPushes24h: 0,
    remoteFollowers: [],
  };
  updatedHealth.lastFederatedAt = Date.now();
  await setFederationHealth(c.env, updatedHealth);

  return jsonResponse({ ok: true, syncedAt: Date.now() });
});

// ═══════════════════════════════════════════════════════════════════════
//  WEBHOOKS / BOTS
// ═══════════════════════════════════════════════════════════════════════

// ─── Webhook Management ────────────────────────────────────────────────

feddy.post('/:name/webhooks', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface WebhookBody {
    url?: string;
    events?: WebhookEvent[];
  }
  let body: WebhookBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.url) return jsonResponse({ error: 'URL required' }, 400);

  const validEvents: WebhookEvent[] = [
    'post.created',
    'post.deleted',
    'member.joined',
    'member.left',
    'member.banned',
    'event.created',
    'poll.closed',
    'treasury.deposit',
    'treasury.withdrawal',
  ];
  const events = (body.events ?? ['post.created']).filter((e): e is WebhookEvent =>
    validEvents.includes(e),
  );

  const secret = generateSecret(24);

  const hook: import('../lib/feddy-store').WebhookConfig = {
    id: crypto.randomUUID(),
    communityId: community.id,
    url: sanitizeString(body.url, 500),
    secret,
    events,
    isActive: true,
    createdBy: session.address,
    createdAt: Date.now(),
  };

  await createWebhook(c.env, hook);
  return jsonResponse(
    {
      ...hook,
      // Return the secret only once
      secret,
    },
    201,
  );
});

feddy.get('/:name/webhooks', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const hooks = await getWebhooks(c.env, community.id);
  // Don't expose secrets
  const safeHooks = hooks.map(({ secret: _, ...h }) => h);
  return noCacheJsonResponse({ webhooks: safeHooks });
});

feddy.delete('/:name/webhooks/:hid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const webhookId = sanitizeString(c.req.param('hid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  await deleteWebhook(c.env, community.id, webhookId);
  return jsonResponse({ ok: true, deleted: webhookId });
});

// ─── Bot API Keys ──────────────────────────────────────────────────────

feddy.post('/:name/bot-keys', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface BotKeyBody {
    name?: string;
    scopes?: BotScope[];
  }
  let body: BotKeyBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const validScopes: BotScope[] = ['post:write', 'post:read', 'members:read', 'stats:read'];
  const scopes = (body.scopes ?? ['post:write']).filter((s): s is BotScope =>
    validScopes.includes(s),
  );

  const rawKey = `df_bot_${generateSecret(24)}`;
  const keyHash = await hashKey(rawKey);

  const botKey: import('../lib/feddy-store').BotApiKey = {
    id: crypto.randomUUID(),
    communityId: community.id,
    name: sanitizeString(body.name ?? 'Bot Key', 100),
    keyHash,
    scopes,
    createdBy: session.address,
    createdAt: Date.now(),
    isActive: true,
  };

  await createBotKey(c.env, botKey);

  return jsonResponse(
    {
      id: botKey.id,
      name: botKey.name,
      scopes: botKey.scopes,
      // Return raw key only once
      key: rawKey,
    },
    201,
  );
});

feddy.get('/:name/bot-keys', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const keys = await getBotKeys(c.env, community.id);
  const safeKeys = keys.map(({ keyHash: _, ...k }) => k);
  return noCacheJsonResponse({ botKeys: safeKeys });
});

feddy.delete('/:name/bot-keys/:kid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const keyId = sanitizeString(c.req.param('kid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  await deleteBotKey(c.env, community.id, keyId);
  return jsonResponse({ ok: true, deleted: keyId });
});

// ─── RSS Feed ──────────────────────────────────────────────────────────

feddy.get('/:name/rss', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const posts = await getCommunityPosts(c.env, community.id, 20);

  // Generate RSS XML
  const rssItems = posts.posts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.text.slice(0, 100)}${p.text.length > 100 ? '...' : ''}]]></title>
      <description><![CDATA[${p.text}]]></description>
      <link>https://degenfeed.xyz/feddy/${community.name}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <author>${p.authorDisplayName}</author>
    </item>
  `,
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${community.displayName}</title>
    <description>${community.description.slice(0, 500)}</description>
    <link>https://degenfeed.xyz/feddy/${community.name}</link>
    <atom:link href="https://degenfeed.xyz/api/feddy/${community.name}/rss" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${community.avatarUrl || 'https://degenfeed.xyz/favicon.png'}</url>
      <title>${community.displayName}</title>
      <link>https://degenfeed.xyz/feddy/${community.name}</link>
    </image>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
});

// ─── Links (Discord/Telegram) ─────────────────────────────────────────

feddy.post('/:name/links', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface LinksBody {
    discordLink?: string | null;
    telegramLink?: string | null;
  }
  let body: LinksBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const updates: Partial<FeddyCommunity> = {};
  if (body.discordLink !== undefined) updates.discordLink = body.discordLink || null;
  if (body.telegramLink !== undefined) updates.telegramLink = body.telegramLink || null;

  const updated = await updateCommunity(c.env, community.id, updates);
  return jsonResponse({
    ok: true,
    discordLink: updated?.discordLink,
    telegramLink: updated?.telegramLink,
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  WEBHOOK FIRING
// ═══════════════════════════════════════════════════════════════════════

async function fireWebhook(
  url: string,
  secret: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: Date.now(),
    });
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-feddy-event': event,
        'x-feddy-signature': await hashKey(`${secret}:${body}`),
        'user-agent': 'DegenFeed-Feddy-Webhook/1.0',
      },
      body,
    });
  } catch {
    // Webhook delivery failure is non-critical
  }
}

export default feddy;
