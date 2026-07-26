/**
 * @degenfeed/api-worker — Unified Tip Router (barrel)
 *
 * Thin re-export barrel for the unified tip accounting layer.
 * Implementation lives in three sibling modules:
 *   - unified-tip-core.ts       (types, constants, recordUnifiedTip, handleUnifiedTipCreate)
 *   - unified-tip-leaderboard.ts (stats, leaderboard, activity, badges)
 *   - unified-tip-crosschain.ts  (cross-chain tip routing)
 *
 * All exports are backward-compatible. app.ts imports from './routes/unified-tip'
 * continue to work unchanged.
 */

export type {
  ActivityItem,
  ChainRoute,
  CreatorCoinInfo,
  CrossChainTipRequest,
  CrossChainTipResult,
  SmartChainSelectionRequest,
  SmartChainSelectionResult,
  SupportedChain,
  TipEntityType,
  TipPeriod,
  TipPlatform,
  UnifiedLeaderboardEntry,
  UnifiedTipEvent,
} from './unified-tip-core';
export {
  entityKey,
  handleUnifiedTipCreate,
  leaderboardKey,
  periodBucket,
  recordUnifiedTip,
  selectBestChain,
  userReceivedKey,
  userSentKey,
} from './unified-tip-core';
export { handleCrossChainTip } from './unified-tip-crosschain';
export type { CreatorTipAnalytics } from './unified-tip-leaderboard';
export {
  handleTipAnalytics,
  handleTipBadges,
  handleTipLeaderboardCoins,
  handleTipLeaderboardProtocols,
  handleTopTippers,
  handleUnifiedTipActivity,
  handleUnifiedTipLeaderboard,
  handleUnifiedTipStats,
} from './unified-tip-leaderboard';
