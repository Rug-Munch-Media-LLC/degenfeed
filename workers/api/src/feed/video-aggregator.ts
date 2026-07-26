/**
 * @degenfeed/api-worker — VideoAggregator
 *
 * Intelligent cross-platform video aggregator.
 * "Follow creators, not platforms" — pull video content from ALL sources
 * based on creator subscriptions and category preferences.
 *
 * Merges, deduplicates, ranks, and paginates videos from:
 *   - YouTube (via Invidious/Piped/RSS)
 *   - Twitch (via ivr.fi API)
 *   - Rumble (via RSS/channel scraping)
 *   - PeerTube (via video.degenfeed.xyz + federated instances)
 *   - TikTok (via oEmbed/RSS)
 *   - Instagram (via oEmbed)
 *   - Odysee (via lbry.tv API)
 *   - Zora (via Zora API)
 *
 * KV cache prefix: video:agg:* (5min TTL)
 */

import type { Env } from '../types';
import type { VideoPlatform } from '../lib/creator-resolver';
import { VIDEO_PLATFORM_COLORS, VIDEO_PLATFORM_LABELS } from '../lib/creator-resolver';

// ─── Video bridge imports ─────────────────────────────────────────────────

import { fetchZoraTrendingVideos } from '../lib/zora-deep';
import {
  fetchBitchuteChannelVideos,
  fetchBitchuteTrending,
  searchBitchute,
} from './video-bridges/bitchute';
import { fetchBlueskyVideoFeed } from './video-bridges/bluesky-video';
import {
  fetchDailymotionChannelVideos,
  fetchDailymotionTrending,
  searchDailymotion,
} from './video-bridges/dailymotion';
import { fetchDTubeChannelVideos, fetchDTubeTrending, searchDTube } from './video-bridges/dtube';
import { fetchArweaveTrending, fetchIPFSTrending } from './video-bridges/ipfs-arweave-video';
import { fetchLensTrendingVideos } from './video-bridges/lens-video';
import { fetchNip71Videos } from './video-bridges/nip71-video';
import {
  fetchOdyseeChannelVideos,
  fetchOdyseeTrending,
  searchOdysee,
} from './video-bridges/odysee';
import {
  fetchRumbleChannelVideos,
  fetchRumbleTrending,
  searchRumble,
} from './video-bridges/rumble';
import { fetchTwitchTrending, searchTwitch } from './video-bridges/twitch';
import { fetchVimeoChannelVideos, fetchVimeoTrending, searchVimeo } from './video-bridges/vimeo';

// ─── Invidious/Piped instances for YouTube (no API key needed) ──────────────

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UnifiedVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  duration: number;
  platform: VideoPlatform;
  platformLabel: string;
  platformColor: string;
  creatorName: string;
  creatorId: string;
  creatorAvatar: string;
  creatorUrl: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  publishedMs: number;
  category: string;
  tags: string[];
  isShort: boolean;
  isLive: boolean;
  qualityScore: number;
}

export interface VideoAggregatorOptions {
  limit?: number;
  offset?: number;
  categories?: string[];
  platforms?: VideoPlatform[];
  minViews?: number;
  maxAgeDays?: number;
  sort?: 'recent' | 'trending' | 'popular';
}

export interface AggregatedFeed {
  videos: UnifiedVideo[];
  total: number;
  hasMore: boolean;
  sourceBreakdown: Record<string, number>;
  fetchedAt: number;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────

const CACHE_PREFIX = 'video:agg:';
const CACHE_TTL = 300; // 5 minutes

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
    await env.CACHE?.put(key, JSON.stringify(data), {
      expirationTtl: CACHE_TTL,
    });
  } catch {
    // KV unavailable — non-critical
  }
}

// ─── VideoAggregator ───────────────────────────────────────────────────────

export class VideoAggregator {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // ── Get videos from a specific creator across ALL platforms ───────────

  async getCreatorVideos(
    creatorId: string,
    opts: VideoAggregatorOptions = {},
  ): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cacheSuffix = `creator:${creatorId.toLowerCase()}:${limit}`;

    const cached = await getCachedJson<UnifiedVideo[]>(this.env, cacheKey(cacheSuffix));
    if (cached) return cached;

    const fetchers: Promise<UnifiedVideo[]>[] = [];

    // If the creatorId looks like a YouTube channel ID
    if (/^UC[\w-]{22}$/.test(creatorId)) {
      fetchers.push(this.fetchYouTubeChannelVideos(creatorId));
    }

    // If it looks like a Twitch channel
    if (/^[a-zA-Z][\w]{2,24}$/.test(creatorId) && !creatorId.startsWith('UC')) {
      fetchers.push(this.fetchTwitchChannelVideos(creatorId));
    }

    // If it looks like a wallet address
    if (/^0x[a-fA-F0-9]{40}$/.test(creatorId)) {
      fetchers.push(this.fetchZoraCreatorVideos(creatorId));
    }

    // Search PeerTube for this creator
    fetchers.push(this.fetchPeerTubeCreatorVideos(creatorId));

    // Search all other platforms for this creator
    fetchers.push(fetchRumbleChannelVideos(creatorId));
    fetchers.push(fetchOdyseeChannelVideos(creatorId));
    fetchers.push(fetchDTubeChannelVideos(creatorId));
    fetchers.push(fetchBitchuteChannelVideos(creatorId));
    fetchers.push(fetchDailymotionChannelVideos(creatorId));
    fetchers.push(fetchVimeoChannelVideos(creatorId));

    // Run all fetchers in parallel
    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    const merged = this.mergeAndRank(allVideos, opts);

    await setCachedJson(this.env, cacheKey(cacheSuffix), merged);
    return merged;
  }

  // ── Get trending videos in a category from ALL platforms ──────────────

  async getTrendingVideos(
    category: string,
    opts: VideoAggregatorOptions = {},
  ): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cacheSuffix = `trending:${category}:${limit}`;

    const cached = await getCachedJson<UnifiedVideo[]>(this.env, cacheKey(cacheSuffix));
    if (cached) return cached;

    const fetchers: Promise<UnifiedVideo[]>[] = [
      this.fetchYouTubeTrending(category),
      this.fetchPeerTubeTrending(category),
    ];

    // Add platform-specific fetchers
    if (!opts.platforms || opts.platforms.includes('rumble')) {
      fetchers.push(fetchRumbleTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('odysee')) {
      fetchers.push(fetchOdyseeTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('dtube')) {
      fetchers.push(fetchDTubeTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('bitchute')) {
      fetchers.push(fetchBitchuteTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('dailymotion')) {
      fetchers.push(fetchDailymotionTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('vimeo')) {
      fetchers.push(fetchVimeoTrending(category));
    }
    if (!opts.platforms || opts.platforms.includes('twitch')) {
      fetchers.push(fetchTwitchTrending(category));
    }
    // ── New sources: Lens, Bluesky, NIP-71, Zora Video NFTs ────────────
    if (!opts.platforms || opts.platforms.includes('lens')) {
      fetchers.push(fetchLensTrendingVideos(category));
    }
    if (!opts.platforms || opts.platforms.includes('bluesky')) {
      fetchers.push(fetchBlueskyVideoFeed());
    }
    if (!opts.platforms || opts.platforms.includes('nip71') || opts.platforms.includes('nostr')) {
      const relayUrls = (this.env.RELAY_URLS ?? '').split(',').filter(Boolean);
      fetchers.push(fetchNip71Videos(relayUrls, 20));
    }
    if (!opts.platforms || opts.platforms.includes('ipfs')) {
      fetchers.push(fetchIPFSTrending(category, 10));
    }
    if (!opts.platforms || opts.platforms.includes('arweave')) {
      fetchers.push(fetchArweaveTrending(category, 10));
    }
    if (!opts.platforms || opts.platforms.includes('zora')) {
      fetchers.push(
        fetchZoraTrendingVideos(this.env, { limit: 20, chain: 'BASE' }).then((tokens) =>
          tokens.map(
            (t): UnifiedVideo => ({
              id: `zora-video:${t.contractAddress}:${t.tokenId}`,
              title: t.name,
              description: t.description,
              thumbnail: t.imageUrl ?? '',
              url: t.videoUrl ?? t.imageUrl ?? '',
              duration: 0,
              platform: 'zora' as const,
              platformLabel: 'Zora',
              platformColor: '#0052FF',
              creatorName: t.collectionName,
              creatorId: t.creator,
              creatorAvatar: '',
              creatorUrl: t.zoraUrl,
              viewCount: 0,
              likeCount: 0,
              publishedAt: t.createdAt,
              publishedMs: new Date(t.createdAt).getTime(),
              category: 'art',
              tags: ['nft', 'zora', 'video'],
              isShort: true,
              isLive: false,
              qualityScore: 40,
            }),
          ),
        ),
      );
    }

    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    const merged = this.mergeAndRank(allVideos, { ...opts, sort: 'trending' });

    await setCachedJson(this.env, cacheKey(cacheSuffix), merged);
    return merged;
  }

  // ── Get personalized video feed (creators user follows) ───────────────

  async getPersonalizedFeed(
    wallet: string,
    opts: VideoAggregatorOptions = {},
  ): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cacheSuffix = `feed:${wallet.toLowerCase()}:${limit}`;

    const cached = await getCachedJson<UnifiedVideo[]>(this.env, cacheKey(cacheSuffix));
    if (cached) return cached;

    // Get the creator IDs this wallet follows from KV
    const followRaw = await this.env.CACHE?.get(`follow:${wallet.toLowerCase()}`);
    const followedCreators: string[] = followRaw ? (JSON.parse(followRaw) as string[]) : [];

    // If user follows no creators, return trending
    if (followedCreators.length === 0) {
      const trending = await this.getTrendingVideos('all', opts);
      await setCachedJson(this.env, cacheKey(cacheSuffix), trending);
      return trending;
    }

    // Fetch videos from all followed creators in parallel
    const fetchers = followedCreators
      .slice(0, 10)
      .map((creatorId) => this.getCreatorVideos(creatorId, { limit: 5 }));

    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    const merged = this.mergeAndRank(allVideos, opts);

    await setCachedJson(this.env, cacheKey(cacheSuffix), merged);
    return merged;
  }

  // ── Search across all video platforms ─────────────────────────────────

  async searchVideos(query: string, opts: VideoAggregatorOptions = {}): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cacheSuffix = `search:${query
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 60)}:${limit}`;

    const cached = await getCachedJson<UnifiedVideo[]>(this.env, cacheKey(cacheSuffix));
    if (cached) return cached;

    const fetchers: Promise<UnifiedVideo[]>[] = [
      this.searchYouTube(query),
      this.searchPeerTube(query),
    ];

    // Add platform searches based on opts.platforms filter
    if (!opts.platforms || opts.platforms.includes('rumble')) {
      fetchers.push(searchRumble(query));
    }
    if (!opts.platforms || opts.platforms.includes('odysee')) {
      fetchers.push(searchOdysee(query));
    }
    if (!opts.platforms || opts.platforms.includes('dtube')) {
      fetchers.push(searchDTube(query));
    }
    if (!opts.platforms || opts.platforms.includes('bitchute')) {
      fetchers.push(searchBitchute(query));
    }
    if (!opts.platforms || opts.platforms.includes('dailymotion')) {
      fetchers.push(searchDailymotion(query));
    }
    if (!opts.platforms || opts.platforms.includes('vimeo')) {
      fetchers.push(searchVimeo(query));
    }
    if (!opts.platforms || opts.platforms.includes('twitch')) {
      fetchers.push(searchTwitch(query));
    }

    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    const merged = this.mergeAndRank(allVideos, opts);

    await setCachedJson(this.env, cacheKey(cacheSuffix), merged);
    return merged;
  }

  // ── YouTube Fetcher (via Invidious) ─────────────────────────────────

  async fetchYouTubeChannelVideos(channelId: string, limit: number = 10): Promise<UnifiedVideo[]> {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const url = `${instance}/api/v1/channels/${channelId}/videos?sort=newest`;
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          videos: Array<{
            videoId: string;
            title: string;
            description: string;
            lengthSeconds: number;
            viewCount: number;
            published: number;
            author: string;
            authorId: string;
            authorUrl: string;
            videoThumbnails: Array<{
              url: string;
              quality: string;
              width: number;
              height: number;
            }>;
            liveNow: boolean;
          }>;
        };

        const videos = data.videos ?? [];
        return videos.slice(0, limit).map((v) => {
          const thumb =
            v.videoThumbnails?.find((t) => t.quality === 'maxres')?.url ??
            v.videoThumbnails?.find((t) => t.quality === 'medium')?.url ??
            `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`;

          return {
            id: `youtube:${v.videoId}`,
            title: v.title,
            description: v.description ?? '',
            thumbnail: thumb,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: v.lengthSeconds ?? 0,
            platform: 'youtube' as VideoPlatform,
            platformLabel: 'YouTube',
            platformColor: '#FF0000',
            creatorName: v.author,
            creatorId: v.authorId,
            creatorAvatar: `https://img.youtube.com/vi/${v.videoId}/0.jpg`,
            creatorUrl: v.authorUrl ?? `https://www.youtube.com/channel/${v.authorId}`,
            viewCount: v.viewCount ?? 0,
            likeCount: 0,
            publishedAt: new Date(v.published * 1000).toISOString(),
            publishedMs: v.published * 1000,
            category: this.inferCategory(v.title, v.description),
            tags: [],
            isShort: (v.lengthSeconds ?? 0) <= 60,
            isLive: v.liveNow ?? false,
            qualityScore: this.computeScore(v.viewCount ?? 0, v.published * 1000),
          };
        });
      } catch {}
    }
    return [];
  }

  async fetchYouTubeTrending(category: string): Promise<UnifiedVideo[]> {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const trendingUrl = `${instance}/api/v1/trending?type=`;
        const typeMap: Record<string, string> = {
          gaming: 'gaming',
          music: 'music',
          news: 'news',
          sports: 'sports',
          education: 'education',
        };
        const type = typeMap[category] ?? '';
        const url = type ? `${trendingUrl}${type}` : `${instance}/api/v1/trending`;
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;

        const data = (await res.json()) as Array<{
          videoId: string;
          title: string;
          description: string;
          lengthSeconds: number;
          viewCount: number;
          published: number;
          author: string;
          authorId: string;
          authorUrl: string;
          videoThumbnails: Array<{ url: string; quality: string }>;
          liveNow: boolean;
        }>;

        return (data ?? []).slice(0, 20).map((v) => {
          const thumb =
            v.videoThumbnails?.find((t) => t.quality === 'maxres')?.url ??
            v.videoThumbnails?.find((t) => t.quality === 'medium')?.url ??
            `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`;

          return {
            id: `youtube:${v.videoId}`,
            title: v.title,
            description: v.description ?? '',
            thumbnail: thumb,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: v.lengthSeconds ?? 0,
            platform: 'youtube' as VideoPlatform,
            platformLabel: 'YouTube',
            platformColor: '#FF0000',
            creatorName: v.author,
            creatorId: v.authorId,
            creatorAvatar: '',
            creatorUrl: v.authorUrl ?? `https://www.youtube.com/channel/${v.authorId}`,
            viewCount: v.viewCount ?? 0,
            likeCount: 0,
            publishedAt: new Date(v.published * 1000).toISOString(),
            publishedMs: v.published * 1000,
            category: this.inferCategory(v.title, v.description),
            tags: [],
            isShort: (v.lengthSeconds ?? 0) <= 60,
            isLive: v.liveNow ?? false,
            qualityScore: this.computeScore(v.viewCount ?? 0, v.published * 1000),
          };
        });
      } catch {}
    }
    return [];
  }

  async searchYouTube(query: string): Promise<UnifiedVideo[]> {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) continue;

        const data = (await res.json()) as Array<{
          videoId: string;
          title: string;
          description: string;
          lengthSeconds: number;
          viewCount: number;
          published: number;
          author: string;
          authorId: string;
          authorUrl: string;
          videoThumbnails: Array<{ url: string; quality: string }>;
          liveNow: boolean;
        }>;

        return (data ?? []).slice(0, 10).map((v) => ({
          id: `youtube:${v.videoId}`,
          title: v.title,
          description: v.description ?? '',
          thumbnail:
            v.videoThumbnails?.find((t) => t.quality === 'maxres')?.url ??
            v.videoThumbnails?.find((t) => t.quality === 'medium')?.url ??
            `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          duration: v.lengthSeconds ?? 0,
          platform: 'youtube' as VideoPlatform,
          platformLabel: 'YouTube',
          platformColor: '#FF0000',
          creatorName: v.author,
          creatorId: v.authorId,
          creatorAvatar: '',
          creatorUrl: v.authorUrl ?? `https://www.youtube.com/channel/${v.authorId}`,
          viewCount: v.viewCount ?? 0,
          likeCount: 0,
          publishedAt: new Date(v.published * 1000).toISOString(),
          publishedMs: v.published * 1000,
          category: this.inferCategory(v.title, v.description),
          tags: [],
          isShort: (v.lengthSeconds ?? 0) <= 60,
          isLive: v.liveNow ?? false,
          qualityScore: this.computeScore(v.viewCount ?? 0, v.published * 1000),
        }));
      } catch {}
    }
    return [];
  }

  // ── PeerTube Fetcher ──────────────────────────────────────────────────

  async fetchPeerTubeCreatorVideos(creatorId: string, limit: number = 10): Promise<UnifiedVideo[]> {
    try {
      // Search for videos from this creator
      const name = creatorId.replace(/^@/, '').toLowerCase();
      const searchUrl = `${PEERTUBE_INSTANCE}/api/v1/search/videos?search=${encodeURIComponent(name)}&sort=-publishedAt&count=${limit}&nsfw=false`;
      const res = await fetch(searchUrl, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data: Array<{
          uuid: string;
          name: string;
          description?: string;
          duration: number;
          views: number;
          likes: number;
          publishedAt: string;
          thumbnailPath?: string;
          account: {
            id: number;
            name: string;
            displayName: string;
            url: string;
            avatar?: { path: string };
          };
          channel: {
            id: number;
            name: string;
            displayName: string;
            url: string;
            avatar?: { path: string };
          };
          tags?: string[];
        }>;
      };

      return (data.data ?? []).map((v) => {
        const author = v.account ?? v.channel;
        const avatar = author?.avatar?.path ? `${PEERTUBE_INSTANCE}${author.avatar.path}` : '';

        return {
          id: `peertube:${v.uuid}`,
          title: v.name,
          description: v.description ?? '',
          thumbnail: v.thumbnailPath
            ? `${PEERTUBE_INSTANCE}${v.thumbnailPath}`
            : `${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`,
          url: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
          duration: v.duration,
          platform: 'peertube' as VideoPlatform,
          platformLabel: 'PeerTube',
          platformColor: '#F1680D',
          creatorName: author?.displayName ?? author?.name ?? 'Unknown',
          creatorId: `peertube:${author?.id ?? v.uuid}`,
          creatorAvatar: avatar,
          creatorUrl: author?.url ?? `${PEERTUBE_INSTANCE}/accounts/${author?.name}`,
          viewCount: v.views ?? 0,
          likeCount: v.likes ?? 0,
          publishedAt: v.publishedAt,
          publishedMs: Date.parse(v.publishedAt),
          category: this.inferCategory(v.name, v.description ?? ''),
          tags: v.tags ?? [],
          isShort: v.duration <= 90,
          isLive: false,
          qualityScore: this.computeScore(v.views ?? 0, Date.parse(v.publishedAt)),
        };
      });
    } catch {
      return [];
    }
  }

  async fetchPeerTubeTrending(category: string): Promise<UnifiedVideo[]> {
    try {
      let url = `${PEERTUBE_INSTANCE}/api/v1/videos?sort=-trending&count=20&nsfw=false`;

      // Map category to PeerTube category ID
      const categoryMap: Record<string, number> = {
        gaming: 4,
        music: 2,
        news: 1,
        sports: 5,
        education: 3,
        entertainment: 8,
        tech: 12,
        crypto: 13,
      };
      const catId = categoryMap[category];
      if (catId) {
        url += `&categoryOneOf=${catId}`;
      }

      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data: Array<{
          uuid: string;
          name: string;
          description?: string;
          duration: number;
          views: number;
          likes: number;
          publishedAt: string;
          thumbnailPath?: string;
          account: {
            id: number;
            name: string;
            displayName: string;
            url: string;
          };
          channel: {
            id: number;
            name: string;
            displayName: string;
            url: string;
            avatar?: { path: string };
          };
          tags?: string[];
        }>;
      };

      return (data.data ?? []).map((v) => {
        const channel = v.channel;
        const avatar = channel?.avatar?.path ? `${PEERTUBE_INSTANCE}${channel.avatar.path}` : '';

        return {
          id: `peertube:${v.uuid}`,
          title: v.name,
          description: v.description ?? '',
          thumbnail: v.thumbnailPath
            ? `${PEERTUBE_INSTANCE}${v.thumbnailPath}`
            : `${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`,
          url: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
          duration: v.duration,
          platform: 'peertube' as VideoPlatform,
          platformLabel: 'PeerTube',
          platformColor: '#F1680D',
          creatorName: channel?.displayName ?? channel?.name ?? 'Unknown',
          creatorId: `peertube:${channel?.id ?? v.uuid}`,
          creatorAvatar: avatar,
          creatorUrl: channel?.url ?? `${PEERTUBE_INSTANCE}/accounts/${channel?.name}`,
          viewCount: v.views ?? 0,
          likeCount: v.likes ?? 0,
          publishedAt: v.publishedAt,
          publishedMs: Date.parse(v.publishedAt),
          category: this.inferCategory(v.name, v.description ?? ''),
          tags: v.tags ?? [],
          isShort: v.duration <= 90,
          isLive: false,
          qualityScore: this.computeScore(v.views ?? 0, Date.parse(v.publishedAt)),
        };
      });
    } catch {
      return [];
    }
  }

  async searchPeerTube(query: string): Promise<UnifiedVideo[]> {
    try {
      const url = `${PEERTUBE_INSTANCE}/api/v1/search/videos?search=${encodeURIComponent(query)}&sort=-publishedAt&count=10&nsfw=false`;
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data: Array<{
          uuid: string;
          name: string;
          description?: string;
          duration: number;
          views: number;
          likes: number;
          publishedAt: string;
          thumbnailPath?: string;
          account: {
            id: number;
            name: string;
            displayName: string;
            url: string;
          };
          channel: {
            id: number;
            name: string;
            displayName: string;
            url: string;
            avatar?: { path: string };
          };
          tags?: string[];
        }>;
      };

      return (data.data ?? []).map((v) => {
        const channel = v.channel;
        const avatar = channel?.avatar?.path ? `${PEERTUBE_INSTANCE}${channel.avatar.path}` : '';

        return {
          id: `peertube:${v.uuid}`,
          title: v.name,
          description: v.description ?? '',
          thumbnail: v.thumbnailPath
            ? `${PEERTUBE_INSTANCE}${v.thumbnailPath}`
            : `${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`,
          url: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
          duration: v.duration,
          platform: 'peertube' as VideoPlatform,
          platformLabel: 'PeerTube',
          platformColor: '#F1680D',
          creatorName: channel?.displayName ?? channel?.name ?? 'Unknown',
          creatorId: `peertube:${channel?.id ?? v.uuid}`,
          creatorAvatar: avatar,
          creatorUrl: channel?.url ?? `${PEERTUBE_INSTANCE}/accounts/${channel?.name}`,
          viewCount: v.views ?? 0,
          likeCount: v.likes ?? 0,
          publishedAt: v.publishedAt,
          publishedMs: Date.parse(v.publishedAt),
          category: this.inferCategory(v.name, v.description ?? ''),
          tags: v.tags ?? [],
          isShort: v.duration <= 90,
          isLive: false,
          qualityScore: this.computeScore(v.views ?? 0, Date.parse(v.publishedAt)),
        };
      });
    } catch {
      return [];
    }
  }

  // ── Twitch Fetcher ────────────────────────────────────────────────────

  async fetchTwitchChannelVideos(
    channelName: string,
    _limit: number = 10,
  ): Promise<UnifiedVideo[]> {
    try {
      // Use ivr.fi API for public Twitch data
      const url = `https://api.ivr.fi/twitch/resolve/${channelName}`;
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
      });
      if (!res.ok) return [];

      const channel = (await res.json()) as {
        id: string;
        login: string;
        displayName: string;
        description?: string;
        avatar?: string;
        banner?: string;
      };

      // Twitch doesn't have a fully public videos API,
      // so we return a placeholder with live status
      const videos: UnifiedVideo[] = [];

      // Check if channel is live (use a simple public endpoint)
      try {
        const liveUrl = `https://api.ivr.fi/twitch/live/${channelName}`;
        const liveRes = await fetch(liveUrl);
        if (liveRes.ok) {
          const liveData = (await liveRes.json()) as {
            live: boolean;
            title?: string;
            game?: string;
            viewers?: number;
            thumbnail?: string;
          };
          if (liveData.live) {
            videos.push({
              id: `twitch:live:${channelName}:${Date.now()}`,
              title: liveData.title ?? `${channel.displayName} is live!`,
              description: `Live on Twitch — ${liveData.game ?? ''}`,
              thumbnail:
                liveData.thumbnail ??
                channel.avatar ??
                `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelName}-440x248.jpg`,
              url: `https://twitch.tv/${channelName}`,
              duration: 0,
              platform: 'twitch',
              platformLabel: 'Twitch',
              platformColor: '#9146FF',
              creatorName: channel.displayName ?? channelName,
              creatorId: channel.id ?? channelName,
              creatorAvatar: channel.avatar ?? '',
              creatorUrl: `https://twitch.tv/${channelName}`,
              viewCount: liveData.viewers ?? 0,
              likeCount: 0,
              publishedAt: new Date().toISOString(),
              publishedMs: Date.now(),
              category: this.inferCategory(liveData.title ?? '', liveData.game ?? ''),
              tags: [],
              isShort: false,
              isLive: true,
              qualityScore: 50,
            });
          }
        }
      } catch {
        // Live check failed
      }

      return videos;
    } catch {
      return [];
    }
  }

  // ── Rumble Fetcher ────────────────────────────────────────────────────

  async fetchRumbleTrending(_category: string): Promise<UnifiedVideo[]> {
    try {
      const url = 'https://rumble.com/feed.rss';
      const res = await fetch(url, {
        headers: { accept: 'application/rss+xml, application/xml' },
      });
      if (!res.ok) return [];

      const xml = await res.text();
      return this.parseRumbleRss(xml);
    } catch {
      return [];
    }
  }

  private parseRumbleRss(xml: string): UnifiedVideo[] {
    const videos: UnifiedVideo[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match = itemRegex.exec(xml);

    while (match !== null) {
      const block = match[1];
      if (block) {
        const title = this.extractXmlTag(block, 'title');
        const link = this.extractXmlTag(block, 'link');
        const pubDate = this.extractXmlTag(block, 'pubDate');
        const description = this.extractXmlTag(block, 'description');
        const thumbnail = this.extractXmlAttr(block, 'media:thumbnail', 'url');
        const channelName = this.extractXmlTag(block, 'channel') || 'Rumble Creator';
        const duration = Number.parseInt(this.extractXmlTag(block, 'media:duration') || '0', 10);

        if (title && link) {
          const publishedMs = Date.parse(pubDate);
          videos.push({
            id: `rumble:${globalThis.btoa?.(link)?.slice(0, 16) ?? link.slice(0, 16)}`,
            title: this.decodeXml(title),
            description: this.decodeXml(description),
            thumbnail: thumbnail || `https://placehold.co/640x360/85C742/FFFFFF?text=Rumble`,
            url: link,
            duration,
            platform: 'rumble',
            platformLabel: 'Rumble',
            platformColor: '#85C742',
            creatorName: this.decodeXml(channelName),
            creatorId: `rumble:${channelName}`,
            creatorAvatar: '',
            creatorUrl: `https://rumble.com/c/${channelName}`,
            viewCount: 0,
            likeCount: 0,
            publishedAt: new Date(publishedMs).toISOString(),
            publishedMs: Number.isNaN(publishedMs) ? Date.now() : publishedMs,
            category: 'entertainment',
            tags: [],
            isShort: duration > 0 && duration <= 60,
            isLive: false,
            qualityScore: 30,
          });
        }
      }
      match = itemRegex.exec(xml);
    }

    return videos;
  }

  // ── Odysee Fetcher ────────────────────────────────────────────────────

  async fetchOdyseeTrending(_category: string): Promise<UnifiedVideo[]> {
    try {
      const url = 'https://odysee.com/$/api/trending';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content_types: ['video'],
          page_size: 20,
        }),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data?: Array<{
          claimId: string;
          name: string;
          title: string;
          description?: string;
          thumbnail?: { url: string };
          signing_channel?: {
            name: string;
            claimId: string;
            thumbnail?: { url: string };
          };
          release_time: string;
          duration: number;
        }>;
      };

      return (data.data ?? []).map((v) => ({
        id: `odysee:${v.claimId}`,
        title: v.title || v.name,
        description: v.description ?? '',
        thumbnail: v.thumbnail?.url ?? `https://placehold.co/640x360/FF6A00/FFFFFF?text=Odysee`,
        url: `https://odysee.com/${v.name}:${v.claimId}`,
        duration: v.duration ?? 0,
        platform: 'odysee' as VideoPlatform,
        platformLabel: 'Odysee',
        platformColor: '#FF6A00',
        creatorName: v.signing_channel?.name ?? 'Odysee Creator',
        creatorId: `odysee:${v.signing_channel?.claimId ?? v.claimId}`,
        creatorAvatar: v.signing_channel?.thumbnail?.url ?? '',
        creatorUrl: v.signing_channel
          ? `https://odysee.com/@${v.signing_channel.name}:${v.signing_channel.claimId}`
          : `https://odysee.com/${v.name}`,
        viewCount: 0,
        likeCount: 0,
        publishedAt: new Date(Number(v.release_time) * 1000).toISOString(),
        publishedMs: Number(v.release_time) * 1000,
        category: this.inferCategory(v.title || v.name, v.description ?? ''),
        tags: [],
        isShort: (v.duration ?? 0) > 0 && v.duration <= 90,
        isLive: false,
        qualityScore: 30,
      }));
    } catch {
      return [];
    }
  }

  // ── Zora Fetcher ──────────────────────────────────────────────────────

  async fetchZoraCreatorVideos(
    creatorAddress: string,
    _limit: number = 10,
  ): Promise<UnifiedVideo[]> {
    try {
      // Query Zora API for creator's NFT media
      const zoraApi = 'https://api.zora.co/graphql';
      const query = `
				query {
				  tokens(
					where: {collectionAddresses: null}
					filter: {ownerAddresses: ["${creatorAddress}"]}
					networks: {network: ETHEREUM, chain: BASE}
					pagination: {limit: 10}
					sort: {sortKey: CREATED, sortDirection: DESC}
				  ) {
					nodes {
					  token {
						metadata {
						  name
						  description
						  image
						  content {
							media {
							  url
							  mimeType
							}
						  }
						  animationUrl
						}
						tokenUrl
					  }
					  collection {
						name
					  }
					}
				  }
				}
			`;

      const res = await fetch(zoraApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        data?: {
          tokens?: {
            nodes: Array<{
              token: {
                metadata: {
                  name: string;
                  description?: string;
                  image?: string;
                  content?: { media?: { url: string; mimeType: string } };
                  animationUrl?: string;
                };
                tokenUrl?: string;
              };
              collection?: { name: string };
            }>;
          };
        };
      };

      const nodes = data?.data?.tokens?.nodes ?? [];
      return nodes
        .filter((n) => {
          const media = n.token.metadata.content?.media;
          return media?.mimeType?.startsWith('video/') || n.token.metadata.animationUrl;
        })
        .map((n) => {
          const videoUrl =
            n.token.metadata.content?.media?.url ?? n.token.metadata.animationUrl ?? '';
          return {
            id: `zora:${n.token.tokenUrl ?? 'unknown'}`,
            title: n.token.metadata.name,
            description: n.token.metadata.description ?? '',
            thumbnail: n.token.metadata.image ?? '',
            url: videoUrl,
            duration: 0,
            platform: 'zora' as VideoPlatform,
            platformLabel: 'Zora',
            platformColor: '#0052FF',
            creatorName: n.collection?.name ?? 'Zora Creator',
            creatorId: creatorAddress,
            creatorAvatar: '',
            creatorUrl: `https://zora.co/${creatorAddress}`,
            viewCount: 0,
            likeCount: 0,
            publishedAt: new Date().toISOString(),
            publishedMs: Date.now(),
            category: 'art',
            tags: ['nft', 'zora', 'digital-art'],
            isShort: true,
            isLive: false,
            qualityScore: 40,
          };
        });
    } catch {
      return [];
    }
  }

  // ── Merge, deduplicate, rank, and paginate ────────────────────────────

  mergeAndRank(videos: UnifiedVideo[], opts: VideoAggregatorOptions): UnifiedVideo[] {
    const {
      limit = 20,
      sort = 'recent',
      minViews = 0,
      maxAgeDays = 30,
      platforms,
      categories,
    } = opts;

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique: UnifiedVideo[] = [];

    for (const video of videos) {
      const key = video.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Filter by platform
      if (platforms && platforms.length > 0 && !platforms.includes(video.platform)) continue;

      // Filter by category
      if (categories && categories.length > 0 && !categories.includes(video.category)) continue;

      // Filter by min views
      if (video.viewCount < minViews) continue;

      // Filter by max age
      if (maxAgeDays > 0) {
        const ageMs = Date.now() - video.publishedMs;
        const maxAgeMs = maxAgeDays * 86400000;
        if (ageMs > maxAgeMs) continue;
      }

      unique.push(video);
    }

    // Rank by sort order
    if (sort === 'recent') {
      unique.sort((a, b) => b.publishedMs - a.publishedMs);
    } else if (sort === 'trending') {
      unique.sort((a, b) => {
        // Trending = views per hour, recency-weighted
        const ageA = Math.max(1, (Date.now() - a.publishedMs) / 3600000);
        const ageB = Math.max(1, (Date.now() - b.publishedMs) / 3600000);
        const scoreA = a.viewCount / ageA + a.qualityScore;
        const scoreB = b.viewCount / ageB + b.qualityScore;
        return scoreB - scoreA;
      });
    } else if (sort === 'popular') {
      unique.sort((a, b) => b.viewCount - a.viewCount);
    }

    return unique.slice(0, limit);
  }

  // ── Build full aggregated feed with breakdown ─────────────────────────

  async buildFeed(
    videos: UnifiedVideo[],
    opts: VideoAggregatorOptions = {},
  ): Promise<AggregatedFeed> {
    const { offset = 0 } = opts;
    const sourceBreakdown: Record<string, number> = {};

    for (const v of videos) {
      sourceBreakdown[v.platform] = (sourceBreakdown[v.platform] ?? 0) + 1;
    }

    return {
      videos: videos.slice(offset, offset + (opts.limit ?? 20)),
      total: videos.length,
      hasMore: offset + (opts.limit ?? 20) < videos.length,
      sourceBreakdown,
      fetchedAt: Date.now(),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private computeScore(views: number, publishedMs: number): number {
    const ageHours = Math.max(1, (Date.now() - publishedMs) / 3600000);
    const viewsPerHour = views / ageHours;
    return Math.min(viewsPerHour / 10, 100);
  }

  private inferCategory(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();

    const categoryMap: Array<[string, string]> = [
      ['crypto', 'crypto'],
      ['bitcoin', 'crypto'],
      ['ethereum', 'crypto'],
      ['defi', 'crypto'],
      ['blockchain', 'crypto'],
      ['nft', 'crypto'],
      ['trading', 'crypto'],
      ['gaming', 'gaming'],
      ['gameplay', 'gaming'],
      ['esports', 'gaming'],
      ['music', 'music'],
      ['song', 'music'],
      ['album', 'music'],
      ['news', 'news'],
      ['politics', 'news'],
      ['breaking', 'news'],
      ['sport', 'sports'],
      ['football', 'sports'],
      ['basketball', 'sports'],
      ['soccer', 'sports'],
      ['tech', 'tech'],
      ['programming', 'tech'],
      ['software', 'tech'],
      ['ai', 'tech'],
      ['tutorial', 'education'],
      ['learn', 'education'],
      ['course', 'education'],
      ['science', 'science'],
      ['research', 'science'],
      ['comedy', 'comedy'],
      ['funny', 'comedy'],
      ['entertainment', 'entertainment'],
      ['talk', 'talk'],
      ['podcast', 'talk'],
      ['interview', 'talk'],
      ['art', 'art'],
      ['digital art', 'art'],
      ['design', 'art'],
      ['irl', 'irl'],
      ['vlog', 'irl'],
      ['lifestyle', 'irl'],
    ];

    for (const [keyword, cat] of categoryMap) {
      if (text.includes(keyword)) return cat;
    }

    return 'entertainment';
  }

  private extractXmlTag(xml: string, tag: string): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, 'i');
    const m = re.exec(xml);
    return m?.[1]?.trim() ?? '';
  }

  private extractXmlAttr(xml: string, tag: string, attr: string): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`<${escaped}[^>]*${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
    const m = re.exec(xml);
    return m?.[1] ?? '';
  }

  private decodeXml(str: string): string {
    return str
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
      .trim();
  }

  /**
   * Get source breakdown across all active platforms for display.
   */
  getPlatformInfo(platform: VideoPlatform): { label: string; color: string } {
    return {
      label: VIDEO_PLATFORM_LABELS[platform] ?? platform,
      color: VIDEO_PLATFORM_COLORS[platform] ?? '#666666',
    };
  }
}
