'use client';

/**
 * @degenfeed/web — Gift Leaderboard
 *
 * Top gifters display for live streams.
 * Shows real-time ranking of tip/gift senders.
 */

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';

// ─── Types ───────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  senderId: string;
  senderLabel: string;
  totalUsd: number;
  totalSats: number;
  giftCount: number;
  topGift: { giftTypeId: string; count: number } | null;
}

interface LeaderboardResponse {
  streamId: string;
  leaderboard: LeaderboardEntry[];
  totalSats: number;
  totalUsd: number;
  totalGifts: number;
  uniqueGifters: number;
}

interface GiftTypeLookup {
  [key: string]: { icon: string; name: string };
}

// ─── Fetcher ──────────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
};

// Use a shared gift type cache
const GIFT_ICONS: GiftTypeLookup = {
  rose: { icon: '🌹', name: 'Rose' },
  balloon: { icon: '🎈', name: 'Balloon' },
  diamond: { icon: '💎', name: 'Diamond' },
  rocket: { icon: '🚀', name: 'Rocket' },
  crown: { icon: '👑', name: 'Crown' },
  whale: { icon: '🐳', name: 'Whale' },
};

// ─── Props ────────────────────────────────────────────────────────────────

interface GiftLeaderboardProps {
  streamId: string;
  /** Compact mode: show top 3 only, no full list toggle */
  compact?: boolean;
  /** Refresh interval in ms (default 10s) */
  refreshMs?: number;
  /** Max entries to show (default 10) */
  maxEntries?: number;
}

// ─── Medal colors ────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉'];

// ─── Component ────────────────────────────────────────────────────────────

export function GiftLeaderboard({
  streamId,
  compact = false,
  refreshMs = 10_000,
  maxEntries = compact ? 3 : 10,
}: GiftLeaderboardProps) {
  const [expanded, setExpanded] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<LeaderboardResponse>(
    `/api/live/gifts/leaderboard?streamId=${encodeURIComponent(streamId)}&limit=${maxEntries}`,
    fetcher,
    { refreshInterval: refreshMs, revalidateOnFocus: true },
  );

  // Manual refresh
  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  // Auto-refresh on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') mutate();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [mutate]);

  if (error && !data) {
    return null; // Silently hide on error
  }

  if (isLoading && !data) {
    return compact ? null : (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="h-4 w-24 skeleton rounded" />
        <div className="mt-2 space-y-2">
          <div className="h-6 skeleton rounded" />
          <div className="h-6 skeleton rounded" />
        </div>
      </div>
    );
  }

  const entries = data?.leaderboard ?? [];
  const totalSats = data?.totalSats ?? 0;
  const totalGifts = data?.totalGifts ?? 0;
  const uniqueGifters = data?.uniqueGifters ?? 0;

  if (entries.length === 0) {
    return null; // No gifts yet
  }

  const displayEntries = expanded
    ? entries
    : entries.slice(0, compact ? 3 : Math.min(maxEntries, 5));

  // ─── Compact Mode (top 3 mini leaderboard) ─────────────────────

  if (compact) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-gradient-to-b from-yellow-500/5 to-orange-500/5 p-3 transition-all hover:border-yellow-500/20"
        onClick={handleRefresh}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
            🏆 Top Gifters
          </span>
          <span className="text-[8px] text-white/40">{totalGifts} gifts</span>
        </div>
        <div className="space-y-1.5">
          {displayEntries.map((entry) => {
            const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : '';
            const giftIcon = entry.topGift
              ? (GIFT_ICONS[entry.topGift.giftTypeId]?.icon ?? '🎁')
              : '🎁';

            return (
              <div
                key={entry.senderId}
                className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs">{medal || `#${entry.rank}`}</span>
                  <span className="text-[10px] font-medium text-white/80 truncate max-w-[100px]">
                    {entry.senderLabel}
                  </span>
                  {entry.rank === 1 && <span className="text-[9px]">{giftIcon}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold text-yellow-400">
                    ${entry.totalUsd.toFixed(2)}
                  </span>
                  <span className="text-[8px] text-white/40">{entry.giftCount} gifts</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total stats row */}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] text-white/40">
          <span>{uniqueGifters} gifters</span>
          <span>⚡ {totalSats.toLocaleString()} sats</span>
        </div>
      </div>
    );
  }

  // ─── Full Mode ─────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold text-white/80">
          🏆 Top Gifters
          <span className="text-[9px] font-normal text-white/40">This stream</span>
        </span>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/60 transition-colors"
          title="Refresh"
        >
          <svg
            aria-hidden="true"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Header row */}
      <div className="px-4 py-2 grid grid-cols-[40px_1fr_60px_60px] gap-2 text-[8px] font-medium uppercase tracking-wider text-white/30">
        <span>Rank</span>
        <span>Gifter</span>
        <span className="text-right">Sats</span>
        <span className="text-right">Gifts</span>
      </div>

      {/* Entries */}
      <div className="space-y-0.5 px-2 pb-2">
        {displayEntries.map((entry) => {
          const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`;
          const giftIcon = entry.topGift
            ? (GIFT_ICONS[entry.topGift.giftTypeId]?.icon ?? '🎁')
            : '🎁';

          return (
            <div
              key={entry.senderId}
              className="grid grid-cols-[40px_1fr_60px_60px] gap-2 items-center rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-xs text-center">{medal}</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs">{giftIcon}</span>
                <span className="text-[11px] text-white/80 truncate">{entry.senderLabel}</span>
              </div>
              <span className="text-[11px] font-medium text-yellow-400 text-right tabular-nums">
                {entry.totalSats.toLocaleString()}
              </span>
              <span className="text-[10px] text-white/50 text-right tabular-nums">
                {entry.giftCount}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expand / collapse */}
      {entries.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-white/10 px-4 py-2 text-[9px] text-white/40 hover:text-white/60 transition-colors"
        >
          {expanded ? 'Show less ▲' : `Show all ${entries.length} ▼`}
        </button>
      )}

      {/* Footer total */}
      <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-[9px] text-white/40">
        <span>
          {uniqueGifters} gifters · {totalGifts} gifts
        </span>
        <span>⚡ {totalSats.toLocaleString()} sats</span>
      </div>
    </div>
  );
}
