'use client';

import useSWR from 'swr';

/* === Types ==================================================== */

export type StreamType = 'solo' | 'spaces' | 'collab' | 'launch';

export interface LiveStream {
  id: string;
  title: string;
  creatorId: string;
  creatorHandle: string;
  creatorAvatar?: string;
  streamType: StreamType;
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
}

export interface LiveStreamsResponse {
  streams: LiveStream[];
  featured: LiveStream[];
  total: number;
}

/* === Fetcher ================================================== */

const fetcher = async (url: string): Promise<LiveStreamsResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch live streams: ${res.status}`);
  return res.json() as Promise<LiveStreamsResponse>;
};

/* === Fallback mock data ======================================= */

function generateMockStreams(): LiveStreamsResponse {
  const now = Date.now();
  const types: StreamType[] = ['solo', 'spaces', 'collab', 'launch'];
  const titles = [
    'DeFi Alpha Call — L2 Summer is Here!',
    'Solana Ecosystem Deep Dive 🚀',
    'NFT Market Analysis — Buy the Dip?',
    'Trading Room: BTC / ETH Technicals',
    'Building on Base — Live Coding',
    'Meme Coin Watch Party 🐸',
    'AI × Crypto Panel Discussion',
    'Yield Farming Strategies 2026',
    'Wallet Security Best Practices',
    'DePIN Projects to Watch',
    'On-Chain Analytics Masterclass',
    'Validator Operations Chat',
  ];
  const creators = [
    { id: 'c1', handle: 'defi_degen', avatar: '' },
    { id: 'c2', handle: 'sol_whale', avatar: '' },
    { id: 'c3', handle: 'nft_collector', avatar: '' },
    { id: 'c4', handle: 'crypto_analyst', avatar: '' },
    { id: 'c5', handle: 'base_builder', avatar: '' },
    { id: 'c6', handle: 'meme_lord', avatar: '' },
    { id: 'c7', handle: 'ai_researcher', avatar: '' },
    { id: 'c8', handle: 'yield_farmer', avatar: '' },
  ];

  const featured: LiveStream[] = [];
  const streams: LiveStream[] = [];

  for (let i = 0; i < 12; i++) {
    const creator = creators[i % creators.length];
    const type = types[i % types.length];
    const isFeatured = i < 4;

    const stream: LiveStream = {
      id: `stream-${i + 1}`,
      title: titles[i % titles.length],
      creatorId: creator.id,
      creatorHandle: creator.handle,
      creatorAvatar: creator.avatar,
      streamType: type,
      viewerCount: Math.floor(Math.random() * 2500) + 12,
      thumbnailUrl: undefined,
      isLive: true,
      startedAt: now - Math.floor(Math.random() * 7200000),
      tokenAddress: type === 'launch' ? `0x${Math.random().toString(16).slice(2, 42)}` : undefined,
      tokenSymbol:
        type === 'launch' ? ['DEGEN', 'MEME', 'SOL', 'PEPE', 'DOGE', 'BONK'][i % 6] : undefined,
      bondingCurveProgress: type === 'launch' ? Math.floor(Math.random() * 100) : undefined,
      tags: ['crypto', 'defi', type].filter(Boolean),
    };

    if (type === 'spaces') {
      stream.space = {
        speakers: [
          {
            userId: creator.id,
            displayName: creator.handle,
            avatarUrl: creator.avatar,
            isMuted: false,
            isHost: true,
          },
          {
            userId: `sp${i}`,
            displayName: `Speaker ${i + 1}`,
            avatarUrl: undefined,
            isMuted: Math.random() > 0.5,
            isHost: false,
          },
          {
            userId: `sp${i + 1}`,
            displayName: `Speaker ${i + 2}`,
            avatarUrl: undefined,
            isMuted: Math.random() > 0.5,
            isHost: false,
          },
        ],
        listenerCount: Math.floor(Math.random() * 800) + 20,
      };
    }

    if (isFeatured) {
      featured.push(stream);
    }
    streams.push(stream);
  }

  // Shuffle streams for variety
  for (let i = streams.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [streams[i], streams[j]] = [streams[j], streams[i]];
  }

  return { streams, featured, total: streams.length };
}

/* === Hook ===================================================== */

export function useLiveStreams() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<LiveStreamsResponse>(
    '/api/streams/live',
    fetcher,
    {
      refreshInterval: 10000, // Poll every 10s
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      fallbackData: generateMockStreams(),
      onError: () => {
        // Use mock data on error (already set via fallbackData)
      },
    },
  );

  return {
    streams: data?.streams ?? [],
    featured: data?.featured ?? [],
    total: data?.total ?? 0,
    isLoading,
    isValidating,
    isError: !!error,
    refresh: mutate,
  };
}
