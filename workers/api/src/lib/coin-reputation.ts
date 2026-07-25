/**
 * @degenfeed/api-worker — Coin Holder Reputation System
 *
 * Computes reputation scores and tier badges for token holders based on:
 *   - Holding duration and loyalty
 *   - Buy/sell behavior (diamond hands, buy-the-dip)
 *   - Community participation (voting, tipping, referrals)
 *   - Creator interaction
 *
 * Scores are 0-1000 with tiers unlocked at thresholds.
 */

import type { Env } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────────

export type HolderTier = 'supporter' | 'believer' | 'diamond_hands' | 'og' | 'whale';

export interface HolderReputation {
  address: string;
  coinSymbol: string;
  score: number;
  tier: HolderTier;
  tierLabel: string;
  tierIcon: string;
  breakdown: {
    holdingDuration: number; // +10/day, max 300
    buyLoyalty: number; // +100 if never sold
    buyTheDip: number; // +50 if bought after ≥15% price drop
    communityParticipation: number; // +25 per action (vote, tip)
    referralScore: number; // +50 per referred holder
    creatorInteraction: number; // +75 per creator tip
  };
  badges: string[];
  firstBuyAt: number | null;
  lastActivityAt: number | null;
  totalHoldingDays: number;
  neverSold: boolean;
  isWhale: boolean;
  boughtInPhaseOne: boolean;
  updatedAt: number;
}

export interface ReputationEvent {
  type: 'buy' | 'sell' | 'vote' | 'tip_community' | 'tip_creator' | 'referral' | 'claim_vested';
  address: string;
  coinSymbol: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const KV_PREFIX = 'reputation:coin:';
const CACHE_TTL = 300; // 5 min

const TIER_THRESHOLDS: Record<HolderTier, { minScore: number; label: string; icon: string }> = {
  supporter: { minScore: 0, label: 'Supporter', icon: '🥉' },
  believer: { minScore: 100, label: 'Believer', icon: '🥈' },
  diamond_hands: { minScore: 250, label: 'Diamond Hands', icon: '🥇' },
  og: { minScore: 400, label: 'OG', icon: '💎' },
  whale: { minScore: 600, label: 'Whale', icon: '👑' },
};

const TIER_ORDER: HolderTier[] = ['supporter', 'believer', 'diamond_hands', 'og', 'whale'];

// ─── KV Helpers ────────────────────────────────────────────────────────────

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function kvPut(env: Env, key: string, value: unknown, ttl?: number): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : {});
  } catch {
    // Non-critical
  }
}

// ─── Score Computation ─────────────────────────────────────────────────────

export function computeReputation(params: {
  holdingDays: number;
  neverSold: boolean;
  boughtAfterDip: boolean;
  communityActions: number;
  referralCount: number;
  creatorTips: number;
  isTop10Holder: boolean;
  boughtInPhaseOne: boolean;
  balance: bigint;
  totalSupply: bigint;
}): { score: number; tier: HolderTier; breakdown: HolderReputation['breakdown'] } {
  const holdingDuration = Math.min(params.holdingDays * 10, 300);
  const buyLoyalty = params.neverSold ? 100 : 0;
  const buyTheDip = params.boughtAfterDip ? 50 : 0;
  const communityParticipation = Math.min(params.communityActions * 25, 200);
  const referralScore = Math.min(params.referralCount * 50, 250);
  const creatorInteraction = Math.min(params.creatorTips * 75, 300);

  let score =
    holdingDuration +
    buyLoyalty +
    buyTheDip +
    communityParticipation +
    referralScore +
    creatorInteraction;

  // Bonus for OG status
  if (params.boughtInPhaseOne && params.neverSold) {
    score += 100;
  }

  // Whale bonus
  if (params.isTop10Holder) {
    score += 50;
  }

  score = Math.min(Math.max(score, 0), 1000);

  const breakdown: HolderReputation['breakdown'] = {
    holdingDuration,
    buyLoyalty,
    buyTheDip,
    communityParticipation,
    referralScore,
    creatorInteraction,
  };

  // Determine tier
  let tier: HolderTier = 'supporter';
  for (const t of TIER_ORDER) {
    if (score >= TIER_THRESHOLDS[t].minScore) {
      tier = t;
    }
  }

  return { score, tier, breakdown };
}

export function getTierInfo(tier: HolderTier): { label: string; icon: string } {
  return TIER_THRESHOLDS[tier] ?? TIER_THRESHOLDS.supporter;
}

// ─── Main Reputation Fetch ─────────────────────────────────────────────────

export async function getHolderReputation(
  env: Env,
  address: string,
  coinSymbol: string,
): Promise<HolderReputation | null> {
  const key = `${KV_PREFIX}${coinSymbol.toLowerCase()}:${address.toLowerCase()}`;
  const cached = await kvGet<HolderReputation>(env, key);
  if (cached && cached.updatedAt > Date.now() - CACHE_TTL * 1000) {
    return cached;
  }
  return null; // Let caller recompute if stale
}

export async function setHolderReputation(env: Env, reputation: HolderReputation): Promise<void> {
  const key = `${KV_PREFIX}${reputation.coinSymbol.toLowerCase()}:${reputation.address.toLowerCase()}`;
  await kvPut(env, key, reputation, CACHE_TTL);
}

// ─── Compute From Raw Data ────────────────────────────────────────────────

export async function computeHolderReputation(
  _env: Env,
  address: string,
  coinSymbol: string,
  data: {
    firstBuyTimestamp: number;
    lastSellTimestamp: number | null;
    totalBuys: number;
    totalSells: number;
    currentBalance: bigint;
    totalSupply: bigint;
    communityActions: number;
    referralCount: number;
    creatorTips: number;
    boughtInPhaseOne: boolean;
    priceDropBuys: number;
    isTop10Holder: boolean;
  },
): Promise<HolderReputation> {
  const now = Date.now();
  const holdingDays =
    data.firstBuyTimestamp > 0
      ? Math.max(0, Math.floor((now - data.firstBuyTimestamp) / 86400000))
      : 0;

  const { score, tier, breakdown } = computeReputation({
    holdingDays,
    neverSold: data.lastSellTimestamp === null && data.totalSells === 0,
    boughtAfterDip: data.priceDropBuys > 0,
    communityActions: data.communityActions,
    referralCount: data.referralCount,
    creatorTips: data.creatorTips,
    isTop10Holder: data.isTop10Holder,
    boughtInPhaseOne: data.boughtInPhaseOne,
    balance: data.currentBalance,
    totalSupply: data.totalSupply,
  });

  const badges: string[] = [];
  if (holdingDays >= 30 && data.totalSells === 0) badges.push('Diamond Hands');
  if (data.boughtInPhaseOne) badges.push('Early Believer');
  if (data.isTop10Holder) badges.push('Top 10 Holder');
  if (data.creatorTips >= 1) badges.push('Creator Supporter');
  if (data.referralCount >= 1) badges.push('Community Builder');
  if (data.priceDropBuys >= 1) badges.push('Dip Buyer');
  if (data.totalBuys >= 10) badges.push('Regular Buyer');

  return {
    address,
    coinSymbol,
    score,
    tier,
    tierLabel: TIER_THRESHOLDS[tier].label,
    tierIcon: TIER_THRESHOLDS[tier].icon,
    breakdown,
    badges,
    firstBuyAt: data.firstBuyTimestamp || null,
    lastActivityAt: now,
    totalHoldingDays: holdingDays,
    neverSold: data.lastSellTimestamp === null && data.totalSells === 0,
    isWhale: data.isTop10Holder,
    boughtInPhaseOne: data.boughtInPhaseOne,
    updatedAt: now,
  };
}

// ─── Process Reputation Event ─────────────────────────────────────────────

const DEFAULT_BREAKDOWN: HolderReputation['breakdown'] = {
  holdingDuration: 0,
  buyLoyalty: 0,
  buyTheDip: 0,
  communityParticipation: 0,
  referralScore: 0,
  creatorInteraction: 0,
};

function ensureBreakdown(raw: unknown): HolderReputation['breakdown'] {
  if (raw && typeof raw === 'object') {
    const b = raw as Record<string, unknown>;
    return {
      holdingDuration: typeof b.holdingDuration === 'number' ? b.holdingDuration : 0,
      buyLoyalty: typeof b.buyLoyalty === 'number' ? b.buyLoyalty : 0,
      buyTheDip: typeof b.buyTheDip === 'number' ? b.buyTheDip : 0,
      communityParticipation:
        typeof b.communityParticipation === 'number' ? b.communityParticipation : 0,
      referralScore: typeof b.referralScore === 'number' ? b.referralScore : 0,
      creatorInteraction: typeof b.creatorInteraction === 'number' ? b.creatorInteraction : 0,
    };
  }
  return { ...DEFAULT_BREAKDOWN };
}

export async function processReputationEvent(
  env: Env,
  event: ReputationEvent,
): Promise<HolderReputation | null> {
  const storageKey = `${KV_PREFIX}${event.coinSymbol.toLowerCase()}:${event.address.toLowerCase()}`;
  const current = await kvGet<Partial<HolderReputation>>(env, storageKey);

  const state: Partial<HolderReputation> & {
    breakdown: HolderReputation['breakdown'];
    badges: string[];
    firstBuyAt: number | null;
    lastActivityAt: number | null;
    neverSold: boolean;
  } = current ?? {
    address: event.address,
    coinSymbol: event.coinSymbol,
    breakdown: { ...DEFAULT_BREAKDOWN },
    badges: [],
    firstBuyAt: null,
    lastActivityAt: null,
    totalHoldingDays: 0,
    neverSold: true,
    isWhale: false,
    boughtInPhaseOne: false,
  };

  // Safely ensure breakdown object
  if (!state.breakdown || typeof state.breakdown !== 'object') {
    state.breakdown = { ...DEFAULT_BREAKDOWN };
  }
  state.breakdown = ensureBreakdown(state.breakdown);

  // Update state based on event type
  switch (event.type) {
    case 'buy': {
      if (!state.firstBuyAt || state.firstBuyAt === 0) {
        state.firstBuyAt = event.timestamp;
      }
      break;
    }
    case 'sell': {
      state.neverSold = false;
      break;
    }
    case 'tip_community':
    case 'vote': {
      state.breakdown.communityParticipation = Math.min(
        (state.breakdown.communityParticipation ?? 0) + 25,
        200, // cap at max
      );
      break;
    }
    case 'tip_creator': {
      state.breakdown.creatorInteraction = Math.min(
        (state.breakdown.creatorInteraction ?? 0) + 75,
        300, // cap at max
      );
      break;
    }
    case 'referral': {
      state.breakdown.referralScore = Math.min(
        (state.breakdown.referralScore ?? 0) + 50,
        250, // cap at max
      );
      break;
    }
  }

  state.lastActivityAt = event.timestamp;

  // Store updated state
  await kvPut(env, storageKey, state, CACHE_TTL);

  return null; // Full recompute via computeHolderReputation for final score
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

export async function getCoinReputationLeaderboard(
  env: Env,
  coinSymbol: string,
  limit = 20,
): Promise<HolderReputation[]> {
  try {
    // List all reputation keys for this coin
    const prefix = `${KV_PREFIX}${coinSymbol.toLowerCase()}:`;
    const list = await env.CACHE?.list({ prefix, limit: 1000 });
    if (!list || list.keys.length === 0) return [];

    const reps: HolderReputation[] = [];
    for (const key of list.keys) {
      const raw = await env.CACHE?.get(key.name);
      if (raw) {
        try {
          reps.push(JSON.parse(raw) as HolderReputation);
        } catch {
          // skip corrupt entries
        }
      }
    }

    return reps.sort((a, b) => b.score - a.score).slice(0, limit);
  } catch {
    return [];
  }
}
