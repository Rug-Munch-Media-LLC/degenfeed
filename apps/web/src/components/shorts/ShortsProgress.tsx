'use client';

/**
 * ShortsProgress — Thin video progress bar with gradient fill.
 * Appears at the very top edge of the shorts card.
 */

interface ShortsProgressProps {
  progress: number; // 0 to 1
  duration?: number; // in seconds, for display
  className?: string;
}

export function ShortsProgress({ progress, className = '' }: ShortsProgressProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const pct = Math.round(clampedProgress * 100);

  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Video progress"
    >
      <div className="h-full w-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-150 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
