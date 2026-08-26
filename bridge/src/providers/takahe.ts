/**
 * Takahē Provider
 *
 * Fetches posts from Takahē instances — an ActivityPub server designed
 * for multiple domains on the same infrastructure.
 * Mastodon Client API compatible.
 *
 * API: Mastodon-compatible REST
 *   GET /api/v1/timelines/public — public timeline
 *   GET /api/v1/instance — instance info
 *   GET /.well-known/nodeinfo — node info
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const _$fetch = globalThis.fetch;

// Dead local instance (127.0.0.1:8101) caused an unhandled-rejection storm that
// starved the bridge event loop — instances are env-configurable now.
const TAKAHE_INSTANCES = (process.env.TAKAHE_INSTANCES || 'https://takahe.social')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

interface TakaheStatus {
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
  media_attachments?: Array<{ id: string; type: string; url: string; preview_url?: string }>;
  tags?: Array<{ name: string }>;
  favourites_count?: number;
  reblogs_count?: number;
  replies_count?: number;
  url?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|bitcoin|ethereum|solana|defi|web3)\b/.test(lower)) n.push('crypto');
  if (/\b(ai|artificial|intelligence|llm)\b/.test(lower)) n.push('ai');
  if (/\b(takahe|activitypub|fediverse|federation)\b/.test(lower)) n.push('fediverse');
  if (/\b(django|python|web|development)\b/.test(lower)) n.push('tech');
  if (/\b(news|today|latest|update|breaking)\b/.test(lower)) n.push('news');
  if (n.length === 0) n.push('social');
  return n;
}

function takaheStatusToPost(s: TakaheStatus, _instance: string): UnifiedPost {
  const text = stripHtml(s.content).slice(0, 2000);
  return {
    id: `takahe:${s.id}`,
    protocol: 'takahe',
    author: {
      id: `takahe:${s.account.id}`,
      primary: { protocol: 'takahe', id: s.account.username },
      handles: { takahe: s.account.username },
      displayName: s.account.display_name || s.account.username,
      bio: s.account.note ? stripHtml(s.account.note) : '',
      avatarUrl: s.account.avatar || '',
      followerCount: s.account.followers_count || 0,
      followingCount: s.account.following_count || 0,
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
    niches: guessNiches(text),
  };
}

async function fetchFromInstance(instance: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(`${instance}/api/v1/timelines/public?limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Takahē)', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TakaheStatus[];
    if (!Array.isArray(data)) return [];
    return data.slice(0, limit).map((s) => takaheStatusToPost(s, instance));
  } catch {
    return [];
  }
}

export const schema: SchemaGuard = {
  id: 'takahe',
  name: 'Takahē',
  description: 'Multi-domain ActivityPub server — Mastodon-compatible API',
  endpoint: '/api/feed/takahe',
  requiresAuth: false,
  contentType: 'social',
};

export async function fetchTakahePosts(limit = 20): Promise<UnifiedPost[]> {
  const per = Math.max(5, Math.ceil(limit / TAKAHE_INSTANCES.length));
  const results = await Promise.allSettled(TAKAHE_INSTANCES.map((i) => fetchFromInstance(i, per)));
  const all: UnifiedPost[] = [];
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all)
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  console.log(`[bridge] Takahē: ${deduped.length} posts`);
  return deduped;
}

export const fetch = fetchTakahePosts;
