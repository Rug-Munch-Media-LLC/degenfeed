/**
 * Creator Coin — Unified Client
 *
 * A single interface that works with both Solana and Base.
 * Automatically routes to the correct chain implementation.
 */

import { AnchorProvider } from '@coral-xyz/anchor';
import { Connection, type Keypair } from '@solana/web3.js';
import type { Address } from 'viem';
import { CrossChainBridge } from './cross-chain/bridge';
import { CreatorCoinEVMClient } from './evm/client';
import { LiveStreamMonitor } from './live-stream';
import { CreatorCoinSolanaClient } from './solana/client';
import type {
  BuyInput,
  CreatorChain,
  CreatorCoinConfig,
  DeployResult,
  SellInput,
  TokenInfo,
  TradeResult,
} from './types';

export interface CreatorCoinClientConfig {
  solanaRpcUrl?: string;
  baseRpcUrl?: string;
  solanaKeypair?: Keypair;
  evmPrivateKey?: Address;
  /** KV store for cross-chain registry (Cloudflare Workers KV) */
  kv?: any;
}

export class CreatorCoinClient {
  private evmClient: CreatorCoinEVMClient | null = null;
  private solanaClient: CreatorCoinSolanaClient | null = null;
  private liveMonitor: LiveStreamMonitor;
  private kv: any;

  constructor(config: CreatorCoinClientConfig = {}) {
    this.kv = config.kv;

    // Initialize EVM client if private key provided
    if (config.evmPrivateKey) {
      this.evmClient = new CreatorCoinEVMClient({
        rpcUrl: config.baseRpcUrl || 'https://mainnet.base.org',
        privateKey: config.evmPrivateKey,
      });
    }

    // Initialize Solana client if keypair provided
    if (config.solanaKeypair) {
      const connection = new Connection(
        config.solanaRpcUrl || 'https://api.mainnet-beta.solana.com',
      );
      const provider = new AnchorProvider(
        connection,
        { publicKey: config.solanaKeypair.publicKey } as any,
        { commitment: 'confirmed' },
      );
      this.solanaClient = new CreatorCoinSolanaClient(provider);
    }

    this.liveMonitor = new LiveStreamMonitor();
  }

  // ─── Deploy ──────────────────────────────────────────────────────────────

  /**
   * Deploy a creator coin on the selected chain.
   * If crossChain is true and deploying on Solana, a wrapped
   * version will be created on Base automatically.
   */
  async deployCoin(config: CreatorCoinConfig, crossChain: boolean = false): Promise<DeployResult> {
    let result: DeployResult;

    if (config.chain === 'base') {
      if (!this.evmClient) throw new Error('EVM client not configured');
      result = await this.evmClient.deployCoin(config);
    } else {
      if (!this.solanaClient) throw new Error('Solana client not configured');
      result = await this.solanaClient.deployCoin(config);
    }

    // Cross-chain: deploy wrapped version on the other chain
    if (crossChain && config.chain === 'solana' && this.evmClient) {
      const bridge = new CrossChainBridge({
        solanaMint: result.primaryAddress,
        baseWrapped: '0x0000000000000000000000000000000000000000' as Address,
        creator: config.creator,
      });

      // Attest token on Wormhole
      const attestation = await bridge.attestToken();

      // Create wrapped token on Base
      const wrapped = await bridge.createWrappedToken(attestation.vaaHash);
      result.wrappedAddress = wrapped.wrappedAddress;

      // Register mapping in KV
      if (this.kv) {
        await bridge.registerMapping(this.kv);
      }
    }

    return result;
  }

  // ─── Trading ─────────────────────────────────────────────────────────────

  async buy(opts: BuyInput, chain: CreatorChain = 'solana'): Promise<TradeResult> {
    if (chain === 'base') {
      if (!this.evmClient) throw new Error('EVM client not configured');
      return this.evmClient.buy(opts);
    }
    if (!this.solanaClient) throw new Error('Solana client not configured');
    return this.solanaClient.buy(opts);
  }

  async sell(opts: SellInput, chain: CreatorChain = 'solana'): Promise<TradeResult> {
    if (chain === 'base') {
      if (!this.evmClient) throw new Error('EVM client not configured');
      return this.evmClient.sell(opts);
    }
    if (!this.solanaClient) throw new Error('Solana client not configured');
    return this.solanaClient.sell(opts);
  }

  // ─── Queries ─────────────────────────────────────────────────────────────

  async getTokenInfo(tokenAddress: string, chain: CreatorChain): Promise<TokenInfo> {
    if (chain === 'base') {
      if (!this.evmClient) throw new Error('EVM client not configured');
      return this.evmClient.getTokenInfo(tokenAddress);
    }
    if (!this.solanaClient) throw new Error('Solana client not configured');
    return this.solanaClient.getTokenInfo(tokenAddress);
  }

  // ─── Cross-Chain ─────────────────────────────────────────────────────────

  /**
   * Get cross-chain price info for a dual-chain coin.
   */
  async getCrossChainPrice(
    solanaMint: string,
    baseWrapped: Address,
  ): Promise<{
    solana: { price: string; usd: number };
    base: { price: string; usd: number };
    diffPercent: number;
  }> {
    const bridge = new CrossChainBridge({ solanaMint, baseWrapped, creator: '' });
    return bridge.getCrossChainPrice();
  }

  /**
   * Bridge tokens from Solana to Base.
   */
  async bridgeToBase(
    solanaMint: string,
    baseWrapped: Address,
    amount: bigint,
  ): Promise<{ burnTx: string; mintTx?: string }> {
    const bridge = new CrossChainBridge({ solanaMint, baseWrapped, creator: '' });
    return bridge.bridgeToBase(amount);
  }

  // ─── Live Stream ─────────────────────────────────────────────────────────

  /**
   * Start monitoring a creator's live stream for coin boosts.
   */
  startLiveMonitor(
    creatorId: string,
    platform: string,
    streamUrl: string,
    onStatusChange?: (isLive: boolean, boostBps: number) => void,
  ): void {
    this.liveMonitor.startMonitoring(creatorId, platform, streamUrl, (info) => {
      onStatusChange?.(info.isLive, info.boostDiscountBps);
    });
  }

  stopLiveMonitor(creatorId: string, platform: string): void {
    this.liveMonitor.stopMonitoring(creatorId, platform);
  }

  /**
   * Get the current live boost data for a creator.
   */
  getLiveBoost(
    creatorId: string,
    platform: string,
  ): {
    isLive: boolean;
    boostBps: number;
    streamUrl?: string;
  } {
    const status = this.liveMonitor.getLiveStatus(creatorId, platform);
    return {
      isLive: status?.isLive ?? false,
      boostBps: status?.boostDiscountBps ?? 0,
      streamUrl: status?.streamUrl,
    };
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  destroy(): void {
    this.liveMonitor.destroy();
  }
}

// ─── Re-exports for convenience ────────────────────────────────────────────

export { getDynamicPrice, getProgressPercent } from './bonding-curve';
export { CrossChainBridge } from './cross-chain/bridge';
export { CreatorCoinEVMClient } from './evm/client';
export { calculateFeeSplit } from './fees';
export { LIVE_BOOST_BPS, LiveStreamMonitor } from './live-stream';
export { CreatorCoinSolanaClient } from './solana/client';
export * from './types';
