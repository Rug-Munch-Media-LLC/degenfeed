/**
 * @degenfeed/web — Bluesky Media View Types
 */

// ─── Tab Configuration ───────────────────────────────────────────

export type TabId = 'images' | 'videos' | 'trending';

export interface TabConfig {
  id: TabId;
  label: string;
  endpoint: string;
  icon: string;
}

export const TABS: TabConfig[] = [
  { id: 'images', label: 'Images', endpoint: '/api/feed/bluesky/images', icon: '📷' },
  { id: 'videos', label: 'Videos', endpoint: '/api/feed/bluesky/videos', icon: '▶' },
  { id: 'trending', label: 'Trending', endpoint: '/api/feed/bluesky/trending', icon: '🔥' },
];

export const BLUESKY_BLUE = '#1185fe';
export const POSTS_PER_PAGE = 30;

// ─── Media Item ──────────────────────────────────────────────────

export interface MediaItem {
  url: string;
  thumb?: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}
