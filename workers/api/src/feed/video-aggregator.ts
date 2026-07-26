/**
 * @degenfeed/api-worker — VideoAggregator
 *
 * Intelligent cross-platform video aggregator.
 * "Follow creators, not platforms" — merges, deduplicates, ranks, paginates.
 *
 * Thin class — platform fetchers live in sibling modules.
 */

import { VIDEO_PLATFORM_COLORS, VIDEO_PLATFORM_LABELS } from '../lib/creator-resolver';
import { fetchZoraTrendingVideos } from '../lib/zora-deep';
import type { Env } from '../types';
import {
  fetchPeerTubeChannelVideos,
  fetchPeerTubeTrending,
  searchPeerTube,
} from './video-aggregator-peertube';
import type {
  AggregatedFeed,
  UnifiedVideo,
  VideoAggregatorOptions,
} from './video-aggregator-types';
import { cacheKey, getCachedJson, setCachedJson } from './video-aggregator-utils';
import { fetchYouTubeChannelVideos, fetchYouTubeTrending } from './video-aggregator-youtube';
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

export class VideoAggregator {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async getCreatorVideos(
    creatorId: string,
    opts: VideoAggregatorOptions = {},
  ): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cached = await getCachedJson<UnifiedVideo[]>(
      this.env,
      cacheKey(`creator:${creatorId.toLowerCase()}:${limit}`),
    );
    if (cached) return cached;

    const fetchers: Promise<UnifiedVideo[]>[] = [];

    if (/^UC[\w-]{22}$/.test(creatorId)) {
      fetchers.push(fetchYouTubeChannelVideos(this.env, creatorId));
    }
    if (/^[a-zA-Z][\w]{2,24}$/.test(creatorId) && !creatorId.startsWith('UC')) {
      fetchers.push(fetchTwitchChannelVideos(creatorId, 10));
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(creatorId)) {
      fetchers.push(fetchZoraCreatorVideos(creatorId));
    }

    fetchers.push(
      fetchPeerTubeChannelVideos(this.env, creatorId),
      fetchRumbleChannelVideos(creatorId),
      fetchOdyseeChannelVideos(creatorId),
      fetchDTubeChannelVideos(creatorId),
      fetchBitchuteChannelVideos(creatorId),
      fetchDailymotionChannelVideos(creatorId),
      fetchVimeoChannelVideos(creatorId),
    );

    const results = await Promise.allSettled(fetchers);
    const allVideos: UnifiedVideo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allVideos.push(...r.value);
    }

    const merged = this.mergeAndRank(allVideos, opts);
    await setCachedJson(this.env, cacheKey(`creator:${creatorId.toLowerCase()}:${limit}`), merged);
    return merged;
  }

  async getTrendingVideos(
    category: string,
    opts: VideoAggregatorOptions = {},
  ): Promise<UnifiedVideo[]> {
    const limit = opts.limit ?? 20;
    const cached = await getCachedJson<UnifiedVideo[]>(
      this.env,
      cacheKey(`trending:${category}:${limit}`),
    );
    if (cached) return cached;

    const fetchers: Promise<UnifiedVideo[]>[] = [
      fetchYouTubeTrending(this.env, category),
      fetchPeerTubeTrending(this.env, category),
    ];

    const pf = (name: string) => !opts.platforms || opts.platforms.includes(name);
    if (pf('rumble')) fetchers.push(fetchRumbleTrending(category));
    if (pf('odysee')) fetchers.push(fetchOdyseeTrending(category));
    if (pf('dtube')) fetchers.push(fetchDTubeTrending(category));
    if (pf('bitchute')) fetchers.push(fetchBitchuteTrending(category));
    if (pf('dailymotion')) fetchers.push(fetchDailymotionTrending(category));
    if (pf('vimeo')) fetchers.push(fetchVimeoTrending(category));
    if (pf('twitch')) fetchers.push(fetchTwitchTrending(category));
    if (pf('lens')) fetchers.push(fetchLensTrendingVideos(category));
    if (pf('bluesky')) fetchers.push(fetchBlueskyVideoFeed());
    if (pf('nip71') || pf('nostr')) {
      fetchers.push(fetchNip71Videos((this.env.RELAY_URLS ?? '').split(',').filter(Boolean), 20));
    }
    if (pf('ipfs')) fetchers.push(fetchIPFSTrending(category, 10));
    if (pf('arweave')) fetchers.push(fetchArweaveTrending(category, 10));
    if (pf('zora')) {
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
              platform: 'zora' as any,
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
              category,
              tags: ['nft', 'zora', 'digital-art'],
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

    const merged = this.mergeAndRank(allVideos, opts);
    await setCachedJson(this.env, cacheKey(`trending:${category}:${limit}`), merged);
    return merged;
  }

  async search(query: string, limit = 20): Promise<UnifiedVideo[]> {
    const fetchers = [
      searchPeerTube(this.env, query, limit),
      searchRumble(query, limit),
      searchOdysee(query, limit),
      searchDTube(query, limit),
      searchBitchute(query, limit),
      searchDailymotion(query, limit),
      searchVimeo(query, limit),
      searchTwitch(query, limit),
    ];
    const results = await Promise.allSettled(fetchers);
    const all: UnifiedVideo[] = [];
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);

    const seen = new Set<string>();
    return all
      .filter((v) => {
        const key = v.url.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  }

  mergeAndRank(videos: UnifiedVideo[], opts: VideoAggregatorOptions): UnifiedVideo[] {
    const {
      limit = 20,
      sort = 'recent',
      minViews = 0,
      maxAgeDays = 30,
      platforms,
      categories,
    } = opts;
    const seen = new Set<string>();
    const unique: UnifiedVideo[] = [];

    for (const video of videos) {
      const key = video.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (platforms?.length && !platforms.includes(video.platform)) continue;
      if (categories?.length && !categories.includes(video.category)) continue;
      if (video.viewCount < minViews) continue;
      if (maxAgeDays > 0) {
        if (Date.now() - video.publishedMs > maxAgeDays * 86400000) continue;
      }
      unique.push(video);
    }

    if (sort === 'recent') unique.sort((a, b) => b.publishedMs - a.publishedMs);
    else if (sort === 'trending') {
      unique.sort((a, b) => {
        const aRate =
          a.viewCount / Math.max(1, (Date.now() - a.publishedMs) / 3600000) + a.qualityScore;
        const bRate =
          b.viewCount / Math.max(1, (Date.now() - b.publishedMs) / 3600000) + b.qualityScore;
        return bRate - aRate;
      });
    } else if (sort === 'popular') unique.sort((a, b) => b.viewCount - a.viewCount);

    return unique.slice(0, limit);
  }

  async buildFeed(
    videos: UnifiedVideo[],
    opts: VideoAggregatorOptions = {},
  ): Promise<AggregatedFeed> {
    const { offset = 0 } = opts;
    const sourceBreakdown: Record<string, number> = {};
    for (const v of videos) sourceBreakdown[v.platform] = (sourceBreakdown[v.platform] ?? 0) + 1;
    return {
      videos: videos.slice(offset, offset + (opts.limit ?? 20)),
      total: videos.length,
      hasMore: offset + (opts.limit ?? 20) < videos.length,
      sourceBreakdown,
      fetchedAt: Date.now(),
    };
  }

  getPlatformInfo(platform: import('../lib/creator-resolver').VideoPlatform): {
    label: string;
    color: string;
  } {
    return {
      label: VIDEO_PLATFORM_LABELS[platform] ?? platform,
      color: VIDEO_PLATFORM_COLORS[platform] ?? '#666666',
    };
  }
}

// ─── Twitch Channel Videos (standalone, no class dependency) ───

async function fetchTwitchChannelVideos(channelName: string, _limit = 10): Promise<UnifiedVideo[]> {
  try {
    const res = await fetch(`https://api.ivr.fi/twitch/resolve/${channelName}`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
    });
    if (!res.ok) return [];
    const channel = (await res.json()) as {
      id: string;
      login: string;
      displayName: string;
      avatar?: string;
    };
    const videos: UnifiedVideo[] = [];
    try {
      const liveRes = await fetch(`https://api.ivr.fi/twitch/live/${channelName}`);
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
            platform: 'twitch' as any,
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
            category: liveData.game ?? 'Gaming',
            tags: ['twitch', 'live'],
            isShort: false,
            isLive: true,
            qualityScore: 60,
          });
        }
      }
    } catch {
      /* not live */
    }
    return videos;
  } catch {
    return [];
  }
}

// ─── Zora Creator Videos (standalone) ───

async function fetchZoraCreatorVideos(creatorAddress: string): Promise<UnifiedVideo[]> {
  try {
    const res = await fetch(`https://api.zora.co/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `{ tokens(where: {creatorAddresses: "${creatorAddress}"}) { nodes { token { tokenId name description image { url } } } } }`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { tokens?: { nodes?: Array<Record<string, unknown>> } };
    };
    return (data?.data?.tokens?.nodes ?? []).map((n: any) => ({
      id: `zora-video:${n.token?.tokenId}`,
      title: n.token?.name ?? '',
      description: n.token?.description ?? '',
      thumbnail: n.token?.image?.url ?? '',
      url: `https://zora.co/${creatorAddress}`,
      duration: 0,
      platform: 'zora' as any,
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
    }));
  } catch {
    return [];
  }
}
