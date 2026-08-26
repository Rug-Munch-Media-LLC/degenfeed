/**
 * Gab / Dissenter Provider
 *
 * Fetches posts from Gab — a free speech social network.
 * Gab is a Mastodon fork and uses the Mastodon-compatible REST API.
 *
 * Public API reality (verified 2026-08-06):
 *   - GET /api/v1/timelines/public → HTTP 403 (datacenter-blocked)
 *   - GET /api/v1/accounts/{id}/statuses → auth-gated (empty/errors)
 *   - GET /api/v1/accounts/search → requires access token
 *   - Profile RSS (/user/{u}/rss) → HTML app shell, not real RSS
 *
 * The reliable anonymous path is the self-hosted RSS-Bridge GabBridge:
 *   http://127.0.0.1:8282/?action=display&bridge=GabBridge&username={u}&format=Json
 * which returns a JSON Feed of recent posts for a username.
 *
 * Strategy:
 * 1. Direct Gab API (works from non-datacenter egress / with credentials)
 * 2. RSS-Bridge GabBridge for a curated list of active usernames
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const GAB_BASE = process.env.GAB_INSTANCE_URL || 'https://gab.com';
const RSS_BRIDGE_BASE = process.env.RSSBRIDGE_URL || 'http://127.0.0.1:8282';

// ─── Types ─────────────────────────────────────────────────────────────

interface GabAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  header: string;
  followers_count: number;
  following_count: number;
  is_verified: boolean;
  is_group?: boolean;
  is_donor?: boolean;
}

interface GabMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'unknown';
  url: string;
  preview_url: string;
  description?: string;
}

interface GabPost {
  id: string;
  uri: string;
  url: string;
  created_at: string;
  content: string;
  account: GabAccount;
  media_attachments: GabMediaAttachment[];
  tags: Array<{ name: string; url: string }>;
  mentions: Array<{ url: string; username: string; acct: string; id: string }>;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  language: string;
  emojis: Array<{ shortcode: string; url: string; static_url: string }>;
  card?: {
    url: string;
    title: string;
    description: string;
    image: string | null;
  };
  reblog?: GabPost | null;
}

interface JsonFeedItem {
  id?: string;
  title?: string;
  url?: string;
  date_modified?: string;
  content_html?: string;
  author?: { name?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance|congress|senate|federal)\b/.test(lower))
    niches.push('regulation');
  if (/\b(meme|pepe|doge|shib|bonk)\b/.test(lower)) niches.push('memecoin');
  if (/\b(security|hack|exploit|audit|scam|phishing|breach)\b/.test(lower)) niches.push('security');
  if (/\b(crypto|blockchain|web3|gab)\b/.test(lower)) niches.push('crypto');
  if (/\b(free speech|liberty|libertarian|rights|freedom)\b/.test(lower)) niches.push('politics');
  if (/\b(trump|biden|election|democrat|republican|gop|dems|vote)\b/.test(lower))
    niches.push('politics');
  if (/\b(tech|technology|programming|code|software|startup)\b/.test(lower)) niches.push('tech');
  if (/\b(news|breaking|report|update|press)\b/.test(lower)) niches.push('news');
  if (niches.length === 0) niches.push('general');
  return niches;
}

/** Curated active Gab accounts (verified to return items via RSS-Bridge 2026-08-06). */
const CURATED_USERS = [
  'gab',
  'jackposobiec',
  'robcary',
  'robertbridges',
  'mikecoudrey',
  'news',
];

// ─── Map Gab post to UnifiedPost ────────────────────────────────────────

function gabPostToPost(post: GabPost): UnifiedPost {
  const original = post.reblog ?? post;
  const content = stripHtml(original.content || '');
  const text = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${content}` : content;
  const acct = original.account;

  let contentType = 'text';
  if (original.media_attachments?.some((m) => m.type === 'video' || m.type === 'gifv')) {
    contentType = 'video';
  } else if (original.media_attachments?.some((m) => m.type === 'image')) {
    contentType = 'image';
  } else if (original.card?.image) {
    contentType = 'link';
  }

  return {
    id: `gab:${original.id}`,
    protocol: 'gab',
    author: {
      id: `gab:${acct.id}`,
      primary: { protocol: 'gab', id: acct.acct },
      handles: { gab: acct.acct },
      displayName: acct.display_name || acct.username || 'Gab User',
      bio: stripHtml(acct.note || ''),
      avatarUrl: acct.avatar || '',
      followerCount: acct.followers_count || 0,
      followingCount: acct.following_count || 0,
      links: [],
      keys: { gabUserId: acct.id },
    },
    text,
    html: original.content || '',
    embeds: [
      ...(original.media_attachments || []).map((m) => ({
        kind: (m.type === 'video' || m.type === 'gifv' ? 'video' : 'image') as 'image' | 'video',
        url: m.url,
        meta: {
          previewUrl: m.preview_url,
          description: m.description,
        },
      })),
      ...(original.card
        ? [
            {
              kind: 'link' as const,
              url: original.card.url,
              meta: {
                title: original.card.title,
                description: original.card.description,
                image: original.card.image,
              },
            },
          ]
        : []),
    ],
    contentType,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count || 0,
      reposts: original.reblogs_count || 0,
      replies: original.replies_count || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: original.favourites_count || 0,
        reposts: original.reblogs_count || 0,
        replies: original.replies_count || 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(text),
  };
}

/** Map a JSON Feed item from RSS-Bridge GabBridge into a UnifiedPost. */
function jsonFeedItemToPost(item: JsonFeedItem, username: string): UnifiedPost {
  const content = stripHtml(item.content_html || item.title || '');
  const url = item.url || `https://gab.com/${username}/posts/${item.id || ''}`;
  const createdAt = item.date_modified ? new Date(item.date_modified).getTime() : Date.now();
  const authorName = item.author?.name || username;

  return {
    id: `gab:rssbridge:${item.id || Buffer.from(url).toString('base64').slice(0, 24)}`,
    protocol: 'gab',
    author: {
      id: `gab:user:${username}`,
      primary: { protocol: 'gab', id: username },
      handles: { gab: username },
      displayName: authorName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { gabUserId: username },
    },
    text: content,
    embeds: url ? [{ kind: 'link' as const, url }] : [],
    contentType: 'text',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: item,
    niches: guessNiches(content),
  };
}

// ─── Fetch via Gab API ──────────────────────────────────────────────────

async function fetchPublicTimeline(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${GAB_BASE}/api/v1/timelines/public?local=true&limit=${Math.min(limit, 40)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Gab)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const posts = (await res.json()) as GabPost[];
    if (!Array.isArray(posts)) return [];
    return posts.map(gabPostToPost);
  } catch {
    return [];
  }
}

// ─── Fetch via RSS-Bridge GabBridge ────────────────────────────────────

async function fetchUserViaBridge(username: string): Promise<UnifiedPost[]> {
  try {
    const url = new URL(`${RSS_BRIDGE_BASE}/`);
    url.searchParams.set('action', 'display');
    url.searchParams.set('bridge', 'GabBridge');
    url.searchParams.set('username', username);
    url.searchParams.set('format', 'Json');

    const res = await $fetch(url.toString(), {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Gab RSS-Bridge)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: JsonFeedItem[] };
    if (!Array.isArray(data.items)) return [];
    return data.items
      .filter((item) => item && (item.content_html || item.title))
      .map((item) => jsonFeedItemToPost(item, username));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'gab',
  name: 'Gab / Dissenter',
  description: 'Free speech social network (Mastodon fork)',
  endpoint: '/api/feed/gab',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchGabPosts(limit = 20): Promise<UnifiedPost[]> {
  const perUser = Math.max(1, Math.ceil(limit / Math.max(CURATED_USERS.length, 1)));

  // 1. Direct API (works from non-datacenter egress / with credentials)
  const apiPosts = await fetchPublicTimeline(Math.min(limit, 10));

  // 2. RSS-Bridge GabBridge for curated users (reliable anonymous path)
  const bridgeResults = await Promise.allSettled(
    CURATED_USERS.slice(0, Math.min(6, Math.max(3, limit))).map(async (username) => {
      const posts = await fetchUserViaBridge(username);
      return posts.slice(0, perUser);
    }),
  );

  const all = [...apiPosts];
  for (const r of bridgeResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate by post ID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (seen.has(p.id) || deduped.length >= limit) continue;
    seen.add(p.id);
    deduped.push(p);
  }

  // console.log(`[bridge] Gab: ${deduped.length} posts from ${apiPosts.length} api + bridge`);
  return deduped;
}

/** @alias */
export const fetch = fetchGabPosts;
