/**
 * @degenfeed/utils — Video URL detection & metadata extraction
 *
 * Detects video URLs in post content (PeerTube, YouTube, direct .mp4/.webm).
 * Extracts instance, UUID, YouTube ID, and direct file info.
 */

export interface PeerTubeInfo {
  platform: 'peertube';
  instance: string;
  uuid: string;
  url: string;
}

export interface YouTubeInfo {
  platform: 'youtube';
  id: string;
  url: string;
}

export interface DirectVideoInfo {
  platform: 'direct';
  url: string;
  format: 'mp4' | 'webm' | 'other';
}

export type VideoInfo = PeerTubeInfo | YouTubeInfo | DirectVideoInfo;

// ─── PeerTube URL patterns ──────────────────────────────────────────────
// /w/{uuid}          — watch URL
// /videos/watch/{uuid} — legacy watch URL
// /videos/embed/{uuid} — embed URL
const PEERTUBE_WATCH_RE = /https?:\/\/([^/]+)\/w\/([a-zA-Z0-9-]+)/;
const PEERTUBE_LEGACY_RE = /https?:\/\/([^/]+)\/videos\/watch\/([a-zA-Z0-9-]+)/;
const PEERTUBE_EMBED_RE = /https?:\/\/([^/]+)\/videos\/embed\/([a-zA-Z0-9-]+)/;

// ─── YouTube URL patterns ───────────────────────────────────────────────
// youtube.com/watch?v=ID
// youtu.be/ID
// youtube.com/embed/ID
// youtube.com/shorts/ID
const YOUTUBE_WATCH_RE = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/;
const YOUTUBE_SHORT_RE = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]{11})/;
const YOUTUBE_SHORTIE_RE = /(?:https?:\/\/)?youtu\.be\/([\w-]{11})/;
const YOUTUBE_EMBED_RE = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([\w-]{11})/;

// ─── Direct video file patterns ─────────────────────────────────────────
const DIRECT_MP4_RE = /\.mp4(\?|$)/i;
const DIRECT_WEBM_RE = /\.webm(\?|$)/i;

/**
 * Extract PeerTube info from a URL.
 */
export function parsePeerTubeUrl(url: string): PeerTubeInfo | null {
  const match =
    url.match(PEERTUBE_WATCH_RE) ?? url.match(PEERTUBE_LEGACY_RE) ?? url.match(PEERTUBE_EMBED_RE);
  if (!match?.[1] || !match[2]) return null;
  return {
    platform: 'peertube',
    instance: match[1],
    uuid: match[2],
    url,
  };
}

/**
 * Extract YouTube info from a URL.
 */
export function parseYouTubeUrl(url: string): YouTubeInfo | null {
  const match =
    url.match(YOUTUBE_WATCH_RE) ??
    url.match(YOUTUBE_SHORT_RE) ??
    url.match(YOUTUBE_SHORTIE_RE) ??
    url.match(YOUTUBE_EMBED_RE);
  if (!match?.[1]) return null;
  return {
    platform: 'youtube',
    id: match[1],
    url,
  };
}

/**
 * Check if a URL points to a direct video file (.mp4, .webm).
 */
export function parseDirectVideoUrl(url: string): DirectVideoInfo | null {
  if (DIRECT_MP4_RE.test(url)) {
    return { platform: 'direct', url, format: 'mp4' };
  }
  if (DIRECT_WEBM_RE.test(url)) {
    return { platform: 'direct', url, format: 'webm' };
  }
  return null;
}

/**
 * Parse any video URL and return structured info, or null if not a known video.
 */
export function parseVideoUrl(url: string): VideoInfo | null {
  if (!url) return null;
  return parsePeerTubeUrl(url) ?? parseYouTubeUrl(url) ?? parseDirectVideoUrl(url);
}

/**
 * Detect video URLs in an array of embed objects.
 * Returns the first detected video info.
 */
export interface EmbedLike {
  kind: string;
  url: string;
}

export function detectVideoFromEmbeds(embeds: EmbedLike[]): VideoInfo | null {
  for (const embed of embeds) {
    if (embed.kind === 'video') {
      const info = parseVideoUrl(embed.url);
      if (info) return info;
    }
  }
  for (const embed of embeds) {
    if (embed.kind === 'link') {
      const info = parseVideoUrl(embed.url);
      if (info) return info;
    }
  }
  return null;
}

/**
 * PeerTube API: fetch video details to get the direct file URL.
 * Returns the best quality .mp4 file URL, or null on failure.
 */
export interface PeerTubeVideoData {
  name: string;
  description?: string;
  thumbnailPath: string;
  channel: { displayName: string; name: string };
  files: Array<{ fileUrl: string; resolution: { label: string } }>;
  views: number;
  likes: number;
}

export async function fetchPeerTubeVideo(
  instance: string,
  uuid: string,
  signal?: AbortSignal,
): Promise<PeerTubeVideoData | null> {
  try {
    const res = await fetch(`https://${instance}/api/v1/videos/${uuid}`, {
      signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name: string;
      description?: string;
      thumbnailPath?: string;
      channel?: { displayName: string; name: string };
      files?: Array<{ fileUrl: string; resolution?: { label: string } }>;
      views?: number;
      likes?: number;
    };
    return {
      name: data.name ?? uuid,
      description: data.description,
      thumbnailPath: data.thumbnailPath
        ? `https://${instance}${data.thumbnailPath}`
        : `https://${instance}/static/thumbnails/${uuid}.jpg`,
      channel: data.channel ?? { displayName: 'Unknown', name: 'unknown' },
      files: (data.files ?? []).map((f) => ({
        fileUrl: f.fileUrl,
        resolution: { label: f.resolution?.label ?? 'auto' },
      })),
      views: data.views ?? 0,
      likes: data.likes ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Determine if a video is likely short-form / vertical based on aspect
 * ratio hints from PeerTube data, YouTube shorts URL, or file metadata.
 */
export function isShortFormVideo(info: VideoInfo): boolean {
  if (info.platform === 'youtube') {
    // YouTube Shorts /shorts/ID
    return /shorts\//.test(info.url) || /\/shorts\//.test(info.url);
  }
  // For PeerTube and direct, we can't know without fetching metadata.
  // Default to false; component can auto-detect from video dimensions.
  return false;
}
