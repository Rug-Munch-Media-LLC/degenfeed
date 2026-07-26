/**
 * Creator Coin — EVM Client (Base)
 *
 * Client for deploying and trading creator coins on Base.
 * Uses Zora 2026 protocol via @degenfeed/zora-sdk.
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

// ─── Constants ─────────────────────────────────────────────────────────────

const ZORA_FACTORY = '0x777777751622c0d3258f214F9DF38E35BF45baF3' as const;

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

  // ─── Deploy ──────────────────────────────────────────────────────────────

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

  // ─── Buy ─────────────────────────────────────────────────────────────────

  async buy(opts: BuyInput): Promise<TradeResult> {
    if (!this.walletClient) throw new Error('Wallet client required');

    const { request } = await this.publicClient.simulateContract({
      address: opts.tokenAddress as Address,
      abi: [
        {
          type: 'function',
          name: 'buy',
          inputs: [{ name: 'minAmount', type: 'uint256' }],
          outputs: [{ name: 'amount', type: 'uint256' }],
          stateMutability: 'payable',
        },
      ],
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
      abi: [
        {
          type: 'function',
          name: 'sell',
          inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'minEth', type: 'uint256' },
          ],
          outputs: [{ name: 'ethOut', type: 'uint256' }],
          stateMutability: 'nonpayable',
        },
      ],
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
    const [name, symbol, totalSupply, price, creator, createdAt] = await Promise.all([
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.name],
        functionName: 'name',
      }),
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.symbol],
        functionName: 'symbol',
      }),
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.totalSupply],
        functionName: 'totalSupply',
      }),
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.getPrice],
        functionName: 'getPrice',
      }),
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.creator],
        functionName: 'creator',
      }),
      this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: [coinAbi.createdAt],
        functionName: 'createdAt',
      }),
    ] as any);

    return {
      address: tokenAddress,
      name: name as string,
      symbol: symbol as string,
      price: (price as bigint).toString(),
      totalSupply: (totalSupply as bigint).toString(),
      totalRaised: '0',
      uniqueBuyers: 0,
      graduated: false,
      decimals: 18,
      chain: 'base',
      createdAt: Number(createdAt as bigint),
      creator: creator as string,
    };
  }
}

const coinAbi = {
  name: {
    type: 'function' as const,
    name: 'name',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view' as const,
  },
  symbol: {
    type: 'function' as const,
    name: 'symbol',
    inputs: [],
    outputs: [{ type: 'string' }],
    stateMutability: 'view' as const,
  },
  totalSupply: {
    type: 'function' as const,
    name: 'totalSupply',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  getPrice: {
    type: 'function' as const,
    name: 'getPrice',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  creator: {
    type: 'function' as const,
    name: 'creator',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view' as const,
  },
  createdAt: {
    type: 'function' as const,
    name: 'createdAt',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
} as const;
