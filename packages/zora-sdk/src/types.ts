/**
 * Shared types for the DegenFeed Creator Token SDK.
 * Supports both EVM (Base/Zora-style) and Solana creator tokens.
 */

// ─── Solana types ──────────────────────────────────────────────────────────

export interface SolanaTokenInput {
  /** Unique u64 seed for PDA derivation (frontend should track per-creator) */
  tokenSeed: bigint;
  /** Token name (max 32 chars) */
  name: string;
  /** Token symbol (max 10 chars) */
  symbol: string;
  /** Metadata URI (max 200 chars) */
  uri: string;
  /** Creator allocation in bps (0-1500 = 0-15%) */
  creatorAllocationBps: number;
  /** Creator fee on buys in bps (0-200 = 0-2%) */
  creatorFeeBps: number;
  /** Optional referrer address */
  referrer?: string | null;
}

export interface SolanaBuyInput {
  /** Token mint address */
  mint: string;
  /** Amount of SOL to spend (in lamports) */
  amountLamports: bigint;
  /** Minimum tokens to receive (slippage protection, 9 decimals) */
  minTokensOut: bigint;
}

export interface SolanaSellInput {
  /** Token mint address */
  mint: string;
  /** Amount of tokens to sell (9 decimals) */
  amountTokens: bigint;
}

export interface SolanaDeployResult {
  /** Transaction signature */
  signature: string;
  /** Token mint address */
  mint: string;
  /** Token state PDA */
  tokenState: string;
}

export interface TokenInfo {
  /** Token mint / contract address */
  address: string;
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Current price in native currency (lamports on Solana, wei on EVM) */
  price: string;
  /** Total supply issued */
  totalSupply: string;
  /** Total SOL/ETH raised */
  totalRaised: string;
  /** Unique buyer count */
  uniqueBuyers: number;
  /** Whether the token has graduated */
  graduated: boolean;
  /** Number of decimals */
  decimals: number;
  /** Chain */
  chain: 'solana' | 'base' | 'ethereum' | 'optimism' | 'arbitrum';
}

export interface VestedClaimResult {
  signature: string;
  amount: string;
  explorerUrl: string;
}

// ─── EVM (Zora-style) types ────────────────────────────────────────────────

export interface EvmTokenInput {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Metadata URI */
  uri: string;
  /** Creator allocation (0-15%) */
  creatorAllocationBps: number;
  /** Creator fee (0-2%) */
  creatorFeeBps: number;
  /** Referrer address */
  referrer?: `0x${string}`;
  /** Target chain */
  chain: 'base' | 'optimism' | 'arbitrum';
}

export interface EvmBuyInput {
  /** Contract address */
  contractAddress: `0x${string}`;
  /** Amount of ETH to spend (in wei) */
  amountWei: bigint;
  /** Minimum tokens out */
  minTokensOut: bigint;
  /** Target chain */
  chain: 'base' | 'optimism' | 'arbitrum';
}

// ─── Zora 2026 Creator Coin types ──────────────────────────────────────────

/**
 * Result from deploying a creator coin via ZoraFactory.
 * All coins pair against ETH — never ZORA.
 */
export interface DeployResult {
  /** The deployed coin contract address */
  coinAddress: `0x${string}`;
  /** Transaction hash */
  txHash: `0x${string}`;
  /** Explorer URL */
  explorerUrl: string;
  /** Zora.co URL — users can login to zora.co and see their coin */
  zoraUrl?: string;
  /** The mint/buy transaction for the initial supply */
  initialBuyTx?: `0x${string}`;
  /** Pair currency — always 'ETH' for our fork */
  pairCurrency: string;
  /** Pair currency symbol — always 'ETH' for our fork */
  pairCurrencySymbol: string;
}

/**
 * Result from buying/selling a creator coin.
 * All trades settle in ETH — never ZORA.
 */
export interface TradeResult {
  /** Transaction hash */
  txHash: string;
  /** Tokens received (for buys) or sold (for sells) */
  tokensReceived?: string;
  /** ETH spent (for buys) */
  ethSpent?: string;
  /** ETH received (for sells) */
  ethReceived?: string;
  /** Platform fee taken in ETH (0.5%) */
  platformFee?: string;
  /** Explorer URL */
  explorerUrl: string;
}

/**
 * Information about a creator coin from the Zora Coins API.
 * All prices in ETH — never ZORA.
 */
export interface CoinInfo {
  /** Coin address */
  address: `0x${string}`;
  /** Coin name */
  name: string;
  /** Coin symbol */
  symbol: string;
  /** Creator wallet address */
  creator: `0x${string}`;
  /** Metadata URI */
  uri: string;
  /** Current price in ETH wei */
  price: string;
  /** Market cap in ETH wei */
  marketCap: string;
  /** Total supply */
  totalSupply: string;
  /** ETH raised */
  totalRaised: string;
  /** Number of holders/supporters */
  holderCount: number;
  /** 24h volume in ETH */
  volume24h: string;
  /** Price change % in 24h */
  priceChange24h: number;
  /** Whether graduated (Uniswap V4 pool active) */
  graduated: boolean;
  /** Underlying Uniswap V4 pool address (if graduated) */
  poolAddress?: `0x${string}`;
  /** Chain */
  chain: 'base';
  /** Pair currency — always 'ETH' for our fork */
  pairCurrency: string;
  /** Pair currency symbol — always 'ETH' for our fork */
  pairCurrencySymbol: string;
}

export interface CoinPrice {
  /** Current price in ETH wei */
  price: bigint;
  /** Pool address on Uniswap V4 */
  poolAddress?: `0x${string}`;
  /** Whether the pool is post-graduation (on Uniswap V4) */
  isUniswapPool: boolean;
  /** 24h price change percentage */
  priceChange24h: number;
}

/**
 * Raw coin data from Zora's Coins API.
 */
export interface ZoraCoin {
  address: string;
  name: string;
  symbol: string;
  creator: string;
  uri: string;
  price: string;
  marketCap: string;
  totalSupply: string;
  totalRaised: string;
  holderCount: number;
  volume24h: string;
  priceChange24h: number;
  graduated: boolean;
  poolAddress?: string;
}

/**
 * Input for deploying a creator coin via ZoraCreatorCoinClient.
 */
export interface DeployCoinInput {
  /** Creator wallet address */
  creator: `0x${string}`;
  /** Coin name (e.g. "Alice Coin") */
  name: string;
  /** Coin symbol (e.g. "ALICE") */
  symbol: string;
  /** Metadata URI (IPFS or HTTP) */
  uri: string;
  /** Creator allocation in basis points (0-1500 = 0-15%) */
  creatorAllocationBps?: number;
  /** Platform fee in bps (0-50 = 0-0.5%) — replaces Zora's default platform fee */
  platformFeeBps?: number;
  /** Creator fee on buys in bps (0-200 = 0-2%) */
  creatorFeeBps?: number;
  /** Platform referrer address (receives 0.5% fee on trades) */
  platformReferrer?: `0x${string}`;
  /** Referrer address (trade referrer) */
  referrer?: `0x${string}`;
  /** Starting market cap tier (LOW or HIGH, default LOW) */
  startingMarketCap?: 'LOW' | 'HIGH';
  /** Initial buy amount in wei (defaults to 0.05 ETH minimum) */
  initialBuyWei?: bigint;
}

/**
 * Input for buying a creator coin.
 */
export interface BuyCoinInput {
  /** Coin contract address */
  coinAddress: `0x${string}`;
  /** Buyer wallet address */
  buyer: `0x${string}`;
  /** Amount of ETH to spend (in wei) */
  amountIn: bigint;
  /** Minimum tokens to receive (slippage protection) */
  minOut?: bigint;
}

// ─── Unified types ─────────────────────────────────────────────────────────

export type Chain = 'solana' | 'ethereum' | 'base' | 'optimism' | 'arbitrum' | 'polygon';

export interface CreateTokenOptions {
  chain: Chain;
  name: string;
  symbol: string;
  uri: string;
  creatorAllocationBps: number;
  creatorFeeBps: number;
  referrer?: string;
}

export interface BuyTokensOptions {
  chain: Chain;
  /** Token address (mint on Solana, contract on EVM) */
  tokenAddress: string;
  /** Amount in smallest unit (lamports on Solana, wei on EVM) */
  amount: bigint;
  /** Minimum tokens out */
  minTokensOut: bigint;
}

export interface SellTokensOptions {
  chain: Chain;
  tokenAddress: string;
  amount: bigint;
}
