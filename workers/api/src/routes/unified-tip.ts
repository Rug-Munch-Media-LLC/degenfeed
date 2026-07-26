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
