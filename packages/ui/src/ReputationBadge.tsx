/**
 * @degenfeed/ui — ReputationBadge
 *
 * Displays a user's reputation level badge with tooltip showing
 * earned/staked/slashed breakdown and progress to next level.
 *
 * Examples:
 *   "🔷 Member"        — level + icon
 *   "Member"           — text only (icon=false)
 *   With tooltip:      hover shows "Earned: 420 · Staked: 50 · Slashed: 10"
 *   With progress:     "420/500 to Contributor"
 */

'use client';

import { useMemo, useRef, useState } from 'react';

// ─── Types (mirrored from @degenfeed/reputation to avoid React dep) ─────

export type ReputationLevel = 'newcomer' | 'member' | 'contributor' | 'builder' | 'elder';

export interface ReputationBadgeScore {
  total: number;
  earned: number;
  staked: number;
  slashed: number;
  level: ReputationLevel;
}

export interface ReputationBadgeTier {
  icon: string;
  label: string;
  postLimit: number | string;
  benefits: string[];
}

export interface ReputationBadgeProgress {
  current: ReputationLevel;
  next: ReputationLevel | null;
  currentMin: number;
  nextMin: number;
  progress: number; // 0–1
}

// ─── Tier config ─────────────────────────────────────────────────────────

const TIER_STYLES: Record<ReputationLevel, { icon: string; label: string; color: string; bg: string }> = {
  newcomer: {
    icon: '🌱',
    label: 'Newcomer',
    color: 'text-[var(--color-muted)]',
    bg: 'bg-gray-500/10',
  },
  member: {
    icon: '🔷',
    label: 'Member',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  contributor: {
    icon: '⭐',
    label: 'Contributor',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  builder: {
    icon: '🔶',
    label: 'Builder',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  elder: {
    icon: '🏆',
    label: 'Elder',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
};

// ─── Badge component ──────────────────────────────────────────────────────

export interface ReputationBadgeProps {
  /** Full reputation score — if omitted, badge shows nothing */
  score?: ReputationBadgeScore | null;
  /** Optional overrides for display */
  tier?: ReputationBadgeTier | null;
  /** Progress to next level */
  progress?: ReputationBadgeProgress | null;
  /** Show icon prefix (default: true) */
  showIcon?: boolean;
  /** Show label text (default: true) */
  showLabel?: boolean;
  /** Enable hover tooltip with full breakdown (default: true) */
  showTooltip?: boolean;
  /** Enable progress bar (default: false) */
  showProgress?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

export function ReputationBadge({
  score,
  tier,
  progress,
  showIcon = true,
  showLabel = true,
  showTooltip = true,
  showProgress = false,
  size = 'xs',
  className = '',
}: ReputationBadgeProps) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Determine display values
  const level: ReputationLevel = score?.level ?? 'newcomer';
  const style = TIER_STYLES[level];
  const displayIcon = tier?.icon || style.icon;
  const displayLabel = tier?.label || style.label;

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!score) return '';
    const lines = [
      `${displayIcon} ${displayLabel}`,
      `Total: ${score.total.toLocaleString()}`,
      `Earned: ${score.earned.toLocaleString()}`,
      `Staked: ${score.staked.toLocaleString()}`,
      `Slashed: ${score.slashed.toLocaleString()}`,
    ];
    if (progress && progress.next) {
      const pct = Math.round(progress.progress * 100);
      lines.push(`Next: ${progress.next} (${pct}%)`);
    }
    return lines.join('\n');
  }, [score, displayIcon, displayLabel, progress]);

  // Progress bar
  const progressBar = useMemo(() => {
    if (!showProgress || !progress || !progress.next) return null;
    const pct = Math.round(progress.progress * 100);
    return (
      <div className="mt-1 w-full">
        <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>
            {progress.currentMin.toLocaleString()}
          </span>
          <span className="font-medium text-[var(--color-fg)]">
            {pct}%
          </span>
          <span>
            {progress.nextMin.toLocaleString()} to {progress.next}
          </span>
        </div>
        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: 'var(--color-degen, #00ff41)',
            }}
          />
        </div>
      </div>
    );
  }, [showProgress, progress]);

  // Size classes
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }[size];

  return (
    <span
      ref={badgeRef}
      className={`inline-flex flex-col ${className}`}
      onMouseEnter={() => showTooltip && setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => showTooltip && setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${style.bg} ${style.color}`}
      >
        {showIcon && <span className="text-[0.9em]">{displayIcon}</span>}
        {showLabel && <span className="whitespace-nowrap">{displayLabel}</span>}
      </span>

      {showProgress && progressBar}

      {/* Tooltip */}
      {showTooltip && tooltipVisible && score && (
        <span
          className="absolute z-50 mt-6 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs shadow-2xl"
          style={{
            // Position below the badge
            transform: 'translateY(4px)',
            whiteSpace: 'pre-line',
          }}
        >
          <div className="space-y-0.5">
            <div className="mb-1 font-semibold text-[var(--color-fg)]">
              {displayIcon} {displayLabel}
            </div>
            <div className="flex justify-between text-[var(--color-muted)]">
              <span>Total</span>
              <span className="font-medium text-[var(--color-fg)]">{score.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[var(--color-muted)]">
              <span>Earned</span>
              <span className="font-medium text-green-400">+{score.earned.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[var(--color-muted)]">
              <span>Staked</span>
              <span className="font-medium text-blue-400">{score.staked.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[var(--color-muted)]">
              <span>Slashed</span>
              <span className="font-medium text-red-400">-{score.slashed.toLocaleString()}</span>
            </div>
            {progress && progress.next && (
              <>
                <hr className="my-1 border-[var(--color-border)]" />
                <div className="text-[var(--color-muted)]">
                  Progress to {TIER_STYLES[progress.next]?.icon}{' '}
                  {TIER_STYLES[progress.next]?.label || progress.next}:
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(progress.progress * 100)}%`,
                      backgroundColor: 'var(--color-degen, #00ff41)',
                    }}
                  />
                </div>
                <div className="mt-0.5 text-right text-[10px] text-[var(--color-muted)]">
                  {score.total.toLocaleString()} / {progress.nextMin.toLocaleString()}
                </div>
              </>
            )}
          </div>
        </span>
      )}
    </span>
  );
}
