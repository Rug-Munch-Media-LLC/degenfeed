/**
 * Bonfire Provider
 *
 * Fetches posts from Bonfire instances — an open-source framework for
 * building federated digital spaces. Mastodon-compatible REST API
 * plus GraphQL at /api/.
 *
 * API: REST at /api/v1/ (Mastodon-compatible)
 *   GET /api/v1/timelines/public — public timeline
 *   GET /api/v1/instance — instance info
 *   GET /api/v1/accounts/{id}/statuses — user's statuses
 *   GET /api/v1/timelines/tag/{tag} — hashtag timeline
 *
 * GraphQL at /api/ for complex queries.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const BONFIRE_INSTANCES = [
  'http://127.0.0.1:8099',
  'https://social.bonfirenetworks.org',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface BonfireStatus {
  id: string;
  content: string;
  created_at: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    note?: string;
    followers_count?: number;
    following_count?: number;
  };
  media_attachments?: Array<{
    id: string;
    type: 'image' | 'video' | 'audio' | 'unknown';
    url: string;
    preview_url?: string;
    description?: string;
  }>;
  tags?: Array<{ name: string; url: string }>;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  sensitive?: boolean;
  visibility?: string;
  url?: string;
}

interface BonfireTimelineResponse {
  data?: BonfireStatus[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function guessNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const niches: string[] = [];
  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi)\b/.test(lower)) niches.push('crypto');
  if (/\b(ai|artificial|intelligence|llm|machine)\b/.test(lower)) niches.push('ai');
  if (/\b(fediverse|activitypub|bonfire|federation|decentralized)\b/.test(lower)) niches.push('fediverse');
  if (/\b(community|group|cooperative|commons|p2p|peer)\b/.test(lower)) niches.push('community');
  if (/\b(tech|programming|code|software|opensource)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('social');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function bonfireStatusToPost(status: BonfireStatus, instance: string): UnifiedPost {
  const text = stripHtml(status.content).slice(0, 2000);
  const tags = (status.tags || []).map((t) => t.name);

  return {
    id: `bonfire:${status.id}`,
    protocol: 'bonfire',
    author: {
      id: `bonfire:${status.account.id}`,
      primary: { protocol: 'bonfire', id: status.account.username },
      handles: { bonfire: status.account.username },
      displayName: status.account.display_name || status.account.username,
      bio: status.account.note ? stripHtml(status.account.note) : '',
      avatarUrl: status.account.avatar || '',
      followerCount: status.account.followers_count || 0,
      followingCount: status.account.following_count || 0,
      links: [],
      keys: {},
    },
    text,
    embeds: (status.media_attachments || []).map((m) => ({
      kind: m.type as 'image' | 'video' | 'audio',
      url: m.url,
      meta: { preview: m.preview_url, alt: m.description },
    })),
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: new Date(status.created_at).getTime(),
    metrics: {
      likes: status.favourites_count || 0,
      reposts: status.reblogs_count || 0,
      replies: status.replies_count || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false, viewerReposted: false, viewerBookmarked: false,
      raw: { likes: status.favourites_count || 0, reposts: status.reblogs_count || 0, replies: status.replies_count || 0, quotes: 0 },
    },
    raw: status,
    niches: guessNiches(text + ' ' + tags.join(' ')),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${instance}/api/v1/timelines/public?limit=${Math.min(limit, 40)}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Bonfire)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = await res.json() as BonfireStatus[] | BonfireTimelineResponse;
    const statuses = Array.isArray(data) ? data : (data as BonfireTimelineResponse).data || [];
    if (!Array.isArray(statuses)) return [];

    return statuses.slice(0, limit).map((s) => bonfireStatusToPost(s, instance));
  } catch (err) {
    console.log(`[bridge] Bonfire error (${instance}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'bonfire',
  name: 'Bonfire',
  description: 'Federated social toolkit — Mastodon-compatible API',
  endpoint: '/api/feed/bonfire',
  requiresAuth: false,
  contentType: 'social',
};

export async function fetchBonfirePosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(5, Math.ceil(limit / BONFIRE_INSTANCES.length));

  const results = await Promise.allSettled(
    BONFIRE_INSTANCES.map((inst) => fetchFromInstance(inst, perInstance)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Bonfire: ${deduped.length} posts`);
  return deduped;
}

export const fetch = fetchBonfirePosts;
