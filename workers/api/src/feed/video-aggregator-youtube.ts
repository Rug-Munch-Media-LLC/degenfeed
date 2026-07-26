/**
 * @degenfeed/api-worker — Video Aggregator YouTube Fetchers
 */

import type { UnifiedVideo, VideoPlatform } from '../lib/creator-resolver';
import type { Env } from '../types';
import { INVIDIOUS_INSTANCES } from './video-aggregator-types';
import { computeScore, inferCategory } from './video-aggregator-utils';

export async function fetchYouTubeChannelVideos(
  env: Env,
  channelId: string,
  limit = 10,
): Promise<UnifiedVideo[]> {
  if (env.YOUTUBE_API_KEY) {
    return fetchYouTubeViaAPI(env, channelId, limit);
  }
  return fetchYouTubeViaInvidious(channelId, limit);
}

async function fetchYouTubeViaAPI(
  env: Env,
  channelId: string,
  limit: number,
): Promise<UnifiedVideo[]> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      maxResults: String(limit),
      order: 'date',
      type: 'video',
      key: env.YOUTUBE_API_KEY!,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
    return (data.items ?? []).map(mapYouTubeItem);
  } catch {
    return [];
  }
}

async function fetchYouTubeViaInvidious(channelId: string, limit: number): Promise<UnifiedVideo[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(
        `${instance}/api/v1/channels/${channelId}/videos?sort=newest&limit=${limit}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = (await res.json()) as { videos?: Array<Record<string, unknown>> };
        return (data.videos ?? []).slice(0, limit).map(mapInvidiousVideo);
      }
    } catch {}
  }
  return [];
}

export async function fetchYouTubeTrending(
  _env: Env,
  _category: string,
  limit = 20,
): Promise<UnifiedVideo[]> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/trending?type=video`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<Record<string, unknown>>;
        return data.slice(0, limit).map(mapInvidiousVideo);
      }
    } catch {}
  }
  return [];
}

function mapYouTubeItem(item: Record<string, any>): UnifiedVideo {
  const id = item.id?.videoId ?? item.id ?? '';
  const snippet = item.snippet ?? {};
  return {
    id: `youtube:${id}`,
    title: snippet.title ?? '',
    description: snippet.description ?? '',
    thumbnail: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.medium?.url ?? '',
    url: `https://youtube.com/watch?v=${id}`,
    duration: 0,
    platform: 'youtube' as VideoPlatform,
    platformLabel: 'YouTube',
    platformColor: '#FF0000',
    creatorName: snippet.channelTitle ?? '',
    creatorId: `youtube:channel:${snippet.channelId ?? ''}`,
    creatorAvatar: '',
    creatorUrl: `https://youtube.com/channel/${snippet.channelId ?? ''}`,
    viewCount: 0,
    likeCount: 0,
    publishedAt: snippet.publishedAt ?? new Date().toISOString(),
    publishedMs: snippet.publishedAt ? Date.parse(snippet.publishedAt) : Date.now(),
    category: inferCategory(snippet.title ?? '', snippet.description ?? ''),
    tags: [],
    isShort: false,
    isLive: snippet.liveBroadcastContent === 'live',
    qualityScore: 50,
  };
}

function mapInvidiousVideo(v: Record<string, any>): UnifiedVideo {
  return {
    id: `youtube:${v.videoId}`,
    title: v.title ?? '',
    description: v.description ?? '',
    thumbnail: v.videoThumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    url: `https://youtube.com/watch?v=${v.videoId}`,
    duration: v.lengthSeconds ?? 0,
    platform: 'youtube' as VideoPlatform,
    platformLabel: 'YouTube',
    platformColor: '#FF0000',
    creatorName: v.author ?? '',
    creatorId: `youtube:channel:${v.authorId ?? ''}`,
    creatorAvatar: v.authorThumbnails?.[0]?.url ?? '',
    creatorUrl: `https://youtube.com/channel/${v.authorId ?? ''}`,
    viewCount: v.viewCount ?? 0,
    likeCount: v.likeCount ?? 0,
    publishedAt: v.publishedText ?? new Date().toISOString(),
    publishedMs: v.published ?? Date.now(),
    category: inferCategory(v.title ?? '', ''),
    tags: [],
    isShort: (v.lengthSeconds ?? 0) <= 90,
    isLive: v.liveNow ?? false,
    qualityScore: computeScore(v.viewCount ?? 0, v.published ? v.published * 1000 : Date.now()),
  };
}
