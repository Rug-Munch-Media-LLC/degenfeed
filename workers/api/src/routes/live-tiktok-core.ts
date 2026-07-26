/**
 * @degenfeed/api-worker — Live TikTok-Style Core
 *
 * Custom emojis, custom gifts, face filters, sticker overlays.
 * NFT-gated (ERC-1155 fantasy) with creator royalties.
 *
 * Integration:
 *   - KV for state persistence
 *   - IPFS/R2 for uploaded assets (emoji/FaceFilter PNG/GLB)
 *   - WebSocket for real-time sticker triggers and filter changes
 */

import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// 1. CREATOR EMOJIS
// ═══════════════════════════════════════════════════════════════════════════

export type EmojiTier = 'free' | 'premium' | 'legendary';

export interface CreatorEmoji {
  /** Unique emoji ID (uuid) */
  id: string;
  /** Creator who uploaded/authored this emoji */
  creatorId: string;
  /** Creator display name */
  creatorLabel: string;
  /** Emoji shortcode — eg :alice_rain: */
  shortcode: string;
  /** Emoji image URL (R2 / IPFS) */
  imageUrl: string;
  /** Animated variant URL (APNG / WebP / GIF) */
  animatedUrl?: string;
  /** Price in sats to purchase (0 = free) */
  purchaseSats: number;
  /** Price in USD */
  purchaseUsd: number;
  /** Creator royalty basis points (e.g. 500 = 5%) */
  royaltyBps: number;
  /** Total copies sold */
  soldCount: number;
  /** ERC-1155 token ID for NFT minting */
  tokenId?: string;
  /** NFT contract address (fantasy) */
  contractAddress?: string;
  /** Chain: 'ethereum' | 'solana' | 'base' */
  chain: string;
  /** Tier */
  tier: EmojiTier;
  /** Whether this is part of a default free set */
  isDefault: boolean;
  /** Categories for filtering */
  category: string;
  /** Special particle effect class on send */
  effectClass?: string;
  /** Timestamp */
  createdAt: number;
  /** Whether the emoji is approved */
  approved: boolean;
  /** Tags for search */
  tags: string[];
}

export interface EmojiPurchase {
  id: string;
  emojiId: string;
  buyerId: string;
  buyerLabel: string;
  creatorId: string;
  creatorLabel: string;
  sats: number;
  usd: number;
  chain: string;
  txHash?: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// FREE DEFAULT EMOJI SET (always available)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_CREATOR_EMOJIS: CreatorEmoji[] = [
  // Free defaults — any creator can use these
  {
    id: 'degen_fire',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':fire:',
    imageUrl: '🔥',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'reactions',
    effectClass: 'emoji-burst',
    createdAt: Date.now(),
    approved: true,
    tags: ['fire', 'hot', 'lit'],
  },
  {
    id: 'degen_moon',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':moon:',
    imageUrl: '🚀',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'reactions',
    effectClass: 'emoji-launch',
    createdAt: Date.now(),
    approved: true,
    tags: ['moon', 'rocket', 'launch'],
  },
  {
    id: 'degen_clown',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':clown:',
    imageUrl: '🤡',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'faces',
    effectClass: 'emoji-wobble',
    createdAt: Date.now(),
    approved: true,
    tags: ['clown', 'joke'],
  },
  {
    id: 'degen_bag',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':bag:',
    imageUrl: '💰',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'crypto',
    effectClass: 'emoji-rain',
    createdAt: Date.now(),
    approved: true,
    tags: ['bag', 'money', 'profit'],
  },
  {
    id: 'degen_diamond',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':diamond:',
    imageUrl: '💎',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'crypto',
    effectClass: 'emoji-sparkle',
    createdAt: Date.now(),
    approved: true,
    tags: ['diamond', 'hands', 'hodl'],
  },
  {
    id: 'degen_pepe',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':pepe:',
    imageUrl: '🐸',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'meme',
    effectClass: 'emoji-bounce',
    createdAt: Date.now(),
    approved: true,
    tags: ['pepe', 'frog', 'meme'],
  },
  {
    id: 'degen_glad',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':glad:',
    imageUrl: '😎',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'faces',
    effectClass: undefined,
    createdAt: Date.now(),
    approved: true,
    tags: ['cool', 'glad', 'sunglasses'],
  },
  {
    id: 'degen_lfg',
    creatorId: '__system__',
    creatorLabel: 'DegenFeed',
    shortcode: ':lfg:',
    imageUrl: '⚔️',
    animatedUrl: undefined,
    purchaseSats: 0,
    purchaseUsd: 0,
    royaltyBps: 0,
    soldCount: 0,
    chain: 'ethereum',
    tier: 'free',
    isDefault: true,
    category: 'reactions',
    effectClass: 'emoji-shake',
    createdAt: Date.now(),
    approved: true,
    tags: ['lfg', 'letsgo', 'hype'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. CUSTOM GIFT ICONS
// ═══════════════════════════════════════════════════════════════════════════

export type GiftRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'creator_exclusive';

export interface CustomGift {
  /** Unique gift ID */
  id: string;
  /** Creator who designed this gift */
  creatorId: string;
  /** Creator display name */
  creatorLabel: string;
  /** Gift display name — e.g. "alice's Rocket" */
  name: string;
  /** Emoji / icon */
  icon: string;
  /** Custom image URL for the gift */
  imageUrl?: string;
  /** Custom animation CSS class */
  animationClass: string;
  /** Custom animation duration */
  animationDurationSec: number;
  /** Rarity tier */
  rarity: GiftRarity;
  /** Price in sats */
  sats: number;
  /** Price in USD */
  usd: number;
  /** Creator earns (85% after platform fee) */
  creatorEarnsUsd: number;
  /** Platform fee */
  platformFeeUsd: number;
  /** ERC-1155 token ID */
  tokenId: string;
  /** Chain */
  chain: string;
  /** Total sold */
  soldCount: number;
  /** Whether this is currently available */
  active: boolean;
  /** Timestamp created */
  createdAt: number;
  /** Description for tooltip */
  description: string;
  /** Tags for discoverability */
  tags: string[];
}

export interface CustomGiftPurchase {
  id: string;
  giftId: string;
  buyerId: string;
  buyerLabel: string;
  creatorId: string;
  creatorLabel: string;
  sats: number;
  usd: number;
  chain: string;
  txHash?: string;
  /** Used in stream */
  usedInStream?: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// RARITY CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export const GIFT_RARITY_CONFIG: Record<
  GiftRarity,
  {
    label: string;
    color: string;
    animationIntensity: number;
    priceMultiplier: number;
  }
> = {
  common: { label: 'Common', color: '#9CA3AF', animationIntensity: 1, priceMultiplier: 1 },
  rare: { label: 'Rare', color: '#3B82F6', animationIntensity: 2, priceMultiplier: 2.5 },
  epic: { label: 'Epic', color: '#8B5CF6', animationIntensity: 3, priceMultiplier: 5 },
  legendary: { label: 'Legendary', color: '#F59E0B', animationIntensity: 4, priceMultiplier: 10 },
  creator_exclusive: {
    label: 'Creator Exclusive',
    color: '#EC4899',
    animationIntensity: 5,
    priceMultiplier: 15,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. FACE FILTERS & AR OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════

export type FilterCategory = 'hat' | 'mask' | 'beauty' | 'background' | 'accessory';
export type FilterAccess = 'free' | 'premium' | 'nft' | 'creator_only';

export interface FaceFilter {
  /** Unique filter ID */
  id: string;
  /** Display name */
  name: string;
  /** Category */
  category: FilterCategory;
  /** Thumbnail URL */
  thumbnailUrl: string;
  /** GLB/JSON overlay asset URL (for 3D hats, masks) */
  assetUrl?: string;
  /** Overlay image URL (PNG with alpha for 2D overlays) */
  overlayUrl?: string;
  /** Shader code or effect name for beauty filters */
  shaderEffect?: string;
  /** Access level */
  access: FilterAccess;
  /** Creator who created this (for creator_only) */
  creatorId?: string;
  /** Creator label */
  creatorLabel?: string;
  /** NFT purchase price in sats (for nft access) */
  purchaseSats: number;
  /** Purchase USD */
  purchaseUsd: number;
  /** ERC-1155 token ID */
  tokenId?: string;
  /** Chain */
  chain: string;
  /** Total purchased */
  purchasedCount: number;
  /** Whether the filter uses the device camera for face tracking */
  usesFaceTracking: boolean;
  /** Whether this filter is a background replacement */
  isBackground: boolean;
  /** Background blur radius (0 = no blur) */
  backgroundBlur?: number;
  /** Background replace image URL */
  backgroundReplaceUrl?: string;
  /** Tags */
  tags: string[];
  /** Active */
  active: boolean;
  /** Timestamp */
  createdAt: number;
}

export interface FilterPurchase {
  id: string;
  filterId: string;
  buyerId: string;
  sats: number;
  usd: number;
  chain: string;
  txHash?: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT FILTERS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_FILTERS: FaceFilter[] = [
  {
    id: 'hat_cowboy',
    name: 'Cowboy Hat',
    category: 'hat',
    thumbnailUrl: '🤠',
    assetUrl: undefined,
    overlayUrl: '/filters/cowboy-hat.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['hat', 'cowboy', 'western'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'hat_crown',
    name: 'Crown',
    category: 'hat',
    thumbnailUrl: '👑',
    assetUrl: undefined,
    overlayUrl: '/filters/crown.png',
    access: 'premium',
    purchaseSats: 5_000,
    purchaseUsd: 1.5,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['crown', 'royal'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'hat_wizard',
    name: 'Wizard Hat',
    category: 'hat',
    thumbnailUrl: '🧙',
    assetUrl: undefined,
    overlayUrl: '/filters/wizard-hat.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['wizard', 'magic'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'hat_tophat',
    name: 'Top Hat',
    category: 'hat',
    thumbnailUrl: '🎩',
    assetUrl: undefined,
    overlayUrl: '/filters/top-hat.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['tophat', 'formal'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'hat_party',
    name: 'Party Hat',
    category: 'hat',
    thumbnailUrl: '🎉',
    assetUrl: undefined,
    overlayUrl: '/filters/party-hat.png',
    access: 'premium',
    purchaseSats: 2_000,
    purchaseUsd: 0.6,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['party', 'birthday'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'mask_cat',
    name: 'Cat Mask',
    category: 'mask',
    thumbnailUrl: '🐱',
    overlayUrl: '/filters/cat-mask.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['cat', 'animal', 'cute'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'mask_dog',
    name: 'Dog Mask',
    category: 'mask',
    thumbnailUrl: '🐶',
    overlayUrl: '/filters/dog-mask.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['dog', 'animal', 'cute'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'mask_robot',
    name: 'Robot Face',
    category: 'mask',
    thumbnailUrl: '🤖',
    overlayUrl: '/filters/robot-mask.png',
    access: 'nft',
    purchaseSats: 10_000,
    purchaseUsd: 3.0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['robot', 'cyber', 'tech'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'mask_alien',
    name: 'Alien',
    category: 'mask',
    thumbnailUrl: '👽',
    overlayUrl: '/filters/alien-mask.png',
    access: 'premium',
    purchaseSats: 3_000,
    purchaseUsd: 0.9,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['alien', 'space', 'ufo'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'mask_skull',
    name: 'Skull',
    category: 'mask',
    thumbnailUrl: '💀',
    overlayUrl: '/filters/skull-mask.png',
    access: 'nft',
    purchaseSats: 7_500,
    purchaseUsd: 2.25,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['skull', 'spooky'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'beauty_smooth',
    name: 'Smooth Skin',
    category: 'beauty',
    thumbnailUrl: '✨',
    shaderEffect: 'smooth',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['beauty', 'smooth'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'beauty_glow',
    name: 'Golden Glow',
    category: 'beauty',
    thumbnailUrl: '🌟',
    shaderEffect: 'glow',
    access: 'premium',
    purchaseSats: 4_000,
    purchaseUsd: 1.2,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['glow', 'golden'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'beauty_blush',
    name: 'Blush',
    category: 'beauty',
    thumbnailUrl: '🌸',
    shaderEffect: 'blush',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['blush', 'cute'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'bg_blur',
    name: 'Soft Blur',
    category: 'background',
    thumbnailUrl: '🌫️',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: false,
    isBackground: true,
    backgroundBlur: 10,
    tags: ['blur', 'background'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'bg_space',
    name: 'Outer Space',
    category: 'background',
    thumbnailUrl: '🌌',
    backgroundReplaceUrl: '/filters/bg-space.jpg',
    access: 'premium',
    purchaseSats: 3_000,
    purchaseUsd: 0.9,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: false,
    isBackground: true,
    tags: ['space', 'galaxy'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'bg_cyber',
    name: 'Cyberpunk City',
    category: 'background',
    thumbnailUrl: '🌃',
    backgroundReplaceUrl: '/filters/bg-cyber.jpg',
    access: 'nft',
    purchaseSats: 8_000,
    purchaseUsd: 2.4,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: false,
    isBackground: true,
    tags: ['cyber', 'city', 'night'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'accessory_sunglasses',
    name: 'Degen Shades',
    category: 'accessory',
    thumbnailUrl: '😎',
    overlayUrl: '/filters/degen-shades.png',
    access: 'free',
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['shades', 'cool'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'accessory_monocle',
    name: 'Crypto Monocle',
    category: 'accessory',
    thumbnailUrl: '🧐',
    overlayUrl: '/filters/monocle.png',
    access: 'premium',
    purchaseSats: 2_500,
    purchaseUsd: 0.75,
    chain: 'ethereum',
    purchasedCount: 0,
    usesFaceTracking: true,
    isBackground: false,
    tags: ['monocle', 'smart'],
    active: true,
    createdAt: Date.now(),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. STICKER OVERLAYS
// ═══════════════════════════════════════════════════════════════════════════

export type StickerCategory = 'logo' | 'fan' | 'event' | 'reaction' | 'rain';

export interface LiveSticker {
  /** Unique sticker ID */
  id: string;
  /** Display name */
  name: string;
  /** Image/emoji URL */
  imageUrl: string;
  /** Animated variant */
  animatedUrl?: string;
  /** Category */
  category: StickerCategory;
  /** Whether this is free or paid */
  isFree: boolean;
  /** Price in sats (if not free) */
  purchaseSats: number;
  /** Price USD */
  purchaseUsd: number;
  /** ERC-1155 token ID */
  tokenId?: string;
  /** Chain */
  chain: string;
  /** Whether this sticker can be triggered by viewers (vs creator only) */
  viewerTriggerable: boolean;
  /** Float direction: 'up', 'diagonal', 'rain', 'explode' */
  floatAnimation: 'up' | 'diagonal' | 'rain' | 'explode';
  /** Duration of float animation */
  floatDurationSec: number;
  /** Size class: 'sm' | 'md' | 'lg' */
  sizeClass: 'sm' | 'md' | 'lg';
  /** Tags */
  tags: string[];
  /** Active */
  active: boolean;
  /** Creator who owns this (if creator-specific) */
  creatorId?: string;
  /** Creator label */
  creatorLabel?: string;
  createdAt: number;
}

export interface StickerTrigger {
  id: string;
  stickerId: string;
  streamId: string;
  triggererId?: string;
  triggererLabel?: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT STICKERS
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_STICKERS: LiveSticker[] = [
  {
    id: 'sticker_heart_rain',
    name: 'Heart Rain',
    imageUrl: '❤️',
    animatedUrl: undefined,
    category: 'rain',
    isFree: true,
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'rain',
    floatDurationSec: 4,
    sizeClass: 'sm',
    tags: ['heart', 'love', 'rain'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_lfg',
    name: 'LFG!',
    imageUrl: '⚔️',
    animatedUrl: undefined,
    category: 'reaction',
    isFree: true,
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'diagonal',
    floatDurationSec: 3,
    sizeClass: 'md',
    tags: ['lfg', 'hype', 'letsgo'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_ama',
    name: 'AMA',
    imageUrl: '🎙️',
    animatedUrl: undefined,
    category: 'event',
    isFree: false,
    purchaseSats: 5_000,
    purchaseUsd: 1.5,
    chain: 'ethereum',
    viewerTriggerable: false,
    floatAnimation: 'up',
    floatDurationSec: 5,
    sizeClass: 'lg',
    tags: ['ama', 'event', 'qna'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_giveaway',
    name: 'Giveaway',
    imageUrl: '🎁',
    animatedUrl: undefined,
    category: 'event',
    isFree: false,
    purchaseSats: 10_000,
    purchaseUsd: 3.0,
    chain: 'ethereum',
    viewerTriggerable: false,
    floatAnimation: 'explode',
    floatDurationSec: 6,
    sizeClass: 'lg',
    tags: ['giveaway', 'prize'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_rocket',
    name: 'Rocket Launch',
    imageUrl: '🚀',
    animatedUrl: undefined,
    category: 'reaction',
    isFree: true,
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'diagonal',
    floatDurationSec: 3,
    sizeClass: 'md',
    tags: ['rocket', 'moon', 'launch'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_moon',
    name: 'To The Moon',
    imageUrl: '🌙',
    animatedUrl: undefined,
    category: 'reaction',
    isFree: true,
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'up',
    floatDurationSec: 4,
    sizeClass: 'md',
    tags: ['moon', 'moon'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_fire',
    name: 'Fire Storm',
    imageUrl: '🔥',
    animatedUrl: undefined,
    category: 'reaction',
    isFree: false,
    purchaseSats: 2_000,
    purchaseUsd: 0.6,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'explode',
    floatDurationSec: 3,
    sizeClass: 'md',
    tags: ['fire', 'hot'],
    active: true,
    createdAt: Date.now(),
  },
  {
    id: 'sticker_confetti',
    name: 'Confetti Burst',
    imageUrl: '🎊',
    animatedUrl: undefined,
    category: 'reaction',
    isFree: true,
    purchaseSats: 0,
    purchaseUsd: 0,
    chain: 'ethereum',
    viewerTriggerable: true,
    floatAnimation: 'explode',
    floatDurationSec: 3,
    sizeClass: 'md',
    tags: ['confetti', 'celebrate'],
    active: true,
    createdAt: Date.now(),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. CREATOR EARNINGS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export interface CreatorContentEarnings {
  creatorId: string;
  /** Total from emoji sales */
  emojiSalesSats: number;
  emojiSalesUsd: number;
  emojiSoldCount: number;
  /** Total from custom gift sales */
  giftSalesSats: number;
  giftSalesUsd: number;
  giftSoldCount: number;
  /** Total from filter sales */
  filterSalesSats: number;
  filterSalesUsd: number;
  filterSoldCount: number;
  /** Total from sticker sales */
  stickerSalesSats: number;
  stickerSalesUsd: number;
  stickerSoldCount: number;
  /** Aggregated totals */
  totalSalesSats: number;
  totalSalesUsd: number;
  /** Platform fees collected */
  platformFeesSats: number;
  platformFeesUsd: number;
  /** Last updated */
  lastUpdated: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// KV KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const TTL_1Y = 60 * 60 * 24 * 365;

const PREFIX = 'live:tiktok:';
export const EMOJI_KEY = `${PREFIX}emojis`;
export const EMOJI_CREATOR_PREFIX = `${PREFIX}emojis:creator:`;
export const EMOJI_MARKETPLACE_KEY = `${PREFIX}emojis:marketplace`;
export const EMOJI_PURCHASE_PREFIX = `${PREFIX}emojis:purchases:`;

export const GIFTS_CUSTOM_KEY = `${PREFIX}gifts:custom`;
export const GIFTS_CREATOR_PREFIX = `${PREFIX}gifts:creator:`;
export const GIFTS_PURCHASE_PREFIX = `${PREFIX}gifts:purchases:`;

export const FILTERS_KEY = `${PREFIX}filters`;
export const FILTER_PURCHASE_PREFIX = `${PREFIX}filters:purchases:`;
export const FILTER_USER_PREFIX = `${PREFIX}filters:user:`;

export const STICKERS_KEY = `${PREFIX}stickers`;
export const STICKER_TRIGGER_PREFIX = `${PREFIX}stickers:trigger:`;

export const EARNINGS_PREFIX = `${PREFIX}earnings:`;

// ═══════════════════════════════════════════════════════════════════════════
// KV HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function kvPutJson(env: Env, key: string, value: unknown): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), { expirationTtl: TTL_1Y });
  } catch (err) {
    console.warn('[live-tiktok] KV put failed:', err instanceof Error ? err.message : err);
  }
}

export async function kvListByPrefix<T>(env: Env, prefix: string): Promise<T[]> {
  try {
    const list = await env.CACHE?.list({ prefix });
    if (!list?.keys.length) return [];
    const results: T[] = [];
    for (const key of list.keys) {
      const raw = await env.CACHE?.get(key.name);
      if (raw) results.push(JSON.parse(raw) as T);
    }
    return results;
  } catch {
    return [];
  }
}

export async function kvDelete(env: Env, key: string): Promise<void> {
  try {
    await env.CACHE?.delete(key);
  } catch (err) {
    console.warn('[live-tiktok] KV delete failed:', err instanceof Error ? err.message : err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FEE CALCULATION (same 85/15 split as live-gifts-core)
// ═══════════════════════════════════════════════════════════════════════════

export const PLATFORM_FEE_BPS = 1500; // 15%

export function calculateFee(grossUsd: number): number {
  return Math.round(((grossUsd * PLATFORM_FEE_BPS) / 10000) * 100) / 100;
}

export function calculateCreatorNet(grossUsd: number): number {
  return Math.round(((grossUsd * (10000 - PLATFORM_FEE_BPS)) / 10000) * 100) / 100;
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateTokenId(): string {
  return `df-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
