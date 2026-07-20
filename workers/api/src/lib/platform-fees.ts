/**
 * @degenfeed/api-worker — Platform Fee Configuration
 *
 * DegenFeed charges a flat 0.5% fee on all creator revenue events:
 * - Tips (any protocol)
 * - Creator coin trades (buys)
 * - Stream tips
 * - Live short tips
 * - Community tips
 * - NFT mints (first-party)
 * - Subscription payments
 *
 * The fee is always disclosed before the transaction. Creators can see
 * exactly how much we take on every event. No hidden fees, no surprises.
 */

export const PLATFORM_FEE_BPS = 50; // 0.5% — always transparent

/**
 * Revenue event types where the platform fee applies.
 * Each event includes a human-readable label for disclosure UIs.
 */
export const FEE_EVENTS = [
  { type: 'tip', label: 'Tips', description: 'Cross-platform tips' },
  {
    type: 'coin_trade',
    label: 'Creator Coin Trades',
    description: 'Creator coin buy/sell transactions',
  },
  {
    type: 'stream_tip',
    label: 'Stream Tips',
    description: 'Live stream tips and donations',
  },
  {
    type: 'short_tip',
    label: 'Short Tips',
    description: 'Live short video tips',
  },
  {
    type: 'community_tip',
    label: 'Community Tips',
    description: 'Token community tips',
  },
  {
    type: 'nft_mint',
    label: 'NFT Mints',
    description: 'First-party NFT minting fees',
  },
  {
    type: 'subscription',
    label: 'Subscriptions',
    description: 'Creator subscription payments',
  },
] as const;

/**
 * Collect the platform fee from a given revenue amount.
 * Fee = amount * 0.5% (PLATFORM_FEE_BPS / 10000).
 *
 * @param amount - The gross revenue amount in smallest units (wei, lamports, etc.)
 * @returns The platform fee in the same denomination
 */
export function collectTipFee(amount: bigint): bigint {
  return (amount * BigInt(PLATFORM_FEE_BPS)) / BigInt(10000);
}

/**
 * Calculate the net amount after platform fee.
 * Use this to show creators what they'll actually receive.
 *
 * @param amount - Gross amount in smallest units
 * @returns Net amount after fee deduction
 */
export function calculateNetAmount(amount: bigint): bigint {
  return amount - collectTipFee(amount);
}

/**
 * Format the platform fee as a human-readable percentage string.
 */
export function platformFeePercentage(): string {
  return `${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`;
}

/**
 * Generate a disclosure string for UI display.
 * e.g. "DegenFeed charges a 0.50% platform fee on all tips and trades."
 */
export function platformFeeDisclosure(): string {
  return `DegenFeed charges a ${platformFeePercentage()} platform fee on all tips and trades. This fee is always transparent — you see exactly what we take before any transaction.`;
}
