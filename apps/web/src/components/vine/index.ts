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

export { VineFeed } from './VineFeed';
export type { VineFeedProps } from './VineFeed';

export { VinePlayer } from './VinePlayer';
export type { VinePlayerProps } from './VinePlayer';

export { VineActions } from './VineActions';
export type { VineActionsProps } from './VineActions';

export { VibeScore } from './VibeScore';
export type { VibeScoreProps, VibeScoreData } from './VibeScore';

export { VineStarBadge } from './VineStarBadge';
export type { VineStarBadgeProps, VineStarTier } from './VineStarBadge';

export { VineLeaderboard } from './VineLeaderboard';
export type { VineLeaderboardProps, LeaderboardEntry } from './VineLeaderboard';

export { VineChallenge } from './VineChallenge';
export type { VineChallengeProps, VineChallengeData } from './VineChallenge';

export { useVineFeed } from './useVineFeed';
export type {
  UseVineFeedOptions,
  UseVineFeedResult,
  VineShortItem,
  VibeScores,
} from './useVineFeed';

export { VINE_CATEGORIES, VINE_CATEGORY_META } from './vineConstants';
export type { VineCategory } from './vineConstants';
