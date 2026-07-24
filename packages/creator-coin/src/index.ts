/**
 * @degenfeed/creator-coin — Creator Coin System
 *
 * Unified SDK for deploying and trading creator coins
 * across Solana and Base with Zora framework integration.
 *
 * ## Quick Start
 * ```ts
 * import { CreatorCoinClient } from '@degenfeed/creator-coin';
 *
 * const client = new CreatorCoinClient({
 *   solanaKeypair: myKeypair,
 *   evmPrivateKey: '0x...',
 * });
 *
 * // Deploy a coin on Solana with automatic Base wrapping
 * const coin = await client.deployCoin({
 *   name: 'Alice Coin',
 *   symbol: 'ALICE',
 *   uri: 'ipfs://...',
 *   creator: 'AlicePubkey',
 *   chain: 'solana',
 *   creatorAllocationBps: 500,
 *   creatorFeeBps: 100,
 * }, true); // cross-chain = true
 *
 * console.log('Solana mint:', coin.primaryAddress);
 * console.log('Base wrapped:', coin.wrappedAddress);
 * ```
 *
 * ## Architecture
 * - **Solana**: Anchor program with bonding curve (primary)
 * - **Base**: Zora-compatible ERC-20 with bonding curve (wrapped)
 * - **Bridge**: Wormhole-style attestation for cross-chain
 * - **Live Stream**: PeerTube/Owncast integration for live boosts
 * - **Free Posting**: Gasless announcements on Lens/Farcaster/Zora
 */

export {
  CURVE_ERAS,
  calculateMarketCap,
  calculateNativeOut,
  calculateTokensOut,
  formatPrice,
  GRADUATION_SUPPLY,
  getCurrentEra,
  getDynamicPrice,
  getEraName,
  getProgressPercent,
  predictPriceAfterBuys,
  TOTAL_SUPPLY,
} from './bonding-curve';
export type { CreatorCoinClientConfig } from './client';
export { CreatorCoinClient } from './client';
export { CrossChainBridge, getCrossChainMapping, resolveBaseAddress } from './cross-chain/bridge';
export { RegistryClient } from './cross-chain/registry';
export { CreatorCoinEVMClient } from './evm/client';
export {
  calculateFeeSplit,
  DEFAULT_FEES,
  formatFee,
  getDeploymentCost,
  getFeeSummary,
} from './fees';

// ─── Free / Gasless Posting Modules ─────────────────────────────────────

export {
  estimateZoraCoinGas,
  getZoraCoinUrl,
  isCoinDeployed,
  prepareZoraCoinCreation,
} from './zora-free';
export type {
  FreeCoinCreationInput,
  GasEstimate,
  PreparedCoinCreation,
} from './zora-free';

export { LensFreePostClient } from './lens-free';
export type {
  CreatorCoinPost,
  LensFreePostConfig,
  MomokaPostResult,
} from './lens-free';

export { FarcasterFreePostClient, getNeynarFreeTierInfo } from './farcaster-free';
export type {
  CreatorCoinCastInput,
  FarcasterFreePostConfig,
  FarcasterPostMode,
  FreeCastResult,
} from './farcaster-free';

// ─── Live Stream ─────────────────────────────────────────────────────────

export {
  applyLiveBoost,
  LIVE_BOOST_BPS,
  LiveStreamMonitor,
  SUPPORTED_PLATFORMS,
} from './live-stream';
export {
  CreatorCoinSolanaClient,
  deriveBuyerState,
  deriveMintAuthority,
  derivePlatformFeeVault,
  deriveTokenMint,
  deriveTokenState,
  deriveTokenVault,
} from './solana/client';

export type * from './types';
