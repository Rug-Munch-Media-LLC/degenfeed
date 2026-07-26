/**
 * @degenfeed/api-worker — Streaming Router Types & Constants
 */

export type StreamingMode = 'p2p' | 'owncast' | 'peertube' | 'livepeer' | 'cloudflare';

export interface SimulcastTarget {
  platform: string;
  streamKey?: string;
  rtmpUrl?: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'offline';
  lastChecked?: number;
  error?: string;
}

export interface BandwidthUsage {
  bytesUploaded: number;
  bytesDownloaded: number;
  estimatedCost: number;
  costCurrency: string;
  viewerHours: number;
  lastUpdated: number;
  perMode: Record<string, { bytes: number; cost: number }>;
}

export interface ActiveStream {
  streamId: string;
  creatorId: string;
  title: string;
  mode: StreamingMode;
  currentViewers: number;
  previousMode?: StreamingMode;
  switchedAt?: number;
  rtmpUrl?: string;
  streamKey?: string;
  playbackUrl?: string;
  embedUrl?: string;
  livepeerStreamId?: string;
  livepeerPlaybackId?: string;
  webrtcSessionId?: string;
  peertubeStreamId?: string;
  peertubeChannelId?: string;
  peertubeVideoUuid?: string;
  startedAt: number;
  lastViewerCount: number;
  lastViewerUpdate: number;
  autoSwitch: boolean;
  privacy: 'public' | 'unlisted' | 'private';
  tokenGated?: boolean;
  tokenAddress?: string;
  simulcastTargets?: SimulcastTarget[];
  ipfsVodCid?: string;
}

export interface StreamRouteDecision {
  recommendedMode: StreamingMode;
  reasons: string[];
  estimatedCost: string;
  estimatedCostPerHour: number;
  canUpgrade: boolean;
  canDowngrade: boolean;
  viewerThresholds: {
    current: number;
    next: number;
    previous: number;
  };
}

// ─── Cost & Threshold Constants ────────────────────────

export const COST_PER_MODE: Record<StreamingMode, { cost: string; description: string }> = {
  p2p: { cost: 'FREE', description: 'Peer-to-peer WebRTC (no bandwidth cost)' },
  owncast: { cost: '$0/mo (fixed server)', description: 'Self-hosted Owncast server' },
  peertube: { cost: '$0/mo (federated)', description: 'PeerTube Live (self-hosted)' },
  livepeer: { cost: '$0.003/viewer-hr', description: 'Livepeer decentralized CDN' },
  cloudflare: { cost: '$0.005/viewer-hr', description: 'Cloudflare Stream CDN' },
};

export const STREAMING_THRESHOLDS = {
  P2P_MAX: 10,
  OWNCAST_MAX: 50,
  PEERTUBE_MAX: 500,
  LIVEPEER_MAX: 5000,
  CLOUDFLARE_MIN: 5000,
};

export const MODE_LABELS: Record<StreamingMode, string> = {
  p2p: 'P2P (FREE)',
  owncast: 'Owncast',
  peertube: 'PeerTube',
  livepeer: 'Livepeer',
  cloudflare: 'Cloudflare',
};

export const MODE_EMOJIS: Record<StreamingMode, string> = {
  p2p: '🔗',
  owncast: '📡',
  peertube: '🎥',
  livepeer: '⛓️',
  cloudflare: '☁️',
};
