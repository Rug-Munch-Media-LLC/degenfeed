/**
 * Creator Coin System — Shared Types
 *
 * Types for the unified creator coin system that supports
 * deployment on both Solana (primary) and Base (wrapped via bridge).
 */

import type { Address } from 'viem';

// ─── Chain Selection ─────────────────────────────────────────────────────

/** Supported chains for primary coin deployment */
export type CreatorChain = 'solana' | 'base';

/** Chain info for display */
export interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  explorerUrl: string;
  icon: string;
  rpcUrl: string;
}

export const CHAIN_CONFIG: Record<CreatorChain, ChainInfo> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    explorerUrl: 'https://solscan.io',
    icon: '/chains/solana.svg',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
  },
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    explorerUrl: 'https://basescan.org',
    icon: '/chains/base.svg',
    rpcUrl: 'https://mainnet.base.org',
  },
};

// ─── Coin Configuration ──────────────────────────────────────────────────

export interface CreatorCoinConfig {
  /** Coin name (e.g. "Alice Coin") */
  name: string;
  /** Coin symbol (e.g. "ALICE") */
  symbol: string;
  /** Metadata URI (IPFS or HTTP) */
  uri: string;
  /** Creator's wallet identifier */
  creator: string;
  /** Primary chain to deploy on */
  chain: CreatorChain;
  /** Creator allocation in bps (0-1500 = 0-15%) */
  creatorAllocationBps: number;
  /** Creator fee on trades in bps (0-200 = 0-2%) */
  creatorFeeBps: number;
  /** Platform fee in bps (default 50 = 0.5%) */
  platformFeeBps?: number;
  /** Referrer address (optional) */
  referrer?: string;
}

// ─── Deploy Response ─────────────────────────────────────────────────────

export interface DeployResult {
  /** Transaction signature/hash */
  txHash: string;
  /** Primary token address (Solana mint or Base contract) */
  primaryAddress: string;
  /** Wrapped address on the other chain (if cross-chain) */
  wrappedAddress?: string;
  /** Explorer URL for the primary deployment */
  explorerUrl: string;
  /** Zora.co URL if on Base */
  zoraUrl?: string;
  /** Total supply */
  totalSupply: string;
  /** Chain deployed on */
  chain: CreatorChain;
}

// ─── Trading ─────────────────────────────────────────────────────────────

export interface BuyInput {
  /** Token address (mint on Solana, contract on EVM) */
  tokenAddress: string;
  /** Amount to spend in smallest unit (lamports/wei) */
  amountIn: bigint;
  /** Minimum tokens to receive (slippage) */
  minTokensOut: bigint;
}

export interface SellInput {
  tokenAddress: string;
  /** Amount of tokens to sell */
  amountIn: bigint;
  /** Minimum output amount (slippage) */
  minOut?: bigint;
}

export interface TradeResult {
  /** Transaction hash/signature */
  txHash: string;
  /** Tokens received (buys) or sold (sells) */
  tokensAmount?: string;
  /** ETH/SOL spent or received */
  nativeAmount?: string;
  /** Platform fee taken */
  platformFee?: string;
  /** Explorer URL */
  explorerUrl: string;
}

// ─── Token Info ──────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  /** Current price in native currency (lamports/wei) */
  price: string;
  /** Total supply issued */
  totalSupply: string;
  /** Total raised in native currency */
  totalRaised: string;
  /** Unique buyer count */
  uniqueBuyers: number;
  /** Whether graduated (AMM pool active) */
  graduated: boolean;
  /** Number of decimals */
  decimals: number;
  /** Chain */
  chain: CreatorChain;
  /** Created at timestamp */
  createdAt: number;
  /** Creator address */
  creator: string;
}

// ─── Cross-Chain ─────────────────────────────────────────────────────────

export interface CrossChainMapping {
  /** Solana mint address (primary) */
  solanaMint: string;
  /** Base wrapped contract address */
  baseWrapped: Address;
  /** Creator wallet (Solana pubkey) */
  creator: string;
  /** Bridge attestation hash */
  attestationHash: string;
  /** Timestamp of registration */
  registeredAt: number;
}

export interface CrossChainPrice {
  solana: { price: string; usd: number };
  base: { price: string; usd: number };
  diffPercent: number;
  arbitrageProfitable: boolean;
}

// ─── Live Stream ─────────────────────────────────────────────────────────

export interface LiveStreamInfo {
  /** Whether creator is currently live */
  isLive: boolean;
  /** Stream platform (peertube, owncast, etc.) */
  platform: string;
  /** Stream URL */
  streamUrl: string;
  /** Stream title */
  title: string;
  /** Live boost discount in bps (e.g., 200 = 2%) */
  boostDiscountBps: number;
  /** When the stream started */
  startedAt?: number;
  /** Viewer count */
  viewerCount?: number;
}

// ─── Fee Structure ───────────────────────────────────────────────────────

export interface FeeStructure {
  /** Platform fee in bps (default 50 = 0.5%) */
  platformFeeBps: number;
  /** Creator fee in bps (0-200 = 0-2%) */
  creatorFeeBps: number;
  /** Referral fee in bps (5 = 0.05%) */
  referralFeeBps: number;
  /** Total fee cap in bps (250 = 2.5%) */
  maxTotalFeeBps: number;
}

export const DEFAULT_FEES: FeeStructure = {
  platformFeeBps: 50,
  creatorFeeBps: 100,
  referralFeeBps: 5,
  maxTotalFeeBps: 250,
};

// ─── Events ──────────────────────────────────────────────────────────────

export interface CoinCreatedEvent {
  coinAddress: string;
  creator: string;
  name: string;
  symbol: string;
  chain: CreatorChain;
  timestamp: number;
}

export interface TradeEvent {
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  nativeValue: string;
  price: string;
  timestamp: number;
}

// ─── Curve State ─────────────────────────────────────────────────────────

export interface CurveState {
  /** Current supply minted */
  supply: bigint;
  /** Current price per token */
  currentPrice: bigint;
  /** Progress towards graduation (0-100) */
  progressPercent: number;
  /** Current era name */
  eraName: string;
  /** Whether a flash sale is active */
  flashSaleActive: boolean;
  /** Whether a creator event is active */
  creatorEventActive: boolean;
  /** Whether creator is live (bonus) */
  isCreatorLive: boolean;
}

// ─── Badges ──────────────────────────────────────────────────────────────

export type BadgeType =
  | 'first_buyer'
  | 'streak_7'
  | 'whale'
  | 'top_10'
  | 'early_adopter'
  | 'graduation_holder'
  | 'super_fan';

export interface Badge {
  type: BadgeType;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// ─── Config ──────────────────────────────────────────────────────────────

export interface CreatorCoinClientConfig {
  /** Solana RPC URL */
  solanaRpcUrl?: string;
  /** Base RPC URL */
  baseRpcUrl?: string;
  /** Private key for signing (optional — use wallet adapter in UI) */
  privateKey?: string;
}
