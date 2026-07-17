/**
 * @degenfeed/reputation v1
 *
 * Non-transferable reputation token system for DegenFeed.
 *
 * Reputation is earned through quality contributions — not bought.
 * Stake reputation to post. Lose reputation for spam.
 *
 * KV storage layout (used by api-worker):
 *   rep:score:{userId}       → ReputationScore (JSON)
 *   rep:history:{userId}      → ReputationEvent[] (JSON array, newest first)
 *   rep:leaderboard           → LeaderboardEntry[] (sorted by total desc)
 *
 * Tiers:
 *   Newcomer    (0–99):      1 post/day, basic features
 *   Member      (100–499):   5 posts/day, tips enabled
 *   Contributor (500–1999):  unlimited posts, create communities
 *   Builder     (2000–9999): governance voting, curator status
 *   Elder       (10000+):    moderator tools, verified badge
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type ReputationLevel = 'newcomer' | 'member' | 'contributor' | 'builder' | 'elder';

export interface ReputationMultipliers {
  /** Content quality multiplier (0.5–2.0 based on avg engagement) */
  quality: number;
  /** Posting consistency multiplier (0.5–1.5 based on streak) */
  consistency: number;
  /** Community participation multiplier (0.5–1.5 based on follows/tips) */
  community: number;
}

export interface ReputationScore {
  userId: string;
  /** Total reputation points (earned - slashed, excludes currently staked) */
  total: number;
  /** Reputation earned through quality contributions */
  earned: number;
  /** Reputation currently staked on posts (locked, not counted in total) */
  staked: number;
  /** Reputation lost to spam/moderation actions */
  slashed: number;
  /** Current level derived from total */
  level: ReputationLevel;
  /** Active multipliers applied to earn/lose amounts */
  multipliers: ReputationMultipliers;
}

export type ReputationEventKind =
  | 'earn:post'        // +1 per original post (max 5/day)
  | 'earn:like'        // +0.1 per like received (max 10/day)
  | 'earn:tip'         // +1 per tip received
  | 'earn:follow'      // +2 per new follower
  | 'earn:community'   // +50 for creating a popular community
  | 'earn:bridge'      // +5 per cross-protocol bridge usage
  | 'stake:post'       // Reputation staked on a post
  | 'stake:return'     // Stake returned + bonus from high engagement
  | 'slash:spam'       // -10 post marked as spam
  | 'slash:report'     // -5 confirmed report
  | 'slash:ban'        // All staked reputation slashed on ban
  | 'slash:stake'      // Staked rep slashed (post confirmed spam)

export interface ReputationEvent {
  id: string;
  userId: string;
  kind: ReputationEventKind;
  /** Positive for earn, negative for slash/stake */
  delta: number;
  /** Running total after this event */
  balance: number;
  /** Optional reference (post id, community id, etc.) */
  ref?: string;
  /** Unix ms */
  createdAt: number;
  /** Human-readable reason */
  reason: string;
}

export interface StakeToPost {
  postId: string;
  userId: string;
  /** Amount staked */
  amount: number;
  /** Current status */
  status: 'active' | 'returned' | 'slashed';
  /** Unix ms */
  stakedAt: number;
  /** Unix ms when resolved */
  resolvedAt?: number;
  /** Bonus earned if returned (amount * bonusRate) */
  bonus?: number;
}

// ─── Tier thresholds ──────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<ReputationLevel, { min: number; max: number }> = {
  newcomer:    { min: 0,     max: 99    },
  member:      { min: 100,   max: 499   },
  contributor: { min: 500,   max: 1999  },
  builder:     { min: 2000,  max: 9999  },
  elder:       { min: 10000, max: Infinity },
};

export const TIER_LABELS: Record<ReputationLevel, { icon: string; label: string }> = {
  newcomer:    { icon: '🌱', label: 'Newcomer' },
  member:      { icon: '🔷', label: 'Member' },
  contributor: { icon: '⭐', label: 'Contributor' },
  builder:     { icon: '🔶', label: 'Builder' },
  elder:       { icon: '🏆', label: 'Elder' },
};

export const TIER_POST_LIMITS: Record<ReputationLevel, number> = {
  newcomer:    1,
  member:      5,
  contributor: Infinity,
  builder:     Infinity,
  elder:       Infinity,
};

export const TIER_BENEFITS: Record<ReputationLevel, string[]> = {
  newcomer:    ['1 post per day', 'Basic features', 'Read-only feed'],
  member:      ['5 posts per day', 'Tips enabled', 'Bookmark posts'],
  contributor: ['Unlimited posts', 'Create communities', 'Cross-protocol bridge'],
  builder:     ['Governance voting', 'Curator status', 'Priority support'],
  elder:       ['Moderator tools', 'Verified badge', 'Platform rewards'],
};

// ─── Level computation ────────────────────────────────────────────────────

export function computeLevel(total: number): ReputationLevel {
  if (total >= TIER_THRESHOLDS.elder.min) return 'elder';
  if (total >= TIER_THRESHOLDS.builder.min) return 'builder';
  if (total >= TIER_THRESHOLDS.contributor.min) return 'contributor';
  if (total >= TIER_THRESHOLDS.member.min) return 'member';
  return 'newcomer';
}

export function nextLevelThreshold(currentLevel: ReputationLevel, total: number): {
  current: ReputationLevel;
  next: ReputationLevel | null;
  currentMin: number;
  nextMin: number;
  progress: number; // 0–1
} {
  const thresholds: ReputationLevel[] = ['newcomer', 'member', 'contributor', 'builder', 'elder'];
  const idx = thresholds.indexOf(currentLevel);
  const currentMin = TIER_THRESHOLDS[currentLevel].min;
  const nextLevel: ReputationLevel | null =
    idx >= 0 && idx < thresholds.length - 1 ? (thresholds[idx + 1] as ReputationLevel) : null;
  const nextMin = nextLevel ? TIER_THRESHOLDS[nextLevel].min : currentMin;
  const range = nextMin - currentMin;
  const progress = range > 0 ? Math.min(1, Math.max(0, (total - currentMin) / range)) : 1;
  return { current: currentLevel, next: nextLevel, currentMin, nextMin, progress };
}

// ─── Earn / Lose Rules ────────────────────────────────────────────────────

export interface EarnRule {
  kind: ReputationEventKind;
  baseAmount: number;
  /** Max per day (0 = unlimited) */
  dailyCap: number;
  description: string;
}

export const EARN_RULES: EarnRule[] = [
  { kind: 'earn:post',      baseAmount: 1,   dailyCap: 5,   description: 'Posting original content' },
  { kind: 'earn:like',      baseAmount: 0.1, dailyCap: 10,  description: 'Receiving likes on posts' },
  { kind: 'earn:tip',       baseAmount: 1,   dailyCap: 0,   description: 'Receiving tips' },
  { kind: 'earn:follow',    baseAmount: 2,   dailyCap: 0,   description: 'Gaining new followers' },
  { kind: 'earn:community', baseAmount: 50,  dailyCap: 0,   description: 'Creating a popular community' },
  { kind: 'earn:bridge',    baseAmount: 5,   dailyCap: 0,   description: 'Cross-protocol bridge usage' },
];

export const LOSE_RULES: Record<string, { baseAmount: number; description: string }> = {
  'slash:spam':  { baseAmount: -10, description: 'Post marked as spam' },
  'slash:report': { baseAmount: -5,  description: 'Confirmed report' },
};

// ─── Default multipliers ──────────────────────────────────────────────────

export function defaultMultipliers(): ReputationMultipliers {
  return { quality: 1.0, consistency: 1.0, community: 1.0 };
}

// ─── Compute final delta with multipliers ─────────────────────────────────

export function applyEarnMultipliers(
  baseAmount: number,
  kind: ReputationEventKind,
  multipliers: ReputationMultipliers,
): number {
  let amount = baseAmount;
  // Quality multiplier applies to content earnings
  if (kind === 'earn:post' || kind === 'earn:like') {
    amount *= multipliers.quality;
  }
  // Community multiplier applies to social earnings
  if (kind === 'earn:follow' || kind === 'earn:tip') {
    amount *= multipliers.community;
  }
  // Consistency multiplier boosts all earnings (small effect)
  amount *= 1 + (multipliers.consistency - 1) * 0.5;
  return Math.round(amount * 100) / 100;
}

// ─── Stake-to-Post ────────────────────────────────────────────────────────

export const STAKE_CONFIG = {
  /** Minimum stake amount for a post */
  minStake: 1,
  /** Maximum stake amount for a post */
  maxStake: 100,
  /** Bonus rate when stake is returned (10% bonus) */
  bonusRate: 0.1,
  /** Engagement threshold for bonus: post needs this many likes+reposts+replies */
  bonusEngagementThreshold: 10,
  /** Stake is locked for this many ms min before return */
  minLockDurationMs: 60_000,
};

export interface StakeResult {
  ok: boolean;
  error?: string;
  stake?: StakeToPost;
}

/**
 * Stake reputation on a post.
 * Returns the stake record or an error if the user doesn't have enough
 * available reputation.
 */
export function stakeOnPost(
  score: ReputationScore,
  postId: string,
  amount: number,
): StakeResult {
  const clamped = Math.max(STAKE_CONFIG.minStake, Math.min(STAKE_CONFIG.maxStake, amount));
  if (clamped !== amount) {
    return { ok: false, error: `Stake must be between ${STAKE_CONFIG.minStake} and ${STAKE_CONFIG.maxStake}` };
  }
  // Available reputation = total (earned - slashed) — staked is already locked
  const available = score.total - score.staked;
  if (available < clamped) {
    return { ok: false, error: `Insufficient reputation. Need ${clamped}, have ${available} available.` };
  }
  const stake: StakeToPost = {
    postId,
    userId: score.userId,
    amount: clamped,
    status: 'active',
    stakedAt: Date.now(),
  };
  return { ok: true, stake };
}

/**
 * Resolve a stake after a post has been evaluated.
 * High engagement → stake returned + bonus
 * Spam confirmed → stake slashed
 * Otherwise → stake returned without bonus
 */
export function resolveStake(
  stake: StakeToPost,
  outcome: 'return' | 'return-bonus' | 'slash',
  engagementCount?: number,
): { stake: StakeToPost; delta: number } {
  const now = Date.now();
  const elapsed = now - stake.stakedAt;
  const locked = elapsed < STAKE_CONFIG.minLockDurationMs;

  switch (outcome) {
    case 'return-bonus': {
      if (locked) {
        // Still locked, return without bonus
        return resolveStake(stake, 'return');
      }
      const bonus = Math.round(stake.amount * STAKE_CONFIG.bonusRate * 100) / 100;
      return {
        stake: {
          ...stake,
          status: 'returned',
          resolvedAt: now,
          bonus,
        },
        delta: bonus, // positive — user earned bonus
      };
    }
    case 'return': {
      return {
        stake: {
          ...stake,
          status: 'returned',
          resolvedAt: now,
        },
        delta: 0, // net zero — stake returned, no bonus
      };
    }
    case 'slash': {
      return {
        stake: {
          ...stake,
          status: 'slashed',
          resolvedAt: now,
        },
        delta: -stake.amount, // negative — stake is lost
      };
    }
  }
}

/**
 * Compute daily totals for a list of events (used for daily cap enforcement).
 */
export function computeDailyTotals(events: ReputationEvent[]): Map<string, number> {
  const totals = new Map<string, number>();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86_400_000;

  for (const event of events) {
    if (event.createdAt >= todayStart && event.createdAt < todayEnd) {
      const key = event.kind;
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(event.delta));
    }
  }
  return totals;
}

/**
 * Check whether a given earn event would exceed the daily cap.
 */
export function wouldExceedDailyCap(
  kind: ReputationEventKind,
  amount: number,
  dailyTotals: Map<string, number>,
): boolean {
  const rule = EARN_RULES.find((r) => r.kind === kind);
  if (!rule || rule.dailyCap === 0) return false; // no cap
  const currentDaily = dailyTotals.get(kind) ?? 0;
  return currentDaily + amount > rule.dailyCap;
}

/**
 * Build a default ReputationScore for a new user.
 */
export function createDefaultScore(userId: string): ReputationScore {
  return {
    userId,
    total: 0,
    earned: 0,
    staked: 0,
    slashed: 0,
    level: 'newcomer',
    multipliers: defaultMultipliers(),
  };
}

/**
 * Apply a reputation event to a score, returning the updated score and event.
 */
export function applyEvent(
  score: ReputationScore,
  kind: ReputationEventKind,
  delta: number,
  ref?: string,
  reason?: string,
): { score: ReputationScore; event: ReputationEvent } {
  const updated = { ...score };

  if (delta > 0) {
    updated.earned += delta;
  } else {
    updated.slashed += Math.abs(delta);
  }

  // Adjust staked balance for stake/slash operations
  if (kind === 'stake:post') {
    updated.staked += Math.abs(delta);
  } else if (kind === 'stake:return' || kind === 'stake:return' as string) {
    // Stake returned — reduce staked amount
    updated.staked -= Math.abs(delta);
  } else if (kind === 'slash:stake' || kind === 'slash:ban') {
    // Staked rep lost — reduce staked amount, increase slashed
    const lost = Math.abs(delta);
    updated.staked = Math.max(0, updated.staked - lost);
    updated.slashed += lost;
  }

  // Update total: earned - slashed (excluding currently staked)
  updated.total = Math.max(0, updated.earned - updated.slashed);

  // Recompute level
  updated.level = computeLevel(updated.total);

  const event: ReputationEvent = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    userId: score.userId,
    kind,
    delta,
    balance: updated.total,
    ref,
    createdAt: Date.now(),
    reason: reason ?? '',
  };

  return { score: updated, event };
}
