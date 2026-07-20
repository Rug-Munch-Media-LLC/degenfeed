/**
 * DegenFeed Creator Token SDK
 *
 * Unified SDK for creating and trading creator tokens across chains.
 * - **EVM (Base)**: Zora 2026 Coins Protocol — creator coins on Base via ZoraFactory
 * - **Solana**: Custom Anchor program with bonding curve
 *
 * Our coins deploy through ZoraFactory so they appear on zora.co natively.
 * Users can login to Zora and see their coin. Third-party apps that integrate
 * with Zora's API will see our coins automatically.
 *
 * ## Usage
 * ```ts
 * import { ZoraCreatorCoinClient } from '@degenfeed/zora-sdk';
 *
 * const zora = new ZoraCreatorCoinClient({ rpcUrl: '...', privateKey: '...' });
 * const coin = await zora.deployCreatorCoin({
 *   name: 'Alice Coin',
 *   symbol: 'ALICE',
 *   ...
 * });
 * console.log('View on Zora:', coin.zoraUrl);
 * ```
 */

// ─── Zora 2026 Coins Protocol (ETH pair — ZORA token stripped) ─────────────
export { ZoraCreatorCoinClient, ZORA_FACTORY_ADDRESS, DEGENFEED_PLATFORM_FEE_BPS } from './evm';

// ─── Zora Coins API ─────────────────────────────────────────────────────────
export {
  fetchZoraTrendingCoins,
  fetchZoraCoinInfo,
  fetchZoraCreatorCoins,
  fetchZoraBatchPrices,
  fetchZoraLiveComments,
} from './zora-api';
export type { ZoraComment } from './zora-api';

// ─── Cross-Network Deployer ─────────────────────────────────────────────────
export { deployCrossNetwork, deployWormholeWrapper, registerForZoraVisibility } from './cross-network';
export type { PrimaryChain, CrossNetworkOpts, CrossNetworkResult } from './cross-network';

// ─── Platform Fee Collection (all fees in ETH, never ZORA) ─────────────────
export {
  PLATFORM_FEE_BPS,
  PLATFORM_TREASURY,
  calculateFee,
  calculateFeeSplit,
  collectPlatformFee,
  calculateVestingPlatformFee,
  formatBps,
  calculateFeeInEth,
  formatFee,
} from './platform-fees';
export type { FeeSplit } from './platform-fees';

// ─── Solana exports ─────────────────────────────────────────────────────────
export {
  SolanaCreatorTokenSDK,
  deriveTokenState,
  deriveTokenMint,
  deriveMintAuthority,
  deriveTokenVault,
  deriveBuyerState,
  deriveVestingVault,
  deriveRecipientState,
  derivePlatformFeeVault,
  PROGRAM_ID,
} from './solana';

// ─── EVM exports (legacy) ───────────────────────────────────────────────────
export { EvmCreatorTokenClient } from './evm';

// ─── Types ──────────────────────────────────────────────────────────────────
export type * from './types';

// ─── Zora Video NFT SDK ──────────────────────────────────────────────────────
export { ZoraVideoSDK, buildVideoMetadata, uploadToIpfs, uploadMetadataToIpfs, metadataToDataUri } from './video';
export type {
	ZoraVideoSDKConfig,
	VideoMetadata,
	VideoUploadResult,
	MintVideoOptions,
	MintResult,
	ZoraVideoNFT,
	CollectResult,
	TipResult,
	AnnounceResult,
	PinataConfig,
	TrendingQuery,
} from './video';

// ─── Cross-Chain Registry ────────────────────────────────────────────────────
export { CrossChainRegistry, createCrossChainRegistry } from './cross-chain/registry';
export type {
  CrossChainMapping,
  CrossChainToken,
  UnifiedCreatorProfile,
  KVStore,
} from './cross-chain/registry';

// ─── Dynamic Bonding Curve ─────────────────────────────────────────────────
export {
  getDynamicPrice,
  getCurrentEra,
  getEraName,
  getEraColor,
  calculateTokensOut,
  calculateEthOut,
  applyFlashSaleDiscount,
  calculateFlashSaleDiscount,
  applyCreatorEventDiscount,
  getStreakMultiplier,
  calculateStreakBonus,
  isStreakAlive,
  predictPriceAfterBuys,
  buysUntilPriceTarget,
  getGraduationProgress,
  getProgressPercent,
  formatCurvePrice,
  calculateMarketCap,
  CURVE_ERAS,
  TOTAL_SUPPLY,
  GRADUATION_SUPPLY,
  MIN_PRICE,
  MAX_PRICE,
} from './bonding-curve';

export type {
  CurveEra,
  FlashSale,
  CreatorEvent,
  ReferralBoost,
  CurveState,
} from './bonding-curve';

// ─── Anti-Exploit & Gamification ──────────────────────────────────────────
export {
  getPhaseLimits,
  checkBuyLimit,
  computeBadges,
  classifyWhale,
  getReachedMilestones,
  getNextMilestone,
  generateShareLink,
  calculateBurnEffect,
  BADGE_DEFINITIONS,
  BONDING_MILESTONES,
} from './anti-exploit';

export type {
  PhaseLimit,
  BadgeType,
  BadgeInfo,
  WhaleAlert,
  MilestoneReached,
  SocialProofData,
  ReferralData,
  OneClickBuyState,
  RecurringBuy,
  PriceAlert,
  BurnEvent,
} from './anti-exploit';

// ─── Vesting Presets ──────────────────────────────────────────────────────
export {
  VESTING_PRESETS,
  getAvailableVestingPresets,
  validateVestingConfig,
  generateVestingSchedule,
} from './vesting/types';
export type {
  VestingConfig,
  VestingPreset,
  VestingSchedulePoint,
} from './vesting/types';

// ─── Legacy Math Functions (keep for backwards compat) ─────────────────────

/**
 * @deprecated Use `getDynamicPrice` from the new bonding curve module.
 * This linear function is kept for backward compatibility.
 */
export function getCurrentPrice(totalSupplyIssued: bigint): bigint {
  const TOTAL_SUPPLY = 1_000_000_000_000_000_000n;
  const GRADUATION_SUPPLY = 800_000_000_000_000_000n;
  const MIN_PRICE = 1n;
  const MAX_PRICE = 1_000n;
  const SCALING = 1_000_000_000n;

  const capped = totalSupplyIssued < GRADUATION_SUPPLY ? totalSupplyIssued : GRADUATION_SUPPLY;
  const progress = (capped * SCALING) / GRADUATION_SUPPLY;
  const priceRange = MAX_PRICE - MIN_PRICE;
  return MIN_PRICE + (priceRange * progress) / SCALING;
}

/**
 * @deprecated Use `calculateTokensOut` from the bonding curve module.
 */
export function calculateTokensOutLegacy(amountSol: bigint, price: bigint): bigint {
  const SCALING = 1_000_000_000n;
  if (price === 0n) return 0n;
  return (amountSol * SCALING) / price;
}

/**
 * @deprecated Use `calculateEthOut` from the bonding curve module.
 */
export function calculateSolOut(
  tokensIn: bigint,
  price: bigint,
): { netSolOut: bigint; platformFee: bigint } {
  const SCALING = 1_000_000_000n;
  if (price === 0n) return { netSolOut: 0n, platformFee: 0n };

  const grossSol = (tokensIn * price) / SCALING;
  const platformFee = (grossSol * 50n) / 10_000n;
  const netSolOut = grossSol - platformFee;

  return { netSolOut, platformFee };
}

/**
 * @deprecated Use `getPhaseLimits` from the anti-exploit module.
 */
export function getPhaseLimit(elapsedSeconds: number): number {
  if (elapsedSeconds < 300) return 200;
  if (elapsedSeconds < 1_800) return 500;
  if (elapsedSeconds < 86_400) return 1_000;
  return 1_500;
}

/**
 * @deprecated Use `getPhaseLimits` from the anti-exploit module.
 */
export function getPhaseMaxBuy(elapsedSeconds: number): bigint {
  const GRADUATION_SUPPLY = 800_000_000_000_000_000n;
  const limitBps = getPhaseLimit(elapsedSeconds);
  return (GRADUATION_SUPPLY * BigInt(limitBps)) / 10_000n;
}
