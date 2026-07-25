/**
 * Micro.blog Provider
 *
 * Fetches posts from Micro.blog — a microblogging platform and social network
 * built on open standards (IndieWeb, Micropub, JSON Feed, WebSub).
 *
 * API: JSON Feed at https://micro.blog/feeds/{username}.json
 *      Discover feed at https://micro.blog/posts/discover
 *      Photos feed at https://micro.blog/feeds/photos.json
 *
 * Strategy:
 * 1. Discover feed for broad content discovery
 * 2. Curated user feeds (crypto/tech bloggers)
 * 3. Photos feed for visual content
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const MICROBLOG_API = 'https://micro.blog';

// ─── Types ─────────────────────────────────────────────────────────────

interface MicroblogAuthor {
  name?: string;
  url?: string;
  avatar?: string;
}

interface MicroblogItem {
  id: string;
  content_text?: string;
  content_html?: string;
  summary?: string;
  url?: string;
  external_url?: string;
  date_published?: string;
  date_modified?: string;
  author?: MicroblogAuthor;
  tags?: string[];
  _microblog?: {
    is_reply?: boolean;
    is_repost?: boolean;
    is_bookmark?: boolean;
    conversation_id?: string;
    拍摄?: string;
  };
}

interface MicroblogFeed {
  version: string;
  title?: string;
  home_page_url?: string;
  feed_url?: string;
  description?: string;
  author?: MicroblogAuthor;
  items?: MicroblogItem[];
}

// ─── Constants ─────────────────────────────────────────────────────────

const CURATED_USERS = [
  'manton', // Manton Reece — Micro.blog founder
  'jsonfeed', // JSON Feed updates
  'indieweb', // IndieWeb news
  'davewiner', // Dave Winer — blogging pioneer
  'gruber', // John Gruber — Daring Fireball
  'macgenie', // Mac-related
];

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine learning)\b/.test(lower)) niches.push('ai');
  if (/\b(microblog|indieweb|webmention|micropub|websub)\b/.test(lower)) niches.push('indieweb');
  if (/\b(blog|writing|publishing|journalism|writer|author)\b/.test(lower)) niches.push('writing');
  if (/\b(tech|technology|programming|code|software|startup|saas)\b/.test(lower))
    niches.push('tech');
  if (/\b(privacy|security|encryption|censorship|surveillance)\b/.test(lower))
    niches.push('privacy');
  if (/\b(podcast|podcasting|audio|show|episode)\b/.test(lower)) niches.push('podcasting');
  if (/\b(photo|photography|camera|picture|image)\b/.test(lower)) niches.push('photography');
  if (/\b(news|breaking|update|announcement|release)\b/.test(lower)) niches.push('news');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('blog');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
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

function microblogItemToPost(item: MicroblogItem, _source: string): UnifiedPost {
  const text = item.content_text || stripHtml(item.content_html || '') || item.summary || '';
  const authorName = item.author?.name || 'Micro.blog User';

  return {
    id: `microblog:${item.id}`,
    protocol: 'microblog',
    author: {
      id: `microblog:${authorName.toLowerCase().replace(/\s+/g, '-')}`,
      primary: { protocol: 'microblog', id: authorName },
      handles: { microblog: authorName },
      displayName: authorName,
      bio: '',
      avatarUrl: item.author?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: text.slice(0, 2000),
    embeds: item.external_url ? [{ kind: 'link' as const, url: item.external_url }] : [],
    contentType: text.length > 300 ? 'article' : 'text',
    createdAt: item.date_published ? new Date(item.date_published).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: item,
    niches: guessNiches(text, item.tags || []),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchDiscoverFeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${MICROBLOG_API}/posts/discover`, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const feed = (await res.json()) as MicroblogFeed;
    const items = feed.items || [];
    return items.slice(0, limit).map((i) => microblogItemToPost(i, 'discover'));
  } catch (err) {
    console.log(`[bridge] Micro.blog discover error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchUserFeed(username: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${MICROBLOG_API}/feeds/${username}.json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const feed = (await res.json()) as MicroblogFeed;
    const items = feed.items || [];
    return items.slice(0, limit).map((i) => microblogItemToPost(i, `user:${username}`));
  } catch {
    return [];
  }
}

async function fetchPhotosFeed(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${MICROBLOG_API}/feeds/photos.json`, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const feed = (await res.json()) as MicroblogFeed;
    const items = feed.items || [];
    return items.slice(0, limit).map((i) => microblogItemToPost(i, 'photos'));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'microblog',
  name: 'Micro.blog',
  description: 'Microblogging platform built on open IndieWeb standards',
  endpoint: '/api/feed/microblog',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchMicroblogPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / 4));

  const [discover, photos, ...userFeeds] = await Promise.all([
    fetchDiscoverFeed(perSource * 2),
    fetchPhotosFeed(Math.ceil(perSource / 2)),
    ...CURATED_USERS.slice(0, 4).map((u) => fetchUserFeed(u, perSource)),
  ]);

  const all = [discover, photos, ...userFeeds].flat();

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Micro.blog: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchMicroblogPosts;
