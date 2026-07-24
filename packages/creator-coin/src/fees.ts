/**
 * Creator Coin — Fee Calculations
 *
 * Unified fee structure across both chains.
 * All fees collected in native currency (SOL or ETH).
 */

import type { FeeStructure } from './types';
import { DEFAULT_FEES } from './types';

/**
 * Calculate the fee split for a trade.
 * Returns amounts for platform, creator, and referrer.
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

/**
 * Format fee display string.
 */
export function formatFee(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Generate a human-readable fee summary.
 */
export function getFeeSummary(fees: FeeStructure = DEFAULT_FEES): string[] {
  return [
    `Platform fee: ${formatFee(fees.platformFeeBps)}`,
    `Creator fee: ${formatFee(fees.creatorFeeBps)}`,
    `Referral fee: ${formatFee(fees.referralFeeBps)}`,
    `Max total: ${formatFee(fees.maxTotalFeeBps)}`,
  ];
}

/**
 * Token generation fee (one-time, paid by creator).
 */
export const TOKEN_GENERATION_FEE = {
  usd: 20,
  sol: 0.005,
  eth: 0.001,
};

/**
 * Deployment cost estimate for creating a creator coin.
 */
export function getDeploymentCost(chain: 'solana' | 'base'): {
  tokenGeneration: { amount: number; currency: string };
  gas: { amount: number; currency: string };
  total: { amount: number; currency: string };
} {
  if (chain === 'solana') {
    return {
      tokenGeneration: { amount: TOKEN_GENERATION_FEE.usd, currency: 'USD' },
      gas: { amount: TOKEN_GENERATION_FEE.sol, currency: 'SOL' },
      total: { amount: TOKEN_GENERATION_FEE.usd + 1, currency: 'USD' },
    };
  }
  return {
    tokenGeneration: { amount: TOKEN_GENERATION_FEE.usd, currency: 'USD' },
    gas: { amount: TOKEN_GENERATION_FEE.eth, currency: 'ETH' },
    total: { amount: TOKEN_GENERATION_FEE.usd + 3, currency: 'USD' },
  };
}
