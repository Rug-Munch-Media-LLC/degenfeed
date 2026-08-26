/**
 * @degenfeed/api-worker — PeerTube Video Bridge
 *
 * Fetches video content from PeerTube (ActivityPub / federated).
 * Sources:
 *   - DegenFeed's PeerTube instance: https://video.degenfeed.xyz
 *   - SepiaSearch for cross-instance search
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator-types';

const PLATFORM: VideoPlatform = 'peertube';
const PLATFORM_LABEL = 'PeerTube';
const PLATFORM_COLOR = '#F1680D';

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PeerTubeVideo {
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
  category?: { id: number; label: string };
}

interface PeerTubeListResponse {
  data: PeerTubeVideo[];
  total: number;
}

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchPeerTubeChannelVideos(
  channelHandle: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    // Try to find the account first, then get their videos
    const name = channelHandle.replace(/^@/, '').toLowerCase();
    const searchUrl = `${PEERTUBE_INSTANCE}/api/v1/search/videos?search=${encodeURIComponent(name)}&sort=-publishedAt&count=${limit}&nsfw=false`;
    const res = await fetch(searchUrl, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as PeerTubeListResponse;
    return convertPeerTubeVideos(data.data ?? []);
  } catch {
    return [];
  }
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchPeerTubeTrending(
  category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    let url = `${PEERTUBE_INSTANCE}/api/v1/videos?sort=-trending&count=${limit}&nsfw=false`;

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

    const data = (await res.json()) as PeerTubeListResponse;
    return convertPeerTubeVideos(data.data ?? []);
  } catch {
    return [];
  }
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchPeerTube(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `${PEERTUBE_INSTANCE}/api/v1/search/videos?search=${encodeURIComponent(query)}&sort=-publishedAt&count=${limit}&nsfw=false`;
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as PeerTubeListResponse;
    return convertPeerTubeVideos(data.data ?? []);
  } catch {
    return [];
  }
}

// ─── Cross-instance search via SepiaSearch ────────────────────────────────

export async function searchPeerTubeFederated(
  query: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  const instances = [
    PEERTUBE_INSTANCE,
    'https://watch.talladega.social',
    'https://tilvids.com',
    'https://diode.zone',
    'https://peertube.tv',
    'https://video.blender.org',
  ];

  const fetchers = instances.map(async (instance) => {
    try {
      const url = `${instance}/api/v1/search/videos?search=${encodeURIComponent(query)}&sort=-publishedAt&count=${Math.ceil(limit / instances.length)}&nsfw=false`;
      const res = await fetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as PeerTubeListResponse;
      return convertPeerTubeVideos(data.data ?? [], instance);
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetchers);
  const allVideos: UnifiedVideo[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allVideos.push(...r.value);
  }

  // Sort by published date, most recent first
  allVideos.sort((a, b) => b.publishedMs - a.publishedMs);
  return allVideos.slice(0, limit);
}

// ─── Converter ─────────────────────────────────────────────────────────────

function convertPeerTubeVideos(
  videos: PeerTubeVideo[],
  instance: string = PEERTUBE_INSTANCE,
): UnifiedVideo[] {
  return videos.map((v) => {
    const author = v.account ?? v.channel;
    const avatar = author?.avatar?.path ? `${instance}${author.avatar.path}` : '';
    const title = v.name;
    const description = v.description ?? '';

    return {
      id: `peertube:${v.uuid}`,
      title,
      description,
      thumbnail: v.thumbnailPath
        ? `${instance}${v.thumbnailPath}`
        : `${instance}/static/thumbnails/${v.uuid}.jpg`,
      url: `${instance}/w/${v.uuid}`,
      duration: v.duration,
      platform: PLATFORM,
      platformLabel: PLATFORM_LABEL,
      platformColor: PLATFORM_COLOR,
      creatorName: author?.displayName ?? author?.name ?? 'Unknown',
      creatorId: `peertube:${author?.id ?? v.uuid}`,
      creatorAvatar: avatar,
      creatorUrl: author?.url ?? `${instance}/accounts/${author?.name}`,
      viewCount: v.views ?? 0,
      likeCount: v.likes ?? 0,
      publishedAt: v.publishedAt,
      publishedMs: Date.parse(v.publishedAt),
      category: inferCategory(title, description),
      tags: v.tags ?? [],
      isShort: v.duration <= 90,
      isLive: false,
      qualityScore: computeScore(v.views ?? 0, Date.parse(v.publishedAt)),
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeScore(views: number, publishedMs: number): number {
  const ageHours = Math.max(1, (Date.now() - publishedMs) / 3600000);
  const viewsPerHour = views / ageHours;
  return Math.min(viewsPerHour / 10, 100);
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const map: Array<[string, string]> = [
    ['gaming', 'gaming'],
    ['gameplay', 'gaming'],
    ['music', 'music'],
    ['news', 'news'],
    ['tech', 'tech'],
    ['programming', 'tech'],
    ['tutorial', 'education'],
    ['learn', 'education'],
    ['crypto', 'crypto'],
    ['bitcoin', 'crypto'],
    ['comedy', 'comedy'],
    ['funny', 'comedy'],
    ['sport', 'sports'],
  ];
  for (const [kw, cat] of map) {
    if (text.includes(kw)) return cat;
  }
  return 'entertainment';
}
