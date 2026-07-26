/**
 * @degenfeed/api-worker — Trending Content Scraper
 *
 * Auto-discovers trending content from Reddit, YouTube, Farcaster,
 * Nostr, and Bluesky. Runs via cron every 30 min, caches in KV.
 *
 * Each scraper is self-contained with 5s timeout and graceful
 * degradation on failure.
 */

import type { YouTubeVideoItem } from '@degenfeed/youtube-provider';
import { fetchYouTubeFeed } from '@degenfeed/youtube-provider';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TrendingItem {
  id: string;
  title: string;
  url: string;
  platform: 'reddit' | 'youtube' | 'farcaster' | 'nostr' | 'bluesky';
  authorName: string;
  authorAvatar?: string;
  score: number;
  engagement: {
    likes: number;
    comments: number;
    shares?: number;
  };
  publishedAt: number;
  thumbnailUrl?: string;
  summary?: string;
}

export interface PlatformTrending {
  items: TrendingItem[];
  fetchedAt: number;
  source: string;
}

export interface TrendingData {
  timestamp: number;
  platforms: {
    reddit: PlatformTrending;
    youtube: PlatformTrending;
    farcaster: PlatformTrending;
    nostr: PlatformTrending;
    bluesky: PlatformTrending;
  };
}

const EMPTY_PLATFORM: PlatformTrending = {
  items: [],
  fetchedAt: Date.now(),
  source: 'empty',
};

const FETCH_TIMEOUT = 5000;

// ─── Redis / KV keys ──────────────────────────────────────────────────────

export const TRENDING_CACHE_KEY = 'trending:latest';
export const TRENDING_CACHE_TTL = 3600; // 1 hour

// ─── Score helpers ────────────────────────────────────────────────────────

function recencyBonus(publishedAt: number, now: number = Date.now()): number {
  const ageHours = (now - publishedAt) / 3600000;
  if (ageHours < 1) return 1.5;
  if (ageHours < 6) return 1.2;
  if (ageHours < 24) return 1.0;
  return 0.5;
}

function viewsPerHour(views: number, publishedAt: number, now: number = Date.now()): number {
  const ageHours = Math.max(0.1, (now - publishedAt) / 3600000);
  return views / ageHours;
}

// ─── Main orchestrator ────────────────────────────────────────────────────

/**
 * Scrape trending content from all platforms in parallel,
 * score and deduplicate, then cache in KV for 1 hour.
 */
export async function scrapeTrendingContent(env: Env): Promise<TrendingData> {
  const start = Date.now();

  const results = await Promise.allSettled([
    scrapeRedditTrending(env),
    scrapeYouTubeTrending(),
    scrapeFarcasterTrending(env),
    scrapeNostrTrending(),
    scrapeBlueskyTrending(),
  ]);

  const platforms = results.map(
    (r): PlatformTrending =>
      r.status === 'fulfilled' ? r.value : { ...EMPTY_PLATFORM, fetchedAt: Date.now() },
  );
  const [reddit, youtube, farcaster, nostr, bluesky] = platforms as [
    PlatformTrending,
    PlatformTrending,
    PlatformTrending,
    PlatformTrending,
    PlatformTrending,
  ];

  const trending: TrendingData = {
    timestamp: Date.now(),
    platforms: { reddit, youtube, farcaster, nostr, bluesky },
  };

  // Cache in KV
  try {
    await env.CACHE?.put(TRENDING_CACHE_KEY, JSON.stringify(trending), {
      expirationTtl: TRENDING_CACHE_TTL,
    });
  } catch {
    console.warn('[trending-scraper] failed to cache in KV');
  }

  const elapsed = Date.now() - start;
  const totalItems =
    reddit.items.length +
    youtube.items.length +
    farcaster.items.length +
    nostr.items.length +
    bluesky.items.length;

  console.log(`[trending-scraper] scraped ${totalItems} items across 5 platforms in ${elapsed}ms`);

  return trending;
}

// ─── Reddit trending ──────────────────────────────────────────────────────

/**
 * Fetch hot posts from crypto subreddits via self-hosted Redlib,
 * score by upvote_ratio × score × comments × recency.
 */
export async function scrapeRedditTrending(env: Env): Promise<PlatformTrending> {
  const redlibUrl = env.REDLIB_URL || 'https://redlib.degenfeed.xyz';
  const subreddits = ['CryptoCurrency', 'ethereum', 'defi', 'solana'];
  const allItems: TrendingItem[] = [];

  for (const sub of subreddits) {
    try {
      const limit = sub === 'CryptoCurrency' ? 25 : 10;
      const res = await fetch(`${redlibUrl}/r/${sub}/hot.json?limit=${limit}`, {
        headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) continue;

      const body = (await res.json()) as {
        data?: { children?: Array<{ data: Record<string, unknown> }> };
      };
      const posts = body.data?.children ?? [];

      for (const { data } of posts) {
        const title = String(data.title ?? '');
        const permalink = String(data.permalink ?? '');
        const score = Number(data.score) || 0;
        const upvoteRatio = Number(data.upvote_ratio) || 0.5;
        const numComments = Number(data.num_comments) || 0;
        const createdUtc = Number(data.created_utc) || 0;
        const publishedAt = createdUtc * 1000;
        const author = String(data.author ?? '[deleted]');
        const thumbnail = String(data.thumbnail ?? '');
        const selftext = String(data.selftext ?? '');

        const rb = recencyBonus(publishedAt);
        const compositeScore = (upvoteRatio * score + numComments * 2) * rb;

        allItems.push({
          id: `reddit:${permalink.split('/').filter(Boolean).pop() ?? ''}`,
          title,
          url: `https://reddit.com${permalink}`,
          platform: 'reddit',
          authorName: `u/${author}`,
          score: Math.round(compositeScore),
          engagement: {
            likes: Math.round(score * upvoteRatio),
            comments: numComments,
          },
          publishedAt,
          thumbnailUrl: thumbnail?.startsWith('http') ? thumbnail : undefined,
          summary: selftext ? selftext.replace(/\n+/g, ' ').trim().slice(0, 200) : undefined,
        });
      }
    } catch {
      // Subreddit unavailable — skip silently
    }
  }

  // Sort by score descending, take top 20
  allItems.sort((a, b) => b.score - a.score);

  return {
    items: allItems.slice(0, 20),
    fetchedAt: Date.now(),
    source: 'reddit',
  };
}

// ─── YouTube trending ─────────────────────────────────────────────────────

/**
 * Fetch trending crypto YouTube videos via RSS feeds,
 * score by views-per-hour, channel weight, and recency.
 */
export async function scrapeYouTubeTrending(): Promise<PlatformTrending> {
  try {
    const videos = await fetchYouTubeFeed({
      sort: 'trending',
      limit: 20,
    });

    const items: TrendingItem[] = videos.map((v: YouTubeVideoItem) => {
      const publishedMs = v.publishedMs || Date.now();
      const views = v.views ?? 0;
      const vph = viewsPerHour(views, publishedMs);
      const channelWeight = v.channelWeight ?? 0.5;
      const rb = recencyBonus(publishedMs);

      const compositeScore = vph * 0.4 + channelWeight * 100 + rb * 50;

      return {
        id: `youtube:${v.id}`,
        title: v.title,
        url: v.url,
        platform: 'youtube',
        authorName: v.channelName,
        thumbnailUrl: v.thumbnailUrl,
        score: Math.round(compositeScore),
        engagement: {
          likes: views,
          comments: 0,
          shares: 0,
        },
        publishedAt: publishedMs,
        summary: v.description
          ? v.description.replace(/\n+/g, ' ').trim().slice(0, 200)
          : undefined,
      };
    });

    items.sort((a, b) => b.score - a.score);

    return {
      items: items.slice(0, 10),
      fetchedAt: Date.now(),
      source: 'youtube',
    };
  } catch {
    return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'youtube' };
  }
}

// ─── Farcaster trending ──────────────────────────────────────────────────

interface HubbleCast {
  hash: string;
  data: {
    castAddBody: {
      text: string;
      embeds: { url: string }[];
    };
    fid: number;
    timestamp: number;
  };
}

/**
 * Fetch trending casts from Farcaster via our self-hosted Hubble.
 * Scrapes curated FIDs for recent casts and scores by recency.
 */
export async function scrapeFarcasterTrending(_env: Env): Promise<PlatformTrending> {
  try {
    const HUBBLE_URL = _env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

    // Fetch from curated FIDs that consistently post quality content
    const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 615, 910, 3621];
    const now = Date.now();
    const allCasts: Array<{ hash: string; text: string; fid: number; author: string; ts: number }> =
      [];

    for (const fid of curatedFids) {
      try {
        const res = await fetch(`${HUBBLE_URL}/v1/castsByFid?fid=${fid}&pageSize=5`, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { messages?: HubbleCast[] };
        for (const msg of data.messages ?? []) {
          const text = msg.data?.castAddBody?.text;
          if (!text) continue;
          const ts = (msg.data.timestamp + 1609459200) * 1000;
          allCasts.push({
            hash: msg.hash,
            text,
            fid: msg.data.fid,
            author: `fid:${msg.data.fid}`,
            ts,
          });
        }
      } catch {}
    }

    // Sort by recency and take top
    allCasts.sort((a, b) => b.ts - a.ts);

    const items: TrendingItem[] = allCasts.slice(0, 15).map((cast) => {
      const rb = recencyBonus(cast.ts);
      const compositeScore = Math.round(100 * rb);

      return {
        id: `farcaster:${cast.hash}`,
        title: cast.text.slice(0, 200),
        url: `https://warpcast.com/${cast.author}/${cast.hash}`,
        platform: 'farcaster',
        authorName: cast.author,
        score: compositeScore,
        engagement: { likes: 0, comments: 0 },
        publishedAt: cast.ts,
        summary: cast.text.replace(/\n+/g, ' ').trim().slice(0, 300),
      };
    });

    return {
      items,
      fetchedAt: now,
      source: 'farcaster',
    };
  } catch {
    return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'farcaster' };
  }
}

// ─── Nostr trending ──────────────────────────────────────────────────────

interface NostrTrendingNote {
  id: string;
  content: string;
  pubkey: string;
  likes: number;
  replies: number;
  author?: {
    name?: string;
    picture?: string;
  };
}

/**
 * Fetch trending notes from Nostr via nostr.band API.
 */
export async function scrapeNostrTrending(): Promise<PlatformTrending> {
  try {
    const res = await fetch('https://api.nostr.band/v0/trending/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 25 }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) {
      return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'nostr' };
    }

    const body = (await res.json()) as {
      notes?: NostrTrendingNote[];
    };

    const items: TrendingItem[] = (body.notes ?? []).map((note) => {
      const likes = note.likes ?? 0;
      const replies = note.replies ?? 0;
      const compositeScore = likes * 2 + replies * 3;

      const cleanedContent =
        note.content
          ?.replace(/https?:\/\/\S+/g, '')
          .replace(/\n+/g, ' ')
          .trim()
          .slice(0, 300) || '(media)';

      return {
        id: `nostr:${note.id}`,
        title: cleanedContent.slice(0, 120),
        url: `https://snort.social/e/${note.id}`,
        platform: 'nostr',
        authorName: note.author?.name ?? note.pubkey.slice(0, 12),
        authorAvatar: note.author?.picture,
        score: compositeScore,
        engagement: {
          likes,
          comments: replies,
        },
        publishedAt: Date.now(),
        summary: cleanedContent,
      };
    });

    items.sort((a, b) => b.score - a.score);

    return {
      items: items.slice(0, 15),
      fetchedAt: Date.now(),
      source: 'nostr',
    };
  } catch {
    return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'nostr' };
  }
}

// ─── Bluesky trending ────────────────────────────────────────────────────

interface BskyFeedPost {
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
    };
    likeCount?: number;
    replyCount?: number;
    repostCount?: number;
    indexedAt?: string;
  };
}

/**
 * Fetch trending posts from Bluesky via the public API.
 */
export async function scrapeBlueskyTrending(): Promise<PlatformTrending> {
  try {
    const res = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getPopular?limit=30', {
      headers: {
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) {
      // Try alternative endpoint
      const fallbackRes = await fetch(
        'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getPopularFeedGenerators?limit=10',
        {
          headers: {
            'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        },
      );
      if (!fallbackRes.ok) {
        return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'bluesky' };
      }
      // Fallback returns feed generators, not posts — return empty and log
      return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'bluesky' };
    }

    const body = (await res.json()) as {
      feed?: BskyFeedPost[];
    };

    const items: TrendingItem[] = (body.feed ?? []).map((entry) => {
      const post = entry.post;
      const likeCount = post.likeCount ?? 0;
      const replyCount = post.replyCount ?? 0;
      const repostCount = post.repostCount ?? 0;
      const text = post.record?.text ?? '';
      const publishedAt = post.record?.createdAt
        ? new Date(post.record.createdAt).getTime()
        : Date.now();

      const compositeScore = likeCount * 2 + repostCount * 3 + replyCount;

      return {
        id: `bluesky:${post.uri.split('/').pop() ?? post.cid}`,
        title: text.replace(/\n+/g, ' ').trim().slice(0, 200),
        url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
        platform: 'bluesky',
        authorName: post.author.displayName ?? post.author.handle,
        authorAvatar: post.author.avatar,
        score: compositeScore,
        engagement: {
          likes: likeCount,
          comments: replyCount,
          shares: repostCount,
        },
        publishedAt,
        summary: text.replace(/\n+/g, ' ').trim().slice(0, 300),
      };
    });

    items.sort((a, b) => b.score - a.score);

    return {
      items: items.slice(0, 10),
      fetchedAt: Date.now(),
      source: 'bluesky',
    };
  } catch {
    return { ...EMPTY_PLATFORM, fetchedAt: Date.now(), source: 'bluesky' };
  }
}

// ─── Merge helpers ───────────────────────────────────────────────────────

/**
 * Get all trending items across all platforms merged into a single sorted list.
 */
export function mergeTrendingItems(data: TrendingData): TrendingItem[] {
  const all: TrendingItem[] = [];
  for (const platform of Object.values(data.platforms)) {
    for (const item of platform.items) {
      all.push(item);
    }
  }
  all.sort((a, b) => b.score - a.score);
  return all;
}

/**
 * Get trending items for a specific platform.
 */
export function getPlatformTrending(
  data: TrendingData,
  platform: keyof TrendingData['platforms'],
): PlatformTrending {
  return data.platforms[platform] ?? EMPTY_PLATFORM;
}
