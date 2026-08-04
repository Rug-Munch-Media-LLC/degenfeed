'use client';

/**
 * @degenfeed/web — Shared types & constants for the unified Create hub.
 *
 * Format flexibility is the core concept: creators can pick Loops-style
 * (vertical, short) vs traditional (horizontal, long) for BOTH live streams
 * and VOD, across all supported platforms.
 */

export type VideoFormat = 'portrait' | 'landscape';

export interface FormatMeta {
  id: VideoFormat;
  label: string;
  shortLabel: string;
  emoji: string;
  /** CSS aspect-ratio string used for previews */
  aspect: string;
  /** 9:16 or 16:9 — display string */
  ratioLabel: string;
  description: string;
  /** Platform families this format is native to */
  native: string[];
}

export const FORMATS: FormatMeta[] = [
  {
    id: 'portrait',
    label: 'Vertical (Loops-style)',
    shortLabel: 'Vertical',
    emoji: '📱',
    aspect: '9 / 16',
    ratioLabel: '9:16',
    description: 'Short, tall, made for thumbs. Loops · TikTok · Reels · Shorts.',
    native: ['Loops', 'TikTok', 'Instagram Reels', 'YouTube Shorts'],
  },
  {
    id: 'landscape',
    label: 'Horizontal (Traditional)',
    shortLabel: 'Horizontal',
    emoji: '🖥️',
    aspect: '16 / 9',
    ratioLabel: '16:9',
    description: 'Long-form, big-screen. YouTube · Twitch · PeerTube · Vimeo.',
    native: ['YouTube', 'Twitch', 'PeerTube', 'Vimeo'],
  },
];

export function formatMeta(id: VideoFormat): FormatMeta {
  return FORMATS.find((f) => f.id === id) ?? LANDSCAPE_META;
}

const LANDSCAPE_META: FormatMeta = {
  id: 'landscape',
  label: 'Horizontal (Traditional)',
  shortLabel: 'Horizontal',
  emoji: '🖥️',
  aspect: '16 / 9',
  ratioLabel: '16:9',
  description: 'Long-form, big-screen. YouTube · Twitch · PeerTube · Vimeo.',
  native: ['YouTube', 'Twitch', 'PeerTube', 'Vimeo'],
};

/**
 * Auto-detect the format from a loaded <video> element using its intrinsic
 * dimensions. Portrait → 9:16 (Loops-style), everything else → 16:9.
 * Returns null if the metadata isn't available yet.
 */
export function detectFormatFromVideo(video: HTMLVideoElement | null): VideoFormat | null {
  if (!video) return null;
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;
  return videoWidth < videoHeight ? 'portrait' : 'landscape';
}

/* ─── Platforms ────────────────────────────────────────────────────────── */

export interface CreatorPlatform {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  /** True when the platform accepts live streams */
  supportsLive: boolean;
  /** True when the platform accepts VOD uploads */
  supportsVod: boolean;
  /** Premium-only platforms (YouTube, Twitch) */
  premium?: boolean;
  /** Aspect the platform is most associated with */
  preferredFormat?: VideoFormat;
}

export const CREATOR_PLATFORMS: CreatorPlatform[] = [
  {
    id: 'owncast',
    label: 'Owncast',
    icon: '📡',
    color: '#ec4899',
    description: 'Self-hosted, ad-free, own your stream',
    supportsLive: true,
    supportsVod: false,
    preferredFormat: 'landscape',
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    icon: '🎥',
    color: '#F1684B',
    description: 'Federated video — live + VOD',
    supportsLive: true,
    supportsVod: true,
    preferredFormat: 'landscape',
  },
  {
    id: 'lens',
    label: 'Lens',
    icon: '🟢',
    color: '#abfe2c',
    description: 'Lens protocol — post + video',
    supportsLive: true,
    supportsVod: true,
    preferredFormat: 'portrait',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '🟡',
    color: '#8a63d2',
    description: 'Warpcast · Supercast casts',
    supportsLive: true,
    supportsVod: true,
    preferredFormat: 'portrait',
  },
  {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    description: 'NIP-71 video + live events',
    supportsLive: true,
    supportsVod: true,
    preferredFormat: 'portrait',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    color: '#ff0000',
    description: 'The big one — live + VOD',
    supportsLive: true,
    supportsVod: true,
    premium: true,
    preferredFormat: 'landscape',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    icon: '🎮',
    color: '#9146ff',
    description: 'Live-first streaming',
    supportsLive: true,
    supportsVod: false,
    premium: true,
    preferredFormat: 'landscape',
  },
];

/** Free platforms available to every creator. */
export const FREE_PLATFORM_IDS = CREATOR_PLATFORMS.filter((p) => !p.premium).map((p) => p.id);

/** Platforms that support live streaming (for the Go Live flow). */
export const LIVE_PLATFORMS = CREATOR_PLATFORMS.filter((p) => p.supportsLive);

/** Platforms that support VOD publishing (for the upload flow). */
export const VOD_PLATFORMS = CREATOR_PLATFORMS.filter((p) => p.supportsVod);

export function platformMeta(id: string): CreatorPlatform {
  return (
    CREATOR_PLATFORMS.find((p) => p.id === id) ?? {
      id,
      label: id,
      icon: '◆',
      color: '#8b5cf6',
      description: '',
      supportsLive: false,
      supportsVod: false,
    }
  );
}

/* ─── Create types (hub options) ──────────────────────────────────────── */

export type CreateType = 'short' | 'long' | 'live' | 'post' | 'podcast';

export interface CreateOption {
  id: CreateType;
  label: string;
  emoji: string;
  description: string;
  hint: string;
  href: string;
  accent: string;
  /** Mobile quick-capture targets this flow with the camera open */
  capture?: boolean;
}

export const CREATE_OPTIONS: CreateOption[] = [
  {
    id: 'short',
    label: 'Short Video',
    emoji: '📹',
    description: 'Vertical · under 60s',
    hint: 'Loops · TikTok · Reels',
    href: '/create/video?format=portrait',
    accent: 'var(--color-accent-secondary)',
  },
  {
    id: 'long',
    label: 'Long Video',
    emoji: '🎬',
    description: 'Horizontal · full length',
    hint: 'YouTube · PeerTube',
    href: '/create/video?format=landscape',
    accent: 'var(--color-accent-tertiary)',
  },
  {
    id: 'live',
    label: 'Go Live',
    emoji: '🔴',
    description: 'Stream to every platform at once',
    hint: 'Vertical or horizontal',
    href: '/create/live',
    accent: '#ef4444',
  },
  {
    id: 'post',
    label: 'Write Post',
    emoji: '📝',
    description: 'Text + media, cross-posted',
    hint: 'All protocols at once',
    href: '/creator/posts',
    accent: 'var(--color-protocol-farcaster)',
  },
  {
    id: 'podcast',
    label: 'Record Podcast',
    emoji: '🎙️',
    description: 'Audio episodes for every ear',
    hint: 'RSS + podcast directories',
    href: '/creator/podcast',
    accent: 'var(--color-protocol-nostr)',
  },
];

export function createOption(id: CreateType): CreateOption {
  return CREATE_OPTIONS.find((o) => o.id === id) ?? SHORT_OPTION_FALLBACK;
}

const SHORT_OPTION_FALLBACK: CreateOption = {
  id: 'short',
  label: 'Short Video',
  emoji: '📹',
  description: 'Vertical · under 60s',
  hint: 'Loops · TikTok · Reels',
  href: '/create/video?format=portrait',
  accent: 'var(--color-accent-secondary)',
};
