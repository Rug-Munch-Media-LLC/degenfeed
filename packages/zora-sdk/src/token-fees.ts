/**
 * DegenFeed Token Generation Fee ($20)
 *
 * One-time fee charged when a creator deploys a dual-chain coin.
 * Covers the cost of indexing, Wormhole attestation, and Zora registration.
 *
 * ## Fee Model
 * - $20 flat fee (one-time per coin, not per creator)
 * - Payable in SOL (~0.08 SOL at $250) or ETH (~0.006 ETH at $3,300)
 * - Collected BEFORE deployment begins
 * - Tracked by receipt UUID for accounting
 *
 * ## Collection Flow
 * 1. Creator initiates deploy → shown cost breakdown with $20 fee
 * 2. Creator approves payment → fee collected to platform wallet
 * 3. Receipt recorded → deployment proceeds
 * 4. Receipt stored in KV for accounting/refunds
 */
import type { FeePaymentResult, FeePaymentStatus } from './types';

// ═════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════

/** One-time token generation fee in USD. */
export const TOKEN_GENERATION_FEE_USD = 20;

/** Fee in SOL at $250/SOL (overpay buffer). */
export const TOKEN_GENERATION_FEE_SOL = 0.08;

/** Fee in ETH at $3,300/ETH (overpay buffer). */
export const TOKEN_GENERATION_FEE_ETH = 0.006;

/** Platform wallet to receive generation fees (Solana). */
export const PLATFORM_FEE_WALLET_SOLANA = 'D3ADFeed111111111111111111111111111111111111';

/** Platform wallet to receive generation fees (Base/EVM). */
export const PLATFORM_FEE_WALLET_EVM = '0xD3ADFEED00000000000000000000000000000000' as const;

/** Receipt TTL in KV (1 year). */
export const RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 365;

// ═════════════════════════════════════════════════════════════════════════
// Fee Calculation
// ═════════════════════════════════════════════════════════════════════════

/**
 * Get the token generation fee amount in the given currency.
 *
 * @param chain 'solana' → returns SOL amount; 'base' → returns ETH amount
 * @returns Object with amount, currency, and USD equivalent
 */
export function getTokenGenerationFee(chain: 'solana' | 'base'): {
  amount: number;
  currency: string;
  usdEquivalent: number;
} {
  if (chain === 'solana') {
    return {
      amount: TOKEN_GENERATION_FEE_SOL,
      currency: 'SOL',
      usdEquivalent: TOKEN_GENERATION_FEE_USD,
    };
  }
  return {
    amount: TOKEN_GENERATION_FEE_ETH,
    currency: 'ETH',
    usdEquivalent: TOKEN_GENERATION_FEE_USD,
  };
}

/**
 * Verify that a received payment meets the token generation fee threshold.
 *
 * @param amountPaid Amount paid in smallest unit (lamports or wei)
 * @param chain Chain the payment was made on
 * @param solPrice Current SOL/USD price (optional, defaults to $250)
 * @param ethPrice Current ETH/USD price (optional, defaults to $3,300)
 * @returns True if the payment meets or exceeds the $20 threshold
 */
export function verifyTokenGenerationFee(
  amountPaid: bigint,
  chain: 'solana' | 'base',
  solPrice: number = 250,
  ethPrice: number = 3_300,
): boolean {
  if (chain === 'solana') {
    // 1 SOL = 1e9 lamports
    const solAmount = Number(amountPaid) / 1e9;
    const usdValue = solAmount * solPrice;
    return usdValue >= TOKEN_GENERATION_FEE_USD;
  }

  // Base/EVM: 1 ETH = 1e18 wei
  const ethAmount = Number(amountPaid) / 1e18;
  const usdValue = ethAmount * ethPrice;
  return usdValue >= TOKEN_GENERATION_FEE_USD;
}

// ═════════════════════════════════════════════════════════════════════════
// Fee Collection
// ═════════════════════════════════════════════════════════════════════════

/**
 * Collect the one-time token generation fee before deployment.
 *
 * In production, this creates a payment request and waits for confirmation.
 * The creator must send $20 equivalent in SOL or ETH to the platform wallet.
 *
 * @param creator Creator's wallet address
 * @param chain Which chain to collect on
 * @returns FeePaymentResult with receipt ID
 */
export async function collectTokenGenerationFee(
  creator: string,
  chain: 'base' | 'solana',
): Promise<FeePaymentResult> {
  const currency = chain === 'solana' ? 'SOL' : 'ETH';
  const receiptId = generateReceiptId(creator, chain);

  // In production:
  //   1. Create a payment request (on-chain transfer or Stripe checkout)
  //   2. Wait for confirmation
  //   3. Store receipt in KV for accounting
  //
  // The payment flow depends on the frontend context:
  //   - In-wallet: Create a transfer transaction to PLATFORM_FEE_WALLET_*
  //   - Fiat onramp: Redirect to Stripe checkout for $20
  //
  // For now, we simulate a successful collection.

  return {
    paid: true,
    amount: `$${TOKEN_GENERATION_FEE_USD}.00`,
    currency,
    receiptId,
    txHash: undefined, // Set in production after on-chain confirmation
  };
}

/**
 * Generate a unique receipt ID for the token generation fee.
 * Format: `genfee-{chain}-{creator-short}-{timestamp}-{random}`
 */
function generateReceiptId(creator: string, chain: string): string {
  const short = creator.length > 8 ? creator.slice(0, 8) : creator;
  const ts = Date.now().toString(36);
  const rand = crypto.randomUUID().slice(0, 8);
  return `genfee-${chain}-${short}-${ts}-${rand}`;
}

/**
 * Get the status of a token generation fee payment.
 *
 * @param receiptId The receipt ID from collectTokenGenerationFee
 * @returns Current payment status
 */
export async function getFeePaymentStatus(_receiptId: string): Promise<FeePaymentStatus> {
  // In production, look up the receipt in KV and check on-chain status.
  // For now, assume confirmed.
  return 'confirmed';
}
