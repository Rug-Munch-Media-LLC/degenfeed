/**
 * WriteFreely / Write.as Provider
 *
 * Fetches blog posts from WriteFreely — a federated, open-source blogging
 * platform that's part of the ActivityPub Fediverse. Also supports Write.as,
 * the hosted WriteFreely service.
 *
 * API: REST at https://write.as/api/
 *   GET /api/collections/{alias}/posts — get posts from a collection
 *   GET /api/posts/{id} — get single post
 *   GET /api/me/posts — get authenticated user's posts
 *   GET /api/collections — list collections
 *
 * RSS fallback: /api/collections/{alias}/feed.xml
 *
 * Strategy:
 * 1. REST API from curated blogs
 * 2. Public timeline from known WriteFreely instances
 * 3. RSS feed fallback
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface BlogSource {
  alias: string;
  instance: string;
  displayName: string;
}

const CURATED_BLOGS: BlogSource[] = [
  {
    alias: 'degenfeed',
    instance: process.env.WRITEFREELY_BASE_URL || 'http://127.0.0.1:8086',
    displayName: 'DegenFeed Blog',
  },
  { alias: 'degen', instance: 'https://write.as', displayName: 'Degen Write.as' },
  { alias: 'freedog', instance: 'https://write.as', displayName: 'FreeDog' },
  { alias: 'press', instance: 'https://write.as', displayName: 'Write.as Press' },
  // Additional federated WriteFreely blog (verified reachable 2026-08-04)
  // with unique, non-cross-posted articles — helps the feed exceed the
  // 10-post floor once cross-post duplicates are deduped.
  { alias: 'tedomum', instance: 'https://write.tedomum.net', displayName: 'Tedomum Blog' },
  // WriteFreely project blog — real instance-level RSS at /feed/ (verified
  // 200, 2026-08-06). Serves project news + release posts.
  {
    alias: 'writefreely',
    instance: 'https://blog.writefreely.org',
    displayName: 'WriteFreely Project',
  },
  // paper.wf — federated WriteFreely instance (verified reachable 2026-08-06).
  { alias: 'blog', instance: 'https://paper.wf', displayName: 'Paper.wf Blog' },
  // quil.pm — requested WriteFreely instance; NXDOMAIN as of 2026-08-06, kept
  // for when the domain returns (provider degrades gracefully on fetch error).
  { alias: 'quil', instance: 'https://quil.pm', displayName: 'Quil.pm' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface WriteFreelyPost {
  id?: string;
  slug?: string;
  title?: string;
  body?: string;
  content?: string;
  created?: string;
  updated?: string;
  url?: string;
  author?: { username?: string; display_name?: string };
  collection?: { alias?: string; display_name?: string; title?: string; description?: string };
  tags?: string[];
}

interface WriteFreelyCollectionResponse {
  data?: WriteFreelyPost[] | { posts?: WriteFreelyPost[]; [key: string]: unknown };
  items?: WriteFreelyPost[];
  total?: number;
}

/**
 * Extract posts from a WriteFreely collection API response.
 *
 * The API has two response shapes depending on the instance:
 *  - write.as style:   { "data": [ ...posts ] }
 *  - self-hosted:      { "code": 200, "data": { "posts": [ ...posts ], ...collection meta } }
 */
function extractCollectionPosts(data: unknown): WriteFreelyPost[] {
  if (Array.isArray(data)) return data as WriteFreelyPost[];
  if (data && typeof data === 'object' && Array.isArray((data as { posts?: unknown }).posts)) {
    return (data as { posts: WriteFreelyPost[] }).posts;
  }
  return [];
}

// ─── Helpers ──────────────────────────────────────────────────────────

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

function guessNiches(text: string, title: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${title} ${tags.join(' ')}`.toLowerCase();

  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|swap|dex|staking)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible|mint|token)\b/.test(lower)) niches.push('nft');
  if (/\b(ai |artificial|intelligence|llm|agent|machine.learning)\b/.test(lower)) niches.push('ai');
  if (/\b(activitypub|fediverse|mastodon|pleroma|writefreely|federation)\b/.test(lower))
    niches.push('fediverse');
  if (/\b(privacy|surveillance|encryption|security|censorship)\b/.test(lower))
    niches.push('privacy');
  if (/\b(writing|blog|publishing|writer|poetry|essay|journalism)\b/.test(lower))
    niches.push('writing');
  if (/\b(tech|technology|programming|code|software|startup|developer)\b/.test(lower))
    niches.push('tech');
  if (/\b(news|analysis|opinion|essay|editorial)\b/.test(lower)) niches.push('news');
  if (/\b(crypto|blockchain|web3)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('article');
  return niches;
}

function parseRssItems(xml: string): Array<{
  title?: string;
  link?: string;
  guid?: string;
  description?: string;
  author?: string;
  pubDate?: string;
  creator?: string;
}> {
  const items: Array<Record<string, string>> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m = itemRe.exec(xml);
  while (m !== null) {
    if (!m[1]) {
      m = itemRe.exec(xml);
      continue;
    }
    const e = m[1];
    items.push({
      title: (e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '',
      link: (e.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '',
      guid: (e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '',
      description: (e.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '',
      author: (e.match(/<author[^>]*>([\s\S]*?)<\/author>/i) || [])[1] || '',
      pubDate: (e.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '',
      creator: (e.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] || '',
    });
    m = itemRe.exec(xml);
  }
  return items;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function wfPostToPost(
  item: WriteFreelyPost | Record<string, unknown>,
  blog: BlogSource,
): UnifiedPost {
  const title = String((item as WriteFreelyPost).title || '');
  const body = String(
    (item as WriteFreelyPost).body || (item as Record<string, unknown>).content || '',
  );
  const slug = String((item as WriteFreelyPost).slug || (item as Record<string, unknown>).id || '');
  const tags = (item as WriteFreelyPost).tags || [];
  const text = title
    ? `${title}\n\n${stripHtml(body).slice(0, 1000)}`
    : stripHtml(body).slice(0, 1000);

  return {
    id: `writefreely:${slug}@${blog.alias}`,
    protocol: 'writefreely',
    author: {
      id: `writefreely:${blog.alias}`,
      primary: { protocol: 'writefreely', id: blog.alias },
      handles: { writefreely: blog.alias, writeas: blog.alias },
      displayName: blog.displayName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [{ kind: 'link' as const, url: `${blog.instance}/${blog.alias}/${slug}` }],
    contentType: text.length > 500 ? 'article' : 'text',
    createdAt: (item as WriteFreelyPost).created
      ? new Date(String((item as WriteFreelyPost).created)).getTime()
      : Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: item,
    niches: guessNiches(text, title, tags),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchBlogPosts(blog: BlogSource, limit: number): Promise<UnifiedPost[]> {
  // WriteFreely serves 10 posts/page via the collection API. Loop through
  // pages until we have `limit` posts, hit the end of the collection, or
  // reach a safety cap (10 pages = 100 posts) so a misbehaving instance
  // can't hang the provider. Dedupe by post id across pages.
  const all: UnifiedPost[] = [];
  const seen = new Set<string>();
  const MAX_PAGES = 10;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (all.length >= limit) break;
      const res = await $fetch(
        `${blog.instance}/api/collections/${blog.alias}/posts?page=${page}`,
        {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (WriteFreely)' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) break;
      const data = (await res.json()) as WriteFreelyCollectionResponse;
      const items = extractCollectionPosts(data?.data ?? data?.items ?? data);
      if (!Array.isArray(items) || items.length === 0) break;
      for (const item of items) {
        const post = wfPostToPost(item, blog);
        if (!seen.has(post.id)) {
          seen.add(post.id);
          all.push(post);
        }
        if (all.length >= limit) break;
      }
      // A short page means we've reached the end of the collection.
      if (items.length < 10) break;
    }
    return all;
  } catch {
    // console.log(`[bridge] WriteFreely REST error (${blog.alias}): ${(err as Error).message}`);
    return all;
  }
}

async function fetchRssFallback(blog: BlogSource, limit: number): Promise<UnifiedPost[]> {
  // Try several RSS locations in order:
  //  1. Instance-level feed  (/feed/) — used by blog.writefreely.org
  //  2. Instance-level feed  (/feed.xml)
  //  3. Collection-level feed (/api/collections/{alias}/feed.xml)
  const candidates = [
    `${blog.instance}/feed/`,
    `${blog.instance}/feed.xml`,
    `${blog.instance}/api/collections/${blog.alias}/feed.xml`,
  ];
  let xml = '';
  for (const url of candidates) {
    try {
      const res = await $fetch(url, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (WriteFreely)' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const body = await res.text();
      // Only accept actual RSS XML (some instances return an HTML 404 page
      // with a 200 status — e.g. "Post not found."). Guard on <rss or <feed.
      if (/<rss[\s>]|<feed[\s>]/i.test(body)) {
        xml = body;
        break;
      }
    } catch {}
  }
  if (!xml) return [];
  const items = parseRssItems(xml);
  return items.slice(0, limit).map((item) => {
    const title = item.title || '';
    const text = stripHtml(item.description || title);
    return {
      id: `writefreely:rss:${item.guid || item.link || text.slice(0, 40)}`,
      protocol: 'writefreely',
      author: {
        id: `writefreely:rss:${blog.alias}`,
        primary: { protocol: 'writefreely', id: blog.alias },
        handles: { writefreely: blog.alias },
        displayName: item.author || item.creator || blog.displayName,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text,
      contentType: 'article',
      embeds: item.link ? [{ kind: 'link' as const, url: item.link }] : [],
      createdAt: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: item,
      niches: guessNiches(text, title),
    };
  });
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'writefreely',
  name: 'WriteFreely / Write.as',
  description: 'Federated, open-source blogging on the Fediverse',
  endpoint: '/api/feed/writefreely',
  requiresAuth: false,
  contentType: 'article',
};

export async function fetchWriteFreelyPosts(limit = 20): Promise<UnifiedPost[]> {
  // Federated content first: fetch remote instances (write.as, tedomum,
  // writefreely.org, paper.wf, quil.pm) before the local collection so the
  // feed surfaces content from across the fediverse, not just our own blog.
  // The local DegenFeed collection (69+ posts) is the reliable safety net
  // that tops up any shortfall and guarantees a non-empty feed.
  const localBlog = CURATED_BLOGS[0]!;
  const remoteBlogs = CURATED_BLOGS.slice(1);
  // Give remote blogs a real share: half the requested posts, split across
  // all remote sources (min 3 each so small instances still contribute).
  const remoteShare = Math.max(3, Math.ceil(limit / 2 / Math.max(1, remoteBlogs.length)));
  const localShare = limit;

  const results = await Promise.allSettled([
    ...remoteBlogs.map(async (blog) => {
      const posts = await fetchBlogPosts(blog, remoteShare);
      if (posts.length > 0) return posts;
      return fetchRssFallback(blog, remoteShare);
    }),
    fetchBlogPosts(localBlog, localShare),
  ]);

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Deduplicate — remote posts come first so they win the dedup slots;
  // the local collection fills whatever capacity remains.
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] WriteFreely: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchWriteFreelyPosts;
