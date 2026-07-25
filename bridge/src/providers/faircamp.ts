/**
 * Faircamp (Music/Static Site) Provider
 *
 * Faircamp is a self-hosted, static site generator for musicians that
 * produces a rich, accessible web presence from directories of audio
 * files and metadata. Many Faircamp instances include RSS/Atom feeds
 * and ActivityPub integration.
 *
 * Strategy:
 * 1. Discover public Faircamp instances via curated list
 * 2. Fetch RSS/Atom feeds and ActivityPub outboxes
 * 3. Extract album/track metadata as feed posts
 *
 * Faircamp instances typically serve:
 *   - /feed.xml or /atom.xml — RSS/Atom feed of releases
 *   - /api/ — optional ActivityPub API
 *   - Well-known URIs for webfinger
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Known Public Faircamp Instances ─────────────────────────────
// These are self-hosted musician sites running Faircamp.
// Updated 2026-07-25 via community curation.
const FAIRCAMP_INSTANCES = [
  'https://listen.merveilles.town',
  'https://social.treehouse.systems/~ash',
  'https://tilde.town/~dozens',
  'https://somafm.com',
  'https://datadrivendj.com',
];

// ─── Types ─────────────────────────────────────────────────────────────

interface FeedEntry {
  title?: string;
  link?: { href?: string; $t?: string } | string;
  published?: string;
  updated?: string;
  summary?: string | { $t?: string; _?: string };
  content?: string | { $t?: string; _?: string };
  'media:content'?: { url?: string; medium?: string; type?: string };
  'media:thumbnail'?: { url?: string };
  author?: { name?: string; uri?: string };
  'itunes:image'?: { href?: string };
  enclosure?: { url?: string; type?: string; length?: number };
  id?: string;
}

interface FeedResponse {
  title?: string;
  description?: string;
  link?: string;
  items?: FeedEntry[];
  entry?: FeedEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(title: string, summary: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${title} ${summary} ${tags.join(' ')}`.toLowerCase();

  if (/\b(music|song|track|album|ep|single|release|listen|audio)\b/.test(lower))
    niches.push('music');
  if (/\b(faircamp|static site|webring|indieweb|small web)\b/.test(lower)) niches.push('indieweb');
  if (
    /\b(folk|ambient|electronic|rock|jazz|classical|experimental|lo-fi|drone|noise)\b/.test(lower)
  )
    niches.push('music');
  if (/\b(tutorial|guide|how.to|workshop|zine)\b/.test(lower)) niches.push('tutorial');
  if (/\b(creative|art|design|visual|photography|illustration)\b/.test(lower)) niches.push('art');
  if (/\b(oss|open.source|free.software|foss|self.hosted|decentralized)\b/.test(lower))
    niches.push('oss');
  if (/\b(privacy|security|encryption|cryptography)\b/.test(lower)) niches.push('security');

  if (niches.length === 0) niches.push('music');
  return niches;
}

function extractUrl(link: string | { href?: string; $t?: string } | undefined): string {
  if (!link) return '';
  if (typeof link === 'string') return link;
  return link.href ?? link.$t ?? '';
}

function extractText(field: string | { $t?: string; _?: string } | undefined): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.$t ?? field._ ?? '';
}

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

function faircampEntryToPost(
  entry: FeedEntry,
  instance: string,
  feedTitle: string,
): UnifiedPost | null {
  const title = entry.title || 'Untitled';
  const summary = stripHtml(extractText(entry.summary) || extractText(entry.content) || '');
  const url = extractUrl(entry.link);
  const authorName = entry.author?.name || feedTitle || 'Faircamp Artist';
  const authorUri = entry.author?.uri || instance;
  const enclosureUrl = entry.enclosure?.url || '';
  const imageUrl =
    entry['media:content']?.url ||
    entry['media:thumbnail']?.url ||
    entry['itunes:image']?.href ||
    '';

  const text = title ? `${title}\n\n${summary}`.trim() : summary;
  if (!text) return null;

  const embeds: Array<{ kind: 'image' | 'video' | 'link' | 'audio'; url: string }> = [];
  if (imageUrl) embeds.push({ kind: 'image', url: imageUrl });
  if (url) embeds.push({ kind: 'link', url });
  if (enclosureUrl) {
    embeds.push({ kind: 'audio' as any, url: enclosureUrl });
  }

  return {
    id: `faircamp:${instance.replace(/https?:\/\//, '')}:${title.slice(0, 40).replace(/\s+/g, '-')}`,
    protocol: 'faircamp',
    author: {
      id: `faircamp:${authorUri}`,
      primary: { protocol: 'faircamp', id: authorName },
      handles: { faircamp: authorName },
      displayName: authorName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: text.slice(0, 2000),
    embeds: embeds as any,
    contentType: summary.length > 300 ? 'article' : 'text',
    createdAt: entry.published ? new Date(entry.published).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: entry,
    niches: guessNiches(title, summary),
    community: { name: new URL(instance).hostname, title: feedTitle || 'Faircamp Music' },
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function parseFeed(xml: string): Promise<FeedResponse> {
  const items: FeedEntry[] = [];

  // Extract feed title
  const titleMatch = xml.match(/<title[^>]*>([^<]*)<\/title>/);
  const feedTitle = titleMatch ? titleMatch[1]?.trim() || 'Faircamp Music' : 'Faircamp Music';

  // Parse RSS items or Atom entries
  // Try RSS 2.0 items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const itemXml = itemMatch[1];
    if (!itemXml) continue;

    const getTag = (tag: string): string | undefined => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
      return m ? m[1]?.trim() : undefined;
    };

    const getMediaTag = (tag: string): { url?: string; medium?: string; type?: string } => {
      const m = itemXml.match(new RegExp(`<${tag}\\s+([^>]*)>`));
      if (!m) return {};
      const attrs = m[1] || '';
      const url = attrs.match(/url="([^"]*)"/)?.[1];
      const medium = attrs.match(/medium="([^"]*)"/)?.[1];
      const type = attrs.match(/type="([^"]*)"/)?.[1];
      return { url, medium, type };
    };

    const enclosureMatch = itemXml.match(/<enclosure\s+([^>]*)>/);
    const enclosureAttrs = enclosureMatch?.[1] || '';
    const enclosure = {
      url: enclosureAttrs.match(/url="([^"]*)"/)?.[1],
      type: enclosureAttrs.match(/type="([^"]*)"/)?.[1],
      length: enclosureAttrs.match(/length="([^"]*)"/)?.[1],
    };

    items.push({
      title: getTag('title'),
      link: getTag('link'),
      published: getTag('pubDate'),
      summary: getTag('description'),
      'media:content': getMediaTag('media:content'),
      'media:thumbnail': getMediaTag('media:thumbnail'),
      enclosure: enclosure.url
        ? (enclosure as { url: string; type?: string; length?: string | number })
        : undefined,
    });
  }

  // Try Atom entries if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((entryMatch = entryRegex.exec(xml)) !== null) {
      const entryXml = entryMatch[1];
      if (!entryXml) continue;

      const getTag = (tag: string): string | undefined => {
        const m = entryXml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
        return m ? m[1]?.trim() : undefined;
      };
      const getLink = (rel?: string): string | undefined => {
        const relAttr = rel ? `rel="${rel}"` : '';
        const m = entryXml.match(new RegExp(`<link[^>]*${relAttr}[^>]*href="([^"]*)"[^>]*>`));
        return m?.[1];
      };

      items.push({
        title: getTag('title'),
        link: getLink() || getLink('alternate'),
        published: getTag('published') || getTag('updated'),
        summary: getTag('summary') || getTag('content'),
      });
    }
  }

  return { title: feedTitle, items };
}

async function fetchInstanceFeed(instance: string): Promise<UnifiedPost[]> {
  // Faircamp instances typically serve their feed at /feed.xml or /atom.xml
  const feedUrls = [
    `${instance}/feed.xml`,
    `${instance}/atom.xml`,
    `${instance}/rss.xml`,
    `${instance}/index.xml`,
    `${instance}/feed.atom`,
    `${instance}/feed`,
  ];

  for (const feedUrl of feedUrls) {
    try {
      const res = await $fetch(feedUrl, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Faircamp)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      if (!xml || xml.length < 50) continue;

      const feed = await parseFeed(xml);
      const items = feed.items || [];
      const name = feed.title || new URL(instance).hostname;

      return items
        .map((entry: FeedEntry) => faircampEntryToPost(entry, instance, name))
        .filter((p: UnifiedPost | null): p is UnifiedPost => p !== null)
        .slice(0, 10);
    } catch {}
  }

  return [];
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'faircamp',
  name: 'Faircamp Music',
  description: 'Self-hosted static music sites from independent musicians',
  endpoint: '/api/feed/faircamp',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchFaircampPosts(limit = 20): Promise<UnifiedPost[]> {
  const perInstance = Math.max(3, Math.ceil(limit / FAIRCAMP_INSTANCES.length));

  const results = await Promise.allSettled(
    FAIRCAMP_INSTANCES.map((instance) => fetchInstanceFeed(instance)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(
    `[bridge] Faircamp: ${deduped.length} posts from ${FAIRCAMP_INSTANCES.length} instances`,
  );
  return deduped;
}

/** @alias */
export const fetch = fetchFaircampPosts;
