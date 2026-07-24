/**
 * Bluesky / PDS Provider
 *
 * Fetches posts from the local Bluesky PDS instance (port 3012) and
 * the public Bluesky API (public.api.bsky.app).
 *
 * Enhanced with:
 *  - Image-only feed (Instagram-style)
 *  - Video/external feed
 *  - Trending crypto search
 *  - Image URL extraction with alt text, dimensions, aspect ratios
 */

import type { SchemaGuard, UnifiedPost } from '../server';

const PDS_BASE = 'http://127.0.0.1:3012';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

// Crypto/tech actors to follow
const CURATED_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'defi.bsky.social',
  'pmarca.bsky.social',
  'cdixon.bsky.social',
  'tier10k.bsky.social',
  'autismcapital.bsky.social',
  'karbonbased.bsky.social',
  'crypto_birb.bsky.social',
];

// Search queries for crypto content
const SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana',
  'crypto',
  'defi',
  'ai',
  'web3',
];

// Trending crypto query (single high-volume search)
const TRENDING_QUERY = 'crypto OR bitcoin OR ethereum OR solana OR defi';

// ─── Types ───────────────────────────────────────────────────────────

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyImageView {
  thumb: string;
  fullsize: string;
  alt: string;
  aspectRatio?: { width: number; height: number };
}

interface BskyExternalView {
  uri: string;
  title?: string;
  description?: string;
  thumb?: string;
}

interface BskyEmbedView {
  $type?: string;
  images?: BskyImageView[];
  external?: BskyExternalView;
  record?: Record<string, unknown>;
  // video embed (Bluesky native video)
  playlist?: string;
  thumbnail?: string;
  duration?: number;
}

interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      $type?: string;
      external?: { uri: string; title?: string; description?: string };
      images?: Array<{
        image: { ref: { link: string } };
        alt: string;
        aspectRatio?: { width: number; height: number };
      }>;
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  /** The post's embed view (includes resolved URLs, not just CIDs) */
  embed?: BskyEmbedView;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

interface BskyFeedResponse {
  feed?: Array<{ post: BskyPostView }>;
  posts?: BskyPostView[];
  cursor?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

/**
 * Determine the content type based on embeds present.
 */
function detectContentType(post: BskyPostView): UnifiedPost['contentType'] {
  if (post.embed?.images && post.embed.images.length > 0) return 'image';
  if (post.record.embed?.images && post.record.embed.images.length > 0) return 'image';
  if (post.embed?.playlist || post.embed?.thumbnail) return 'video';
  if (post.embed?.external?.uri) {
    const url = post.embed.external.uri;
    if (/\.(mp4|webm|mov|avi)$/i.test(url) || /youtube|youtu\.be|vimeo|twitch/i.test(url)) {
      return 'video';
    }
    return 'link';
  }
  return 'text';
}

/**
 * Extract media URLs from a Bluesky post with alt text and dimensions.
 */
export function extractMediaFromPost(post: BskyPostView): Array<{
  url: string;
  thumb?: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}> {
  const media: Array<{
    url: string;
    thumb?: string;
    alt: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
  }> = [];

  // Check embed view (has resolved URLs)
  const embedView = post.embed;
  if (embedView?.images && embedView.images.length > 0) {
    for (const img of embedView.images) {
      const ar = img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : undefined;
      media.push({
        url: img.fullsize || img.thumb,
        thumb: img.thumb,
        alt: img.alt || '',
        width: img.aspectRatio?.width,
        height: img.aspectRatio?.height,
        aspectRatio: ar,
      });
    }
    return media;
  }

  // Fallback: check record embed and construct URLs from CIDs
  if (post.record.embed?.images && post.record.embed.images.length > 0) {
    for (const img of post.record.embed.images) {
      const cid = img.image?.ref?.link;
      if (!cid) continue;
      const did = post.author.did;
      const ar = img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : undefined;
      media.push({
        url: `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${cid}@jpeg`,
        thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`,
        alt: img.alt || '',
        width: img.aspectRatio?.width,
        height: img.aspectRatio?.height,
        aspectRatio: ar,
      });
    }
  }

  // Check for video thumbnail
  if (embedView?.thumbnail) {
    media.push({
      url: embedView.thumbnail,
      alt: 'Video thumbnail',
      aspectRatio: 16 / 9,
    });
  }

  // External embed might have a thumbnail too (link card)
  if (embedView?.external?.thumb && media.length === 0) {
    media.push({
      url: embedView.external.thumb,
      thumb: embedView.external.thumb,
      alt: embedView.external.title || 'Link preview',
      aspectRatio: 1.91, // standard link card ratio
    });
  }

  return media;
}

// ─── Mapping ─────────────────────────────────────────────────────────

export function postToUnified(post: BskyPostView): UnifiedPost {
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  // Extract image embeds
  const mediaItems = extractMediaFromPost(post);
  for (const media of mediaItems) {
    embeds.push({
      kind: 'image',
      url: media.url,
      meta: {
        thumb: media.thumb,
        alt: media.alt,
        width: media.width,
        height: media.height,
        aspectRatio: media.aspectRatio,
      },
    });
  }

  // Extract external link embeds (cards, video links)
  if (post.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.embed.external.uri,
      meta: {
        title: post.embed.external.title,
        description: post.embed.external.description,
        thumb: post.embed.external.thumb,
      },
    });
  }

  // Also check record embed for external (backup)
  if (!embeds.length && post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
  }

  const contentType = detectContentType(post);

  return {
    id: `bluesky:${post.uri}`,
    protocol: 'bluesky',
    author: {
      id: `bluesky:${post.author.did}`,
      primary: { protocol: 'bluesky', id: post.author.did },
      handles: { bluesky: post.author.handle },
      displayName: post.author.displayName || post.author.handle,
      bio: '',
      avatarUrl: post.author.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { did: post.author.did },
    },
    text: post.record.text,
    contentType,
    embeds,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(post.record.text),
  };
}

// ─── Fetch from local PDS ───────────────────────────────────────────

async function fetchFromPds(_limit: number): Promise<UnifiedPost[]> {
  try {
    const infoRes = await fetch(`${PDS_BASE}/xrpc/com.atproto.server.describeServer`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!infoRes.ok) return [];

    const info = (await infoRes.json()) as { did?: string };
    if (!info.did) return [];

    const syncRes = await fetch(
      `${PDS_BASE}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(info.did)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!syncRes.ok) return [];

    return [];
  } catch {
    return [];
  }
}

// ─── Fetch from public Bluesky API ──────────────────────────────────

async function fetchAuthorFeed(actor: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BskyFeedResponse;
    if (!data.feed) return [];

    return data.feed
      .map((f) => f.post)
      .filter(Boolean)
      .slice(0, limit)
      .map(postToUnified);
  } catch {
    return [];
  }
}

async function searchPosts(query: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}&sort=latest`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BskyFeedResponse;
    if (!data.posts) return [];

    return data.posts.slice(0, limit).map(postToUnified);
  } catch {
    return [];
  }
}

/**
 * Fetch from all curated actors and merge results.
 */
async function fetchAllCuratedPosts(limit: number): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];
  const actorsToFetch = CURATED_ACTORS.slice(0, 8);
  const perActor = Math.max(3, Math.ceil(limit / actorsToFetch.length));
  const promises = actorsToFetch.map((actor) => fetchAuthorFeed(actor, perActor));
  const results = await Promise.allSettled(promises);
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
  return deduped;
}

// ─── Specialized feed fetchers ──────────────────────────────────────

/**
 * Image-only feed: returns posts that contain at least one image embed.
 * Fetches from curated actors + expands with image-focused search.
 */
export async function fetchBlueskyImageFeed(limit = 30): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Fetch curated actors
  const curated = await fetchAllCuratedPosts(Math.ceil(limit * 2));
  all.push(...curated);

  // If we need more, search for image-related crypto content
  if (all.filter((p) => p.embeds.some((e) => e.kind === 'image')).length < limit) {
    const imageQueries = [
      'crypto crypto',
      'bitcoin chart',
      'nft art',
      'memecoin',
      'defi dashboard',
    ];
    const searchPromises = imageQueries
      .slice(0, 3)
      .map((q) => searchPosts(q, Math.ceil(limit / 2)));
    const results = await Promise.allSettled(searchPromises);
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // Filter for image-only
  const withImages = all.filter((p) => p.embeds.some((e) => e.kind === 'image'));

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of withImages) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Bluesky Image Feed: ${deduped.length} posts`);
  return deduped;
}

/**
 * Video/external feed: returns posts with video embeds or link cards.
 */
export async function fetchBlueskyVideoFeed(limit = 20): Promise<UnifiedPost[]> {
  const all = await fetchAllCuratedPosts(Math.ceil(limit * 2));

  // Filter for posts with external embeds (likely video/link cards)
  const withMedia = all.filter((p) =>
    p.embeds.some((e) => e.kind === 'link' || e.kind === 'video'),
  );

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of withMedia) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Bluesky Video Feed: ${deduped.length} posts`);
  return deduped;
}

/**
 * Trending feed: search for trending crypto content.
 */
export async function fetchBlueskyTrending(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Primary: search trending crypto query
  const trending = await searchPosts(TRENDING_QUERY, Math.ceil(limit * 1.5));
  all.push(...trending);

  // Supplement from curated actors (for variety when search result is thin)
  if (all.length < limit / 2) {
    const curated = await fetchAllCuratedPosts(Math.ceil(limit / 2));
    all.push(...curated);
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

  console.log(`[bridge] Bluesky Trending: ${deduped.length} posts`);
  return deduped;
}

// ─── Main ───────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'bluesky',
  name: 'Bluesky/PDS',
  description: 'AT Protocol social network — curated actors + search',
  endpoint: '/api/feed/bluesky',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchBlueskyPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Try local PDS
  const pdsPosts = await fetchFromPds(Math.ceil(limit / 4));
  all.push(...pdsPosts);

  // Fetch from curated actors
  const actorsToFetch = CURATED_ACTORS.slice(0, 6);
  const actorPromises = actorsToFetch.map((actor) =>
    fetchAuthorFeed(actor, Math.max(2, Math.ceil(limit / actorsToFetch.length))),
  );
  const actorResults = await Promise.allSettled(actorPromises);
  for (const r of actorResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // If we don't have enough, search
  if (all.length < limit / 2) {
    const searchPromises = SEARCH_QUERIES.slice(0, 4).map((q) =>
      searchPosts(q, Math.max(3, Math.ceil(limit / 4))),
    );
    const searchResults = await Promise.allSettled(searchPromises);
    for (const r of searchResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
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

  console.log(`[bridge] Bluesky: ${deduped.length} posts (PDS: ${pdsPosts.length})`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchBlueskyPosts;
