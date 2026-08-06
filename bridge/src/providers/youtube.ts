/**
 * YouTube Provider
 *
 * Rate Limit: 15 channel feeds per refresh (no API key required)
 *
 * Fetches the latest videos from top crypto / tech / AI channels using
 * YouTube's public RSS feeds (no API key needed):
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 *
 * Each feed returns the 15 most recent uploads for a channel (Atom XML).
 * We parse video id, title, link, thumbnail (media:thumbnail), view count
 * (media:statistics), likes (media:starRating), description, and publish
 * date, then normalize to UnifiedPost with `contentType: 'video'`.
 *
 * NOTE: YouTube's public RSS feed does NOT include video duration. We parse
 * the `duration` attribute from media:content when present (some mirrors
 * include it) and fall back to `undefined` — the UI omits the badge then.
 */

import { checkRateLimit } from '../rate-limiter';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const YOUTUBE_FEED_BASE = 'https://www.youtube.com/feeds/videos.xml';
const USER_AGENT = 'DegenFeed-Bridge/0.2 (YouTube RSS)';

/**
 * YouTube videos stay relevant for weeks (unlike microblog posts), so the
 * global 48h freshness filter would empty the feed for channels that don't
 * upload daily. Use a 30-day window for video content — still fresh enough
 * to be useful, but doesn't starve the feed. Override with
 * YOUTUBE_MAX_AGE_HOURS (0 disables).
 */
export const YOUTUBE_MAX_AGE_HOURS = (() => {
  try {
    const raw = process.env.YOUTUBE_MAX_AGE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 30 * 24; // 30 days
})();

/** 90s TTL — collapse repeated feed-build calls (prewarm + refresher) into
 *  one real fetch per window so YouTube RSS is not hammered under load. */
const YOUTUBE_CACHE_TTL_MS = 90_000;
let youtubeCache: { posts: UnifiedPost[]; expiresAt: number } | null = null;

export type YouTubeCategory = 'crypto' | 'ai' | 'tech';

export interface YouTubeChannel {
  /** Verified UC... channel id (used in the RSS feed URL). */
  channelId: string;
  /** Display name of the channel. */
  name: string;
  /** @handle for links/avatars. */
  handle: string;
  category: YouTubeCategory;
}

/**
 * Top crypto / tech / AI channels — verified channel IDs (2026-08-03).
 *
 * Crypto (9): Coin Bureau, Bankless, Finematics, Whiteboard Crypto,
 *   Benjamin Cowen, DataDash, Ivan on Tech, Altcoin Daily, CoinGecko
 * AI (4): Two Minute Papers, Yannic Kilcher, AI Explained, Matt Wolfe
 * Tech (2): Fireship, Theo - t3.gg
 */
export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  // ── Crypto ──────────────────────────────────────────────────────
  {
    channelId: 'UCqK_GSMbpiV8spgD3ZGloSw',
    name: 'Coin Bureau',
    handle: 'CoinBureau',
    category: 'crypto',
  },
  {
    channelId: 'UCAl9Ld79qaZxp9JzEOwd3aA',
    name: 'Bankless',
    handle: 'Bankless',
    category: 'crypto',
  },
  {
    channelId: 'UCh1ob28ceGdqohUnR7vBACA',
    name: 'Finematics',
    handle: 'Finematics',
    category: 'crypto',
  },
  {
    channelId: 'UCsYYksPHiGqXHPoHI-fm5sg',
    name: 'Whiteboard Crypto',
    handle: 'WhiteboardCrypto',
    category: 'crypto',
  },
  {
    channelId: 'UCRvqjQPSeaWn-uEx-w0XOIg',
    name: 'Benjamin Cowen',
    handle: 'benjaminjcowen',
    category: 'crypto',
  },
  {
    channelId: 'UCCatR7nWbYrkVXdxXb4cGXw',
    name: 'DataDash',
    handle: 'DataDash',
    category: 'crypto',
  },
  {
    channelId: 'UCrYmtJBtLdtm2ov84ulV-yg',
    name: 'Ivan on Tech',
    handle: 'IvanOnTech',
    category: 'crypto',
  },
  {
    channelId: 'UCbLhGKVY-bJPcawebgtNfbw',
    name: 'Altcoin Daily',
    handle: 'AltcoinDaily',
    category: 'crypto',
  },
  {
    channelId: 'UC-OTgwOAI7KmP0eDAtqN3Ow',
    name: 'CoinGecko',
    handle: 'CoinGecko',
    category: 'crypto',
  },
  // ── AI ─────────────────────────────────────────────────────────
  {
    channelId: 'UCbfYPyITQ-7l4upoX8nvctg',
    name: 'Two Minute Papers',
    handle: 'TwoMinutePapers',
    category: 'ai',
  },
  {
    channelId: 'UCZHmQk67mSJgfCCTn7xBfew',
    name: 'Yannic Kilcher',
    handle: 'YannicKilcher',
    category: 'ai',
  },
  {
    channelId: 'UCNJ1Ymd5yFuUPtn21xtRbbw',
    name: 'AI Explained',
    handle: 'aiexplained-official',
    category: 'ai',
  },
  {
    channelId: 'UChpleBmo18P08aKCIgti38g',
    name: 'Matt Wolfe',
    handle: 'mattwolfe',
    category: 'ai',
  },
  // ── Tech ───────────────────────────────────────────────────────
  { channelId: 'UCsBjURrPoezykLs9EqgamOA', name: 'Fireship', handle: 'Fireship', category: 'tech' },
  {
    channelId: 'UCbRP3c757lWg9M-U7TyEkXA',
    name: 'Theo - t3.gg',
    handle: 't3dotgg',
    category: 'tech',
  },
];

/** Feed URL for a channel id. */
export function youtubeFeedUrl(channelId: string): string {
  return `${YOUTUBE_FEED_BASE}?channel_id=${encodeURIComponent(channelId)}`;
}

export interface ParsedYouTubeVideo {
  videoId: string;
  title: string;
  watchUrl: string;
  description: string;
  thumbnail: string;
  views: number;
  likes: number;
  publishedAt: number;
  updatedAt: number;
  duration?: number;
  channelId: string;
  channelName: string;
}

/** Decode common XML entities in text extracted from the feed. */
function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(html: string): string {
  return decodeXml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse a number from a media:statistics/starRating attribute, 0 if missing. */
function parseCount(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse a single <entry> block from the YouTube Atom feed.
 */
export function parseYouTubeEntry(
  entryXml: string,
  channelId: string,
  channelName: string,
): ParsedYouTubeVideo | null {
  const videoIdMatch = entryXml.match(/<yt:videoId[^>]*>([\s\S]*?)<\/yt:videoId>/i);
  const videoId = videoIdMatch ? decodeXml(videoIdMatch[1] ?? '').trim() : '';

  const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripHtml(titleMatch[1] ?? '') : '';
  if (!videoId && !title) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // media:thumbnail url="..." (first entry in media:group)
  const thumbMatch = entryXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  const thumbnail = thumbMatch ? decodeXml(thumbMatch[1] ?? '') : '';

  // media:statistics views="12345" (inside media:community)
  const viewsMatch = entryXml.match(/<media:statistics[^>]*views="([^"]+)"/i);

  // media:starRating count="1234" (inside media:community)
  const likesMatch = entryXml.match(/<media:starRating[^>]*count="([^"]+)"/i);

  // media:description — may contain CDATA-wrapped HTML
  const descMatch = entryXml.match(/<media:description[^>]*>([\s\S]*?)<\/media:description>/i);
  const description = descMatch ? stripHtml(descMatch[1] ?? '') : '';

  // published / updated timestamps
  const publishedMatch = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
  const updatedMatch = entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const publishedAt = publishedMatch
    ? new Date((publishedMatch[1] ?? '').trim()).getTime()
    : Date.now();
  const updatedAt = updatedMatch ? new Date((updatedMatch[1] ?? '').trim()).getTime() : publishedAt;

  // YouTube's public RSS omits duration; parse it from media:content when
  // present (some mirrors include `duration="NNN"`), otherwise undefined.
  const durationMatch = entryXml.match(/<media:content[^>]*duration="(\d+)"/i);
  const duration = durationMatch ? Number.parseInt(durationMatch[1] ?? '0', 10) : undefined;

  return {
    videoId,
    title,
    watchUrl,
    description,
    thumbnail,
    views: parseCount(viewsMatch?.[1]),
    likes: parseCount(likesMatch?.[1]),
    publishedAt: Number.isNaN(publishedAt) ? Date.now() : publishedAt,
    updatedAt: Number.isNaN(updatedAt) ? Date.now() : updatedAt,
    duration,
    channelId,
    channelName,
  };
}

/**
 * Parse a full YouTube channel RSS document into video entries.
 */
export function parseYouTubeFeed(
  xml: string,
  channelId: string,
  channelName: string,
): ParsedYouTubeVideo[] {
  const result: ParsedYouTubeVideo[] = [];
  const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((m = entryRe.exec(xml)) !== null) {
    const item = parseYouTubeEntry(m[1] ?? '', channelId, channelName);
    if (item) result.push(item);
  }
  return result;
}

/** Fetch a single channel's feed and return parsed videos (empty on error). */
async function fetchChannelVideos(
  channel: YouTubeChannel,
  limit: number,
): Promise<ParsedYouTubeVideo[]> {
  try {
    const res = await $fetch(youtubeFeedUrl(channel.channelId), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/atom+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.log(`[youtube] ${channel.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    if (!xml || xml.length < 200 || xml.includes('Error 404')) return [];
    return parseYouTubeFeed(xml, channel.channelId, channel.name).slice(0, limit);
  } catch (err) {
    console.log(
      `[youtube] ${channel.name}: fetch error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * Main entry point — aggregate the latest videos from all 15 channels.
 * Returns UnifiedPost[] with `protocol: 'youtube'` and `contentType: 'video'`.
 */
export async function fetchYouTubePosts(limit = 30): Promise<UnifiedPost[]> {
  const key = 'provider:youtube';
  if (!checkRateLimit(key, { maxRequests: 30, windowMs: 60_000 })) return [];

  // Serve from cache first — the prewarmer + refresher call this repeatedly.
  const cached = youtubeCache && Date.now() < youtubeCache.expiresAt ? youtubeCache.posts : null;
  if (cached) return cached.slice(0, limit);

  const perChannel = Math.max(2, Math.ceil(limit / YOUTUBE_CHANNELS.length));
  const posts: UnifiedPost[] = [];

  // Fetch channels with a small concurrency window + gentle pacing to avoid
  // hammering YouTube (15 feeds per refresh is well inside any rate limit).
  // Concurrency kept low (3) because the service runs CPU-quota-limited and
  // parallel TLS handshakes otherwise time out.
  const CONCURRENCY = 3;
  const results: Array<ParsedYouTubeVideo[]> = [];
  for (let i = 0; i < YOUTUBE_CHANNELS.length; i += CONCURRENCY) {
    const batch = YOUTUBE_CHANNELS.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((ch) => fetchChannelVideos(ch, perChannel)));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : []);
    }
  }

  for (let i = 0; i < YOUTUBE_CHANNELS.length; i++) {
    const channel = YOUTUBE_CHANNELS[i];
    if (!channel) continue;
    const videos = results[i] ?? [];
    for (const v of videos) {
      posts.push(videoToPost(v, channel));
    }
  }

  // Freshness: discard videos published outside the YouTube-specific window
  // (30 days by default), then newest-first and capped at the requested limit.
  const fresh = posts.filter((p) => {
    if (YOUTUBE_MAX_AGE_HOURS <= 0) return true;
    return Date.now() - p.createdAt <= YOUTUBE_MAX_AGE_HOURS * 3_600_000;
  });
  const result = fresh.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

  // Only cache non-empty results so a bad window is retried next cycle.
  if (result.length > 0) {
    youtubeCache = { posts: result, expiresAt: Date.now() + YOUTUBE_CACHE_TTL_MS };
  }
  return result;
}

/** Normalize a parsed YouTube video into a UnifiedPost. */
function videoToPost(v: ParsedYouTubeVideo, channel: YouTubeChannel): UnifiedPost {
  const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
  const raw = {
    videoId: v.videoId,
    channelId: v.channelId,
    channelTitle: channel.name,
    channelHandle: channel.handle,
    thumbnail: thumb,
    views: v.views,
    likes: v.likes,
    duration: v.duration,
    description: v.description,
    watchUrl: v.watchUrl,
    platform: 'youtube',
  };

  return {
    id: `youtube:${v.videoId}`,
    protocol: 'youtube',
    author: {
      id: `youtube:${channel.channelId}`,
      primary: { protocol: 'youtube', id: channel.channelId },
      handles: { youtube: channel.handle },
      displayName: channel.name,
      bio: '',
      avatarUrl: `https://www.youtube.com/@${channel.handle}`,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: `▶ ${v.title}`,
    html: v.description ? `<p>${v.description.slice(0, 500)}</p>` : undefined,
    embeds: [
      {
        kind: 'video' as const,
        url: v.watchUrl,
        meta: {
          videoId: v.videoId,
          thumbnail: thumb,
          duration: v.duration,
          channel: channel.name,
          platform: 'youtube',
        },
      },
      ...(thumb ? [{ kind: 'image' as const, url: thumb }] : []),
    ],
    createdAt: v.publishedAt,
    metrics: {
      likes: v.likes,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: v.views,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: v.likes,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    },
    raw,
    niches: ['video', channel.category],
    contentType: 'video',
  };
}
/** Get the configured channels (for the /api/feed/youtube/channels route). */
export function getYouTubeFeeds(): YouTubeChannel[] {
  return YOUTUBE_CHANNELS;
}

export const schema: SchemaGuard = {
  id: 'youtube',
  name: 'YouTube',
  description:
    'Top crypto, tech & AI videos — Coin Bureau, Bankless, Finematics, Fireship, Two Minute Papers and 11 more',
  endpoint: '/api/feed/youtube',
  requiresAuth: false,
  contentType: 'video',
};
