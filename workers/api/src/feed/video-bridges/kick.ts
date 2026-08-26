/**
 * @degenfeed/api-worker — Kick Video Bridge
 *
 * Fetches video content from Kick via their public API.
 * Sources:
 *   - Channel API: https://kick.com/api/v2/channels/{channel}
 *   - Category API: https://kick.com/api/v2/categories/{slug}/videos
 *   - Search: https://kick.com/api/v2/search
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator-types';

const PLATFORM: VideoPlatform = 'kick';
const PLATFORM_LABEL = 'Kick';
const PLATFORM_COLOR = '#53FC18';

const KICK_API_BASE = 'https://kick.com/api/v2';

// ─── Types ─────────────────────────────────────────────────────────────

interface KickChannelResponse {
  id: number;
  user_id: number;
  slug: string;
  user: {
    id: number;
    username: string;
    slug: string;
    profile_pic?: string;
    bio?: string;
  };
  livestream?: KickLivestream | null;
  recent_videos?: KickVideo[];
}

interface KickLivestream {
  id: number;
  session_title: string;
  viewer_count: number;
  started_at: string;
  category?: { id: number; name: string; slug: string };
  thumbnail?: { url: string };
}

interface KickVideo {
  id: number;
  uuid: string;
  title: string;
  description?: string;
  duration: number;
  views: number;
  likes: number;
  created_at: string;
  thumbnail?: { url: string };
  category?: { id: number; name: string; slug: string };
  user: { id: number; username: string; slug: string; profile_pic?: string };
  video_url?: string;
}

interface KickSearchResponse {
  users: Array<{ id: number; username: string; slug: string; profile_pic?: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
}

// ─── Fetch channel videos ───────────────────────────────────────────────

export async function fetchKickChannelVideos(
  channelSlug: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const slug = channelSlug.replace(/^@/, '').toLowerCase();
    const url = `${KICK_API_BASE}/channels/${encodeURIComponent(slug)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DegenFeed/1.0' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as KickChannelResponse;
    const videos = data.recent_videos ?? [];

    return videos.slice(0, limit).map((v) => convertKickVideo(v, slug));
  } catch {
    return [];
  }
}

// ─── Fetch trending by category ─────────────────────────────────────────

export async function fetchKickTrending(
  category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    // Kick has some public category endpoints
    const catSlug = category || 'gaming';
    const url = `${KICK_API_BASE}/categories/${encodeURIComponent(catSlug)}/videos?page=1&per_page=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      // Fallback: get popular channels
      const fallback = await fetchKickPopularChannels(limit);
      return fallback;
    }

    const data = (await res.json()) as { data: KickVideo[] };
    return (data.data ?? []).slice(0, limit).map((v) => convertKickVideo(v, v.user?.slug ?? ''));
  } catch {
    return [];
  }
}

// ─── Search ─────────────────────────────────────────────────────────────

export async function searchKick(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `${KICK_API_BASE}/search?q=${encodeURIComponent(query)}&type=channels&page=1&per_page=5`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as KickSearchResponse;
    const videos: UnifiedVideo[] = [];

    // Try each found user's channel
    for (const user of (data.users ?? []).slice(0, 3)) {
      const channelVids = await fetchKickChannelVideos(user.slug, Math.ceil(limit / 3));
      videos.push(...channelVids);
    }

    return videos.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Fetch popular channels ─────────────────────────────────────────────

export async function fetchKickPopularChannels(limit: number = 20): Promise<UnifiedVideo[]> {
  try {
    // Uses the discover/live endpoint
    const url = `${KICK_API_BASE}/discover/live?page=1&per_page=${Math.min(limit, 25)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data: Array<{ livestream: KickLivestream; user: KickVideo['user'] }>;
    };
    return (data.data ?? []).map((d) => ({
      id: `kick-${d.livestream?.id ?? Date.now()}`,
      title: d.livestream?.session_title ?? 'Untitled Kick Stream',
      description: '',
      thumbnail: d.livestream?.thumbnail?.url ?? '',
      url: `https://kick.com/${d.user?.slug ?? ''}`,
      duration: 0,
      platform: PLATFORM,
      platformLabel: PLATFORM_LABEL,
      platformColor: PLATFORM_COLOR,
      creatorName: d.user?.username ?? 'Unknown',
      creatorId: `kick:${d.user?.slug ?? ''}`,
      creatorAvatar: d.user?.profile_pic ?? '',
      creatorUrl: `https://kick.com/${d.user?.slug ?? ''}`,
      viewCount: d.livestream?.viewer_count ?? 0,
      likeCount: 0,
      publishedAt: d.livestream?.started_at ?? new Date().toISOString(),
      category: d.livestream?.category?.name ?? 'gaming',
      tags: [],
      isLive: true,
      isShort: false,
      embedUrl: '',
    }));
  } catch {
    return [];
  }
}

// ─── Converter ───────────────────────────────────────────────────────────

function convertKickVideo(video: KickVideo, _channelSlug: string): UnifiedVideo {
  const duration = video.duration ?? 0;
  const publishedAt = video.created_at ?? new Date().toISOString();

  return {
    id: `kick-${video.uuid ?? video.id}`,
    title: video.title ?? 'Untitled',
    description: video.description ?? '',
    thumbnail: video.thumbnail?.url ?? '',
    url: video.video_url ?? `https://kick.com/video/${video.uuid ?? video.id}`,
    duration,
    platform: PLATFORM,
    platformLabel: PLATFORM_LABEL,
    platformColor: PLATFORM_COLOR,
    creatorName: video.user?.username ?? 'Unknown',
    creatorId: `kick:${video.user?.slug ?? ''}`,
    creatorAvatar: video.user?.profile_pic ?? '',
    creatorUrl: `https://kick.com/${video.user?.slug ?? ''}`,
    viewCount: video.views ?? 0,
    likeCount: video.likes ?? 0,
    publishedAt,
    category: video.category?.name ?? 'gaming',
    tags: [],
    isLive: false,
    isShort: duration < 60,
    embedUrl: '',
  };
}
