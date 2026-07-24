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
 */

export { CreatorCoinClient } from './client';
export type { CreatorCoinClientConfig } from './client';

export { CreatorCoinEVMClient } from './evm/client';
export { CreatorCoinSolanaClient } from './solana/client';
export {
  deriveTokenState,
  deriveTokenMint,
  deriveMintAuthority,
  deriveTokenVault,
  deriveBuyerState,
  derivePlatformFeeVault,
} from './solana/client';

export { CrossChainBridge, getCrossChainMapping, resolveBaseAddress } from './cross-chain/bridge';
export { RegistryClient } from './cross-chain/registry';

export { LiveStreamMonitor, LIVE_BOOST_BPS, SUPPORTED_PLATFORMS, applyLiveBoost } from './live-stream';

export {
  getDynamicPrice,
  getCurrentEra,
  getEraName,
  getProgressPercent,
  calculateTokensOut,
  calculateNativeOut,
  formatPrice,
  calculateMarketCap,
  predictPriceAfterBuys,
  GRADUATION_SUPPLY,
  TOTAL_SUPPLY,
  CURVE_ERAS,
} from './bonding-curve';

export { calculateFeeSplit, getDeploymentCost, formatFee, getFeeSummary, DEFAULT_FEES } from './fees';

export type * from './types';
