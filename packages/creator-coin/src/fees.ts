/**
 * Creator Coin — Fee Calculations
 *
 * Unified fee structure across all chains.
 * All fees collected in native currency (SOL, ETH, or MATIC).
 *
 * ## Fee Structure (Requirement 1)
 * - Platform fee: 0.5% (50 bps) — FIXED, goes to DegenFeed
 * - Creator fee: 0% to 4.5% (0-450 bps) — creator chooses
 * - Total fee: 0.5% to 5% (50-500 bps)
 * - Fee recipient: creator wallet | DAO treasury | split
 * - All fees visible on-chain
 * - Fee can change via DAO vote if configured
 */

import type { FeeConfig, FeeStructure } from './types';
import { DEFAULT_FEES, FIXED_PLATFORM_FEE_BPS } from './types';

export type { FeeStructure, FeeConfig };
export { DEFAULT_FEES, FIXED_PLATFORM_FEE_BPS };

// ─── Fee Calculation ─────────────────────────────────────────────────────────

export interface FeeSplitResult {
  platformFee: bigint;
  creatorFee: bigint;
  referralFee: bigint;
  total: bigint;
  creatorRecipient: string | null;
  platformRecipient: string;
}

/**
 * Calculate the fee split for a trade using the new FeeConfig.
 * Returns amounts for platform and creator, plus recipient addresses.
 */
export function calculateFeeSplitFromConfig(
  amount: bigint,
  feeConfig: FeeConfig,
  hasReferrer: boolean = false,
): FeeSplitResult {
  const platformFee = (amount * BigInt(feeConfig.platformFeeBps)) / 10_000n;
  const creatorFee = (amount * BigInt(feeConfig.creatorFeeBps)) / 10_000n;
  const referralFee = hasReferrer ? (amount * 5n) / 10_000n : 0n; // 5 bps referral

  const total = platformFee + creatorFee + referralFee;

  // Platform always goes to DegenFeed wallet
  const platformRecipient = process.env.NEXT_PUBLIC_PLATFORM_FEE_WALLET || '';

  // Creator fee routing depends on feeRecipient type
  let creatorRecipient: string | null = null;
  if (feeConfig.feeRecipient === 'creator' && feeConfig.feeWallet) {
    creatorRecipient = feeConfig.feeWallet;
  } else if (feeConfig.feeRecipient === 'dao_treasury') {
    creatorRecipient = null; // Goes to DAO treasury (on-chain)
  } else if (feeConfig.feeRecipient === 'split') {
    // Split handled at contract level
    creatorRecipient = feeConfig.feeWallet ?? null;
  }

  return { platformFee, creatorFee, referralFee, total, creatorRecipient, platformRecipient };
}

/**
 * Calculate the fee split for a trade using legacy FeeStructure.
 */
export function calculateFeeSplit(
  amount: bigint,
  feeStructure: FeeStructure = DEFAULT_FEES,
  hasReferrer: boolean = false,
): { platformFee: bigint; creatorFee: bigint; referralFee: bigint; total: bigint } {
  const { platformFeeBps, creatorFeeBps, referralFeeBps, maxTotalFeeBps } = feeStructure;

  const platformFee = (amount * BigInt(platformFeeBps)) / 10_000n;
  const creatorFee = (amount * BigInt(creatorFeeBps)) / 10_000n;
  const referralFee = hasReferrer ? (amount * BigInt(referralFeeBps)) / 10_000n : 0n;

  const total = platformFee + creatorFee + referralFee;

  if (total > (amount * BigInt(maxTotalFeeBps)) / 10_000n) {
    throw new Error(`Total fees exceed max ${maxTotalFeeBps} bps`);
  }

  return { platformFee, creatorFee, referralFee, total };
}

/**
 * Calculate the net amount after fees (what user receives on sell).
 */
export function calculateNetProceeds(grossAmount: bigint, feeSplit: { total: bigint }): bigint {
  return grossAmount - feeSplit.total;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format fee display string from bps to percentage.
 */
export function formatFee(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Generate a human-readable fee summary from FeeConfig.
 */
export function getFeeSummaryFromConfig(feeConfig: FeeConfig): string[] {
  const lines = [
    `Platform fee: ${formatFee(feeConfig.platformFeeBps)} (fixed, DegenFeed)`,
    `Creator fee: ${formatFee(feeConfig.creatorFeeBps)} → ${formatRecipient(feeConfig.feeRecipient)}`,
    `Total fee: ${formatFee(feeConfig.totalFeeBps)}`,
    `DAO changeable: ${feeConfig.daoChangeable ? 'Yes' : 'No'}`,
  ];

  if (feeConfig.daoChangeable) {
    lines.push(`Change threshold: ${(feeConfig.feeChangeThresholdBps / 100).toFixed(1)}% vote`);
  }

  return lines;
}

function formatRecipient(recipient: string): string {
  const labels: Record<string, string> = {
    creator: 'Creator Wallet',
    dao_treasury: 'DAO Treasury',
    split: 'Split (Creator + Treasury)',
  };
  return labels[recipient] || recipient;
}

/**
 * Generate a human-readable fee summary (legacy interface).
 */
export function getFeeSummary(fees: FeeStructure = DEFAULT_FEES): string[] {
  return [
    `Platform fee: ${formatFee(fees.platformFeeBps)}`,
    `Creator fee: ${formatFee(fees.creatorFeeBps)}`,
    `Referral fee: ${formatFee(fees.referralFeeBps)}`,
    `Max total: ${formatFee(fees.maxTotalFeeBps)}`,
  ];
}

// ─── Token Generation Fee (One-time) ─────────────────────────────────────────

export const TOKEN_GENERATION_FEE = {
  usd: 20,
  sol: 0.005,
  eth: 0.001,
  matic: 0.01,
};

/**
 * Deployment cost estimate for creating a creator coin on any chain.
 */
export function getDeploymentCost(chain: string): {
  tokenGeneration: { amount: number; currency: string };
  gas: { amount: number; currency: string };
  total: { amount: number; currency: string };
} {
  const gasCosts: Record<string, { amount: number; currency: string }> = {
    solana: { amount: TOKEN_GENERATION_FEE.sol, currency: 'SOL' },
    base: { amount: TOKEN_GENERATION_FEE.eth, currency: 'ETH' },
    optimism: { amount: TOKEN_GENERATION_FEE.eth, currency: 'ETH' },
    arbitrum: { amount: TOKEN_GENERATION_FEE.eth, currency: 'ETH' },
    polygon: { amount: TOKEN_GENERATION_FEE.matic, currency: 'MATIC' },
  };

  const gas = gasCosts[chain] || { amount: 0.001, currency: 'ETH' };

  return {
    tokenGeneration: { amount: TOKEN_GENERATION_FEE.usd, currency: 'USD' },
    gas,
    total: { amount: TOKEN_GENERATION_FEE.usd + 5, currency: 'USD' },
  };
}
