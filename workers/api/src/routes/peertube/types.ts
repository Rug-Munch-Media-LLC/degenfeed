/**
 * @degenfeed/api-worker — PeerTube Types
 */

export interface PeerTubeVideo {
  id: number;
  uuid: string;
  shortUUID?: string;
  name: string;
  description?: string;
  shortDescription?: string;
  isLive: boolean;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  publishedAt: string;
  updatedAt: string;
  category?: { id: number; label: string } | null;
  licence?: { id: number; label: string } | null;
  language?: { id: number; label: string } | null;
  privacy?: { id: number; label: string };
  nsfw: boolean;
  url: string;
  thumbnailPath: string | null;
  previewPath: string | null;
  embedPath: string;
  tags: string[];
  channel?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar: { path: string } | null;
  } | null;
  account?: {
    id: number;
    name: string;
    displayName: string;
    url: string;
    avatar: { path: string } | null;
  } | null;
  files?: Array<{
    id: number;
    resolution: { id: number; label: string };
    size: number;
    fileUrl: string;
  }>;
  liveInfo?: {
    viewerCount: number;
    health: 'good' | 'bad' | 'unknown';
    state: 'waiting' | 'live' | 'ended' | 'error';
  };
}

export interface PeerTubeChannel {
  id: number;
  name: string;
  displayName: string;
  description: string;
  support?: string;
  url: string;
  avatar: { path: string } | null;
  videosCount: number;
  viewsCount: number;
  followersCount: number;
  createdAt: string;
  ownerAccount?: { id: number; name: string; displayName: string; url: string } | null;
}

export interface PaginatedResponse<T> {
  total: number;
  data: T[];
}

export const PEERTUBE_DEFAULT = 'https://video.degenfeed.xyz';

export const PEERTUBE_CATEGORIES: Record<number, string> = {
  1: 'Music',
  2: 'Films',
  3: 'Comics',
  4: 'Books',
  5: 'Science & Technology',
  6: 'Sports',
  7: 'Lifestyle',
  8: 'Art',
  9: 'Gaming',
  10: 'Entertainment',
  11: 'News & Politics',
  12: 'Education',
  13: 'Tech',
  14: 'Crypto & Web3',
};
