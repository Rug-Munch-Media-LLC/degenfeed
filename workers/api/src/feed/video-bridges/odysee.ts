/**
 * @degenfeed/api-worker — Odysee Video Bridge
 *
 * Fetches video content from Odysee (LBRY protocol).
 * Sources:
 *   - LBRY claim_search API: https://api.lbry.com/claim_search
 *   - Odysee trending API: https://odysee.com/$/api/trending
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator-types';

const ODYSEE_API = 'https://api.lbry.com';
const ODYSEE_WEB = 'https://odysee.com';

const PLATFORM: VideoPlatform = 'odysee';
const PLATFORM_LABEL = 'Odysee';
const PLATFORM_COLOR = '#FF6A00';

// ─── Fetch channel videos ──────────────────────────────────────────────────

export async function fetchOdyseeChannelVideos(
  channelName: string,
  limit: number = 10,
): Promise<UnifiedVideo[]> {
  try {
    const name = channelName.replace(/^@/, '').toLowerCase();
    const url = `${ODYSEE_API}/claim_search?channel=${encodeURIComponent(name)}&claim_type=stream&order_by=release_time&page_size=${limit}&has_source=true`;
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: {
        items?: Array<{
          claim_id: string;
          name: string;
          canonical_url: string;
          value?: {
            title?: string;
            description?: string;
            thumbnail?: { url?: string };
            video?: { duration?: number };
            source?: { mediaType?: string };
          };
          meta?: { effective_amount?: number };
          timestamp?: number;
        }>;
      };
    };

    return (data?.data?.items ?? []).slice(0, limit).map((item) => {
      const title = item.value?.title || item.name;
      const publishedMs = (item.timestamp ?? 0) * 1000;
      const duration = item.value?.video?.duration ?? 0;

      return {
        id: `odysee:${item.claim_id}`,
        title,
        description: item.value?.description ?? '',
        thumbnail:
          item.value?.thumbnail?.url ?? `https://placehold.co/640x360/FF6A00/FFFFFF?text=Odysee`,
        url: `${ODYSEE_WEB}/${item.canonical_url}`,
        duration,
        platform: PLATFORM,
        platformLabel: PLATFORM_LABEL,
        platformColor: PLATFORM_COLOR,
        creatorName: channelName,
        creatorId: `odysee:${name}`,
        creatorAvatar: '',
        creatorUrl: `${ODYSEE_WEB}/@${name}`,
        viewCount: item.meta?.effective_amount ?? 0,
        likeCount: 0,
        publishedAt: new Date(publishedMs).toISOString(),
        publishedMs,
        category: inferCategory(title, item.value?.description ?? ''),
        tags: [],
        isShort: duration > 0 && duration <= 90,
        isLive: false,
        qualityScore: 30,
      };
    });
  } catch {
    return [];
  }
}

// ─── Fetch trending ────────────────────────────────────────────────────────

export async function fetchOdyseeTrending(
  _category: string = '',
  limit: number = 20,
): Promise<UnifiedVideo[]> {
  try {
    const url = `${ODYSEE_WEB}/$/api/trending`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content_types: ['video'],
        page_size: limit,
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

    return (data.data ?? []).map((v) => {
      const title = v.title || v.name;
      const publishedMs = Number(v.release_time) * 1000;
      return {
        id: `odysee:${v.claimId}`,
        title,
        description: v.description ?? '',
        thumbnail: v.thumbnail?.url ?? `https://placehold.co/640x360/FF6A00/FFFFFF?text=Odysee`,
        url: `${ODYSEE_WEB}/${v.name}:${v.claimId}`,
        duration: v.duration ?? 0,
        platform: PLATFORM,
        platformLabel: PLATFORM_LABEL,
        platformColor: PLATFORM_COLOR,
        creatorName: v.signing_channel?.name ?? 'Odysee Creator',
        creatorId: `odysee:${v.signing_channel?.claimId ?? v.claimId}`,
        creatorAvatar: v.signing_channel?.thumbnail?.url ?? '',
        creatorUrl: v.signing_channel
          ? `${ODYSEE_WEB}/@${v.signing_channel.name}:${v.signing_channel.claimId}`
          : `${ODYSEE_WEB}/${v.name}`,
        viewCount: 0,
        likeCount: 0,
        publishedAt: new Date(publishedMs).toISOString(),
        publishedMs,
        category: inferCategory(title, v.description ?? ''),
        tags: [],
        isShort: (v.duration ?? 0) > 0 && v.duration <= 90,
        isLive: false,
        qualityScore: 30,
      };
    });
  } catch {
    return [];
  }
}

// ─── Search ────────────────────────────────────────────────────────────────

export async function searchOdysee(query: string, limit: number = 10): Promise<UnifiedVideo[]> {
  try {
    const url = `${ODYSEE_API}/claim_search?text=${encodeURIComponent(query)}&claim_type=stream&page_size=${limit}`;
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: {
        items?: Array<{
          claim_id: string;
          name: string;
          canonical_url: string;
          value?: {
            title?: string;
            description?: string;
            thumbnail?: { url?: string };
            video?: { duration?: number };
          };
          signing_channel?: {
            name: string;
            claimId: string;
            thumbnail?: { url?: string };
          };
          timestamp?: number;
        }>;
      };
    };

    return (data?.data?.items ?? []).slice(0, limit).map((item) => {
      const title = item.value?.title || item.name;
      const publishedMs = (item.timestamp ?? 0) * 1000;
      const duration = item.value?.video?.duration ?? 0;
      const channel = item.signing_channel;

      return {
        id: `odysee:${item.claim_id}`,
        title,
        description: item.value?.description ?? '',
        thumbnail:
          item.value?.thumbnail?.url ?? `https://placehold.co/640x360/FF6A00/FFFFFF?text=Odysee`,
        url: `${ODYSEE_WEB}/${item.canonical_url}`,
        duration,
        platform: PLATFORM,
        platformLabel: PLATFORM_LABEL,
        platformColor: PLATFORM_COLOR,
        creatorName: channel?.name ?? 'Odysee Creator',
        creatorId: `odysee:${channel?.claimId ?? item.claim_id}`,
        creatorAvatar: channel?.thumbnail?.url ?? '',
        creatorUrl: channel
          ? `${ODYSEE_WEB}/@${channel.name}:${channel.claimId}`
          : `${ODYSEE_WEB}/${item.name}`,
        viewCount: 0,
        likeCount: 0,
        publishedAt: new Date(publishedMs).toISOString(),
        publishedMs,
        category: inferCategory(title, item.value?.description ?? ''),
        tags: [],
        isShort: duration > 0 && duration <= 90,
        isLive: false,
        qualityScore: 30,
      };
    });
  } catch {
    return [];
  }
}

// ─── Category inference (shared utility) ──────────────────────────────────

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const map: Array<[string, string]> = [
    ['crypto', 'crypto'],
    ['bitcoin', 'crypto'],
    ['ethereum', 'crypto'],
    ['gaming', 'gaming'],
    ['gameplay', 'gaming'],
    ['music', 'music'],
    ['song', 'music'],
    ['news', 'news'],
    ['politics', 'news'],
    ['tech', 'tech'],
    ['programming', 'tech'],
    ['tutorial', 'education'],
    ['learn', 'education'],
    ['comedy', 'comedy'],
    ['funny', 'comedy'],
    ['sport', 'sports'],
  ];
  for (const [kw, cat] of map) {
    if (text.includes(kw)) return cat;
  }
  return 'entertainment';
}
