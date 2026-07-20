'use client';

import { useTokenProgress } from '../../hooks/useTokenCommunity';
import type { TokenMilestone } from '../../hooks/useTokenCommunity';

/* ─── Milestone definitions ─────────────────────────── */

interface MilestoneDef {
  type: 'holders' | 'volume' | 'days_alive';
  value: number;
  reward: string;
  icon: string;
}

const MILESTONES: MilestoneDef[] = [
  { type: 'holders', value: 10, reward: 'Early badge unlocked', icon: '🌟' },
  { type: 'holders', value: 50, reward: 'Trending status', icon: '🔥' },
  { type: 'holders', value: 100, reward: 'Creator stream unlocked', icon: '🎙️' },
  { type: 'holders', value: 500, reward: 'HD streaming + recording', icon: '📹' },
  { type: 'holders', value: 1000, reward: 'Custom token page theme', icon: '🎨' },
  { type: 'volume', value: 1, reward: 'First ETH raised!', icon: '💰' },
  { type: 'volume', value: 10, reward: 'Diamond hands badge', icon: '💎' },
  { type: 'volume', value: 50, reward: 'Graduation eligible', icon: '🚀' },
  { type: 'days_alive', value: 7, reward: 'Week one survivor badge', icon: '💪' },
  { type: 'days_alive', value: 30, reward: 'OG status unlocked', icon: '👑' },
];

/* ─── Component ─────────────────────────────────────── */

interface MilestoneTrackerProps {
  tokenAddress: string;
  compact?: boolean;
  className?: string;
}

export default function MilestoneTracker({
  tokenAddress,
  compact = false,
  className = '',
}: MilestoneTrackerProps) {
  const { stats, nextMilestone, reachedMilestones } = useTokenProgress(tokenAddress);

  if (compact) {
    return (
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          🏆 Community Progress
        </h3>

        {/* Next milestone progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-[var(--color-muted)] mb-1">
            <span className="truncate">
              {nextMilestone.progress >= 100
                ? 'All milestones reached!'
                : `${stats.holders}/${nextMilestone.target} ${nextMilestone.type}`}
            </span>
            <span className="shrink-0">{nextMilestone.progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-degen-500 to-fuchsia-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, nextMilestone.progress)}%` }}
            />
          </div>
          {nextMilestone.reward && nextMilestone.progress < 100 && (
            <p className="mt-1 text-[9px] sm:text-[10px] text-[var(--color-muted)]">
              Next: {nextMilestone.reward}
            </p>
          )}
        </div>

        {/* Milestone badges — scrollable on mobile */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {MILESTONES.map((m) => (
            <MilestoneBadge
              key={`${m.type}-${m.value}`}
              milestone={m}
              reached={reachedMilestones.some(
                (rm) => rm.type === m.type && Number(rm.threshold) === m.value,
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${className}`}>
      <h3 className="mb-2 sm:mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        🏆 Community Goals
      </h3>

      {/* Next milestone progress */}
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between text-xs sm:text-sm mb-1 sm:mb-1.5">
          <span className="text-[var(--color-fg)] font-medium truncate">
            {nextMilestone.progress >= 100
              ? '🎉 All milestones reached!'
              : `${stats.holders} / ${nextMilestone.target} ${nextMilestone.type}`}
          </span>
          <span className="text-[11px] sm:text-xs font-bold tabular-nums text-degen-400 shrink-0">
            {nextMilestone.progress}%
          </span>
        </div>
        <div className="h-2 sm:h-3 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-degen-500 via-fuchsia-500 to-purple-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(100, nextMilestone.progress)}%` }}
          />
        </div>
        {nextMilestone.reward && nextMilestone.progress < 100 && (
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-[var(--color-muted)]">
            Next reward: <span className="font-medium text-degen-400">{nextMilestone.reward}</span>
          </p>
        )}
      </div>

      {/* Milestone grid — responsive */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {MILESTONES.map((m) => (
          <MilestoneBadge
            key={`${m.type}-${m.value}`}
            milestone={m}
            reached={reachedMilestones.some(
              (rm) => rm.type === m.type && Number(rm.threshold) === m.value,
            )}
            showLabel
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Milestone Badge ───────────────────────────────── */

function MilestoneBadge({
  milestone,
  reached,
  showLabel = false,
}: {
  milestone: MilestoneDef;
  reached: boolean;
  showLabel?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border px-1.5 sm:px-2 py-1 transition-all ${
        reached
          ? 'border-degen-500/20 bg-degen-500/10 text-degen-400'
          : 'border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] opacity-60'
      }`}
      title={milestone.reward}
    >
      <span className="text-[10px] sm:text-sm">{milestone.icon}</span>
      <span className="text-[9px] sm:text-[10px] font-medium">
        {milestone.value}{milestone.type === 'holders' ? 'H' : milestone.type === 'volume' ? 'ETH' : 'D'}
      </span>
      {showLabel && (
        <span className="text-[8px] sm:text-[9px] text-[var(--color-muted)] truncate max-w-[60px] sm:max-w-[80px]">
          {milestone.reward}
        </span>
      )}
    </div>
  );
}
