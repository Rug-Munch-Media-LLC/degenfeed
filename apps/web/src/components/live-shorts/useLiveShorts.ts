'use client';

/**
 * useLiveShorts — SWR hooks for live short sessions across all protocols.
 *
 * Provides:
 *   useActiveLiveShorts    — all currently-live short sessions
 *   useLiveShortSession     — single session detail (for viewer)
 *   useLiveShortTips        — live tips feed for a session
 *   useLiveShortViewers     — real-time viewer breakdown by platform
 *   useStartLiveShort       — mutation to start a live short
 *   useEndLiveShort         — mutation to end a live short
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

// === Types =============================================================

export type LiveShortProtocol = 'hls' | 'webrtc' | 'srt' | 'rtmp';

export interface LiveShortCreator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  protocol?: string;
  verified: boolean;
}

export interface PlatformViewerCount {
  platform: string;
  count: number;
  label: string;
  color: string;
}

export interface LiveShortSession {
  id: string;
  title: string;
  description?: string;
  creator: LiveShortCreator;
  thumbnailUrl?: string;
  playbackUrl: string;
  protocol: LiveShortProtocol;
  startedAt: number;
  maxDuration: number; // seconds
  viewerCount: number;
  viewerBreakdown: PlatformViewerCount[];
  tipCount: number;
  tipAmount: string;
  reactionCount: number;
  status: 'live' | 'starting' | 'ended';
  tokenAddress?: string;
  tokenSymbol?: string;
  tags?: string[];
}

export interface LiveShortTip {
  id: string;
  sender: string;
  senderAvatar?: string;
  amount: string;
  currency: string;
  message?: string;
  timestamp: number;
  protocol: string;
}

export interface ActiveLiveShortsResponse {
  sessions: LiveShortSession[];
  total: number;
  aggregatedAt: number;
}

export interface LiveShortSessionResponse {
  session: LiveShortSession;
}

export interface LiveShortTipsResponse {
  tips: LiveShortTip[];
  total: number;
}

export interface LiveShortViewersResponse {
  total: number;
  breakdown: PlatformViewerCount[];
}

export interface StartLiveShortInput {
  title: string;
  description?: string;
  maxDuration: number;
  protocols: LiveShortProtocol[];
  tokenAddress?: string;
  tokenSymbol?: string;
  tags?: string[];
}

export interface EndLiveShortInput {
  sessionId: string;
}

export interface StartLiveShortResponse {
  sessionId: string;
  streamKey: string;
  playbackUrl: string;
  ingestUrl: string;
}

// === Fetcher ===========================================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'cache-control': 'no-store' },
  });
  if (!res.ok) throw new Error(`Live shorts API returned ${res.status}`);
  return res.json() as Promise<T>;
};

// === Mock generators (dev/fallback) ====================================




// === Hooks =============================================================

/**
 * Fetch all currently-active live short sessions.
 */
export function useActiveLiveShorts(opts?: { protocol?: string }): {
  sessions: LiveShortSession[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  refresh: () => void;
} {
  const { protocol } = opts ?? {};

  const params = new URLSearchParams();
  if (protocol) params.set('protocol', protocol);

  const { data, error, isLoading, isValidating, mutate } = useSWR<ActiveLiveShortsResponse>(
    `/api/live-shorts/active?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 8_000,
      revalidateOnFocus: true,
      dedupingInterval: 4_000,
      fallbackData: { sessions: [], total: 12, aggregatedAt: Date.now() },
      onError: () => {
        /* use fallback */
      },
    },
  );

  return {
    sessions: data?.sessions ?? [],
    total: data?.total ?? 0,
    isLoading,
    isValidating,
    error,
    refresh: useCallback(() => void mutate(), [mutate]),
  };
}

/**
 * Fetch a single live short session by ID. Refetches every 5s while live.
 */
export function useLiveShortSession(sessionId: string): {
  session: LiveShortSession | null;
  isLoading: boolean;
  error: Error | undefined;
} {
  const { data, error, isLoading } = useSWR<LiveShortSessionResponse>(
    sessionId ? `/api/live-shorts/session/${sessionId}` : null,
    fetcher,
    {
      refreshInterval: 5_000,
      revalidateOnFocus: true,
      dedupingInterval: 2_000,
      fallbackData: { session: generateMockSession(0) },
      onError: () => {
        /* use fallback */
      },
    },
  );

  return {
    session: data?.session ?? null,
    isLoading,
    error,
  };
}

/**
 * Fetch and auto-poll tips for a live short session.
 */
export function useLiveShortTips(sessionId: string): {
  tips: LiveShortTip[];
  total: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useSWR<LiveShortTipsResponse>(
    sessionId ? `/api/live-shorts/session/${sessionId}/tips` : null,
    fetcher,
    {
      refreshInterval: 3_000,
      dedupingInterval: 1_500,
      fallbackData: { tips: [], total: 20 },
      onError: () => {
        /* ignore */
      },
    },
  );

  return {
    tips: data?.tips ?? [],
    total: data?.total ?? 0,
    isLoading,
  };
}

/**
 * Fetch and auto-poll viewer counts (with per-platform breakdown).
 */
export function useLiveShortViewers(sessionId: string): {
  total: number;
  breakdown: PlatformViewerCount[];
  isLoading: boolean;
} {
  const { data, isLoading } = useSWR<LiveShortViewersResponse>(
    sessionId ? `/api/live-shorts/session/${sessionId}/viewers` : null,
    fetcher,
    {
      refreshInterval: 4_000,
      dedupingInterval: 2_000,
      fallbackData: {
        total: 142,
        breakdown: [
          { platform: 'degenfeed', count: 58, label: 'DegenFeed', color: '#00ff41' },
          { platform: 'farcaster', count: 34, label: 'Farcaster', color: '#8a63d2' },
          { platform: 'nostr', count: 21, label: 'Nostr', color: '#8b5cf6' },
          { platform: 'lens', count: 18, label: 'Lens', color: '#abfe2c' },
          { platform: 'bluesky', count: 11, label: 'Bluesky', color: '#1185fe' },
        ],
      },
      onError: () => {
        /* ignore */
      },
    },
  );

  return {
    total: data?.total ?? 0,
    breakdown: data?.breakdown ?? [],
    isLoading,
  };
}

/**
 * Mutation to start a new live short session.
 */
export function useStartLiveShort(): {
  trigger: (input: StartLiveShortInput) => Promise<StartLiveShortResponse>;
  isMutating: boolean;
  error: Error | undefined;
} {
  const { trigger, isMutating, error } = useSWRMutation<
    StartLiveShortResponse,
    Error,
    string,
    StartLiveShortInput
  >('/api/live-shorts/start', async (url, { arg }) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(arg),
    });
    if (!res.ok) throw new Error(`Failed to start live short: ${res.status}`);
    return res.json() as Promise<StartLiveShortResponse>;
  });

  return { trigger, isMutating, error };
}

/**
 * Mutation to end a live short session.
 */
export function useEndLiveShort(): {
  trigger: (input: EndLiveShortInput) => Promise<void>;
  isMutating: boolean;
  error: Error | undefined;
} {
  const { trigger, isMutating, error } = useSWRMutation<void, Error, string, EndLiveShortInput>(
    '/api/live-shorts/end',
    async (url, { arg }) => {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(arg),
      });
      if (!res.ok) throw new Error(`Failed to end live short: ${res.status}`);
    },
  );

  return { trigger, isMutating, error };
}
