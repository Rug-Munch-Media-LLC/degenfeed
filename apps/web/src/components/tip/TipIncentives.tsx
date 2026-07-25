'use client';

/**
 * @degenfeed/web — TipIncentives
 *
 * TASK 5: Tip Incentives
 *
 * Features that encourage tipping:
 *   1. "Top Tipper" badge on posts
 *   2. Leaderboard per post — who tipped what
 *   3. Tip streak rewards — tip 5 days in a row → badge
 *   4. Creator shoutout — auto-post thanking top tippers
 *   5. Revenue goals — "Help alice reach $100 this month!"
 *
 * @see ../../../workers/api/src/routes/tip-streaks.ts
 * @see ../../../workers/api/src/routes/unified-tip-core.ts
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

export interface TipStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastTipDate: string;
  streakStartDate: string;
  weekDaysTipped: number;
  badges: string[];
}

export interface StreakBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  streakDays: number;
}

export interface TopTipperEntry {
  tipperId: string;
  tipperName: string;
  totalUsd: number;
  count: number;
}

export interface PostLeaderboardInfo {
  entityId: string;
  topTippers: TopTipperEntry[];
  totalUsd: number;
  tipCount: number;
}

export interface RevenueGoalInfo {
  targetUsd: number;
  currentUsd: number;
  period: string;
  label: string;
  active: boolean;
}

export interface TipIncentivesProps {
  /** Current user ID (for streak display) */
  userId?: string;
  /** Post entity ID (for per-post leaderboard) */
  entityId?: string;
  /** Creator user ID (for revenue goal) */
  creatorId?: string;
  /** Pre-fetched streak info */
  initialStreak?: TipStreakInfo;
  /** Pre-fetched leaderboard info */
  initialLeaderboard?: PostLeaderboardInfo;
  /** Pre-fetched revenue goal */
  initialGoal?: RevenueGoalInfo;
  /** Additional CSS classes */
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const STREAK_BADGE_ICONS: Record<string, string> = {
  streak_3: '🔥',
  streak_5: '⭐',
  streak_7: '💪',
  streak_14: '🔥',
  streak_30: '🏆',
  streak_100: '👑',
};

const STREAK_BADGE_NAMES: Record<string, string> = {
  streak_3: '3-Day Streak',
  streak_5: '5-Day Streak',
  streak_7: 'Week Warrior',
  streak_14: 'Fortnight Flame',
  streak_30: 'Monthly MVP',
  streak_100: 'Centurion Tipper',
};

// ─── Component ───────────────────────────────────────────────────────────

export function TipIncentives({
  userId,
  entityId,
  creatorId,
  initialStreak,
  initialLeaderboard,
  initialGoal,
  className = '',
}: TipIncentivesProps) {
  // ── States ──────────────────────────────────────────────────────────────
  const [streak, setStreak] = useState<TipStreakInfo | null>(initialStreak ?? null);
  const [leaderboard, setLeaderboard] = useState<PostLeaderboardInfo | null>(
    initialLeaderboard ?? null,
  );
  const [goal, setGoal] = useState<RevenueGoalInfo | null>(initialGoal ?? null);
  const [streakBadges, setStreakBadges] = useState<StreakBadge[]>([]);
  const [loading, setLoading] = useState(!initialStreak || !initialLeaderboard || !initialGoal);
  const [goalEditMode, setGoalEditMode] = useState(false);
  const [goalInput, setGoalInput] = useState('100');
  const [settingGoal, setSettingGoal] = useState(false);

  // ── Fetch streak, leaderboard, and goals ──────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const promises: Array<Promise<void>> = [];

      // Fetch streak
      if (userId) {
        promises.push(
          fetch(`/api/tip/streak?userId=${encodeURIComponent(userId)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => setStreak(data as TipStreakInfo))
            .catch(() => {}),
        );
      }

      // Fetch streak badges
      promises.push(
        fetch('/api/tip/streak-badges', { credentials: 'include' })
          .then((r) => r.json())
          .then((data) => setStreakBadges(data.badges as StreakBadge[]))
          .catch(() => {}),
      );

      // Fetch post leaderboard
      if (entityId) {
        promises.push(
          fetch(`/api/tip/post-leaderboard?entityId=${encodeURIComponent(entityId)}`, {
            credentials: 'include',
          })
            .then((r) => r.json())
            .then((data) => setLeaderboard(data as PostLeaderboardInfo))
            .catch(() => {}),
        );
      }

      // Fetch revenue goal
      if (creatorId) {
        promises.push(
          fetch(`/api/tip/goal?userId=${encodeURIComponent(creatorId)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
              setGoal(data as RevenueGoalInfo);
              setGoalInput(String((data as RevenueGoalInfo).targetUsd));
            })
            .catch(() => {}),
        );
      }

      await Promise.allSettled(promises);
    } finally {
      setLoading(false);
    }
  }, [userId, entityId, creatorId]);

  useEffect(() => {
    if (!initialStreak || !initialLeaderboard || !initialGoal) fetchAll();
  }, [fetchAll, initialStreak, initialLeaderboard, initialGoal]);

  // ── Set revenue goal ──────────────────────────────────────────────────
  const handleSetGoal = useCallback(async () => {
    if (!creatorId) return;
    setSettingGoal(true);
    try {
      const res = await fetch('/api/tip/goal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: creatorId, targetUsd: Number.parseFloat(goalInput) }),
      });
      if (res.ok) {
        const updated = (await res.json()) as RevenueGoalInfo;
        setGoal(updated);
        setGoalEditMode(false);
      }
    } catch {
      /* ignore */
    } finally {
      setSettingGoal(false);
    }
  }, [creatorId, goalInput]);

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`flex items-center gap-2 py-2 ${className}`}>
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
        <span className="text-[10px] text-[var(--color-muted)]">Loading incentives...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ── 1. Top Tipper Badge (per-post) ───────────────────────────── */}
      {leaderboard && leaderboard.topTippers.length > 0 && (
        <div className="rounded-lg border border-amber-900/30 bg-gradient-to-r from-amber-900/10 to-transparent p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              👑 Top Tippers
            </h3>
            <span className="text-[10px] text-[var(--color-muted)]">
              ${leaderboard.totalUsd.toFixed(2)} total · {leaderboard.tipCount} tips
            </span>
          </div>

          <div className="space-y-1">
            {leaderboard.topTippers.slice(0, 5).map((tipper, i) => (
              <div
                key={tipper.tipperId}
                className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-amber-900/5 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {i === 0 && <span className="shrink-0 text-xs">👑</span>}
                  {i === 1 && <span className="shrink-0 text-xs">🥈</span>}
                  {i === 2 && <span className="shrink-0 text-xs">🥉</span>}
                  {i >= 3 && (
                    <span className="shrink-0 text-[10px] text-[var(--color-muted)]">#{i + 1}</span>
                  )}
                  <span className="truncate text-[11px] text-[var(--color-fg)]">
                    {tipper.tipperName}
                  </span>
                  {i === 0 && (
                    <span className="shrink-0 rounded-full bg-amber-900/30 px-1.5 py-0.5 text-[8px] font-medium text-amber-400">
                      Top Tipper
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium text-[var(--color-fg)]">
                    ${tipper.totalUsd.toFixed(2)}
                  </span>
                  <span className="text-[8px] text-[var(--color-muted)]">{tipper.count}×</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Tip Streak Rewards ──────────────────────────────────── */}
      {streak && (
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              🔥 Tip Streak
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-orange-400">{streak.currentStreak}</span>
              <span className="text-[9px] text-[var(--color-muted)]">
                day{streak.currentStreak !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Streak progress bar */}
          {streak.currentStreak > 0 && (
            <div className="mb-2">
              <div className="h-1.5 w-full rounded-full bg-[var(--color-card)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                  style={{
                    width: `${Math.min((streak.currentStreak / 7) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="mt-0.5 text-[8px] text-[var(--color-muted)]">
                {streak.currentStreak >= 7
                  ? '🏆 Weekly streak achieved!'
                  : `${7 - streak.currentStreak} more days for Week Warrior badge`}
              </p>
            </div>
          )}

          {/* Earned streak badges */}
          {streak.badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {streak.badges.map((badgeId) => (
                <span
                  key={badgeId}
                  className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2 py-0.5 text-[9px] font-medium text-degen-400"
                  title={STREAK_BADGE_NAMES[badgeId] ?? badgeId}
                >
                  {STREAK_BADGE_ICONS[badgeId] ?? '🏅'} {STREAK_BADGE_NAMES[badgeId] ?? badgeId}
                </span>
              ))}
            </div>
          )}

          {/* Next badge preview */}
          {streak.currentStreak > 0 && streak.currentStreak < 100 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {streakBadges
                .filter((b) => b.streakDays > streak.currentStreak && !streak.badges.includes(b.id))
                .slice(0, 3)
                .map((badge) => (
                  <span
                    key={badge.id}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border)] px-2 py-0.5 text-[8px] text-[var(--color-muted)]"
                    title={`${badge.description} (${badge.streakDays} days)`}
                  >
                    {badge.icon} {badge.streakDays}d
                  </span>
                ))}
            </div>
          )}

          {/* Longest streak */}
          {streak.longestStreak > streak.currentStreak && (
            <p className="mt-1 text-[8px] text-[var(--color-muted)]">
              Best: {streak.longestStreak} days
            </p>
          )}
        </div>
      )}

      {/* ── 3. Revenue Goal Progress ───────────────────────────────── */}
      {goal && (
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              🎯 Revenue Goal
            </h3>
            <button
              type="button"
              onClick={() => setGoalEditMode(!goalEditMode)}
              className="text-[9px] text-degen-500 hover:text-degen-400 transition-colors"
            >
              {goalEditMode ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {/* Goal progress */}
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-lg font-bold text-[var(--color-fg)]">
              ${goal.currentUsd.toFixed(0)}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">
              of ${goal.targetUsd.toFixed(0)} this month
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-[var(--color-card)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-degen-500 to-purple-500 transition-all"
              style={{
                width: `${Math.min((goal.currentUsd / goal.targetUsd) * 100, 100)}%`,
              }}
            />
          </div>

          <p className="mt-1 text-[9px] text-[var(--color-muted)]">
            {goal.currentUsd >= goal.targetUsd
              ? '🎉 Goal reached!'
              : `$${(goal.targetUsd - goal.currentUsd).toFixed(0)} remaining to reach goal`}
          </p>

          {/* Goal edit mode */}
          {goalEditMode && (
            <div className="mt-2 flex gap-1">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-[10px] font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                placeholder="100"
                min="1"
                aria-label="Monthly revenue goal in USD"
              />
              <button
                type="button"
                onClick={handleSetGoal}
                disabled={settingGoal || !goalInput}
                className="rounded-lg bg-degen-500/20 px-3 py-1 text-[10px] font-medium text-degen-400 hover:bg-degen-500/30 disabled:opacity-50 transition-colors"
              >
                {settingGoal ? 'Saving...' : 'Set'}
              </button>
            </div>
          )}

          {/* Shareable goal link */}
          {creatorId && (
            <button
              type="button"
              onClick={() => {
                const text = `Help me reach my $${goal.targetUsd.toFixed(0)} tipping goal this month! 🎯 Tip me on DegenFeed`;
                void navigator.clipboard.writeText(text).catch(() => {});
              }}
              className="mt-2 w-full rounded-lg border border-dashed border-[var(--color-border)] px-2 py-1 text-[9px] text-[var(--color-muted)] hover:text-degen-400 transition-colors"
            >
              📋 Copy shareable goal message
            </button>
          )}
        </div>
      )}

      {/* ── 4. Creator Shoutout ────────────────────────────────────── */}
      {leaderboard && leaderboard.topTippers.length > 0 && creatorId && (
        <div className="rounded-lg border border-purple-900/30 bg-gradient-to-r from-purple-900/10 to-transparent p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            📣 Shoutout
          </h3>
          <p className="text-[11px] text-[var(--color-fg)]">
            Thank{' '}
            <strong className="text-purple-400">{leaderboard.topTippers[0].tipperName}</strong> for
            being the top tipper with{' '}
            <strong>${leaderboard.topTippers[0].totalUsd.toFixed(2)}</strong>!
          </p>

          {/* Auto-shoutout button */}
          <button
            type="button"
            onClick={async () => {
              const topTipper = leaderboard.topTippers[0];
              const shoutoutText = `Big thanks to ${topTipper.tipperName} for being the top tipper with $${topTipper.totalUsd.toFixed(2)}! 💜 Your support means everything.`;

              // Create public auto-post (via a bridge endpoint)
              try {
                await fetch('/api/cross-publish', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    text: shoutoutText,
                    protocols: ['nostr', 'farcaster'], // Default to Nostr + Farcaster
                  }),
                });
                window.dispatchEvent(
                  new CustomEvent('df-toast', {
                    detail: { kind: 'success', message: '📣 Shoutout posted!' },
                  }),
                );
              } catch {
                window.dispatchEvent(
                  new CustomEvent('df-toast', {
                    detail: { kind: 'error', message: 'Failed to post shoutout' },
                  }),
                );
              }
            }}
            className="mt-2 w-full rounded-lg bg-purple-500/20 px-3 py-1.5 text-[10px] font-medium text-purple-400 hover:bg-purple-500/30 transition-colors"
          >
            📣 Auto-post thank you to top tipper
          </button>
        </div>
      )}
    </div>
  );
}
