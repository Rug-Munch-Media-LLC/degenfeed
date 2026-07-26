/**
 * @degenfeed/api-worker — Creator Video Types
 */

export interface CreatorVideoMeta {
  uuid: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  privacy: 'public' | 'unlisted' | 'private';
  category: string;
  tags: string[];
  isShort: boolean;
  peertubeId?: string;
  peertubeUrl?: string;
  createdAt: number;
  updatedAt: number;
  views: number;
  likes: number;
  shares: number;
}

export interface VideoAnalytics {
  uuid: string;
  views: number;
  uniqueViewers: number;
  likes: number;
  shares: number;
  comments: number;
  avgWatchTime: number;
  revenue: number;
  revenueToken: string;
  timestamps: Record<string, number>;
}
