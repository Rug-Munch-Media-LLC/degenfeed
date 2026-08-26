/**
 * Mitra Provider
 *
 * Fetches posts from Mitra instances — an ultra-lightweight federated
 * microblogging server written in Rust (<50MB RAM). Part of the Fediverse
 * with Mastodon-compatible API.
 *
 * API: Mastodon-compatible REST
 *   GET /api/v1/timelines/public — public timeline
 *   GET /api/v1/instance — instance info
 *   GET /api/v1/accounts/{id}/statuses — user statuses
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const _$fetch = globalThis.fetch;

// Dead local instance (127.0.0.1:8100) caused rejection storms that starved
// the bridge event loop — instances are env-configurable now.
const MITRA_INSTANCES = (process.env.MITRA_INSTANCES || 'https://public.mitra.social')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

interface MitraStatus {
  id: string;
  content: string;
  created_at: string;
  account: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
    note?: string;
  };
  media_attachments?: Array<{ id: string; type: string; url: string; preview_url?: string }>;
  tags?: Array<{ name: string }>;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessMicropostNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|bitcoin|ethereum|solana|web3|defi|nft)\b/.test(lower)) n.push('crypto');
  if (/\b(ai|llm|artificial|intelligence|machine)\b/.test(lower)) n.push('ai');
  if (/\b(fediverse|activitypub|federation|mastodon|mitra)\b/.test(lower)) n.push('fediverse');
  if (/\b(rust|programming|tech|code|linux|server)\b/.test(lower)) n.push('tech');
  if (/\b(privacy|security|cryptography|encryption|tor)\b/.test(lower)) n.push('privacy');
  if (n.length === 0) n.push('microblog');
  return n;
}

function mitraStatusToPost(s: MitraStatus, _instance: string): UnifiedPost {
  const text = stripHtml(s.content).slice(0, 2000);
  const tags = (s.tags || []).map((t) => t.name);
  return {
    id: `mitra:${s.id}`,
    protocol: 'mitra',
    author: {
      id: `mitra:${s.account.id}`,
      primary: { protocol: 'mitra', id: s.account.username },
      handles: { mitra: s.account.username },
      displayName: s.account.display_name || s.account.username,
      bio: s.account.note ? stripHtml(s.account.note) : '',
      avatarUrl: s.account.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: (s.media_attachments || []).map((m) => ({
      kind: m.type as 'image' | 'video',
      url: m.url,
    })),
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: new Date(s.created_at).getTime(),
    metrics: {
      likes: s.favourites_count || 0,
      reposts: s.reblogs_count || 0,
      replies: s.replies_count || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: s.favourites_count || 0,
        reposts: s.reblogs_count || 0,
        replies: s.replies_count || 0,
        quotes: 0,
      },
    },
    raw: s,
    niches: guessMicropostNiches(`${text} ${tags.join(' ')}`),
  };
}

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(`${instance}/api/v1/timelines/public?limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Mitra)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MitraStatus[];
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((s) => mitraStatusToPost(s, instance));
  } catch {
    return [];
  }
}

export const schema: SchemaGuard = {
  id: 'mitra',
  name: 'Mitra',
  description: 'Lightweight federated microblogging — Rust, <50MB RAM',
  endpoint: '/api/feed/mitra',
  requiresAuth: false,
  contentType: 'microblog',
};

export async function fetchMitraPosts(limit = 20): Promise<UnifiedPost[]> {
  const per = Math.max(5, Math.ceil(limit / MITRA_INSTANCES.length));
  const results = await Promise.allSettled(MITRA_INSTANCES.map((i) => fetchFromInstance(i, per)));
  const all: UnifiedPost[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all)
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  // console.log(`[bridge] Mitra: ${deduped.length} posts`);
  return deduped;
}

export const fetch = fetchMitraPosts;
