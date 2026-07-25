/**
 * Creator Coin 2.0 — Creator Controls (Full Build)
 *
 * Empowers creators with COMPLETE control over their coin parameters:
 *
 * ## Requirement 1 — Fee Structure
 * - Platform fee: 0.5% (50 bps) fixed → DegenFeed
 * - Creator fee: 0% to 4.5% (0-450 bps) → creator wallet or DAO treasury
 * - Total buy/sell fee: 0.5% to 5% (50-500 bps)
 * - Fee recipient: creator wallet | DAO treasury | split
 * - DAO-changeable via vote (configurable threshold)
 * - All fees visible on-chain
 *
 * ## Requirement 2 — Vesting Schedule
 * - Linear vesting (tokens unlock evenly over time)
 * - Cliff vesting (tokens unlock after set period)
 * - Custom schedule (specific dates and amounts)
 * - Vesting start: at deployment OR after pre-bonding
 * - Duration: 0 to 730 days
 * - Early unlock penalty: optional, burn or redistribute
 *
 * ## Requirement 3 — Creator Allocation (Transparent)
 * - Creator allocation: 0% to 90% (0-9000 bps)
 * - Community allocation: remainder after creator + LP
 * - LP allocation: auto-calculated for Uniswap/Curve
 * - All wallets labeled on-chain
 * - No hidden wallets
 *
 * ## Requirement 4 — DAO Setup (Optional)
 * - DAO creation with multisig treasury
 * - Treasury funded with % of supply
 * - Community votes on: fees, parameters, treasury spends
 * - DAO management service ($X/mo)
 * - Emergency pause: multi-sig of trusted signers
 *
 * ## Requirement 5 — Protocol Selection
 * - Deploy on: Base, Optimism, Arbitrum, Polygon, Solana
 * - Select at deployment
 * - Add chains later via DAO vote
 *
 * All values validated with strict bounds to prevent exploitation.
 * DO NOT hardcode secrets, RPCs, or private keys here.
 */

import {
  type CreatorCoinConfig,
  type CreatorControlConfig,
  type CreatorOptions,
  type DAODeploymentConfig,
  DEFAULT_CREATOR_CONTROLS,
  type EarlyUnlockPenalty,
  type FeeConfig,
  type FeeRecipientType,
  FIXED_PLATFORM_FEE_BPS,
  type LabeledAllocation,
  type LabeledWalletOnChain,
  type ProtocolSelection,
  VESTING_CONSTANTS,
  type VestingConfig,
  type WalletLabel,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// Constants & Bounds
// ═══════════════════════════════════════════════════════════════════════════════

export const CREATOR_CONTROL_CONSTANTS = {
  // Fee bounds (Requirement 1)
  /** Creator fee minimum (0%) */
  CREATOR_FEE_MIN_BPS: 0,
  /** Creator fee maximum (450 bps = 4.5%) */
  CREATOR_FEE_MAX_BPS: 450,
  /** Total fee minimum (50 bps = 0.5% — just platform fee) */
  TOTAL_FEE_MIN_BPS: FIXED_PLATFORM_FEE_BPS,
  /** Total fee maximum (500 bps = 5%) */
  TOTAL_FEE_MAX_BPS: 500,
  /** Platform fee is ALWAYS 50 bps — non-negotiable */
  PLATFORM_FEE_FIXED_BPS: FIXED_PLATFORM_FEE_BPS,

  // Allocation bounds (Requirement 3)
  /** Creator allocation minimum (0%) */
  CREATOR_ALLOCATION_MIN_BPS: 0,
  /** Creator allocation maximum (9000 bps = 90%) */
  CREATOR_ALLOCATION_MAX_BPS: 9000,
  /** LP allocation minimum (0%) */
  LP_ALLOCATION_MIN_BPS: 0,
  /** Treasury allocation maximum (2000 bps = 20%) */
  TREASURY_ALLOCATION_MAX_BPS: 2000,
  /** Community allocation minimum (0%) */
  COMMUNITY_ALLOCATION_MIN_BPS: 0,

  // DAO bounds (Requirement 4)
  /** Minimum multisig threshold */
  MULTISIG_THRESHOLD_MIN: 1,
  /** Maximum multisig signers */
  MULTISIG_SIGNERS_MAX: 20,
  /** Minimum emergency pause threshold */
  EMERGENCY_PAUSE_THRESHOLD_MIN: 1,

  // Protocol bounds (Requirement 5)
  /** Maximum additional chains at launch */
  MAX_ADDITIONAL_CHAINS: 4,

  // Vesting bounds (Requirement 2)
  /** Maximum early unlock penalty (5000 bps = 50%) */
  MAX_EARLY_PENALTY_BPS: 5000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  field: string;
  message: string;
  value: number;
  min?: number;
  max?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate the complete creator options configuration.
 * Returns errors (must fix) and warnings (should consider).
 */
export function validateCreatorControls(controls: CreatorControlConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // ── Fee Structure Validation (Requirement 1) ────────────────────────────────

  // Platform fee must always be 50 bps
  if (controls.feeConfig.platformFeeBps !== FIXED_PLATFORM_FEE_BPS) {
    errors.push({
      field: 'feeConfig.platformFeeBps',
      message: `Platform fee is fixed at ${FIXED_PLATFORM_FEE_BPS} bps (0.5%)`,
      value: controls.feeConfig.platformFeeBps,
      min: FIXED_PLATFORM_FEE_BPS,
      max: FIXED_PLATFORM_FEE_BPS,
    });
  }

  // Creator fee: 0-450 bps
  if (
    controls.feeConfig.creatorFeeBps < CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MIN_BPS ||
    controls.feeConfig.creatorFeeBps > CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MAX_BPS
  ) {
    errors.push({
      field: 'feeConfig.creatorFeeBps',
      message: `Creator fee must be between ${CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MIN_BPS} and ${CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MAX_BPS} bps (0% to 4.5%)`,
      value: controls.feeConfig.creatorFeeBps,
      min: CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MIN_BPS,
      max: CREATOR_CONTROL_CONSTANTS.CREATOR_FEE_MAX_BPS,
    });
  }

  // Total fee must be between 50-500 bps
  const computedTotal = controls.feeConfig.platformFeeBps + controls.feeConfig.creatorFeeBps;
  if (
    computedTotal < CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MIN_BPS ||
    computedTotal > CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MAX_BPS
  ) {
    errors.push({
      field: 'feeConfig.totalFeeBps',
      message: `Total fee (${computedTotal} bps) must be between ${CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MIN_BPS} and ${CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MAX_BPS} bps (0.5% to 5%)`,
      value: computedTotal,
      min: CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MIN_BPS,
      max: CREATOR_CONTROL_CONSTANTS.TOTAL_FEE_MAX_BPS,
    });
  }

  // Check totalFeeBps matches computation
  if (controls.feeConfig.totalFeeBps !== computedTotal) {
    errors.push({
      field: 'feeConfig.totalFeeBps',
      message: `totalFeeBps (${controls.feeConfig.totalFeeBps}) must equal platformFeeBps + creatorFeeBps (${computedTotal})`,
      value: controls.feeConfig.totalFeeBps,
    });
  }

  // Fee recipient validation
  if (controls.feeConfig.feeRecipient === 'split') {
    if (!controls.feeConfig.feeSplit) {
      errors.push({
        field: 'feeConfig.feeSplit',
        message: 'Fee split configuration is required when feeRecipient is "split"',
        value: 0,
      });
    } else if (
      controls.feeConfig.feeSplit.creatorShareBps < 0 ||
      controls.feeConfig.feeSplit.creatorShareBps > 10000
    ) {
      errors.push({
        field: 'feeConfig.feeSplit.creatorShareBps',
        message: 'Creator share must be between 0 and 10000 bps',
        value: controls.feeConfig.feeSplit.creatorShareBps,
        min: 0,
        max: 10000,
      });
    }
  } else if (controls.feeConfig.feeRecipient === 'creator' && !controls.feeConfig.feeWallet) {
    errors.push({
      field: 'feeConfig.feeWallet',
      message: 'Fee wallet address is required when fee recipient is "creator"',
      value: 0,
    });
  }

  // Fee change threshold
  if (
    controls.feeConfig.feeChangeThresholdBps < 0 ||
    controls.feeConfig.feeChangeThresholdBps > 10000
  ) {
    errors.push({
      field: 'feeConfig.feeChangeThresholdBps',
      message: 'Fee change threshold must be between 0 and 10000 bps',
      value: controls.feeConfig.feeChangeThresholdBps,
      min: 0,
      max: 10000,
    });
  }

  // Warning: very high fees
  if (controls.feeConfig.creatorFeeBps > 300) {
    warnings.push(
      `Creator fee of ${(controls.feeConfig.creatorFeeBps / 100).toFixed(2)}% is above 3%. High fees may discourage trading.`,
    );
  }

  // ── Vesting Validation (Requirement 2) ─────────────────────────────────────

  // Duration: 0 to 730 days
  if (
    controls.vesting.duration < VESTING_CONSTANTS.MIN_DURATION_SECONDS ||
    controls.vesting.duration > VESTING_CONSTANTS.MAX_DURATION_SECONDS
  ) {
    errors.push({
      field: 'vesting.duration',
      message: `Vesting duration must be between ${VESTING_CONSTANTS.MIN_DURATION_SECONDS} and ${VESTING_CONSTANTS.MAX_DURATION_SECONDS} seconds (0-730 days)`,
      value: controls.vesting.duration,
      min: VESTING_CONSTANTS.MIN_DURATION_SECONDS,
      max: VESTING_CONSTANTS.MAX_DURATION_SECONDS,
    });
  }

  // Cliff duration cannot exceed vesting duration
  if (controls.vesting.cliffDuration > controls.vesting.duration) {
    errors.push({
      field: 'vesting.cliffDuration',
      message: 'Cliff duration cannot exceed vesting duration',
      value: controls.vesting.cliffDuration,
      max: controls.vesting.duration,
    });
  }

  // Initial unlock: 0-20%
  if (
    controls.vesting.initialUnlockBps < 0 ||
    controls.vesting.initialUnlockBps > VESTING_CONSTANTS.MAX_INITIAL_UNLOCK_BPS
  ) {
    errors.push({
      field: 'vesting.initialUnlockBps',
      message: `Initial unlock must be between 0 and ${VESTING_CONSTANTS.MAX_INITIAL_UNLOCK_BPS} bps (0-20%)`,
      value: controls.vesting.initialUnlockBps,
      min: 0,
      max: VESTING_CONSTANTS.MAX_INITIAL_UNLOCK_BPS,
    });
  }

  // Vesting type validation
  if (
    controls.vesting.type === 'staged' &&
    (!controls.vesting.stages || controls.vesting.stages.length === 0)
  ) {
    errors.push({
      field: 'vesting.stages',
      message: 'Staged vesting requires at least one stage',
      value: 0,
    });
  }

  if (controls.vesting.type === 'staged' && controls.vesting.stages) {
    // Validate stages: cumulative unlock must reach 100%
    let cumulativeBps = controls.vesting.initialUnlockBps;
    for (let i = 0; i < controls.vesting.stages.length; i++) {
      const stage = controls.vesting.stages[i]!;
      if (stage.timeSeconds < 0 || stage.timeSeconds > controls.vesting.duration) {
        errors.push({
          field: `vesting.stages[${i}].timeSeconds`,
          message: `Stage timestamp must be between 0 and vesting duration (${controls.vesting.duration}s)`,
          value: stage.timeSeconds,
          min: 0,
          max: controls.vesting.duration,
        });
      }
      cumulativeBps += stage.unlockBps;
    }
    if (cumulativeBps > 10000) {
      errors.push({
        field: 'vesting.stages',
        message: `Total unlock (${cumulativeBps} bps) exceeds 100% (10000 bps)`,
        value: cumulativeBps,
        max: 10000,
      });
    }
  }

  // Cliff vesting requires cliffDuration > 0
  if (controls.vesting.type === 'cliff' && controls.vesting.cliffDuration <= 0) {
    errors.push({
      field: 'vesting.cliffDuration',
      message: 'Cliff vesting requires cliffDuration > 0',
      value: controls.vesting.cliffDuration,
    });
  }

  // Early unlock penalty validation
  if (controls.vesting.earlyUnlockPenalty?.enabled) {
    const penalty = controls.vesting.earlyUnlockPenalty;
    if (
      penalty.penaltyBps < 0 ||
      penalty.penaltyBps > CREATOR_CONTROL_CONSTANTS.MAX_EARLY_PENALTY_BPS
    ) {
      errors.push({
        field: 'vesting.earlyUnlockPenalty.penaltyBps',
        message: `Early unlock penalty must be between 0 and ${CREATOR_CONTROL_CONSTANTS.MAX_EARLY_PENALTY_BPS} bps (0-50%)`,
        value: penalty.penaltyBps,
        min: 0,
        max: CREATOR_CONTROL_CONSTANTS.MAX_EARLY_PENALTY_BPS,
      });
    }
    if (penalty.windowSeconds <= 0 || penalty.windowSeconds > controls.vesting.duration) {
      errors.push({
        field: 'vesting.earlyUnlockPenalty.windowSeconds',
        message: 'Penalty window must be between 1 second and vesting duration',
        value: penalty.windowSeconds,
        min: 1,
        max: controls.vesting.duration,
      });
    }
  }

  // Warning: no vesting
  if (controls.vesting.duration === 0 && controls.creatorAllocationBps > 0) {
    warnings.push('No vesting period set. Creator tokens will be fully unlocked at TGE.');
  }

  // ── Allocation Validation (Requirement 3) ──────────────────────────────────

  // Creator allocation: 0-90%
  if (
    controls.creatorAllocationBps < CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MIN_BPS ||
    controls.creatorAllocationBps > CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MAX_BPS
  ) {
    errors.push({
      field: 'creatorAllocationBps',
      message: `Creator allocation must be between ${CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MIN_BPS} and ${CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MAX_BPS} bps (0% to 90%)`,
      value: controls.creatorAllocationBps,
      min: CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MIN_BPS,
      max: CREATOR_CONTROL_CONSTANTS.CREATOR_ALLOCATION_MAX_BPS,
    });
  }

  // Treasury allocation: 0-20%
  if (
    controls.treasuryAllocationBps < 0 ||
    controls.treasuryAllocationBps > CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS
  ) {
    errors.push({
      field: 'treasuryAllocationBps',
      message: `Treasury allocation must be between 0 and ${CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS} bps (0-20%)`,
      value: controls.treasuryAllocationBps,
      min: 0,
      max: CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS,
    });
  }

  // All primary allocations must sum to 100% (excluding labeled allocations which are sub-allocations)
  const primaryTotal =
    controls.creatorAllocationBps +
    controls.liquidityAllocationBps +
    controls.communityAllocationBps +
    controls.treasuryAllocationBps;

  if (primaryTotal < 9990 || primaryTotal > 10010) {
    errors.push({
      field: 'totalAllocation',
      message: `Primary allocations must sum to ~100% (currently ${(primaryTotal / 100).toFixed(2)}%). Creator: ${(controls.creatorAllocationBps / 100).toFixed(2)}%, LP: ${(controls.liquidityAllocationBps / 100).toFixed(2)}%, Community: ${(controls.communityAllocationBps / 100).toFixed(2)}%, Treasury: ${(controls.treasuryAllocationBps / 100).toFixed(2)}%`,
      value: primaryTotal,
      min: 9990,
      max: 10010,
    });
  }

  // Labeled allocations must not exceed their parent category
  if (controls.labeledAllocations.length > 0) {
    const labeledTotalByParent = new Map<WalletLabel, number>();
    for (const alloc of controls.labeledAllocations) {
      labeledTotalByParent.set(
        alloc.label,
        (labeledTotalByParent.get(alloc.label) ?? 0) + alloc.allocationBps,
      );
    }

    for (const [label, total] of labeledTotalByParent) {
      if (label === 'creator' && total > controls.creatorAllocationBps) {
        errors.push({
          field: 'labeledAllocations',
          message: `Labeled creator allocations (${total} bps) exceed creator allocation budget (${controls.creatorAllocationBps} bps)`,
          value: total,
          max: controls.creatorAllocationBps,
        });
      }
      if (label === 'treasury' && total > controls.treasuryAllocationBps) {
        errors.push({
          field: 'labeledAllocations',
          message: `Labeled treasury allocations (${total} bps) exceed treasury allocation budget (${controls.treasuryAllocationBps} bps)`,
          value: total,
          max: controls.treasuryAllocationBps,
        });
      }
    }
  }

  // Warning: very high creator allocation
  if (controls.creatorAllocationBps > 5000) {
    warnings.push(
      `Creator allocation of ${(controls.creatorAllocationBps / 100).toFixed(1)}% is very high. This may reduce buyer confidence.`,
    );
  }

  // ── DAO Validation (Requirement 4) ─────────────────────────────────────────

  if (controls.enableDAO) {
    if (!controls.daoConfig) {
      errors.push({
        field: 'daoConfig',
        message: 'DAO configuration is required when enableDAO is true',
        value: 0,
      });
    } else {
      const dao = controls.daoConfig;
      if (dao.multisigThreshold < CREATOR_CONTROL_CONSTANTS.MULTISIG_THRESHOLD_MIN) {
        errors.push({
          field: 'daoConfig.multisigThreshold',
          message: `Multisig threshold must be at least ${CREATOR_CONTROL_CONSTANTS.MULTISIG_THRESHOLD_MIN}`,
          value: dao.multisigThreshold,
          min: CREATOR_CONTROL_CONSTANTS.MULTISIG_THRESHOLD_MIN,
        });
      }
      if (dao.multisigThreshold > dao.multisigSigners.length) {
        errors.push({
          field: 'daoConfig.multisigThreshold',
          message: `Multisig threshold (${dao.multisigThreshold}) cannot exceed number of signers (${dao.multisigSigners.length})`,
          value: dao.multisigThreshold,
          max: dao.multisigSigners.length,
        });
      }
      if (dao.multisigSigners.length > CREATOR_CONTROL_CONSTANTS.MULTISIG_SIGNERS_MAX) {
        errors.push({
          field: 'daoConfig.multisigSigners',
          message: `Maximum ${CREATOR_CONTROL_CONSTANTS.MULTISIG_SIGNERS_MAX} multisig signers allowed`,
          value: dao.multisigSigners.length,
          max: CREATOR_CONTROL_CONSTANTS.MULTISIG_SIGNERS_MAX,
        });
      }
      if (
        dao.emergencyPauseThreshold < CREATOR_CONTROL_CONSTANTS.EMERGENCY_PAUSE_THRESHOLD_MIN ||
        dao.emergencyPauseThreshold > dao.emergencyPauseSigners.length
      ) {
        errors.push({
          field: 'daoConfig.emergencyPauseThreshold',
          message: `Emergency pause threshold must be between ${CREATOR_CONTROL_CONSTANTS.EMERGENCY_PAUSE_THRESHOLD_MIN} and number of pause signers (${dao.emergencyPauseSigners.length})`,
          value: dao.emergencyPauseThreshold,
          min: CREATOR_CONTROL_CONSTANTS.EMERGENCY_PAUSE_THRESHOLD_MIN,
          max: dao.emergencyPauseSigners.length,
        });
      }
      if (
        dao.treasuryFundingBps < 0 ||
        dao.treasuryFundingBps > CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS
      ) {
        errors.push({
          field: 'daoConfig.treasuryFundingBps',
          message: `Treasury funding must be between 0 and ${CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS} bps (0-20%)`,
          value: dao.treasuryFundingBps,
          min: 0,
          max: CREATOR_CONTROL_CONSTANTS.TREASURY_ALLOCATION_MAX_BPS,
        });
      }
      if (dao.enableManagedService && dao.managedServiceFeeUsd <= 0) {
        errors.push({
          field: 'daoConfig.managedServiceFeeUsd',
          message: 'Managed service fee must be > 0 when managed service is enabled',
          value: dao.managedServiceFeeUsd,
        });
      }
    }
  }

  // ── Protocol Selection Validation (Requirement 5) ─────────────────────────

  const allChains = new Set([
    controls.protocolSelection.primaryChain,
    ...controls.protocolSelection.additionalChains,
  ]);
  if (allChains.size !== 1 + controls.protocolSelection.additionalChains.length) {
    errors.push({
      field: 'protocolSelection.additionalChains',
      message: 'Duplicate chains in protocol selection',
      value: controls.protocolSelection.additionalChains.length,
    });
  }
  if (
    controls.protocolSelection.additionalChains.length >
    CREATOR_CONTROL_CONSTANTS.MAX_ADDITIONAL_CHAINS
  ) {
    errors.push({
      field: 'protocolSelection.additionalChains',
      message: `Maximum ${CREATOR_CONTROL_CONSTANTS.MAX_ADDITIONAL_CHAINS} additional chains at launch`,
      value: controls.protocolSelection.additionalChains.length,
      max: CREATOR_CONTROL_CONSTANTS.MAX_ADDITIONAL_CHAINS,
    });
  }

  // ── Existing Feature Validation ────────────────────────────────────────────

  if (controls.restrictTransfersDuringBonding && controls.lockLiquidity) {
    // Valid combination
  }

  if (controls.lockLiquidity && controls.liquidityLockDuration < 7 * 24 * 60 * 60) {
    warnings.push(
      'Liquidity lock duration less than 7 days may reduce buyer confidence. Minimum recommended: 30 days.',
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fee Structure (Requirement 1)
// ═══════════════════════════════════════════════════════════════════════════════

export interface FeeBreakdown {
  platformFeeBps: number;
  creatorFeeBps: number;
  totalFeeBps: number;
  platformFeePercent: string;
  creatorFeePercent: string;
  totalFeePercent: string;
  feeRecipient: FeeRecipientType;
  feeWallet: string | null;
  daoChangeable: boolean;
  changeThresholdPercent: string;
}

/**
 * Get a human-readable breakdown of the fee structure.
 * All fees visible on-chain.
 */
export function getFeeBreakdown(feeConfig: FeeConfig): FeeBreakdown {
  return {
    platformFeeBps: feeConfig.platformFeeBps,
    creatorFeeBps: feeConfig.creatorFeeBps,
    totalFeeBps: feeConfig.totalFeeBps,
    platformFeePercent: `${(feeConfig.platformFeeBps / 100).toFixed(2)}%`,
    creatorFeePercent: `${(feeConfig.creatorFeeBps / 100).toFixed(2)}%`,
    totalFeePercent: `${(feeConfig.totalFeeBps / 100).toFixed(2)}%`,
    feeRecipient: feeConfig.feeRecipient,
    feeWallet: feeConfig.feeWallet ?? null,
    daoChangeable: feeConfig.daoChangeable,
    changeThresholdPercent: `${(feeConfig.feeChangeThresholdBps / 100).toFixed(1)}%`,
  };
}

/**
 * Calculate which address receives the fee for a given trade.
 * Returns { creatorFeeShare, platformFeeShare, recipient }.
 */
export function calculateFeeDistribution(
  grossAmount: bigint,
  feeConfig: FeeConfig,
): {
  platformFee: bigint;
  creatorFee: bigint;
  platformRecipient: string;
  creatorRecipient: string | null;
  totalFee: bigint;
  netAmount: bigint;
} {
  const FIXED_PLATFORM_FEE_WALLET = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET || '';

  const platformFee = (grossAmount * BigInt(feeConfig.platformFeeBps)) / 10_000n;
  const creatorFee = (grossAmount * BigInt(feeConfig.creatorFeeBps)) / 10_000n;
  const totalFee = platformFee + creatorFee;
  const netAmount = grossAmount - totalFee;

  let creatorRecipient: string | null = null;
  if (feeConfig.feeRecipient === 'creator' && feeConfig.feeWallet) {
    creatorRecipient = feeConfig.feeWallet;
  } else if (feeConfig.feeRecipient === 'dao_treasury') {
    creatorRecipient = null; // Goes to DAO treasury (contract-managed)
  } else if (feeConfig.feeRecipient === 'split' && feeConfig.feeSplit) {
    // Split handled at contract level, recipient is the distribution contract
    creatorRecipient = feeConfig.feeWallet ?? null;
  }

  return {
    platformFee,
    creatorFee,
    platformRecipient: FIXED_PLATFORM_FEE_WALLET,
    creatorRecipient,
    totalFee,
    netAmount,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Vesting Schedule (Requirement 2)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VestingSchedule {
  totalAllocation: bigint;
  initialUnlock: bigint;
  cliffEnd: number;
  vestingEnd: number;
  stages: VestingStage[];
  hasEarlyPenalty: boolean;
  penaltyInfo: EarlyUnlockPenalty | null;
}

export interface VestingStage {
  timestamp: number;
  cumulativeUnlockBps: number;
  cumulativeUnlockFormatted: string;
  unlockAmount: bigint;
}

/**
 * Calculate the vesting schedule for a creator's allocation.
 * Supports: linear, cliff, staged, and custom schedules.
 */
export function calculateVestingSchedule(
  totalAllocationWei: bigint,
  vesting: VestingConfig,
  startTimestamp: number, // deployment or after_bonding timestamp
): VestingSchedule {
  const effectiveStart =
    vesting.vestingStart === 'after_bonding'
      ? startTimestamp // Will be set to graduation timestamp at runtime
      : startTimestamp;

  const initialUnlock = (totalAllocationWei * BigInt(vesting.initialUnlockBps)) / 10_000n;
  const cliffEnd = effectiveStart + vesting.cliffDuration;
  const vestingEnd = cliffEnd + vesting.duration;

  const stages: VestingStage[] = [];

  if (vesting.type === 'staged' && vesting.stages && vesting.stages.length > 0) {
    // Staged/custom vesting: predefined unlock points
    let cumulativeBps = vesting.initialUnlockBps;
    for (const stage of vesting.stages) {
      const stageTime = effectiveStart + stage.timeSeconds;
      cumulativeBps += stage.unlockBps;
      const cumulativeAmount =
        (totalAllocationWei * BigInt(Math.min(10000, cumulativeBps))) / 10_000n;
      stages.push({
        timestamp: stageTime,
        cumulativeUnlockBps: cumulativeBps,
        cumulativeUnlockFormatted: `${(cumulativeBps / 100).toFixed(2)}%`,
        unlockAmount:
          stages.length === 0
            ? cumulativeAmount - initialUnlock
            : cumulativeAmount -
              (totalAllocationWei * BigInt(cumulativeBps - stage.unlockBps)) / 10_000n,
      });
    }
  } else {
    // Linear or cliff vesting: generate monthly milestones
    const totalVesting = totalAllocationWei - initialUnlock;
    const months = Math.max(1, Math.ceil(vesting.duration / (30 * 24 * 60 * 60)));
    const monthlyBps = Math.floor(10000 / months);

    for (let month = 1; month <= months; month++) {
      const stageTime = cliffEnd + month * 30 * 24 * 60 * 60;
      const cumulativeBps = Math.min(10000, month * monthlyBps);
      const cumulativeAmount = initialUnlock + (totalVesting * BigInt(cumulativeBps)) / 10_000n;
      stages.push({
        timestamp: stageTime > vestingEnd ? vestingEnd : stageTime,
        cumulativeUnlockBps: cumulativeBps,
        cumulativeUnlockFormatted: `${(cumulativeBps / 100).toFixed(2)}%`,
        unlockAmount: cumulativeAmount,
      });
    }
  }

  return {
    totalAllocation: totalAllocationWei,
    initialUnlock,
    cliffEnd,
    vestingEnd,
    stages,
    hasEarlyPenalty: vesting.earlyUnlockPenalty?.enabled ?? false,
    penaltyInfo: vesting.earlyUnlockPenalty ?? null,
  };
}

/**
 * Calculate claimable amount at a given timestamp.
 * Includes early unlock penalty logic.
 */
export function calculateClaimableAmount(
  schedule: VestingSchedule,
  currentTimestamp: number,
  alreadyClaimed: bigint,
): { claimable: bigint; penalty: bigint; netClaimable: bigint } {
  if (currentTimestamp < schedule.cliffEnd) {
    return { claimable: 0n, penalty: 0n, netClaimable: 0n };
  }

  let totalVested = schedule.initialUnlock;

  for (const stage of schedule.stages) {
    if (currentTimestamp >= stage.timestamp) {
      totalVested += stage.unlockAmount;
    } else {
      break;
    }
  }

  if (currentTimestamp >= schedule.vestingEnd) {
    totalVested = schedule.totalAllocation;
  }

  const claimable = totalVested - alreadyClaimed;
  if (claimable <= 0n) {
    return { claimable: 0n, penalty: 0n, netClaimable: 0n };
  }

  // Early unlock penalty logic
  let penalty = 0n;
  if (
    schedule.hasEarlyPenalty &&
    schedule.penaltyInfo &&
    currentTimestamp < schedule.vestingEnd &&
    currentTimestamp >= schedule.vestingEnd - schedule.penaltyInfo.windowSeconds
  ) {
    penalty = (claimable * BigInt(schedule.penaltyInfo.penaltyBps)) / 10_000n;
  }

  return {
    claimable,
    penalty,
    netClaimable: claimable - penalty,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Allocation Calculator (Requirement 3)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AllocationBreakdown {
  totalSupply: bigint;
  creator: {
    amount: bigint;
    percent: number;
    vestingSchedule: VestingSchedule;
  };
  liquidity: {
    amount: bigint;
    percent: number;
    lockedUntil: number;
    dexType: 'uniswap' | 'curve' | 'auto';
  };
  community: {
    amount: bigint;
    percent: number;
  };
  treasury: {
    amount: bigint;
    percent: number;
    daoAddress?: string;
  };
  bondingCurve: {
    amount: bigint;
    percent: number;
  };
  /** All labeled wallets with their allocations — visible on-chain */
  labeledWallets: LabeledWalletOnChain[];
}

/**
 * Calculate the full allocation breakdown for a creator coin.
 * All wallets are labeled and visible on-chain.
 * No hidden wallets — full transparency.
 */
export function calculateAllocations(
  totalSupply: bigint,
  controls: CreatorControlConfig,
  createdAt: number,
  creatorAddress: string,
): AllocationBreakdown {
  const creatorAmount = (totalSupply * BigInt(controls.creatorAllocationBps)) / 10_000n;
  const liquidityAmount = (totalSupply * BigInt(controls.liquidityAllocationBps)) / 10_000n;
  const communityAmount = (totalSupply * BigInt(controls.communityAllocationBps)) / 10_000n;
  const treasuryAmount = (totalSupply * BigInt(controls.treasuryAllocationBps)) / 10_000n;

  const allocated = creatorAmount + liquidityAmount + communityAmount + treasuryAmount;
  const bondingCurveAmount = totalSupply - allocated;

  // Build labeled wallets for on-chain transparency
  const labeledWallets: LabeledWalletOnChain[] = [
    {
      label: 'creator',
      address: creatorAddress,
      allocationBps: controls.creatorAllocationBps,
      name: 'Creator',
    },
    {
      label: 'liquidity',
      address: '', // Set at deploy time to the DEX pool contract
      allocationBps: controls.liquidityAllocationBps,
      name: 'Liquidity Pool',
    },
    {
      label: 'community',
      address: '', // Community allocation wallet
      allocationBps: controls.communityAllocationBps,
      name: 'Community Treasury',
    },
    {
      label: 'treasury',
      address: controls.daoConfig?.template
        ? creatorAddress // Will be replaced with timelock address on DAO deploy
        : creatorAddress, // Creator-managed if no DAO
      allocationBps: controls.treasuryAllocationBps,
      name: controls.enableDAO ? 'DAO Treasury' : 'Treasury',
    },
  ];

  // Add labeled sub-allocations
  for (const alloc of controls.labeledAllocations) {
    labeledWallets.push({
      label: alloc.label,
      address: alloc.address,
      allocationBps: alloc.allocationBps,
      name: alloc.name,
    });
  }

  return {
    totalSupply,
    creator: {
      amount: creatorAmount,
      percent: controls.creatorAllocationBps / 100,
      vestingSchedule: calculateVestingSchedule(creatorAmount, controls.vesting, createdAt),
    },
    liquidity: {
      amount: liquidityAmount,
      percent: controls.liquidityAllocationBps / 100,
      lockedUntil: createdAt + controls.liquidityLockDuration,
      dexType: 'auto', // Auto-detect Uniswap v3 vs Curve based on chain
    },
    community: {
      amount: communityAmount,
      percent: controls.communityAllocationBps / 100,
    },
    treasury: {
      amount: treasuryAmount,
      percent: controls.treasuryAllocationBps / 100,
    },
    bondingCurve: {
      amount: bondingCurveAmount,
      percent: Number((bondingCurveAmount * 100_00n) / totalSupply) / 100,
    },
    labeledWallets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAO Config Builder (Requirement 4)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a DAO configuration from creator inputs.
 */
export function buildDAOConfig(overrides?: Partial<DAODeploymentConfig>): DAODeploymentConfig {
  const defaultConfig = getDefaultDAOConfig();

  if (!overrides) return defaultConfig;

  return {
    ...defaultConfig,
    ...overrides,
    voting: {
      ...defaultConfig.voting,
      ...overrides.voting,
    },
  };
}

function getDefaultDAOConfig(): DAODeploymentConfig {
  return {
    name: '',
    description: '',
    template: 'creator',
    multisigSigners: [],
    multisigThreshold: 2,
    treasuryFundingBps: 1000,
    voting: {
      votingPeriod: 604800,
      votingDelay: 86400,
      quorumPercent: 10,
      proposalThreshold: 1,
      approvalThreshold: 51,
      allowDelegation: true,
    },
    enableManagedService: false,
    managedServiceFeeUsd: 0,
    emergencyPauseSigners: [],
    emergencyPauseThreshold: 2,
    canUpdateFees: true,
    canUpdateParameters: true,
    canSpendTreasury: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Protocol Selection Validator (Requirement 5)
// ═══════════════════════════════════════════════════════════════════════════════

export function validateProtocolSelection(selection: ProtocolSelection): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validChains = ['solana', 'base', 'optimism', 'arbitrum', 'polygon'] as const;

  if (!validChains.includes(selection.primaryChain as any)) {
    errors.push(`Invalid primary chain: ${selection.primaryChain}`);
  }

  for (const chain of selection.additionalChains) {
    if (!validChains.includes(chain as any)) {
      errors.push(`Invalid additional chain: ${chain}`);
    }
  }

  if (selection.additionalChains.includes(selection.primaryChain as any)) {
    errors.push('Primary chain cannot be in additional chains');
  }

  if (selection.addChainThresholdBps < 5000) {
    errors.push('Minimum DAO vote to add a chain must be at least 50% (5000 bps)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CreatorOptions ↔ CreatorControlConfig Conversion
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a user-friendly CreatorOptions object to the internal CreatorControlConfig.
 */
export function creatorOptionsToConfig(options: CreatorOptions): CreatorControlConfig {
  const feeConfig: FeeConfig = {
    platformFeeBps: 50,
    creatorFeeBps: Math.round(options.fee.creatorFeePercent * 100),
    totalFeeBps: Math.round(options.fee.totalFeePercent * 100),
    feeRecipient: options.fee.feeRecipient,
    feeWallet: options.fee.feeWallet,
    daoChangeable: options.fee.daoChangeable,
    feeChangeThresholdBps: 5000, // Default
  };

  const vestingConfig: VestingConfig = {
    duration: options.vesting.durationDays * 24 * 60 * 60,
    cliffDuration: options.vesting.cliffDays * 24 * 60 * 60,
    initialUnlockBps: Math.round(options.vesting.initialUnlockPercent * 100),
    type:
      options.vesting.type === 'custom'
        ? 'staged'
        : options.vesting.type === 'cliff'
          ? 'cliff'
          : 'linear',
    vestingStart: options.vesting.start,
    earlyUnlockPenalty: options.vesting.earlyUnlockPenalty?.enabled
      ? {
          enabled: true,
          action: options.vesting.earlyUnlockPenalty.action,
          penaltyBps: Math.round(options.vesting.earlyUnlockPenalty.penaltyPercent * 100),
          windowSeconds: options.vesting.earlyUnlockPenalty.beforeEndDays * 24 * 60 * 60,
        }
      : undefined,
  };

  if (options.vesting.type === 'custom' && options.vesting.stages) {
    vestingConfig.stages = options.vesting.stages.map((s) => ({
      timeSeconds: s.day * 24 * 60 * 60,
      unlockBps: Math.round(s.unlockPercent * 100),
    }));
  }

  const labeledAllocations: LabeledAllocation[] = options.allocation.labeledWallets.map((w) => ({
    label: w.label,
    address: w.address,
    allocationBps: Math.round(w.percent * 100),
    name: w.name,
  }));

  const daoConfig = options.dao.enabled
    ? buildDAOConfig({
        name: options.dao.name,
        description: options.dao.description,
        template: options.dao.template,
        multisigSigners: options.dao.multisigSigners ?? [],
        multisigThreshold: options.dao.multisigThreshold ?? 2,
        treasuryFundingBps: Math.round((options.dao.treasuryPercent ?? 10) * 100),
        enableManagedService: options.dao.managedService?.enabled ?? false,
        managedServiceFeeUsd: options.dao.managedService?.monthlyFeeUsd ?? 0,
        emergencyPauseSigners: options.dao.emergencyPause?.signers ?? [],
        emergencyPauseThreshold: options.dao.emergencyPause?.threshold ?? 2,
        voting: {
          votingPeriod: (options.dao.votingPeriodDays ?? 7) * 24 * 60 * 60,
          votingDelay: 86400,
          quorumPercent: options.dao.quorumPercent ?? 10,
          proposalThreshold: 1,
          approvalThreshold: 51,
          allowDelegation: true,
        },
      })
    : undefined;

  return {
    vesting: vestingConfig,
    creatorAllocationBps: Math.round(options.allocation.creatorPercent * 100),
    liquidityAllocationBps: Math.round(options.allocation.liquidityPercent * 100),
    communityAllocationBps: Math.round(options.allocation.communityPercent * 100),
    treasuryAllocationBps: Math.round(options.allocation.treasuryPercent * 100),
    labeledAllocations,
    feeConfig,
    enableDAO: options.dao.enabled,
    daoConfig,
    protocolSelection: {
      primaryChain: options.protocol.primaryChain,
      additionalChains: options.protocol.additionalChains,
      expandable: options.protocol.expandable,
      addChainThresholdBps: 6000,
    },
    restrictTransfersDuringBonding: options.restrictions.restrictTransfersDuringBonding,
    burnUnsoldTokens: options.restrictions.burnUnsoldTokens,
    enableAntiWhale: options.restrictions.enableAntiWhale,
    lockLiquidity: options.restrictions.lockLiquidity,
    liquidityLockDuration: options.restrictions.liquidityLockDays * 24 * 60 * 60,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transfer Restrictions & Burn Mechanism (Legacy)
// ═══════════════════════════════════════════════════════════════════════════════

export type TransferRestrictionLevel = 'none' | 'bonding_only' | 'always';

export function areTransfersAllowed(
  controls: CreatorControlConfig,
  isGraduated: boolean,
  restrictionLevel: TransferRestrictionLevel,
): boolean {
  if (restrictionLevel === 'always') return false;
  if (restrictionLevel === 'none') return true;

  if (controls.restrictTransfersDuringBonding && !isGraduated) {
    return false;
  }

  return true;
}

export interface BurnResult {
  amountBurned: bigint;
  remainingUnburned: bigint;
  newTotalSupply: bigint;
  percentBurned: number;
}

export function calculateBurn(
  totalSupply: bigint,
  mintedSupply: bigint,
  _controls: CreatorControlConfig,
): BurnResult {
  if (mintedSupply >= totalSupply) {
    return {
      amountBurned: 0n,
      remainingUnburned: 0n,
      newTotalSupply: totalSupply,
      percentBurned: 0,
    };
  }

  const unburned = totalSupply - mintedSupply;
  const newSupply = mintedSupply;

  return {
    amountBurned: unburned,
    remainingUnburned: 0n,
    newTotalSupply: newSupply,
    percentBurned: Number((unburned * 100_00n) / totalSupply) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Config Builder & On-Chain Code Generator
// ═══════════════════════════════════════════════════════════════════════════════

export function buildCreatorConfig(
  base: Omit<CreatorCoinConfig, 'creatorControls'>,
  controls?: Partial<CreatorControlConfig>,
): CreatorCoinConfig {
  const mergedControls: CreatorControlConfig = {
    ...DEFAULT_CREATOR_CONTROLS,
    ...controls,
    vesting: {
      ...DEFAULT_CREATOR_CONTROLS.vesting,
      ...controls?.vesting,
    },
    feeConfig: {
      ...DEFAULT_CREATOR_CONTROLS.feeConfig,
      ...controls?.feeConfig,
    },
    protocolSelection: {
      ...DEFAULT_CREATOR_CONTROLS.protocolSelection,
      ...controls?.protocolSelection,
    },
    labeledAllocations: controls?.labeledAllocations ?? [],
  };

  // Backwards compatibility: if creatorAllocationBps was set on base config
  // but no creator controls were provided, use the base value for allocation
  if (!controls && base.creatorAllocationBps > 0) {
    mergedControls.creatorAllocationBps = base.creatorAllocationBps;
  }

  // Sync legacy fee fields
  const feeConfig = mergedControls.feeConfig;
  const totalFeeBps = feeConfig.platformFeeBps + feeConfig.creatorFeeBps;
  if (feeConfig.totalFeeBps !== totalFeeBps) {
    mergedControls.feeConfig.totalFeeBps = totalFeeBps;
  }

  return {
    ...base,
    creatorControls: mergedControls,
    creatorAllocationBps: mergedControls.creatorAllocationBps,
    creatorFeeBps: feeConfig.creatorFeeBps,
    platformFeeBps: feeConfig.platformFeeBps,
  };
}

/**
 * Generate Solidity code for creator controls.
 * Embed this in the DegenFeedCoin contract.
 * Includes: fee structure, allocations, vesting, labeled wallets, DAO config.
 */
export function generateOnChainCreatorControlsCode(
  controls: CreatorControlConfig,
  _createdAt: number,
): string {
  const feeConfig = controls.feeConfig;
  const daoConfig = controls.daoConfig;

  return `
  // ── Creator Coin 2.0: Full Creator Controls ──────────────────────────
  // Generated: ${new Date().toISOString()}
  //
  // ALL PARAMETERS VISIBLE ON-CHAIN — Full Transparency

  // ═══ Fee Structure (Req 1) ═══════════════════════════════════════════
  uint256 public constant PLATFORM_FEE_BPS = ${feeConfig.platformFeeBps}; // ${(feeConfig.platformFeeBps / 100).toFixed(2)}% → DegenFeed
  uint256 public constant CREATOR_FEE_BPS = ${feeConfig.creatorFeeBps};   // ${(feeConfig.creatorFeeBps / 100).toFixed(2)}% → creator/DAO
  uint256 public constant TOTAL_FEE_BPS = ${feeConfig.totalFeeBps};      // ${(feeConfig.totalFeeBps / 100).toFixed(2)}% total
  address public constant PLATFORM_FEE_WALLET = ${process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET || 'address(0)'};
  address public creatorFeeWallet;
  bool public constant FEES_DAO_CHANGEABLE = ${feeConfig.daoChangeable ? 'true' : 'false'};
  uint256 public constant FEE_CHANGE_THRESHOLD_BPS = ${feeConfig.feeChangeThresholdBps};

  // ═══ Allocation (Req 3) — Labeled, Transparent ══════════════════════
  uint256 public constant CREATOR_ALLOCATION_BPS = ${controls.creatorAllocationBps};
  uint256 public constant LIQUIDITY_ALLOCATION_BPS = ${controls.liquidityAllocationBps};
  uint256 public constant COMMUNITY_ALLOCATION_BPS = ${controls.communityAllocationBps};
  uint256 public constant TREASURY_ALLOCATION_BPS = ${controls.treasuryAllocationBps};
  address public constant CREATOR_WALLET = ${process.env.NEXT_PUBLIC_DEPLOYER || 'address(0)'};

  // Labeled wallets (fully transparent)
  struct LabeledWallet {
    string label;
    address wallet;
    uint256 allocationBps;
    string name;
  }
  LabeledWallet[] public labeledWallets;

  // ═══ Vesting (Req 2) ════════════════════════════════════════════════
  uint256 public constant VESTING_DURATION = ${controls.vesting.duration};
  uint256 public constant VESTING_CLIFF = ${controls.vesting.cliffDuration};
  uint256 public constant INITIAL_UNLOCK_BPS = ${controls.vesting.initialUnlockBps};
  ${
    controls.vesting.earlyUnlockPenalty?.enabled
      ? `
  bool public constant EARLY_UNLOCK_PENALTY_ENABLED = true;
  uint256 public constant EARLY_UNLOCK_PENALTY_BPS = ${controls.vesting.earlyUnlockPenalty.penaltyBps};
  uint256 public constant EARLY_UNLOCK_WINDOW = ${controls.vesting.earlyUnlockPenalty.windowSeconds};
  `
      : `
  bool public constant EARLY_UNLOCK_PENALTY_ENABLED = false;
  `
  }

  // ═══ DAO Setup (Req 4) ══════════════════════════════════════════════
  ${
    controls.enableDAO && daoConfig
      ? `
  bool public constant DAO_ENABLED = true;
  string public constant DAO_NAME = "${daoConfig.name}";
  uint256 public constant TREASURY_FUNDING_BPS = ${daoConfig.treasuryFundingBps};
  uint256 public constant EMERGENCY_PAUSE_THRESHOLD = ${daoConfig.emergencyPauseThreshold};
  address[] public emergencyPauseSigners;
  // DAO can update: fees=${daoConfig.canUpdateFees}, params=${daoConfig.canUpdateParameters}, treasury=${daoConfig.canSpendTreasury}
  `
      : `
  bool public constant DAO_ENABLED = false;
  `
  }

  // ═══ Protocol Selection (Req 5) ════════════════════════════════════
  bool public constant PROTOCOL_EXPANDABLE = ${controls.protocolSelection.expandable ? 'true' : 'false'};
  uint256 public constant ADD_CHAIN_THRESHOLD_BPS = ${controls.protocolSelection.addChainThresholdBps};

  // ═══ Legacy Features ════════════════════════════════════════════════
  bool public constant RESTRICT_TRANSFERS = ${controls.restrictTransfersDuringBonding ? 'true' : 'false'};
  bool public constant LOCK_LIQUIDITY = ${controls.lockLiquidity ? 'true' : 'false'};
  uint256 public constant LIQUIDITY_LOCK_DURATION = ${controls.liquidityLockDuration};

  // ── Modifier: enforce transfer restrictions ────────────────────────
  modifier checkTransferRestrictions() {
    if (RESTRICT_TRANSFERS && !graduated) {
      revert("Transfers restricted during bonding");
    }
    _;
  }

  // ── Override transfer functions ────────────────────────────────────
  function transfer(address to, uint256 value) external override checkTransferRestrictions returns (bool) {
    return _transfer(msg.sender, to, value);
  }

  function transferFrom(address from, address to, uint256 value) external override checkTransferRestrictions returns (bool) {
    uint256 allowed = _allowances[from][msg.sender];
    if (allowed != type(uint256).max) {
      require(allowed >= value, "Insufficient allowance");
      unchecked { _allowances[from][msg.sender] = allowed - value; }
    }
    return _transfer(from, to, value);
  }

  // ── Fee collection: split between platform and creator ────────────
  function collectFees(uint256 grossAmount) internal returns (uint256 netAmount) {
    uint256 platformFee = (grossAmount * PLATFORM_FEE_BPS) / 10_000;
    uint256 creatorFee = (grossAmount * CREATOR_FEE_BPS) / 10_000;
    netAmount = grossAmount - platformFee - creatorFee;

    // Send platform fee to DegenFeed
    if (platformFee > 0) {
      payable(PLATFORM_FEE_WALLET).transfer(platformFee);
    }
    // Send creator fee
    if (creatorFee > 0 && creatorFeeWallet != address(0)) {
      payable(creatorFeeWallet).transfer(creatorFee);
    }
  }

  // ── Burn unsold tokens on graduation ───────────────────────────────
  function burnUnsold() external onlyOwner {
    require(graduated, "Not yet graduated");
    require(excessSupply() > 0, "No unsold tokens");
    uint256 amount = excessSupply();
    _burn(address(this), amount);
    emit TokensBurned(owner, amount, _totalSupply);
  }

  function excessSupply() public view returns (uint256) {
    return TOTAL_SUPPLY - _totalSupply;
  }

  // ── Fee wallet setter (DAO-controlled) ────────────────────────────
  function setCreatorFeeWallet(address newWallet) external {
    require(FEES_DAO_CHANGEABLE, "Fees not changeable");
    require(msg.sender == owner, "Only owner");
    creatorFeeWallet = newWallet;
  }
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fee Calculation (Legacy Interface)
// ═══════════════════════════════════════════════════════════════════════════════

export function calculatePlatformFee(amount: bigint, controls: CreatorControlConfig): bigint {
  return (amount * BigInt(controls.feeConfig.platformFeeBps)) / 10_000n;
}
