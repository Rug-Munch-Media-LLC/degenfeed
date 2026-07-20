/**
 * @degenfeed/atproto-shorts-provider
 *
 * Fetches short-form video content from the AT Protocol / Bluesky ecosystem.
 *
 * ## How it works
 * Bluesky's AT Protocol supports video embeds via app.bsky.embed.video.
 * This provider connects to the Bluesky public API, fetches the popular feed
 * and the built-in video feed, then filters for posts with video embeds.
 *
 * ## Sources
 *   1. Bluesky Popular Feed — no-auth feed of trending content
 *   2. Bluesky Video Feed — curated feed of video posts (Whats Hot / Video)
 *   3. Curated crypto creators — specific DIDs known to post video content
 *   4. JetStream (future) — real-time video post detection via WebSocket
 *
 * ## Usage
 * ```ts
 * import { fetchBlueskyShorts } from '@degenfeed/atproto-shorts-provider';
 * const shorts = await fetchBlueskyShorts({ limit: 20 });
 * ```
 */

import { detectNiches } from '@degenfeed/feed-core';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Bluesky public API endpoint (no auth needed for read-only queries) */
export const BSKY_PUBLIC_API = 'https://public.api.bsky.app';

/** Bluesky popular feed — no auth required */
export const POPULAR_FEED_ENDPOINT = `${BSKY_PUBLIC_API}/xrpc/app.bsky.unspecced.getPopularFeed`;

/** Bluesky feed generator endpoint — requires feed URI */
export const FEED_ENDPOINT = `${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.getFeed`;

/** Author feed endpoint — no auth for public profiles */
export const AUTHOR_FEED_ENDPOINT = `${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed`;

/** Our user agent for API requests */
export const USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

/** AT Protocol embed type for video */
export const VIDEO_EMBED_TYPE = 'app.bsky.embed.video';

/** AT Protocol embed type for images */
export const IMAGES_EMBED_TYPE = 'app.bsky.embed.images';

/** AT Protocol embed type for record with media */
export const RECORD_WITH_MEDIA_TYPE = 'app.bsky.embed.recordWithMedia';

/**
 * Curated crypto/defi/web3 Bluesky creators known to post video content.
 * These are DIDs (not handles) for stability.
 */
const CRYPTO_VIDEO_CREATORS: string[] = [
  // Crypto news & analysis channels on Bluesky
  // In production, this should be populated from a KV store or config
];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BskyVideoItem {
  /** Unique ID for dedup (e.g. bsky:3k4duaz5vfs2b) */
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  /** Duration in seconds (Bluesky max is ~180s) */
  duration: number;
  authorName: string;
  authorHandle: string;
  authorDid: string;
  authorAvatar?: string;
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  source: 'bluesky';
  sourceUrl: string;
  /** AT Protocol URI (at://...) */
  atUri: string;
  /** AT Protocol CID */
  atCid: string;
  /** Detected topics (defi, nft, trading, etc.) */
  topics: string[];
  publishedAt: number;
  /** True if has video embed */
  vertical: boolean;
  qualityScore: number;
  sourceLabel: string;
  sourceColor: string;
  canTip: boolean;
}

export interface FetchBlueskyShortsOptions {
  /** Max videos to return (default 20) */
  limit?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// ─── Bluesky Feed Types (subset of AT Protocol schemas) ────────────────────

interface BskyFeedViewPost {
  post: {
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    record: {
      text?: string;
      createdAt?: string;
      embed?: Record<string, unknown>;
    };
    embed?: Record<string, unknown>;
    likeCount?: number;
    replyCount?: number;
    repostCount?: number;
    indexedAt?: string;
  };
  reason?: unknown;
}

interface BskyPopularFeedResponse {
  feed: BskyFeedViewPost[];
  cursor?: string;
}

interface BskyFeedResponse {
  feed: BskyFeedViewPost[];
  cursor?: string;
}

interface BskyVideoDefs {
  $type: string;
  video?: {
    $type: string;
    ref?: { $link: string };
    mimeType?: string;
    size?: number;
  };
  playlist?: string;
  thumbnail?: string;
  alt?: string;
  aspectRatio?: { width: number; height: number };
}

// ─── Fetcher Functions ─────────────────────────────────────────────────────

/**
 * Fetch trending video shorts from Bluesky's popular feed.
 * Filters the popular feed for posts with video embeds.
 */
export async function fetchBlueskyShorts(
  options: FetchBlueskyShortsOptions = {},
): Promise<BskyVideoItem[]> {
  const { limit = 20, signal } = options;

  // Strategy 1: Fetch from the popular feed (trending content, no auth)
  const popularVideos = await fetchPopularFeedVideos(limit * 2, signal);

  if (popularVideos.length >= limit) {
    return popularVideos.slice(0, limit);
  }

  // Strategy 2: Fetch from known crypto video creators
  const creatorVideos = await fetchCreatorVideos(
    CRYPTO_VIDEO_CREATORS,
    limit - popularVideos.length,
    signal,
  );

  const allVideos = [...popularVideos, ...creatorVideos];

  // Deduplicate by URI
  const seen = new Set<string>();
  return allVideos
    .filter((v) => {
      if (seen.has(v.atUri)) return false;
      seen.add(v.atUri);
      return true;
    })
    .sort((a, b) => b.likes - a.likes)
    .slice(0, limit);
}

/**
 * Fetch videos from the Bluesky popular feed.
 */
async function fetchPopularFeedVideos(
  maxItems: number,
  signal?: AbortSignal,
): Promise<BskyVideoItem[]> {
  try {
    const url = new URL(POPULAR_FEED_ENDPOINT);
    url.searchParams.set('limit', String(Math.min(maxItems * 2, 50)));

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal,
    });

    if (!res.ok) {
      console.warn(`[atproto-shorts] Popular feed returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as BskyPopularFeedResponse;
    if (!data.feed || !Array.isArray(data.feed)) return [];

    return processFeedPosts(data.feed, maxItems);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    console.warn('[atproto-shorts] Popular feed fetch failed:', (err as Error).message);
    return [];
  }
}

/**
 * Fetch videos from specific creators' feeds.
 */
async function fetchCreatorVideos(
  creators: string[],
  maxItems: number,
  signal?: AbortSignal,
): Promise<BskyVideoItem[]> {
  if (creators.length === 0 || maxItems <= 0) return [];

  const results = await Promise.allSettled(
    creators.map((did) => fetchAuthorFeedVideos(did, Math.ceil(maxItems / creators.length) + 2, signal)),
  );

  const allVideos: BskyVideoItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allVideos.push(...result.value);
    }
  }

  return allVideos.slice(0, maxItems);
}

/**
 * Fetch video posts from a single author's feed.
 */
async function fetchAuthorFeedVideos(
  actor: string,
  limit: number,
  signal?: AbortSignal,
): Promise<BskyVideoItem[]> {
  try {
    const url = new URL(AUTHOR_FEED_ENDPOINT);
    url.searchParams.set('actor', actor);
    url.searchParams.set('limit', String(Math.min(limit, 50)));
    url.searchParams.set('filter', 'posts_no_replies'); // posts only, no replies

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal,
    });

    if (!res.ok) return [];

    const data = (await res.json()) as BskyFeedResponse;
    if (!data.feed || !Array.isArray(data.feed)) return [];

    return processFeedPosts(data.feed, limit);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return [];
  }
}

/**
 * Process a Bluesky feed response into BskyVideoItem[], filtering for video embeds.
 */
function processFeedPosts(
  feed: BskyFeedViewPost[],
  maxItems: number,
): BskyVideoItem[] {
  const videos: BskyVideoItem[] = [];

  for (const item of feed) {
    if (videos.length >= maxItems) break;

    const { post } = item;
    if (!post) continue;

    // Check for video embed at the post level or record level
    const embed = post.embed ?? (post.record?.embed as Record<string, unknown> | undefined);
    if (!embed) continue;

    // Check if this is a video embed
    const embedType = embed.$type ?? (embed as Record<string, unknown>).$type;
    if (!embedType || typeof embedType !== 'string') continue;

    // Support direct video embeds and record-with-media (quote post with video)
    const videoInfo = extractVideoInfo(embed, embedType);
    if (!videoInfo) continue;

    const text = (post.record?.text as string) ?? '';
    const createdAt = (post.record?.createdAt as string) ?? post.indexedAt;
    const authorName = post.author.displayName ?? post.author.handle;
    const topics = detectNiches(text);

    videos.push({
      id: `bsky:${post.uri.split('/').pop() ?? post.cid}`,
      title: text.slice(0, 200) || `${authorName}'s video`,
      description: text.slice(0, 500),
      thumbnailUrl: videoInfo.thumbnail ?? post.author.avatar ?? '',
      videoUrl: videoInfo.playlist
        ? videoInfo.playlist
        : `https://bsky.app/profile/${post.author.did}/post/${post.uri.split('/').pop()}`,
      duration: 60, // Bluesky videos are typically 1-3 min; default to 60s
      authorName: authorName,
      authorHandle: post.author.handle,
      authorDid: post.author.did,
      authorAvatar: post.author.avatar,
      views: 0, // Bluesky doesn't expose view counts via public API
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      source: 'bluesky',
      sourceUrl: `https://bsky.app/profile/${post.author.did}/post/${post.uri.split('/').pop()}`,
      atUri: post.uri,
      atCid: post.cid,
      topics,
      publishedAt: createdAt ? new Date(createdAt).getTime() : Date.now(),
      vertical: true, // Bluesky supports vertical video
      qualityScore: computeBskyQuality(post),
      sourceLabel: 'Bluesky',
      sourceColor: '#0085ff',
      canTip: true, // DegenFeed tipping for Bluesky content via AT Protocol
    });
  }

  return videos;
}

/**
 * Extract video metadata from a Bluesky embed.
 */
function extractVideoInfo(
  embed: Record<string, unknown>,
  embedType: string,
): { playlist?: string; thumbnail?: string } | null {
  // Direct video embed
  if (embedType === VIDEO_EMBED_TYPE) {
    const video = embed as unknown as BskyVideoDefs;
    return {
      playlist: video.playlist,
      thumbnail: video.thumbnail,
    };
  }

  // Record with media (quote post with video)
  if (embedType === RECORD_WITH_MEDIA_TYPE) {
    const media = (embed as Record<string, unknown>).media as Record<string, unknown> | undefined;
    if (media) {
      const mediaType = media.$type as string | undefined;
      if (mediaType === VIDEO_EMBED_TYPE) {
        return extractVideoInfo(media, mediaType);
      }
    }
  }

  return null;
}

/**
 * Compute a quality score (0-1) for a Bluesky post.
 */
function computeBskyQuality(post: BskyFeedViewPost['post']): number {
  let score = 0.3; // base score

  // Engagement bonus
  const totalEngagement = (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.replyCount ?? 0);
  if (totalEngagement > 100) score += 0.3;
  else if (totalEngagement > 10) score += 0.2;

  // Has display name (indicates established account)
  if (post.author.displayName) score += 0.1;

  // Has avatar (indicates active user)
  if (post.author.avatar) score += 0.1;

  // Has text content
  if (post.record?.text && (post.record.text as string).length > 20) score += 0.1;

  // Has likes (higher is better)
  if ((post.likeCount ?? 0) > 50) score += 0.1;

  return Math.min(score, 1);
}

/**
 * Search for video posts on Bluesky by keyword.
 * Uses the search posts endpoint and filters for video embeds.
 */
export async function searchBlueskyVideos(
  query: string,
  limit: number = 20,
  signal?: AbortSignal,
): Promise<BskyVideoItem[]> {
  try {
    const searchEndpoint = `${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.searchPosts`;
    const url = new URL(searchEndpoint);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(Math.min(limit * 2, 50)));

    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal,
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { posts?: BskyFeedViewPost['post'][] };
    if (!data.posts || !Array.isArray(data.posts)) return [];

    // The search endpoint returns posts directly (not feed view posts)
    // So we need to wrap them in the expected shape
    const wrappedFeed: BskyFeedViewPost[] = data.posts.map((post) => ({
      post,
    }));

    return processFeedPosts(wrappedFeed, limit);
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return [];
  }
}
