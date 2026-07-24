/**
 * @degenfeed/creator-coin — Creator Coin 2.0
 *
 * Next-generation creator coin platform — better than Pump.fun and Zora combined.
 *
 * ## Core Features
 * - **Anti-Exploit**: anti-whale, anti-sniper, anti-bot, anti-VC, anti-MEV, bundler detection
 * - **Creator Controls**: vesting, allocation splits, transfer restrictions, burn mechanism
 * - **Bonding Curve 2.0**: 5 phases (Steal Deal → Early Bird → Cruise Control → Final Call → Moonshot)
 * - **Cross-Chain**: Base ETH/Solana with Wormhole bridge
 * - **Post-Bonding**: graduation party, AMA, LP lock, token page, leaderboard
 *
 * ## Quick Start
 * ```ts
 * import { CreatorCoinClient, AntiExploitEngine, CreatorControls } from '@degenfeed/creator-coin';
 *
 * // Create anti-exploit engine
 * const antiExploit = new AntiExploitEngine({ maxBuyBps: 100 });
 *
 * // Create creator controls
 * const config = buildCreatorConfig({
 *   name: 'Alice Coin',
 *   symbol: 'ALICE',
 *   uri: 'ipfs://...',
 *   creator: '0x...',
 *   chain: 'base',
 *   creatorAllocationBps: 500,
 *   creatorFeeBps: 100,
 * });
 *
 * // Check pre-flight
 * const check = await antiExploit.preFlightCheck(
 *   '0x...', buyAmount, tokenInfo, 'base', blockNum, []
 * );
 * if (!check.allowed) throw new Error(check.reason);
 *
 * // Deploy
 * const client = new CreatorCoinClient({ evmPrivateKey: '0x...' });
 * const coin = await client.deployCoin(config, true); // cross-chain
 * ```
 */

// ─── Core ────────────────────────────────────────────────────────────────

export type { CreatorCoinClientConfig } from './client';
export { CreatorCoinClient } from './client';

// ─── Anti-Exploit ────────────────────────────────────────────────────────

export {
  ANTI_EXPLOIT_PRESETS,
  AntiExploitEngine,
  fetchWalletFirstTx,
  generateOnChainAntiExploitCode,
  getKnownSnipers,
  updateSniperRegistry,
} from './anti-exploit';
export type {
  AntiExploitConfig,
  AntiExploitStatus,
  EnforcementResult,
} from './types';

// ─── Creator Controls ────────────────────────────────────────────────────

export {
  areTransfersAllowed,
  buildCreatorConfig,
  calculateAllocations,
  calculateBurn,
  calculateClaimableAmount,
  calculatePlatformFee,
  calculateVestingSchedule,
  generateOnChainCreatorControlsCode,
  validateCreatorControls,
} from './creator-controls';
export type {
  AllocationBreakdown,
  BurnResult,
  CreatorControlConfig,
  TransferRestrictionLevel,
  ValidationError,
  ValidationResult,
  VestingConfig,
  VestingSchedule,
  VestingStage,
} from './types';
export { DEFAULT_CREATOR_CONTROLS, DEFAULT_VESTING_CONFIG } from './types';

// ─── Bonding Curve 2.0 ──────────────────────────────────────────────────

export {
  applyLiveBoost,
  CURVE_ERAS,
  calculateMarketCap,
  calculateNativeOut,
  calculateTokensOut,
  estimateTimeToNextPhase,
  formatPrice,
  GRADUATION_SUPPLY,
  generateCurveSvgPath,
  getBondingPhaseInfo,
  getCurrentEra,
  getDynamicPrice,
  getEraColor,
  getEraIcon,
  getEraName,
  getNextPhase,
  getPhaseByProgress,
  getProgressPercent,
  getVisualProgress,
  MAX_PRICE,
  MIN_PRICE,
  PHASE_ACHIEVEMENTS,
  PRICE_DECIMALS,
  predictPriceAfterBuys,
  SCALING,
  TOTAL_SUPPLY,
} from './bonding-curve';

// ─── Post-Bonding ───────────────────────────────────────────────────────

export {
  buildTokenPage,
  calculateLeaderboard,
  calculateLpLock,
  createGraduationParty,
  determineBadges,
  GRADUATION_PARTY_DURATION,
  generateGraduationCertificate,
  generateOnChainPostBondingCode,
  generatePostBondingStatus,
  getPartyStatus,
  getTimeUntilAMA,
  LEADERBOARD_CATEGORIES,
  MIN_LIQUIDITY_LOCK_DURATION,
  scheduleAMA,
} from './post-bonding';
export type {
  AMASchedule,
  CelebrationEvent,
  GraduationCertificate,
  GraduationFeature,
  GraduationParty,
  LeaderboardCategory,
  LeaderboardConfig,
  LpLockInfo,
  TokenPage,
  TokenPageSection,
} from './types';

// ─── Cross-Chain ─────────────────────────────────────────────────────────

export { CrossChainBridge, getCrossChainMapping, resolveBaseAddress } from './cross-chain/bridge';
export { RegistryClient } from './cross-chain/registry';
export { CreatorCoinEVMClient } from './evm/client';

// ─── Solana ──────────────────────────────────────────────────────────────

export {
  CreatorCoinSolanaClient,
  deriveBuyerState,
  deriveMintAuthority,
  derivePlatformFeeVault,
  deriveTokenMint,
  deriveTokenState,
  deriveTokenVault,
} from './solana/client';

// ─── Fees ────────────────────────────────────────────────────────────────

export {
  calculateFeeSplit,
  DEFAULT_FEES,
  formatFee,
  getDeploymentCost,
  getFeeSummary,
} from './fees';

// ─── Free / Gasless Posting ──────────────────────────────────────────────

export type {
  CreatorCoinCastInput,
  FarcasterFreePostConfig,
  FarcasterPostMode,
  FreeCastResult,
} from './farcaster-free';
export { FarcasterFreePostClient, getNeynarFreeTierInfo } from './farcaster-free';
export type {
  CreatorCoinPost,
  LensFreePostConfig,
  MomokaPostResult,
} from './lens-free';
export { LensFreePostClient } from './lens-free';
export type {
  FreeCoinCreationInput,
  GasEstimate,
  PreparedCoinCreation,
} from './zora-free';
export {
  estimateZoraCoinGas,
  getZoraCoinUrl,
  isCoinDeployed,
  prepareZoraCoinCreation,
} from './zora-free';

// ─── Live Stream ─────────────────────────────────────────────────────────

export {
  applyLiveBoost,
  LIVE_BOOST_BPS,
  LiveStreamMonitor,
  SUPPORTED_PLATFORMS,
} from './live-stream';

// ─── Bonding Phases (display constants) ──────────────────────────────────

export type { BondingPhase, BondingPhaseInfo, VisualProgress } from './types';
export { BONDING_PHASES } from './types';

// ─── All Types ───────────────────────────────────────────────────────────

export type * from './types';
