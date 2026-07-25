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

export type {
  BadgeInfo,
  BadgeType,
  BurnEvent,
  MilestoneReached,
  OneClickBuyState,
  PhaseLimit,
  PriceAlert,
  RecurringBuy,
  ReferralData,
  SocialProofData,
  WhaleAlert,
} from './anti-exploit';
// ─── Anti-Exploit & Gamification ──────────────────────────────────────────
export {
  BADGE_DEFINITIONS,
  BONDING_MILESTONES,
  calculateBurnEffect,
  checkBuyLimit,
  classifyWhale,
  computeBadges,
  generateShareLink,
  getNextMilestone,
  getPhaseLimits,
  getReachedMilestones,
} from './anti-exploit';
export type {
  CreatorEvent,
  CurveEra,
  CurveState,
  FlashSale,
  ReferralBoost,
} from './bonding-curve';
// ─── Dynamic Bonding Curve ─────────────────────────────────────────────────
export {
  applyCreatorEventDiscount,
  applyFlashSaleDiscount,
  buysUntilPriceTarget,
  CURVE_ERAS,
  calculateEthOut,
  calculateFlashSaleDiscount,
  calculateMarketCap,
  calculateStreakBonus,
  calculateTokensOut,
  formatCurvePrice,
  GRADUATION_SUPPLY,
  getCurrentEra,
  getDynamicPrice,
  getEraColor,
  getEraName,
  getGraduationProgress,
  getProgressPercent,
  getStreakMultiplier,
  isStreakAlive,
  MAX_PRICE,
  MIN_PRICE,
  predictPriceAfterBuys,
  TOTAL_SUPPLY,
} from './bonding-curve';
export type {
  CrossChainMapping,
  CrossChainToken,
  KVStore,
  UnifiedCreatorProfile,
} from './cross-chain/registry';
// ─── Cross-Chain Registry ────────────────────────────────────────────────────
export { CrossChainRegistry, createCrossChainRegistry } from './cross-chain/registry';
export type {
  CrossNetworkOpts,
  CrossNetworkResult,
  PrimaryChain,
} from './cross-network';
// ─── Cross-Network Deployer ─────────────────────────────────────────────────
export {
  deployCrossNetwork,
  deployDualChainCoin,
  deployWormholeWrapper,
  getDeploymentCostBreakdown,
  getDualChainPrice,
  registerForZoraVisibility,
} from './cross-network';
export type {
  ClaimRewardsResult,
  CreatorEarningsSummary,
  EarningsSource,
  NFTSalesHistory,
  ProtocolRewardsInfo,
  TipEvent,
  ZoraEarnings,
} from './earnings';
export { ZoraEarnings } from './earnings';
// ─── Zora 2026 Coins Protocol (ETH pair — ZORA token stripped) ─────────────
// ─── EVM exports (legacy) ───────────────────────────────────────────────────
export {
  DEGENFEED_PLATFORM_FEE_BPS,
  EvmCreatorTokenClient,
  ZORA_FACTORY_ADDRESS,
  ZoraCreatorCoinClient,
} from './evm';
export type {
  BuyNowParams,
  CollectionFloorInfo,
  MakeOfferParams,
  MarketplaceBid,
  MarketplaceListing,
  PlaceBidParams,
  PricePoint,
  TradeResult,
  TrendingQuery,
  ZoraMarketplace,
} from './marketplace';
export { ZoraMarketplace } from './marketplace';
export type {
  CreateCollectionResult,
  GaslessMintConfig,
  MintNFTResult,
  UploadMetadataResult,
  ZoraCollectionConfig,
  ZoraNFTMintConfig,
  ZoraNFTMinter,
} from './nft-mint';
export { ZoraNFTMinter } from './nft-mint';
export type { FeeSplit } from './platform-fees';
// ─── Platform Fee Collection (all fees in ETH, never ZORA) ─────────────────
export {
  calculateFee,
  calculateFeeInEth,
  calculateFeeSplit,
  calculateVestingPlatformFee,
  collectPlatformFee,
  formatBps,
  formatFee,
  PLATFORM_FEE_BPS,
  PLATFORM_TREASURY,
} from './platform-fees';
// ─── Solana exports ─────────────────────────────────────────────────────────
export {
  deriveBuyerState,
  deriveMintAuthority,
  derivePlatformFeeVault,
  deriveRecipientState,
  deriveTokenMint,
  deriveTokenState,
  deriveTokenVault,
  deriveVestingVault,
  PROGRAM_ID,
  SolanaCreatorTokenSDK,
} from './solana';
// ─── Dual-Chain (One Coin, Two Networks) ────────────────────────────────────
export {
  collectTokenGenerationFee,
  getFeePaymentStatus,
  getTokenGenerationFee,
  PLATFORM_FEE_WALLET_EVM,
  PLATFORM_FEE_WALLET_SOLANA,
  TOKEN_GENERATION_FEE_ETH,
  TOKEN_GENERATION_FEE_SOL,
  TOKEN_GENERATION_FEE_USD,
  verifyTokenGenerationFee,
} from './token-fees';
// ─── Types ──────────────────────────────────────────────────────────────────
export type * from './types';
export type {
  CostBreakdown,
  DualChainCoin,
  DualChainCoinConfig,
  DualChainDeployResult,
  DualChainPrice,
  FeePaymentStatus,
} from './types';
export type {
  VestingConfig,
  VestingPreset,
  VestingSchedulePoint,
} from './vesting/types';
// ─── Vesting Presets ──────────────────────────────────────────────────────
export {
  generateVestingSchedule,
  getAvailableVestingPresets,
  VESTING_PRESETS,
  validateVestingConfig,
} from './vesting/types';
export type {
  AnnounceResult,
  CollectResult,
  MintResult,
  MintVideoOptions,
  PinataConfig,
  TipResult,
  TrendingQuery,
  VideoMetadata,
  VideoUploadResult,
  ZoraVideoNFT,
  ZoraVideoSDKConfig,
} from './video';
// ─── Zora Video NFT SDK ──────────────────────────────────────────────────────
export {
  buildVideoMetadata,
  metadataToDataUri,
  uploadMetadataToIpfs,
  uploadToIpfs,
  ZoraVideoSDK,
} from './video';
export type { ZoraComment } from './zora-api';
// ─── Zora Coins API ─────────────────────────────────────────────────────────
export {
  fetchZoraBatchPrices,
  fetchZoraCoinInfo,
  fetchZoraCreatorCoins,
  fetchZoraLiveComments,
  fetchZoraTrendingCoins,
} from './zora-api';

// ─── Legacy Math Functions (keep for backwards compat) ─────────────────────

/**
 * @deprecated Use `getDynamicPrice` from the new bonding curve module.
 * This linear function is kept for backward compatibility.
 */
export function getCurrentPrice(totalSupplyIssued: bigint): bigint {
  const _TOTAL_SUPPLY = 1_000_000_000_000_000_000n;
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
