/**
 * @degenfeed/api-worker — YouTubeFetcher
 *
 * Fetches YouTube content algorithmically based on user interests,
 * channel subscriptions, and trending signals. Enriches videos with
 * DegenFeed metadata for cross-platform actions (tip, share, save).
 *
 * Sources:
 *   - YouTube RSS feeds (curated crypto channels via @degenfeed/youtube-provider)
 *   - YouTube Data API v3 (when API key configured)
 *   - YouTube oEmbed for single-video metadata
 *
 * KV cache prefix: youtube:feed:*
 * Cache TTL: 15 minutes (900s)
 */

import type { YouTubeVideoItem } from '@degenfeed/youtube-provider';
import { fetchYouTubeFeed, getYouTubeVideoInfo } from '@degenfeed/youtube-provider';
import type { Env } from '../index';

// ─── Types ───────────────────────────────────────────────────────────────

export type YouTubeCategory =
  | 'gaming'
  | 'music'
  | 'crypto'
  | 'tech'
  | 'education'
  | 'entertainment'
  | 'sports'
  | 'news'
  | 'science'
  | 'comedy'
  | 'all';

export type ShortsCategory = 'trending' | 'crypto' | 'gaming' | 'music' | 'comedy' | 'education';

/**
 * Normalized YouTube video for our feed.
 * All videos from this fetcher produce items conforming to this shape.
 */
export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  channelAvatar: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  duration: string;
  publishedAt: string;
  category: YouTubeCategory;
  tags: string[];
  isShort: boolean;
}

/**
 * After enrichment with DegenFeed metadata — creator coin, tip address,
 * cross-platform profile link, and explicit source labeling.
 */
export interface EnrichedYouTubeVideo extends YouTubeVideo {
  /** Whether this creator has a DegenFeed wallet/coin for tipping */
  canTip: boolean;
  /** Creator coin info if the creator has launched one */
  creatorCoin?: { address: string; symbol: string };
  /** Link back to creator's DegenFeed profile (if registered) */
  creatorDegenFeedProfile?: string;
  /** Source identifier — always 'youtube' */
  source: 'youtube';
  /** Human-readable source label */
  sourceLabel: 'YouTube';
  /** Brand color for the source badge */
  sourceColor: '#FF0000';
}

export interface UserVideoPreferences {
  /** Topic → interest weight (0.0–1.0) */
  topics: Record<string, number>;
  /** Followed YouTube channel IDs */
  followedChannels: string[];
  /** Recently watched video IDs (for dedup) */
  watchHistory: string[];
  /** Liked/categorized video IDs for preference learning */
  likedVideos: string[];
  /** Wallet address for tip enrichment */
  wallet?: string;
}

// ─── Cache helpers ───────────────────────────────────────────────────────

const CACHE_PREFIX = 'youtube:feed:';
const CACHE_TTL = 900; // 15 minutes

function cacheKey(suffix: string): string {
  return `${CACHE_PREFIX}${suffix}`;
}

async function getCachedJson<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setCachedJson(env: Env, key: string, data: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
  } catch {
    // KV unavailable — non-critical
  }
}

// ─── YouTube Data API (optional, for enhanced metadata) ──────────────────

/**
 * Fetch video details from YouTube Data API v3.
 * Falls back gracefully if no API key is configured.
 */
async function fetchVideoDetails(
  videoIds: string[],
  apiKey?: string,
): Promise<Map<string, { viewCount: number; likeCount: number }>> {
  const result = new Map<string, { viewCount: number; likeCount: number }>();
  if (!apiKey || videoIds.length === 0) return result;

  try {
    const ids = videoIds.slice(0, 50).join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return result;

    const data = (await res.json()) as {
      items?: Array<{ id: string; statistics?: { viewCount?: string; likeCount?: string } }>;
    };
    for (const item of data.items ?? []) {
      if (item.statistics) {
        result.set(item.id, {
          viewCount: Number(item.statistics.viewCount) || 0,
          likeCount: Number(item.statistics.likeCount) || 0,
        });
      }
    }
  } catch {
    // API unavailable — return empty map
  }

  return result;
}

// ─── Category mapping ────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, YouTubeCategory> = {
  market_analysis: 'crypto',
  defi: 'crypto',
  trading: 'crypto',
  nft_gaming: 'entertainment',
  macro_bitcoin: 'crypto',
  security_tech: 'tech',
};

const TAGS_FROM_NICHES: Record<string, string[]> = {
  crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'defi'],
  tech: ['technology', 'programming', 'security', 'web3', 'ai'],
  gaming: ['gaming', 'esports', 'gameplay', 'walkthrough'],
  music: ['music', 'live', 'concert', 'remix'],
  education: ['education', 'tutorial', 'learn', 'guide'],
  entertainment: ['entertainment', 'vlog', 'podcast', 'comedy'],
};

function inferCategory(item: YouTubeVideoItem): YouTubeCategory {
  if (item.channelCategory && CATEGORY_MAP[item.channelCategory]) {
    return CATEGORY_MAP[item.channelCategory];
  }
  if (item.category && CATEGORY_MAP[item.category]) {
    return CATEGORY_MAP[item.category];
  }
  // Detect from title/description
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase();
  if (text.includes('gaming') || text.includes('gameplay') || text.includes('esports')) return 'gaming';
  if (text.includes('music') || text.includes('song') || text.includes('album')) return 'music';
  if (text.includes('tech') || text.includes('programming') || text.includes('software')) return 'tech';
  if (text.includes('tutorial') || text.includes('learn') || text.includes('course')) return 'education';
  if (text.includes('sport') || text.includes('game') || text.includes('match')) return 'sports';
  if (text.includes('news') || text.includes('breaking') || text.includes('report')) return 'news';
  if (text.includes('science') || text.includes('research') || text.includes('study')) return 'science';
  if (text.includes('comedy') || text.includes('funny') || text.includes('hilarious')) return 'entertainment';

  // Default based on channel category fallback
  return 'crypto';
}

function inferTags(item: YouTubeVideoItem): string[] {
  const tags = new Set<string>();
  for (const niche of item.niches ?? []) {
    const mapped = TAGS_FROM_NICHES[niche];
    if (mapped) {
      for (const t of mapped) tags.add(t);
    }
  }
  if (tags.size === 0) tags.add('crypto');
  return [...tags];
}

function inferShortness(title: string, duration?: string): boolean {
  if (title.toLowerCase().includes('#shorts')) return true;
  if (!duration) return false;
  const match = duration.match(/(\d+):(\d+)/);
  if (!match) return false;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes === 0 && seconds <= 60;
}

function durationToLabel(duration?: string): string {
  if (!duration) return '';
  // Already formatted by youtube-provider (e.g., "12:34")
  if (/^\d+:\d{2}(:\d{2})?$/.test(duration)) return duration;
  // Try ISO 8601 duration
  if (duration.startsWith('PT')) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;
    const h = match[1] ? Number.parseInt(match[1], 10) : 0;
    const m = match[2] ? Number.parseInt(match[2], 10) : 0;
    const s = match[3] ? Number.parseInt(match[3], 10) : 0;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return duration;
}

// ─── YouTubeFetcher ──────────────────────────────────────────────────────

export class YouTubeFetcher {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ── Get trending videos in a category ──────────────────────────────────

  async getTrending(
    category: YouTubeCategory,
    limit: number,
    env?: Env,
  ): Promise<YouTubeVideo[]> {
    // Check cache first
    const cacheSuffix = `trending:${category}:${limit}`;
    if (env) {
      const cached = await getCachedJson<YouTubeVideo[]>(env, cacheKey(cacheSuffix));
      if (cached) return cached;
    }

    const channelCategories = category !== 'all' ? [this.categoryToChannelCategory(category)] : undefined;

    try {
      const items = await fetchYouTubeFeed({
        category: category !== 'all' ? category : undefined,
        channelCategories: channelCategories as Array<'market_analysis' | 'defi' | 'trading' | 'nft_gaming' | 'macro_bitcoin' | 'security_tech'> | undefined,
        limit: limit * 3, // Fetch extra for filtering
        sort: 'trending',
      });

      const videos = await this.normalizeItems(items, limit, env);

      if (env) {
        await setCachedJson(env, cacheKey(cacheSuffix), videos);
      }

      return videos;
    } catch (err) {
      console.warn('[youtube-fetcher] getTrending failed:', String(err));
      return [];
    }
  }

  // ── Get videos from specific channels ──────────────────────────────────

  async getChannelVideos(
    channelId: string,
    limit: number,
    env?: Env,
  ): Promise<YouTubeVideo[]> {
    const cacheSuffix = `channel:${channelId}:${limit}`;
    if (env) {
      const cached = await getCachedJson<YouTubeVideo[]>(env, cacheKey(cacheSuffix));
      if (cached) return cached;
    }

    try {
      const items = await fetchYouTubeFeed({
        channels: [channelId],
        limit,
        sort: 'recent',
      });

      const videos = await this.normalizeItems(items, limit, env);

      if (env) {
        await setCachedJson(env, cacheKey(cacheSuffix), videos);
      }

      return videos;
    } catch (err) {
      console.warn(`[youtube-fetcher] getChannelVideos(${channelId}) failed:`, String(err));
      return [];
    }
  }

  // ── Search YouTube ────────────────────────────────────────────────────

  async search(query: string, limit: number, env?: Env): Promise<YouTubeVideo[]> {
    const cacheSuffix = `search:${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}:${limit}`;
    if (env) {
      const cached = await getCachedJson<YouTubeVideo[]>(env, cacheKey(cacheSuffix));
      if (cached) return cached;
    }

    try {
      const items = await fetchYouTubeFeed({
        limit: limit * 2,
        sort: 'recent',
      });

      // Client-side search across fetched items
      const q = query.toLowerCase();
      const matched = items.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.description ?? '').toLowerCase().includes(q) ||
          v.channelName.toLowerCase().includes(q),
      );

      const videos = await this.normalizeItems(matched, limit, env);

      if (env) {
        await setCachedJson(env, cacheKey(cacheSuffix), videos);
      }

      return videos;
    } catch (err) {
      console.warn('[youtube-fetcher] search failed:', String(err));
      return [];
    }
  }

  // ── Get personalized recommendations based on user preferences ─────────

  async getRecommendations(
    userPreferences: UserVideoPreferences,
    limit: number,
    env?: Env,
  ): Promise<YouTubeVideo[]> {
    const prefKey = `recs:${Object.keys(userPreferences.topics).sort().join(',')}:${userPreferences.followedChannels.sort().join(',')}:${limit}`;
    const cacheSuffix = `recs:${prefKey.length > 120 ? prefKey.slice(0, 120) : prefKey}`;

    if (env) {
      const cached = await getCachedJson<YouTubeVideo[]>(env, cacheKey(cacheSuffix));
      if (cached) return cached;
    }

    try {
      // Get a broad set of recent videos
      const items = await fetchYouTubeFeed({
        limit: limit * 4,
        sort: 'recent',
      });

      // Score each item by user preferences
      const scored = items.map((item) => {
        let score = 0;
        const text = `${item.title} ${item.description ?? ''}`.toLowerCase();

        // Topic match
        for (const [topic, weight] of Object.entries(userPreferences.topics)) {
          if (text.includes(topic.toLowerCase())) {
            score += weight * 10;
          }
        }

        // Channel match (followed channels boosted)
        if (userPreferences.followedChannels.includes(item.channelName)) {
          score += 50;
        }

        // Channel weight from curation
        score += (item.channelWeight ?? 0.5) * 20;

        // Recency bonus
        const ageHours = (Date.now() - item.publishedMs) / 3600000;
        if (ageHours < 24) score += 15;
        else if (ageHours < 72) score += 10;
        else if (ageHours < 168) score += 5;

        // Dedup: penalize watched videos
        if (userPreferences.watchHistory.includes(item.id)) {
          score -= 100;
        }

        // Boost liked topics
        if (userPreferences.likedVideos.includes(item.id)) {
          score += 30;
        }

        return { item, score };
      });

      // Sort by score descending, take top N
      const topScored = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const videos = await this.normalizeItems(
        topScored.map((s) => s.item),
        limit,
        env,
      );

      if (env) {
        await setCachedJson(env, cacheKey(cacheSuffix), videos);
      }

      return videos;
    } catch (err) {
      console.warn('[youtube-fetcher] getRecommendations failed:', String(err));
      return [];
    }
  }

  // ── Get YouTube Shorts ────────────────────────────────────────────────

  async getShorts(
    category: ShortsCategory,
    limit: number,
    env?: Env,
  ): Promise<YouTubeShort[]> {
    const cacheSuffix = `shorts:${category}:${limit}`;
    if (env) {
      const cached = await getCachedJson<YouTubeShort[]>(env, cacheKey(cacheSuffix));
      if (cached) return cached;
    }

    try {
      const items = await fetchYouTubeFeed({
        limit: limit * 3,
        sort: 'trending',
      });

      // Filter to short-form content (< 60s or #shorts)
      const shortItems = items.filter(
        (v) => v.title.toLowerCase().includes('#shorts') || (v.duration !== undefined && this.parseDuration(v.duration) < 60),
      );

      const shorts: YouTubeShort[] = shortItems.slice(0, limit).map((item) => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnailUrl ?? `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
        videoUrl: `https://www.youtube.com/shorts/${item.id}`,
        channelName: item.channelName,
        channelAvatar: '',
        channelId: item.channelId ?? '',
        viewCount: item.views ?? 0,
        likeCount: 0,
        publishedAt: item.publishedAt,
        category,
        tags: inferTags(item),
        vertical: true,
      }));

      if (env) {
        await setCachedJson(env, cacheKey(cacheSuffix), shorts);
      }

      return shorts;
    } catch (err) {
      console.warn('[youtube-fetcher] getShorts failed:', String(err));
      return [];
    }
  }

  // ── Enrich with DegenFeed metadata ─────────────────────────────────────

  async enrichWithDegenFeedData(
    videos: YouTubeVideo[],
    env?: Env,
  ): Promise<EnrichedYouTubeVideo[]> {
    // Look up creator info from KV (creator coins, wallet addresses)
    const creatorMap = new Map<string, { address: string; symbol: string; profile?: string }>();

    if (env?.CACHE) {
      try {
        // Batch resolve creator coin info from KV
        const creatorKeys = [...new Set(videos.map((v) => `creator:youtube:${v.channelId}`))];
        const entries = await Promise.all(
          creatorKeys.map(async (key) => {
            const raw = await env.CACHE?.get(key);
            if (!raw) return null;
            return { key, data: JSON.parse(raw) as { address: string; symbol: string; profile?: string } };
          }),
        );

        for (const entry of entries) {
          if (entry) {
            const channelId = entry.key.replace('creator:youtube:', '');
            creatorMap.set(channelId, entry.data);
          }
        }
      } catch {
        // KV unavailable — no enrichment
      }
    }

    return videos.map((video) => ({
      ...video,
      canTip: creatorMap.has(video.channelId),
      creatorCoin: creatorMap.get(video.channelId)
        ? { address: creatorMap.get(video.channelId)?.address ?? '', symbol: creatorMap.get(video.channelId)?.symbol ?? '' }
        : undefined,
      creatorDegenFeedProfile: creatorMap.get(video.channelId)?.profile,
      source: 'youtube' as const,
      sourceLabel: 'YouTube' as const,
      sourceColor: '#FF0000' as const,
    }));
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private async normalizeItems(
    items: YouTubeVideoItem[],
    limit: number,
    env?: Env,
  ): Promise<YouTubeVideo[]> {
    // Enhance with Data API if key is available
    const videoIds = items.map((i) => i.id);
    const details = await fetchVideoDetails(videoIds, this.apiKey);

    return items.slice(0, limit).map((item) => {
      const detail = details.get(item.id);
      const duration = durationToLabel(item.duration);

      return {
        id: item.id,
        title: item.title,
        description: item.description ?? '',
        thumbnail: item.thumbnailUrl ?? `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
        channelName: item.channelName,
        channelAvatar: `https://img.youtube.com/vi/${item.id}/0.jpg`, // Will be replaced by channel lookup
        channelId: item.channelId ?? '',
        viewCount: detail?.viewCount ?? item.views ?? 0,
        likeCount: detail?.likeCount ?? 0,
        duration,
        publishedAt: item.publishedAt,
        category: inferCategory(item),
        tags: inferTags(item),
        isShort: inferShortness(item.title, item.duration),
      };
    });
  }

  private categoryToChannelCategory(
    category: YouTubeCategory,
  ): 'market_analysis' | 'defi' | 'trading' | 'nft_gaming' | 'macro_bitcoin' | 'security_tech' | undefined {
    const map: Partial<Record<YouTubeCategory, 'market_analysis' | 'defi' | 'trading' | 'nft_gaming' | 'macro_bitcoin' | 'security_tech'>> = {
      crypto: 'market_analysis',
      tech: 'security_tech',
      gaming: 'nft_gaming',
      entertainment: 'nft_gaming',
      education: 'market_analysis',
    };
    return map[category];
  }

  private parseDuration(duration: string): number {
    if (/^\d+:\d{2}(:\d{2})?$/.test(duration)) {
      const parts = duration.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
    return 300; // Default 5 min
  }
}

/**
 * Short-form video type for the YouTube Shorts feed.
 */
export interface YouTubeShort {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  channelName: string;
  channelAvatar: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  category: ShortsCategory;
  tags: string[];
  vertical: boolean;
}

// ─── Default user profile for unauthenticated recommendations ────────────

export const DEFAULT_USER_PREFERENCES: UserVideoPreferences = {
  topics: {
    crypto: 0.9,
    bitcoin: 0.8,
    ethereum: 0.7,
    defi: 0.8,
    trading: 0.7,
    nft: 0.5,
    tech: 0.6,
    ai: 0.6,
    macro: 0.7,
    security: 0.5,
  },
  followedChannels: [],
  watchHistory: [],
  likedVideos: [],
};
