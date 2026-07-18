/**
 * @degenfeed/reputation — Reputation types, constants, and pure utility functions
 *
 * Non-transferable reputation token system.
 * Storage layer lives in the API worker route; this package provides
 * the types, tier config, and pure computation functions.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface ReputationScore {
  userId: string;
  total: number;
  earned: number;
  staked: number;
  slashed: number;
  level: string;
  multipliers: Record<string, number>;
}

export interface ReputationEvent {
  id: string;
  kind: ReputationEventKind;
  amount: number;
  total: number;
  ref?: string;
  reason?: string;
  timestamp: number;
}

export type ReputationEventKind =
  | 'earn:post'
  | 'earn:like'
  | 'earn:tip'
  | 'earn:follow'
  | 'earn:bridge'
  | 'slash:spam'
  | 'slash:report'
  | 'slash:ban'
  | 'slash:stake'
  | 'stake:post'
  | 'stake:return';

export interface StakeToPost {
  postId: string;
  amount: number;
  status: 'active' | 'returned' | 'slashed';
  bonus?: number;
  createdAt: number;
  resolvedAt?: number;
}

export interface EarnRule {
  kind: ReputationEventKind;
  baseAmount: number;
  description: string;
  dailyCap: number;
  cooldownMs?: number;
}

export interface TierInfo {
  icon: string;
  label: string;
  minRep: number;
}

export interface TierBenefits {
  enhancedDiscovery: boolean;
  customFeed: boolean;
  badgeDisplay: boolean;
  prioritySupport: boolean;
  analyticsAccess: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const EARN_RULES: EarnRule[] = [
  { kind: 'earn:post', baseAmount: 10, description: 'Created a post', dailyCap: 50 },
  { kind: 'earn:like', baseAmount: 2, description: 'Received a like', dailyCap: 20 },
  { kind: 'earn:tip', baseAmount: 5, description: 'Received a tip', dailyCap: 30 },
  { kind: 'earn:follow', baseAmount: 3, description: 'Gained a follower', dailyCap: 15 },
  { kind: 'earn:bridge', baseAmount: 15, description: 'Cross-protocol bridge used', dailyCap: 30 },
];

export const LOSE_RULES: Record<string, { baseAmount: number; description: string }> = {
  'slash:spam': { baseAmount: -25, description: 'Content flagged as spam' },
  'slash:report': { baseAmount: -10, description: 'Content reported' },
  'slash:ban': { baseAmount: 0, description: 'User banned' },
};

export const TIER_THRESHOLDS: Record<string, number> = {
  newcomer: 0,
  contributor: 50,
  active: 200,
  trusted: 500,
  veteran: 1000,
  elite: 2500,
  legend: 5000,
};

export const TIER_LABELS: Record<string, TierInfo> = {
  newcomer: { icon: '🌱', label: 'Newcomer', minRep: 0 },
  contributor: { icon: '⭐', label: 'Contributor', minRep: 50 },
  active: { icon: '🔷', label: 'Active', minRep: 200 },
  trusted: { icon: '🛡️', label: 'Trusted', minRep: 500 },
  veteran: { icon: '🏆', label: 'Veteran', minRep: 1000 },
  elite: { icon: '💎', label: 'Elite', minRep: 2500 },
  legend: { icon: '👑', label: 'Legend', minRep: 5000 },
};

export const TIER_POST_LIMITS: Record<string, number> = {
  newcomer: 5,
  contributor: 10,
  active: 25,
  trusted: 50,
  veteran: 100,
  elite: 200,
  legend: 500,
};

export const TIER_BENEFITS: Record<string, TierBenefits> = {
  newcomer: {
    enhancedDiscovery: false,
    customFeed: false,
    badgeDisplay: false,
    prioritySupport: false,
    analyticsAccess: false,
  },
  contributor: {
    enhancedDiscovery: true,
    customFeed: false,
    badgeDisplay: true,
    prioritySupport: false,
    analyticsAccess: false,
  },
  active: {
    enhancedDiscovery: true,
    customFeed: true,
    badgeDisplay: true,
    prioritySupport: false,
    analyticsAccess: false,
  },
  trusted: {
    enhancedDiscovery: true,
    customFeed: true,
    badgeDisplay: true,
    prioritySupport: true,
    analyticsAccess: false,
  },
  veteran: {
    enhancedDiscovery: true,
    customFeed: true,
    badgeDisplay: true,
    prioritySupport: true,
    analyticsAccess: true,
  },
  elite: {
    enhancedDiscovery: true,
    customFeed: true,
    badgeDisplay: true,
    prioritySupport: true,
    analyticsAccess: true,
  },
  legend: {
    enhancedDiscovery: true,
    customFeed: true,
    badgeDisplay: true,
    prioritySupport: true,
    analyticsAccess: true,
  },
};

export const defaultMultipliers: Record<string, number> = {
  base: 1.0,
  contentQuality: 1.0,
  engagementRate: 1.0,
  crossProtocolBonus: 1.2,
};

// ─── Pure Functions ──────────────────────────────────────────────────────

export function computeLevel(total: number): string {
  const tiers = Object.entries(TIER_THRESHOLDS).sort((a, b) => b[1] - a[1]);
  for (const [level, threshold] of tiers) {
    if (total >= threshold) return level;
  }
  return 'newcomer';
}

export function createDefaultScore(userId: string): ReputationScore {
  return {
    userId,
    total: 0,
    earned: 0,
    staked: 0,
    slashed: 0,
    level: 'newcomer',
    multipliers: { ...defaultMultipliers },
  };
}

export function nextLevelThreshold(
  currentLevel: string,
  total: number,
): { current: string; next: string; currentMin: number; nextMin: number; progress: number } {
  const tiers = Object.entries(TIER_THRESHOLDS).sort((a, b) => b[1] - a[1]);
  const currentIdx = tiers.findIndex(([name]) => name === currentLevel);
  const _prevLevel = tiers[Math.max(0, currentIdx + 1)];
  const nextLevel = tiers[Math.max(0, currentIdx - 1)];
  const currentMin = TIER_THRESHOLDS[currentLevel] ?? 0;
  const nextMin = nextLevel ? nextLevel[1] : currentMin;
  const range = nextMin - currentMin;
  const progress =
    range > 0 ? Math.min(100, Math.max(0, ((total - currentMin) / range) * 100)) : 100;
  return {
    current: currentLevel,
    next: nextLevel?.[0] ?? currentLevel,
    currentMin,
    nextMin,
    progress: Math.round(progress * 10) / 10,
  };
}

export function applyEarnMultipliers(
  baseAmount: number,
  _kind: ReputationEventKind,
  multipliers: Record<string, number>,
): number {
  const mult = Object.values(multipliers).reduce((a, b) => a * b, 1);
  return Math.round(baseAmount * mult);
}

export function applyEvent(
  score: ReputationScore,
  kind: ReputationEventKind,
  amount: number,
  ref?: string,
  reason?: string,
): { score: ReputationScore; event: ReputationEvent } {
  const updated: ReputationScore = {
    ...score,
    total: Math.max(0, score.total + amount),
  };

  if (amount > 0) {
    updated.earned = score.earned + amount;
  } else {
    updated.slashed = score.slashed + Math.abs(amount);
  }

  updated.level = computeLevel(updated.total);

  const event: ReputationEvent = {
    id: `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    kind,
    amount,
    total: updated.total,
    ref,
    reason,
    timestamp: Date.now(),
  };

  return { score: updated, event };
}

export function computeDailyTotals(history: ReputationEvent[]): Map<string, number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const dailyTotals = new Map<string, number>();
  for (const event of history) {
    if (event.timestamp < todayMs) continue;
    const current = dailyTotals.get(event.kind) ?? 0;
    if (event.amount > 0) {
      dailyTotals.set(event.kind, current + event.amount);
    }
  }
  return dailyTotals;
}

export function wouldExceedDailyCap(
  kind: ReputationEventKind,
  amount: number,
  dailyTotals: Map<string, number>,
): boolean {
  const rule = EARN_RULES.find((r) => r.kind === kind);
  if (!rule || rule.dailyCap <= 0) return false;
  const currentTotal = dailyTotals.get(kind) ?? 0;
  return currentTotal + amount > rule.dailyCap;
}

export function stakeOnPost(
  score: ReputationScore,
  postId: string,
  amount: number,
): { ok: true; stake: StakeToPost } | { ok: false; error: string } {
  if (amount <= 0) return { ok: false, error: 'Stake amount must be positive' };
  if (amount > score.earned) {
    return { ok: false, error: `Insufficient reputation. Have ${score.earned}, need ${amount}` };
  }
  return {
    ok: true,
    stake: {
      postId,
      amount,
      status: 'active',
      createdAt: Date.now(),
    },
  };
}

export function resolveStake(
  stake: StakeToPost,
  outcome: 'return' | 'return-bonus' | 'slash',
  engagementCount?: number,
): { stake: StakeToPost; delta: number } {
  const resolved: StakeToPost = {
    ...stake,
    status: outcome === 'slash' ? 'slashed' : 'returned',
    resolvedAt: Date.now(),
  };

  let delta = 0;
  if (outcome === 'return') {
    delta = stake.amount; // return stake
  } else if (outcome === 'return-bonus') {
    const bonus = engagementCount
      ? Math.min(stake.amount, Math.floor(engagementCount * 2))
      : Math.floor(stake.amount * 0.1);
    resolved.bonus = bonus;
    delta = stake.amount + bonus; // return stake + bonus
  }
  // outcome === 'slash': no delta (already subtracted)

  return { stake: resolved, delta };
}
