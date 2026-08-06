/**
 * @degenfeed/api-worker — Unified Profile (cross-service)
 *
 * GET /api/profile/me?username=<username>
 *
 * Returns the user's profile across every DegenFeed ActivityPub service that
 * has an account under the same username — one GTS account, one identity,
 * everywhere. Each service is queried over its PUBLIC API (no credentials
 * required) and reports `available: false` when no account exists, so the
 * frontend can render "you are not on WriteFreely yet" instead of guessing.
 *
 * Services queried:
 *   gotosocial  — WebFinger → ActivityPub actor (GTS is the identity provider)
 *   lemmy       — GET /api/v3/user?username=<u>
 *   pixelfed    — GET /api/v1/accounts/lookup?acct=<u> (Mastodon-compatible)
 *   peertube    — GET /api/v1/accounts?name=<u>
 *   writefreely — GET /api/collections/<u>
 *
 * Username resolution (priority):
 *   1. `username` query param (explicit, used by SSO-aware frontends)
 *   2. `acct` query param (Mastodon-style)
 *   3. Authorization: Bearer <degenfeed JWT> → `sub` claim
 *
 * All service queries run in parallel and are individually fault-tolerant —
 * a dead service degrades to `available: false` + error, never a 500.
 */

import { Hono } from 'hono';
import { log } from '../index';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

const DEFAULT_ACCOUNT_DOMAIN = 'degenfeed.xyz';

// Public service endpoints (self-hosted DegenFeed instances).
const SERVICES = [
  {
    key: 'gotosocial',
    name: 'GoToSocial',
    url: 'https://social.degenfeed.xyz',
    icon: '🐦',
    desc: 'Microblogging',
  },
  {
    key: 'lemmy',
    name: 'Lemmy',
    url: 'https://community.degenfeed.xyz',
    icon: '💬',
    desc: 'Communities',
  },
  {
    key: 'pixelfed',
    name: 'Pixelfed',
    url: 'https://photos.degenfeed.xyz',
    icon: '📸',
    desc: 'Photos',
  },
  {
    key: 'peertube',
    name: 'PeerTube',
    url: 'https://video.degenfeed.xyz',
    icon: '📹',
    desc: 'Video',
  },
  {
    key: 'writefreely',
    name: 'WriteFreely',
    url: 'https://blog.degenfeed.xyz',
    icon: '✍️',
    desc: 'Blogging',
  },
] as const;

interface ServiceProfile {
  available: boolean;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  profileUrl?: string;
  followers?: number;
  following?: number;
  posts?: number;
  error?: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: 'application/json, application/activity+json, text/html;q=0.8',
      'User-Agent': 'degenfeed-worker/0.1 (profile sync)',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

// ─── Per-service fetchers ────────────────────────────────────────────────

async function fetchGoToSocial(username: string): Promise<ServiceProfile> {
  // GTS blocks unauthenticated /api/v1/accounts/lookup, but WebFinger +
  // the ActivityPub actor are fully public and are the canonical identity.
  const webfinger = await fetchJson(
    `https://social.degenfeed.xyz/.well-known/webfinger?resource=acct:${encodeURIComponent(username)}@${DEFAULT_ACCOUNT_DOMAIN}`,
  );
  const links = Array.isArray(webfinger.links) ? (webfinger.links as Array<{ type?: string; href?: string }>) : [];
  const actorLink = links.find((l) => l.type === 'application/activity+json');
  const htmlLink = links.find((l) => l.type === 'text/html');
  if (!actorLink?.href) throw new Error('No ActivityPub actor link');

  const actor = await fetchJson(actorLink.href);
  const icon =
    typeof actor.icon === 'object' && actor.icon
      ? (actor.icon as { url?: string }).url ?? (actor.icon as { href?: string }).href
      : typeof actor.icon === 'string'
        ? actor.icon
        : undefined;
  return {
    available: true,
    username,
    displayName: (actor.name as string) || username,
    avatarUrl: icon,
    bio: (actor.summary as string) || '',
    profileUrl: htmlLink?.href ?? actorLink.href,
    followers: typeof actor.followers === 'object' && actor.followers ? Number((actor.followers as { totalItems?: unknown }).totalItems ?? 0) : undefined,
    following: typeof actor.following === 'object' && actor.following ? Number((actor.following as { totalItems?: unknown }).totalItems ?? 0) : undefined,
    posts: typeof actor.outbox === 'object' && actor.outbox ? Number((actor.outbox as { totalItems?: unknown }).totalItems ?? 0) : undefined,
  };
}

async function fetchLemmy(username: string): Promise<ServiceProfile> {
  const data = await fetchJson(
    `https://community.degenfeed.xyz/api/v3/user?username=${encodeURIComponent(username)}`,
  );
  const person = (data as { person_view?: { person?: Record<string, unknown> } }).person_view?.person;
  if (!person) throw new Error('No person');
  return {
    available: true,
    username: (person.name as string) ?? username,
    displayName: (person.display_name as string) || (person.name as string) || username,
    avatarUrl: (person.avatar as string) || undefined,
    bio: (person.bio as string) || undefined,
    profileUrl: (person.actor_id as string) || `https://community.degenfeed.xyz/u/${username}`,
    followers: typeof person.follower_count === 'number' ? person.follower_count : undefined,
    posts: typeof person.post_count === 'number' ? person.post_count : undefined,
  };
}

async function fetchPixelfed(username: string): Promise<ServiceProfile> {
  const account = await fetchJson(
    `https://photos.degenfeed.xyz/api/v1/accounts/lookup?acct=${encodeURIComponent(username)}`,
  );
  return {
    available: true,
    username: (account.username as string) ?? username,
    displayName: (account.display_name as string) || username,
    avatarUrl: (account.avatar as string) || undefined,
    bio: (account.note as string) || undefined,
    profileUrl: (account.url as string) || `https://photos.degenfeed.xyz/@${username}`,
    followers: typeof account.followers_count === 'number' ? account.followers_count : undefined,
    following: typeof account.following_count === 'number' ? account.following_count : undefined,
    posts: typeof account.statuses_count === 'number' ? account.statuses_count : undefined,
  };
}

async function fetchPeerTube(username: string): Promise<ServiceProfile> {
  const data = await fetchJson(
    `https://video.degenfeed.xyz/api/v1/accounts?name=${encodeURIComponent(username)}`,
  );
  const list = data.data as Array<Record<string, unknown>> | undefined;
  const account = Array.isArray(list) ? list.find((a) => (a.name as string)?.toLowerCase() === username.toLowerCase()) : undefined;
  if (!account) throw new Error('No account');
  const avatars = account.avatars as Array<{ path?: string; fileUrl?: string }> | undefined;
  return {
    available: true,
    username: (account.name as string) ?? username,
    displayName: (account.displayName as string) || (account.name as string) || username,
    avatarUrl: avatars?.find((a) => a.fileUrl || a.path)?.fileUrl ?? avatars?.find((a) => a.fileUrl || a.path)?.path,
    bio: (account.description as string) || undefined,
    profileUrl: (account.url as string) || `https://video.degenfeed.xyz/a/${username}`,
    followers: typeof account.followersCount === 'number' ? account.followersCount : undefined,
    posts: typeof account.videosCount === 'number' ? account.videosCount : undefined,
  };
}

async function fetchWriteFreely(username: string): Promise<ServiceProfile> {
  const collection = await fetchJson(
    `https://blog.degenfeed.xyz/api/collections/${encodeURIComponent(username)}`,
  );
  return {
    available: true,
    username: (collection.alias as string) ?? username,
    displayName: (collection.title as string) || username,
    bio: (collection.description as string) || undefined,
    profileUrl: (collection.url as string) || `https://blog.degenfeed.xyz/${username}`,
    posts: typeof collection.post_count === 'number' ? collection.post_count : undefined,
  };
}

const SERVICE_FETCHERS: Record<(typeof SERVICES)[number]['key'], (username: string) => Promise<ServiceProfile>> = {
  gotosocial: fetchGoToSocial,
  lemmy: fetchLemmy,
  pixelfed: fetchPixelfed,
  peertube: fetchPeerTube,
  writefreely: fetchWriteFreely,
};

// ─── Username resolution ─────────────────────────────────────────────────

/**
 * Resolve the requested username:
 *   1. ?username=… or ?acct=…
 *   2. Authorization: Bearer <JWT> → `sub` (degenfeed worker JWTs are HS256
 *      signed with AUTH_SECRET; SSO JWTs are verified by the SSO service, so
 *      we only accept our own tokens here — query params are the primary path).
 */
async function resolveUsername(request: Request, env: Env): Promise<string | null> {
  const params = new URL(request.url).searchParams;
  const explicit = params.get('username') || params.get('acct');
  if (explicit) return explicit.trim().replace(/^@/, '').split('@')[0] ?? null;

  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && env.AUTH_SECRET) {
    try {
      const { Jwt } = await import('hono/utils/jwt');
      const payload = await Jwt.verify(auth.slice(7), env.AUTH_SECRET, 'HS256');
      if (typeof payload.sub === 'string' && payload.sub) return payload.sub;
    } catch {
      // Invalid/expired token — fall through.
    }
  }
  return null;
}

// ─── Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/profile/me — unified cross-service profile.
 */
export async function handleProfileMe(request: Request, env: Env): Promise<Response> {
  const username = await resolveUsername(request, env);
  if (!username) {
    return jsonResponse(
      { error: 'Missing username. Pass ?username=<name> or an Authorization bearer JWT.' },
      401,
    );
  }

  const results: Record<string, ServiceProfile> = {};
  const available: string[] = [];
  const missing: string[] = [];

  await Promise.all(
    SERVICES.map(async (service) => {
      try {
        const profile = await SERVICE_FETCHERS[service.key](username);
        results[service.key] = { ...profile };
        available.push(service.key);
      } catch (err) {
        results[service.key] = {
          available: false,
          error: err instanceof Error ? err.message : 'unavailable',
        };
        missing.push(service.key);
      }
    }),
  );

  const profiles = Object.fromEntries(
    SERVICES.map((s) => [
      s.key,
      {
        ...s,
        ...results[s.key],
      },
    ]),
  );

  return jsonResponse({
    username,
    primary: {
      protocol: 'gotosocial',
      url: `https://social.degenfeed.xyz/@${username}`,
      available: results.gotosocial?.available ?? false,
    },
    profiles,
    summary: {
      total: SERVICES.length,
      available: available.length,
      missing,
      timestamp: Date.now(),
    },
  });
}

// ─── Hono sub-router (parallel to the handler for app.ts registration) ───

const router = new Hono<{ Bindings: Env }>();

router.get('/api/profile/me', async (c) => {
  try {
    return await handleProfileMe(c.req.raw, c.env);
  } catch (err) {
    log('error', 'profile/me error', err instanceof Error ? err.message : 'unknown');
    return jsonResponse({ error: 'Failed to load profile' }, 500);
  }
});

export default router;
