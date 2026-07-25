'use client';

/**
 * VineLeaderboard — Daily/Weekly Top Vines leaderboard.
 *
 * Shows the highest vibed shorts for the current time window.
 * Each entry shows rank, thumbnail, creator, vibe score, revine count.
 *
 * Also serves as "Vine Stars" leaderboard — top creators ranked by vibe.
 */

import type { VineShortItem } from './useVineFeed';
import { getTierFromScore, VineStarBadge } from './VineStarBadge';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  short: VineShortItem;
  vibeScore: number;
  revineCount: number;
  viewCount: number;
}

export interface VineLeaderboardProps {
  entries: LeaderboardEntry[];
  window: 'daily' | 'weekly';
  onEntryClick?: (short: VineShortItem) => void;
  onWindowChange?: (window: 'daily' | 'weekly') => void;
  loading?: boolean;
  type?: 'vines' | 'stars';
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getRankStyle(rank: number): { emoji: string; color: string } {
  switch (rank) {
    case 1: return { emoji: '🥇', color: '#FFD700' };
    case 2: return { emoji: '🥈', color: '#C0C0C0' };
    case 3: return { emoji: '🥉', color: '#CD7F32' };
    default: return { emoji: `#${rank}`, color: 'rgba(255,255,255,0.4)' };
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export function VineLeaderboard({
  entries,
  window,
  onEntryClick,
  onWindowChange,
  loading = false,
  type = 'vines',
}: VineLeaderboardProps) {
  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {type === 'stars' ? '⭐ Vine Stars' : '🏆 Top Vines'}
          </h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onWindowChange?.('daily')}
              className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                window === 'daily'
                  ? 'bg-vine-500/20 text-vine-400 border border-vine-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => onWindowChange?.('weekly')}
              className={`rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
                window === 'weekly'
                  ? 'bg-vine-500/20 text-vine-400 border border-vine-500/30'
                  : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
              }`}
            >
              Weekly
            </button>
          </div>
        </div>
        <p className="text-xs text-white/40 mt-1">
          {type === 'stars'
            ? 'Top creators ranked by total vibe score'
            : `Best vines from the past ${window === 'daily' ? '24 hours' : '7 days'}`}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-vine-500/30 border-t-vine-400" />
        </div>
      )}

      {/* Empty */}
      {!loading && entries.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-3xl">🏆</span>
          <p className="text-sm text-white/60">No top vines yet</p>
          <p className="text-xs text-white/40">Be the first to create a viral vine!</p>
        </div>
      )}

      {/* Leaderboard List */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const rankStyle = getRankStyle(entry.rank);
            const short = entry.short;

            return (
              <button
                key={short.id}
                type="button"
                onClick={() => onEntryClick?.(short)}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.05] hover:border-white/10 text-left"
              >
                {/* Rank */}
                <div className="flex w-8 shrink-0 items-center justify-center">
                  <span
                    className="text-sm font-bold"
                    style={{ color: rankStyle.color }}
                  >
                    {rankStyle.emoji}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  {short.thumbnailUrl ? (
                    <img
                      src={short.thumbnailUrl}
                      alt={short.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">
                      🎬
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {short.title}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-white/50">
                    <span>{short.creatorName}</span>
                    <span>·</span>
                    <span className="text-vine-400">{entry.vibeScore} vibe</span>
                  </p>
                </div>

                {/* Stats */}
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-white/40">
                    <span>🔄</span>
                    <span>{formatCount(entry.revineCount)}</span>
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatCount(entry.viewCount)} views
                  </span>
                </div>

                {/* Vine Star badge for star leaderboard */}
                {type === 'stars' && (
                  <div className="shrink-0">
                    <VineStarBadge
                      tier={getTierFromScore(entry.vibeScore)}
                      compact
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
