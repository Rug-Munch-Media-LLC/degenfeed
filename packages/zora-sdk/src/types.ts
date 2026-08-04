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
 * Raw coin data from Zora's 2026 Coins API (GraphQL-shaped node).
 * Mirrors the response of /explore edges[].node and /coin zora20Token.
 */
export interface ZoraCoin {
  address: string;
  name: string;
  symbol: string;
  description?: string;
  coinType?: string;
  totalSupply?: string;
  totalVolume?: string;
  volume24h?: string;
  createdAt?: string;
  creatorAddress?: string;
  creatorProfile?: {
    handle?: string;
    avatar?: { previewImage?: { medium?: string; small?: string } } | null;
    socialAccounts?: unknown[];
  } | null;
  poolCurrencyToken?: {
    address?: string;
    name?: string;
    decimals?: number;
  } | null;
  tokenPrice?: {
    priceInUsdc?: string;
    priceInPoolToken?: string;
    currencyAddress?: string;
  } | null;
  marketCap?: string;
  marketCapDelta24h?: string;
  chainId?: number;
  tokenUri?: string;
  uniqueHolders?: number;
  uniswapV3PoolAddress?: string | null;
  uniswapV4PoolKey?: string | null;
  platformBlocked?: boolean;
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

// ═════════════════════════════════════════════════════════════════════════
// Dual-Chain (One Coin, Two Networks) Types
// ═════════════════════════════════════════════════════════════════════════

/**
 * Config for deploying a dual-chain coin.
 * ONE coin deployed on Solana (primary) and wrapped to Base (via Wormhole).
 * Same name, symbol, supply on both chains — paired to each other.
 */
export interface DualChainCoinConfig {
  /** Coin name (e.g. "Alice Coin") */
  name: string;
  /** Coin symbol (e.g. "ALICE") */
  symbol: string;
  /** Metadata URI (IPFS or HTTP) */
  uri: string;
  /** Creator wallet address (Solana pubkey) */
  creator: string;

  /** Solana RPC URL (optional, defaults to public mainnet) */
  solanaRpcUrl?: string;
  /** Base RPC URL (optional, defaults to public mainnet) */
  baseRpcUrl?: string;
  /** Solana creator wallet private key (for signing) */
  solanaPrivateKey?: string;
  /** Base wallet private key (for wrapped token registration) */
  basePrivateKey?: string;

  /** Total supply — SAME on both chains */
  totalSupply: bigint;
  /** Creator allocation in bps (0-1500 = 0-15%) */
  creatorAllocationPercent: number;
  /** Platform fee in bps (default 50 = 0.5%) */
  platformFeeBps?: number;
  /** Creator fee on buys in bps (0-200 = 0-2%) */
  creatorFeeBps?: number;

  /** One-time token generation fee in USD (default $20) */
  tokenGenerationFeeUsd?: number;
  /** Unique token seed for Solana PDA derivation */
  tokenSeed?: bigint;
}

/**
 * Result from a dual-chain coin deployment.
 * One coin that exists on both Solana (primary) and Base (wrapped).
 */
export interface DualChainDeployResult {
  /** Solana token info */
  solana: {
    /** SPL token mint address */
    address: string;
    /** Paired currency */
    pairCurrency: 'SOL';
    /** Jupiter swap URL */
    dexUrl: string;
    /** Explorer URL */
    explorerUrl: string;
  };
  /** Base wrapped token info */
  base: {
    /** Wrapped ERC-20 contract address */
    address: `0x${string}`;
    /** Paired currency */
    pairCurrency: 'ETH';
    /** Whether this is a Wormhole-wrapped token */
    isWrapped: true;
    /** Zora.co URL — visible on Zora */
    zoraUrl: string;
    /** Uniswap V4 swap URL */
    dexUrl: string;
    /** Explorer URL */
    explorerUrl: string;
  };
  /** Wormhole attestation VAA hash (for bridging) */
  wormholeAttestation: string;
  /** Total supply (same on both chains) */
  totalSupply: string;
  /** Deployment cost breakdown */
  deploymentCost: CostBreakdown;
  /** Token seed used for Solana PDA */
  tokenSeed: string;
  /** Cross-chain registry mapping ID */
  registryId?: string;
}

/**
 * Price info for a dual-chain coin on both networks.
 */
export interface DualChainPrice {
  /** Price on Solana in SOL */
  solana: {
    priceUsd: number;
    priceNative: number;
    pairCurrency: 'SOL';
  };
  /** Price on Base in ETH */
  base: {
    priceUsd: number;
    priceNative: number;
    pairCurrency: 'ETH';
  };
  /** Price difference as percentage of the higher price */
  priceDiffPercent: number;
  /** Whether arbitrage is profitable (>1% diff) */
  arbitrageProfitable: boolean;
  /** Timestamp of price fetch */
  timestamp: number;
}

/**
 * Reference to a deployed dual-chain coin.
 */
export interface DualChainCoin {
  /** Coin name */
  name: string;
  /** Coin symbol (wrapped version on Base uses .w suffix) */
  symbol: string;
  /** Same metadata URI on both chains */
  uri: string;
  /** Creator wallet address */
  creator: string;
  /** Solana token info */
  solana: {
    address: string;
    priceUsd?: number;
    volume24h?: number;
  };
  /** Base wrapped token info */
  base: {
    address: `0x${string}`;
    priceUsd?: number;
    volume24h?: number;
    zoraUrl?: string;
  };
  /** Total supply (same both chains) */
  totalSupply: string;
  /** Wormhole attestation */
  wormholeAttestation: string;
}

/**
 * Cost breakdown for dual-chain deployment.
 * Creator pays the token generation fee; network fees cover gas.
 */
export interface CostBreakdown {
  /** Platform token generation fee */
  tokenGenerationFee: { amount: number; currency: 'USD'; note: string };
  /** Solana token creation gas */
  solanaDeploy: { amount: number; currency: 'SOL'; note: string };
  /** Wormhole attestation fee */
  wormholeAttest: { amount: number; currency: 'SOL'; note: string };
  /** Base wrapped deployment gas (Zora wrapper) */
  baseWrapped: { amount: number; currency: 'USD'; note: string };
  /** Approximate total cost to creator */
  total: { amount: number; currency: 'USD'; note: string };
  /** Platform profit from this deployment */
  ourProfit: { amount: number; currency: 'USD'; note: string };
}

/**
 * Result of collecting the token generation fee.
 */
export interface FeePaymentResult {
  /** Whether payment was successfully collected */
  paid: boolean;
  /** Amount paid (formatted) */
  amount: string;
  /** Currency used (SOL or ETH) */
  currency: 'SOL' | 'ETH';
  /** Unique receipt ID for accounting */
  receiptId: string;
  /** Payment transaction hash (if on-chain) */
  txHash?: string;
}

export type FeePaymentStatus = 'pending' | 'confirmed' | 'failed';

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
