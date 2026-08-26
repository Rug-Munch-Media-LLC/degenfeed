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
import type { UnifiedVideo } from '../video-aggregator-types';

const PLATFORM: VideoPlatform = 'farcaster';
const PLATFORM_LABEL = 'Farcaster Video';
const PLATFORM_COLOR = '#8A63D2';

const FARCASTER_HUB = 'http://127.0.0.1:2281';

/** Resolve the Farcaster hub URL, preferring the worker env override. */
function getHubUrl(env?: { FARCASTER_HUB_URL?: string }): string {
  return env?.FARCASTER_HUB_URL || FARCASTER_HUB;
}

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
  env?: { FARCASTER_HUB_URL?: string },
): Promise<UnifiedVideo[]> {
  try {
    const hubUrl = getHubUrl(env);
    const casts = await fetchTrendingCasts(limit * 3, hubUrl, signal);
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

async function fetchTrendingCasts(
  limit: number,
  hubUrl: string,
  signal?: AbortSignal,
): Promise<FarcasterCast[]> {
  try {
    const url = `${hubUrl}/v1/trendingFeed?time_window=24h&limit=${limit}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        messages: Array<{
          data: {
            castAddBody: { text: string; embeds: { url: string }[] };
            fid: number;
            timestamp: number;
          };
        }>;
      };
      return (data.messages ?? []).map((msg) => ({
        hash: msg.data?.castAddBody?.text?.slice(0, 8) ?? '',
        author: { fid: msg.data?.fid ?? 0, username: `fid:${msg.data?.fid ?? 0}` },
        text: msg.data?.castAddBody?.text ?? '',
        timestamp: (msg.data?.timestamp ?? 0) * 1000,
        embeds: msg.data?.castAddBody?.embeds ?? [],
      }));
    }
  } catch {
    // ignore
  }

  // Fallback: scan curated FIDs for casts with embeds
  try {
    const allCasts: FarcasterCast[] = [];
    const curatedFids = [3, 2, 1, 228, 239, 354, 5650];
    for (const fid of curatedFids) {
      try {
        const res = await fetch(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=5`, {
          signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          messages?: Array<{
            hash: string;
            data: {
              castAddBody: { text: string; embeds: { url: string }[] };
              fid: number;
              timestamp: number;
            };
          }>;
        };
        for (const msg of data.messages ?? []) {
          allCasts.push({
            hash: msg.hash,
            author: { fid: msg.data.fid, username: `fid:${msg.data.fid}` },
            text: msg.data.castAddBody.text,
            timestamp: msg.data.timestamp * 1000,
            embeds: (msg.data.castAddBody.embeds || []).map((e: { url: string }) => ({
              url: e.url,
            })),
          });
        }
      } catch {}
    }
    return allCasts.slice(0, limit);
  } catch {
    return [];
  }
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
