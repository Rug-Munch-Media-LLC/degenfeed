/**
 * @degenfeed/web — Media Hub Types
 *
 * Shared types for the unified media feed (image, video, live).
 * Re-exports VisualPost with convenient aliases.
 */

import type { VisualPost } from '@degenfeed/types';

/** Filter mode for the media feed tabs */
export type MediaFilter = 'all' | 'images' | 'videos' | 'live';

/** A processed media item ready for the masonry grid */
export interface MediaFeedItem {
  /** The canonical visual post data */
  post: VisualPost;
  /** Computed aspect ratio for layout (clamped 0.5–3) */
  displayAspectRatio: number;
  /** Grid column span hint: 1 (normal) or 2 (featured/wide) */
  colSpan?: 1 | 2;
}

/** Tab descriptor for the media feed */
export interface MediaTabConfig {
  id: MediaFilter;
  label: string;
  icon: string;
  description: string;
}

export const MEDIA_TABS: MediaTabConfig[] = [
  {
    id: 'all',
    label: 'All',
    icon: '◆',
    description: 'Every image, video, and live stream in one place',
  },
  {
    id: 'images',
    label: 'Images',
    icon: '📷',
    description: 'Photos from Bluesky, Pixelfed, Zora NFTs, and Nostr',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: '▶',
    description: 'PeerTube, YouTube, and video embeds from every protocol',
  },
  {
    id: 'live',
    label: 'Live',
    icon: '●',
    description: 'Live streams from Owncast, PeerTube live, and more',
  },
];

/** Source metadata for badge display */
export interface SourceMeta {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export const MEDIA_SOURCES: Record<string, SourceMeta> = {
  pixelfed: { id: 'pixelfed', label: 'Pixelfed', color: '#f9a825', icon: '📷' },
  bluesky: { id: 'bluesky', label: 'Bluesky', color: '#1185fe', icon: '🦋' },
  zora: { id: 'zora', label: 'Zora', color: '#6b21a8', icon: '🎨' },
  nostr: { id: 'nostr', label: 'Nostr', color: '#8e30eb', icon: '⚡' },
  peertube: { id: 'peertube', label: 'PeerTube', color: '#f1680d', icon: '🎬' },
  farcaster: { id: 'farcaster', label: 'Farcaster', color: '#8a63d2', icon: '◈' },
  lens: { id: 'lens', label: 'Lens', color: '#abfe2c', icon: '🌿' },
  mastodon: { id: 'mastodon', label: 'Mastodon', color: '#6364ff', icon: '🐘' },
  youtube: { id: 'youtube', label: 'YouTube', color: '#ff0000', icon: '▶' },
  owncast: { id: 'owncast', label: 'Owncast', color: '#4adf8b', icon: '●' },
  twitch: { id: 'twitch', label: 'Twitch', color: '#9146ff', icon: '●' },
};
