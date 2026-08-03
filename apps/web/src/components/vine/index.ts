/**
 * @components/vine — Vine-like Shorts Component Library
 *
 * "Bring Vine back" — fun, addictive, always fresh short-form videos.
 *
 * Exports:
 *   VineFeed         — Main TikTok-style vertically swiping feed
 *   VinePlayer       — 6-second looping video player
 *   VineActions      — Like / Revine / Tip / Comment action rail
 *   VibeScore        — Vibe score breakdown display
 *   VineStarBadge    — Vine Star tier badge for creators
 *   VineLeaderboard  — Daily/Weekly Top Vines leaderboard
 *   VineChallenge    — Active Vine challenge display
 *   useVineFeed      — Hook for fetching Vine feed data
 */

export type {
  UseVineFeedOptions,
  UseVineFeedResult,
  VibeScores,
  VineShortItem,
} from './useVineFeed';
export { useVineFeed } from './useVineFeed';
export type { VibeScoreData, VibeScoreProps } from './VibeScore';
export { VibeScore } from './VibeScore';
export type { VineActionsProps } from './VineActions';
export { VineActions } from './VineActions';
export type { VineChallengeData, VineChallengeProps } from './VineChallenge';
export { VineChallenge } from './VineChallenge';
export type { VineFeedProps } from './VineFeed';
export { VineFeed } from './VineFeed';
export type { LeaderboardEntry, VineLeaderboardProps } from './VineLeaderboard';
export { VineLeaderboard } from './VineLeaderboard';
export type { VinePlayerProps } from './VinePlayer';
export { VinePlayer } from './VinePlayer';
export type { VineStarBadgeProps, VineStarTier } from './VineStarBadge';
export { VineStarBadge } from './VineStarBadge';
export type { VineCategory } from './vineConstants';
export { VINE_CATEGORIES, VINE_CATEGORY_META } from './vineConstants';
