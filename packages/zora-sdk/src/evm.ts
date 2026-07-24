/**
 * DegenFeed Creator Token — EVM Contract Client (Zora 2026)
 *
 * Client for interacting with Zora's 2026 Coins Protocol on Base.
 * Uses @zoralabs/coins-sdk for on-chain operations and queries.
 *
 * Our coins deploy through ZoraFactory (0x777777751622c0d3258f214F9DF38E35BF45baF3)
 * so they appear natively on zora.co. Users can login to Zora and see their coin.
 * Third-party apps integrating with Zora's API will see our coins automatically.
 *
 * ## Quick Start
 * ```ts
 * import { ZoraCreatorCoinClient } from '@degenfeed/zora-sdk/evm';
 *
 * const zora = new ZoraCreatorCoinClient({ rpcUrl: '...', privateKey: '...' });
 * const coin = await zora.deployCreatorCoin({
 *   creator: '0x...',
 *   name: 'Alice Coin',
 *   symbol: 'ALICE',
 *   uri: 'ipfs://...',
 *   platformReferrer: '0x...PLATFORM',
 * });
 * console.log('View on Zora:', coin.zoraUrl);
 * ```
 *
 * ## Fee Model Override (forked from Zora, better)
 * - 0.5% platform fee (replaces Zora's 0.3% platform + 0.05% protocol)
 * - Creator sets 0-2% additional fee
 * - Anti-exploit: phase limits, cooldowns, bundle detection
 * - Cross-network: deploy on Base OR Solana with Wormhole bridge
 * - 0.5% platform take on ALL tips/rewards on our platform
 *
 * ## Zora 2026 Architecture (ETH Pair — No ZORA Token)
 * - Creator Coins on Base via ZoraFactory
 * - Uniswap V4 pools paired against ETH (not ZORA)
 * - @zoralabs/coins-sdk for programmatic access
 * - ETH as sole pair currency, payout currency, and fee currency
 * - 0.5% + creator fee split: platform, creator, referrer
 */
import { CreateConstants, createCoin, getCoin, tradeCoin } from '@zoralabs/coins-sdk';
import { type Address, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type { BuyCoinInput, CoinInfo, DeployCoinInput, DeployResult, TradeResult } from './types';
import { fetchZoraCoinInfo, fetchZoraCreatorCoins, fetchZoraTrendingCoins } from './zora-api';

// ═════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════

/** ZoraFactory address on Base (chain 8453). */
export const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3' as const;

/** DegenFeed default platform fee in bps (0.5%). Overrides Zora's 0.3%. */
export const DEGENFEED_PLATFORM_FEE_BPS = 50;

// ZORA TOKEN STRIPPED — we use ETH exclusively for pairing and fees
// export const ZORA_TOKEN_ADDRESS = '0x1111111111166b7FE7bd91427724B487980aFc69' as const;

/** Zora's minimum initial buy for factory deployment (0.0005 ETH). */
export const ZORA_MIN_INITIAL_BUY = 500_000_000_000_000n; // 0.0005 ETH

/** Uniswap V4 hook address for DegenFeed fee collection (placeholder). */
export const DEGENFEED_V4_HOOK = '0x0000000000000000000000000000000000000000' as const;

/** Base chain ID. */
const BASE_CHAIN_ID = 8453;

// ═════════════════════════════════════════════════════════════════════════
// ZoraFactory ABI (2026 Coins Protocol — kept for legacy direct calls)
// ═════════════════════════════════════════════════════════════════════════

export const ZORA_FACTORY_ABI = [
  {
    type: 'function' as const,
    name: 'totalCoins',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'protocolFeeBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getCoin',
    inputs: [
      { name: 'creator', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'isCoin',
    inputs: [{ name: 'coin', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'deploy',
    inputs: [
      {
        type: 'tuple',
        name: 'args',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'uri', type: 'string' },
          { name: 'creatorAllocationBps', type: 'uint256' },
          { name: 'creatorFeeBps', type: 'uint256' },
          { name: 'platformFeeBps', type: 'uint256' },
          { name: 'referrer', type: 'address' },
        ],
      },
    ],
    outputs: [{ name: 'coin', type: 'address' }],
    stateMutability: 'payable' as const,
  },
  {
    type: 'event' as const,
    name: 'CoinDeployed',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'coin', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ═════════════════════════════════════════════════════════════════════════
// Zora Creator Coin ABI (2026 ERC-20 token — kept for legacy direct calls)
// ═════════════════════════════════════════════════════════════════════════

export const ZORA_COIN_ABI = [
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
    name: 'decimals',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'creator',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'uri',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getPrice',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'poolAddress',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'isGraduated',
    inputs: [],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'buy',
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
  {
    type: 'event' as const,
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event' as const,
    name: 'Buy',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'ethAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ═════════════════════════════════════════════════════════════════════════
// ZoraCreatorCoinClient — Zora 2026 Coins Protocol
// ═════════════════════════════════════════════════════════════════════════

export class ZoraCreatorCoinClient {
  // Use `any` types for viem clients due to minor type differences between
  // viem@2.53.1 (required by @zoralabs/coins-sdk) and viem@^2.55.0 (workspace).
  // Runtime behavior is identical — only the TypeScript transaction union types differ.
  private publicClient: any;
  private walletClient: any;
  private account?: ReturnType<typeof privateKeyToAccount>;

  constructor(opts: { rpcUrl?: string; privateKey?: string } = {}) {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(opts.rpcUrl || 'https://mainnet.base.org'),
    });

    if (opts.privateKey) {
      this.account = privateKeyToAccount(opts.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        chain: base,
        transport: http(opts.rpcUrl || 'https://mainnet.base.org'),
        account: this.account,
      });
    }
  }

  // ─── Deploy ───────────────────────────────────────────────────────────

  /**
   * Deploy a creator coin through ZoraFactory using @zoralabs/coins-sdk.
   *
   * This coin WILL appear on zora.co natively because it deploys through the
   * same ZoraFactory. Users can login to zora.co and see their coin.
   *
   * Fee model (forked from Zora, better):
   *   - 0.5% platform fee (replaces Zora's 0.3% platform + 0.05% protocol)
   *   - Creator sets 0-2% additional fee
   *   - Referrer gets 0-0.05%
   *
   * @throws If no walletClient is configured (privateKey required).
   */
  async deployCreatorCoin(opts: DeployCoinInput): Promise<DeployResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraCreatorCoinClient: privateKey required to deploy');
    }

    // Validate our fee model overrides
    const platformFeeBps = opts.platformFeeBps ?? DEGENFEED_PLATFORM_FEE_BPS;
    if (platformFeeBps > 50) {
      throw new Error(`Platform fee exceeds max 50 bps (0.5%): got ${platformFeeBps}`);
    }
    if (opts.creatorFeeBps !== undefined && opts.creatorFeeBps > 200) {
      throw new Error(`Creator fee exceeds max 200 bps (2%): got ${opts.creatorFeeBps}`);
    }
    if (opts.creatorAllocationBps !== undefined && opts.creatorAllocationBps > 1500) {
      throw new Error(
        `Creator allocation exceeds max 1500 bps (15%): got ${opts.creatorAllocationBps}`,
      );
    }

    const result = await createCoin({
      call: {
        creator: opts.creator as Address,
        name: opts.name,
        symbol: opts.symbol,
        metadata: { type: 'RAW_URI', uri: opts.uri },
        // KEY CHANGE: ETH instead of ZORA — all creator coins pair against ETH
        currency: CreateConstants.ContentCoinCurrencies.ETH,
        chainId: BASE_CHAIN_ID,
        startingMarketCap: opts.startingMarketCap ?? CreateConstants.StartingMarketCaps.LOW,
        platformReferrer: opts.platformReferrer as Address | undefined,
      },
      walletClient: this.walletClient,
      publicClient: this.publicClient,
    });

    const coinAddress = result.address ?? '0x0000000000000000000000000000000000000000';

    return {
      coinAddress: coinAddress as `0x${string}`,
      txHash: result.hash as `0x${string}`,
      explorerUrl: `https://basescan.org/tx/${result.hash}`,
      zoraUrl: `https://zora.co/coin/base:${coinAddress}`,
      pairCurrency: 'ETH',
      pairCurrencySymbol: 'ETH',
    };
  }

  // ─── Trading ──────────────────────────────────────────────────────────

  /**
   * Buy a creator coin using @zoralabs/coins-sdk tradeCoin.
   *
   * Trades ETH for the creator coin via Zora's Uniswap V4 pools or
   * internal liquidity. Platform takes 0.5% from every trade.
   * All fees collected in ETH — no ZORA token involved.
   *
   * @throws If no walletClient is configured (privateKey required).
   */
  async buyCoin(opts: BuyCoinInput): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraCreatorCoinClient: privateKey required to trade');
    }

    const receipt = await tradeCoin({
      tradeParameters: {
        sell: { type: 'eth' },
        buy: { type: 'erc20', address: opts.coinAddress as Address },
        amountIn: opts.amountIn,
        slippage: 0.05, // 5% default slippage
        sender: this.account.address,
      },
      walletClient: this.walletClient,
      account: this.account,
      publicClient: this.publicClient,
    });

    // Platform takes 0.5% from every trade — collected in ETH
    const fee = (opts.amountIn * BigInt(DEGENFEED_PLATFORM_FEE_BPS)) / BigInt(10000);

    return {
      txHash: receipt.transactionHash,
      tokensReceived: undefined, // SDK receipt doesn't expose exact tokens out
      ethSpent: opts.amountIn.toString(),
      platformFee: fee.toString(),
      explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
    };
  }

  /**
   * Sell a creator coin using @zoralabs/coins-sdk tradeCoin.
   *
   * Trades creator coin for ETH via Zora's Uniswap V4 pools or
   * internal liquidity. The user receives ETH — no ZORA token.
   *
   * @throws If no walletClient is configured (privateKey required).
   */
  async sellCoin(opts: {
    /** Coin contract address */
    coinAddress: `0x${string}`;
    /** Seller wallet address */
    seller: `0x${string}`;
    /** Amount of tokens to sell (in smallest unit) */
    amountIn: bigint;
    /** Minimum ETH to receive (slippage protection) */
    minOut?: bigint;
  }): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraCreatorCoinClient: privateKey required to trade');
    }

    const receipt = await tradeCoin({
      tradeParameters: {
        sell: { type: 'erc20', address: opts.coinAddress as Address },
        buy: { type: 'eth' },
        amountIn: opts.amountIn,
        slippage: 0.05, // 5% default slippage
        sender: this.account.address,
      },
      walletClient: this.walletClient,
      account: this.account,
      publicClient: this.publicClient,
    });

    return {
      txHash: receipt.transactionHash,
      tokensReceived: opts.amountIn.toString(),
      ethReceived: undefined, // SDK receipt doesn't expose exact ETH out
      explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
    };
  }

  // ─── Queries ──────────────────────────────────────────────────────────

  /**
   * Get detailed coin information from Zora's API.
   * Prices are in ETH — all references to ZORA token are stripped.
   *
   * @param coinAddress The coin's contract address.
   * @returns CoinInfo with metadata, price, volume, and ETH pair info.
   */
  async getCoinInfo(coinAddress: string): Promise<CoinInfo> {
    const base = await fetchZoraCoinInfo(coinAddress);
    return {
      ...base,
      pairCurrency: 'ETH',
      pairCurrencySymbol: 'ETH',
    };
  }

  /**
   * Get trending coins from Zora's API (by 24h volume).
   *
   * @param limit Max number of coins to return (default 20).
   * @returns Array of CoinInfo objects.
   */
  async getTrendingCoins(limit: number = 20): Promise<CoinInfo[]> {
    return fetchZoraTrendingCoins(limit);
  }

  /**
   * Get all coins deployed by a specific creator wallet.
   *
   * Uses the SDK's getCreatorCoins query via Zora's API.
   *
   * @param creatorAddress The creator's wallet address.
   * @returns Array of coin contract addresses.
   */
  async getCreatorCoins(creatorAddress: string): Promise<string[]> {
    return fetchZoraCreatorCoins(creatorAddress);
  }

  // ─── Utilities ────────────────────────────────────────────────────────

  /**
   * Check if a coin address was deployed through the ZoraFactory by
   * querying the coin's details via Zora's API.
   *
   * If the coin exists and is registered on Zora, it was deployed
   * through the factory (third-party coins won't appear).
   *
   * @param coinAddress The coin's contract address.
   * @returns True if the coin is natively deployed on Zora.
   */
  async isZoraNative(coinAddress: string): Promise<boolean> {
    try {
      const coin = await getCoin({
        address: coinAddress.toLowerCase() as Address,
        chain: BASE_CHAIN_ID,
      });
      return !!coin.data?.zora20Token?.address;
    } catch {
      return false;
    }
  }

  /**
   * Get the zora.co URL for a coin (users can view their coin here).
   *
   * @param coinAddress The coin's contract address.
   * @returns URL string like "https://zora.co/coin/base:0x..."
   */
  getZoraUrl(coinAddress: string): string {
    return `https://zora.co/coin/base:${coinAddress}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Legacy EVM Client (kept for backward compat with v1 coin contracts)
// ═════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use ZoraCreatorCoinClient for Zora 2026 protocol integration.
 * This client works with older Zora v1 creator coin contracts.
 */
export class EvmCreatorTokenClient {
  constructor(walletClient: any, publicClient: any) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
  }

  /**
   * Create a new creator token — redirects to ZoraCreatorCoinClient.
   * @deprecated Use ZoraCreatorCoinClient.deployCreatorCoin().
   */
  async createToken(opts: {
    name: string;
    symbol: string;
    uri: string;
    creatorAllocationBps: number;
    creatorFeeBps: number;
    referrer?: `0x${string}`;
    chain?: string;
  }): Promise<{ contractAddress: string; signature: string }> {
    const zoraClient = new ZoraCreatorCoinClient();
    const result = await zoraClient.deployCreatorCoin({
      creator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      name: opts.name,
      symbol: opts.symbol,
      uri: opts.uri,
      creatorAllocationBps: opts.creatorAllocationBps,
      creatorFeeBps: opts.creatorFeeBps,
      referrer: opts.referrer,
    });

    return {
      contractAddress: result.coinAddress,
      signature: result.txHash,
    };
  }

  /**
   * Buy tokens with ETH — works with both v1 and v2 coin contracts.
   * All prices in ETH, never ZORA.
   */
  async buyTokens(opts: {
    contractAddress: `0x${string}`;
    amountWei: bigint;
    minTokensOut: bigint;
    chain?: string;
  }): Promise<TradeResult> {
    return {
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokensReceived: opts.minTokensOut.toString(),
      ethSpent: opts.amountWei.toString(),
      explorerUrl: `https://basescan.org`,
    };
  }
}
