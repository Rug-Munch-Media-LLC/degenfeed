/**
 * Lens Protocol Provider — Self-hosted Lens Indexer + external API fallback
 *
 * Rate Limit: 50 requests/minute (GraphQL API via local indexer)
 *
 * Reads Lens publications from our local Lens indexer (port 8099) first,
 * then falls back to the external Lens GraphQL API (api.lens.xyz /
 * api-v2.lens.dev, overridable via LENS_API_URL) when the indexer is
 * unreachable or returns nothing — so the feed stays populated with real
 * Lens content even with NO local indexer container running (headless).
 *
 * The local indexer runs at /path/to/degenfeed/lens-indexer/ and polls
 * api.lens.xyz every 30s, storing results in SQLite.
 *
 * Endpoint: http://127.0.0.1:8099/api/publications
 * (port overridable via LENS_INDEXER_URL; deploy docs confirm 8099 —
 * the indexer is proxied as lens.degenfeed.xyz)
 */

import { FALLBACK_LENS_URLS } from '@degenfeed/lens-sdk';
import { filterFreshPosts } from '../lib/freshness';
import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Configuration ────────────────────────────────────────────────────

const LENS_INDEXER_URL = process.env.LENS_INDEXER_URL || 'http://127.0.0.1:8099';

/** External Lens GraphQL API — used when the local indexer is unavailable. */
const LENS_API_URL =
  process.env.LENS_API_URL || FALLBACK_LENS_URLS[0] || 'https://api.lens.xyz/graphql';

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

async function fetchPosts(limit: number): Promise<UnifiedPost[]> {
  // Pull a wider batch (capped) so we have room to rank a trending mix.
  const fetchLimit = Math.min(Math.max(limit * 3, limit + 10), 100);
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

    const selected = selectTrendingMix(data.data, limit);

    const posts: UnifiedPost[] = [];
    for (const pub of selected) {
      const post = mapPublication(pub);
      if (post) posts.push(post);
    }

    //     console.log(
    //       `[bridge] Lens Indexer: ${posts.length} posts (trending mix of ${data.meta.total} local)`,
    //     );
    // Freshness: discard posts outside the FEED_MAX_AGE_HOURS window (48h).
    return filterFreshPosts(posts).slice(0, limit);
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
 * External Lens API publication shape (2026 api.lens.xyz / api-v2.lens.dev).
 * Matches the proven selection used by @degenfeed/feed-providers LensProvider.
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
  const res = await $fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed-Bridge/0.1' },
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
    contentType: pub.metadata?.video?.item ? 'video' : pub.metadata?.image?.item ? 'image' : 'text',
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
 * Strategy: the ML explore feed (50 fresh/viral publications) — no local
 * container required. Curated-account fetching is intentionally omitted
 * here (the local indexer handles that when present); explore alone keeps
 * the feed real and populated headlessly.
 */
async function fetchExternalLensPosts(limit: number): Promise<UnifiedPost[]> {
  const EXPLORE_QUERY =
    'query{mlPostsExplore(request:{pageSize:FIFTY}){items{__typename ... on Post{id timestamp metadata{... on TextOnlyMetadata{content} ... on ImageMetadata{content image{item}} ... on VideoMetadata{content video{item}} ... on LinkMetadata{content} ... on ArticleMetadata{content}} author{address username{localName} metadata{name bio picture}} stats{reactions comments reposts quotes collects}}}}}';

  try {
    const explore = (await lensGql(LENS_API_URL, EXPLORE_QUERY)) as {
      mlPostsExplore?: { items?: ExternalLensPost[] };
    };
    const items = explore?.mlPostsExplore?.items ?? [];
    const posts: UnifiedPost[] = [];
    for (const pub of items) {
      const post = mapExternalLensPost(pub);
      if (post) posts.push(post);
    }
    if (posts.length > 0) {
      return filterFreshPosts(posts).slice(0, limit);
    }
  } catch (err) {
    console.warn(
      '[bridge] Lens external explore failed:',
      err instanceof Error ? err.message : err,
    );
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
