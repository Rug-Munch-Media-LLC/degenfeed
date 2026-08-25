/**
 * @degenfeed/api-worker — Creator Video Types
 */

/** PeerTube numeric privacy enum */
export type PeerTubePrivacy = 1 | 2 | 3;

export interface CreatorVideoMeta {
  uuid: string;
  title: string;
  description: string;
  /** PeerTube numeric privacy enum (1=public, 2=unlisted, 3=private) */
  privacy: PeerTubePrivacy;
  /** PeerTube numeric category id (11=Entertainment, 13=Tech, …) */
  category: number;
  duration: number;
  tags: string[];
  isShort: boolean;
  thumbnailUrl: string | null;
  url?: string;
  embedUrl?: string;
  publishedAt?: string;
  uploadedAt?: number;
  state?: 'pending' | 'processing' | 'ready' | 'failed';
  tipsUsdCents?: number;
  tipCount?: number;
  peertubeId?: string;
  peertubeUrl?: string;
  creatorAddress?: string;
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
  /** Daily view counts keyed by ISO date */
  viewsOverTime?: Record<string, number>;
  /** Daily tip totals (USD cents) keyed by ISO date */
  tipsOverTime?: Record<string, number>;
  /** Views per traffic source */
  sourceBreakdown?: Record<string, number>;
  /** Views per sharing protocol */
  protocolBreakdown?: Record<string, number>;
  /** Fraction of viewers who finished the video (0-1) */
  completionRate?: number;
}
