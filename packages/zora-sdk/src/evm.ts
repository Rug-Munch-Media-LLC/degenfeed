/**
 * DegenFeed Creator Token — EVM Contract Client (Zora-style)
 *
 * Client for interacting with Zora/Base creator coin contracts on EVM chains.
 * Uses viem for wallet interactions.
 *
 * ## Quick Start
 * ```ts
 * import { EvmCreatorTokenClient } from '@degenfeed/zora-sdk/evm';
 *
 * const client = new EvmCreatorTokenClient(walletClient);
 * const result = await client.createToken({ ... });
 * ```
 */

import {
  type Account,
  type Chain,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
  getContract,
  parseEther,
} from 'viem';
import type {
  EvmTokenInput,
  EvmBuyInput,
  TradeResult,
  TokenInfo,
  VestedClaimResult,
} from './types';

// ─── Zora Creator Coin ABI (minimal subset) ────────────────────────────────
// Full ABI should be imported from the Zora protocol package.
// This covers the essential methods for creator token interaction.

const ZORA_CREATOR_COIN_ABI = [
  // ── Read ──
  {
    type: 'function' as const,
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  // ── Write ──
  {
    type: 'function' as const,
    name: 'purchase',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'minAmount', type: 'uint256' },
    ],
    outputs: [{ name: 'amount', type: 'uint256' }],
    stateMutability: 'payable' as const,
  },
  {
    type: 'function' as const,
    name: 'sell',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'minEth', type: 'uint256' },
    ],
    outputs: [{ name: 'ethOut', type: 'uint256' }],
    stateMutability: 'nonpayable' as const,
  },
  // ── Events ──
  {
    type: 'event' as const,
    name: 'Purchased',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'comment', type: 'string', indexed: false },
    ],
  },
] as const;

// ─── EVM Client ─────────────────────────────────────────────────────────────

export class EvmCreatorTokenClient {
  private walletClient: WalletClient<HttpTransport, Chain, Account>;
  private publicClient: PublicClient<HttpTransport, Chain>;

  constructor(
    walletClient: WalletClient<HttpTransport, Chain, Account>,
    publicClient: PublicClient<HttpTransport, Chain>,
  ) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
  }

  /**
   * Create a new creator token on an EVM chain (Zora/Base protocol).
   */
  async createToken(opts: EvmTokenInput): Promise<{ contractAddress: string; signature: string }> {
    // Zora's CreatorCoin protocol uses a factory pattern.
    // This would typically call the ZoraFactory to deploy a new coin.
    // For now, this is a placeholder that will be filled with the actual
    // Zora protocol integration.
    throw new Error(
      'EVM createToken not yet implemented. ' +
        'Deploy via ZoraFactory.createToken() on Base mainnet.',
    );
  }

  /**
   * Buy tokens with ETH via the bonding curve.
   */
  async buyTokens(opts: EvmBuyInput): Promise<TradeResult> {
    const contract = getContract({
      address: opts.contractAddress,
      abi: ZORA_CREATOR_COIN_ABI,
      client: this.walletClient,
    });

    const hash = await contract.write.purchase(
      [this.walletClient.account.address, opts.minTokensOut],
      { value: opts.amountWei },
    );

    return {
      signature: hash,
      amount: opts.minTokensOut.toString(),
      explorerUrl: `https://basescan.org/tx/${hash}`,
    };
  }

  /**
   * Sell tokens back to the bonding curve.
   */
  async sellTokens(
    contractAddress: `0x${string}`,
    amountTokens: bigint,
    minEth: bigint,
  ): Promise<TradeResult> {
    const contract = getContract({
      address: contractAddress,
      abi: ZORA_CREATOR_COIN_ABI,
      client: this.walletClient,
    });

    const hash = await contract.write.sell([amountTokens, minEth]);

    return {
      signature: hash,
      amount: amountTokens.toString(),
      explorerUrl: `https://basescan.org/tx/${hash}`,
    };
  }

  /**
   * Get token info from an EVM creator coin contract.
   */
  async getTokenInfo(contractAddress: `0x${string}`): Promise<TokenInfo> {
    const contract = getContract({
      address: contractAddress,
      abi: ZORA_CREATOR_COIN_ABI,
      client: this.publicClient,
    });

    const [name, symbol, totalSupply] = await Promise.all([
      contract.read.name(),
      contract.read.symbol(),
      contract.read.totalSupply(),
    ]);

    return {
      address: contractAddress,
      name,
      symbol,
      price: '0', // Would need curve calculation
      totalSupply: totalSupply.toString(),
      totalRaised: '0',
      uniqueBuyers: 0,
      graduated: false,
      decimals: 18,
      chain: 'base',
    };
  }
}
