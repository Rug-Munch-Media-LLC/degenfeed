/**
 * Creator Coin — EVM Client (Base)
 *
 * Client for deploying and trading creator coins on Base.
 *
 * Two deployment paths:
 *  1. `deployCoin` — legacy Zora 2026 protocol factory (via @degenfeed/zora-sdk ABI).
 *  2. `deployV4Coin` — deploys the compiled `DegenFeedCoinV4` bytecode directly
 *     (anti-exploit bonding-curve contract). This is the canonical path — the
 *     bytecode + ABI come from `packages/creator-coin/contracts/out/`.
 *
 * Trading + on-chain reads use the real `DegenFeedCoinV4` ABI.
 */

import { type Address, createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import type {
  BuyInput,
  CreatorCoinConfig,
  DeployResult,
  SellInput,
  TokenInfo,
  TradeResult,
} from '../types';
import {
  DEGENFEED_COIN_V4_ABI,
  DEGENFEED_COIN_V4_BYTECODE,
  DEGENFEED_COIN_V4_READ_ABI,
} from './degenfeed-coin-v4';

// ─── Constants ─────────────────────────────────────────────────────────────

const ZORA_FACTORY = '0x777777751622c0d3258f214F9DF38E35BF45baF3' as const;

export interface V4DeployOptions {
  /** Receiver of platform fees (defaults to deployer when omitted) */
  platformFeeReceiver?: Address;
  /** Wormhole core bridge address (cross-chain) */
  wormholeCore?: Address;
  /** Wormhole relayer address (cross-chain) */
  wormholeRelayer?: Address;
  /** Chain ID used by the contract's Wormhole integration (default: 8453 Base) */
  chainId?: bigint;
  /** Pre-bonding duration in seconds (default 0 = disabled) */
  preBondingDuration?: number;
  /** Max wallet % of supply in bps (default 2000 = 20%) */
  maxWalletBps?: number;
  /** Enable anti-sniper (default true) */
  antiSniperEnabled?: boolean;
  /** Enable sandwich protection (default true) */
  sandwichProtection?: boolean;
}

/** On-chain state read from a deployed DegenFeedCoinV4 contract. */
export interface V4OnChainState {
  address: string;
  name: string;
  symbol: string;
  /** Current price in wei (PRICE_DECIMALS = 1e9) */
  price: string;
  /** Bonding curve progress in bps (0-10000) */
  progressBps: bigint;
  /** Current phase index + name */
  phaseIndex: number;
  phaseName: string;
  totalSupply: string;
  totalRaised: string;
  uniqueBuyers: number;
  graduated: boolean;
  creator: string;
  platformFeeReceiver: string;
  createdAt: number;
  decimals: number;
  isPreBonding: boolean;
  preBondingEnd: number;
}

export class CreatorCoinEVMClient {
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;

  constructor(opts: { rpcUrl?: string; privateKey?: string } = {}) {
    this.publicClient = createPublicClient({
      chain: base,
      transport: http(opts.rpcUrl || 'https://mainnet.base.org'),
    }) as ReturnType<typeof createPublicClient>;

    if (opts.privateKey) {
      const account = privateKeyToAccount(opts.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        chain: base,
        transport: http(opts.rpcUrl || 'https://mainnet.base.org'),
        account,
      });
    }
  }

  // ─── Deploy (legacy Zora factory) ────────────────────────────────────────

  async deployCoin(config: CreatorCoinConfig): Promise<DeployResult> {
    if (!this.walletClient) throw new Error('Wallet client required');

    const { request: call } = await this.publicClient.simulateContract({
      address: ZORA_FACTORY,
      abi: [
        {
          type: 'function',
          name: 'deploy',
          inputs: [
            {
              type: 'tuple',
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
          stateMutability: 'payable',
        },
      ],
      functionName: 'deploy',
      args: [
        {
          creator: config.creator as Address,
          name: config.name,
          symbol: config.symbol,
          uri: config.uri,
          creatorAllocationBps: BigInt(config.creatorAllocationBps),
          creatorFeeBps: BigInt(config.creatorFeeBps ?? 100),
          platformFeeBps: BigInt(config.platformFeeBps ?? 50),
          referrer: (config.referrer as Address) ?? '0x0000000000000000000000000000000000000000',
        },
      ],
      value: parseEther('0.05'),
      account: this.walletClient.account?.address,
    });

    const hash = await this.walletClient.writeContract(call);
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse CoinCreated event to get the deployed address
    const coinCreatedLog = receipt.logs[0];
    const coinAddress = coinCreatedLog?.address ?? '0x0000000000000000000000000000000000000000';

    return {
      txHash: hash,
      primaryAddress: coinAddress,
      explorerUrl: `https://basescan.org/tx/${hash}`,
      zoraUrl: `https://zora.co/coin/base:${coinAddress}`,
      totalSupply: '1000000000000000000000000000',
      chain: 'base',
    };
  }

  // ─── Deploy (compiled DegenFeedCoinV4 bytecode) ─────────────────────────

  /**
   * Deploy the compiled DegenFeedCoinV4 contract directly.
   *
   * Uses the bytecode from `packages/creator-coin/contracts/out/` — this is
   * the canonical creator-coin deployment path (anti-exploit bonding curve).
   *
   * CONTRACTS NOT DEPLOYED — set these env vars before calling:
   *   BASE_RPC_URL, CREATOR_COIN_PRIVATE_KEY, PLATFORM_FEE_RECEIVER
   * and (for cross-chain) WORMHOLE_CORE_BRIDGE, WORMHOLE_RELAYER.
   *
   * Returns the real deployed contract address from the tx receipt.
   */
  async deployV4Coin(config: CreatorCoinConfig, opts: V4DeployOptions = {}): Promise<DeployResult> {
    if (!this.walletClient) throw new Error('Wallet client required');

    const creator = config.creator as Address;
    const platformFeeReceiver = opts.platformFeeReceiver ?? this.walletClient.account?.address;
    if (!platformFeeReceiver) throw new Error('platformFeeReceiver required (or configure wallet)');

    const wormholeCore =
      opts.wormholeCore ?? '0x0000000000000000000000000000000000000000';
    const wormholeRelayer =
      opts.wormholeRelayer ?? '0x0000000000000000000000000000000000000000';
    const chainId = opts.chainId ?? 8453n; // Base

    const labels_ = [1]; // WalletLabel.Creator
    const labelWallets_ = [creator];

    const hash = await this.walletClient.deployContract({
      abi: DEGENFEED_COIN_V4_ABI,
      bytecode: DEGENFEED_COIN_V4_BYTECODE,
      args: [
        config.name,
        config.symbol,
        creator,
        platformFeeReceiver,
        wormholeCore,
        wormholeRelayer,
        chainId,
        {
          feeBps: BigInt(config.creatorFeeBps ?? 100),
          vestingDuration: 0n,
          vestingPercentageBps: 0n,
          creatorAllocationBps: BigInt(config.creatorAllocationBps),
          preBondingDuration: BigInt(opts.preBondingDuration ?? 0),
          maxWalletBps: BigInt(opts.maxWalletBps ?? 2000),
          vestingType: 0, // None
          daoEnabled: false,
          antiSniperEnabled: opts.antiSniperEnabled ?? true,
          sandwichProtection: opts.sandwichProtection ?? true,
          minBlockDelay: 0n,
        },
        {
          multiSigTreasury: '0x0000000000000000000000000000000000000000' as Address,
          governor: '0x0000000000000000000000000000000000000000' as Address,
          initialSigners: [] as Address[],
          signerThreshold: 0n,
        },
        labels_,
        labelWallets_,
      ],
      account: this.walletClient.account!.address,
      chain: base,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    const contractAddress = receipt.contractAddress;
    if (!contractAddress) {
      throw new Error('Deployment succeeded but no contract address in receipt');
    }

    return {
      txHash: hash,
      primaryAddress: contractAddress,
      explorerUrl: `https://basescan.org/tx/${hash}`,
      totalSupply: '1000000000000000000000000000', // 1B * 1e18
      chain: 'base',
    };
  }

  // ─── Buy ─────────────────────────────────────────────────────────────────

  async buy(opts: BuyInput): Promise<TradeResult> {
    if (!this.walletClient) throw new Error('Wallet client required');

    const { request } = await this.publicClient.simulateContract({
      address: opts.tokenAddress as Address,
      abi: DEGENFEED_COIN_V4_ABI,
      functionName: 'buy',
      args: [opts.minTokensOut],
      value: opts.amountIn,
      account: this.walletClient.account?.address,
    });

    const hash = await this.walletClient.writeContract(request);

    return {
      txHash: hash,
      tokensAmount: opts.amountIn.toString(),
      explorerUrl: `https://basescan.org/tx/${hash}`,
    };
  }

  // ─── Sell ────────────────────────────────────────────────────────────────

  async sell(opts: SellInput): Promise<TradeResult> {
    if (!this.walletClient) throw new Error('Wallet client required');

    const { request } = await this.publicClient.simulateContract({
      address: opts.tokenAddress as Address,
      abi: DEGENFEED_COIN_V4_ABI,
      functionName: 'sell',
      args: [opts.amountIn, opts.minOut ?? 0n],
      account: this.walletClient.account?.address,
    });

    const hash = await this.walletClient.writeContract(request);

    return {
      txHash: hash,
      tokensAmount: opts.amountIn.toString(),
      explorerUrl: `https://basescan.org/tx/${hash}`,
    };
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const state = await this.readV4State(tokenAddress);
    return {
      address: state.address,
      name: state.name,
      symbol: state.symbol,
      price: state.price,
      totalSupply: state.totalSupply,
      totalRaised: state.totalRaised,
      uniqueBuyers: state.uniqueBuyers,
      graduated: state.graduated,
      decimals: state.decimals,
      chain: 'base',
      createdAt: state.createdAt,
      creator: state.creator,
      bondingPhase: state.phaseIndex,
      bondingPhaseName: state.phaseName,
    };
  }

  /**
   * Read real on-chain state from a deployed DegenFeedCoinV4 contract.
   * Throws if the contract does not exist / is not a V4 coin.
   */
  async readV4State(tokenAddress: string): Promise<V4OnChainState> {
    const address = tokenAddress as Address;
    const read = async <T>(functionName: string): Promise<T> =>
      this.publicClient.readContract({
        address,
        abi: DEGENFEED_COIN_V4_READ_ABI,
        functionName: functionName as never,
      }) as Promise<T>;

    const [name, symbol, totalSupply, price, progressBps, phase, totalRaised, uniqueBuyers, graduated, creator, platformFeeReceiver, createdAt, decimals, isPreBonding, preBondingEnd] =
      await Promise.all([
        read<string>('name'),
        read<string>('symbol'),
        read<bigint>('totalSupply'),
        read<bigint>('getCurrentPrice'),
        read<bigint>('getProgressBps'),
        read<[bigint, string]>('getCurrentPhase'),
        read<bigint>('totalRaised'),
        read<bigint>('uniqueBuyers'),
        read<boolean>('graduated'),
        read<string>('creator'),
        read<string>('platformFeeReceiver'),
        read<bigint>('createdAt'),
        read<number>('decimals'),
        read<boolean>('isPreBonding'),
        read<bigint>('preBondingEnd'),
      ]);

    return {
      address: tokenAddress,
      name,
      symbol,
      price: price.toString(),
      progressBps,
      phaseIndex: Number(phase[0]),
      phaseName: phase[1],
      totalSupply: totalSupply.toString(),
      totalRaised: totalRaised.toString(),
      uniqueBuyers: Number(uniqueBuyers),
      graduated,
      creator,
      platformFeeReceiver,
      createdAt: Number(createdAt),
      decimals,
      isPreBonding,
      preBondingEnd: Number(preBondingEnd),
    };
  }
}
