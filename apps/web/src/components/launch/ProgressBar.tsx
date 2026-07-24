'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

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

  // == Gamification additions ============================

  /** Current bonding curve era name for display */
  eraName?: string;
  /** Current era color gradient */
  eraGradient?: string;
  /** First 100 remaining slots (null = not applicable) */
  first100Remaining?: number;
  /** User's buy streak days */
  streakDays?: number;
  /** Whether to show fireworks animation at milestones */
  showFireworks?: boolean;
  /** Current milestone reached (10, 25, 50, 75, 100) */
  currentMilestone?: number;
  /** Total unique holders */
  holderCount?: number;
  /** Number of people bought in last 60s */
  boughtLast60s?: number;
  /** Whether coin is trending */
  isTrending?: boolean;
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

const ERA_GRADIENTS: Record<string, string> = {
  'Steal Deal': 'from-cyan-500 to-degen-400',
  'Early Bird': 'from-degen-500 to-degen-400',
  Cruise: 'from-degen-400 to-yellow-400',
  'FOMO Zone': 'from-yellow-400 to-orange-500',
  Finale: 'from-orange-500 to-red-500',
};

const ERA_GLOWS: Record<string, string> = {
  'Steal Deal': 'shadow-cyan-500/30',
  'Early Bird': 'shadow-degen-500/30',
  Cruise: 'shadow-yellow-400/30',
  'FOMO Zone': 'shadow-orange-500/30',
  Finale: 'shadow-red-500/30',
};

export default function ProgressBar({
  progress,
  label,
  phase = 'growth',
  size = 'md',
  action,
  className = '',
  eraName,
  eraGradient,
  first100Remaining,
  streakDays,
  showFireworks = true,
  currentMilestone,
  holderCount,
  boughtLast60s,
  isTrending,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const height = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  const _textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const isGraduated = clamped >= 100;

  // == Fireworks state ====================================
  const [showFireworkEffect, setShowFireworkEffect] = useState(false);
  const prevMilestoneRef = useRef<number | undefined>(undefined);

  // Detect milestone crossings
  useEffect(() => {
    if (!showFireworks) return;

    const milestones = [10, 25, 50, 75, 100];
    const crossedMilestone = milestones.find(
      (m) => clamped >= m && (prevMilestoneRef.current ?? 0) < m,
    );

    if (crossedMilestone) {
      setShowFireworkEffect(true);
      const timer = setTimeout(() => setShowFireworkEffect(false), 3000);
      prevMilestoneRef.current = clamped;
      return () => clearTimeout(timer);
    }

    if (clamped > (prevMilestoneRef.current ?? 0)) {
      prevMilestoneRef.current = clamped;
    }
  }, [clamped, showFireworks]);

  // Determine gradient from era or phase
  const barGradient =
    eraName && ERA_GRADIENTS[eraName] ? ERA_GRADIENTS[eraName] : PHASE_COLORS[phase];
  const glowColor = eraName && ERA_GLOWS[eraName] ? ERA_GLOWS[eraName] : PHASE_GLOW[phase];

  // Milestone positions on the progress bar
  const milestonePositions = useMemo(() => {
    if (size === 'sm') return [];
    return [10, 25, 50, 75]
      .filter((_m) => !isGraduated)
      .map((m) => ({
        percent: m,
        reached: clamped >= m,
      }));
  }, [clamped, isGraduated, size]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label row */}
      <div
        className={`flex items-center justify-between gap-2 ${size === 'sm' ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
      >
        <span className="font-medium text-[var(--color-fg)] truncate">
          {isGraduated ? '🚀 Graduated!' : label || `${Math.round(clamped)}% to graduation`}
        </span>

        {/* Social proof pill */}
        {!isGraduated && (
          <div className="flex items-center gap-1.5 shrink-0">
            {boughtLast60s !== undefined && boughtLast60s > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-1.5 py-0.5 text-[8px] sm:text-[10px] font-medium text-degen-400 animate-pulse">
                🔥 {boughtLast60s} in 60s
              </span>
            )}
            {isTrending && (
              <span className="inline-flex items-center rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[8px] sm:text-[10px] font-medium text-orange-400">
                📈 Trending
              </span>
            )}
          </div>
        )}

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
        {/* Milestone markers on the track */}
        {milestonePositions.map((mp) => (
          <div
            key={`ms-${mp.percent}`}
            className={`absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-500 ${
              mp.reached ? 'opacity-100' : 'opacity-20'
            }`}
            style={{ left: `${mp.percent}%` }}
          >
            <div
              className={`h-2 w-2 rounded-full border-2 ${
                mp.reached
                  ? 'bg-degen-400 border-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.5)]'
                  : 'bg-[var(--color-muted-bg)] border-[var(--color-border)]'
              }`}
              title={`${mp.percent}% milestone`}
            />
          </div>
        ))}

        {/* Fill */}
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${barGradient} shadow-[0_0_12px] ${glowColor}`}
          style={{ width: `${clamped}%` }}
        >
          <div className="h-full w-full animate-shimmer opacity-30" />
        </div>

        {/* Graduation sparkle dot */}
        {clamped >= 90 && clamped < 100 && (
          <div
            className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-degen-500 animate-ping"
            aria-hidden="true"
          />
        )}

        {/* First 100 countdown flag */}
        {first100Remaining !== undefined && first100Remaining > 0 && !isGraduated && (
          <div
            className="absolute -top-5 right-0 z-10"
            style={{ right: `${Math.max(5, 100 - clamped)}%` }}
          >
            <div className="relative">
              <div className="whitespace-nowrap rounded-md bg-gradient-to-r from-yellow-500 to-orange-500 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-bold text-black shadow-lg animate-bounce">
                🏆 {first100Remaining} left
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
            {isGraduated ? '100%' : `${Math.round(clamped)}%`}
            {eraName && !isGraduated && (
              <>
                {' '}
                · <span className="font-medium">{eraName}</span>
              </>
            )}
          </span>

          {/* Streak badge */}
          {streakDays !== undefined && streakDays > 1 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-medium text-orange-400">
              🔥 {streakDays}d streak
              {streakDays >= 7 && <span className="text-[7px] ml-0.5">(2x bonus!)</span>}
            </span>
          )}

          {/* Holder count */}
          {holderCount !== undefined && holderCount > 0 && (
            <span className="text-[9px] sm:text-[10px] text-[var(--color-muted)]">
              👥 {holderCount}
            </span>
          )}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Fireworks overlay */}
      {showFireworkEffect && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-xl">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`fw-${i}`}
              className="absolute animate-firework"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${4 + Math.random() * 8}px`,
                height: `${4 + Math.random() * 8}px`,
                borderRadius: '50%',
                backgroundColor: ['#22c55e', '#06b6d4', '#f59e0b', '#f97316', '#a855f7', '#ef4444'][
                  Math.floor(Math.random() * 6)
                ]!,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Add fireworks keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes firework {
      0% { transform: scale(0) translateY(0); opacity: 1; }
      50% { transform: scale(1.5) translateY(-30px); opacity: 0.8; }
      100% { transform: scale(0) translateY(-60px); opacity: 0; }
    }
    .animate-firework {
      animation: firework ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}
