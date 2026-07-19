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

export interface TradeResult {
  /** Transaction signature */
  signature: string;
  /** Amount of tokens received/sold */
  amount: string;
  /** USD equivalent (if price feed available) */
  usdValue?: string;
  /** Explorer URL */
  explorerUrl: string;
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

// ─── Unified types ─────────────────────────────────────────────────────────

export type Chain = 'solana' | 'base' | 'optimism' | 'arbitrum';

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
