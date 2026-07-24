/**
 * Zora Free Creator Coin — Gas-Efficient Coin Creation
 *
 * ## How It Works
 * Zora's 2026 Coins Protocol deploys ERC-20z tokens on Base via ZoraFactory.
 * While on-chain gas is required for deployment, this module minimizes costs:
 *
 * 1. **`createCoinCall()`** — Returns raw tx calldata with `value: 0n`.
 *    The creator does NOT need to send ETH alongside the tx — only L2 gas (~$0.02-0.10 on Base).
 * 2. **No ETH required** — The coin pairs against ETH but creation itself only needs gas.
 * 3. **Batch-mode optional** — Multiple creations can be sequenced.
 *
 * ⚠️ LIMITATION: Zora does NOT offer fully sponsored gas for coin creation
 * (unlike 1155 premints which ARE gasless for the creator).
 * Gas cost on Base L2 is minimal (~$0.02-0.10) compared to L1.
 *
 * ## Usage
 * ```ts
 * import { prepareZoraCoinCreation, estimateZoraCoinGas } from './zora-free';
 *
 * // Prepare a coin creation (get raw tx data)
 * const { calls, predictedCoinAddress } = await prepareZoraCoinCreation({
 *   creator: '0x...',
 *   name: 'My Coin',
 *   symbol: 'MYCOIN',
 *   uri: 'ipfs://...',
 * });
 *
 * // Estimate gas before sending
 * const gasEstimate = await estimateZoraCoinGas(calls);
 * console.log(`Estimated gas: ${gasEstimate} wei`);
 *
 * // Then send via any wallet or relayer
 * ```
 *
 * @module zora-free
 */

import { CreateConstants, createCoinCall } from '@zoralabs/coins-sdk';
import { type Address, createPublicClient, type Hex, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// ─── Constants ─────────────────────────────────────────────────────────────

/** ZoraFactory address on Base mainnet (chain 8453). */
const ZORA_FACTORY_MAINNET = '0x777777751622c0d3258f214F9DF38E35BF45baF3' as const;

/** Base chain ID. */
const BASE_CHAIN_ID = 8453;

/** Base Sepolia chain ID (for testing). */
const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Default gas limit for a coin creation tx (Base L2). */
const DEFAULT_COIN_CREATION_GAS = 350_000n;

/** Default max fee per gas in wei (Base L2: ~0.001 gwei). */
const DEFAULT_MAX_FEE_PER_GAS = 1_000_000n; // 0.001 gwei

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FreeCoinCreationInput {
  /** Creator wallet address */
  creator: Address;
  /** Coin name (e.g. "My Awesome Coin") */
  name: string;
  /** Coin symbol / ticker (e.g. "MYCOIN") */
  symbol: string;
  /** Metadata URI (IPFS or HTTP) */
  uri: string;
  /** Starting market cap tier (LOW = cheaper initial buy, HIGH = anti-snipe) */
  startingMarketCap?: 'LOW' | 'HIGH';
  /** Platform referrer address (optional) */
  platformReferrer?: Address;
  /** Chain to deploy on (default: base mainnet) */
  chain?: 'base' | 'base-sepolia';
  /** Additional owners who can manage the coin */
  additionalOwners?: Address[];
  /** Payout recipient override (defaults to creator) */
  payoutRecipientOverride?: Address;
}

export interface PreparedCoinCreation {
  /** Raw transaction calls (to, data, value) for each step */
  calls: Array<{
    to: Address;
    data: Hex;
    value: bigint;
  }>;
  /** Predicted coin address (deterministic via CREATE2) */
  predictedCoinAddress: Address;
  /** Chain the coin will be deployed on */
  chain: 'base' | 'base-sepolia';
  /** Gas estimate in wei (if estimated) */
  gasEstimateWei?: bigint;
  /** Estimated total cost in ETH */
  estimatedCostEth?: string;
}

export interface GasEstimate {
  /** Gas limit estimate */
  gasLimit: bigint;
  /** Estimated total cost in wei */
  totalCostWei: bigint;
  /** Estimated total cost in ETH (formatted) */
  totalCostEth: string;
  /** Estimated total cost in USD (if ethPriceUsd provided) */
  totalCostUsd?: number;
}

// ─── Helper: RPC ───────────────────────────────────────────────────────────

/**
 * Get a public client for the target chain.
 * Base L2 has very low gas costs (~0.001 gwei).
 */
function getPublicClient(chain: 'base' | 'base-sepolia') {
  const chainConfig = chain === 'base-sepolia' ? baseSepolia : base;
  return createPublicClient({
    chain: chainConfig,
    transport: http(
      chain === 'base-sepolia' ? 'https://sepolia.base.org' : 'https://mainnet.base.org',
    ),
  });
}

// ─── Core: Prepare Coin Creation ───────────────────────────────────────────

/**
 * Prepare a Zora creator coin creation WITHOUT sending the transaction.
 *
 * Uses `createCoinCall()` from @zoralabs/coins-sdk to generate raw calldata.
 * The returned `value` is always `0n` — no ETH needed, just gas.
 *
 * After calling this, you can:
 * 1. Send the tx directly via any wallet (pays ~$0.02-0.10 gas on Base)
 * 2. Submit via a gas relay (EIP-2771 / ERC-4337)
 * 3. Batch with other operations
 *
 * @returns Prepared transaction calls with predicted coin address.
 */
export async function prepareZoraCoinCreation(
  input: FreeCoinCreationInput,
): Promise<PreparedCoinCreation> {
  const chain = input.chain ?? 'base';
  const chainId = chain === 'base-sepolia' ? BASE_SEPOLIA_CHAIN_ID : BASE_CHAIN_ID;

  const result = await createCoinCall({
    creator: input.creator,
    name: input.name,
    symbol: input.symbol,
    metadata: { type: 'RAW_URI' as const, uri: input.uri },
    currency: CreateConstants.ContentCoinCurrencies.ETH,
    chainId,
    startingMarketCap:
      input.startingMarketCap === 'HIGH'
        ? CreateConstants.StartingMarketCaps.HIGH
        : CreateConstants.StartingMarketCaps.LOW,
    platformReferrer: input.platformReferrer,
    additionalOwners: input.additionalOwners,
    payoutRecipientOverride: input.payoutRecipientOverride,
  });

  // Normalize calls to our format
  const rawCalls = result.calls ?? [];
  const calls = rawCalls.map((call: { to: Address; data: Hex; value?: bigint }) => ({
    to: call.to,
    data: call.data,
    value: call.value ?? 0n,
  }));

  return {
    calls,
    predictedCoinAddress:
      result.predictedCoinAddress ?? ('0x0000000000000000000000000000000000000000' as Address),
    chain,
    gasEstimateWei: undefined,
    estimatedCostEth: undefined,
  };
}

// ─── Gas Estimation ─────────────────────────────────────────────────────────

/**
 * Estimate the gas cost for a prepared coin creation.
 * Base L2 gas is typically ~$0.02-0.10 per coin creation.
 *
 * @param calls The prepared transaction calls from `prepareZoraCoinCreation`.
 * @param chain The target chain.
 * @param ethPriceUsd Optional ETH price in USD for fiat estimate.
 * @returns Detailed gas estimate.
 */
export async function estimateZoraCoinGas(
  calls: PreparedCoinCreation['calls'],
  chain: 'base' | 'base-sepolia' = 'base',
  ethPriceUsd?: number,
): Promise<GasEstimate> {
  const publicClient = getPublicClient(chain);

  // Estimate gas limit for each call and sum them
  let totalGasLimit = 0n;
  for (const call of calls) {
    try {
      const gas = (await publicClient.estimateGas({
        to: call.to,
        data: call.data,
        value: call.value,
      })) as bigint;
      totalGasLimit += gas;
    } catch {
      // Fallback: typical coin creation uses ~350k gas on Base L2
      totalGasLimit += DEFAULT_COIN_CREATION_GAS;
    }
  }

  // Get current gas price
  let maxFee: bigint;
  try {
    const gasPrice = await publicClient.getGasPrice();
    maxFee = gasPrice;
  } catch {
    maxFee = DEFAULT_MAX_FEE_PER_GAS;
  }

  const totalCostWei = totalGasLimit * maxFee;
  const totalCostEth = Number(totalCostWei) / 1e18;

  return {
    gasLimit: totalGasLimit,
    totalCostWei,
    totalCostEth: totalCostEth.toFixed(10),
    totalCostUsd: ethPriceUsd ? totalCostEth * ethPriceUsd : undefined,
  };
}

// ─── Gas Relay Support (ERC-4337 / EIP-2771) ──────────────────────────────

/**
 * Encode a prepared coin creation for ERC-4337 UserOp submission.
 * This allows a paymaster/sponsor to cover gas fees.
 *
 * @param prepared The prepared coin creation.
 * @returns ERC-4337 UserOp calldata for bundler submission.
 */
export function encodeForUserOp(prepared: PreparedCoinCreation): {
  target: Address;
  data: Hex;
  value: bigint;
}[] {
  return prepared.calls.map((call) => ({
    target: call.to,
    data: call.data,
    value: call.value,
  }));
}

/**
 * Check if a predicted coin address is already deployed (prevents wasted gas).
 *
 * @param predictedAddress The predicted coin address.
 * @param chain The target chain.
 * @returns True if the coin is already deployed.
 */
export async function isCoinDeployed(
  predictedAddress: Address,
  chain: 'base' | 'base-sepolia' = 'base',
): Promise<boolean> {
  const publicClient = getPublicClient(chain);
  const code = await publicClient.getBytecode({ address: predictedAddress });
  return (code?.length ?? 0) > 0 && code !== '0x';
}

// ─── Utility: Build Zora URL ──────────────────────────────────────────────

/**
 * Build the zora.co URL for a deployed coin.
 * Users can login to zora.co and see their coin at this URL.
 */
export function getZoraCoinUrl(coinAddress: Address): string {
  return `https://zora.co/coin/base:${coinAddress.toLowerCase()}`;
}

/**
 * Build the Basescan URL for the creation transaction.
 */
export function getBasescanTxUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}
