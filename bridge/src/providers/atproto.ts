/**
 * AT Protocol Bridge Provider
 *
 * Lightweight provider that connects to the AT Protocol via public endpoints
 * (e.g., Bluesky's public API). Fetches recent posts from trending feeds
 * and normalizes them into the UnifiedPost format.
 *
 * This is a secondary/alternative provider to the Bluesky PDS provider —
 * it uses the AT Protocol directly rather than the Bluesky API.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

// ─── Configuration ────────────────────────────────────────────────────

const ATPROTO_PUBLIC_URL = process.env.ATPROTO_PUBLIC_URL || 'https://public.api.bsky.app';

const FEED_GENERATOR =
  process.env.ATPROTO_FEED ||
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

const FETCH_TIMEOUT_MS = 10_000;

const $fetch = globalThis.fetch;

// ─── AT Protocol Response Types ───────────────────────────────────────

interface ATProtoFeedViewPost {
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
      text: string;
      createdAt: string;
      embed?: Record<string, unknown>;
    };
    embed?: Record<string, unknown>;
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
    quoteCount?: number;
    indexedAt: string;
  };
}

interface ATProtoFeedResponse {
  feed: ATProtoFeedViewPost[];
  cursor?: string;
}

// ─── AT Protocol API Helpers ──────────────────────────────────────────

/**
 * Fetch the feed from the AT Protocol public AppView.
 *
 * Uses app.bsky.feed.getFeed (hydrated posts) — the getFeedSkeleton
 * variant is NOT implemented on the public API (HTTP 501) and would
 * require a second hydration pass anyway.
 */
async function fetchAtprotoFeed(feed: string, limit: number): Promise<ATProtoFeedViewPost[]> {
  const url = `${ATPROTO_PUBLIC_URL}/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=${Math.min(limit, 30)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await $fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[bridge] ATProto: HTTP ${res.status} from feed`);
      return [];
    }

    const data = (await res.json()) as ATProtoFeedResponse;
    return data.feed ?? [];
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[bridge] ATProto: Request timed out');
    } else {
      console.warn(
        '[bridge] ATProto: Error fetching feed:',
        err instanceof Error ? err.message : String(err),
      );
    }
    return [];
  }
}

// ─── Normalization ────────────────────────────────────────────────────

function extractNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const niches: string[] = [];
  if (/\b(bitcoin|btc|crypto|blockchain)\b/.test(lower)) niches.push('crypto');
  if (/\b(defi|liquidity|yield|swap|dex)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|collectible|mint|opensea)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial intelligence|llm|machine learning|gpt)\b/.test(lower)) niches.push('ai');
  if (/\b(tech|startup|software|developer|code)\b/.test(lower)) niches.push('tech');
  if (/\b(security|privacy|surveillance|censorship)\b/.test(lower)) niches.push('security');
  return niches;
}

function atprotoToUnifiedPost(item: ATProtoFeedViewPost): UnifiedPost | null {
  try {
    const { post } = item;
    const record = post.record;

    if (!record?.text) return null;

    const text = record.text;
    const createdAt = new Date(record.createdAt || post.indexedAt).getTime();
    if (Number.isNaN(createdAt)) return null;

    const nativeId = post.uri.split('/').pop() || post.cid;

    const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

    // Extract embed images
    const embedRecord = post.embed as Record<string, unknown> | undefined;
    if (embedRecord?.$type === 'app.bsky.embed.images') {
      const images = embedRecord.images as
        | Array<{ fullsize?: string; thumb?: string; alt?: string }>
        | undefined;
      if (images) {
        for (const img of images) {
          if (img.fullsize) {
            embeds.push({
              kind: 'image',
              url: img.fullsize,
              meta: { alt: img.alt || '', thumb: img.thumb },
            });
          }
        }
      }
    }

    // Extract links from text
    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
    const textUrls = text.match(urlRegex) ?? [];
    for (const u of textUrls) {
      if (!embeds.some((e) => e.url === u)) {
        embeds.push({ kind: 'link', url: u });
      }
    }

    return {
      id: `atproto:${nativeId}`,
      protocol: 'atproto',
      author: {
        id: `atproto:${post.author.did}`,
        primary: { protocol: 'atproto', id: post.author.did },
        handles: { atproto: post.author.handle },
        displayName: post.author.displayName || post.author.handle,
        bio: '',
        avatarUrl: post.author.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [
          {
            label: 'profile',
            url: `https://bsky.app/profile/${post.author.did}`,
          },
        ],
        keys: { atprotoDid: post.author.did },
      },
      text,
      embeds,
      createdAt,
      metrics: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: post.quoteCount ?? 0,
      },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: {
          likes: post.likeCount ?? 0,
          reposts: post.repostCount ?? 0,
          replies: post.replyCount ?? 0,
          quotes: post.quoteCount ?? 0,
        },
      },
      raw: item,
      niches: extractNiches(text),
    };
  } catch (err) {
    console.warn(
      '[bridge] ATProto: Error normalizing post:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ─── Main Provider Functions ──────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'atproto',
  name: 'AT Protocol',
  description:
    'AT Protocol feeds via Bluesky public API — trending content from the open social web',
  endpoint: '/api/feed/atproto',
  requiresAuth: false,
  contentType: 'social',
};

/**
 * Fetch recent posts from the AT Protocol.
 * Falls back to the Bluesky "What's Hot" feed generator.
 */
export async function fetchAtprotoPosts(limit = 20): Promise<UnifiedPost[]> {
  const rawFeed = await fetchAtprotoFeed(FEED_GENERATOR, limit);

  const posts: UnifiedPost[] = [];
  const seen = new Set<string>();

  for (const item of rawFeed) {
    try {
      const post = atprotoToUnifiedPost(item);
      if (!post) continue;

      // Deduplicate by text prefix
      const key = post.text.slice(0, 80).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      posts.push(post);
      if (posts.length >= limit) break;
    } catch {
      // Skip malformed entries
    }
  }

  // console.log(`[bridge] ATProto: ${posts.length} posts`);
  return posts;
}

/** @alias Use `fetchPosts` as the standardized export name */
export const fetchPosts = fetchAtprotoPosts;
