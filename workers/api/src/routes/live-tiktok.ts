/**
 * @degenfeed/api-worker — Live TikTok-Style Barrel
 *
 * Re-exports all TikTok-style live stream content types, handlers.
 * API endpoints registered in register/live.ts:
 *
 * Emojis:
 *   POST /api/live/emojis/create
 *   GET  /api/live/emojis/marketplace
 *   POST /api/live/emojis/:id/buy
 *   GET  /api/live/emojis/my-purchases
 *   GET  /api/live/emojis/creator/:creatorId
 *
 * Custom Gifts:
 *   POST /api/live/gifts/custom/create
 *   GET  /api/live/gifts/custom/marketplace
 *   GET  /api/live/gifts/custom/:creatorId
 *   POST /api/live/gifts/custom/:id/buy
 *
 * Filters:
 *   GET  /api/live/filters
 *   POST /api/live/filters/:id/buy
 *   GET  /api/live/filters/my-filters
 *
 * Stickers:
 *   GET  /api/live/stickers
 *   POST /api/live/stickers/:id/buy
 *   POST /api/live/stickers/:id/trigger
 *   GET  /api/live/stickers/active/:streamId
 *
 * Creator Dashboard:
 *   GET  /api/live/creator-content/earnings
 */

export type {
  CreatorContentEarnings,
  CreatorEmoji,
  CustomGift,
  CustomGiftPurchase,
  EmojiPurchase,
  EmojiTier,
  FaceFilter,
  FilterAccess,
  FilterCategory,
  FilterPurchase,
  GiftRarity,
  LiveSticker,
  StickerCategory,
  StickerTrigger,
} from './live-tiktok-core';

export {
  calculateCreatorNet,
  calculateFee,
  DEFAULT_CREATOR_EMOJIS,
  DEFAULT_FILTERS,
  DEFAULT_STICKERS,
  generateId,
  generateTokenId,
  GIFT_RARITY_CONFIG,
} from './live-tiktok-core';

export {
  handleActiveStickers,
  handleCreatorContentEarnings,
  handleCreatorCustomGifts,
  handleCreatorEmojis,
  handleCustomGiftBuy,
  handleCustomGiftCreate,
  handleCustomGiftMarketplace,
  handleEmojiBuy,
  handleEmojiCreate,
  handleEmojiMarketplace,
  handleFilterBuy,
  handleFiltersList,
  handleMyEmojis,
  handleMyFilters,
  handleStickerBuy,
  handleStickerTrigger,
  handleStickersList,
} from './live-tiktok-handlers';
