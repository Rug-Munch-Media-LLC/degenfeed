/**
 * Lens Protocol Provider — Self-hosted Lens Indexer + external API fallback
 *
 * Rate Limit: 50 requests/minute (GraphQL API via local indexer)
 *
 * Reads Lens publications from our local Lens indexer (port 8099) first,
 * then falls back to the external Lens GraphQL API (api.lens.xyz/graphql,
 * overridable via LENS_API_URL) when the indexer is unreachable or returns
 * nothing — so the feed stays populated with real Lens content even with NO
 * local indexer container running (headless).
 *
 * NOTE (2026-08): the legacy api-v2.lens.dev host 301-redirects to
 * api.lens.xyz and the redirect rewrites POST → GET, dropping the GraphQL
 * body — it is dead for this use. The live endpoint is api.lens.xyz/graphql
 * (Lens v3 schema) and requires no auth token for public feed reads; if
 * LENS_API_TOKEN is set it is sent as the x-access-token header.
 *
 * The local indexer runs at /path/to/degenfeed/lens-indexer/ and polls
 * api.lens.xyz every 30s, storing results in SQLite.
 *
 * Endpoint: http://127.0.0.1:8099/api/publications
 * (port overridable via LENS_INDEXER_URL; deploy docs confirm 8099 —
 * the indexer is proxied as lens.degenfeed.xyz)
 */

import { FALLBACK_LENS_URLS } from '@degenfeed/lens-sdk';
import { normalizeDedupText } from '../lib/dedup';
import { filterFreshPosts } from '../lib/freshness';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Configuration ────────────────────────────────────────────────────

const LENS_INDEXER_URL = process.env.LENS_INDEXER_URL || 'http://127.0.0.1:8099';

/** External Lens GraphQL API — used when the local indexer is unavailable. */
const LENS_API_URL =
  process.env.LENS_API_URL || FALLBACK_LENS_URLS[0] || 'https://api.lens.xyz/graphql';

/**
 * Optional Lens access token (x-access-token header). Not required for
 * public feed reads on api.lens.xyz — only set this if a token is available.
 */
const LENS_API_TOKEN = process.env.LENS_API_TOKEN || '';

// ─── Interface ────────────────────────────────────────────────────────

interface IndexerPublication {
  id: string;
  slug: string;
  author_address: string;
  author_username: string | null;
  author_name: string | null;
  author_bio: string | null;
  author_avatar: string | null;
  timestamp: string;
  content: string;
  metadata_type: string | null;
  image_url: string | null;
  video_url: string | null;
  sharing_link: string | null;
  stats_reactions: number;
  stats_comments: number;
  stats_reposts: number;
  stats_quotes: number;
  raw_json: string | null;
}

interface IndexerResponse {
  data: IndexerPublication[];
  meta: {
    total: number;
    returned: number;
    offset: number;
    limit: number;
    source: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|trump)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (/\b(lens|hey|orb)\b/.test(lower)) niches.push('lens');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

function mapPublication(pub: IndexerPublication): UnifiedPost | null {
  const content = pub.content || '';
  if (!content.trim()) return null;

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  if (pub.image_url) {
    embeds.push({ kind: 'image', url: pub.image_url });
  }
  if (pub.video_url) {
    embeds.push({ kind: 'video', url: pub.video_url });
  }
  if (pub.sharing_link) {
    embeds.push({ kind: 'link', url: pub.sharing_link });
  }

  // Extract URLs from content
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlMatches = content.match(urlRegex);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!embeds.some((e) => e.url === url)) {
        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);
        embeds.push({ kind: isImage ? 'image' : 'link', url });
      }
    }
  }

  const displayName = pub.author_name || pub.author_username || pub.author_address.slice(0, 10);

  return {
    id: `lens:${pub.id}`,
    protocol: 'lens',
    author: {
      id: `lens:${pub.author_address}`,
      primary: { protocol: 'lens', id: pub.author_address },
      handles: { lens: pub.author_username || pub.author_address },
      displayName,
      bio: pub.author_bio || '',
      avatarUrl: pub.author_avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      url: pub.author_username
        ? `https://hey.xyz/u/${pub.author_username}`
        : `https://hey.xyz/u/${pub.author_address}`,
      keys: { address: pub.author_address },
    },
    text: content,
    embeds,
    contentType:
      pub.metadata_type === 'ImageMetadata'
        ? 'image'
        : pub.metadata_type === 'VideoMetadata'
          ? 'video'
          : pub.metadata_type === 'LinkMetadata'
            ? 'link'
            : 'text',
    createdAt: new Date(pub.timestamp).getTime(),
    metrics: {
      likes: Number(pub.stats_reactions) || 0,
      reposts: Number(pub.stats_reposts) || 0,
      replies: Number(pub.stats_comments) || 0,
      quotes: Number(pub.stats_quotes) || 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: Number(pub.stats_reactions) || 0,
        reposts: Number(pub.stats_reposts) || 0,
        replies: Number(pub.stats_comments) || 0,
        quotes: Number(pub.stats_quotes) || 0,
      },
    },
    raw: pub,
    niches: guessNiches(content),
  };
}

// ─── Fetch from Local Indexer ─────────────────────────────────────────

/** Engagement score used to rank "trending" publications. */
function engagementScore(pub: IndexerPublication): number {
  return (
    Number(pub.stats_reactions) * 2 + Number(pub.stats_reposts) * 3 + Number(pub.stats_comments) * 1
  );
}

/**
 * Select a trending + recent mix from a batch of publications.
 *
 * The local indexer stores thousands of publications but does not expose
 * a trending sort. We rank the most recent batch by engagement (reactions,
 * reposts, comments) and by aggregate per-author engagement — authors whose
 * posts collectively score highest are the "trending profiles" in the
 * current window. The result is ~40% high-engagement ("trending") posts
 * followed by the freshest remaining posts, deduped by id.
 */
function selectTrendingMix(pubs: IndexerPublication[], limit: number): IndexerPublication[] {
  if (pubs.length === 0) return [];

  // Aggregate engagement per author → trending profile ranking.
  const authorScore = new Map<string, number>();
  for (const p of pubs) {
    authorScore.set(
      p.author_address,
      (authorScore.get(p.author_address) || 0) + engagementScore(p),
    );
  }
  const authorRank = new Map<string, number>();
  [...authorScore.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([addr], i) => {
      authorRank.set(addr, i);
    });

  const scored = pubs.map((p) => ({
    p,
    score: engagementScore(p),
    rank: authorRank.get(p.author_address) ?? 999,
    ts: new Date(p.timestamp).getTime(),
  }));

  // Trending: highest engagement, with a boost for authors who rank high.
  const trending = [...scored].sort((a, b) => a.rank - b.rank || b.score - a.score || b.ts - a.ts);
  // Recent: newest first.
  const recent = [...scored].sort((a, b) => b.ts - a.ts);

  const out: IndexerPublication[] = [];
  const seen = new Set<string>();
  const trendingShare = Math.min(Math.max(1, Math.ceil(limit * 0.4)), limit);
  for (const item of trending) {
    if (out.length >= trendingShare) break;
    if (!seen.has(item.p.id)) {
      seen.add(item.p.id);
      out.push(item.p);
    }
  }
  for (const item of recent) {
    if (out.length >= limit) break;
    if (!seen.has(item.p.id)) {
      seen.add(item.p.id);
      out.push(item.p);
    }
  }
  return out.slice(0, limit);
}

// ─── Spam / quality filtering ──────────────────────────────────────────

/** URL hosts that indicate link-in-bio, redirect, shortener or "gallery"
 *  spam destinations. Matched against the registered host and subdomains. */
const SPAM_URL_HOSTS: readonly string[] = [
  'go.cbrop.com',
  'onlyfuns.win',
  'ca75.top',
  'taplink.cc',
  'linktr.ee',
  'bio.link',
  'beacons.ai',
  'allmylinks.com',
  'msha.ke',
  'lit.link',
  'many.link',
  'lynkfire.com',
  'linkin.bio',
  'lnk.bio',
  'bit.ly',
  'tinyurl.com',
  't.co',
  'rb.gy',
  'is.gd',
  'cutt.ly',
  'rebrand.ly',
  'shorturl.at',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'qrco.de',
  '0x0.st',
];

/** Text markers for "gallery" redirect posts (aggregation / spam pages). */
const GALLERY_SPAM_RE = /\b(full\s+gallery|view\s+(the\s+)?(full\s+)?gallery|gallery\s+link)\b/i;

/** Matches URLs in post text; stops at markdown link closers. */
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"\])]+/g;

/** Strip URLs from text, leaving the real (non-link) content. */
function stripUrls(text: string): string {
  return (text || '').replace(URL_IN_TEXT_RE, ' ').replace(/\s+/g, ' ').trim();
}

function extractUrls(text: string): string[] {
  return (text || '').match(URL_IN_TEXT_RE) ?? [];
}

/** True when a URL points at a known spam/redirect/link-in-bio host. */
function isSpamUrlHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SPAM_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Spam / low-quality heuristic. A post is spam when it is:
 *   (a) a LINK post whose destination is a shortener, link-in-bio, redirect
 *       or "gallery" spam page (e.g. taplink.cc, linktr.ee, bio.link,
 *       go.cbrop.com), or a post that carries a "full gallery" marker next
 *       to a URL;
 *   (b) a near-empty engagement-farming post (no real text, no media);
 *   (c) a zero-engagement pure-link post (aggregation / repost spam).
 */
function isSpamPost(post: UnifiedPost): boolean {
  const text = post.text || '';
  const urls = extractUrls(text).concat(post.embeds.map((e) => e.url));
  const hasMedia = post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');

  // (a) gallery / redirect / shortener / link-in-bio destinations.
  if (urls.some((u) => isSpamUrlHost(u))) return true;
  if (GALLERY_SPAM_RE.test(text) && urls.length > 0) return true;

  // (b) engagement farming: no real text and no media.
  if (!hasMedia && stripUrls(text).length < 24) return true;

  // (c) zero-engagement pure-link posts (aggregation / repost spam).
  const m = post.metrics;
  const engagement = (m.likes || 0) + (m.reposts || 0) + (m.replies || 0) + (m.quotes || 0);
  if (post.contentType === 'link' && engagement <= 0) return true;

  return false;
}

/** Media/content-type preference for the quality feed. */
const CONTENT_TYPE_PREFERENCE: Record<string, number> = {
  article: 4,
  video: 4,
  image: 3,
  text: 2,
  link: 1,
};

/** Rank a post for the quality feed: content type + real text + engagement. */
function qualityScore(post: UnifiedPost): number {
  const typeRank = CONTENT_TYPE_PREFERENCE[post.contentType || 'text'] ?? 1;
  const realTextLen = stripUrls(post.text || '').length;
  const m = post.metrics;
  const engagement = (m.likes || 0) * 2 + (m.reposts || 0) * 3 + (m.replies || 0) + (m.quotes || 0);
  return typeRank * 100 + Math.min(50, realTextLen) + Math.min(40, Math.log1p(engagement) * 10);
}

/**
 * Filter a wide batch of posts down to a quality ~limit feed: spam is
 * removed, near-duplicates (same author + same text) collapse, and no single
 * author contributes more than 3 posts so one spammer can't flood the feed.
 * Survivors are ranked by content type (video/article/image > text > link),
 * real-text length and engagement; ties go to the newest post.
 */
function selectQualityPosts(posts: UnifiedPost[], limit: number): UnifiedPost[] {
  const quality = posts.filter((p) => !isSpamPost(p));
  const ranked = quality
    .map((p) => ({ p, score: qualityScore(p) }))
    .sort((a, b) => b.score - a.score || b.p.createdAt - a.p.createdAt);

  const out: UnifiedPost[] = [];
  const seenKey = new Set<string>();
  const perAuthor = new Map<string, number>();
  for (const { p } of ranked) {
    if (out.length >= limit) break;
    const dupKey = `${p.author.id}::${normalizeDedupText(p.text)}`;
    if (seenKey.has(dupKey)) continue;
    const authorCount = perAuthor.get(p.author.id) || 0;
    if (authorCount >= 3) continue;
    seenKey.add(dupKey);
    perAuthor.set(p.author.id, authorCount + 1);
    out.push(p);
  }
  return out;
}

async function fetchPosts(limit: number): Promise<UnifiedPost[]> {
  // Pull a wide batch (capped) so spam filtering + ranking has room.
  const fetchLimit = Math.min(Math.max(limit * 4, limit + 20), 200);
  const url = `${LENS_INDEXER_URL}/api/publications?limit=${fetchLimit}`;

  try {
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      // Dead-local fast-fail: the default LENS_INDEXER_URL is the
      // container-local loopback (127.0.0.1:8099) which may be down — fail
      // in 1.5s so the external Lens GraphQL fallback serves quickly.
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) {
      console.warn(`[bridge] Lens Indexer: HTTP ${res.status} ${res.statusText}`);
      return fetchExternalLensPosts(limit);
    }

    const data = (await res.json()) as IndexerResponse;

    if (!data.data || data.data.length === 0) {
      console.warn('[bridge] Lens Indexer: No publications returned');
      return fetchExternalLensPosts(limit);
    }

    // Select a broader trending+recent pool, map, then quality-filter down.
    const selected = selectTrendingMix(data.data, Math.min(Math.max(limit * 3, limit + 10), 150));

    const posts: UnifiedPost[] = [];
    for (const pub of selected) {
      const post = mapPublication(pub);
      if (post) posts.push(post);
    }

    //     console.log(
    //       `[bridge] Lens Indexer: ${posts.length} posts (trending mix of ${data.meta.total} local)`,
    //     );
    // Freshness: discard posts outside the FEED_MAX_AGE_HOURS window (48h),
    // then drop spam and rank the rest down to the requested limit.
    return selectQualityPosts(filterFreshPosts(posts), limit);
  } catch (err) {
    console.warn(
      '[bridge] Lens Indexer: Error fetching posts:',
      err instanceof Error ? err.message : err,
    );
    // Headless fallback: external Lens GraphQL API when the local indexer
    // is down (no local container dependency).
    return fetchExternalLensPosts(limit);
  }
}

// ─── External Lens GraphQL API (headless fallback) ────────────────────

/**
 * External Lens API publication shape (2026 api.lens.xyz — Lens v3 schema).
 * Shape verified against the live endpoint: posts() → items → ... on Post
 * with id/timestamp/metadata/author/stats as mapped here.
 */
interface ExternalLensAccount {
  address?: string;
  username?: { localName?: string };
  metadata?: { name?: string | null; bio?: string | null; picture?: string | null };
}

interface ExternalLensPost {
  id: string;
  timestamp?: string;
  metadata?: {
    content?: string | null;
    image?: { item?: string | null } | null;
    video?: { item?: string | null } | null;
    /** LinkMetadata destination URL — used to detect redirect/gallery spam. */
    sharingLink?: string | null;
  };
  author?: ExternalLensAccount;
  stats?: { reactions?: number; comments?: number; reposts?: number; quotes?: number };
}

/** POST a GraphQL query to an external Lens API endpoint. */
async function lensGql(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'DegenFeed-Bridge/0.1',
  };
  if (LENS_API_TOKEN) headers['x-access-token'] = LENS_API_TOKEN;
  const res = await $fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Lens API HTTP ${res.status}`);
  const json = (await res.json()) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (json.errors?.length) throw new Error(`Lens API: ${json.errors[0]?.message ?? 'unknown'}`);
  return json.data;
}

function mapExternalLensPost(pub: ExternalLensPost): UnifiedPost | null {
  const content = pub.metadata?.content || '';
  if (!content.trim()) return null;
  const addr = pub.author?.address ?? 'unknown';
  const handle = pub.author?.username?.localName ?? null;
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  if (pub.metadata?.image?.item) embeds.push({ kind: 'image', url: pub.metadata.image.item });
  if (pub.metadata?.video?.item) embeds.push({ kind: 'video', url: pub.metadata.video.item });
  if (pub.metadata?.sharingLink) embeds.push({ kind: 'link', url: pub.metadata.sharingLink });
  return {
    id: `lens:${pub.id}`,
    protocol: 'lens',
    author: {
      id: `lens:${addr}`,
      primary: { protocol: 'lens', id: addr },
      handles: { lens: handle ?? addr },
      displayName: pub.author?.metadata?.name || handle || addr.slice(0, 10),
      bio: pub.author?.metadata?.bio || '',
      avatarUrl: pub.author?.metadata?.picture || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      url: handle ? `https://hey.xyz/u/${handle}` : `https://hey.xyz/u/${addr}`,
      keys: { address: addr },
    },
    text: content,
    embeds,
    contentType: pub.metadata?.video?.item
      ? 'video'
      : pub.metadata?.image?.item
        ? 'image'
        : pub.metadata?.sharingLink
          ? 'link'
          : 'text',
    createdAt: pub.timestamp ? new Date(pub.timestamp).getTime() : Date.now(),
    metrics: {
      likes: pub.stats?.reactions ?? 0,
      reposts: pub.stats?.reposts ?? 0,
      replies: pub.stats?.comments ?? 0,
      quotes: pub.stats?.quotes ?? 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: pub.stats?.reactions ?? 0,
        reposts: pub.stats?.reposts ?? 0,
        replies: pub.stats?.comments ?? 0,
        quotes: pub.stats?.quotes ?? 0,
      },
    },
    raw: pub,
    niches: guessNiches(content),
  };
}

/**
 * Fetch Lens publications directly from the external Lens GraphQL API.
 * Used only as the headless fallback when the local indexer is down/empty.
 *
 * Query verified against the live api.lens.xyz/graphql (Lens v3, 2026-08-31):
 * the legacy mlPostsExplore field still exists on the schema but returns an
 * EMPTY items array (the v2 ML-explore feed is no longer populated), which is
 * why the previous fallback returned 0 posts. Fresh top-level posts come from
 * the `posts` root field with a PostsRequest:
 *   - filter.postTypes: [ROOT]        → top-level posts (not comments/reposts)
 *   - filter.metadata.mainContentFocus: [TEXT_ONLY, IMAGE, VIDEO, LINK, ARTICLE]
 * `posts.items` is the AnyPost union (Post | Repost) → fragment on ... on Post.
 */
async function fetchExternalLensPosts(limit: number): Promise<UnifiedPost[]> {
  const POSTS_QUERY = `query($cursor: Cursor) {
    posts(request: {
      pageSize: FIFTY
      cursor: $cursor
      filter: {
        postTypes: [ROOT]
        metadata: { mainContentFocus: [TEXT_ONLY, IMAGE, VIDEO, LINK, ARTICLE] }
      }
    }) {
      pageInfo { next }
      items {
        ... on Post {
          id
          timestamp
          metadata {
            ... on TextOnlyMetadata { content }
            ... on ImageMetadata { content image { item } }
            ... on VideoMetadata { content video { item } }
            ... on LinkMetadata { content sharingLink }
            ... on ArticleMetadata { content }
          }
          author {
            address
            username { localName }
            metadata { name bio picture }
          }
          stats { reactions comments reposts quotes }
        }
      }
    }
  }`;

  try {
    // Fetch MORE than we need (up to 3 pages) so the spam filter has room to
    // still return a quality ~limit feed.
    const needed = Math.min(Math.max(limit * 3, limit + 20), 150);
    const raw: ExternalLensPost[] = [];
    const seenIds = new Set<string>();
    let cursor: string | null | undefined;

    for (let page = 0; page < 3 && raw.length < needed; page += 1) {
      const data = (await lensGql(LENS_API_URL, POSTS_QUERY, { cursor })) as {
        posts?: { items?: ExternalLensPost[]; pageInfo?: { next?: string | null } };
      };
      const items = data?.posts?.items ?? [];
      for (const pub of items) {
        if (!pub.id || seenIds.has(pub.id)) continue;
        seenIds.add(pub.id);
        raw.push(pub);
      }
      cursor = data?.posts?.pageInfo?.next ?? null;
      if (!cursor) break;
    }

    const posts: UnifiedPost[] = [];
    for (const pub of raw) {
      const post = mapExternalLensPost(pub);
      if (post) posts.push(post);
    }
    if (posts.length > 0) {
      return selectQualityPosts(filterFreshPosts(posts), limit);
    }
  } catch (err) {
    console.warn('[bridge] Lens external posts failed:', err instanceof Error ? err.message : err);
  }

  return [];
}

// ─── Main export ──────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'lens',
  name: 'Lens Protocol',
  description: 'User-owned social graph on Polygon — Lens v2 GraphQL API',
  endpoint: '/api/feed/lens',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchLensPosts(limit = 20): Promise<UnifiedPost[]> {
  // Rate limit: 50 requests/minute
  if (!checkRateLimit('lens', { maxRequests: 50, windowMs: 60_000 })) {
    // console.log('[lens] Rate limited, skipping fetch');
    return [];
  }
  const posts = await fetchPosts(limit);
  return posts;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchLensPosts;
