/**
 * DegenFeed Creator Token SDK
 *
 * Unified SDK for creating and trading creator tokens across chains.
 * - **Solana**: Custom Anchor program with bonding curve
 * - **EVM** (Base, Optimism, Arbitrum): Zora/Base creator coin protocol
 *
 * ## Usage
 * ```ts
 * import { CreatorTokenSDK } from '@degenfeed/zora-sdk';
 *
 * // Solana
 * const solResult = await sdk.createToken({
 *   chain: 'solana',
 *   name: 'My Coin',
 *   symbol: 'MYC',
 *   uri: 'https://arweave.net/...',
 *   creatorAllocationBps: 500,
 *   creatorFeeBps: 100,
 * });
 *
 * // EVM (when implemented)
 * const evmResult = await sdk.createToken({
 *   chain: 'base',
 *   name: 'My Coin',
 *   symbol: 'MYC',
 *   uri: 'https://arweave.net/...',
 *   creatorAllocationBps: 500,
 *   creatorFeeBps: 100,
 * });
 * ```
 */

// ─── Solana exports ─────────────────────────────────────────────────────────
export {
  SolanaCreatorTokenSDK,
  deriveTokenState,
  deriveTokenMint,
  deriveMintAuthority,
  deriveTokenVault,
  deriveBuyerState,
  deriveVestingVault,
  deriveRecipientState,
  derivePlatformFeeVault,
  PROGRAM_ID,
} from './solana';

// ─── EVM exports ────────────────────────────────────────────────────────────
export { EvmCreatorTokenClient } from './evm';

// ─── Types ──────────────────────────────────────────────────────────────────
export type * from './types';

// ─── Cross-Chain Registry ────────────────────────────────────────────────────
export { CrossChainRegistry, createCrossChainRegistry } from './cross-chain/registry';
export type {
  CrossChainMapping,
  CrossChainToken,
  UnifiedCreatorProfile,
  KVStore,
} from './cross-chain/registry';

// ─── Bonding Curve Math (for frontend previews) ─────────────────────────────

/**
 * Calculate the expected token price at a given supply level.
 * Mirrors the Solana program's `get_current_price`.
 *
 * @param totalSupplyIssued - Current supply issued (9 decimal precision)
 * @returns Price per token unit in lamports
 */
export function getCurrentPrice(totalSupplyIssued: bigint): bigint {
  const TOTAL_SUPPLY = 1_000_000_000_000_000_000n;
  const GRADUATION_SUPPLY = 800_000_000_000_000_000n;
  const MIN_PRICE = 1n;
  const MAX_PRICE = 1_000n;
  const SCALING = 1_000_000_000n;

  const capped = totalSupplyIssued < GRADUATION_SUPPLY ? totalSupplyIssued : GRADUATION_SUPPLY;
  const progress = (capped * SCALING) / GRADUATION_SUPPLY;
  const priceRange = MAX_PRICE - MIN_PRICE;
  return MIN_PRICE + (priceRange * progress) / SCALING;
}

/**
 * Calculate expected tokens out for a given SOL amount and price.
 * Mirrors the Solana program's `calculate_tokens_out`.
 *
 * @param amountSol - SOL amount in lamports
 * @param price - Current price per token unit in lamports
 * @returns Expected tokens out (9 decimal precision)
 */
export function calculateTokensOut(amountSol: bigint, price: bigint): bigint {
  const SCALING = 1_000_000_000n;
  if (price === 0n) return 0n;
  return (amountSol * SCALING) / price;
}

/**
 * Calculate expected SOL out for a given token amount and price.
 * Includes 0.5% platform fee deduction.
 *
 * @param tokensIn - Token amount to sell (9 decimal precision)
 * @param price - Current price per token unit in lamports
 * @returns Object with netSolOut and platformFee
 */
export function calculateSolOut(
  tokensIn: bigint,
  price: bigint,
): { netSolOut: bigint; platformFee: bigint } {
  const SCALING = 1_000_000_000n;
  if (price === 0n) return { netSolOut: 0n, platformFee: 0n };

  const grossSol = (tokensIn * price) / SCALING;
  const platformFee = (grossSol * 50n) / 10_000n; // 0.5%
  const netSolOut = grossSol - platformFee;

  return { netSolOut, platformFee };
}

/**
 * Get the anti-snipe phase limit.
 *
 * @param elapsedSeconds - Seconds since token creation
 * @returns Maximum buy amount in bps (e.g., 200 = 2%)
 */
export function getPhaseLimit(elapsedSeconds: number): number {
  if (elapsedSeconds < 300) return 200;       // 2% — first 5 min
  if (elapsedSeconds < 1_800) return 500;     // 5% — 5-30 min
  if (elapsedSeconds < 86_400) return 1_000;   // 10% — 30 min to 24h
  return 1_500;                                // 15% — after 24h
}

/**
 * Compute the maximum buy amount in lamports for the current phase.
 */
export function getPhaseMaxBuy(elapsedSeconds: number): bigint {
  const GRADUATION_SUPPLY = 800_000_000_000_000_000n;
  const limitBps = getPhaseLimit(elapsedSeconds);
  return (GRADUATION_SUPPLY * BigInt(limitBps)) / 10_000n;
}
