'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

/* === Types ============================================ */

export interface TokenStream {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  creator: string;
  title: string;
  streamType: 'video' | 'audio' | 'spaces';
  streamUrl: string;
  minHoldRequirement: number;
  viewerCount: number;
  startedAt: number;
  isActive: boolean;
}

export interface StreamStartOptions {
  title: string;
  streamType: 'video' | 'audio' | 'spaces';
  minHold?: number;
  tokenSymbol?: string;
  streamUrl?: string;
}

export interface StreamJoinResult {
  streamUrl: string;
  accessToken: string;
  streamId: string;
  title: string;
}

export interface UseTokenStreamsResult {
  stream: TokenStream | null;
  isLoading: boolean;
  isError: boolean;
  isLive: boolean;
  viewerCount: number;
  startStream: (opts: StreamStartOptions) => Promise<TokenStream>;
  endStream: () => Promise<void>;
  joinStream: () => Promise<StreamJoinResult>;
  refresh: () => void;
}

/* === Hook ============================================= */

export function useActiveStream(tokenAddress: string): {
  stream: TokenStream | null;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, error, isLoading } = useSWR<{ active: boolean } & TokenStream>(
    tokenAddress ? `/api/token/${tokenAddress}/stream` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch stream');
      return res.json() as Promise<{ active: boolean } & TokenStream>;
    },
    {
      refreshInterval: 15000, // Poll every 15s
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  return {
    stream: data && 'active' in data && data.active ? (data as TokenStream) : null,
    isLoading,
    isError: !!error,
  };
}

export function useTokenStreams(tokenAddress: string): UseTokenStreamsResult {
  const { stream, isLoading, isError } = useActiveStream(tokenAddress);
  const [viewerCount, setViewerCount] = useState(0);

  // Sync viewer count from stream data
  useEffect(() => {
    if (stream?.viewerCount !== undefined) {
      setViewerCount(stream.viewerCount);
    }
  }, [stream?.viewerCount]);

  const refresh = useCallback(() => {
    // SWR handles revalidation automatically via mutate
  }, []);

  const startStream = useCallback(
    async (opts: StreamStartOptions): Promise<TokenStream> => {
      const res = await fetch(`/api/token/${tokenAddress}/stream/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: opts.title,
          streamType: opts.streamType,
          minHoldRequirement: opts.minHold || 0,
          tokenSymbol: opts.tokenSymbol,
          streamUrl: opts.streamUrl,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error || `HTTP ${res.status}`,
        );
      }

      const newStream = (await res.json()) as TokenStream;
      return newStream;
    },
    [tokenAddress],
  );

  const endStream = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/token/${tokenAddress}/stream/end`, {
      method: 'POST',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error || `HTTP ${res.status}`,
      );
    }
  }, [tokenAddress]);

  const joinStream = useCallback(async (): Promise<StreamJoinResult> => {
    const res = await fetch(`/api/token/${tokenAddress}/stream/join`, {
      method: 'POST',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error || `HTTP ${res.status}`,
      );
    }

    return (await res.json()) as StreamJoinResult;
  }, [tokenAddress]);

  return {
    stream,
    isLoading,
    isError,
    isLive: stream?.isActive ?? false,
    viewerCount,
    startStream,
    endStream,
    joinStream,
    refresh,
  };
}
