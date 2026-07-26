/**
 * @degenfeed/api-worker — Live Gifts Barrel (barrel)
 *
 * Re-exports gift system types, constants, and handlers.
 * Consumers import from './routes/live-gifts' for everything.
 *
 * API endpoints registered in app.ts:
 *   POST /api/live/gifts/send
 *   GET  /api/live/gifts/leaderboard
 *   GET  /api/live/gifts/types
 *   GET  /api/live/gifts/packages
 *   GET  /api/live/gifts/history
 *   GET  /api/live/gifts/earnings
 *   POST /api/live/gifts/process-payout
 */

export type {
  GiftPackage,
  GiftRecord,
  GiftStreakTier,
  GiftType,
  GiftTypeId,
  StreamGiftState,
  SubscriptionGiftOption,
} from './live-gifts-core';
export {
  calculateCreatorEarnings,
  calculateGiftFee,
  checkStreakTier,
  GIFT_PACKAGES,
  GIFT_STREAK_TIERS,
  GIFT_TIERS,
  GIFT_TYPES,
  isSupportedGiftChain,
  isValidGiftTypeId,
  lookupGiftType,
  SUBSCRIPTION_GIFT_OPTIONS,
} from './live-gifts-core';
export {
  handleGiftEarnings,
  handleGiftHistory,
  handleGiftLeaderboard,
  handleGiftPackages,
  handleGiftPayout,
  handleGiftSend,
  handleGiftTypes,
  recordGift,
} from './live-gifts-handlers';
