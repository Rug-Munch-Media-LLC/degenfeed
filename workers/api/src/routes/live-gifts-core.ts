/**
 * @degenfeed/api-worker — Live Gifts Core
 *
 * Gift/reward system for live streams. Telegram-like experience with crypto.
 * Viewers send gifts (paid in crypto), creators earn 85% (15% platform fee).
 *
 * Gift types with animations:
 *   🌹 Rose      — 100 sats  / $0.03
 *   🎈 Balloon   — 500 sats  / $0.15
 *   💎 Diamond   — 5,000 sats / $1.50
 *   🚀 Rocket    — 10,000 sats / $3.00
 *   👑 Crown     — 50,000 sats / $15.00
 *   🐳 Whale     — 100,000 sats / $30.00
 *
 * Integration with:
 *   - unified-tip-core.ts (records as tips in unified ledger)
 *   - stream-chat.ts (gift notifications in chat)
 *   - ws-broadcast.ts (real-time gift animation broadcast)
 *   - creator-rewards.ts (earnings accrual)
 *   - platform-fees.ts (fee collection)
 */

import type { Env } from '../types';

// ─── Gift Type Definitions ───────────────────────────────────────────────

export interface GiftType {
  id: GiftTypeId;
  /** Display name */
  name: string;
  /** Emoji icon */
  icon: string;
  /** Price in satoshis */
  sats: number;
  /** Price in USD (approximate at 1 sat = $0.0003) */
  usd: number;
  /** Creator earns this much in USD (85% after 15% platform fee) */
  creatorEarnsUsd: number;
  /** Platform fee in USD */
  platformFeeUsd: number;
  /** Unique gift tier for animation priority */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  /** Animation duration in seconds */
  animationDurationSec: number;
  /** Animation CSS class name for the frontend player overlay */
  animationClass: string;
  /** Whether this animation triggers a full-screen overlay */
  isFullScreenAnimation: boolean;
  /** Whether this gift is available as a subscription gift */
  canGiftSubscription: boolean;
  /** Whether this gift can be sent anonymously */
  allowsAnonymous: boolean;
  /** Human-readable description for gift picker tooltip */
  description: string;
}

export type GiftTypeId = 'rose' | 'balloon' | 'diamond' | 'rocket' | 'crown' | 'whale';

export const GIFT_TYPES: Record<GiftTypeId, GiftType> = {
  rose: {
    id: 'rose',
    name: 'Rose',
    icon: '🌹',
    sats: 100,
    usd: 0.03,
    creatorEarnsUsd: 0.0255,
    platformFeeUsd: 0.0045,
    tier: 1,
    animationDurationSec: 2,
    animationClass: 'gift-animation-rose',
    isFullScreenAnimation: false,
    canGiftSubscription: false,
    allowsAnonymous: false,
    description: 'A simple rose to show appreciation',
  },
  balloon: {
    id: 'balloon',
    name: 'Balloon',
    icon: '🎈',
    sats: 500,
    usd: 0.15,
    creatorEarnsUsd: 0.1275,
    platformFeeUsd: 0.0225,
    tier: 2,
    animationDurationSec: 3,
    animationClass: 'gift-animation-balloon',
    isFullScreenAnimation: false,
    canGiftSubscription: false,
    allowsAnonymous: true,
    description: 'A cheerful balloon float by',
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    icon: '💎',
    sats: 5_000,
    usd: 1.5,
    creatorEarnsUsd: 1.275,
    platformFeeUsd: 0.225,
    tier: 3,
    animationDurationSec: 4,
    animationClass: 'gift-animation-diamond',
    isFullScreenAnimation: false,
    canGiftSubscription: true,
    allowsAnonymous: true,
    description: 'A sparkling diamond — stand out from the crowd',
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    icon: '🚀',
    sats: 10_000,
    usd: 3.0,
    creatorEarnsUsd: 2.55,
    platformFeeUsd: 0.45,
    tier: 4,
    animationDurationSec: 5,
    animationClass: 'gift-animation-rocket',
    isFullScreenAnimation: true,
    canGiftSubscription: true,
    allowsAnonymous: true,
    description: 'Blast off! A rocket for the stream',
  },
  crown: {
    id: 'crown',
    name: 'Crown',
    icon: '👑',
    sats: 50_000,
    usd: 15.0,
    creatorEarnsUsd: 12.75,
    platformFeeUsd: 2.25,
    tier: 5,
    animationDurationSec: 6,
    animationClass: 'gift-animation-crown',
    isFullScreenAnimation: true,
    canGiftSubscription: true,
    allowsAnonymous: true,
    description: 'Royalty treatment — crown the creator',
  },
  whale: {
    id: 'whale',
    name: 'Whale',
    icon: '🐳',
    sats: 100_000,
    usd: 30.0,
    creatorEarnsUsd: 25.5,
    platformFeeUsd: 4.5,
    tier: 6,
    animationDurationSec: 8,
    animationClass: 'gift-animation-whale',
    isFullScreenAnimation: true,
    canGiftSubscription: true,
    allowsAnonymous: true,
    description: 'The biggest flex — a whale has arrived',
  },
};

export const GIFT_TIERS: GiftTypeId[] = ['rose', 'balloon', 'diamond', 'rocket', 'crown', 'whale'];

// ─── Gift Package Definitions (buy 10 at discount) ──────────────────────

export interface GiftPackage {
  id: string;
  name: string;
  description: string;
  giftTypeId: GiftTypeId;
  /** Number of gifts in the package */
  count: number;
  /** Total price in satoshis (with discount applied) */
  totalSats: number;
  /** Discount percentage vs buying individually */
  discountPercent: number;
  /** Total USD price */
  totalUsd: number;
}

export const GIFT_PACKAGES: GiftPackage[] = [
  {
    id: 'rose_x10',
    name: 'Rose Bouquet',
    description: '10 roses at 15% off',
    giftTypeId: 'rose',
    count: 10,
    totalSats: 850, // 1000 * 0.85
    discountPercent: 15,
    totalUsd: 0.255,
  },
  {
    id: 'balloon_x10',
    name: 'Balloon Cluster',
    description: '10 balloons at 15% off',
    giftTypeId: 'balloon',
    count: 10,
    totalSats: 4250,
    discountPercent: 15,
    totalUsd: 1.275,
  },
  {
    id: 'diamond_x10',
    name: 'Diamond Chest',
    description: '10 diamonds at 20% off',
    giftTypeId: 'diamond',
    count: 10,
    totalSats: 40_000, // 50_000 * 0.80
    discountPercent: 20,
    totalUsd: 12.0,
  },
  {
    id: 'rocket_x10',
    name: 'Rocket Fleet',
    description: '10 rockets at 20% off',
    giftTypeId: 'rocket',
    count: 10,
    totalSats: 80_000,
    discountPercent: 20,
    totalUsd: 24.0,
  },
  {
    id: 'crown_x10',
    name: 'Royal Collection',
    description: '10 crowns at 25% off',
    giftTypeId: 'crown',
    count: 10,
    totalSats: 375_000,
    discountPercent: 25,
    totalUsd: 112.5,
  },
  {
    id: 'whale_x10',
    name: 'Whale Pod',
    description: '10 whales at 25% off',
    giftTypeId: 'whale',
    count: 10,
    totalSats: 750_000,
    discountPercent: 25,
    totalUsd: 225.0,
  },
];

// ─── Gift Streak Definitions ─────────────────────────────────────────────

export interface GiftStreakTier {
  /** Number of gifts in a row to trigger */
  count: number;
  /** Label shown in the streak animation */
  label: string;
  /** Bonus animation class (extra overlay) */
  animationBonus: string;
  /** Multiplier on the gift value for calculating streak "bonus" display */
  displayMultiplier: number;
}

export const GIFT_STREAK_TIERS: GiftStreakTier[] = [
  { count: 3, label: 'Warming Up 🔥', animationBonus: 'streak-3', displayMultiplier: 1.0 },
  { count: 5, label: 'On Fire! 🔥🔥', animationBonus: 'streak-5', displayMultiplier: 1.1 },
  { count: 10, label: 'Unstoppable! ⚡', animationBonus: 'streak-10', displayMultiplier: 1.25 },
  { count: 25, label: 'Legendary! 👑⚡', animationBonus: 'streak-25', displayMultiplier: 1.5 },
  { count: 50, label: 'GOD MODE! 🐳🔥👑', animationBonus: 'streak-50', displayMultiplier: 2.0 },
];

// ─── Subscription Gifting ───────────────────────────────────────────────

export interface SubscriptionGiftOption {
  /** Duration in days */
  durationDays: number;
  /** Price in sats */
  sats: number;
  /** USD price */
  usd: number;
  /** Label for the UI */
  label: string;
}

export const SUBSCRIPTION_GIFT_OPTIONS: SubscriptionGiftOption[] = [
  { durationDays: 30, sats: 15_000, usd: 4.5, label: '1 Month' },
  { durationDays: 90, sats: 40_000, usd: 12.0, label: '3 Months' },
  { durationDays: 365, sats: 150_000, usd: 45.0, label: '1 Year' },
];

// ─── Recording Types ────────────────────────────────────────────────────

export interface GiftRecord {
  /** Unique gift event ID */
  id: string;
  /** Gift type ID */
  giftTypeId: GiftTypeId;
  /** Stream this gift was sent to */
  streamId: string;
  /** Creator receiving the gift */
  creatorId: string;
  /** Creator display label */
  creatorLabel?: string;
  /** Sender user ID */
  senderId?: string;
  /** Sender display name */
  senderLabel?: string;
  /** Whether this was sent anonymously */
  isAnonymous: boolean;
  /** Sats amount (gift price) */
  sats: number;
  /** USD amount */
  usd: number;
  /** Creator earns (after 15% fee) */
  creatorEarnsUsd: number;
  /** Payment chain used: 'lightning' | 'solana' | 'ethereum' | 'base' | 'creator_coin' */
  chain: string;
  /** Payment transaction hash or zap ID */
  txHash?: string;
  /** Timestamp of the gift */
  timestamp: number;
  /** Whether this was a package purchase */
  isPackage: boolean;
  /** Package ID if applicable */
  packageId?: string;
  /** Whether this is a subscription gift */
  isSubscriptionGift: boolean;
  /** Subscription duration days if applicable */
  subscriptionDays?: number;
  /** Current streak count for this sender on this stream */
  streakCount: number;
  /** Streak tier that was triggered (if any) */
  triggeredStreakTier?: GiftStreakTier;
  /** Source platform: 'degenfeed' | 'farcaster' | 'nostr' | 'bluesky' */
  platform: string;
}

export interface StreamGiftState {
  /** Stream ID */
  streamId: string;
  /** Creator ID */
  creatorId: string;
  /** Total sats earned this stream */
  totalSats: number;
  /** Total USD earned (after fee) */
  totalUsd: number;
  /** Total gifts received */
  totalGifts: number;
  /** Unique gifters count */
  uniqueGifters: number;
  /** Sender streak tracking per sender */
  streaks: Record<
    string,
    {
      /** Current consecutive gift count in this stream */
      count: number;
      /** Last gift timestamp */
      lastGiftAt: number;
      /** Highest streak achieved this stream */
      peakStreak: number;
      /** Last triggered streak tier index */
      lastStreakTierIndex: number;
    }
  >;
  /** Running leaderboard */
  leaderboard: Array<{
    senderId: string;
    senderLabel: string;
    totalUsd: number;
    totalSats: number;
    giftCount: number;
    gifts: Record<GiftTypeId, number>;
  }>;
  /** All gift records in this stream (capped) */
  gifts: GiftRecord[];
  /** When the stream started tracking */
  streamStartedAt: number;
  /** When the stream ended (for post-stream summary) */
  streamEndedAt?: number;
  /** Whether auto-payout was processed */
  payoutProcessed?: boolean;
}

// ─── KV Keys ────────────────────────────────────────────────────────────

export const GIFT_TTL_1Y = 60 * 60 * 24 * 365;
export const GIFT_STREAM_STATE_PREFIX = 'live:gifts:stream:';
export const GIFT_USER_HISTORY_PREFIX = 'live:gifts:user:';
export const GIFT_LEADERBOARD_KEY_PREFIX = 'live:gifts:leaderboard:';

export function streamGiftKey(streamId: string): string {
  return `${GIFT_STREAM_STATE_PREFIX}${streamId}`;
}

export function userGiftHistoryKey(userId: string): string {
  return `${GIFT_USER_HISTORY_PREFIX}${userId}`;
}

export function liveGiftLeaderboardKey(streamId: string): string {
  return `${GIFT_LEADERBOARD_KEY_PREFIX}${streamId}`;
}

// ─── KV Helpers (same pattern as unified-tip-core) ─────────────────────

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
    await env.CACHE?.put(key, JSON.stringify(value), { expirationTtl: GIFT_TTL_1Y });
  } catch (err) {
    console.warn('[live-gifts] KV put failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Fee Calculation ───────────────────────────────────────────────────

export const GIFT_PLATFORM_FEE_BPS = 1500; // 15% (1500 bps)

export function calculateGiftFee(grossUsd: number): number {
  return Math.round(((grossUsd * GIFT_PLATFORM_FEE_BPS) / 10000) * 100) / 100;
}

export function calculateCreatorEarnings(grossUsd: number): number {
  return Math.round(((grossUsd * (10000 - GIFT_PLATFORM_FEE_BPS)) / 10000) * 100) / 100;
}

// ─── Streak Logic ───────────────────────────────────────────────────────

export function checkStreakTier(count: number): GiftStreakTier | undefined {
  // Check from highest to lowest so the best tier is returned
  for (let i = GIFT_STREAK_TIERS.length - 1; i >= 0; i--) {
    if (count >= GIFT_STREAK_TIERS[i].count) return GIFT_STREAK_TIERS[i];
  }
  return undefined;
}

// ─── Sanity / Validation ────────────────────────────────────────────────

export function isValidGiftTypeId(value: string): value is GiftTypeId {
  return GIFT_TIERS.includes(value as GiftTypeId);
}

export function lookupGiftType(giftTypeId: string): GiftType | undefined {
  return GIFT_TYPES[giftTypeId as GiftTypeId];
}

export function isSupportedGiftChain(chain: string): boolean {
  return ['lightning', 'solana', 'ethereum', 'base', 'creator_coin'].includes(chain);
}
