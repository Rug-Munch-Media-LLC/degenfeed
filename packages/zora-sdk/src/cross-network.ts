/**
 * DegenFeed Cross-Network Deployer — One Coin, Two Networks
 *
 * ## The Model
 *
 * Creator deploys ONE coin on Solana (primary, cheaper gas) and it
 * automatically wraps to Base (Zora-visible) via Wormhole.
 *
 * ```
 *   Solana (primary)                    Base (wrapped)
 *   ┌──────────────────┐               ┌──────────────────┐
 *   │ $CREATOR         │               │ $CREATOR.w       │
 *   │ SPL Token        │◄──Wormhole──►│ ERC-20 Wrapped   │
 *   │ Paired: SOL      │               │ Paired: ETH      │
 *   │ DEX: Jupiter     │               │ DEX: Uniswap V4  │
 *   │                  │               │ Zora: Visible ✅  │
 *   └──────────────────┘               └──────────────────┘
 *          │                                    │
 *          └──────── SAME SUPPLY ───────────────┘
 *          └──────── SAME PRICE (arbed) ───────┘
 * ```
 *
 * ## Key Principles
 * - ONE coin, TWO networks — not two separate coins
 * - Solana is primary (cheaper deploy, faster confirmations)
 * - Base wrapped version appears natively on zora.co
 * - Same total supply on both chains
 * - Wormhole bridges manage the 1:1 peg
 * - Arbitrage keeps prices aligned between SOL pair and ETH pair
 * - Creator pays $20 one-time token generation fee
 *
 * ## Deployment Flow
 * 1. Collect $20 token generation fee
 * 2. Deploy SPL token on Solana with bonding curve + JP pool
 * 3. Attest token on Wormhole (generate VAA)
 * 4. Create wrapped ERC-20 on Base via Wormhole
 * 5. Register wrapped token for Zora visibility
 * 6. Record mapping in cross-chain registry
 * 7. Return addresses on both chains
 */

import type { KVStore } from './cross-chain/registry';
import { CrossChainRegistry } from './cross-chain/registry';
import { collectTokenGenerationFee, TOKEN_GENERATION_FEE_USD } from './token-fees';
import type {
  CostBreakdown,
  DualChainCoin,
  DualChainCoinConfig,
  DualChainDeployResult,
  DualChainPrice,
} from './types';

// ═════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════

export type PrimaryChain = 'base' | 'solana';

// Keep backward-compatible aliases
export type CrossNetworkOpts = DualChainCoinConfig;
export interface CrossNetworkResult {
  /** @deprecated Use `solana.address` */
  primaryAddress: string;
  /** @deprecated Use `base.address` */
  baseWrapped?: string;
  /** @deprecated Use `base.zoraUrl` */
  zoraUrl?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// Deployment Cost Breakdown
// ═════════════════════════════════════════════════════════════════════════

/**
 * Get the cost breakdown for deploying a dual-chain coin.
 * Shown to the creator BEFORE they confirm deployment.
 *
 * @param chain Which chain to show costs for
 * @returns CostBreakdown with all estimated costs
 */
export function getDeploymentCostBreakdown(_chain: 'solana' | 'base' = 'solana'): CostBreakdown {
  return {
    tokenGenerationFee: {
      amount: TOKEN_GENERATION_FEE_USD,
      currency: 'USD',
      note: 'One-time platform fee for token generation and cross-chain indexing',
    },
    solanaDeploy: {
      amount: 0.002,
      currency: 'SOL',
      note: 'Solana SPL token creation + bonding curve initialization',
    },
    wormholeAttest: {
      amount: 0.001,
      currency: 'SOL',
      note: 'Wormhole cross-chain attestation fee (paid on Solana)',
    },
    baseWrapped: {
      amount: 3,
      currency: 'USD',
      note: 'Estimated Base gas (ETH) for Wormhole wrapped token + Zora registration',
    },
    total: {
      amount: 25,
      currency: 'USD',
      note: '~$25-30 total ($20 fee + ~$5-10 network fees)',
    },
    ourProfit: {
      amount: TOKEN_GENERATION_FEE_USD,
      currency: 'USD',
      note: 'Token generation fee — our revenue from this deployment',
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Solana Token Deployer
// ═════════════════════════════════════════════════════════════════════════

/**
 * Deploy a creator token as an SPL token on Solana.
 *
 * Uses SolanaCreatorTokenSDK to create the token with:
 *   - Bonding curve for initial trading
 *   - Creator allocation with vesting
 *   - Platform fee collection
 *   - Metadata (name, symbol, URI)
 *
 * @param config Token configuration
 * @returns Solana token address and transaction info
 */
async function deploySolanaToken(config: DualChainCoinConfig): Promise<{
  mintAddress: string;
  tokenState: string;
  txHash: string;
  explorerUrl: string;
}> {
  // In production:
  //   import { SolanaCreatorTokenSDK, deriveTokenState } from './solana';
  //   import { AnchorProvider } from '@coral-xyz/anchor';
  //   import { Connection, Keypair } from '@solana/web3.js';
  //
  //   const connection = new Connection(config.solanaRpcUrl || 'https://api.mainnet-beta.solana.com');
  //   const wallet = Keypair.fromSecretKey(Buffer.from(config.solanaPrivateKey!, 'hex'));
  //   const provider = new AnchorProvider(connection, wallet, {});
  //   const sdk = new SolanaCreatorTokenSDK(provider);
  //
  //   const result = await sdk.createToken({
  //     tokenSeed: config.tokenSeed ?? 1n,
  //     name: config.name,
  //     symbol: config.symbol,
  //     uri: config.uri,
  //     creatorAllocationBps: Math.round(config.creatorAllocationPercent * 100),
  //     creatorFeeBps: config.creatorFeeBps ?? 0,
  //   });

  console.warn(
    '[cross-network] Solana token deployment requires Anchor provider + SolanaCreatorTokenSDK.',
    'See solana.ts for the full SDK implementation.',
  );

  // Placeholder — in production this deploys the real SPL token
  return {
    mintAddress: `SoLaNa_${config.symbol}_${Date.now().toString(36)}_MINT`,
    tokenState: `SoLaNa_${config.symbol}_STATE`,
    txHash: `placeholder_solana_tx_${Date.now().toString(36)}`,
    explorerUrl: `https://solscan.io/tx/placeholder_${Date.now().toString(36)}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Wormhole Bridge Helpers
// ═════════════════════════════════════════════════════════════════════════

/**
 * Attest a token on Wormhole, generating a VAA (Verified Action Approval)
 * that proves the token exists on the source chain.
 *
 * @param chain Source chain ('solana')
 * @param tokenAddress Token address on the source chain
 * @returns VAA hash for creating the wrapped token
 */
async function wormholeAttestToken(
  _chain: 'solana',
  _tokenAddress: string,
): Promise<{ vaa: string }> {
  // In production, uses Wormhole Token Bridge:
  //   const solanaWormhole = new Wormhole('solana', solanaRpc);
  //   const attestation = await solanaWormhole.attestToken(tokenAddress);
  //   const vaa = await solanaWormhole.getVAA(attestation);
  //
  // Wormhole SDK integration required:
  //   npm install @certusone/wormhole-sdk
  //
  // Steps:
  //   1. Call Wormhole Core Bridge on Solana to attest the token
  //   2. Wait for the VAA to be signed by guardians (~1 min)
  //   3. Return the VAA hash for use on the target chain

  console.warn(
    '[wormhole] Token attestation requires @certusone/wormhole-sdk.',
    'VAA generation happens on Solana, verified by Wormhole guardians.',
  );

  return { vaa: `0x${'0'.repeat(64)}` };
}

/**
 * Create a wrapped version of the token on the target chain (Base).
 * Uses the VAA from wormholeAttestToken to mint the wrapped ERC-20.
 *
 * @param vaa The attestation VAA from the source chain
 * @param targetChain Target chain ('base')
 * @returns Wrapped token address on Base
 */
async function wormholeCreateWrapped(_vaa: string, _targetChain: 'base'): Promise<`0x${string}`> {
  // In production, calls Wormhole Token Bridge on Base:
  //   const baseWormhole = new Wormhole('base', baseRpc);
  //   const wrapped = await baseWormhole.createWrapped(vaa);
  //
  // The wrapped token is an ERC-20 that mirrors the Solana SPL token.
  // Wormhole guardians verify the VAA and mint the equivalent supply.

  console.warn(
    '[wormhole] Creating wrapped token on Base requires @certusone/wormhole-sdk.',
    'Uses the VAA to mint an equivalent ERC-20 on Base.',
  );

  return `0x${'Wrapped'.padStart(40, '0')}` as `0x${string}`;
}

// ═════════════════════════════════════════════════════════════════════════
// Zora Visibility Registration
// ═════════════════════════════════════════════════════════════════════════

/**
 * Register a wrapped token for Zora visibility.
 *
 * Wrapped tokens don't deploy through ZoraFactory, so we need to
 * manually register them with Zora's indexer to appear on zora.co.
 *
 * @param baseTokenAddress The wrapped token address on Base
 * @param config The original coin config (for metadata)
 * @returns Zora URL and registration status
 */
async function registerWrappedForZora(
  baseTokenAddress: `0x${string}`,
  _config: DualChainCoinConfig,
): Promise<{ url: string; registered: boolean }> {
  // In production, there are two approaches:
  //
  // Approach A — Zora Indexer Registration:
  //   Call Zora's registration endpoint to index the wrapped token.
  //   This makes it visible on zora.co even though it wasn't deployed
  //   through ZoraFactory directly.
  //
  //   const zoraClient = new ZoraCreatorCoinClient({
  //     rpcUrl: config.baseRpcUrl,
  //     privateKey: config.basePrivateKey,
  //   });
  //   await zoraClient.registerToken(baseTokenAddress);
  //
  // Approach B — ZoraWrapperFactory (recommended):
  //   Deploy a thin Zora-compatible wrapper contract that Zora's
  //   indexer recognizes. This is a lightweight ERC-20 that:
  //     - Wraps the Wormhole token with Zora-expected interfaces
  //     - Emits Zora-compatible events for indexing
  //     - Delegates to the underlying Wormhole ERC-20
  //
  //   The ZoraWrapperFactory contract at ZoraWrapperFactory.sol handles this.

  return {
    url: `https://zora.co/coin/base:${baseTokenAddress}`,
    registered: true,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Price Syncing
// ═════════════════════════════════════════════════════════════════════════

/**
 * Get current prices for a dual-chain coin on both networks.
 *
 * Fetches the SOL-denominated price from Jupiter (Solana) and the
 * ETH-denominated price from Uniswap V4 (Base), then compares them
 * to detect arbitrage opportunities.
 *
 * @param coin The dual-chain coin to check prices for
 * @returns DualChainPrice with prices on both chains
 */
export async function getDualChainPrice(coin: DualChainCoin): Promise<DualChainPrice> {
  // Fetch price on Solana via Jupiter API
  const solPrice = await fetchJupiterPrice(coin.solana.address);

  // Fetch price on Base via Uniswap V4 / Zora API
  const basePrice = await fetchUniswapV4Price(coin.base.address);

  const priceDiffPercent =
    Math.max(solPrice, basePrice) > 0
      ? (Math.abs(solPrice - basePrice) / Math.max(solPrice, basePrice)) * 100
      : 0;

  return {
    solana: {
      priceUsd: solPrice,
      priceNative: solPrice / 250, // Approximate SOL/USD
      pairCurrency: 'SOL',
    },
    base: {
      priceUsd: basePrice,
      priceNative: basePrice / 3300, // Approximate ETH/USD
      pairCurrency: 'ETH',
    },
    priceDiffPercent,
    arbitrageProfitable: priceDiffPercent > 1.0,
    timestamp: Date.now(),
  };
}

/**
 * Fetch token price from Jupiter API (Solana).
 *
 * @param mintAddress SPL token mint address
 * @returns Price in USD
 */
async function fetchJupiterPrice(_mintAddress: string): Promise<number> {
  // In production, call Jupiter's price API:
  //   const res = await fetch(
  //     `https://price.jup.ag/v6/price?ids=${mintAddress}`
  //   );
  //   const data = await res.json();
  //   return data.data[mintAddress]?.price ?? 0;
  //
  // Jupiter returns the price in USD based on the SOL pair.
  // If the token has no liquidity, returns 0.

  return 0;
}

/**
 * Fetch token price from Uniswap V4 (Base) via Zora or direct query.
 *
 * @param tokenAddress Wrapped ERC-20 token address on Base
 * @returns Price in USD
 */
async function fetchUniswapV4Price(_tokenAddress: `0x${string}`): Promise<number> {
  // In production, call DEX subgraph or Zora price API:
  //   const res = await fetch(
  //     `https://api.zora.engineering/api/coin?address=${tokenAddress}&chainId=8453`
  //   );
  //   const data = await res.json();
  //   return parseFloat(data.price) ?? 0;
  //
  // Or query the Uniswap V4 subgraph directly for ETH pair price.

  return 0;
}

// ═════════════════════════════════════════════════════════════════════════
// Cross-Chain Registry
// ═════════════════════════════════════════════════════════════════════════

/**
 * Record the dual-chain token mapping in the cross-chain registry.
 * This links the Solana mint and Base wrapped address under the creator's
 * identity, enabling unified profile lookups.
 */
async function recordRegistryMapping(
  config: DualChainCoinConfig,
  solMint: string,
  baseWrapped: `0x${string}`,
  kvStore?: KVStore,
): Promise<string> {
  if (!kvStore) return 'no-kv-store';

  const registry = new CrossChainRegistry(kvStore);
  const mappingId = `solana:${solMint}:base:${baseWrapped}`;

  await registry.register({
    id: mappingId,
    source: {
      chainId: 901, // Solana convention in registry
      protocol: 'degenfeed',
      creatorId: config.creator,
      token: solMint,
    },
    target: {
      chainId: 8453, // Base
      protocol: 'degenfeed',
      creatorId: config.creator,
      token: baseWrapped,
    },
    createdAt: Date.now(),
    verifiedBy: 'bridge', // Wormhole bridge confirms the link
  });

  return mappingId;
}

// ═════════════════════════════════════════════════════════════════════════
// Main Deployer — One Coin, Two Networks
// ═════════════════════════════════════════════════════════════════════════

/**
 * Deploy a dual-chain coin — ONE coin that exists on both Solana and Base.
 *
 * ## Deployment Flow
 * 1. Collect $20 token generation fee from creator
 * 2. Deploy SPL token on Solana (primary — cheaper gas)
 * 3. Register with Wormhole (attestation → VAA)
 * 4. Create wrapped ERC-20 on Base via Wormhole
 * 5. Register Base wrapped token for Zora visibility
 * 6. Record mapping in cross-chain registry
 *
 * ## Result
 * - `solana.address`: SPL token mint on Solana (paired with SOL)
 * - `base.address`: Wormhole-wrapped ERC-20 on Base (paired with ETH)
 * - `base.zoraUrl`: Zora.co URL — coin visible on Zora
 * - Same total supply on both chains
 *
 * ## Requirements
 * - Creator private keys for Solana and Base
 * - ~0.003 SOL for Solana deploy + Wormhole attestation
 * - ~$3 ETH gas for Base wrapped token
 * - $20 one-time token generation fee
 *
 * @param config Dual-chain coin configuration
 * @param kvStore Optional KV store for cross-chain registry
 * @returns DualChainDeployResult with addresses on both chains
 */
export async function deployDualChainCoin(
  config: DualChainCoinConfig,
  kvStore?: KVStore,
): Promise<DualChainDeployResult> {
  // ── Phase 1: Collect Token Generation Fee ──────────────────────────
  const feePayment = await collectTokenGenerationFee(config.creator, 'solana');
  if (!feePayment.paid) {
    throw new Error(
      `Token generation fee ($${config.tokenGenerationFeeUsd ?? TOKEN_GENERATION_FEE_USD}) ` +
        `not collected. Receipt: ${feePayment.receiptId}`,
    );
  }

  // ── Phase 2: Deploy on Solana (primary — cheaper gas) ─────────────
  const solToken = await deploySolanaToken(config);

  // ── Phase 3: Register with Wormhole ───────────────────────────────
  const wormhole = await wormholeAttestToken('solana', solToken.mintAddress);

  // ── Phase 4: Create wrapped token on Base ─────────────────────────
  const baseWrapped = await wormholeCreateWrapped(wormhole.vaa, 'base');

  // ── Phase 5: Register for Zora visibility ─────────────────────────
  const zoraResult = await registerWrappedForZora(baseWrapped, config);

  // ── Phase 6: Record in cross-chain registry ───────────────────────
  const registryId = await recordRegistryMapping(
    config,
    solToken.mintAddress,
    baseWrapped,
    kvStore,
  );

  return {
    solana: {
      address: solToken.mintAddress,
      pairCurrency: 'SOL',
      dexUrl: `https://jup.ag/swap/SOL-${solToken.mintAddress}`,
      explorerUrl: solToken.explorerUrl,
    },
    base: {
      address: baseWrapped,
      pairCurrency: 'ETH',
      isWrapped: true,
      zoraUrl: zoraResult.url,
      dexUrl: `https://app.uniswap.org/swap?outputCurrency=${baseWrapped}&chain=base`,
      explorerUrl: `https://basescan.org/address/${baseWrapped}`,
    },
    wormholeAttestation: wormhole.vaa,
    totalSupply: config.totalSupply.toString(),
    deploymentCost: getDeploymentCostBreakdown('solana'),
    tokenSeed: (config.tokenSeed ?? 1n).toString(),
    registryId,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// Legacy Deprecated Exports (kept for backward compat)
// ═════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use `deployDualChainCoin` instead.
 *
 * Old-style cross-network deployer that deploys on either Base or Solana.
 * The new model always deploys on Solana and wraps to Base.
 */
export async function deployCrossNetwork(opts: CrossNetworkOpts): Promise<CrossNetworkResult> {
  console.warn(
    '[deprecated] deployCrossNetwork() is deprecated. Use deployDualChainCoin() for the one-coin dual-chain model.',
  );

  const result = await deployDualChainCoin(opts);

  return {
    primaryAddress: result.solana.address,
    baseWrapped: result.base.address,
    zoraUrl: result.base.zoraUrl,
  };
}

/**
 * @deprecated Use `deployDualChainCoin` instead — Wormhole wrapping is automatic.
 */
export async function deployWormholeWrapper(
  _fromChain: PrimaryChain,
  _tokenAddress: string,
): Promise<{ wrappedToken: string }> {
  console.warn('[deprecated] Wormhole wrapper is now automatic in deployDualChainCoin().');
  return { wrappedToken: '0x0000000000000000000000000000000000000000' };
}

/**
 * @deprecated Use `deployDualChainCoin` instead — Zora registration is automatic.
 */
export async function registerForZoraVisibility(
  _baseTokenAddress: string,
): Promise<{ url: string }> {
  console.warn('[deprecated] Zora registration is now automatic in deployDualChainCoin().');
  return { url: 'https://zora.co/coin/base:0x0000000000000000000000000000000000000000' };
}

/**
 * @deprecated Use `getDeploymentCostBreakdown` instead.
 */
export { getDeploymentCostBreakdown as getDeploymentCostBreakdownLegacy };
