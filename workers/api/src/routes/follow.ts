/**
 * /api/follow — Protocol-native follow/unfollow API
 *
 * POST   /api/follow          — Follow a user on a specific protocol
 * DELETE /api/follow          — Unfollow a user
 * GET    /api/follow/list     — List all follows for the authenticated user
 * GET    /api/follow/check    — Check if following a specific user
 * GET    /api/follow/feed     — Feed filtered to content from followed users only
 *
 * All endpoints require a valid session cookie.
 * Data stored in KV under key: `user:following:{wallet_address}`
 * Backward-compat key: `user:follows:{wallet_address}` (flat ID array for feed pipeline)
 */

import { GtSClient } from '@degenfeed/mastodon-sdk';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Types ───────────────────────────────────────────────────

interface FollowEntry {
  targetId: string;
  protocol: string;
  displayName?: string;
  followedAt: number;
}

interface FollowRequestBody {
  targetId?: string;
  protocol?: string;
  displayName?: string;
  /** Protocol-specific auth tokens (client-provided, e.g. { mastodon: '...', mastodon_instance: '...' }) */
  auth?: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────

const VALID_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
  'threads',
  'rss',
  'lemmy',
  'reddit',
  'peertube',
  'youtube',
  'kbin',
  'tildes',
]);

const GOTOSOCIAL_INSTANCE_URL = 'https://social.degenfeed.xyz';

// ─── KV key helpers ──────────────────────────────────────────

/** Structured follow entries — array of FollowEntry objects */
function followingKey(address: string): string {
  return `user:following:${address.toLowerCase()}`;
}

/** Flat array of targetId strings for backward compat with feed pipeline */
function followsKey(address: string): string {
  return `user:follows:${address.toLowerCase()}`;
}

// ─── Helpers ─────────────────────────────────────────────────

function parseBody(request: Request): Promise<FollowRequestBody> {
  return request.json() as Promise<FollowRequestBody>;
}

/**
 * Call the Mastodon API to follow/unfollow an account.
 * Requires the user's Mastodon auth token in body.auth.
 */
async function mastodonFollowAction(
  action: 'follow' | 'unfollow',
  targetId: string,
  auth: Record<string, string> | undefined,
): Promise<void> {
  const token = auth?.mastodon;
  const instance = auth?.mastodon_instance || GOTOSOCIAL_INSTANCE_URL;
  if (!token) return; // No token = KV-only tracking (user can link Mastodon later)

  const client = new GtSClient(instance, token);
  if (action === 'follow') {
    await client.follow(targetId);
  } else {
    await client.unfollow(targetId);
  }
}

/**
 * Load the user's follow list from KV.
 */
async function loadFollows(env: Env, wallet: string): Promise<FollowEntry[]> {
  if (!env.CACHE) return [];
  const raw = await env.CACHE.get(followingKey(wallet));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FollowEntry[];
  } catch {
    return [];
  }
}

/**
 * Save follow entries to KV — writes both the structured data
 * and the backward-compat flat ID array.
 */
async function saveFollows(env: Env, wallet: string, entries: FollowEntry[]): Promise<void> {
  if (!env.CACHE) return;
  await env.CACHE.put(followingKey(wallet), JSON.stringify(entries));
  // Backward-compat flat ID array for the feed pipeline (loadUserRankingContext reads this)
  await env.CACHE.put(followsKey(wallet), JSON.stringify(entries.map((e) => e.targetId)));
}

// ─── POST /api/follow — Follow a user ────────────────────────

export async function handleFollowAdd(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: FollowRequestBody;
  try {
    body = await parseBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { targetId, protocol, displayName, auth } = body;
  if (!targetId || !protocol) {
    return jsonResponse({ error: 'targetId and protocol are required' }, 400);
  }

  if (!VALID_PROTOCOLS.has(protocol)) {
    return jsonResponse(
      {
        error: `Unsupported protocol: ${protocol}. Supported: ${[...VALID_PROTOCOLS].join(', ')}`,
      },
      400,
    );
  }

  // Protocol-specific remote follow (best-effort — failures are logged, not returned)
  if (protocol === 'mastodon') {
    try {
      await mastodonFollowAction('follow', targetId, auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[follow] Mastodon follow API call failed (non-blocking): ${msg}`);
    }
  }

  // Store in KV
  const wallet = session.address;
  const entries = await loadFollows(env, wallet);

  // Deduplicate: if same targetId+protocol already exists, update displayName (refresh)
  const existingIndex = entries.findIndex(
    (e) => e.targetId === targetId && e.protocol === protocol,
  );

  if (existingIndex >= 0) {
    const existing = entries[existingIndex] as FollowEntry;
    entries[existingIndex] = {
      targetId,
      protocol,
      displayName: displayName || existing.displayName,
      followedAt: existing.followedAt,
    };
  } else {
    entries.push({
      targetId,
      protocol,
      displayName,
      followedAt: Date.now(),
    });
  }

  await saveFollows(env, wallet, entries);

  return jsonResponse({
    ok: true,
    following: true,
    targetId,
    protocol,
    displayName,
  });
}

// ─── DELETE /api/follow — Unfollow a user ────────────────────

export async function handleFollowRemove(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: FollowRequestBody;
  try {
    body = await parseBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { targetId, protocol, auth } = body;
  if (!targetId || !protocol) {
    return jsonResponse({ error: 'targetId and protocol are required' }, 400);
  }

  // Protocol-specific remote unfollow (best-effort)
  if (protocol === 'mastodon') {
    try {
      await mastodonFollowAction('unfollow', targetId, auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[follow] Mastodon unfollow API call failed (non-blocking): ${msg}`);
    }
  }

  // Remove from KV
  const wallet = session.address;
  const entries = await loadFollows(env, wallet);
  const filtered = entries.filter((e) => !(e.targetId === targetId && e.protocol === protocol));

  if (filtered.length === entries.length) {
    return jsonResponse({
      ok: true,
      following: false,
      note: 'Not currently following',
    });
  }

  await saveFollows(env, wallet, filtered);

  return jsonResponse({
    ok: true,
    following: false,
    targetId,
    protocol,
  });
}

// ─── GET /api/follow/list — List all follows ─────────────────

export async function handleFollowList(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const entries = await loadFollows(env, session.address);

  // Optional sort
  const sort = new URL(request.url).searchParams.get('sort');
  if (sort === 'oldest') {
    entries.sort((a, b) => a.followedAt - b.followedAt);
  } else if (sort === 'protocol') {
    entries.sort((a, b) => a.protocol.localeCompare(b.protocol) || b.followedAt - a.followedAt);
  } else {
    // Default: newest first
    entries.sort((a, b) => b.followedAt - a.followedAt);
  }

  return noCacheJsonResponse({ follows: entries, total: entries.length });
}

// ─── GET /api/follow/check — Check if following a user ───────

export async function handleFollowCheck(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const targetId = url.searchParams.get('targetId');
  const protocol = url.searchParams.get('protocol');

  if (!targetId || !protocol) {
    return jsonResponse({ error: 'targetId and protocol query parameters required' }, 400);
  }

  const entries = await loadFollows(env, session.address);
  const found = entries.some((e) => e.targetId === targetId && e.protocol === protocol);

  return noCacheJsonResponse({ following: found, targetId, protocol });
}

// ─── GET /api/follow/feed — Following feed (only followed users) ──

export async function handleFollowingFeed(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Load the user's follows
  const entries = await loadFollows(env, session.address);
  if (entries.length === 0) {
    return noCacheJsonResponse({
      data: [],
      meta: { total: 0, note: 'Follow some users to see their content here' },
    });
  }

  // Build a set of targetIds for fast lookup
  const followedIds = new Set(entries.map((e) => e.targetId));

  // Fetch the home feed — reuse the existing pipeline
  const { handleHomeFeed } = await import('./feed');
  const homeResp = await handleHomeFeed(request, env);

  // If home feed failed, return empty
  if (!homeResp.ok) {
    // Try to parse the body for error info
    try {
      const body = await homeResp.json();
      return noCacheJsonResponse({
        data: [],
        meta: { total: 0, error: body },
      });
    } catch {
      return noCacheJsonResponse({
        data: [],
        meta: { total: 0 },
      });
    }
  }

  // Parse the home feed response and filter to followed users
  try {
    const body = (await homeResp.json()) as {
      data?: Array<{ author?: { id?: string } }>;
      meta?: Record<string, unknown>;
    };

    if (!body.data || !Array.isArray(body.data)) {
      return noCacheJsonResponse({
        data: [],
        meta: { total: 0 },
      });
    }

    const filtered = body.data.filter((post) => {
      // Match by author.id — the feed pipeline uses IDs like "nostr:npub1...",
      // "farcaster:0x...", "mastodon:1234@instance", etc.
      const authorId = post.author?.id;
      return authorId ? followedIds.has(authorId) : false;
    });

    return noCacheJsonResponse({
      data: filtered,
      meta: {
        ...body.meta,
        total: filtered.length,
        unfilteredTotal: body.data.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to filter following feed';
    console.warn(`[follow] handleFollowingFeed parse error: ${msg}`);
    return noCacheJsonResponse({
      data: [],
      meta: { total: 0, error: msg },
    });
  }
}
