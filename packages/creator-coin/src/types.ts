/**
 * Creator Coin 2.0 — Shared Types
 *
 * Enhanced type system for the next-generation creator coin platform
 * with anti-exploit, creator controls, bonding curve 2.0, and post-bonding.
 *
 * ## Creator Options (Full Control)
 * - Fee Structure: platform 0.5% fixed, creator 0-4.5%, total 0.5-5%
 * - Vesting: linear/cliff/custom, 0-730 days, early unlock penalties
 * - Allocation: creator 0-90%, labeled wallets, all on-chain
 * - DAO Setup: optional multisig + treasury + voting
 * - Protocol Selection: deploy on 5 chains, add more via DAO vote
 */

// No viem import needed — use native `0x${string}` for addresses

// ═══════════════════════════════════════════════════════════════════════════════
// Chain Selection — Protocol Selection (Requirement 5)
// ═══════════════════════════════════════════════════════════════════════════════

/** Supported chains for primary coin deployment */
export type CreatorChain = 'solana' | 'base' | 'optimism' | 'arbitrum' | 'polygon';

/** Chain info for display */
export interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  explorerUrl: string;
  icon: string;
  rpcUrl: string;
  /** Layer 2 / non-EVM flag */
  isL2: boolean;
  /** Wormhole chain ID for bridging */
  wormholeChainId?: number;
}

export const CHAIN_CONFIG: Record<CreatorChain, ChainInfo> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    explorerUrl: 'https://solscan.io',
    icon: '/chains/solana.svg',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    isL2: false,
    wormholeChainId: 1,
  },
  base: {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    explorerUrl: 'https://basescan.org',
    icon: '/chains/base.svg',
    rpcUrl: 'https://mainnet.base.org',
    isL2: true,
    wormholeChainId: 30,
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    icon: '/chains/optimism.svg',
    rpcUrl: 'https://mainnet.optimism.io',
    isL2: true,
    wormholeChainId: 24,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    icon: '/chains/arbitrum.svg',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    isL2: true,
    wormholeChainId: 23,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    explorerUrl: 'https://polygonscan.com',
    icon: '/chains/polygon.svg',
    rpcUrl: 'https://polygon-rpc.com',
    isL2: false,
    wormholeChainId: 5,
  },
};

// ─── Protocol Selection Configuration ─────────────────────────────────────────

export interface ProtocolSelection {
  /** Primary deployment chain */
  primaryChain: CreatorChain;
  /** Additional chains deployed at launch (via Wormhole bridge) */
  additionalChains: CreatorChain[];
  /** Whether new chains can be added later via DAO vote */
  expandable: boolean;
  /** Minimum DAO vote % required to add a new chain (bps, 0-10000) */
  addChainThresholdBps: number;
}

export const DEFAULT_PROTOCOL_SELECTION: ProtocolSelection = {
  primaryChain: 'base',
  additionalChains: [],
  expandable: true,
  addChainThresholdBps: 6000, // 60% vote required
};

// ═══════════════════════════════════════════════════════════════════════════════
// Fee Structure — Requirement 1
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fee recipient type.
 * - 'creator': fees go to the creator's wallet
 * - 'dao_treasury': fees go to the DAO treasury
 * - 'split': split between creator and treasury at configured ratio
 */
export type FeeRecipientType = 'creator' | 'dao_treasury' | 'split';

export interface FeeRecipientSplit {
  /** Percentage going to creator (bps) */
  creatorShareBps: number;
  /** Percentage going to treasury (bps) — remainder after creator */
}

/** Fee configuration — creator has full control within bounds */
export interface FeeConfig {
  /**
   * Platform fee: ALWAYS 0.5% (50 bps), fixed, goes to DegenFeed.
   * This is the non-negotiable DegenFeed protocol take.
   */
  platformFeeBps: 50;
  /**
   * Creator fee: 0 to 450 bps (0% to 4.5%).
   * Creator chooses this value freely within the range.
   */
  creatorFeeBps: number;
  /**
   * Total buy/sell fee: platformFeeBps + creatorFeeBps.
   * Must be between 50 and 500 bps (0.5% to 5%).
   */
  totalFeeBps: number;
  /** Where the creator fee portion goes */
  feeRecipient: FeeRecipientType;
  /** Fee split configuration (only when feeRecipient === 'split') */
  feeSplit?: FeeRecipientSplit;
  /** Creator wallet address that receives fees (when not going to treasury) */
  feeWallet?: string;
  /** Whether fee parameters can be changed later via DAO vote */
  daoChangeable: boolean;
  /** Minimum vote threshold to change fees (bps, 0-10000) */
  feeChangeThresholdBps: number;
}

export const FIXED_PLATFORM_FEE_BPS = 50; // 0.5% — always

export function createFeeConfig(overrides?: Partial<FeeConfig>): FeeConfig {
  const creatorFeeBps = overrides?.creatorFeeBps ?? 100; // default 1%
  const total = FIXED_PLATFORM_FEE_BPS + creatorFeeBps;
  return {
    platformFeeBps: 50,
    creatorFeeBps,
    totalFeeBps: total,
    feeRecipient: overrides?.feeRecipient ?? 'creator',
    feeSplit: overrides?.feeSplit,
    feeWallet: overrides?.feeWallet,
    daoChangeable: overrides?.daoChangeable ?? true,
    feeChangeThresholdBps: overrides?.feeChangeThresholdBps ?? 5000, // 50% default
  };
}

// ─── Legacy Fee Structure (kept for backward compatibility) ──────────────────

export interface FeeStructure {
  platformFeeBps: number;
  creatorFeeBps: number;
  referralFeeBps: number;
  maxTotalFeeBps: number;
}

export const DEFAULT_FEES: FeeStructure = {
  platformFeeBps: 50,
  creatorFeeBps: 100,
  referralFeeBps: 5,
  maxTotalFeeBps: 500, // Updated to 5% to match new max
};

// ═══════════════════════════════════════════════════════════════════════════════
// Vesting Schedule — Requirement 2
// ═══════════════════════════════════════════════════════════════════════════════

/** When vesting starts */
export type VestingStart = 'deployment' | 'after_bonding';

/** Early unlock penalty configuration */
export interface EarlyUnlockPenalty {
  /** Whether early unlock penalty is enabled */
  enabled: boolean;
  /**
   * What happens to the penalized tokens.
   * - 'burn': tokens are burned (reduces supply)
   * - 'redistribute': tokens go to community treasury
   */
  action: 'burn' | 'redistribute';
  /** Penalty percentage in bps (0-10000, e.g. 2000 = 20%) */
  penaltyBps: number;
  /**
   * Duration in seconds before vesting end where penalty applies.
   * If creator claims within this window, penalty is applied.
   */
  windowSeconds: number;
}

export interface VestingConfig {
  /** Vesting duration in seconds (0 to 730 days = 63_072_000) */
  duration: number;
  /** Cliff duration in seconds (0 = no cliff) */
  cliffDuration: number;
  /** Initial unlock percentage in bps (0-2000 = 0-20%) */
  initialUnlockBps: number;
  /** Whether vesting is linear vs. staged */
  type: 'linear' | 'staged' | 'cliff';
  /** For staged vesting: array of (timeFromStart, unlockBps) pairs */
  stages?: Array<{ timeSeconds: number; unlockBps: number }>;
  /** When vesting starts counting */
  vestingStart: VestingStart;
  /** Early unlock penalty (optional) */
  earlyUnlockPenalty?: EarlyUnlockPenalty;
}

export const DEFAULT_VESTING_CONFIG: VestingConfig = {
  duration: 90 * 24 * 60 * 60, // 90 days
  cliffDuration: 0,
  initialUnlockBps: 0,
  type: 'linear',
  vestingStart: 'deployment',
};

// ─── Vesting Schedule Limits ─────────────────────────────────────────────────

export const VESTING_CONSTANTS = {
  MIN_DURATION_SECONDS: 0,
  MAX_DURATION_SECONDS: 730 * 24 * 60 * 60, // 730 days
  MAX_INITIAL_UNLOCK_BPS: 2000, // 20%
  MAX_CLIFF_DURATION_SECONDS: 365 * 24 * 60 * 60, // 365 days max cliff
  MAX_EARLY_PENALTY_BPS: 5000, // 50% max penalty
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Creator Allocation — Requirement 3
// ═══════════════════════════════════════════════════════════════════════════════

/** Label for on-chain wallet transparency — every wallet is labeled */
export type WalletLabel =
  | 'creator'
  | 'community'
  | 'liquidity'
  | 'treasury'
  | 'fee_recipient'
  | 'team'
  | 'advisors'
  | 'marketing'
  | 'ecosystem'
  | 'airdrop';

/** Labeled allocation entry — stored on-chain for full transparency */
export interface LabeledAllocation {
  label: WalletLabel;
  /** Address receiving the allocation */
  address: string;
  /** Percentage of supply in bps */
  allocationBps: number;
  /** Whether this allocation has vesting */
  vesting?: VestingConfig;
  /** Human-readable identifier for the recipient */
  name?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Creator Controls 2.0 — Full Control (Requirements 1-5)
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatorControlConfig {
  // ── Vesting ──────────────────────────────────────────────────────────────
  /** Vesting schedule configuration */
  vesting: VestingConfig;

  // ── Allocation (Requirement 3: 0-90% creator, rest transparent) ──────────
  /** Percentage of supply allocated to creator (0-9000 bps = 0-90%) */
  creatorAllocationBps: number;
  /** Percentage going to LP (auto-calculated for Uniswap/Curve) */
  liquidityAllocationBps: number;
  /** Percentage going to community (remainder after creator + LP) */
  communityAllocationBps: number;
  /** Percentage going to DAO treasury (0-2000 bps = 0-20%) */
  treasuryAllocationBps: number;
  /** Additional labeled allocations for full transparency */
  labeledAllocations: LabeledAllocation[];

  // ── Fee Structure (Requirement 1) ────────────────────────────────────────
  feeConfig: FeeConfig;

  // ── DAO Setup (Requirement 4) ────────────────────────────────────────────
  /** Whether to create a DAO at deployment */
  enableDAO: boolean;
  /** DAO configuration (only when enableDAO === true) */
  daoConfig?: DAODeploymentConfig;

  // ── Protocol Selection (Requirement 5) ───────────────────────────────────
  protocolSelection: ProtocolSelection;

  // ── Legacy / Existing Features ───────────────────────────────────────────
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
}

// ─── Default Creator Controls ────────────────────────────────────────────────

export const DEFAULT_CREATOR_CONTROLS: CreatorControlConfig = {
  vesting: DEFAULT_VESTING_CONFIG,
  creatorAllocationBps: 1000, // 10%
  liquidityAllocationBps: 6000, // 60%
  communityAllocationBps: 2000, // 20%
  treasuryAllocationBps: 500, // 5% — legacy default
  labeledAllocations: [],
  feeConfig: createFeeConfig({ creatorFeeBps: 100 }),
  enableDAO: false,
  protocolSelection: DEFAULT_PROTOCOL_SELECTION,
  restrictTransfersDuringBonding: true,
  burnUnsoldTokens: true,
  enableAntiWhale: true,
  lockLiquidity: true,
  liquidityLockDuration: 30 * 24 * 60 * 60, // 30 days
};

// ═══════════════════════════════════════════════════════════════════════════════
// DAO Deployment Config — Requirement 4
// ═══════════════════════════════════════════════════════════════════════════════

/** DAO setup — optional at deployment */
export interface DAODeploymentConfig {
  /** DAO name (e.g. "Alice Ecosystem DAO") */
  name: string;
  /** Description / mission statement */
  description: string;
  /** Template to use ('investment' | 'creator' | 'protocol' | 'social') */
  template: DAOTemplateType;
  /** Multisig signers for the treasury multisig */
  multisigSigners: string[];
  /** Number of signers required for execution */
  multisigThreshold: number;
  /** Treasury funded with % of supply (bps, 0-2000) */
  treasuryFundingBps: number;
  /** Voting parameters */
  voting: DAOVotingParams;
  /** Whether to enable DegenFeed DAO management service ($X/mo) */
  enableManagedService: boolean;
  /** Monthly fee for managed service in USD */
  managedServiceFeeUsd: number;
  /** Emergency pause multi-sig — trusted signers who can pause trading */
  emergencyPauseSigners: string[];
  /** Number of emergency pause signers required */
  emergencyPauseThreshold: number;
  /** Whether this DAO can update fee parameters */
  canUpdateFees: boolean;
  /** Whether this DAO can update parameter limits */
  canUpdateParameters: boolean;
  /** Whether this DAO can spend treasury */
  canSpendTreasury: boolean;
}

/** DAO template types — reused from dao/types.ts but defined locally to avoid circular deps */
export type DAOTemplateType = 'investment' | 'creator' | 'protocol' | 'social';

/** DAO voting parameters */
export interface DAOVotingParams {
  /** Voting period in seconds (default: 7 days = 604800) */
  votingPeriod: number;
  /** Delay before voting starts in seconds */
  votingDelay: number;
  /** Minimum % of total voting power required for quorum (0-100) */
  quorumPercent: number;
  /** Minimum % of token supply needed to create a proposal */
  proposalThreshold: number;
  /** % of votes required for approval (simple majority = 51) */
  approvalThreshold: number;
  /** Allow vote delegation */
  allowDelegation: boolean;
}

export const DEFAULT_DAO_VOTING_PARAMS: DAOVotingParams = {
  votingPeriod: 604800, // 7 days
  votingDelay: 86400, // 1 day
  quorumPercent: 10,
  proposalThreshold: 1, // 1%
  approvalThreshold: 51,
  allowDelegation: true,
};

export const DEFAULT_DAO_CONFIG: DAODeploymentConfig = {
  name: '',
  description: '',
  template: 'creator',
  multisigSigners: [],
  multisigThreshold: 2,
  treasuryFundingBps: 1000, // 10%
  voting: DEFAULT_DAO_VOTING_PARAMS,
  enableManagedService: false,
  managedServiceFeeUsd: 0,
  emergencyPauseSigners: [],
  emergencyPauseThreshold: 2,
  canUpdateFees: true,
  canUpdateParameters: true,
  canSpendTreasury: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Creator Options Builder — Full Summary
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete creator options — all configurable parameters in one place.
 * This is the "Creator Options" UI model that maps 1:1 to the configuration screens.
 */
export interface CreatorOptions {
  // ── Token Info ──────────────────────────────────────────────────────────
  name: string;
  symbol: string;
  uri: string;

  // ── Fee Structure (Requirement 1) ───────────────────────────────────────
  fee: {
    platformFeePercent: 0.5; // Fixed, non-negotiable
    creatorFeePercent: number; // 0% to 4.5%
    totalFeePercent: number; // 0.5% to 5%
    feeRecipient: FeeRecipientType;
    feeWallet?: string;
    daoChangeable: boolean;
  };

  // ── Vesting (Requirement 2) ────────────────────────────────────────────
  vesting: {
    type: 'linear' | 'cliff' | 'custom';
    start: VestingStart;
    durationDays: number; // 0 to 730
    cliffDays: number;
    initialUnlockPercent: number; // 0% to 20%
    stages?: Array<{ day: number; unlockPercent: number }>;
    earlyUnlockPenalty?: {
      enabled: boolean;
      action: 'burn' | 'redistribute';
      penaltyPercent: number;
      beforeEndDays: number;
    };
  };

  // ── Allocation (Requirement 3) ──────────────────────────────────────────
  allocation: {
    creatorPercent: number; // 0% to 90%
    liquidityPercent: number; // Auto-calculated for Uniswap/Curve
    communityPercent: number; // Remainder
    treasuryPercent: number; // 0% to 20%
    labeledWallets: Array<{
      label: WalletLabel;
      address: string;
      percent: number;
      name?: string;
    }>;
  };

  // ── DAO Setup (Requirement 4) ──────────────────────────────────────────
  dao: {
    enabled: boolean;
    name?: string;
    description?: string;
    template?: DAOTemplateType;
    multisigSigners?: string[];
    multisigThreshold?: number;
    treasuryPercent?: number;
    votingPeriodDays?: number;
    quorumPercent?: number;
    managedService?: {
      enabled: boolean;
      monthlyFeeUsd: number;
    };
    emergencyPause?: {
      signers: string[];
      threshold: number;
    };
  };

  // ── Protocol Selection (Requirement 5) ──────────────────────────────────
  protocol: {
    primaryChain: CreatorChain;
    additionalChains: CreatorChain[];
    expandable: boolean;
  };

  // ── Existing Features ──────────────────────────────────────────────────
  restrictions: {
    restrictTransfersDuringBonding: boolean;
    burnUnsoldTokens: boolean;
    enableAntiWhale: boolean;
    lockLiquidity: boolean;
    liquidityLockDays: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Coin Configuration
// ═══════════════════════════════════════════════════════════════════════════════

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
  /** Creator fee on trades in bps (0-200 = 0-2%) — LEGACY, use creatorControls.feeConfig */
  creatorFeeBps: number;
  /** Platform fee in bps (default 50 = 0.5%) */
  platformFeeBps?: number;
  /** Referrer address (optional) */
  referrer?: string;
  /** Creator Controls 2.0 — overrides legacy creatorAllocationBps & creatorFeeBps */
  creatorControls?: CreatorControlConfig;
  /** Anti-exploit configuration */
  antiExploit?: AntiExploitConfig;
  /** Post-bonding configuration */
  postBonding?: PostBondingConfig;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Anti-Exploit Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface AntiExploitConfig {
  /** Master enable/disable switch */
  enabled: boolean;
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
  /** Flashbots relay URL (optional) */
  flashbotsRelayUrl?: string;
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
  enabled: true,
  maxBuyBps: 100, // 1%
  maxWalletBps: 50, // 0.5%
  buyCooldownSeconds: 30, // 30 seconds
  minWalletAgeSeconds: 7 * 24 * 60 * 60, // 7 days
  minTransactionCount: 5,
  usePrivateMempool: true,
  flashbotsRelayUrl: 'https://relay.flashbots.net',
  detectBundlers: true,
  maxBuysPerBlock: 3,
  blockKnownSnipers: true,
  knownSniperAddresses: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Deploy Response & Trading
// ═══════════════════════════════════════════════════════════════════════════════

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
  /** Creator controls used */
  creatorControls?: CreatorControlConfig;
  /** Labeled allocations with addresses */
  labeledWallets?: LabeledWalletOnChain[];
}

export interface LabeledWalletOnChain {
  label: WalletLabel;
  address: string;
  allocationBps: number;
  name?: string;
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
  /** Creator fee taken */
  creatorFee?: string;
  /** Fee recipient address */
  feeRecipient?: string;
  /** Explorer URL */
  explorerUrl: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Token Info
// ═══════════════════════════════════════════════════════════════════════════════

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
    feeConfig: FeeConfig;
    allocations: {
      creator: number;
      liquidity: number;
      community: number;
      treasury: number;
    };
    labeledWallets?: LabeledWalletOnChain[];
  };
  /** Post-bonding status */
  postBonding?: PostBondingStatus;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-Chain
// ═══════════════════════════════════════════════════════════════════════════════

export interface CrossChainMapping {
  /** Primary chain address */
  primaryAddress: string;
  /** Primary chain */
  primaryChain: CreatorChain;
  /** Solana mint address (primary) — LEGACY, use primaryAddress */
  solanaMint: string;
  /** Base wrapped contract address — LEGACY, use wrappedAddresses.base */
  baseWrapped: string;
  /** Mapping of chain -> wrapped address */
  wrappedAddresses: Partial<Record<CreatorChain, string>>;
  /** Creator wallet */
  creator: string;
  /** Bridge attestation hashes per chain */
  attestationHashes: Partial<Record<CreatorChain, string>>;
  /** Bridge attestation hash — LEGACY */
  attestationHash: string;
  /** Timestamp of registration */
  registeredAt: number;
}

export interface CrossChainPrice {
  /** LEGACY: Solana price */
  solana: { price: string; usd: number };
  /** LEGACY: Base price */
  base: { price: string; usd: number };
  /** All chain prices */
  prices: Record<CreatorChain, { price: string; usd: number }>;
  diffPercent: number;
  arbitrageProfitable: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Live Stream
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Events
// ═══════════════════════════════════════════════════════════════════════════════

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
  /** All labeled wallets at deployment */
  labeledWallets?: LabeledWalletOnChain[];
}

export interface TradeEvent {
  trader: string;
  isBuy: boolean;
  tokenAmount: string;
  nativeValue: string;
  price: string;
  /** Platform fee collected */
  platformFee: string;
  /** Creator fee collected */
  creatorFee: string;
  /** Fee recipient for this trade */
  feeRecipient: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Bonding Curve 2.0
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Anti-Exploit Status
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// Post-Bonding
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Post-Bonding Types (used by post-bonding.ts) ─────────────────────────────

export interface AMASchedule {
  platform: string;
  scheduledAt: number;
  durationMinutes: number;
  title: string;
  description: string;
  hostAddress: string;
  link?: string;
}

export interface CelebrationEvent {
  type: 'party' | 'ama' | 'burn' | 'airdrop';
  name: string;
  description: string;
  startsAt: number;
  endsAt: number;
  completed: boolean;
}

export interface GraduationCertificate {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  creator: string;
  graduatedAt: number;
  finalPrice: string;
  totalRaised: string;
  uniqueBuyers: number;
  certificateHash: string;
}

export interface GraduationFeature {
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
}

export interface GraduationParty {
  active: boolean;
  endsAt: number;
  celebrations: CelebrationEvent[];
  specialPrices: boolean;
  boostedRewards: boolean;
}

export interface LeaderboardCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortBy: 'tokens' | 'trades' | 'referrals' | 'early';
}

export interface LeaderboardConfig {
  enabled: boolean;
  categories: LeaderboardCategory[];
  maxEntries: number;
  refreshInterval: number;
}

export interface LpLockInfo {
  locked: boolean;
  amount: string;
  unlockTimestamp: number;
  lockDuration: number;
  dexPool: string;
}

export interface TokenPage {
  enabled: boolean;
  url: string;
  sections: TokenPageSection[];
  customDomain?: string;
}

export interface TokenPageSection {
  type: 'hero' | 'about' | 'chart' | 'leaderboard' | 'holders' | 'links' | 'custom';
  title: string;
  content: string;
  order: number;
  visible: boolean;
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatorCoinClientConfig {
  /** Solana RPC URL */
  solanaRpcUrl?: string;
  /** Base RPC URL */
  baseRpcUrl?: string;
  /** Arbitrum RPC URL */
  arbitrumRpcUrl?: string;
  /** Optimism RPC URL */
  optimismRpcUrl?: string;
  /** Polygon RPC URL */
  polygonRpcUrl?: string;
  /** Private key for signing (optional — use wallet adapter in UI) */
  privateKey?: string;
  /** Platform fee wallet for DegenFeed */
  platformFeeWallet?: string;
  /** Flashbots relay URL for private mempool */
  flashbotsRelayUrl?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Enforcement Result
// ═══════════════════════════════════════════════════════════════════════════════

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
