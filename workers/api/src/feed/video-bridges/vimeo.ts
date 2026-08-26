/**
 * @degenfeed/api-worker — Vimeo Video Bridge
 *
 * Fetches video content from Vimeo.
 * Sources:
 *   - Vimeo API (v3): https://api.vimeo.com
 *   - Note: Vimeo API requires an access token for most endpoints.
 *   - Uses public oEmbed as fallback when no token available.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator-types';

const PLATFORM: VideoPlatform = 'vimeo';
const PLATFORM_LABEL = 'Vimeo';
const PLATFORM_COLOR = '#1AB7EA';

const VIMEO_API = 'https://api.vimeo.com';
const VIMEO_OEMBED = 'https://vimeo.com/api/oembed.json';

// Vimeo API access token — set at module init or via env
let _vimeoToken: string | undefined;

export function setVimeoToken(token: string): void {
  _vimeoToken = token;
}

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchVimeoChannelVideos(
  channelName: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const name = channelName.replace(/^@/, '').toLowerCase();

    // Try API first (requires token), fall back to oEmbed
    const token = _vimeoToken;
    if (token) {
      const url = `${VIMEO_API}/users/${encodeURIComponent(name)}/videos?per_page=${limit}&sort=date`;
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data: Array<{
            uri: string;
            name: string;
            description?: string;
            link: string;
            duration: number;
            created_time: string;
            stats?: { plays?: number };
            pictures?: {
              sizes?: Array<{ link: string; width: number }>;
            };
            user?: {
              name: string;
              link: string;
              pictures?: {
                sizes?: Array<{ link: string }>;
              };
            };
          }>;
        };
        return (data.data ?? []).slice(0, limit).map(convertVimeoVideo);
      }
    }

    // Fallback: try oEmbed for known channel URL
    const oembedUrl = `${VIMEO_OEMBED}?url=https://vimeo.com/${encodeURIComponent(name)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        video_id?: number;
        title?: string;
        description?: string;
        thumbnail_url?: string;
        author_name?: string;
        author_url?: string;
        duration?: number;
      };
      if (data.video_id) {
        const dur = data.duration ?? 0;
        return [
          {
            id: `vimeo:${data.video_id}`,
            title: data.title ?? 'Untitled',
            description: data.description ?? '',
            thumbnail:
              data.thumbnail_url ?? `https://placehold.co/640x360/1AB7EA/FFFFFF?text=Vimeo`,
            url: `https://vimeo.com/${data.video_id}`,
            duration: dur,
            platform: PLATFORM,
            platformLabel: PLATFORM_LABEL,
            platformColor: PLATFORM_COLOR,
            creatorName: data.author_name ?? 'Vimeo Creator',
            creatorId: `vimeo:${data.author_name ?? data.video_id}`,
            creatorAvatar: '',
            creatorUrl: data.author_url ?? `https://vimeo.com/${name}`,
            viewCount: 0,
            likeCount: 0,
            publishedAt: new Date().toISOString(),
            publishedMs: Date.now(),
            category: inferCategory(data.title ?? '', data.description ?? ''),
            tags: [],
            isShort: dur > 0 && dur <= 60,
            isLive: false,
            qualityScore: 30,
          },
        ];
      }
    }
    return [];
  } catch {
    return [];
  }
}

// ─── Fetch trending (Vimeo Staff Picks) ────────────────────────────────────

export async function fetchVimeoTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    const token = _vimeoToken;
    if (!token) return [];

    const url = `${VIMEO_API}/channels/staffpicks/videos?per_page=${limit}&sort=date`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data: Array<{
        uri: string;
        name: string;
        description?: string;
        link: string;
        duration: number;
        created_time: string;
        stats?: { plays?: number };
        pictures?: {
          sizes?: Array<{ link: string; width: number }>;
        };
        user?: {
          name: string;
          link: string;
          pictures?: {
            sizes?: Array<{ link: string }>;
          };
        };
      }>;
    };

    return (data.data ?? []).slice(0, limit).map(convertVimeoVideo);
  } catch {
    return [];
  }
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchVimeo(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const token = _vimeoToken;
    if (!token) return [];

    const url = `${VIMEO_API}/videos?query=${encodeURIComponent(query)}&per_page=${limit}&sort=relevant`;
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data: Array<{
        uri: string;
        name: string;
        description?: string;
        link: string;
        duration: number;
        created_time: string;
        stats?: { plays?: number };
        pictures?: {
          sizes?: Array<{ link: string; width: number }>;
        };
        user?: {
          name: string;
          link: string;
          pictures?: {
            sizes?: Array<{ link: string }>;
          };
        };
      }>;
    };

    return (data.data ?? []).slice(0, limit).map(convertVimeoVideo);
  } catch {
    return [];
  }
}

// ─── Converter ─────────────────────────────────────────────────────────────

function convertVimeoVideo(v: {
  uri: string;
  name: string;
  description?: string;
  link: string;
  duration: number;
  created_time: string;
  stats?: { plays?: number };
  pictures?: { sizes?: Array<{ link: string; width: number }> };
  user?: {
    name: string;
    link: string;
    pictures?: { sizes?: Array<{ link: string }> };
  };
}): UnifiedVideo {
  const title = v.name || 'Untitled';
  const description = v.description ?? '';

  // Extract numeric ID from URI (/videos/{id})
  const idMatch = v.uri.match(/\/(\d+)$/);
  const videoId = idMatch?.[1] ?? simpleHash(v.link);

  // Best available thumbnail
  const thumbSizes = v.pictures?.sizes;
  const thumbnail =
    thumbSizes?.find((s) => s.width >= 640)?.link ??
    thumbSizes?.[thumbSizes.length - 1]?.link ??
    `https://placehold.co/640x360/1AB7EA/FFFFFF?text=Vimeo`;

  const user = v.user;
  const publishedMs = Date.parse(v.created_time);

  return {
    id: `vimeo:${videoId}`,
    title,
    description,
    thumbnail,
    url: v.link,
    duration: v.duration,
    platform: PLATFORM,
    platformLabel: PLATFORM_LABEL,
    platformColor: PLATFORM_COLOR,
    creatorName: user?.name ?? 'Vimeo Creator',
    creatorId: `vimeo:${user?.name ?? videoId}`,
    creatorAvatar: user?.pictures?.sizes?.[0]?.link ?? '',
    creatorUrl: user?.link ?? `https://vimeo.com/${videoId}`,
    viewCount: v.stats?.plays ?? 0,
    likeCount: 0,
    publishedAt: new Date(publishedMs).toISOString(),
    publishedMs: Number.isNaN(publishedMs) ? Date.now() : publishedMs,
    category: inferCategory(title, description),
    tags: [],
    isShort: v.duration > 0 && v.duration <= 60,
    isLive: false,
    qualityScore: computeScore(v.stats?.plays ?? 0, publishedMs),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeScore(views: number, publishedMs: number): number {
  const ageHours = Math.max(1, (Date.now() - publishedMs) / 3600000);
  const viewsPerHour = views / ageHours;
  return Math.min(viewsPerHour / 10, 100);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const map: Array<[string, string]> = [
    ['music', 'music'],
    ['gaming', 'gaming'],
    ['tech', 'tech'],
    ['news', 'news'],
    ['sport', 'sports'],
    ['comedy', 'comedy'],
    ['art', 'art'],
    ['film', 'entertainment'],
    ['animation', 'entertainment'],
  ];
  for (const [kw, cat] of map) {
    if (text.includes(kw)) return cat;
  }
  return 'entertainment';
}
