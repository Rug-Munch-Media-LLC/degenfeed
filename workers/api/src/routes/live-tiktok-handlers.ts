/**
 * @degenfeed/api-worker — Live TikTok-Style API Handlers
 *
 * Endpoints:
 *   Emojis:     POST /api/live/emojis/create
 *               GET  /api/live/emojis/marketplace
 *               POST /api/live/emojis/:id/buy
 *               GET  /api/live/emojis/my-purchases
 *               GET  /api/live/emojis/creator/:creatorId
 *
 *   Custom Gifts: POST  /api/live/gifts/custom/create
 *                 GET   /api/live/gifts/custom/:creatorId
 *                 POST  /api/live/gifts/custom/:id/buy
 *                 POST  /api/live/gifts/custom/:id/send
 *
 *   Filters:    GET  /api/live/filters
 *               POST /api/live/filters/:id/buy
 *               GET  /api/live/filters/my-filters
 *
 *   Stickers:   GET  /api/live/stickers
 *               POST /api/live/stickers/:id/buy
 *               POST /api/live/stickers/:id/trigger
 *
 *   Earnings:   GET /api/live/creator-content/earnings
 */

import type { Env } from '../index';
import { badRequest, ok } from '../response-helpers';
import { requireSession } from '../session';
import {
  type CreatorContentEarnings,
  type CreatorEmoji,
  type CustomGift,
  type CustomGiftPurchase,
  type EmojiPurchase,
  type FaceFilter,
  type FilterPurchase,
  type LiveSticker,
  type StickerTrigger,
  DEFAULT_CREATOR_EMOJIS,
  DEFAULT_FILTERS,
  DEFAULT_STICKERS,
  GIFT_RARITY_CONFIG,
  calculateCreatorNet,
  calculateFee,
  generateId,
  generateTokenId,
  kvDelete,
  kvGetJson,
  kvListByPrefix,
  kvPutJson,
  EARNINGS_PREFIX,
  EMOJI_CREATOR_PREFIX,
  EMOJI_KEY,
  EMOJI_MARKETPLACE_KEY,
  EMOJI_PURCHASE_PREFIX,
  FILTERS_KEY,
  FILTER_PURCHASE_PREFIX,
  FILTER_USER_PREFIX,
  GIFTS_CREATOR_PREFIX,
  GIFTS_CUSTOM_KEY,
  GIFTS_PURCHASE_PREFIX,
  STICKERS_KEY,
  STICKER_TRIGGER_PREFIX,
} from './live-tiktok-core';

// ─── Helpers ─────────────────────────────────────────────────────────────

function safeString(s: unknown, max = 256): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, max).replace(/[<>]/g, '');
}

function safeNumber(n: unknown): number {
  if (typeof n === 'number' && !Number.isNaN(n) && n >= 0) return n;
  const parsed = Number(n);
  return !Number.isNaN(parsed) && parsed >= 0 ? parsed : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMOJIS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/live/emojis/create — Creator uploads custom emoji
 */
export async function handleEmojiCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = await request.json() as Record<string, unknown>;
    const shortcode = safeString(body.shortcode, 32);
    const imageUrl = safeString(body.imageUrl, 512);
    const category = safeString(body.category, 32) || 'custom';
    const tier = (safeString(body.tier, 16) || 'premium') as CreatorEmoji['tier'];
    const animatedUrl = safeString(body.animatedUrl, 512) || undefined;
    const priceSats = safeNumber(body.purchaseSats);

    if (!shortcode || !imageUrl) {
      return badRequest('shortcode and imageUrl are required');
    }
    if (!shortcode.startsWith(':') || !shortcode.endsWith(':')) {
      return badRequest('shortcode must start and end with ":" (e.g. :my_emoji:)');
    }

    const emoji: CreatorEmoji = {
      id: generateId(),
      creatorId: session.address,
      creatorLabel: safeString(body.creatorLabel, 64) || session.address.slice(0, 8),
      shortcode,
      imageUrl,
      animatedUrl,
      purchaseSats: tier === 'free' ? 0 : priceSats,
      purchaseUsd: tier === 'free' ? 0 : Math.round(priceSats * 0.0003 * 100) / 100,
      royaltyBps: tier === 'free' ? 0 : 500, // 5% royalty on resale
      soldCount: 0,
      tokenId: generateTokenId(),
      chain: safeString(body.chain, 16) || 'ethereum',
      tier,
      isDefault: false,
      category,
      effectClass: safeString(body.effectClass, 32) || undefined,
      createdAt: Date.now(),
      approved: true, // Auto-approve; could add moderation later
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map((t: unknown) => safeString(t, 32)) : [],
    };

    // Store emoji
    const key = `${EMOJI_CREATOR_PREFIX}${session.address}`;
    const existing = await kvGetJson<CreatorEmoji[]>(env, key) ?? [];
    existing.push(emoji);
    await kvPutJson(env, key, existing);

    // Add to marketplace index
    const marketplace = await kvGetJson<CreatorEmoji[]>(env, EMOJI_MARKETPLACE_KEY) ?? [];
    marketplace.push(emoji);
    await kvPutJson(env, EMOJI_MARKETPLACE_KEY, marketplace);

    return ok({ success: true, emoji });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Failed to create emoji');
  }
}

/**
 * GET /api/live/emojis/marketplace — Browse all emojis
 */
export async function handleEmojiMarketplace(_request: Request, env: Env): Promise<Response> {
  const marketplace = await kvGetJson<CreatorEmoji[]>(env, EMOJI_MARKETPLACE_KEY) ?? [];

  // Combine with default emojis
  const allEmojis = [...DEFAULT_CREATOR_EMOJIS, ...marketplace];

  return ok({
    emojis: allEmojis.map((e) => ({
      id: e.id,
      creatorId: e.creatorId,
      creatorLabel: e.creatorLabel,
      shortcode: e.shortcode,
      imageUrl: e.imageUrl,
      animatedUrl: e.animatedUrl,
      purchaseSats: e.purchaseSats,
      purchaseUsd: e.purchaseUsd,
      tier: e.tier,
      isDefault: e.isDefault,
      category: e.category,
      effectClass: e.effectClass,
      soldCount: e.soldCount,
      tags: e.tags,
    })),
    total: allEmojis.length,
  });
}

/**
 * POST /api/live/emojis/:id/buy — Purchase emoji NFT
 */
export async function handleEmojiBuy(request: Request, env: Env, emojiId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const marketplace = await kvGetJson<CreatorEmoji[]>(env, EMOJI_MARKETPLACE_KEY) ?? [];
    const emoji = marketplace.find((e) => e.id === emojiId);
    if (!emoji) return badRequest('Emoji not found');
    if (emoji.isDefault) return badRequest('Cannot purchase default emojis');
    if (emoji.purchaseSats === 0) return badRequest('This emoji is free');

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const chain = safeString(body.chain, 16) || 'ethereum';

    const purchase: EmojiPurchase = {
      id: generateId(),
      emojiId,
      buyerId: session.address,
      buyerLabel: safeString(body.buyerLabel, 64) || session.address.slice(0, 8),
      creatorId: emoji.creatorId,
      creatorLabel: emoji.creatorLabel,
      sats: emoji.purchaseSats,
      usd: emoji.purchaseUsd,
      chain,
      txHash: safeString(body.txHash, 128) || undefined,
      timestamp: Date.now(),
    };

    // Record purchase
    const purchases = await kvGetJson<EmojiPurchase[]>(env, `${EMOJI_PURCHASE_PREFIX}${session.address}`) ?? [];
    purchases.push(purchase);
    await kvPutJson(env, `${EMOJI_PURCHASE_PREFIX}${session.address}`, purchases);

    // Update sold count
    emoji.soldCount += 1;
    const idx = marketplace.findIndex((e) => e.id === emojiId);
    marketplace[idx] = emoji;
    await kvPutJson(env, EMOJI_MARKETPLACE_KEY, marketplace);

    // Update creator earnings
    await updateCreatorEarnings(env, emoji.creatorId, 'emoji', emoji.purchaseSats, emoji.purchaseUsd);

    return ok({ success: true, purchase });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Failed to purchase emoji');
  }
}

/**
 * GET /api/live/emojis/my-purchases — User's purchased emojis
 */
export async function handleMyEmojis(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const purchases = await kvGetJson<EmojiPurchase[]>(env, `${EMOJI_PURCHASE_PREFIX}${session.address}`) ?? [];
  const marketplace = await kvGetJson<CreatorEmoji[]>(env, EMOJI_MARKETPLACE_KEY) ?? [];

  const purchasedEmojis = purchases
    .map((p) => marketplace.find((e) => e.id === p.emojiId))
    .filter(Boolean) as CreatorEmoji[];

  // Always include defaults
  return ok({
    emojis: [
      ...DEFAULT_CREATOR_EMOJIS.map((e) => ({ ...e, owned: true })),
      ...purchasedEmojis.map((e) => ({ ...e, owned: true })),
    ],
  });
}

/**
 * GET /api/live/emojis/creator/:creatorId — Creator's custom emojis
 */
export async function handleCreatorEmojis(_request: Request, env: Env, creatorId: string): Promise<Response> {
  const key = `${EMOJI_CREATOR_PREFIX}${creatorId}`;
  const emojis = await kvGetJson<CreatorEmoji[]>(env, key) ?? [];
  return ok({ creatorId, emojis });
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM GIFTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/live/gifts/custom/create — Create custom gift
 */
export async function handleCustomGiftCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = await request.json() as Record<string, unknown>;
    const name = safeString(body.name, 64);
    const icon = safeString(body.icon, 8);
    const rarity = (safeString(body.rarity, 20) || 'common') as CustomGift['rarity'];
    const description = safeString(body.description, 256);

    if (!name || !icon) {
      return badRequest('name and icon are required');
    }

    const rarityCfg = GIFT_RARITY_CONFIG[rarity];
    const baseSats = 1_000; // base price for common
    const sats = Math.round(baseSats * rarityCfg.priceMultiplier);
    const usd = Math.round(sats * 0.0003 * 100) / 100;

    const gift: CustomGift = {
      id: generateId(),
      creatorId: session.address,
      creatorLabel: safeString(body.creatorLabel, 64) || session.address.slice(0, 8),
      name,
      icon,
      imageUrl: safeString(body.imageUrl, 512) || undefined,
      animationClass: `custom-gift-${rarity}-${generateId().slice(0, 6)}`,
      animationDurationSec: 2 + rarityCfg.animationIntensity,
      rarity,
      sats,
      usd,
      creatorEarnsUsd: calculateCreatorNet(usd),
      platformFeeUsd: calculateFee(usd),
      tokenId: generateTokenId(),
      chain: safeString(body.chain, 16) || 'ethereum',
      soldCount: 0,
      active: true,
      createdAt: Date.now(),
      description,
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map((t: unknown) => safeString(t, 32)) : [],
    };

    // Store
    const creatorGifts = await kvGetJson<CustomGift[]>(env, `${GIFTS_CREATOR_PREFIX}${session.address}`) ?? [];
    creatorGifts.push(gift);
    await kvPutJson(env, `${GIFTS_CREATOR_PREFIX}${session.address}`, creatorGifts);

    // Add to global list
    const allGifts = await kvGetJson<CustomGift[]>(env, GIFTS_CUSTOM_KEY) ?? [];
    allGifts.push(gift);
    await kvPutJson(env, GIFTS_CUSTOM_KEY, allGifts);

    return ok({ success: true, gift });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Failed to create gift');
  }
}

/**
 * GET /api/live/gifts/custom/:creatorId — View creator's custom gifts
 */
export async function handleCreatorCustomGifts(_request: Request, env: Env, creatorId: string): Promise<Response> {
  const key = `${GIFTS_CREATOR_PREFIX}${creatorId}`;
  const gifts = await kvGetJson<CustomGift[]>(env, key) ?? [];
  return ok({
    creatorId,
    gifts: gifts.filter((g) => g.active),
  });
}

/**
 * POST /api/live/gifts/custom/:id/buy — Purchase custom gift NFT
 */
export async function handleCustomGiftBuy(request: Request, env: Env, giftId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const allGifts = await kvGetJson<CustomGift[]>(env, GIFTS_CUSTOM_KEY) ?? [];
    const gift = allGifts.find((g) => g.id === giftId);
    if (!gift) return badRequest('Gift not found');
    if (!gift.active) return badRequest('Gift is no longer available');

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const chain = safeString(body.chain, 16) || 'ethereum';

    const purchase: CustomGiftPurchase = {
      id: generateId(),
      giftId,
      buyerId: session.address,
      buyerLabel: safeString(body.buyerLabel, 64) || session.address.slice(0, 8),
      creatorId: gift.creatorId,
      creatorLabel: gift.creatorLabel,
      sats: gift.sats,
      usd: gift.usd,
      chain,
      txHash: safeString(body.txHash, 128) || undefined,
      timestamp: Date.now(),
    };

    const buyerPurchases = await kvGetJson<CustomGiftPurchase[]>(env, `${GIFTS_PURCHASE_PREFIX}${session.address}`) ?? [];
    buyerPurchases.push(purchase);
    await kvPutJson(env, `${GIFTS_PURCHASE_PREFIX}${session.address}`, buyerPurchases);

    // Update sold count
    gift.soldCount += 1;
    const idx = allGifts.findIndex((g) => g.id === giftId);
    allGifts[idx] = gift;
    await kvPutJson(env, GIFTS_CUSTOM_KEY, allGifts);

    // Creator earnings
    await updateCreatorEarnings(env, gift.creatorId, 'gift', gift.sats, gift.usd);

    return ok({ success: true, purchase });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Failed to purchase gift');
  }
}

/**
 * GET /api/live/gifts/custom/marketplace — Browse all custom gifts
 */
export async function handleCustomGiftMarketplace(_request: Request, env: Env): Promise<Response> {
  const allGifts = await kvGetJson<CustomGift[]>(env, GIFTS_CUSTOM_KEY) ?? [];
  return ok({
    gifts: allGifts
      .filter((g) => g.active)
      .map((g) => ({
        id: g.id,
        creatorId: g.creatorId,
        creatorLabel: g.creatorLabel,
        name: g.name,
        icon: g.icon,
        rarity: g.rarity,
        rarityLabel: GIFT_RARITY_CONFIG[g.rarity].label,
        rarityColor: GIFT_RARITY_CONFIG[g.rarity].color,
        sats: g.sats,
        usd: g.usd,
        soldCount: g.soldCount,
        description: g.description,
        tags: g.tags,
      })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FACE FILTERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/live/filters — Available filters
 */
export async function handleFiltersList(_request: Request, env: Env): Promise<Response> {
  return ok({
    filters: DEFAULT_FILTERS.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      thumbnailUrl: f.thumbnailUrl,
      access: f.access,
      creatorId: f.creatorId,
      creatorLabel: f.creatorLabel,
      purchaseSats: f.purchaseSats,
      purchaseUsd: f.purchaseUsd,
      usesFaceTracking: f.usesFaceTracking,
      isBackground: f.isBackground,
      tags: f.tags,
    })),
  });
}

/**
 * POST /api/live/filters/:id/buy — Purchase filter
 */
export async function handleFilterBuy(request: Request, env: Env, filterId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const filter = DEFAULT_FILTERS.find((f) => f.id === filterId);
  if (!filter) return badRequest('Filter not found');
  if (filter.access === 'free') return badRequest('This filter is free');
  if (filter.access === 'creator_only') return badRequest('This filter is creator-only');

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const chain = safeString(body.chain, 16) || 'ethereum';

  const purchase: FilterPurchase = {
    id: generateId(),
    filterId,
    buyerId: session.address,
    sats: filter.purchaseSats,
    usd: filter.purchaseUsd,
    chain,
    txHash: safeString(body.txHash, 128) || undefined,
    timestamp: Date.now(),
  };

  const userFilters = await kvGetJson<FilterPurchase[]>(env, `${FILTER_PURCHASE_PREFIX}${session.address}`) ?? [];
  userFilters.push(purchase);
  await kvPutJson(env, `${FILTER_PURCHASE_PREFIX}${session.address}`, userFilters);

  return ok({ success: true, purchase });
}

/**
 * GET /api/live/filters/my-filters — User's purchased and available filters
 */
export async function handleMyFilters(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const purchases = await kvGetJson<FilterPurchase[]>(env, `${FILTER_PURCHASE_PREFIX}${session.address}`) ?? [];
  const purchasedIds = new Set(purchases.map((p) => p.filterId));

  const filters = DEFAULT_FILTERS.map((f) => ({
    ...f,
    owned: f.access === 'free' || purchasedIds.has(f.id),
  }));

  return ok({ filters });
}

// ═══════════════════════════════════════════════════════════════════════════
// STICKERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/live/stickers — Available stickers
 */
export async function handleStickersList(_request: Request, env: Env): Promise<Response> {
  return ok({
    stickers: DEFAULT_STICKERS.map((s) => ({
      id: s.id,
      name: s.name,
      imageUrl: s.imageUrl,
      animatedUrl: s.animatedUrl,
      category: s.category,
      isFree: s.isFree,
      purchaseSats: s.purchaseSats,
      purchaseUsd: s.purchaseUsd,
      viewerTriggerable: s.viewerTriggerable,
      floatAnimation: s.floatAnimation,
      floatDurationSec: s.floatDurationSec,
      sizeClass: s.sizeClass,
      tags: s.tags,
    })),
  });
}

/**
 * POST /api/live/stickers/:id/buy — Purchase sticker
 */
export async function handleStickerBuy(request: Request, env: Env, stickerId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sticker = DEFAULT_STICKERS.find((s) => s.id === stickerId);
  if (!sticker) return badRequest('Sticker not found');
  if (sticker.isFree) return badRequest('This sticker is free');

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const chain = safeString(body.chain, 16) || 'ethereum';

  const purchase = {
    id: generateId(),
    stickerId,
    buyerId: session.address,
    sats: sticker.purchaseSats,
    usd: sticker.purchaseUsd,
    chain,
    txHash: safeString(body.txHash, 128) || undefined,
    timestamp: Date.now(),
  };

  const userStickers = await kvGetJson<unknown[]>(env, `${FILTER_PURCHASE_PREFIX}stickers:${session.address}`) ?? [];
  userStickers.push(purchase);
  await kvPutJson(env, `${FILTER_PURCHASE_PREFIX}stickers:${session.address}`, userStickers);

  return ok({ success: true, purchase });
}

/**
 * POST /api/live/stickers/:id/trigger — Trigger sticker on stream
 */
export async function handleStickerTrigger(request: Request, env: Env, stickerId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sticker = DEFAULT_STICKERS.find((s) => s.id === stickerId);
  if (!sticker) return badRequest('Sticker not found');

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const streamId = safeString(body.streamId, 64);
  if (!streamId) return badRequest('streamId is required');

  if (!sticker.viewerTriggerable) {
    // Only creator can trigger these
    // (would check if session.address is the stream creator)
  }

  const trigger: StickerTrigger = {
    id: generateId(),
    stickerId,
    streamId,
    triggererId: session.address,
    triggererLabel: safeString(body.triggererLabel, 64) || session.address.slice(0, 8),
    timestamp: Date.now(),
  };

  const triggers = await kvGetJson<StickerTrigger[]>(env, `${STICKER_TRIGGER_PREFIX}${streamId}`) ?? [];
  triggers.push(trigger);
  // Keep only last 50
  if (triggers.length > 50) triggers.splice(0, triggers.length - 50);
  await kvPutJson(env, `${STICKER_TRIGGER_PREFIX}${streamId}`, triggers);

  return ok({ success: true, trigger });
}

/**
 * GET /api/live/stickers/active/:streamId — Active sticker triggers for stream
 */
export async function handleActiveStickers(_request: Request, env: Env, streamId: string): Promise<Response> {
  const triggers = await kvGetJson<StickerTrigger[]>(env, `${STICKER_TRIGGER_PREFIX}${streamId}`) ?? [];
  return ok({
    streamId,
    triggers: triggers.slice(-20), // Last 20 triggers
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATOR EARNINGS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/live/creator-content/earnings — Creator earnings dashboard
 */
export async function handleCreatorContentEarnings(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const earnings = await kvGetJson<CreatorContentEarnings>(env, `${EARNINGS_PREFIX}${session.address}`) ?? {
    creatorId: session.address,
    emojiSalesSats: 0, emojiSalesUsd: 0, emojiSoldCount: 0,
    giftSalesSats: 0, giftSalesUsd: 0, giftSoldCount: 0,
    filterSalesSats: 0, filterSalesUsd: 0, filterSoldCount: 0,
    stickerSalesSats: 0, stickerSalesUsd: 0, stickerSoldCount: 0,
    totalSalesSats: 0, totalSalesUsd: 0,
    platformFeesSats: 0, platformFeesUsd: 0,
    lastUpdated: Date.now(),
  };

  return ok({ earnings });
}

// ═══════════════════════════════════════════════════════════════════════════
// EARNINGS UPDATE HELPER
// ═══════════════════════════════════════════════════════════════════════════

async function updateCreatorEarnings(
  env: Env,
  creatorId: string,
  type: 'emoji' | 'gift' | 'filter' | 'sticker',
  sats: number,
  usd: number,
): Promise<void> {
  const key = `${EARNINGS_PREFIX}${creatorId}`;
  const earnings = await kvGetJson<CreatorContentEarnings>(env, key) ?? {
    creatorId,
    emojiSalesSats: 0, emojiSalesUsd: 0, emojiSoldCount: 0,
    giftSalesSats: 0, giftSalesUsd: 0, giftSoldCount: 0,
    filterSalesSats: 0, filterSalesUsd: 0, filterSoldCount: 0,
    stickerSalesSats: 0, stickerSalesUsd: 0, stickerSoldCount: 0,
    totalSalesSats: 0, totalSalesUsd: 0,
    platformFeesSats: 0, platformFeesUsd: 0,
    lastUpdated: Date.now(),
  };

  const feeSats = Math.round(sats * 0.15);
  const feeUsd = Math.round(usd * 0.15 * 100) / 100;
  const netSats = sats - feeSats;
  const netUsd = Math.round((usd - feeUsd) * 100) / 100;

  switch (type) {
    case 'emoji':
      earnings.emojiSalesSats += netSats;
      earnings.emojiSalesUsd += netUsd;
      earnings.emojiSoldCount += 1;
      break;
    case 'gift':
      earnings.giftSalesSats += netSats;
      earnings.giftSalesUsd += netUsd;
      earnings.giftSoldCount += 1;
      break;
    case 'filter':
      earnings.filterSalesSats += netSats;
      earnings.filterSalesUsd += netUsd;
      earnings.filterSoldCount += 1;
      break;
    case 'sticker':
      earnings.stickerSalesSats += netSats;
      earnings.stickerSalesUsd += netUsd;
      earnings.stickerSoldCount += 1;
      break;
  }

  earnings.totalSalesSats = earnings.emojiSalesSats + earnings.giftSalesSats + earnings.filterSalesSats + earnings.stickerSalesSats;
  earnings.totalSalesUsd = Math.round((earnings.emojiSalesUsd + earnings.giftSalesUsd + earnings.filterSalesUsd + earnings.stickerSalesUsd) * 100) / 100;
  earnings.platformFeesSats += feeSats;
  earnings.platformFeesUsd = Math.round((earnings.platformFeesUsd + feeUsd) * 100) / 100;
  earnings.lastUpdated = Date.now();

  await kvPutJson(env, key, earnings);
}
