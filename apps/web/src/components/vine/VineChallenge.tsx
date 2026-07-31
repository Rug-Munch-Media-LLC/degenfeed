'use client';

/**
 * VineChallenge — Active Vine challenge display.
 *
 * Shows:
 *   - Challenge name, description, prize
 *   - Countdown timer
 *   - Entry count
 *   - Top entries grid
 *   - "Join Challenge" button
 *   - Category tag
 *   - Sponsor info
 */

import { useCallback, useEffect, useState } from 'react';
import type { VineShortItem } from './useVineFeed';
import type { VineCategory } from './vineConstants';
import { VINE_CATEGORY_META } from './vineConstants';

// ─── Types ────────────────────────────────────────────────────────────────

export interface VineChallengeData {
  id: string;
  name: string;
  description: string;
  prize: string;
  category: VineCategory;
  startsAt: number;
  endsAt: number;
  entryCount: number;
  topEntries: VineShortItem[];
  sponsor?: string;
  hashtag: string;
}

export interface VineChallengeProps {
  challenge: VineChallengeData;
  onJoin?: (challengeId: string) => void;
  onEntryClick?: (short: VineShortItem) => void;
  joined?: boolean;
  compact?: boolean;
}

// ─── Countdown Helper ─────────────────────────────────────────────────────

function useCountdown(target: number) {
  const [remaining, setRemaining] = useState(Math.max(0, target - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, target - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return remaining;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Ended';

  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ─── Component ────────────────────────────────────────────────────────────

export function VineChallenge({
  challenge,
  onJoin,
  onEntryClick,
  joined = false,
  compact = false,
}: VineChallengeProps) {
  const remaining = useCountdown(challenge.endsAt);
  const hasStarted = Date.now() >= challenge.startsAt;
  const hasEnded = challenge.endsAt <= Date.now();
  const categoryMeta = VINE_CATEGORY_META[challenge.category];

  const handleJoin = useCallback(() => {
    if (!joined && !hasEnded) {
      onJoin?.(challenge.id);
    }
  }, [challenge.id, joined, hasEnded, onJoin]);

  // ── Compact mode (for feed display) ──────────────────────────────────

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleJoin}
        className="flex items-center gap-2 rounded-xl border border-vine-500/20 bg-gradient-to-r from-vine-500/5 to-transparent p-2.5 text-left transition-all hover:border-vine-500/30 hover:from-vine-500/10"
      >
        <span className="text-lg">{hasEnded ? '🏁' : '🏆'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white truncate">{challenge.name}</p>
          <p className="text-[9px] text-white/40">
            {hasEnded ? 'Ended' : `${formatCountdown(remaining)} remaining`}
            {' · '}
            {challenge.entryCount} entries
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{
            backgroundColor: `${categoryMeta?.color ?? '#666'}20`,
            color: categoryMeta?.color ?? '#666',
          }}
        >
          {categoryMeta?.emoji} {categoryMeta?.label}
        </span>
        {joined && <span className="text-[9px] font-medium text-vine-400">✓ Joined</span>}
      </button>
    );
  }

  // ── Full display ────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-vine-500/[0.03] to-transparent p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{hasEnded ? '🏁' : '🏆'}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{challenge.name}</h3>
              {challenge.sponsor && (
                <p className="text-[10px] text-white/40">Sponsored by {challenge.sponsor}</p>
              )}
            </div>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{
              backgroundColor: `${categoryMeta?.color ?? '#666'}20`,
              color: categoryMeta?.color ?? '#666',
            }}
          >
            {categoryMeta?.emoji} {categoryMeta?.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm leading-relaxed text-white/70">{challenge.description}</p>

      {/* Prize */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <span className="text-lg">🎁</span>
        <div>
          <p className="text-xs font-medium text-amber-400">Prize</p>
          <p className="text-sm font-bold text-amber-300">{challenge.prize}</p>
        </div>
      </div>

      {/* Stats + Timer */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/50">Entries:</span>
          <span className="text-sm font-bold text-white">{challenge.entryCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/50">Hashtag:</span>
          <span className="text-xs font-medium text-vine-400">{challenge.hashtag}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-white/50">
            {hasEnded ? 'Ended' : hasStarted ? 'Ends in' : 'Starts in'}:
          </span>
          <span
            className={`text-sm font-mono font-bold ${remaining < 3600000 ? 'text-red-400' : 'text-white'}`}
          >
            {hasEnded ? '—' : formatCountdown(remaining)}
          </span>
        </div>
      </div>

      {/* Top Entries */}
      {challenge.topEntries.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-white/60">Top Entries</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
            {challenge.topEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onEntryClick?.(entry)}
                className="shrink-0 w-28 group"
              >
                <div className="aspect-[9/16] overflow-hidden rounded-lg bg-white/5">
                  {entry.thumbnailUrl ? (
                    <img
                      src={entry.thumbnailUrl}
                      alt={entry.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
                      🎬
                    </div>
                  )}
                </div>
                <p className="mt-1 truncate text-[10px] text-white/60">{entry.title}</p>
                <p className="text-[9px] text-vine-400">Vibe: {entry.vibeScore.total}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Join / Status Button */}
      {!hasEnded && (
        <button
          type="button"
          onClick={handleJoin}
          disabled={joined}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
            joined
              ? 'bg-vine-500/20 text-vine-400 border border-vine-500/30'
              : 'bg-gradient-to-r from-vine-600 to-vine-500 text-black hover:from-vine-500 hover:to-vine-400 hover:shadow-[0_0_16px_rgba(0,255,65,0.3)]'
          }`}
        >
          {joined ? '✅ Joined!' : `🎬 Join Challenge — Win ${challenge.prize}`}
        </button>
      )}

      {hasEnded && (
        <div className="w-full rounded-xl bg-white/5 py-3 text-center text-sm font-medium text-white/40">
          🏁 Challenge ended
        </div>
      )}
    </div>
  );
}
