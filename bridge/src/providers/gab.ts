/**
 * Gab / Dissenter Provider
 *
 * Fetches posts from Gab — a free speech social network.
 * Gab is a Mastodon fork and uses the Mastodon-compatible REST API.
 *
 * API: https://gab.com/api/v1/ (Mastodon-compatible)
 * Dissenter (commenting browser extension) integrated via Gab API.
 *
 * NOTE: Gab requires authentication for most API endpoints.
 * We access via public RSS and/oembed where possible, plus
 * authenticated API via env credentials.
 *
 * Content strategy:
 * 1. Public timeline via RSS/oembed endpoints
 * 2. Authenticated API for trending/discover
 * 3. Hashtag feeds for crypto/tech/politics topics
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const GAB_BASE = process.env.GAB_INSTANCE_URL || 'https://gab.com';

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

// ─── Map Gab post to UnifiedPost ────────────────────────────────────────

function gabPostToPost(post: GabPost): UnifiedPost {
  const original = post.reblog ?? post;
  const content = stripHtml(original.content || '');
  const text = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${content}` : content;
  const acct = original.account;

  // Determine content type
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
  } catch (err) {
    console.log(`[bridge] Gab timeline error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchHashtagFeed(tag: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${GAB_BASE}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${Math.min(limit, 20)}`,
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

async function fetchExplore(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${GAB_BASE}/api/v1.1/explore/posts?limit=${Math.min(limit, 20)}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Gab)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const posts = (await res.json()) as GabPost[];
    if (!Array.isArray(posts)) return [];
    return posts.map(gabPostToPost);
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

const CRYPTO_TAGS = ['bitcoin', 'ethereum', 'crypto', 'defi', 'nft', 'blockchain', 'web3'];
const TECH_TAGS = ['tech', 'startup', 'ai', 'freespeech'];

export async function fetchGabPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 4));

  const [publicPosts, explorePosts, ...tagPosts] = await Promise.all([
    fetchPublicTimeline(perSource),
    fetchExplore(perSource),
    ...CRYPTO_TAGS.slice(0, 3).map((t) => fetchHashtagFeed(t, 5)),
    ...TECH_TAGS.slice(0, 2).map((t) => fetchHashtagFeed(t, 5)),
  ]);

  const all = [publicPosts, explorePosts, ...tagPosts].flat();

  // Deduplicate by post ID
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Gab: ${deduped.length} posts from ${all.length} raw`);
  return deduped;
}

/** @alias */
export const fetch = fetchGabPosts;
