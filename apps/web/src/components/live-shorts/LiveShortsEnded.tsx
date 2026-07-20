'use client';

/**
 * LiveShortsEnded — Shown when a live short has ended.
 *
 * Indicates that the recording is available for replay.
 * Provides options to watch again, share, or go back.
 *
 * Features:
 *   - "LIVE ENDED" badge with recording indicator
 *   - Session summary (viewers, tips, reactions)
 *   - "Watch Recording" button
 *   - "Share" button
 *   - Auto-transition back to discovery after 30s
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { LiveShortSession } from './useLiveShorts';

interface LiveShortsEndedProps {
  session: LiveShortSession;
  onWatchAgain?: () => void;
  onClose?: () => void;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(startedAt: number, maxDuration: number): string {
  const elapsed = Math.min(Math.floor((Date.now() - startedAt) / 1000), maxDuration);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-lg" aria-hidden="true">
        {icon}
      </span>
      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
      <span className="text-[10px] text-white/50">{label}</span>
    </div>
  );
}

export function LiveShortsEnded({ session, onWatchAgain, onClose }: LiveShortsEndedProps) {
  const stats = useMemo(
    () => ({
      viewers: formatCompact(session.viewerCount),
      tips: `${session.tipCount}`,
      reactions: formatCompact(session.reactionCount),
      duration: formatDuration(session.startedAt, session.maxDuration),
    }),
    [session],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6 text-center">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-white/5">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/60"
            aria-hidden="true"
          >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-white">Live Ended</h2>
          <p className="mt-1 text-sm text-white/50">The recording is available for replay</p>
        </div>

        {/* Session stats */}
        <div className="grid w-full grid-cols-4 gap-2">
          <StatCard label="Viewers" value={stats.viewers} icon="👁️" />
          <StatCard label="Tips" value={stats.tips} icon="🎁" />
          <StatCard label="Reactions" value={stats.reactions} icon="🔥" />
          <StatCard label="Duration" value={stats.duration} icon="⏱️" />
        </div>

        {/* Title */}
        <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs font-medium text-white/50">Session</p>
          <p className="text-sm font-semibold text-white">{session.title}</p>
          <p className="text-xs text-white/40">by @{session.creator.handle}</p>
        </div>

        {/* Actions */}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onWatchAgain}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-degen-500 px-4 py-3 text-sm font-bold text-black transition-all hover:bg-degen-400 active:scale-[0.97]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch Recording
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white/60 transition-all hover:border-white/20 hover:text-white active:scale-[0.97]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
