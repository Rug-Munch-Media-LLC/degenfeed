'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

/* === Types ============================================ */

export interface PeerTubeStreamData {
  id: string;
  title: string;
  tokenSymbol: string;
  embedUrl: string;
  chatUrl: string;
  playbackUrl: string;
  viewerCount: number;
  startedAt: number;
  state: 'waiting' | 'live' | 'ended' | 'error';
  tokenGated: boolean;
  isCreator: boolean;
}

export interface PeerTubeStreamResponse {
  active: boolean;
  stream: PeerTubeStreamData | null;
}

export interface PeerTubeStartOptions {
  title: string;
  description?: string;
  tokenSymbol?: string;
  minHoldRequirement?: number;
  tokenGated?: boolean;
  category?: number;
  tags?: string[];
}

export interface PeerTubeStartResult {
  stream: {
    id: string;
    title: string;
    streamKey: string;
    rtmpUrl: string;
    playbackUrl: string;
    embedUrl: string;
    chatUrl: string;
    isActive: boolean;
    viewerCount: number;
  };
  setup: {
    obs: {
      server: string;
      streamKey: string;
    };
    broadcasting: {
      software: string;
      instructions: string[];
    };
  };
}

export interface ChatMessage {
  id: string;
  displayName: string;
  accountName: string;
  walletAddress?: string;
  message: string;
  timestamp: number;
  isHolder?: boolean;
  isCreator?: boolean;
}

export interface ChatFetchResult {
  messages: ChatMessage[];
  total: number;
  nextCursor?: string;
}

export interface PeerTubeRecordingInfo {
  url: string;
  duration: number;
  resolution: string;
  size: number;
  ready: boolean;
  embedUrl: string;
  title: string;
}

export interface UsePeerTubeStreamResult {
  stream: PeerTubeStreamData | null;
  isLoading: boolean;
  isError: boolean;
  isLive: boolean;
  viewerCount: number;
  /** Start a new PeerTube livestream. */
  startStream: (opts: PeerTubeStartOptions) => Promise<PeerTubeStartResult>;
  /** End the current livestream. */
  endStream: () => Promise<void>;
  /** Fetch chat messages. */
  fetchChat: (cursor?: string) => Promise<ChatFetchResult>;
  /** Send a chat message. */
  sendChat: (message: string) => Promise<void>;
  /** Fetch the VOD recording after stream ends. */
  fetchRecording: () => Promise<PeerTubeRecordingInfo | null>;
  /** Get past streams for the token. */
  fetchHistory: (limit?: number) => Promise<StreamHistoryItem[]>;
  /** Refresh stream data. */
  refresh: () => void;
  /** OBS setup instructions. */
  obsSetup: {
    server: string;
    streamKey: string;
  } | null;
  /** Time since stream started (ms). */
  streamDuration: number;
}

export interface StreamHistoryItem {
  id: string;
  uuid: string;
  title: string;
  publishedAt: string;
  duration: number;
  views: number;
  thumbnailUrl: string | null;
  embedUrl: string;
}

/* === Fetcher ========================================== */

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/* === Hook ============================================= */

export function usePeerTubeStream(
  tokenAddress: string,
  tokenSymbol?: string,
): UsePeerTubeStreamResult {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<PeerTubeStreamResponse>(
    tokenAddress ? `/api/token/${tokenAddress}/peertube` : null,
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10s for viewer count
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  const [obsSetup, setObsSetup] = useState<{
    server: string;
    streamKey: string;
  } | null>(null);

  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);

  // Track stream duration
  useEffect(() => {
    if (data?.stream?.startedAt) {
      setStreamStartTime(data.stream.startedAt);
    }
  }, [data?.stream?.startedAt]);

  useEffect(() => {
    if (!streamStartTime) return;
    const interval = setInterval(() => {
      setStreamDuration(Date.now() - streamStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStartTime]);

  const stream = data?.stream ?? null;
  const isLive = data?.active ?? false;
  const viewerCount = stream?.viewerCount ?? 0;

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const startStream = useCallback(
    async (opts: PeerTubeStartOptions): Promise<PeerTubeStartResult> => {
      const res = await fetch(`/api/token/${tokenAddress}/peertube/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: opts.title,
          description: opts.description,
          tokenSymbol: opts.tokenSymbol ?? tokenSymbol,
          minHoldRequirement: opts.minHoldRequirement ?? 0,
          tokenGated: opts.tokenGated ?? false,
          category: opts.category ?? 13,
          tags: opts.tags ?? [],
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const result = (await res.json()) as PeerTubeStartResult;
      setObsSetup({
        server: result.setup.obs.server,
        streamKey: result.setup.obs.streamKey,
      });

      // Refresh stream data immediately
      await mutate();

      return result;
    },
    [tokenAddress, tokenSymbol, mutate],
  );

  const endStream = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/token/${tokenAddress}/peertube/end`, {
      method: 'POST',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    setObsSetup(null);

    // Refresh to show ended state
    await mutate();
  }, [tokenAddress, mutate]);

  const fetchChat = useCallback(
    async (cursor?: string): Promise<ChatFetchResult> => {
      const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const res = await fetch(
        `/api/token/${tokenAddress}/peertube/chat${params}`,
      );

      if (!res.ok) throw new Error(`Failed to fetch chat: HTTP ${res.status}`);
      return res.json() as Promise<ChatFetchResult>;
    },
    [tokenAddress],
  );

  const sendChat = useCallback(
    async (message: string): Promise<void> => {
      const res = await fetch(`/api/token/${tokenAddress}/peertube/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
    },
    [tokenAddress],
  );

  const fetchRecording = useCallback(async (): Promise<PeerTubeRecordingInfo | null> => {
    const res = await fetch(`/api/token/${tokenAddress}/peertube/recording`);

    if (!res.ok) return null;

    const result = (await res.json()) as {
      recording: PeerTubeRecordingInfo | null;
      message?: string;
    };
    return result.recording;
  }, [tokenAddress]);

  const fetchHistory = useCallback(
    async (limit = 10): Promise<StreamHistoryItem[]> => {
      const res = await fetch(
        `/api/token/${tokenAddress}/peertube/history?limit=${limit}&tokenSymbol=${tokenSymbol ?? ''}`,
      );

      if (!res.ok) return [];

      const result = (await res.json()) as {
        streams: StreamHistoryItem[];
        total: number;
      };
      return result.streams;
    },
    [tokenAddress, tokenSymbol],
  );

  return {
    stream,
    isLoading,
    isError: !!error,
    isLive,
    viewerCount,
    startStream,
    endStream,
    fetchChat,
    sendChat,
    fetchRecording,
    fetchHistory,
    refresh,
    obsSetup,
    streamDuration,
  };
}
