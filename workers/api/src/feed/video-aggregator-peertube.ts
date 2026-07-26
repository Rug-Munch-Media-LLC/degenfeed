/**
 * @degenfeed/api-worker — Video Aggregator PeerTube Fetchers
 */

import type { UnifiedVideo, VideoPlatform } from '../lib/creator-resolver';
import type { Env } from '../types';
import { PEERTUBE_INSTANCE } from './video-aggregator-types';
import { computeScore, inferCategory } from './video-aggregator-utils';

export async function fetchPeerTubeChannelVideos(
  _env: Env,
  channelId: string,
  limit = 10,
): Promise<UnifiedVideo[]> {
  try {
    const url = `${PEERTUBE_INSTANCE}/api/v1/videos?channelId=${encodeURIComponent(channelId)}&sort=-publishedAt&count=${limit}&nsfw=false`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<Record<string, unknown>> };
    return (data.data ?? []).slice(0, limit).map(mapPeerTubeVideo);
  } catch {
    return [];
  }
}

export async function fetchPeerTubeTrending(
  _env: Env,
  category: string,
  limit = 20,
): Promise<UnifiedVideo[]> {
  try {
    const catId = peertubeCategoryId(category);
    let url = `${PEERTUBE_INSTANCE}/api/v1/videos?sort=-trending&count=${limit}&nsfw=false`;
    if (catId) url += `&categoryOneOf=${catId}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<Record<string, unknown>> };
    return (data.data ?? []).map(mapPeerTubeVideo);
  } catch {
    return [];
  }
}

export async function searchPeerTube(
  _env: Env,
  query: string,
  limit = 10,
): Promise<UnifiedVideo[]> {
  try {
    const url = `${PEERTUBE_INSTANCE}/api/v1/search/videos?search=${encodeURIComponent(query)}&sort=-publishedAt&count=${limit}&nsfw=false`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<Record<string, unknown>> };
    return (data.data ?? []).map(mapPeerTubeVideo);
  } catch {
    return [];
  }
}

function mapPeerTubeVideo(v: Record<string, any>): UnifiedVideo {
  const channel = v.channel ?? v.account ?? {};
  const avatar = channel?.avatar?.path ? `${PEERTUBE_INSTANCE}${channel.avatar.path}` : '';
  return {
    id: `peertube:${v.uuid}`,
    title: v.name,
    description: v.description ?? '',
    thumbnail: v.thumbnailPath
      ? `${PEERTUBE_INSTANCE}${v.thumbnailPath}`
      : `${PEERTUBE_INSTANCE}/static/thumbnails/${v.uuid}.jpg`,
    url: `${PEERTUBE_INSTANCE}/w/${v.uuid}`,
    duration: v.duration ?? 0,
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
    category: inferCategory(v.name ?? '', v.description ?? ''),
    tags: v.tags ?? [],
    isShort: (v.duration ?? 0) <= 90,
    isLive: false,
    qualityScore: computeScore(v.views ?? 0, Date.parse(v.publishedAt)),
  };
}

function peertubeCategoryId(category: string): number | null {
  const map: Record<string, number> = {
    music: 1,
    films: 2,
    animation: 3,
    art: 4,
    gaming: 5,
    comedy: 6,
    'talk shows': 7,
    news: 8,
    tutorial: 9,
    science: 10,
    sports: 11,
    crypto: 12,
    tech: 13,
    education: 14,
    entertainment: 15,
  };
  return map[category.toLowerCase()] ?? null;
}
