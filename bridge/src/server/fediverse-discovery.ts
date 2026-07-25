/**
 * Fediverse Discovery
 *
 * Shows users content from the wider fediverse:
 *   - Trending on Mastodon
 *   - Trending on PeerTube
 *   - Popular Lemmy communities
 *   - Follow any ActivityPub user from any instance
 *   - Content from followed accounts appears in DegenFeed
 */

import { checkRateLimit } from '../rate-limiter';
import type { UnifiedPost } from './types';

const GTS_BASE = process.env.GTS_BASE || 'http://127.0.0.1:8082';

/** Known public Mastodon instances for trending content */
const TRENDING_INSTANCES = [
  'https://mastodon.social',
  'https://mastodon.online',
  'https://mstdn.social',
  'https://mas.to',
  'https://hachyderm.io',
];

/** Known public PeerTube instances for trending videos */
const PEERTUBE_INSTANCES = [
  'https://video.degenfeed.xyz',
  'https://joinpeertube.org',
  'https://peertube.tv',
  'https://tilvids.com',
];

interface MastodonTag {
  name: string;
  url: string;
  history?: Array<{ day: string; uses: string; accounts: string }>;
  following_count?: number;
}

interface MastodonTrend {
  id: string;
  account: { id: string; username: string; acct: string; display_name: string; avatar: string };
  content: string;
  created_at: string;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  tags: Array<{ name: string }>;
  media_attachments: Array<{ type: string; url: string }>;
  url: string;
}

/**
 * Fetch trending hashtags from the fediverse.
 * Aggregates from GTS + public Mastodon instances.
 */
export async function fetchTrendingHashtags(): Promise<
  Array<{ name: string; url: string; score: number; instances: string[] }>
> {
  const tagMap = new Map<
    string,
    { name: string; url: string; score: number; instances: string[] }
  >();

  // Try GTS first
  try {
    const gtsRes = await fetch(`${GTS_BASE}/api/v1/trends/tags?limit=20`, {
      signal: AbortSignal.timeout(5000),
    });
    if (gtsRes.ok) {
      const tags = (await gtsRes.json()) as MastodonTag[];
      for (const tag of tags) {
        const existing = tagMap.get(tag.name) || {
          name: tag.name,
          url: tag.url,
          score: 0,
          instances: [],
        };
        existing.score += tag.history
          ? tag.history.reduce((sum, h) => sum + parseInt(h.uses, 10), 0)
          : 10;
        existing.instances.push('social.degenfeed.xyz');
        tagMap.set(tag.name, existing);
      }
    }
  } catch {
    // GTS not available
  }

  // Fetch from public instances in parallel
  const instanceFetches = TRENDING_INSTANCES.map(async (instance) => {
    try {
      const res = await fetch(`${instance}/api/v1/trends/tags?limit=10`, {
        headers: { 'User-Agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const tags = (await res.json()) as MastodonTag[];
      return tags.map((t) => ({ ...t, instance }));
    } catch {
      return [];
    }
  });

  const settledResults = await Promise.allSettled(instanceFetches);
  for (const result of settledResults) {
    if (result.status !== 'fulfilled') continue;
    for (const tag of result.value) {
      if (!tag) continue;
      const existing = tagMap.get(tag.name) || {
        name: tag.name,
        url: tag.url,
        score: 0,
        instances: [],
      };
      existing.score += tag.history
        ? tag.history.reduce((sum, h) => sum + parseInt(h.uses, 10), 0)
        : 10;
      existing.instances.push(new URL(tag.instance || '').hostname);
      tagMap.set(tag.name, existing);
    }
  }

  // Sort by score descending
  return [...tagMap.values()].sort((a, b) => b.score - a.score).slice(0, 30);
}

/**
 * Fetch trending posts/statuses from the fediverse.
 * Combines trending on GTS + public Mastodon instances.
 */
export async function fetchTrendingPosts(
  limit: number = 20,
  accessToken?: string,
): Promise<UnifiedPost[]> {
  if (!checkRateLimit('fediverse-trending', { maxRequests: 60, windowMs: 60_000 })) {
    return [];
  }

  const posts: UnifiedPost[] = [];
  const headers: Record<string, string> = { 'User-Agent': 'DegenFeed/0.1' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  // Try GTS trending
  try {
    const gtsUrl = `${GTS_BASE}/api/v1/trends/statuses?limit=${Math.ceil(limit / 3)}`;
    const gtsRes = await fetch(gtsUrl, { headers, signal: AbortSignal.timeout(5000) });
    if (gtsRes.ok) {
      const { statusToPost } = await import('../providers/gotosocial');
      const raw = (await gtsRes.json()) as any[];
      for (const s of raw) {
        try {
          posts.push(statusToPost(s, 'social.degenfeed.xyz'));
        } catch {
          // skip malformed
        }
      }
    }
  } catch {
    // GTS not available
  }

  // Fetch from public instances
  const perInstance = Math.max(2, Math.ceil((limit - posts.length) / TRENDING_INSTANCES.length));
  const fetches = TRENDING_INSTANCES.map(async (instance) => {
    try {
      const res = await fetch(`${instance}/api/v1/trends/statuses?limit=${perInstance}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const { statusToPost } = await import('../providers/gotosocial');
      const raw = (await res.json()) as any[];
      return raw.map((s) => statusToPost(s, new URL(instance).hostname));
    } catch {
      return [];
    }
  });

  const settled = await Promise.allSettled(fetches);
  for (const r of settled) {
    if (r.status === 'fulfilled') posts.push(...r.value);
  }

  // Deduplicate by text prefix
  const seen = new Set<string>();
  return posts
    .filter((p) => {
      const key = p.text.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/**
 * Discover popular Lemmy communities from across the fediverse.
 */
export async function discoverPopularCommunities(): Promise<
  Array<{
    name: string;
    title: string;
    description: string;
    instance: string;
    subscribers: number;
    posts: number;
    icon?: string;
    banner?: string;
  }>
> {
  const communities: Array<{
    name: string;
    title: string;
    description: string;
    instance: string;
    subscribers: number;
    posts: number;
    icon?: string;
    banner?: string;
  }> = [];

  // Try local Lemmy first
  try {
    const res = await fetch('http://127.0.0.1:8536/api/v3/community/list?limit=20&sort=Hot', {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        communities?: Array<{
          community: {
            id: number;
            name: string;
            title: string;
            description?: string;
            icon?: string;
            banner?: string;
          };
          counts: { subscribers: number; posts: number };
        }>;
      };
      if (data.communities) {
        for (const c of data.communities) {
          communities.push({
            name: c.community.name,
            title: c.community.title,
            description: c.community.description || '',
            instance: 'talk.degenfeed.xyz',
            subscribers: c.counts.subscribers,
            posts: c.counts.posts,
            icon: c.community.icon,
            banner: c.community.banner,
          });
        }
      }
    }
  } catch {
    // Local Lemmy not available
  }

  // Try popular external instances
  const externalInstances = ['https://lemmy.world', 'https://lemmy.ml', 'https://sh.itjust.works'];

  const fetches = externalInstances.map(async (instance) => {
    try {
      const res = await fetch(`${instance}/api/v3/community/list?limit=10&sort=Hot&type_=All`, {
        headers: { 'User-Agent': 'DegenFeed/0.1' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        communities?: Array<{
          community: {
            id: number;
            name: string;
            title: string;
            description?: string;
            icon?: string;
          };
          counts: { subscribers: number; posts: number };
        }>;
      };
      return (data.communities || []).map((c) => ({
        name: c.community.name,
        title: c.community.title,
        description: c.community.description || '',
        instance: new URL(instance).hostname,
        subscribers: c.counts.subscribers,
        posts: c.counts.posts,
        icon: c.community.icon,
      }));
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === 'fulfilled') communities.push(...r.value);
  }

  // Sort by subscribers descending
  return communities.sort((a, b) => b.subscribers - a.subscribers).slice(0, 30);
}

/**
 * Search for ActivityPub accounts across the fediverse.
 * Uses GTS's built-in account search (which federates).
 */
export async function searchFediverseAccounts(
  query: string,
  limit: number = 10,
  accessToken?: string,
): Promise<
  Array<{
    id: string;
    username: string;
    acct: string;
    display_name: string;
    avatar: string;
    header: string;
    note: string;
    followers_count: number;
    following_count: number;
    url: string;
    source?: string;
  }>
> {
  if (!query.trim()) return [];

  const headers: Record<string, string> = { 'User-Agent': 'DegenFeed/0.1' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    const res = await fetch(
      `${GTS_BASE}/api/v1/accounts/search?q=${encodeURIComponent(query)}&limit=${limit}&resolve=true`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    return res.json() as Promise<any[]>;
  } catch {
    return [];
  }
}

/**
 * Follow an ActivityPub user from any instance.
 * Returns the followed account or throws.
 */
export async function followFediverseAccount(
  accountId: string,
  accessToken: string,
): Promise<{ id: string; username: string; acct: string; display_name: string; avatar: string }> {
  const res = await fetch(`${GTS_BASE}/api/v1/accounts/${encodeURIComponent(accountId)}/follow`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Follow failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Lookup an ActivityPub account by Webfinger address (e.g., @user@instance.com).
 */
export async function lookupFediverseAccount(
  acct: string,
  accessToken?: string,
): Promise<{
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
  header: string;
  note: string;
  followers_count: number;
  following_count: number;
  url: string;
} | null> {
  const headers: Record<string, string> = { 'User-Agent': 'DegenFeed/0.1' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  try {
    const res = await fetch(`${GTS_BASE}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
