'use client';

/**
 * TimeRemaining — Live countdown timer showing elapsed and remaining time.
 *
 * Displays "LIVE · XX:XX elapsed / YY:YY total" with a thin progress bar.
 * Automatically updates every second.
 */

import { useEffect, useState } from 'react';

interface TimeRemainingProps {
  startedAt: number;
  maxDuration: number; // seconds
  compact?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function TimeRemaining({ startedAt, maxDuration, compact = false }: TimeRemainingProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = Math.floor((now - startedAt) / 1000);
  const remaining = Math.max(0, maxDuration - elapsed);
  const progress = maxDuration > 0 ? Math.min(elapsed / maxDuration, 1) : 0;
  const isUrgent = remaining <= 15;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium tabular-nums ${
          isUrgent ? 'text-red-400' : 'text-[var(--color-muted)]'
        }`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {formatTime(remaining)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2" role="timer" aria-label="Time remaining">
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
        className={isUrgent ? 'text-red-400' : 'text-[var(--color-muted)]'}
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span
        className={`text-xs font-bold tabular-nums ${
          isUrgent ? 'text-red-400 animate-pulse' : 'text-[var(--color-fg)]'
        }`}
      >
        {isUrgent
          ? `ENDS IN ${formatTime(remaining)}`
          : `${formatTime(elapsed)} / ${formatTime(maxDuration)}`}
      </span>
      {/* Progress bar */}
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isUrgent ? 'bg-red-500' : progress > 0.8 ? 'bg-amber-500' : 'bg-degen-500'
          }`}
          style={{ width: `${progress * 100}%` }}
          role="progressbar"
          aria-valuenow={elapsed}
          aria-valuemin={0}
          aria-valuemax={maxDuration}
        />
      </div>
    </div>
  );
}
