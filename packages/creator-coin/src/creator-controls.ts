/**
 * Creator Coin 2.0 — Creator Controls
 *
 * Empowers creators with full control over their tokenomics:
 * - Vesting schedule (default: 90 day linear, 5-20% allocation)
 * - Liquidity allocation (50-80%)
 * - Community allocation (10-30%)
 * - Treasury allocation (5-10%)
 * - Transfer restrictions during bonding
 * - Burn unsold tokens mechanism
 *
 * All values validated with strict bounds to prevent exploitation.
 */

import {
  type CreatorCoinConfig,
  type CreatorControlConfig,
  DEFAULT_CREATOR_CONTROLS,
  type VestingConfig,
} from './types';

// ─── Validation ──────────────────────────────────────────────────────────

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
 * Validate creator control configuration.
 * Returns errors (must fix) and warnings (should consider).
 */
export function validateCreatorControls(controls: CreatorControlConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Creator allocation: 5-20%
  if (controls.creatorAllocationBps < 500 || controls.creatorAllocationBps > 2000) {
    errors.push({
      field: 'creatorAllocationBps',
      message: 'Creator allocation must be between 5% and 20%',
      value: controls.creatorAllocationBps,
      min: 500,
      max: 2000,
    });
  }

  // Liquidity allocation: 50-80%
  if (controls.liquidityAllocationBps < 5000 || controls.liquidityAllocationBps > 8000) {
    errors.push({
      field: 'liquidityAllocationBps',
      message: 'Liquidity allocation must be between 50% and 80%',
      value: controls.liquidityAllocationBps,
      min: 5000,
      max: 8000,
    });
  }

  // Community allocation: 10-30%
  if (controls.communityAllocationBps < 1000 || controls.communityAllocationBps > 3000) {
    errors.push({
      field: 'communityAllocationBps',
      message: 'Community allocation must be between 10% and 30%',
      value: controls.communityAllocationBps,
      min: 1000,
      max: 3000,
    });
  }

  // Treasury allocation: 5-10%
  if (controls.treasuryAllocationBps < 500 || controls.treasuryAllocationBps > 1000) {
    errors.push({
      field: 'treasuryAllocationBps',
      message: 'Treasury allocation must be between 5% and 10%',
      value: controls.treasuryAllocationBps,
      min: 500,
      max: 1000,
    });
  }

  // All allocations must sum to ~100%
  const totalAllocation =
    controls.creatorAllocationBps +
    controls.liquidityAllocationBps +
    controls.communityAllocationBps +
    controls.treasuryAllocationBps;

  if (totalAllocation < 9500 || totalAllocation > 10500) {
    errors.push({
      field: 'totalAllocation',
      message: `Allocations must sum to ~100% (currently ${(totalAllocation / 100).toFixed(1)}%)`,
      value: totalAllocation,
      min: 9500,
      max: 10500,
    });
  }

  // Vesting validation
  if (controls.vesting.duration < 30 * 24 * 60 * 60) {
    // less than 30 days
    warnings.push('Vesting duration less than 30 days is not recommended for investor confidence.');
  }
  if (controls.vesting.duration > 365 * 24 * 60 * 60) {
    // more than 1 year
    warnings.push('Vesting duration over 1 year may be too restrictive.');
  }

  if (controls.vesting.initialUnlockBps > 2000) {
    errors.push({
      field: 'vesting.initialUnlockBps',
      message: 'Initial unlock cannot exceed 20%',
      value: controls.vesting.initialUnlockBps,
      max: 2000,
    });
  }

  // Transfer restrictions
  if (controls.restrictTransfersDuringBonding && controls.lockLiquidity) {
    // This is a reasonable combination, but warn if not using both
  }

  // Platform fee
  if (controls.platformFeeBps < 0 || controls.platformFeeBps > 200) {
    errors.push({
      field: 'platformFeeBps',
      message: 'Platform fee must be between 0 and 200 bps (0-2%)',
      value: controls.platformFeeBps,
      min: 0,
      max: 200,
    });
  }

  // Liquidity lock
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

// ─── Vesting Calculator ──────────────────────────────────────────────────

export interface VestingSchedule {
  totalAllocation: bigint;
  initialUnlock: bigint;
  cliffEnd: number;
  vestingEnd: number;
  stages: VestingStage[];
}

export interface VestingStage {
  timestamp: number;
  cumulativeUnlockBps: number;
  cumulativeUnlockFormatted: string;
  unlockAmount: bigint;
}

/**
 * Calculate the vesting schedule for a creator's allocation.
 */
export function calculateVestingSchedule(
  totalAllocationWei: bigint,
  vesting: VestingConfig,
  createdAt: number,
): VestingSchedule {
  const initialUnlock = (totalAllocationWei * BigInt(vesting.initialUnlockBps)) / 10_000n;
  const cliffEnd = createdAt + vesting.cliffDuration;
  const vestingEnd = cliffEnd + vesting.duration;

  const stages: VestingStage[] = [];

  if (vesting.type === 'staged' && vesting.stages && vesting.stages.length > 0) {
    // Staged vesting: predefined unlock points
    for (const stage of vesting.stages) {
      const stageTime = createdAt + stage.timeSeconds;
      const stageUnlock = (totalAllocationWei * BigInt(stage.unlockBps)) / 10_000n;
      stages.push({
        timestamp: stageTime,
        cumulativeUnlockBps: stage.unlockBps,
        cumulativeUnlockFormatted: `${(stage.unlockBps / 100).toFixed(2)}%`,
        unlockAmount:
          stageUnlock -
          (stages.length > 0 ? stages[stages.length - 1]?.unlockAmount : initialUnlock),
      });
    }
  } else {
    // Linear vesting: generate monthly milestones
    const totalVesting = totalAllocationWei - initialUnlock;
    const monthlyBps = 10000 / Math.max(1, Math.floor(vesting.duration / (30 * 24 * 60 * 60)));

    for (let month = 1; month <= Math.ceil(vesting.duration / (30 * 24 * 60 * 60)); month++) {
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
  };
}

/**
 * Calculate claimable amount at a given timestamp.
 */
export function calculateClaimableAmount(
  schedule: VestingSchedule,
  currentTimestamp: number,
  alreadyClaimed: bigint,
): bigint {
  if (currentTimestamp < schedule.cliffEnd) return 0n;

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
  return claimable > 0n ? claimable : 0n;
}

// ─── Allocation Calculator ──────────────────────────────────────────────

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
  };
  community: {
    amount: bigint;
    percent: number;
  };
  treasury: {
    amount: bigint;
    percent: number;
  };
  bondingCurve: {
    amount: bigint;
    percent: number;
  };
}

/**
 * Calculate the full allocation breakdown for a creator coin.
 */
export function calculateAllocations(
  totalSupply: bigint,
  controls: CreatorControlConfig,
  createdAt: number,
): AllocationBreakdown {
  const creatorAmount = (totalSupply * BigInt(controls.creatorAllocationBps)) / 10_000n;
  const liquidityAmount = (totalSupply * BigInt(controls.liquidityAllocationBps)) / 10_000n;
  const communityAmount = (totalSupply * BigInt(controls.communityAllocationBps)) / 10_000n;
  const treasuryAmount = (totalSupply * BigInt(controls.treasuryAllocationBps)) / 10_000n;

  const allocated = creatorAmount + liquidityAmount + communityAmount + treasuryAmount;
  const bondingCurveAmount = totalSupply - allocated;

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
  };
}

// ─── Transfer Restrictions ──────────────────────────────────────────────

export type TransferRestrictionLevel = 'none' | 'bonding_only' | 'always';

/**
 * Check if transfers are allowed based on the bonding curve state and config.
 */
export function areTransfersAllowed(
  controls: CreatorControlConfig,
  isGraduated: boolean,
  restrictionLevel: TransferRestrictionLevel,
): boolean {
  if (restrictionLevel === 'always') return false;
  if (restrictionLevel === 'none') return true;

  // 'bonding_only': restricted during bonding phase
  if (controls.restrictTransfersDuringBonding && !isGraduated) {
    return false;
  }

  return true;
}

// ─── Burn Mechanism ─────────────────────────────────────────────────────

export interface BurnResult {
  amountBurned: bigint;
  remainingUnburned: bigint;
  newTotalSupply: bigint;
  percentBurned: number;
}

/**
 * Calculate the results of burning unsold tokens.
 */
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

// ─── Config Builder ─────────────────────────────────────────────────────

/**
 * Build a complete CreatorCoinConfig with defaults for unset creator control values.
 */
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
  };

  // Backwards compatibility: if creatorAllocationBps was set on base config
  // but no creator controls were provided, use the base value for allocation
  if (!controls && base.creatorAllocationBps > 0) {
    mergedControls.creatorAllocationBps = base.creatorAllocationBps;
  }

  return {
    ...base,
    creatorControls: mergedControls,
    // Sync legacy field to match
    creatorAllocationBps: mergedControls.creatorAllocationBps,
  };
}

// ─── On-Chain Code Generator ────────────────────────────────────────────

/**
 * Generate Solidity code for creator controls.
 * Embed this in the DegenFeedCoin contract upgrade.
 */
export function generateOnChainCreatorControlsCode(
  controls: CreatorControlConfig,
  _createdAt: number,
): string {
  return `
  // ── Creator Coin 2.0: Creator Controls ───────────────────────────────
  // Generated: ${new Date().toISOString()}

  // Allocation constants (bps)
  uint256 public constant CREATOR_ALLOCATION_BPS = ${controls.creatorAllocationBps};
  uint256 public constant LIQUIDITY_ALLOCATION_BPS = ${controls.liquidityAllocationBps};
  uint256 public constant COMMUNITY_ALLOCATION_BPS = ${controls.communityAllocationBps};
  uint256 public constant TREASURY_ALLOCATION_BPS = ${controls.treasuryAllocationBps};

  // Vesting
  uint256 public constant VESTING_DURATION = ${controls.vesting.duration};
  uint256 public constant VESTING_CLIFF = ${controls.vesting.cliffDuration};
  uint256 public constant INITIAL_UNLOCK_BPS = ${controls.vesting.initialUnlockBps};

  // Transfer restrictions
  bool public constant RESTRICT_TRANSFERS = ${controls.restrictTransfersDuringBonding ? 'true' : 'false'};

  // Liquidity lock
  bool public constant LOCK_LIQUIDITY = ${controls.lockLiquidity ? 'true' : 'false'};
  uint256 public constant LIQUIDITY_LOCK_DURATION = ${controls.liquidityLockDuration};

  // Modifier: enforce transfer restrictions
  modifier checkTransferRestrictions() {
    if (RESTRICT_TRANSFERS && !graduated) {
      revert("Transfers restricted during bonding");
    }
    _;
  }

  // Override transfer functions
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

  // Burn unsold tokens on graduation
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
  `;
}

// ─── Fee Calculation Integration ────────────────────────────────────────

/**
 * Calculate platform fee based on creator's configuration.
 */
export function calculatePlatformFee(amount: bigint, controls: CreatorControlConfig): bigint {
  return (amount * BigInt(controls.platformFeeBps)) / 10_000n;
}
