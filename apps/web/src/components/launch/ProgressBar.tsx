'use client';

import type { ReactNode } from 'react';

interface ProgressBarProps {
  /** 0–100 percentage to graduation */
  progress: number;
  /** Display label, e.g. "85% to graduation — 0.3 ETH remaining!" */
  label?: string;
  /** Phase of the bonding curve */
  phase?: 'early' | 'growth' | 'late' | 'graduated';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional action button */
  action?: ReactNode;
  className?: string;
}

const PHASE_COLORS: Record<string, string> = {
  early: 'from-degen-500 to-degen-400',
  growth: 'from-degen-400 to-yellow-400',
  late: 'from-yellow-400 to-orange-500',
  graduated: 'from-degen-500 via-purple-500 to-fuchsia-500',
};

const PHASE_GLOW: Record<string, string> = {
  early: 'shadow-degen-500/30',
  growth: 'shadow-yellow-400/30',
  late: 'shadow-orange-500/30',
  graduated: 'shadow-fuchsia-500/30',
};

export default function ProgressBar({
  progress,
  label,
  phase = 'growth',
  size = 'md',
  action,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const height = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const isGraduated = clamped >= 100;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label row */}
      <div className={`flex items-center justify-between gap-2 ${size === 'sm' ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>
        <span className="font-medium text-[var(--color-fg)] truncate">
          {isGraduated ? '🚀 Graduated!' : label || `${Math.round(clamped)}% to graduation`}
        </span>
        {isGraduated && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-degen-500/20 px-2 py-0.5 text-[9px] sm:text-[11px] font-semibold text-degen-400">
            <span className="h-1.5 w-1.5 rounded-full bg-degen-500 animate-pulse" />
            Trading Live
          </span>
        )}
      </div>

      {/* Track */}
      <div
        className={`relative w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)] ${height}`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Bonding curve progress: ${Math.round(clamped)}%`}
      >
        {/* Fill */}
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${PHASE_COLORS[phase]} shadow-[0_0_12px] ${PHASE_GLOW[phase]}`}
          style={{ width: `${clamped}%` }}
        >
          {/* Animated shimmer on fill */}
          <div className="h-full w-full animate-shimmer opacity-30" />
        </div>

        {/* Graduation sparkle dot */}
        {clamped >= 90 && clamped < 100 && (
          <div
            className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-degen-500 animate-ping"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Meta + action */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
          {isGraduated ? '100%' : `${Math.round(clamped)}%`} · Phase:{' '}
          {phase === 'early'
            ? '🟢 Early'
            : phase === 'growth'
              ? '🟡 Growth'
              : phase === 'late'
                ? '🔴 Late'
                : '✅ Graduated'}
        </span>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
