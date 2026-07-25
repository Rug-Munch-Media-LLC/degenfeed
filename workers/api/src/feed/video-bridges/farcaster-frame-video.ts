/**
 * @degenfeed/api-worker — Farcaster Frame Video Bridge
 *
 * Fetches video content embedded in Farcaster Frames.
 * Frames can contain video embeds (mp4, HLS, YouTube links).
 * We extract video embeds from trending Farcaster casts.
 *
 * "Follow creators, not platforms" — every video gets a platform badge.
 */

import type { VideoPlatform } from '../../lib/creator-resolver';
import type { UnifiedVideo } from '../video-aggregator';

const PLATFORM: VideoPlatform = 'farcaster';
const PLATFORM_LABEL = 'Farcaster Video';
const PLATFORM_COLOR = '#8A63D2';

const FARCASTER_HUB = 'https://hub.farcaster.xyz:2281';
const _FARCASTER_NEYNAR = 'https://api.neynar.com';

// ─── Types ─────────────────────────────────────────────────────────────

interface FarcasterCast {
  hash: string;
  author: {
    fid: number;
    username?: string;
    displayName?: string;
    pfp?: { url: string };
  };
  text: string;
  timestamp: number;
  embeds: Array<{ url: string }>;
  reactions?: { likes_count: number; recasts_count: number };
  recasts?: { count: number };
  replies?: { count: number };
  frames?: Array<{
    version: string;
    image: string;
    buttons: string[];
    post_url: string;
    video?: string;
  }>;
}

// ─── Fetch trending Farcaster casts with video embeds ────────────────────

export async function fetchFarcasterFrameVideos(
  limit: number = 20,
  signal?: AbortSignal,
): Promise<UnifiedVideo[]> {
  try {
    const casts = await fetchTrendingCasts(limit * 3, signal);
    const videos: UnifiedVideo[] = [];
    const seen = new Set<string>();

    for (const cast of casts) {
      // Extract video URLs from embeds (video content)
      const videoUrls = extractVideoUrls(cast);
      for (const { url, type } of videoUrls) {
        const dedupKey = url;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const videoId = `fc-video-${cast.hash.slice(0, 12)}`;
        const likes = cast.reactions?.likes_count ?? 0;
        const _recasts = cast.recasts?.count ?? cast.reactions?.recasts_count ?? 0;

        videos.push({
          id: videoId,
          title: cast.text?.slice(0, 200) || 'Farcaster Video',
          description: cast.text ?? '',
          thumbnail: cast.frames?.[0]?.image ?? '',
          url,
          duration: 0,
          platform: PLATFORM,
          platformLabel: PLATFORM_LABEL,
          platformColor: PLATFORM_COLOR,
          creatorName: cast.author?.displayName ?? cast.author?.username ?? 'FC User',
          creatorId: `farcaster:${cast.author?.fid ?? 0}`,
          creatorAvatar: cast.author?.pfp?.url ?? '',
          creatorUrl: `https://warpcast.com/${cast.author?.username ?? ''}`,
          viewCount: 0,
          likeCount: likes,
          publishedAt: new Date(cast.timestamp).toISOString(),
          category: type === 'youtube' ? 'youtube' : 'farcaster-video',
          tags: ['farcaster', 'frame', 'video'],
          isLive: false,
          isShort: false,
          embedUrl: type === 'youtube' ? url : '',
        });

        if (videos.length >= limit) break;
      }
      if (videos.length >= limit) break;
    }

    return videos.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Fetch trending casts ────────────────────────────────────────────────

async function fetchTrendingCasts(limit: number, signal?: AbortSignal): Promise<FarcasterCast[]> {
  try {
    const url = `${FARCASTER_HUB}/v1/trending-casts?limit=${limit}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { casts: FarcasterCast[] };
      return data.casts ?? [];
    }
  } catch {
    // Fallback to Neynar
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/feed/trending?limit=${limit}&feed_type=filter&filter_type=global`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { casts: FarcasterCast[] };
      return data.casts ?? [];
    }
  } catch {
    // ignore
  }

  return [];
}

// ─── Extract video URLs from a cast ──────────────────────────────────────

interface VideoEmbed {
  url: string;
  type: 'direct' | 'youtube' | 'vimeo' | 'twitch' | 'ipfs' | 'unknown';
}

function extractVideoUrls(cast: FarcasterCast): VideoEmbed[] {
  const embeds: VideoEmbed[] = [];
  const seen = new Set<string>();

  for (const embed of cast.embeds ?? []) {
    const url = embed.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const type = detectVideoType(url);
    if (type !== 'unknown') {
      embeds.push({ url, type });
    }
  }

  // Check frame video property
  if (cast.frames) {
    for (const frame of cast.frames) {
      if (frame.video && !seen.has(frame.video)) {
        seen.add(frame.video);
        embeds.push({ url: frame.video, type: detectVideoType(frame.video) });
      }
    }
  }

  return embeds;
}

function detectVideoType(url: string): VideoEmbed['type'] {
  const lower = url.toLowerCase();

  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.mov') ||
    lower.includes('video') ||
    lower.includes('/hls/')
  ) {
    return 'direct';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('yewtu')) {
    return 'youtube';
  }
  if (lower.includes('vimeo.com')) return 'vimeo';
  if (lower.includes('twitch.tv')) return 'twitch';
  if (lower.startsWith('ipfs://') || lower.includes('ipfs.') || lower.includes('/ipfs/')) {
    return 'ipfs';
  }

  return 'unknown';
}
