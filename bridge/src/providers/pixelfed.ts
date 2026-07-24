/**
 * Pixelfed Provider
 *
 * Fetches posts from Pixelfed — the federated image sharing platform
 * (ActivityPub, Mastodon-compatible API).
 *
 * Strategies:
 * 1. User Atom/RSS feeds from public Pixelfed instances
 * 2. Public timeline via Mastodon-compatible API (requires auth on most instances)
 *
 * NOTE: Most Pixelfed instances require authentication for API access.
 * We use user Atom feeds as the primary source since they're publicly accessible.
 */

import type { SchemaGuard, UnifiedPost } from '../server';

const PIXELFED_LOCAL = 'http://127.0.0.1:9090';

/** Well-known Pixelfed users with active public feeds */
const CURATED_USERS = [
  { url: 'https://pixelfed.social/users/pixelfed.atom', label: 'pixelfed.social' },
  { url: 'https://pixelfed.social/users/admin.atom', label: 'pixelfed.admin' },
  { url: 'https://pixelfed.de/users/pixelfed.atom', label: 'pixelfed.de' },
  { url: 'https://gram.social/users/gram_social.atom', label: 'gram.social' },
];

/** Public instances to try Mastodon-compatible API */
const PUBLIC_INSTANCES = [
  { url: 'https://pixelfed.social', name: 'pixelfed.social' },
  { url: 'https://pixelfed.de', name: 'pixelfed.de' },
  { url: 'https://gram.social', name: 'gram.social' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface AtomEntry {
  title: string;
  link: string;
  published: string;
  updated: string;
  content: string;
  author: { name: string; uri?: string };
  mediaContent?: { url: string; medium?: string };
}

// ─── Helpers ───────────────────────────────────────────────────────────

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
  if (/\b(defi|liquidity|yield|farm)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|photography|photo)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm)\b/.test(lower)) niches.push('ai');
  if (/\b(photography|photo|picture|image|camera|landscape|portrait)\b/.test(lower))
    niches.push('photography');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(rust|typescript|python|code|dev|github)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('art');
  return niches;
}

// ─── Parse Atom XML ────────────────────────────────────────────────────

function parseAtomFeed(xml: string, label: string, limit: number): UnifiedPost[] {
  const posts: UnifiedPost[] = [];

  // Extract entries
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  let index = 0;

  while ((m = entryRe.exec(xml)) !== null && posts.length < limit) {
    const e = m[1];
    const titleMatch = e.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = e.match(/<link[^>]+href=["']([^"']+)["']/i);
    const publishedMatch =
      e.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
      e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const contentMatch =
      e.match(/<content[^>]*>([\s\S]*?)<\/content>/i) ||
      e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const authorMatch = e.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
    const mediaMatch = e.match(/media:content[^>]+url=["']([^"']+)/i);

    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : '';
    if (!title && !contentMatch) continue;

    const text = title || stripHtml(contentMatch?.[1] || '').slice(0, 500);
    const link = linkMatch ? linkMatch[1] : '';
    const createdAt = publishedMatch ? new Date(publishedMatch[1]).getTime() : Date.now();
    const authorName = authorMatch ? authorMatch[1] : label;

    const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
    if (link?.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
      embeds.push({ kind: 'image', url: link });
    }
    if (mediaMatch) {
      embeds.push({ kind: 'image', url: mediaMatch[1] });
    }

    posts.push({
      id: `pixelfed:${label}:${index}`,
      protocol: 'pixelfed' as const,
      author: {
        id: `pixelfed:${label}`,
        primary: { protocol: 'pixelfed' as const, id: label },
        handles: { pixelfed: label },
        displayName: authorName,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text,
      embeds,
      contentType: 'image',
      createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: guessNiches(text),
    });
    index++;
  }

  return posts;
}

// ─── Fetch Atom feed ───────────────────────────────────────────────────

async function fetchAtomFeed(url: string, label: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Pixelfed)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseAtomFeed(xml, label, limit);
  } catch {
    return [];
  }
}

// ─── Fetch from Mastodon-compatible API ───────────────────────────────

async function fetchFromInstance(baseUrl: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const hostname = new URL(baseUrl).hostname;
    const res = await fetch(
      `${baseUrl}/api/v1/timelines/public?local=true&limit=${Math.min(limit, 20)}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Pixelfed)' },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      account: {
        id: string;
        username: string;
        acct: string;
        display_name: string;
        note: string;
        avatar: string;
      };
      media_attachments: Array<{ type: string; url: string }>;
    }>;
    if (!Array.isArray(raw)) return [];
    return raw.map((s) => ({
      id: `pixelfed:${s.id}@${hostname}`,
      protocol: 'pixelfed' as const,
      author: {
        id: `pixelfed:${s.account.id}@${hostname}`,
        primary: { protocol: 'pixelfed' as const, id: s.account.id },
        handles: { pixelfed: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: stripHtml(s.account.note || ''),
        avatarUrl: s.account.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: stripHtml(s.content || ''),
      contentType: s.media_attachments?.some((m: any) => m.type === 'video') ? 'video' : 'image',
      embeds: (s.media_attachments || []).map((m) => ({
        kind: m.type === 'video' ? ('video' as const) : ('image' as const),
        url: m.url,
      })),
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: guessNiches(s.content || ''),
    }));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'pixelfed',
  name: 'Pixelfed',
  description: 'Decentralized image sharing on ActivityPub — Atom feeds + API',
  endpoint: '/api/feed/pixelfed',
  requiresAuth: false,
  contentType: 'image',
};

export async function fetchPixelfedPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Try user Atom feeds (most reliable)
  const perFeed = Math.max(2, Math.ceil(limit / CURATED_USERS.length));
  const feedPromises = CURATED_USERS.map((u) => fetchAtomFeed(u.url, u.label, perFeed));
  const feedResults = await Promise.allSettled(feedPromises);
  for (const r of feedResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Try local instance
  const localPosts = await fetchFromInstance(PIXELFED_LOCAL, Math.ceil(limit / 4));
  all.push(...localPosts);

  // Try public instances via Mastodon API
  if (all.length < 5) {
    const perInstance = Math.max(2, Math.ceil(limit / PUBLIC_INSTANCES.length));
    const instPromises = PUBLIC_INSTANCES.map((inst) => fetchFromInstance(inst.url, perInstance));
    const instResults = await Promise.allSettled(instPromises);
    for (const r of instResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = `${p.text.slice(0, 60)}${p.embeds.length > 0 ? p.embeds[0].url : ''}`;
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Pixelfed: ${deduped.length} posts (${all.length} raw)`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchPixelfedPosts;
