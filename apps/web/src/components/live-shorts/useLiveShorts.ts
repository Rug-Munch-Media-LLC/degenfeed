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

function generateMockSession(idx: number): LiveShortSession {
  const now = Date.now();
  const creators: LiveShortCreator[] = [
    { id: 'c1', handle: 'defi_degen', displayName: 'DeFi Degen', avatarUrl: '', verified: true },
    { id: 'c2', handle: 'sol_whale', displayName: 'Sol Whale', avatarUrl: '', verified: false },
    { id: 'c3', handle: 'nft_queen', displayName: 'NFT Queen', avatarUrl: '', verified: true },
    {
      id: 'c4',
      handle: 'crypto_analyst',
      displayName: 'Crypto Analyst',
      avatarUrl: '',
      verified: false,
    },
    { id: 'c5', handle: 'meme_lord', displayName: 'Meme Lord', avatarUrl: '', verified: false },
    {
      id: 'c6',
      handle: 'yield_farmer',
      displayName: 'Yield Farmer',
      avatarUrl: '',
      verified: true,
    },
    {
      id: 'c7',
      handle: 'base_builder',
      displayName: 'Base Builder',
      avatarUrl: '',
      verified: false,
    },
    {
      id: 'c8',
      handle: 'token_whisperer',
      displayName: 'Token Whisperer',
      avatarUrl: '',
      verified: false,
    },
  ];

  const titles = [
    'DeFi Alpha RIGHT NOW 🔥',
    'Solana memecoin watch 📈',
    'BTC analysis — live charting',
    'Base ecosystem deep dive',
    "Trading signals — don't miss!",
    'NFT mint happening NOW',
    'ETH L2 comparison live',
    'Alt season or nah?',
  ];

  const creatorIndex = idx % creators.length;
  const creator = creators[creatorIndex] ?? creators[0]!;

  return {
    id: `liveshort-${idx + 1}`,
    title: titles[idx % titles.length] ?? 'Live Short',
    description: `Join ${creator.displayName} for an exclusive live short!`,
    creator,
    thumbnailUrl: '',
    playbackUrl: `https://stream.degenfeed.example/live/${creator.handle}/index.m3u8`,
    protocol: 'hls',
    startedAt: now - Math.floor(Math.random() * 1800000),
    maxDuration: 60,
    viewerCount: Math.floor(Math.random() * 1200) + 10,
    viewerBreakdown: [
      {
        platform: 'degenfeed',
        count: Math.floor(Math.random() * 300) + 5,
        label: 'DegenFeed',
        color: '#00ff41',
      },
      {
        platform: 'farcaster',
        count: Math.floor(Math.random() * 200) + 3,
        label: 'Farcaster',
        color: '#8a63d2',
      },
      {
        platform: 'nostr',
        count: Math.floor(Math.random() * 100) + 1,
        label: 'Nostr',
        color: '#8b5cf6',
      },
      {
        platform: 'lens',
        count: Math.floor(Math.random() * 150) + 2,
        label: 'Lens',
        color: '#abfe2c',
      },
      {
        platform: 'bluesky',
        count: Math.floor(Math.random() * 80) + 1,
        label: 'Bluesky',
        color: '#1185fe',
      },
    ],
    tipCount: Math.floor(Math.random() * 25),
    tipAmount: `${(Math.random() * 5).toFixed(2)} SOL`,
    reactionCount: Math.floor(Math.random() * 200),
    status: 'live',
    tags: ['live', 'crypto', 'alpha'],
  };
}

function generateMockSessions(count = 12): LiveShortSession[] {
  return Array.from({ length: count }, (_, i) => generateMockSession(i));
}

function generateMockTips(count = 20): LiveShortTip[] {
  const names = [
    'alice.eth',
    'bob.nostr',
    'charlie.lens',
    'diana.bsky',
    'eve.farc',
    'frank.eth',
    'grace.sol',
    'harry.btc',
  ];
  const currencies = ['ETH', 'SOL', 'DEGEN', 'USDC', 'BTC'];
  const protocols = ['ethereum', 'solana', 'lightning', 'base', 'polygon'];
  const messages = [
    'LFG! 🔥',
    'WAGMI 💎',
    'Great content!',
    'Bullish 🚀',
    'Keep it up!',
    '',
    '',
    '',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `tip-${i + 1}`,
    sender: names[i % names.length] ?? 'anonymous',
    senderAvatar: undefined,
    amount: (Math.random() * 2).toFixed(3),
    currency: currencies[i % currencies.length] ?? 'ETH',
    message: messages[i % messages.length] || undefined,
    timestamp: Date.now() - Math.floor(Math.random() * 60000),
    protocol: protocols[i % protocols.length] ?? 'ethereum',
  }));
}

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
      fallbackData: { sessions: generateMockSessions(), total: 12, aggregatedAt: Date.now() },
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
      fallbackData: { tips: generateMockTips(), total: 20 },
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
