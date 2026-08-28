'use client';

import useSWR from 'swr';

/* === Types ==================================================== */

export type StreamType = 'solo' | 'spaces' | 'collab' | 'launch';

/** Live stream source name matching backend LiveSource */
export type StreamSource =
  | 'owncast'
  | 'peertube'
  | 'youtube'
  | 'twitch'
  | 'kick'
  | 'spaces'
  | 'farcaster'
  | 'nostr'
  | 'degenfeed'
  | 'lens'
  | 'zora';

/** Frontend-optimized live stream type with source info */
export interface LiveStream {
  id: string;
  title: string;
  creatorId: string;
  creatorHandle: string;
  creatorAvatar?: string;
  streamType: StreamType;
  /** Source platform (maps to backend LiveSource) */
  source: StreamSource;
  /** Human-readable source label */
  sourceLabel: string;
  /** Source brand color */
  sourceColor: string;
  viewerCount: number;
  thumbnailUrl?: string;
  isLive: boolean;
  startedAt: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  bondingCurveProgress?: number; // 0–100
  tags?: string[];
  space?: {
    speakers: Array<{
      userId: string;
      displayName: string;
      avatarUrl?: string;
      isMuted: boolean;
      isHost: boolean;
    }>;
    listenerCount: number;
  };
  /** Platform-specific metadata */
  platformMeta?: Record<string, unknown>;
}

export interface LiveStreamsResponse {
  streams: LiveStream[];
  featured: LiveStream[];
  total: number;
  /** Aggregated source counts */
  sourceCounts: Record<string, number>;
  /** Category counts */
  categoryCounts: Record<string, number>;
}

/* === Source Config ============================================ */

export const SOURCE_CONFIG: Record<
  StreamSource,
  { label: string; color: string; icon: string; bgClass: string }
> = {
  twitch: {
    label: 'Twitch',
    color: '#9146FF',
    icon: '📺',
    bgClass: 'bg-purple-500/15 text-purple-400',
  },
  kick: {
    label: 'Kick',
    color: '#53FC18',
    icon: '🎲',
    bgClass: 'bg-green-500/15 text-green-400',
  },
  peertube: {
    label: 'PeerTube',
    color: '#F1684B',
    icon: '🎥',
    bgClass: 'bg-orange-500/15 text-orange-400',
  },
  owncast: {
    label: 'Owncast',
    color: '#00ff41',
    icon: '📡',
    bgClass: 'bg-green-500/15 text-green-400',
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    icon: '▶️',
    bgClass: 'bg-red-500/15 text-red-400',
  },
  spaces: {
    label: 'Spaces',
    color: '#00BCD4',
    icon: '🎙️',
    bgClass: 'bg-cyan-500/15 text-cyan-400',
  },
  farcaster: {
    label: 'Farcaster',
    color: '#8A63D2',
    icon: '📱',
    bgClass: 'bg-indigo-500/15 text-indigo-400',
  },
  nostr: {
    label: 'Nostr',
    color: '#E87928',
    icon: '⚡',
    bgClass: 'bg-amber-500/15 text-amber-400',
  },
  degenfeed: {
    label: 'DegenFeed',
    color: '#00ff41',
    icon: '🔴',
    bgClass: 'bg-green-500/15 text-green-400',
  },
  lens: {
    label: 'Lens',
    color: '#ABFE2C',
    icon: '👁️',
    bgClass: 'bg-lime-500/15 text-lime-400',
  },
  zora: {
    label: 'Zora',
    color: '#2D7FE5',
    icon: '💎',
    bgClass: 'bg-blue-500/15 text-blue-400',
  },
};

/* === Fetcher ================================================== */

const fetcher = async (url: string): Promise<LiveStreamsResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch live streams: ${res.status}`);
  return res.json() as Promise<LiveStreamsResponse>;
};

/* === API-to-Frontend Converter ================================ */

/* === Hook ===================================================== */

export function useLiveStreams() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<LiveStreamsResponse>(
    '/api/streams/live',
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10s
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      fallbackData: { streams: [], featured: [], total: 0, sourceCounts: {}, categoryCounts: {} },
      onError: () => {
        // Use fallback data on error (already set via fallbackData)
      },
    },
  );

  return {
    streams: data?.streams ?? [],
    featured: data?.featured ?? [],
    total: data?.total ?? 0,
    sourceCounts: data?.sourceCounts ?? {},
    categoryCounts: data?.categoryCounts ?? {},
    isLoading,
    isValidating,
    isError: !!error,
    refresh: mutate,
  };
}
