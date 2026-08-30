/**
 * Lemmy Provider
 *
 * Rate Limit: 60 requests/minute per instance
 *
 * Fetches posts from the self-hosted Lemmy instance (port 8536) and from
 * public Lemmy instances via their v3 API. Lemmy is a federated Reddit
 * alternative running ActivityPub.
 *
 * The local instance at port 8536 has DegenFeed communities for crypto,
 * DeFi, NFTs, tech, and web3.
 */

import { filterFreshPosts } from '../lib/freshness';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const LEMMY_LOCAL = 'http://127.0.0.1:8536';

/** Fast-fail timeout for local-container attempts (dead-local guard). */
const LOCAL_TIMEOUT_MS = 1500;
/** Default timeout for external instances — plenty for public Lemmy APIs. */
const EXTERNAL_TIMEOUT_MS = 5000;

let localUp: boolean | null = null;
let localUpCheckedAt = 0;
const LOCAL_PROBE_TTL_MS = 30_000;

/**
 * Quick reachability probe for the dead-local-container problem: when the
 * self-hosted Lemmy container (127.0.0.1:8536) is down, skip it outright
 * instead of burning 6 community + 6 RSS attempts on 5s timeouts before
 * falling back to external instances. Cached for 30s so a healthy container
 * isn't re-probed on every aggregation.
 */
async function isLocalLemmyUp(): Promise<boolean> {
  if (localUp !== null && Date.now() - localUpCheckedAt < LOCAL_PROBE_TTL_MS) {
    return localUp;
  }
  try {
    const res = await globalThis.fetch(`${LEMMY_LOCAL}/api/v3/site`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(LOCAL_TIMEOUT_MS),
    });
    localUp = res.ok;
  } catch {
    localUp = false;
  }
  localUpCheckedAt = Date.now();
  return localUp;
}

/** Local DegenFeed communities */
const LOCAL_COMMUNITIES = ['crypto', 'defi', 'nfts', 'tech', 'meme', 'web3'];

/** External Lemmy instances for content diversity */
const EXTERNAL_INSTANCES = [
  { url: 'https://lemmy.world', communities: ['cryptocurrency', 'technology', 'web3'] },
  { url: 'https://lemmy.ml', communities: ['bitcoin', 'ethereum', 'technology'] },
  { url: 'https://sh.itjust.works', communities: ['cryptocurrency'] },
  { url: 'https://programming.dev', communities: ['programming', 'rust'] },
  { url: 'https://lemm.ee', communities: ['technology'] },
];

// ─── Types ───────────────────────────────────────────────────────────

interface LemmyPostData {
  id: number;
  name: string;
  body?: string;
  published: string;
  ap_id: string;
  url?: string;
  embed_title?: string;
  embed_description?: string;
  thumbnail_url?: string;
  nsfw: boolean;
  deleted: boolean;
  removed: boolean;
}

interface LemmyPerson {
  id: number;
  name: string;
  display_name?: string;
  avatar?: string;
  actor_id: string;
}

interface LemmyCommunity {
  id: number;
  name: string;
  title: string;
  actor_id: string;
}

interface LemmyCounts {
  upvotes: number;
  downvotes: number;
  score: number;
  comments: number;
}

interface LemmyPostView {
  post: LemmyPostData;
  creator?: { person: LemmyPerson };
  community?: { community: LemmyCommunity };
  counts: LemmyCounts;
}

interface LemmyResponse {
  posts: LemmyPostView[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function guessNiches(text: string, community: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  const commLower = community.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower) || commLower === 'bitcoin')
    niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower) || commLower === 'ethereum')
    niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower) || commLower === 'solana') niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending)\b/.test(lower) || commLower === 'defi')
    niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower) || commLower === 'nfts') niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower) || commLower === 'meme') niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (
    /\b(rust|typescript|python|programming|code|dev)\b/.test(lower) ||
    commLower === 'programming' ||
    commLower === 'tech'
  )
    niches.push('tech');
  if (/\b(web3|blockchain|wallet)\b/.test(lower) || commLower === 'web3') niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ─────────────────────────────────────────────────────────

export function postToUnified(
  pv: LemmyPostView,
  hostname: string,
  communityName: string,
): UnifiedPost | null {
  if (!pv?.post) return null;
  const post = pv.post;
  const person = pv.creator?.person;
  const counts = pv.counts ?? { upvotes: 0, downvotes: 0, score: 0, comments: 0 };

  const text = post.body ? `${post.name}\n\n${post.body}` : post.name;
  const link = post.url || '';
  const createdAt = new Date(post.published).getTime();
  const authorName = person?.display_name || person?.name || `user@${communityName}`;
  const authorId = person ? String(person.id) : communityName;

  return {
    id: `lemmy:${post.id}@${hostname}`,
    protocol: 'lemmy',
    author: {
      id: `lemmy:${authorId}@${hostname}`,
      primary: { protocol: 'lemmy', id: authorId },
      handles: { lemmy: `${person?.name ?? 'unknown'}@${hostname}` },
      displayName: authorName,
      bio: '',
      avatarUrl: person?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'community', url: `https://${hostname}/c/${communityName}` }],
      keys: {},
    },
    text,
    embeds: link ? [{ kind: 'link', url: link }] : [],
    contentType: link ? 'link' : 'text',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: counts.upvotes,
      reposts: 0,
      replies: counts.comments,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: counts.upvotes, reposts: 0, replies: counts.comments, quotes: 0 },
    },
    raw: pv,
    niches: guessNiches(text, communityName),
  };
}

// ─── Search across instances ──────────────────────────────────────────

export async function searchLemmy(
  q: string,
  searchType: string = 'Posts',
  instance: string = '127.0.0.1:8536',
  limit: number = 20,
  page: number = 1,
): Promise<{
  data: UnifiedPost[];
  communities: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
}> {
  const baseUrl = instance.startsWith('http') ? instance : `http://${instance}`;
  const hostname = new URL(baseUrl).hostname;
  const result: {
    data: UnifiedPost[];
    communities: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  } = {
    data: [],
    communities: [],
    meta: { q, type: searchType, instance: hostname, page, limit },
  };

  try {
    const url = `${baseUrl}/api/v3/search?q=${encodeURIComponent(q)}&type_=${searchType}&sort=Hot&limit=${Math.min(limit, 50)}&page=${page}`;
    const res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return result;

    const data = (await res.json()) as {
      posts?: LemmyPostView[];
      communities?: Array<{ community: LemmyCommunity }>;
      users?: Array<Record<string, unknown>>;
    };

    if (data.posts) {
      result.data = data.posts
        .map((pv) => postToUnified(pv, hostname, q))
        .filter((p): p is UnifiedPost => p !== null);
    }

    if (data.communities) {
      result.communities = data.communities.map((c) => ({
        name: c.community?.name || '',
        title: c.community?.title || '',
        actor_id: c.community?.actor_id || '',
      }));
    }

    result.meta = { ...result.meta, total: result.data.length + result.communities.length };
  } catch {
    // Return empty result
  }

  return result;
}

// ─── Fetch from instance ────────────────────────────────────────────

export async function fetchCommunityPosts(
  baseUrl: string,
  community: string,
  limit: number,
  timeoutMs: number = EXTERNAL_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  try {
    const hostname = new URL(baseUrl).hostname;
    const url = `${baseUrl}/api/v3/post/list?community_name=${encodeURIComponent(community)}&sort=Hot&limit=${Math.min(limit, 20)}`;
    const res = await globalThis.fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as LemmyResponse;
    if (!data.posts) return [];

    return data.posts
      .map((pv) => postToUnified(pv, hostname, community))
      .filter((p): p is UnifiedPost => p !== null);
  } catch {
    return [];
  }
}

// ─── RSS Feed Fallback ────────────────────────────────────────────────

/**
 * Fetch posts from a Lemmy instance's RSS feed.
 * Lemmy exposes RSS at /feeds/{community}.xml or /feeds/{community}.atom
 */
async function fetchRssFromInstance(
  baseUrl: string,
  community: string,
  limit: number,
  timeoutMs: number = EXTERNAL_TIMEOUT_MS,
): Promise<UnifiedPost[]> {
  try {
    const hostname = new URL(baseUrl).hostname;
    // Try RSS first, then Atom
    const feedUrls = [`${baseUrl}/feeds/${community}.xml`, `${baseUrl}/feeds/${community}.atom`];

    let xmlText: string | null = null;
    let usedUrl = '';
    for (const url of feedUrls) {
      try {
        const res = await globalThis.fetch(url, {
          headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (res.ok) {
          xmlText = await res.text();
          usedUrl = url;
          break;
        }
      } catch {}
    }

    if (!xmlText) return [];

    // Parse RSS items using simple regex (predictable Lemmy RSS format)
    const posts: UnifiedPost[] = [];
    const isAtom = usedUrl.endsWith('.atom');

    if (isAtom) {
      // Atom format
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
      while ((match = entryRegex.exec(xmlText)) !== null && posts.length < limit) {
        const entry = match[1]!;
        const title = extractXmlValue(entry, 'title');
        const link = extractXmlAttr(entry, 'link', 'href') || extractXmlValue(entry, 'id');
        const published = extractXmlValue(entry, 'published') || extractXmlValue(entry, 'updated');
        const summary = extractXmlValue(entry, 'summary') || extractXmlValue(entry, 'content');
        const authorName = extractXmlValue(entry, 'name') || 'unknown';

        if (title) {
          const createdAt = published ? new Date(published).getTime() : Date.now();
          posts.push({
            id: `lemmy-rss:${Buffer.from(title).toString('base64').slice(0, 20)}@${hostname}`,
            protocol: 'lemmy',
            author: {
              id: `lemmy:rss@${hostname}`,
              primary: { protocol: 'lemmy', id: `rss@${hostname}` },
              handles: { lemmy: `${authorName}@${hostname}` },
              displayName: authorName,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              links: [{ label: 'community', url: `https://${hostname}/c/${community}` }],
              keys: {},
            },
            text: summary ? `${title}\n\n${summary}` : title,
            embeds: link ? [{ kind: 'link', url: link }] : [],
            contentType: link ? 'link' : 'text',
            createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            },
            raw: { source: 'rss', url: usedUrl },
            niches: guessNiches(title + (summary || ''), community),
          });
        }
      }
    } else {
      // RSS 2.0 format
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match: RegExpExecArray | null;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop pattern
      while ((match = itemRegex.exec(xmlText)) !== null && posts.length < limit) {
        const item = match[1]!;
        const title = extractXmlValue(item, 'title');
        const link = extractXmlValue(item, 'link');
        const pubDate = extractXmlValue(item, 'pubDate');
        const description = extractXmlValue(item, 'description');
        const author =
          extractXmlValue(item, 'author') || extractXmlValue(item, 'dc:creator') || 'unknown';

        if (title) {
          const createdAt = pubDate ? new Date(pubDate).getTime() : Date.now();
          posts.push({
            id: `lemmy-rss:${Buffer.from(title).toString('base64').slice(0, 20)}@${hostname}`,
            protocol: 'lemmy',
            author: {
              id: `lemmy:rss@${hostname}`,
              primary: { protocol: 'lemmy', id: `rss@${hostname}` },
              handles: { lemmy: `${author}@${hostname}` },
              displayName: author,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              links: [{ label: 'community', url: `https://${hostname}/c/${community}` }],
              keys: {},
            },
            text: description
              ? `${title}\n\n${description.replace(/<[^>]*>/g, '').slice(0, 500)}`
              : title,
            embeds: link ? [{ kind: 'link', url: link }] : [],
            contentType: link ? 'link' : 'text',
            createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            },
            raw: { source: 'rss', url: usedUrl },
            niches: guessNiches(title + (description || ''), community),
          });
        }
      }
    }

    return posts;
  } catch {
    return [];
  }
}

/** Extract XML tag inner text */
function extractXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  if (!match) return '';
  // Strip CDATA
  return match[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/** Extract XML attribute value */
function extractXmlAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["']`, 'i');
  const match = regex.exec(xml);
  return match ? match[1]!.trim() : '';
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'lemmy',
  name: 'Lemmy',
  description: 'Link aggregator and community discussions — local + external instances',
  endpoint: '/api/feed/lemmy',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchLemmyPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 60 requests/minute per instance
  if (!checkRateLimit('lemmy', { maxRequests: 60, windowMs: 60_000 })) {
    // console.log('[lemmy] Rate limited, skipping fetch');
    return [];
  }
  const all: UnifiedPost[] = [];

  // Dead-local guard: skip the local container entirely when it is down so
  // the feed falls through to external instances without 5s timeouts.
  const localUp = await isLocalLemmyUp();

  // Fetch from local Lemmy communities via API
  const localPromises = localUp
    ? LOCAL_COMMUNITIES.map((comm) =>
        fetchCommunityPosts(LEMMY_LOCAL, comm, Math.ceil(limit / LOCAL_COMMUNITIES.length), LOCAL_TIMEOUT_MS),
      )
    : [];

  const localResults = await Promise.allSettled(localPromises);
  for (const r of localResults) {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    }
  }

  // Also fetch from local RSS feeds (complementary to API)
  if (all.length < limit && localUp) {
    const rssPromises = LOCAL_COMMUNITIES.map((comm) =>
      fetchRssFromInstance(LEMMY_LOCAL, comm, Math.ceil(limit / LOCAL_COMMUNITIES.length), LOCAL_TIMEOUT_MS),
    );
    const rssResults = await Promise.allSettled(rssPromises);
    for (const r of rssResults) {
      if (r.status === 'fulfilled') {
        all.push(...r.value);
      }
    }
  }

  // If local gave us little, try external instances via API
  if (all.length < 5) {
    const externalTasks: Array<{ url: string; community: string }> = [];
    for (const inst of EXTERNAL_INSTANCES.slice(0, 3)) {
      for (const comm of inst.communities) {
        externalTasks.push({ url: inst.url, community: comm });
      }
    }
    const externalPromises = externalTasks.map((t) => fetchCommunityPosts(t.url, t.community, 3));
    const externalResults = await Promise.allSettled(externalPromises);
    for (const r of externalResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }

    // Also try external RSS feeds
    if (all.length < 5) {
      const externalRssPromises = externalTasks.map((t) =>
        fetchRssFromInstance(t.url, t.community, 3),
      );
      const externalRssResults = await Promise.allSettled(externalRssPromises);
      for (const r of externalRssResults) {
        if (r.status === 'fulfilled') all.push(...r.value);
      }
    }
  }

  // Freshness: discard posts outside the FEED_MAX_AGE_HOURS window (48h)
  // BEFORE dedup so the cap fills with fresh content only.
  const fresh = filterFreshPosts(all);

  // Deduplicate by content hash
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of fresh) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  //   console.log(
  //     `[bridge] Lemmy: ${deduped.length} posts (API: ${localCount}, RSS fallback: ${all.length - localCount})`,
  //   );
  return deduped;
}

/** @alias Standardized export - renamed to avoid shadowing global fetch */
export const fetchPosts = fetchLemmyPosts;
/** @deprecated Use `fetchPosts` instead */
export const fetch = fetchLemmyPosts;
