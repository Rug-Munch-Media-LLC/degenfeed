/**
 * @degenfeed/web — Tip Components Barrel
 *
 * Exports all tip-related UI components for easy importing.
 */

export type { TipButtonContext } from './TipButton';
export { TipButton } from './TipButton';
export { default as TipModal } from './TipModal';
export type { ContentVenue, PastTip, TipMenuOption, TipMenuProps } from './TipMenu';
export { TipMenu } from './TipMenu';
export type { EarningsDashboardProps, EarningsEntry, EarningsSummary } from './EarningsDashboard';
export { EarningsDashboard } from './EarningsDashboard';
export type {
  PostLeaderboardInfo, RevenueGoalInfo, StreakBadge, TipIncentivesProps, TipStreakInfo, TopTipperEntry,
} from './TipIncentives';
export { TipIncentives } from './TipIncentives';
export type { TipMethod, TipIntent, TipState, TipPostContext } from './useTip';
export { useTip, FIAT_PRESETS, SATS_PRESETS, PROTOCOL_EMOJIS, CHAIN_ICONS } from './useTip';
