/**
 * @degenfeed/web — Tip Components Barrel
 *
 * Exports all tip-related UI components for easy importing.
 *
 * @see ./TipMenu.tsx — TASK 1+3: Reusable context-aware tipping menu
 * @see ./TipButton.tsx — Universal tip button
 * @see ./EarningsDashboard.tsx — TASK 4: Creator earnings consolidation
 * @see ./TipIncentives.tsx — TASK 5: Tip incentives, streaks, leaderboards, goals
 */

export type { EarningsDashboardProps, EarningsEntry, EarningsSummary } from './EarningsDashboard';
export { EarningsDashboard } from './EarningsDashboard';
export type { TipButtonContext } from './TipButton';
export { TipButton } from './TipButton';
export type {
  PostLeaderboardInfo,
  RevenueGoalInfo,
  StreakBadge,
  TipIncentivesProps,
  TipStreakInfo,
  TopTipperEntry,
} from './TipIncentives';
export { TipIncentives } from './TipIncentives';
export type { ContentVenue, PastTip, TipMenuOption, TipMenuProps } from './TipMenu';
export { TipMenu } from './TipMenu';
