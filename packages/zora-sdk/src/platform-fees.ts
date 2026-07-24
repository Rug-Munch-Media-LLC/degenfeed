/**
 * DegenFeed Platform Fee Collection
 *
 * On EVERY tip/trade/reward on our platform, take 0.5%.
 *
 * ## Fee Model (forked from Zora, better)
 * - 0.5% platform fee (replaces Zora's 0.3% platform + 0.05% protocol)
 * - Creator sets 0-2% additional fee
 * - 0-0.05% trade referrer fee
 *
 * ## Collection Mechanism
 * - Fees are collected automatically on every trade through our system
 * - On-chain: fees are split at the smart contract level via Uniswap V4 hooks
 * - Off-chain: fees on tips/rewards are collected via transfer to platform treasury
 *
 * ## Platform Treasury
 * - 0.5% on ALL tips (ETH and tokens) sent through our platform
 * - 0.5% on ALL rewards distributed through our platform
 * - Collected to DegenFeed platform treasury address
 */
import { type Address, formatEther } from 'viem';

// ═════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════

/** Platform fee in basis points (50 bps = 0.5%). */
export const PLATFORM_FEE_BPS = 50;

/** @deprecated Use PLATFORM_FEE_BPS */
export const DEGENFEED_PLATFORM_FEE_BPS = PLATFORM_FEE_BPS;

/** The DegenFeed platform treasury address. */
export const PLATFORM_TREASURY = '0xD3ADFEED00000000000000000000000000000000' as const;

/** Maximum platform fee allowed (100 bps = 1%). Safety limit. */
export const MAX_PLATFORM_FEE_BPS = 100;

/** Maximum creator fee allowed (200 bps = 2%). */
export const MAX_CREATOR_FEE_BPS = 200;

/** Denominator for basis point calculations. */
const BPS_DENOMINATOR = 10_000n;

// ═════════════════════════════════════════════════════════════════════════
// Fee Calculation
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calculate the platform fee for a given amount.
 *
 * @param amount The total amount in smallest unit (wei, lamports, etc.)
 * @param feeBps Fee in basis points (defaults to 50 = 0.5%)
 * @returns The fee amount in the same unit as input
 */
export function calculateFee(amount: bigint, feeBps: number = PLATFORM_FEE_BPS): bigint {
  return (amount * BigInt(feeBps)) / BPS_DENOMINATOR;
}

/**
 * Collect the platform fee from a given amount.
 *
 * Returns the fee amount that should be transferred to the platform treasury.
 * The remaining (amount - fee) goes to the intended recipient.
 *
 * @param amount The total amount in smallest unit
 * @param recipient The intended recipient address (not modified, informational)
 * @param feeBps Fee in basis points (defaults to 50 = 0.5%)
 * @returns The fee amount to transfer to platform treasury
 */
export async function collectPlatformFee(
  amount: bigint,
  _recipient?: Address,
  feeBps: number = PLATFORM_FEE_BPS,
): Promise<bigint> {
  // Validate fee bounds
  if (feeBps < 0 || feeBps > MAX_PLATFORM_FEE_BPS) {
    throw new Error(`Platform fee ${feeBps} bps out of range (0-${MAX_PLATFORM_FEE_BPS})`);
  }

  const fee = calculateFee(amount, feeBps);

  // In production, this would trigger an on-chain transfer:
  //   - For ETH: transfer fee from the payment to PLATFORM_TREASURY
  //   - For ERC-20: transfer fee tokens to PLATFORM_TREASURY
  //   - For Solana SPL: transfer fee lamports to PLATFORM_TREASURY
  //
  // Currently, fee collection is handled at the smart contract level
  // via our Uniswap V4 hooks and Anchor program instructions.

  return fee;
}

// ═════════════════════════════════════════════════════════════════════════
// Fee Splitting (for trade fees)
// ═════════════════════════════════════════════════════════════════════════

export interface FeeSplit {
  /** Platform fee amount */
  platform: bigint;
  /** Creator fee amount (if applicable) */
  creator: bigint;
  /** Trade referrer fee amount (if applicable) */
  referrer: bigint;
  /** Net amount after all fees */
  net: bigint;
}

/**
 * Calculate the full fee split for a trade.
 *
 * On every trade through our platform:
 *   - Platform: 0.5% (50 bps)
 *   - Creator: 0-2% (0-200 bps, set by creator) — only on buy trades
 *   - Trade referrer: 0-0.05% (0-5 bps)
 *
 * @param amount Total trade amount in smallest unit
 * @param creatorFeeBps Creator fee in bps (0-200)
 * @param referrerFeeBps Trade referrer fee in bps (0-5)
 * @returns FeeSplit with all fee components
 */
export function calculateFeeSplit(
  amount: bigint,
  creatorFeeBps: number = 0,
  referrerFeeBps: number = 0,
): FeeSplit {
  // Validate bounds
  if (creatorFeeBps > MAX_CREATOR_FEE_BPS) {
    throw new Error(`Creator fee ${creatorFeeBps} bps exceeds max ${MAX_CREATOR_FEE_BPS}`);
  }

  const platform = calculateFee(amount, PLATFORM_FEE_BPS);
  const creator = calculateFee(amount, creatorFeeBps);
  const referrer = calculateFee(amount, referrerFeeBps);
  const totalFees = platform + creator + referrer;
  const net = amount > totalFees ? amount - totalFees : 0n;

  return { platform, creator, referrer, net };
}

// ═════════════════════════════════════════════════════════════════════════
// Vesting Fee Adjudication
// ═════════════════════════════════════════════════════════════════════════

/**
 * Calculate the platform's share of a creator's vested token allocation.
 *
 * On our platform, 0.5% of ALL tips/rewards goes to the platform.
 * This includes creator tips that vest over time.
 *
 * @param vestedAmount Total vested amount in smallest unit
 * @returns Platform fee on vested amount
 */
export function calculateVestingPlatformFee(vestedAmount: bigint): bigint {
  return calculateFee(vestedAmount, PLATFORM_FEE_BPS);
}

// ═════════════════════════════════════════════════════════════════════════
// Fee Display Helpers
// ═════════════════════════════════════════════════════════════════════════

/**
 * Format basis points as a human-readable percentage string.
 *
 * @param bps Basis points (e.g., 50 = 0.5%)
 * @returns Percentage string (e.g., "0.5%")
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Calculate the platform fee for a given ETH amount.
 * All fees are collected in ETH — never ZORA.
 *
 * @param amountInEth The total amount in wei
 * @returns The fee amount in wei
 */
export function calculateFeeInEth(amountInEth: bigint): bigint {
  return calculateFee(amountInEth, PLATFORM_FEE_BPS);
}

/**
 * Format a fee amount as a human-readable ETH string.
 * All fees are denominated in ETH — never ZORA.
 *
 * @param amountInEth The fee amount in wei
 * @returns Formatted string like "0.005 ETH (0.5%)"
 */
export function formatFee(amountInEth: bigint): string {
  return `${formatEther(calculateFee(amountInEth))} ETH (${formatBps(PLATFORM_FEE_BPS)})`;
}
