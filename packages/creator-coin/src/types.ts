/**
 * Creator Coin 2.0 — Shared Types
 *
 * Enhanced type system for the next-generation creator coin platform
 * with anti-exploit, creator controls, bonding curve 2.0, and post-bonding.
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
  /** Creator allocation in bps (0-1500 = 0-15%) — LEGACY, use creatorControls */
  creatorAllocationBps: number;
  /** Creator fee on trades in bps (0-200 = 0-2%) */
  creatorFeeBps: number;
  /** Platform fee in bps (default 50 = 0.5%) */
  platformFeeBps?: number;
  /** Referrer address (optional) */
  referrer?: string;
  /** Creator Controls 2.0 — overrides legacy creatorAllocationBps */
  creatorControls?: CreatorControlConfig;
  /** Anti-exploit configuration */
  antiExploit?: AntiExploitConfig;
  /** Post-bonding configuration */
  postBonding?: PostBondingConfig;
}

// ─── Creator Controls 2.0 ───────────────────────────────────────────────

export interface CreatorControlConfig {
  /** Vesting schedule configuration */
  vesting: VestingConfig;
  /** Percentage of supply allocated to creator (5-20%) in bps (500-2000) */
  creatorAllocationBps: number;
  /** Percentage going to LP (50-80%) in bps (5000-8000) */
  liquidityAllocationBps: number;
  /** Percentage going to community (10-30%) in bps (1000-3000) */
  communityAllocationBps: number;
  /** Percentage going to DAO treasury (5-10%) in bps (500-1000) */
  treasuryAllocationBps: number;
  /** Enable transfer restrictions during bonding phase */
  restrictTransfersDuringBonding: boolean;
  /** Burn unsold tokens after bonding curve completes */
  burnUnsoldTokens: boolean;
  /** Whether to enable anti-whale measures */
  enableAntiWhale: boolean;
  /** Whether to lock creator liquidity */
  lockLiquidity: boolean;
  /** Liquidity lock duration in seconds (default: 30 days) */
  liquidityLockDuration: number;
  /** Custom platform fee the creator sets (0-200 bps) */
  platformFeeBps: number;
}

export interface VestingConfig {
  /** Vesting duration in seconds (default: 90 days = 7_776_000) */
  duration: number;
  /** Cliff duration in seconds (default: 0) */
  cliffDuration: number;
  /** Initial unlock percentage in bps (0-2000 = 0-20%) */
  initialUnlockBps: number;
  /** Whether vesting is linear vs. staged */
  type: 'linear' | 'staged';
  /** For staged vesting: array of (timeFromStart, unlockBps) pairs */
  stages?: Array<{ timeSeconds: number; unlockBps: number }>;
}

export const DEFAULT_VESTING_CONFIG: VestingConfig = {
  duration: 90 * 24 * 60 * 60, // 90 days
  cliffDuration: 0,
  initialUnlockBps: 0,
  type: 'linear',
};

export const DEFAULT_CREATOR_CONTROLS: CreatorControlConfig = {
  vesting: DEFAULT_VESTING_CONFIG,
  creatorAllocationBps: 1000, // 10%
  liquidityAllocationBps: 6000, // 60%
  communityAllocationBps: 2000, // 20%
  treasuryAllocationBps: 500, // 5%
  restrictTransfersDuringBonding: true,
  burnUnsoldTokens: true,
  enableAntiWhale: true,
  lockLiquidity: true,
  liquidityLockDuration: 30 * 24 * 60 * 60, // 30 days
  platformFeeBps: 50,
};

// ─── Anti-Exploit Configuration ──────────────────────────────────────────

export interface AntiExploitConfig {
  /** Max % of supply per single buy in bps (default: 100 = 1%) */
  maxBuyBps: number;
  /** Max % of supply per wallet total in bps (default: 50 = 0.5%) */
  maxWalletBps: number;
  /** Cooldown between buys from same wallet in seconds (default: 30) */
  buyCooldownSeconds: number;
  /** Minimum wallet age in seconds (default: 7 days = 604_800) */
  minWalletAgeSeconds: number;
  /** Minimum transaction count on chain (default: 5) */
  minTransactionCount: number;
  /** Enable Flashbots/private mempool for launches */
  usePrivateMempool: boolean;
  /** Enable bundler detection (same-block buys -> revert) */
  detectBundlers: boolean;
  /** Max buys per block before bundler detection triggers (default: 3) */
  maxBuysPerBlock: number;
  /** Block known VC sniper addresses */
  blockKnownSnipers: boolean;
  /** List of known sniper addresses to block */
  knownSniperAddresses: string[];
}

export const DEFAULT_ANTI_EXPLOIT_CONFIG: AntiExploitConfig = {
  maxBuyBps: 100, // 1%
  maxWalletBps: 50, // 0.5%
  buyCooldownSeconds: 30, // 30 seconds
  minWalletAgeSeconds: 7 * 24 * 60 * 60, // 7 days
  minTransactionCount: 5,
  usePrivateMempool: true,
  detectBundlers: true,
  maxBuysPerBlock: 3,
  blockKnownSnipers: true,
  knownSniperAddresses: [
    // Known snipers will be populated from an on-chain registry
  ],
};

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
  /** Deployment fees breakdown */
  fees?: DeploymentFees;
  /** Bonding curve phase at deploy */
  bondingPhase?: BondingPhaseInfo;
}

export interface DeploymentFees {
  /** Wormhole bridge fee */
  wormholeFee: string;
  /** DegenFeed platform fee */
  platformFee: string;
  /** Total gas estimate */
  estimatedGas: string;
  /** Total cost in USD estimate */
  totalUsdEstimate: number;
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
  /** Current bonding phase (0-4) */
  bondingPhase?: number;
  /** Current bonding phase name */
  bondingPhaseName?: string;
  /** Anti-exploit status */
  antiExploit?: AntiExploitStatus;
  /** Creator controls applied */
  controls?: {
    vesting: VestingConfig;
    allocations: {
      creator: number;
      liquidity: number;
      community: number;
      treasury: number;
    };
  };
  /** Post-bonding status */
  postBonding?: PostBondingStatus;
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
  bondingPhase: BondingPhaseInfo;
  creatorControls?: CreatorControlConfig;
  antiExploit?: AntiExploitConfig;
}

export interface TradeEvent {
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  nativeValue: string;
  price: string;
  timestamp: number;
}

// ─── Bonding Curve 2.0 ───────────────────────────────────────────────────

export interface CurveState {
  /** Current supply minted */
  supply: bigint;
  /** Current price per token */
  currentPrice: bigint;
  /** Progress towards graduation (0-100) */
  progressPercent: number;
  /** Current era name */
  eraName: string;
  /** Current phase index (0-4) */
  phaseIndex: number;
  /** Whether a flash sale is active */
  flashSaleActive: boolean;
  /** Whether a creator event is active */
  creatorEventActive: boolean;
  /** Whether creator is live (bonus) */
  isCreatorLive: boolean;
  /** Visual progress data for UI */
  visualProgress: VisualProgress;
}

export interface VisualProgress {
  /** Phase color gradient */
  colorGradient: string;
  /** Phase icon/emoji */
  icon: string;
  /** Progress within current phase (0-100) */
  phaseProgress: number;
  /** Price change since phase start */
  priceChangePercent: number;
  /** Urgency message */
  urgencyMessage: string;
}

/** Bonding curve phase definition */
export interface BondingPhase {
  index: number;
  name: string;
  color: string;
  icon: string;
  startPercent: number; // 0-100
  endPercent: number; // 0-100
  description: string;
  urgencyMessage: string;
  /** Sound effect filename (optional) */
  soundEffect?: string;
}

export interface BondingPhaseInfo {
  index: number;
  name: string;
  progress: number;
  color: string;
  icon: string;
}

export const BONDING_PHASES: BondingPhase[] = [
  {
    index: 0,
    name: 'Steal Deal',
    color: 'from-cyan-500 to-degen-400',
    icon: '🔥',
    startPercent: 0,
    endPercent: 20,
    description: 'Lowest price — get in before everyone else discovers this gem!',
    urgencyMessage: "Steal Deal pricing won't last! Next phase price jumps significantly!",
    soundEffect: '/sounds/phase-steal-deal.mp3',
  },
  {
    index: 1,
    name: 'Early Bird',
    color: 'from-degen-500 to-degen-400',
    icon: '🐦',
    startPercent: 20,
    endPercent: 40,
    description: 'Still early — bragging rights for those who saw it first.',
    urgencyMessage: 'Early Bird discount ending soon! Price increasing steadily!',
    soundEffect: '/sounds/phase-early-bird.mp3',
  },
  {
    index: 2,
    name: 'Cruise Control',
    color: 'from-degen-400 to-yellow-400',
    icon: '🚗',
    startPercent: 40,
    endPercent: 60,
    description: 'Smooth sailing — steady growth, solid momentum building.',
    urgencyMessage: 'Halfway through bonding! Momentum is building!',
    soundEffect: '/sounds/phase-cruise.mp3',
  },
  {
    index: 3,
    name: 'Final Call',
    color: 'from-yellow-400 to-orange-500',
    icon: '📢',
    startPercent: 60,
    endPercent: 80,
    description: 'Last chance to buy before graduation — FOMO is real.',
    urgencyMessage:
      'FINAL CALL! Graduation approaching fast! Last chance for bonding curve prices!',
    soundEffect: '/sounds/phase-final-call.mp3',
  },
  {
    index: 4,
    name: 'Moonshot',
    color: 'from-orange-500 to-red-500',
    icon: '🚀',
    startPercent: 80,
    endPercent: 100,
    description: 'Graduation imminent! Moon or bust — this is it!',
    urgencyMessage: 'MOONSHOT ACTIVE! Graduating to DEX any moment! Final bonding curve buys!',
    soundEffect: '/sounds/phase-moonshot.mp3',
  },
];

// ─── Anti-Exploit Status ─────────────────────────────────────────────────

export interface AntiExploitStatus {
  /** Whether anti-whale is currently limiting this wallet */
  whaleLimited: boolean;
  /** Whether cooldown is active for this wallet */
  cooldownActive: boolean;
  /** Seconds remaining in cooldown */
  cooldownRemaining: number;
  /** Whether wallet fails anti-bot checks */
  botDetected: boolean;
  /** Whether wallet is a known sniper */
  sniperDetected: boolean;
  /** Current wallet % of supply */
  walletSupplyPercent: number;
  /** Maximum allowed per buy */
  maxBuyFormatted: string;
  /** Maximum allowed per wallet */
  maxWalletFormatted: string;
}

// ─── Post-Bonding ────────────────────────────────────────────────────────

export interface PostBondingConfig {
  /** Enable 24h graduation celebration period */
  enableGraduationParty: boolean;
  /** Schedule AMA with creator on graduation */
  enableAMA: boolean;
  /** AMA platform (e.g., 'twitch', 'youtube', 'peertube') */
  amaPlatform?: string;
  /** Liquidity lock duration in seconds */
  liquidityLockDuration: number;
  /** Enable permanent token page */
  enableTokenPage: boolean;
  /** Custom token page URL override */
  tokenPageUrl?: string;
}

export interface PostBondingStatus {
  /** Whether graduation party is active */
  partyActive: boolean;
  /** Party end timestamp */
  partyEndsAt: number;
  /** AMA scheduled timestamp */
  amaScheduledAt?: number;
  /** AMA platform */
  amaPlatform?: string;
  /** AMA link */
  amaLink?: string;
  /** Liquidity locked amount */
  liquidityLocked: string;
  /** Liquidity unlock timestamp */
  liquidityUnlocksAt: number;
  /** Token page URL */
  tokenPageUrl: string;
  /** Leaderboard data */
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  /** Wallet address (truncated for display) */
  address: string;
  /** Amount of tokens held */
  tokens: string;
  /** Rank */
  rank: number;
  /** Whether this is the current user */
  isCurrentUser: boolean;
  /** Badge earned */
  badge?: BadgeType;
}

export type BadgeType =
  | 'first_buyer'
  | 'streak_7'
  | 'whale'
  | 'top_10'
  | 'early_adopter'
  | 'graduation_holder'
  | 'super_fan'
  | 'genesis'
  | 'legendary_whale';

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
  /** Platform fee wallet for DegenFeed */
  platformFeeWallet?: string;
  /** Flashbots relay URL for private mempool */
  flashbotsRelayUrl?: string;
}

// ─── Enforcement Result ──────────────────────────────────────────────────

export interface EnforcementResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Severity of the block */
  severity?: 'info' | 'warning' | 'block';
  /** Additional context */
  details?: Record<string, unknown>;
}
