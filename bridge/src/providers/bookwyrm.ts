/**
 * BookWyrm Provider
 *
 * Fetches book reviews, reading lists, and statuses from BookWyrm instances.
 * BookWyrm is a federated, open-source book tracking platform (Goodreads
 * alternative) that uses ActivityPub for federation.
 *
 * Public API reality (verified 2026-08-06):
 *   - GET /api/statuses/  → 404 on bookwyrm.social
 *   - GET /user/{user}/outbox  → ActivityPub OrderedCollection (works, but
 *     many users have totalItems: 0)
 *   - GET /user/{user}/rss  → RSS 2.0 user status feed (WORKS, 10 items)
 *
 * Strategy:
 * 1. Curated active users' RSS feeds on bookwyrm.social (flagship instance)
 * 2. ActivityPub outbox fallback for users whose RSS is empty
 * 3. Instances are configurable so other BookWyrm hosts can be added.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface BookWyrmUser {
  instance: string;
  username: string;
  displayName: string;
}

/** Active readers on bookwyrm.social — verified to have RSS items 2026-08-06. */
const CURATED_USERS: BookWyrmUser[] = [
  { instance: 'https://bookwyrm.social', username: 'bookwyrm', displayName: 'BookWyrm' },
  { instance: 'https://bookwyrm.social', username: 'julian', displayName: 'Julian' },
  { instance: 'https://bookwyrm.social', username: 'emily', displayName: 'Emily' },
  { instance: 'https://bookwyrm.social', username: 'michael', displayName: 'Michael' },
  { instance: 'https://bookwyrm.social', username: 'casey', displayName: 'Casey' },
  { instance: 'https://bookwyrm.social', username: 'dani', displayName: 'Dani' },
  { instance: 'https://bookwyrm.social', username: 'reader', displayName: 'Reader' },
];

interface RSSItem {
  title: string;
  link: string;
  guid: string;
  description: string;
  pubDate: string;
}

function decodeHtml(text: string): string {
  return text
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

function parseRssItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null = itemRe.exec(xml);
  while (m !== null) {
    const block = m[1];
    if (block) {
      const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
      const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '';
      const guid = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? '';
      const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '';
      const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '';
      if (title || link) {
        items.push({ title, link, guid, description, pubDate });
      }
    }
    m = itemRe.exec(xml);
  }
  return items;
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

function guessBookNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const niches: string[] = [];

  if (/\b(bitcoin|crypto|blockchain|web3|defi|nft|ethereum|solana)\b/.test(lower))
    niches.push('crypto');
  if (/\b(ai|artificial|intelligence|machine.learning|llm|deep.learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(tech|technology|programming|software|code|startup)\b/.test(lower)) niches.push('tech');
  if (/\b(science|physics|biology|chemistry|space|genetics)\b/.test(lower)) niches.push('science');
  if (/\b(fiction|novel|fantasy|sci.fi|mystery|romance)\b/.test(lower)) niches.push('fiction');
  if (/\b(history|biography|memoir|essay|philosophy)\b/.test(lower)) niches.push('nonfiction');
  if (/\b(finance|economics|investing|money|trading)\b/.test(lower)) niches.push('finance');

  if (niches.length === 0) niches.push('books');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function rssItemToPost(item: RSSItem, user: BookWyrmUser): UnifiedPost {
  const text = item.title ? `${item.title}` : '';
  const description = decodeHtml(item.description);

  // Extract book title from the item if present (e.g. Review of "X" (5 stars))
  const reviewMatch = item.title.match(/Review of "([^"]+)"/);
  const readingMatch = item.title.match(/started reading (.+?) by /);

  return {
    id: `bookwyrm:${item.guid || item.link || `${user.username}:${item.title}`}`,
    protocol: 'bookwyrm',
    author: {
      id: `bookwyrm:${user.username}@${user.instance}`,
      primary: { protocol: 'bookwyrm', id: user.username },
      handles: { bookwyrm: user.username },
      displayName: user.displayName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: text ? `${text}\n${description}`.trim() : description,
    embeds: [
      ...(item.link ? [{ kind: 'link' as const, url: item.link }] : []),
      ...(reviewMatch?.[1] || readingMatch?.[1]
        ? [
            {
              kind: 'book' as const,
              url: item.link,
              meta: { title: reviewMatch?.[1] ?? readingMatch?.[1] ?? '' },
            },
          ]
        : []),
    ],
    contentType: text.startsWith('Review') ? 'review' : 'text',
    createdAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: item,
    niches: guessBookNiches(text + ' ' + description),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchUserRss(user: BookWyrmUser, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${user.instance}/user/${user.username}/rss`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.2 (BookWyrm RSS)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = parseRssItems(xml);
    return items.slice(0, limit).map((item) => rssItemToPost(item, user));
  } catch {
    return [];
  }
}

/**
 * ActivityPub outbox fallback — fetch recent Note/Review activities from a
 * user's outbox (only used when RSS returns nothing).
 */
async function fetchUserOutbox(user: BookWyrmUser, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${user.instance}/user/${user.username}/outbox?page=1`, {
      headers: {
        'User-Agent': 'DegenFeed-Bridge/0.2 (BookWyrm AP)',
        Accept: 'application/activity+json, application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      totalItems?: number;
      orderedItems?: Array<{
        type?: string;
        id?: string;
        content?: string;
        published?: string;
        attributedTo?: string;
        object?: { content?: string; type?: string; name?: string };
      }>;
    };
    if (!Array.isArray(data.orderedItems)) return [];

    const posts: UnifiedPost[] = [];
    for (const item of data.orderedItems) {
      if (!item || typeof item !== 'object') continue;
      const isNote = item.type === 'Note' || item.type === 'Create' || item.type === 'Review';
      if (!isNote) continue;
      const content = item.content || item.object?.content || '';
      const title = item.object?.name || '';
      if (!content && !title) continue;

      posts.push({
        id: `bookwyrm:ap:${item.id ?? `${user.username}:${Date.now()}`}`,
        protocol: 'bookwyrm',
        author: {
          id: `bookwyrm:${user.username}@${user.instance}`,
          primary: { protocol: 'bookwyrm', id: user.username },
          handles: { bookwyrm: user.username },
          displayName: user.displayName,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: title ? `${title}\n${stripHtml(content)}` : stripHtml(content),
        embeds: item.id ? [{ kind: 'link' as const, url: String(item.id) }] : [],
        contentType: item.type === 'Review' ? 'review' : 'text',
        createdAt: item.published ? new Date(item.published).getTime() : Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: item,
        niches: guessBookNiches(`${title} ${content}`),
      });
    }
    return posts.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'bookwyrm',
  name: 'BookWyrm',
  description: 'Federated book tracking and reviews (Goodreads alternative)',
  endpoint: '/api/feed/bookwyrm',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchBookWyrmPosts(limit = 20): Promise<UnifiedPost[]> {
  const perUser = Math.max(3, Math.ceil(limit / CURATED_USERS.length));

  const results = await Promise.allSettled(
    CURATED_USERS.map(async (user) => {
      const posts = await fetchUserRss(user, perUser);
      if (posts.length > 0) return posts;
      return fetchUserOutbox(user, perUser);
    }),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    deduped.push(p);
    if (deduped.length >= limit) break;
  }

  // console.log(`[bridge] BookWyrm: ${deduped.length} statuses from ${CURATED_USERS.length} users`);
  return deduped;
}

export const fetch = fetchBookWyrmPosts;
