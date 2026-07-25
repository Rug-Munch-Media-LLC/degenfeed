/**
 * @degenfeed/farcaster-sdk — Video & Live Streaming Integration
 *
 * Farcaster doesn't have native video upload, but video content is
 * distributed via:
 *   1. Frame embeds (video URLs in cast embeds)
 *   2. Link embeds to YouTube/PeerTube/Livepeer
 *   3. Cast text with video URLs
 *   4. Live stream announcements via cast embeds
 *
 * This module provides:
 *   - Detect video frames from Farcaster casts
 *   - Extract video URLs from embeds
 *   - Detect live stream announcements
 *   - Short-form video detection
 *   - Create video/live casts for cross-posting
 *   - Video frame building for casts
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface FarcasterVideoEmbed {
  /** Type of video embed detected */
  type: 'frame' | 'link' | 'youtube' | 'peertube' | 'livepeer' | 'tiktok' | 'other';
  /** The video URL */
  url: string;
  /** Embed metadata from the cast */
  metadata?: Record<string, unknown>;
  /** Detected as short-form (vertical, < 60s typical) */
  isShort?: boolean;
  /** Detected as live stream */
  isLive?: boolean;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
  /** Platform name for display */
  platformLabel?: string;
}

export interface FarcasterLiveCast {
  /** Cast hash */
  hash: string;
  /** Author FID */
  fid: number;
  /** Author display name */
  authorName: string;
  /** Cast text */
  text: string;
  /** Live stream URL */
  streamUrl: string;
  /** Platform streaming on (peertube, livepeer, youtube, twitch, etc.) */
  platform: string;
  /** When the cast was created */
  timestamp: number;
  /** Whether this is currently live (vs scheduled) */
  isLive: boolean;
  /** Scheduled start time if not yet live */
  scheduledAt?: number;
  /** Tags extracted from cast */
  tags: string[];
}

export interface FarcasterShortVideo {
  /** Cast hash containing the short */
  hash: string;
  /** Author FID */
  fid: number;
  /** Author display name */
  authorName: string;
  /** Short video URL */
  videoUrl: string;
  /** Video platform source */
  source: 'youtube' | 'peertube' | 'tiktok' | 'direct' | 'other';
  /** Cast text description */
  text: string;
  /** Duration in seconds (0 if unknown) */
  duration: number;
  /** Engagement (likes, recasts, replies) */
  likes: number;
  recasts: number;
  replies: number;
  /** When the cast was created */
  createdAt: number;
  /** Thumbnail if available */
  thumbnailUrl?: string;
}

// ─── Video Embed Detectors ──────────────────────────────────────────────

/** Known video platforms and their URL patterns */
const VIDEO_PLATFORMS: Array<{
  pattern: RegExp;
  platform: string;
  label: string;
  isShort: boolean;
}> = [
  {
    pattern: /(?:www\.)?youtube\.com\/shorts\//i,
    platform: 'youtube',
    label: 'YouTube Shorts',
    isShort: true,
  },
  {
    pattern: /(?:www\.)?youtube\.com\/watch\?v=/i,
    platform: 'youtube',
    label: 'YouTube',
    isShort: false,
  },
  { pattern: /youtu\.be\//i, platform: 'youtube', label: 'YouTube', isShort: false },
  { pattern: /(?:www\.)?tiktok\.com\//i, platform: 'tiktok', label: 'TikTok', isShort: true },
  {
    pattern: /(?:www\.)?instagram\.com\/(?:reel|reels)\//i,
    platform: 'instagram',
    label: 'Instagram Reels',
    isShort: true,
  },
  { pattern: /(?:www\.)?twitch\.tv\//i, platform: 'twitch', label: 'Twitch', isShort: false },
  { pattern: /(?:www\.)?kick\.com\//i, platform: 'kick', label: 'Kick', isShort: false },
  { pattern: /video\.degenfeed\.xyz/i, platform: 'peertube', label: 'PeerTube', isShort: false },
  { pattern: /(?:www\.)?peertube\./i, platform: 'peertube', label: 'PeerTube', isShort: false },
  { pattern: /livepeerr\.io/i, platform: 'livepeer', label: 'Livepeer', isShort: false },
  { pattern: /(?:www\.)?vimeo\.com\//i, platform: 'vimeo', label: 'Vimeo', isShort: false },
  {
    pattern: /(?:www\.)?dailymotion\.com\//i,
    platform: 'dailymotion',
    label: 'Dailymotion',
    isShort: false,
  },
  { pattern: /(?:www\.)?odysee\.com\//i, platform: 'odysee', label: 'Odysee', isShort: false },
  { pattern: /(?:www\.)?rumble\.com\//i, platform: 'rumble', label: 'Rumble', isShort: false },
  { pattern: /\.m3u8/i, platform: 'hls', label: 'HLS Stream', isShort: false },
  { pattern: /\.mp4(?:\?|$)/i, platform: 'direct', label: 'Direct MP4', isShort: false },
  { pattern: /\.webm(?:\?|$)/i, platform: 'direct', label: 'Direct WebM', isShort: false },
];

/** Detect video embeds from a Farcaster cast's embed URLs */
export function detectVideoEmbeds(embedUrls: string[]): FarcasterVideoEmbed[] {
  const videos: FarcasterVideoEmbed[] = [];

  for (const url of embedUrls) {
    for (const platform of VIDEO_PLATFORMS) {
      if (platform.pattern.test(url)) {
        videos.push({
          type:
            platform.platform === 'youtube' || platform.platform === 'peertube'
              ? platform.platform
              : platform.platform === 'tiktok' || platform.platform === 'instagram'
                ? 'link'
                : platform.platform === 'hls' || platform.platform === 'livepeer'
                  ? 'livepeer'
                  : 'link',
          url,
          isShort: platform.isShort,
          isLive: ['twitch', 'kick', 'livepeer', 'hls'].includes(platform.platform),
          platformLabel: platform.label,
        });
        break;
      }
    }
  }

  return videos;
}

/** Extract video URLs from cast text */
const VIDEO_URL_REGEX = /(https?:\/\/[^\s]+\.(?:mp4|webm|m3u8|mov)(?:\?[^\s]*)?)/gi;
const PLATFORM_URL_REGEX =
  /(https?:\/\/(?:www\.)?(?:youtube|youtu\.be|tiktok|twitch|kick|peertube|vimeo|odysee|rumble|livepeerr)[^\s]+)/gi;

export function extractVideoUrlsFromText(text: string): string[] {
  const matches: string[] = [];
  const directMatches = text.match(VIDEO_URL_REGEX);
  if (directMatches) matches.push(...directMatches);
  const platformMatches = text.match(PLATFORM_URL_REGEX);
  if (platformMatches) matches.push(...platformMatches);
  return [...new Set(matches)];
}

// ─── Live Stream Detection ──────────────────────────────────────────────

/** Keywords that suggest a cast is about a live stream */
const LIVE_KEYWORDS = [
  '🔴',
  'live',
  'streaming',
  'stream',
  'go live',
  'going live',
  'live now',
  'live stream',
  'watching',
  'livestream',
  'twitch.tv/',
  'kick.com/',
  'youtube.com/watch',
];

/** Detect if a cast announces a live stream */
export function detectLiveStream(
  text: string,
  embedUrls: string[],
  timestamp: number,
): { isLive: boolean; streamUrl?: string; platform?: string; scheduledAt?: number } {
  const lower = text.toLowerCase();
  const hasLiveKeyword = LIVE_KEYWORDS.some((kw) => lower.includes(kw));

  // Check embeds for live platforms
  const embeds = detectVideoEmbeds(embedUrls);
  const liveEmbeds = embeds.filter((e) => e.isLive);

  // Check for scheduled time patterns
  const scheduledMatch = text.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?/i);
  let scheduledAt: number | undefined;

  // "In X hours/minutes" pattern
  const inMatch = text.match(/in\s+(\d+)\s*(?:hour|min|h|m)/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1] ?? '0', 10);
    const unit = inMatch[0]?.toLowerCase().includes('h') ? 3600000 : 60000;
    scheduledAt = Date.now() + amount * unit;
  }

  // "Today at 8pm" pattern
  if (scheduledMatch && !inMatch) {
    const hours = parseInt(scheduledMatch[1] ?? '0', 10);
    const minutes = parseInt(scheduledMatch[2] ?? '0', 10);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    if (date.getTime() > Date.now()) {
      scheduledAt = date.getTime();
    } else {
      date.setDate(date.getDate() + 1);
      scheduledAt = date.getTime();
    }
  }

  const streamUrl = liveEmbeds[0]?.url ?? embedUrls.find((u) => /twitch|kick|livepeerr/i.test(u));
  const platform =
    liveEmbeds[0]?.platformLabel ?? (streamUrl ? extractPlatform(streamUrl) : undefined);

  // A cast is "live" if it has live keywords AND a live embed URL
  const isLive =
    (hasLiveKeyword && !!streamUrl) ||
    liveEmbeds.length > 0 ||
    (hasLiveKeyword && embedUrls.length > 0 && timestamp > Date.now() - 3600000);

  return { isLive, streamUrl, platform, scheduledAt };
}

/** Extract a human-readable platform name from a URL */
function extractPlatform(url: string): string | undefined {
  for (const platform of VIDEO_PLATFORMS) {
    if (platform.pattern.test(url)) return platform.label;
  }
  return undefined;
}

// ─── Short Video Detection ──────────────────────────────────────────────

/** Detect if a cast contains short-form video content */
export function detectShortVideo(
  text: string,
  embedUrls: string[],
): { isShort: boolean; videoUrl?: string; source?: string } {
  const lower = text.toLowerCase();
  const hasShortKeyword =
    lower.includes('#shorts') || lower.includes('shorts') || lower.includes('clip');

  const embeds = detectVideoEmbeds(embedUrls);
  const shortEmbeds = embeds.filter((e) => e.isShort);

  // Also check for short duration video platforms
  const shortPlatforms = embeds.filter(
    (e) =>
      e.platformLabel === 'YouTube Shorts' ||
      e.platformLabel === 'TikTok' ||
      e.platformLabel === 'Instagram Reels',
  );

  if (shortPlatforms.length > 0) {
    return {
      isShort: true,
      videoUrl: shortPlatforms[0]?.url,
      source: shortPlatforms[0]?.platformLabel?.toLowerCase().replace(' ', '_'),
    };
  }

  if (shortEmbeds.length > 0) {
    return {
      isShort: true,
      videoUrl: shortEmbeds[0]?.url,
      source: shortEmbeds[0]?.platformLabel?.toLowerCase(),
    };
  }

  if (hasShortKeyword && embedUrls.length > 0) {
    return {
      isShort: true,
      videoUrl: embedUrls[0],
      source: 'direct',
    };
  }

  return { isShort: false };
}

// ─── Frame Building for Video Casts ────────────────────────────────────

/** Build a cast announcing a live stream on a platform */
export function buildLiveStreamCast(opts: {
  title: string;
  platform: string;
  streamUrl: string;
  description?: string;
  hashtags?: string[];
}): { text: string; embeds: string[] } {
  const hashtagStr = opts.hashtags?.length
    ? `\n${opts.hashtags.map((h) => `#${h}`).join(' ')}`
    : '';

  const desc = opts.description ? `\n${opts.description.slice(0, 200)}` : '';

  const text =
    `🔴 LIVE now: ${opts.title}${desc}\n\nStreaming on ${opts.platform}${hashtagStr}`.slice(0, 320);

  return {
    text,
    embeds: [opts.streamUrl],
  };
}

/** Build a cast announcing a new video/short */
export function buildVideoCast(opts: {
  title: string;
  videoUrl: string;
  platform?: string;
  isShort?: boolean;
  description?: string;
  hashtags?: string[];
}): { text: string; embeds: string[] } {
  const prefix = opts.isShort ? '🎬 Short: ' : '🎥 Video: ';
  const platformStr = opts.platform ? ` on ${opts.platform}` : '';
  const hashtagStr = opts.hashtags?.length
    ? `\n${opts.hashtags.map((h) => `#${h}`).join(' ')}`
    : '';

  const desc = opts.description ? `\n${opts.description.slice(0, 150)}` : '';

  const text = `${prefix}${opts.title}${platformStr}${desc}${hashtagStr}`.slice(0, 320);

  return {
    text,
    embeds: [opts.videoUrl],
  };
}

/** Build a Farcaster frame JSON for embedding a video player */
export function buildVideoFrame(opts: {
  videoUrl: string;
  thumbnailUrl?: string;
  platform?: string;
  tokenSymbol?: string;
}): Record<string, unknown> {
  const frame: Record<string, unknown> = {
    version: 'next',
    imageUrl: opts.thumbnailUrl ?? `${opts.videoUrl}/thumbnail`,
    button: {
      title: opts.platform ? `Watch on ${opts.platform}` : 'Watch Video',
      action: {
        type: 'link',
        target: opts.videoUrl,
      },
    },
    postUrl: opts.videoUrl,
  };

  if (opts.tokenSymbol) {
    frame.token = {
      symbol: opts.tokenSymbol,
      action: 'tip',
    };
  }

  return frame;
}

// ─── Cast Normalization ────────────────────────────────────────────────

/** Normalize a Farcaster cast with video content for unified feeds */
export function normalizeVideoCast(cast: {
  hash: string;
  fid: number;
  text: string;
  embeds: string[];
  timestamp: number;
  likes?: number;
  recasts?: number;
  replies?: number;
  authorName?: string;
}): {
  id: string;
  type: 'video' | 'short' | 'live' | 'clip';
  videoUrl?: string;
  thumbnailUrl?: string;
  source: string;
  title: string;
  description: string;
  creatorName: string;
  creatorId: string;
  platform: string;
  duration?: number;
  metrics: { likes: number; recasts: number; replies: number };
  publishedAt: number;
  tags: string[];
} {
  const videoEmbeds = detectVideoEmbeds(cast.embeds);
  const liveInfo = detectLiveStream(cast.text, cast.embeds, cast.timestamp);
  const shortInfo = detectShortVideo(cast.text, cast.embeds);

  const videoUrl = videoEmbeds[0]?.url ?? cast.embeds[0];
  const platform_label =
    videoEmbeds[0]?.platformLabel ?? extractPlatform(videoUrl ?? '') ?? 'Farcaster';
  const title = cast.text.split('\n')[0]?.slice(0, 100) ?? 'Untitled';
  const tags = (cast.text.match(/#\w+/g) ?? []).map((t) => t.slice(1));

  let type: 'video' | 'short' | 'live' | 'clip' = 'video';
  if (liveInfo.isLive) type = 'live';
  else if (shortInfo.isShort) type = 'short';

  return {
    id: `farcaster:${cast.hash}`,
    type,
    videoUrl,
    thumbnailUrl: videoEmbeds[0]?.thumbnailUrl,
    source: platform_label.toLowerCase().replace(/\s+/g, '_'),
    title: title.replace(/^🔴|^🎬|^🎥/, '').trim(),
    description: cast.text.slice(0, 500),
    creatorName: cast.authorName ?? `fid:${cast.fid}`,
    creatorId: `farcaster:${cast.fid}`,
    platform: platform_label,
    metrics: {
      likes: cast.likes ?? 0,
      recasts: cast.recasts ?? 0,
      replies: cast.replies ?? 0,
    },
    publishedAt: cast.timestamp,
    tags,
  };
}
