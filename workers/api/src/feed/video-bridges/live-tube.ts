/**
 * @degenfeed/api-worker — LiveTube Video Bridge
 *
 * LiveTube is a decentralized live streaming platform built on blockchain.
 * This bridge fetches channels and streams via their public API.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'livetube';
const PLATFORM_LABEL = 'LiveTube';
const PLATFORM_COLOR = '#FF4500';

const LIVETUBE_API_BASE = 'https://api.livetube.com/v2';

// ─── Types ─────────────────────────────────────────────────────────────

interface LiveTubeChannel {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followersCount: number;
  isLive: boolean;
  livestream?: LiveTubeStream;
}

interface LiveTubeStream {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  viewerCount: number;
  startedAt: string;
  category?: string;
  tags?: string[];
  playbackUrl?: string;
}

interface LiveTubeVOD {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration: number;
  views: number;
  likes: number;
  createdAt: string;
  category?: string;
  tags?: string[];
  channelId: string;
  channelName: string;
  channelAvatar?: string;
  playbackUrl?: string;
}

// ─── Fetch channel videos ───────────────────────────────────────────────

export async function fetchLiveTubeChannelVideos(
  username: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const name = username.replace(/^@/, '').toLowerCase();
    const url = `${LIVETUBE_API_BASE}/channels/${encodeURIComponent(name)}/vods?limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed/1.0' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data: LiveTubeVOD[] };
    return (data.data ?? []).map((vod) => convertLiveTubeVOD(vod));
  } catch {
    return [];
  }
}

// ─── Fetch trending ─────────────────────────────────────────────────────

export async function fetchLiveTubeTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    // Fetch live streams and VODs
    const [liveRes, vodsRes] = await Promise.all([
      fetch(`${LIVETUBE_API_BASE}/streams/live?limit=${Math.ceil(limit / 2)}`, {
        headers: { Accept: 'application/json' },
      }),
      fetch(`${LIVETUBE_API_BASE}/vods/trending?limit=${Math.ceil(limit / 2)}`, {
        headers: { Accept: 'application/json' },
      }),
    ]);

    const videos: UnifiedVideo[] = [];

    if (liveRes.ok) {
      const liveData = (await liveRes.json()) as { data: LiveTubeStream[] };
      for (const s of liveData.data ?? []) {
        videos.push({
          id: `livetube-live-${s.id}`,
          title: s.title ?? 'Untitled Live Stream',
          description: s.description ?? '',
          thumbnail: s.thumbnailUrl ?? '',
          url: s.playbackUrl ?? `https://livetube.com/watch/${s.id}`,
          duration: 0,
          platform: PLATFORM,
          platformLabel: PLATFORM_LABEL,
          platformColor: PLATFORM_COLOR,
          creatorName: 'LiveTube Creator',
          creatorId: '',
          creatorAvatar: '',
          creatorUrl: '',
          viewCount: s.viewerCount ?? 0,
          likeCount: 0,
          publishedAt: s.startedAt ?? new Date().toISOString(),
          category: s.category ?? 'live',
          tags: s.tags ?? [],
          isLive: true,
          isShort: false,
          embedUrl: '',
        });
      }
    }

    if (vodsRes.ok) {
      const vodsData = (await vodsRes.json()) as { data: LiveTubeVOD[] };
      for (const vod of vodsData.data ?? []) {
        videos.push(convertLiveTubeVOD(vod));
      }
    }

    return videos.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Search ─────────────────────────────────────────────────────────────

export async function searchLiveTube(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `${LIVETUBE_API_BASE}/search?q=${encodeURIComponent(query)}&type=vods&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data: LiveTubeVOD[] };
    return (data.data ?? []).map((vod) => convertLiveTubeVOD(vod));
  } catch {
    return [];
  }
}

// ─── Converter ───────────────────────────────────────────────────────────

function convertLiveTubeVOD(vod: LiveTubeVOD): UnifiedVideo {
  return {
    id: `livetube-${vod.id}`,
    title: vod.title ?? 'Untitled',
    description: vod.description ?? '',
    thumbnail: vod.thumbnailUrl ?? '',
    url: vod.playbackUrl ?? `https://livetube.com/watch/${vod.id}`,
    duration: vod.duration ?? 0,
    platform: PLATFORM,
    platformLabel: PLATFORM_LABEL,
    platformColor: PLATFORM_COLOR,
    creatorName: vod.channelName ?? 'Unknown',
    creatorId: `livetube:${vod.channelId}`,
    creatorAvatar: vod.channelAvatar ?? '',
    creatorUrl: `https://livetube.com/${vod.channelName ?? vod.channelId}`,
    viewCount: vod.views ?? 0,
    likeCount: vod.likes ?? 0,
    publishedAt: vod.createdAt ?? new Date().toISOString(),
    category: vod.category ?? 'general',
    tags: vod.tags ?? [],
    isLive: false,
    isShort: (vod.duration ?? 0) < 60,
    embedUrl: '',
  };
}
