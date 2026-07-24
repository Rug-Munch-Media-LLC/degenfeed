/**
 * DegenFeed Creator Coin — Customizable Vesting Types & Presets
 *
 * Creators choose their vesting parameters within reputation-based constraints.
 * All parameters are on-chain and immutable after deployment.
 *
 * ## Preset Quick Reference
 * | Preset      | Initial | Cliff | Vesting | Min Rep |
 * |-------------|---------|-------|---------|---------|
 * | trustless   | 0%      | 30d   | 90d     | any     |
 * | balanced    | 5%      | 7d    | 60d     | 50+     |
 * | community   | 10%     | 0     | 30d     | 50+     |
 * | fast        | 20%     | 0     | 7d      | 90+     |
 */

// ─── Core Types ───────────────────────────────────────────────────────────────

export interface VestingConfig {
  /** Basis points unlocked immediately at launch (0-3000 = 0-30%) */
  initialUnlockBps: number;
  /** Cliff duration in seconds before linear vesting begins (0 = no cliff) */
  cliffDuration: number;
  /** Total vesting duration in seconds after cliff (min 604800 = 7 days, max 63072000 = 2 years) */
  vestingDuration: number;
}

export interface VestingPreset {
  id: string;
  label: string;
  description: string;
  config: VestingConfig;
  minReputation: number;
}

export const VESTING_PRESETS: Record<string, VestingPreset> = {
  trustless: {
    id: 'trustless',
    label: 'Trustless',
    description: '0% initial, 30-day cliff, 90-day vest — most anti-rug',
    config: { initialUnlockBps: 0, cliffDuration: 2_592_000, vestingDuration: 7_776_000 },
    minReputation: 0,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: '5% initial, 7-day cliff, 60-day vest',
    config: { initialUnlockBps: 500, cliffDuration: 604_800, vestingDuration: 5_184_000 },
    minReputation: 50,
  },
  community: {
    id: 'community',
    label: 'Community',
    description: '10% initial, no cliff, 30-day vest — for trusted creators',
    config: { initialUnlockBps: 1_000, cliffDuration: 0, vestingDuration: 2_592_000 },
    minReputation: 50,
  },
  fast: {
    id: 'fast',
    label: 'Fast',
    description: '20% initial, no cliff, 7-day vest — reputation-gated (90+ rep)',
    config: { initialUnlockBps: 2_000, cliffDuration: 0, vestingDuration: 604_800 },
    minReputation: 90,
  },
} as const;

// ─── Reputation-Gated Preset Selection ────────────────────────────────────────

/**
 * Returns the vesting presets available to a creator based on their reputation.
 *
 * Reputation scores 0-100, higher = more trusted.
 * - Score 0-49:   Only trustless (most conservative)
 * - Score 50-89:  Trustless + balanced + community
 * - Score 90+:    All presets including fast
 */
export function getAvailableVestingPresets(reputationScore: number): VestingPreset[] {
  const allPresets = Object.values(VESTING_PRESETS);
  return allPresets.filter((p) => reputationScore >= p.minReputation);
}

// ─── Validation ────────────────────────────────────────────────────────────────

export const VESTING_CONSTRAINTS = {
  /** Initial unlock: 0-30% of total allocation */
  INITIAL_UNLOCK_BPS_MIN: 0,
  INITIAL_UNLOCK_BPS_MAX: 3_000,
  /** Cliff: 0-90 days (7,776,000 seconds) */
  CLIFF_DURATION_MIN: 0,
  CLIFF_DURATION_MAX: 7_776_000,
  /** Vesting: 7 days (604,800s) to 2 years (63,072,000s) */
  VESTING_DURATION_MIN: 604_800,
  VESTING_DURATION_MAX: 63_072_000,
} as const;

export function validateVestingConfig(config: VestingConfig, reputationScore: number): string[] {
  const errors: string[] = [];

  if (
    config.initialUnlockBps < VESTING_CONSTRAINTS.INITIAL_UNLOCK_BPS_MIN ||
    config.initialUnlockBps > VESTING_CONSTRAINTS.INITIAL_UNLOCK_BPS_MAX
  ) {
    errors.push(
      `Initial unlock must be 0-${VESTING_CONSTRAINTS.INITIAL_UNLOCK_BPS_MAX} bps (0-30%)`,
    );
  }

  if (
    config.cliffDuration < VESTING_CONSTRAINTS.CLIFF_DURATION_MIN ||
    config.cliffDuration > VESTING_CONSTRAINTS.CLIFF_DURATION_MAX
  ) {
    errors.push(
      `Cliff duration must be 0-${VESTING_CONSTRAINTS.CLIFF_DURATION_MAX} seconds (0-90 days)`,
    );
  }

  if (
    config.vestingDuration < VESTING_CONSTRAINTS.VESTING_DURATION_MIN ||
    config.vestingDuration > VESTING_CONSTRAINTS.VESTING_DURATION_MAX
  ) {
    errors.push(
      `Vesting duration must be ${VESTING_CONSTRAINTS.VESTING_DURATION_MIN}-${VESTING_CONSTRAINTS.VESTING_DURATION_MAX} seconds (7 days-2 years)`,
    );
  }

  // Reputation gate
  const available = getAvailableVestingPresets(reputationScore);
  const isExactPreset = Object.values(VESTING_PRESETS).some(
    (p) =>
      p.config.initialUnlockBps === config.initialUnlockBps &&
      p.config.cliffDuration === config.cliffDuration &&
      p.config.vestingDuration === config.vestingDuration &&
      reputationScore >= p.minReputation,
  );

  // Allow custom configs that don't exceed the most liberal preset available
  const mostLiberal = available[available.length - 1];
  if (mostLiberal) {
    if (config.initialUnlockBps > mostLiberal.config.initialUnlockBps) {
      errors.push(
        `Initial unlock cannot exceed ${mostLiberal.config.initialUnlockBps} bps for your reputation`,
      );
    }
    if (config.vestingDuration < mostLiberal.config.vestingDuration && !isExactPreset) {
      errors.push(
        `Vesting duration cannot be shorter than ${mostLiberal.config.vestingDuration}s for your reputation`,
      );
    }
  }

  return errors;
}

// ─── Vesting Math (Frontend Preview) ──────────────────────────────────────────

export interface VestingSchedulePoint {
  day: number;
  timestamp: number;
  vestedPercent: number;
  cumulativeUnlocked: number;
  isInitialUnlock: boolean;
  isCliffEnd: boolean;
  isFullVest: boolean;
}

/**
 * Generate a vesting timeline for the frontend visualization.
 * Returns an array of key milestones with vested percentages.
 */
export function generateVestingSchedule(
  config: VestingConfig,
  createdAt: number,
  totalAllocation: bigint,
): VestingSchedulePoint[] {
  const points: VestingSchedulePoint[] = [];
  const daySeconds = 86_400;
  const totalDays =
    Math.ceil(config.vestingDuration / daySeconds) +
    Math.ceil(config.cliffDuration / daySeconds) +
    1;
  const maxDays = Math.min(totalDays, 730); // cap at 2 years

  for (let day = 0; day <= maxDays; day++) {
    const timestamp = createdAt + day * daySeconds;
    const elapsed = day * daySeconds;

    // Initial unlock happens at launch
    if (day === 0 && config.initialUnlockBps > 0) {
      points.push({
        day: 0,
        timestamp: createdAt,
        vestedPercent: config.initialUnlockBps / 100,
        cumulativeUnlocked: Number((totalAllocation * BigInt(config.initialUnlockBps)) / 10_000n),
        isInitialUnlock: true,
        isCliffEnd: false,
        isFullVest: false,
      });
    }

    // Cliff end
    if (
      config.cliffDuration > 0 &&
      elapsed >= config.cliffDuration &&
      points.findIndex((p) => p.isCliffEnd && p.day === day / 1) === -1
    ) {
      const cliffDay = Math.floor(config.cliffDuration / daySeconds);
      const initialPct = config.initialUnlockBps / 100;
      points.push({
        day: cliffDay,
        timestamp: createdAt + config.cliffDuration,
        vestedPercent: initialPct,
        cumulativeUnlocked: Number((totalAllocation * BigInt(config.initialUnlockBps)) / 10_000n),
        isInitialUnlock: false,
        isCliffEnd: true,
        isFullVest: false,
      });
    }

    // During vesting (after cliff)
    if (elapsed >= config.cliffDuration) {
      const elapsedSinceCliff = elapsed - config.cliffDuration;
      const vestProgress = Math.min(elapsedSinceCliff / config.vestingDuration, 1);
      const pct =
        config.initialUnlockBps / 100 + (100 - config.initialUnlockBps / 100) * vestProgress;
      const unlocked = Number((totalAllocation * BigInt(Math.floor(pct * 100))) / 10_000n);

      // Only add milestone points (every 10% or key transitions)
      const prevPoint = points[points.length - 1];
      const isFullVest = vestProgress >= 1;
      const pctBucket = Math.floor(pct / 10) * 10;

      if (
        isFullVest ||
        day === 0 ||
        (prevPoint && Math.floor(prevPoint.vestedPercent / 10) < pctBucket) ||
        day % 7 === 0 // weekly checkpoint
      ) {
        points.push({
          day: Math.floor(elapsed / daySeconds),
          timestamp,
          vestedPercent: pct,
          cumulativeUnlocked: unlocked,
          isInitialUnlock: false,
          isCliffEnd: false,
          isFullVest,
        });
      }
    }
  }

  return points;
}
