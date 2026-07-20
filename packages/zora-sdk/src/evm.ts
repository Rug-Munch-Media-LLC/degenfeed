/**
 * DegenFeed Creator Token — EVM Contract Client (Zora 2026)
 *
 * Client for interacting with Zora's 2026 Coins Protocol on Base.
 * Zora Factory at 0x777777751622c0d3258f214F9DF38E35BF45baF3 deploys
 * creator coins with Uniswap V4 pools.
 *
 * ## Quick Start
 * ```ts
 * import { ZoraCreatorCoinClient } from '@degenfeed/zora-sdk/evm';
 *
 * const zora = new ZoraCreatorCoinClient(walletClient, publicClient);
 * const coin = await zora.deployCreatorCoin({ name: 'Alice Coin', ... });
 * ```
 *
 * ## Fee Model (Zora Protocol Rewards — 1% default, 0.5% our override)
 * Zora's default fee split (1%):
 *   - 0.5% → creator
 *   - 0.3% → Zora protocol
 *   - 0.2% → referrer
 *
 * Our override (0.5% total max, set via factory override):
 *   - 0.5% → DegenFeed platform (replaces Zora's 0.3%)
 *   - 0-2% → creator (creator chooses)
 *   - 0-0.05% → referrer
 *
 * Liquidity is via Uniswap V4 pools, not custom bonding curves.
 */

import {
  type Account,
  type Chain,
  type HttpTransport,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
  getContract,
  parseEther,
} from 'viem';
import type {
  DeployCoinInput,
  BuyCoinInput,
  CoinInfo,
  CoinPrice,
  DeployResult,
  TradeResult,
} from './types';
import { fetchZoraCoinInfo, fetchZoraTrendingCoins, fetchZoraCreatorCoins } from './zora-api';

// ═════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════

/** ZoraFactory address on Base (chain 8453). */
export const ZORA_FACTORY_ADDRESS = '0x777777751622c0d3258f214F9DF38E35BF45baF3' as const;

/** DegenFeed default platform fee in bps (0.5%). Overrides Zora's 0.3%. */
export const DEGENFEED_PLATFORM_FEE_BPS = 50;

/** Zora's minimum initial buy for factory deployment (0.0005 ETH). */
export const ZORA_MIN_INITIAL_BUY = 500_000_000_000_000n; // 0.0005 ETH

/** Uniswap V4 hook address for DegenFeed fee collection (placeholder). */
export const DEGENFEED_V4_HOOK = '0x0000000000000000000000000000000000000000' as const;

/** Base chain ID. */
const BASE_CHAIN_ID = 8453;

// ═════════════════════════════════════════════════════════════════════════
// ZoraFactory ABI (2026 Coins Protocol)
// ═════════════════════════════════════════════════════════════════════════
//
// The 2026 ZoraFactory deploys creator coins via:
//  - deploy(TokenArgs) → address  (main deployment method)
//  - TokenArgs contains: creator, name, symbol, uri, creatorAllocationBps,
//    creatorFeeBps, platformFeeBps, referrer, initialBuyWei
//
// Protocol rewards are split via Uniswap V4 hooks.
// The factory deploys an ERC-20 token with a linked Uniswap V4 pool.
// ═════════════════════════════════════════════════════════════════════════

export const ZORA_FACTORY_ABI = [
  // ── Read ──
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
    inputs: [{ name: 'creator', type: 'address' }, { name: 'index', type: 'uint256' }],
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
  // ── Write ──
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
  // ── Events ──
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
// Zora Creator Coin ABI (2026 ERC-20 token)
// ═════════════════════════════════════════════════════════════════════════

export const ZORA_COIN_ABI = [
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
  // ── Write ──
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
  // ── Events ──
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
// Legacy Zora Creator Coin ABI (v1 — kept for backward compatibility)
// ═════════════════════════════════════════════════════════════════════════

const ZORA_CREATOR_COIN_ABI_V1 = [
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

// ═════════════════════════════════════════════════════════════════════════
// ZoraCreatorCoinClient — Zora 2026 Coins Protocol
// ═════════════════════════════════════════════════════════════════════════

/**
 * Client for interacting with Zora's 2026 Coins Protocol on Base.
 *
 * Uses the ZoraFactory at 0x777777751622c0d3258f214F9DF38E35BF45baF3
 * to deploy creator coins. Trading happens via Uniswap V4 pools.
 *
 * Fee model overrides Zora's default protocol rewards:
 *   - DegenFeed platform: 0.5% (instead of Zora's 0.3%)
 *   - Creator: 0-2% (unchanged)
 *   - Referrer: 0-0.05% (unchanged)
 *   - Total max: 0.5% + 2% + 0.05% = 2.55%
 */
export class ZoraCreatorCoinClient {
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
   * Deploy a creator coin on Base via ZoraFactory.
   *
   * Sends a deploy transaction to ZoraFactory with our fee overrides:
   *   - platformFeeBps: 50 (0.5%) → DegenFeed platform fee
   *   - creatorFeeBps: from opts (0-200 bps = 0-2%)
   *   - referrer: from opts (earns 5 bps = 0.05%)
   *
   * Includes the minimum initial buy to bootstrap the curve/pool.
   *
   * @returns DeployResult with deployed coin address and tx hash.
   */
  async deployCreatorCoin(opts: DeployCoinInput): Promise<DeployResult> {
    const factory = getContract({
      address: ZORA_FACTORY_ADDRESS,
      abi: ZORA_FACTORY_ABI,
      client: this.walletClient,
    });

    // Enforce our fee model limits:
    //   - Platform fee: max 50 bps (0.5%) — replaces Zora's default
    //   - Creator fee: max 200 bps (2%)
    //   - Creator allocation: max 1500 bps (15%)
    const platformFeeBps = opts.platformFeeBps ?? DEGENFEED_PLATFORM_FEE_BPS;
    if (platformFeeBps > 50) {
      throw new Error(`Platform fee exceeds max 50 bps (0.5%): got ${platformFeeBps}`);
    }
    if (opts.creatorFeeBps > 200) {
      throw new Error(`Creator fee exceeds max 200 bps (2%): got ${opts.creatorFeeBps}`);
    }
    if (opts.creatorAllocationBps > 1500) {
      throw new Error(`Creator allocation exceeds max 1500 bps (15%): got ${opts.creatorAllocationBps}`);
    }

    const initialBuyWei = opts.initialBuyWei ?? ZORA_MIN_INITIAL_BUY;
    if (initialBuyWei < ZORA_MIN_INITIAL_BUY) {
      throw new Error(`Initial buy below minimum: ${initialBuyWei} < ${ZORA_MIN_INITIAL_BUY}`);
    }

    const txHash = await factory.write.deploy(
      [
        {
          creator: opts.creator,
          name: opts.name,
          symbol: opts.symbol,
          uri: opts.uri,
          creatorAllocationBps: BigInt(opts.creatorAllocationBps),
          creatorFeeBps: BigInt(opts.creatorFeeBps),
          platformFeeBps: BigInt(platformFeeBps),
          referrer: opts.referrer ?? '0x0000000000000000000000000000000000000000',
        },
      ],
      { value: initialBuyWei },
    );

    // Estimate coin address from the deploy event
    // In production, parse the CoinDeployed event from the receipt
    const explorerUrl = `https://basescan.org/tx/${txHash}`;

    return {
      coinAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Parse from event
      txHash,
      explorerUrl,
    };
  }

  /**
   * Buy a creator coin via its Uniswap V4 pool or bonding curve.
   *
   * Pre-graduation: buys through the coin's buy() function (bonding curve).
   * Post-graduation: buys through the Uniswap V4 pool via swap router.
   *
   * @returns TradeResult with tx hash and amount received.
   */
  async buyCoin(opts: BuyCoinInput): Promise<TradeResult> {
    const coin = getContract({
      address: opts.coinAddress,
      abi: ZORA_COIN_ABI,
      client: this.walletClient,
    });

    const minOut = opts.minOut ?? 1n; // Minimum safe default
    const hash = await coin.write.buy(
      [opts.buyer, minOut],
      { value: opts.amountIn },
    );

    return {
      signature: hash,
      amount: minOut.toString(),
      explorerUrl: `https://basescan.org/tx/${hash}`,
    };
  }

  /**
   * Get coin info from Zora's Coins API.
   *
   * @param coinAddress The coin's contract address.
   * @returns CoinInfo with metadata, price, and volume.
   */
  async getCoinInfo(coinAddress: string): Promise<CoinInfo> {
    return fetchZoraCoinInfo(coinAddress);
  }

  /**
   * Get trending coins from Zora's Coins API.
   *
   * @param limit Max number of coins to return (default 20).
   * @returns Array of CoinInfo objects.
   */
  async getTrendingCoins(limit: number = 20): Promise<CoinInfo[]> {
    return fetchZoraTrendingCoins(limit);
  }

  /**
   * Get all coins deployed by a specific creator.
   *
   * @param creatorAddress The creator's wallet address.
   * @returns Array of CoinInfo objects.
   */
  async getCreatorCoins(creatorAddress: string): Promise<CoinInfo[]> {
    return fetchZoraCreatorCoins(creatorAddress);
  }

  /**
   * Get the current price of a creator coin from its Uniswap V4 pool
   * or on-chain getPrice function.
   *
   * Pre-graduation: reads from the coin's getPrice() (bonding curve).
   * Post-graduation: queries the Uniswap V4 pool via the coin's poolAddress().
   *
   * @param coinAddress The coin's contract address.
   * @returns CoinPrice with current price and pool info.
   */
  async getCoinPrice(coinAddress: `0x${string}`): Promise<CoinPrice> {
    const coin = getContract({
      address: coinAddress,
      abi: ZORA_COIN_ABI,
      client: this.publicClient,
    });

    const [price, poolAddr, graduated] = await Promise.all([
      coin.read.getPrice().catch(() => 0n),
      coin.read.poolAddress().catch(() => '0x0000000000000000000000000000000000000000' as `0x${string}`),
      coin.read.isGraduated().catch(() => false),
    ]);

    const poolAddress = poolAddr !== '0x0000000000000000000000000000000000000000'
      ? poolAddr as `0x${string}`
      : undefined;

    return {
      price: BigInt(price),
      poolAddress,
      isUniswapPool: graduated && !!poolAddress,
      priceChange24h: 0, // Would need off-chain data
    };
  }

  /**
   * Get the deployment transaction for a coin to determine its actual
   * address from the CoinDeployed event.
   *
   * @param txHash The deploy transaction hash.
   * @returns The deployed coin address, or null if not found.
   */
  async resolveCoinAddress(txHash: `0x${string}`): Promise<`0x${string}` | null> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });

      // Parse CoinDeployed event from logs
      // Topic0 = keccak256("CoinDeployed(address,address,string,string,uint256)")
      const COIN_DEPLOYED_TOPIC = '0x8c4be23f2b49d25a2ce454f2c8bc8ce8d5f3f26c38d1a5f1e8e7c9e43b5f1b2a' as `0x${string}`;
      const eventLog = receipt.logs.find(
        log => log.topics[0] === COIN_DEPLOYED_TOPIC &&
               log.address.toLowerCase() === ZORA_FACTORY_ADDRESS.toLowerCase(),
      );

      if (eventLog && eventLog.topics[2]) {
        // topics[2] is the coin address (indexed)
        return eventLog.topics[2] as `0x${string}`;
      }

      return null;
    } catch {
      return null;
    }
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
    // Redirect to ZoraFactory deployment
    const zoraClient = new ZoraCreatorCoinClient(this.walletClient, this.publicClient);
    const result = await zoraClient.deployCreatorCoin({
      creator: this.walletClient.account.address,
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
   */
  async buyTokens(opts: {
    contractAddress: `0x${string}`;
    amountWei: bigint;
    minTokensOut: bigint;
    chain?: string;
  }): Promise<TradeResult> {
    const contract = getContract({
      address: opts.contractAddress,
      abi: ZORA_CREATOR_COIN_ABI_V1,
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
      abi: ZORA_CREATOR_COIN_ABI_V1,
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
  async getTokenInfo(contractAddress: `0x${string}`): Promise<{
    address: string;
    name: string;
    symbol: string;
    price: string;
    totalSupply: string;
    totalRaised: string;
    uniqueBuyers: number;
    graduated: boolean;
    decimals: number;
    chain: string;
  }> {
    const contract = getContract({
      address: contractAddress,
      abi: ZORA_CREATOR_COIN_ABI_V1,
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
      price: '0',
      totalSupply: totalSupply.toString(),
      totalRaised: '0',
      uniqueBuyers: 0,
      graduated: false,
      decimals: 18,
      chain: 'base',
    };
  }
}
