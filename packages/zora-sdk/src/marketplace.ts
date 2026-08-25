/**
 * @degenfeed/zora-sdk — Zora Marketplace Integration
 *
 * Full marketplace capabilities for Zora NFTs:
 *   1. Browse marketplace listings
 *   2. Buy/sell NFTs
 *   3. Place bids on auctions
 *   4. Make offers on listings
 *   5. Price history and analytics
 *   6. Collection floor tracking
 *
 * Reads from our local Zora indexer (self-hosted) for data ownership.
 * Writes go through Zora's contracts for settlement.
 *
 * ## Usage
 * ```ts
 * import { ZoraMarketplace } from '@degenfeed/zora-sdk';
 *
 * const marketplace = new ZoraMarketplace({ rpcUrl: '...' });
 * const trending = await marketplace.getTrending({ limit: 20 });
 * const bid = await marketplace.placeBid({ ... });
 * ```
 */
import { type Address, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// ═════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════

export interface MarketplaceListing {
  /** Listing ID */
  id: string;
  /** NFT contract address */
  contractAddress: Address;
  /** Token ID */
  tokenId: string;
  /** Seller address */
  seller: Address;
  /** Price in wei */
  priceWei: string;
  /** Price in ETH (formatted) */
  priceEth: string;
  /** Currency (always ETH for our integration) */
  currency: Address;
  /** Listing type */
  listingType: 'fixed' | 'auction' | 'offer';
  /** Whether listing is active */
  active: boolean;
  /** Created at (Unix ms) */
  createdAt: number;
  /** Expiry (if applicable) */
  expiresAt?: number;
  /** Chain */
  chain: string;
  /** Collection name */
  collectionName?: string;
  /** Token name */
  tokenName?: string;
  /** Token image URL */
  imageUrl?: string;
}

export interface MarketplaceBid {
  /** Bid ID */
  id: string;
  /** NFT contract address */
  contractAddress: Address;
  /** Token ID */
  tokenId: string;
  /** Bidder address */
  bidder: Address;
  /** Bid amount in wei */
  amountWei: string;
  /** Bid amount in ETH */
  amountEth: string;
  /** Timestamp */
  timestamp: number;
  /** Whether bid is active */
  active: boolean;
  /** Expiration */
  expiresAt?: number;
}

export interface PricePoint {
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Price in wei */
  priceWei: string;
  /** Price in ETH */
  priceEth: string;
  /** Event type */
  event: 'sale' | 'listing' | 'bid' | 'offer';
}

export interface TrendingQuery {
  /** Chain filter */
  chain?: string;
  /** Limit */
  limit?: number;
  /** Sort field */
  sort?: 'volume_24h' | 'sales_24h' | 'floor_price' | 'newest';
  /** Creator filter */
  creator?: Address;
  /** Collection filter */
  collection?: Address;
}

export interface BuyNowParams {
  /** NFT contract address */
  contractAddress: Address;
  /** Token ID */
  tokenId: string;
  /** Buyer address */
  buyer: Address;
  /** Price in wei */
  priceWei: bigint;
  /** Seller address */
  seller: Address;
  /** Chain */
  chain?: string;
}

export interface PlaceBidParams {
  /** NFT contract address */
  contractAddress: Address;
  /** Token ID */
  tokenId: string;
  /** Bidder address */
  bidder: Address;
  /** Bid amount in wei */
  amountWei: bigint;
  /** Expiry (Unix seconds) */
  expiresAt?: number;
  /** Chain */
  chain?: string;
}

export interface MakeOfferParams {
  /** NFT contract address */
  contractAddress: Address;
  /** Token ID */
  tokenId: string;
  /** Offer amount in wei */
  amountWei: bigint;
  /** Offer maker */
  maker: Address;
  /** Expiry (Unix seconds) */
  expiresAt?: number;
  /** Chain */
  chain?: string;
}

export interface TradeResult {
  /** Transaction hash */
  txHash: `0x${string}`;
  /** Explorer URL */
  explorerUrl: string;
  /** Amount in ETH (formatted) */
  amountEth: string;
}

export interface CollectionFloorInfo {
  /** Collection address */
  address: Address;
  /** Collection name */
  name: string;
  /** Floor price in wei */
  floorWei: string;
  /** Floor price in ETH */
  floorEth: string;
  /** 24h change in floor price (%) */
  floorChange24h: number;
  /** Total volume 24h in wei */
  volume24hWei: string;
  /** Sales count 24h */
  sales24h: number;
  /** Number of items listed */
  listedCount: number;
  /** Total supply */
  totalSupply: number;
  /** Unique owners */
  uniqueOwners: number;
}

// ═════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════

const ZORA_INDEXER_DEFAULT = 'http://127.0.0.1:8091';

/** Zora Module Manager (for offers/bids). */
const ZORA_MODULE_MANAGER = '0x0000000000a9d0e2e6b3c3e9e3e9e3e9e3e9e3e9';

// ═════════════════════════════════════════════════════════════════════════
// ZoraMarketplace Class
// ═════════════════════════════════════════════════════════════════════════

export class ZoraMarketplace {
  private walletClient: any;
  private account?: ReturnType<typeof privateKeyToAccount>;
  private indexerUrl: string;

  constructor(opts: { rpcUrl?: string; privateKey?: string; indexerUrl?: string } = {}) {
    this.indexerUrl = opts.indexerUrl || ZORA_INDEXER_DEFAULT;

    if (opts.privateKey) {
      this.account = privateKeyToAccount(opts.privateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        chain: base,
        transport: http(opts.rpcUrl || 'https://mainnet.base.org'),
        account: this.account,
      });
    }
  }

  // ─── Browse Marketplace ───────────────────────────────────────────────

  /**
   * Get trending NFTs from our local indexer.
   * Supports sorting by volume, sales, floor price, or newest.
   */
  async getTrending(query: TrendingQuery = {}): Promise<MarketplaceListing[]> {
    const chain = query.chain ?? 'base';
    const limit = Math.min(query.limit ?? 20, 100);
    const sort = query.sort ?? 'volume_24h';

    const sortParam =
      sort === 'volume_24h'
        ? 'volume'
        : sort === 'sales_24h'
          ? 'sales'
          : sort === 'floor_price'
            ? 'price'
            : 'recent';

    try {
      const url = `${this.indexerUrl}/api/collections?limit=${limit}&sort=${sortParam}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };

      if (!data.data) return [];

      return data.data.map((item: Record<string, unknown>) => ({
        id: `zora:listing:${item.address as string}`,
        contractAddress: (item.address as Address) || '0x0000000000000000000000000000000000000000',
        tokenId: '0',
        seller: '0x0000000000000000000000000000000000000000' as Address,
        priceWei: '0',
        priceEth: '0',
        currency: '0x0000000000000000000000000000000000000000' as Address,
        listingType: 'fixed' as const,
        active: true,
        createdAt: Date.now(),
        chain,
        collectionName: (item.name as string) || '',
        tokenName: (item.symbol as string) || '',
        imageUrl: (item.image as string) || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get NFTs by a specific creator from our local indexer.
   */
  async getByCreator(creatorAddress: Address, limit: number = 50): Promise<MarketplaceListing[]> {
    try {
      const url = `${this.indexer_url}/api/tokens?limit=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return [];

      const data = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };

      if (!data.data) return [];

      // Filter by creator locally
      const creator = creatorAddress.toLowerCase();
      const filtered = data.data.filter(
        (t: Record<string, unknown>) =>
          (t.creator_address as string)?.toLowerCase() === creator ||
          (t.originator_address as string)?.toLowerCase() === creator,
      );

      return filtered.map((item: Record<string, unknown>) => ({
        id: `zora:token:${item.id as string}`,
        contractAddress:
          (item.collection_address as Address) || '0x0000000000000000000000000000000000000000',
        tokenId: item.id?.toString()?.split(':').pop() ?? '0',
        seller: (item.owner_address as Address) || '0x0000000000000000000000000000000000000000',
        priceWei: item.mint_price_eth?.toString() ?? '0',
        priceEth: item.mint_price_eth ? `${(item.mint_price_eth as number).toFixed(6)}` : '0',
        currency: '0x0000000000000000000000000000000000000000' as Address,
        listingType: 'fixed' as const,
        active: true,
        createdAt: Date.now(),
        chain: 'base',
        collectionName: (item.collection_name as string) || '',
        tokenName: (item.name as string) || '',
        imageUrl: (item.image_url as string) || '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get collection floor price and analytics from our indexer.
   */
  async getCollectionFloor(collectionAddress: Address): Promise<CollectionFloorInfo | null> {
    try {
      const url = `${this.indexerUrl}/api/collections/${collectionAddress.toLowerCase()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return null;

      const data = (await res.json()) as { data?: Record<string, unknown> };
      if (!data.data) return null;

      const col = data.data;
      const floorWei = col.floor_price
        ? BigInt(Math.floor((col.floor_price as number) * 1e18)).toString()
        : '0';

      return {
        address: collectionAddress,
        name: (col.name as string) || 'Unknown',
        floorWei,
        floorEth: col.floor_price ? `${(col.floor_price as number).toFixed(4)}` : '0',
        floorChange24h: (col.floor_change as number) ?? 0,
        volume24hWei: col.volume
          ? BigInt(Math.floor((col.volume as number) * 1e18)).toString()
          : '0',
        sales24h: (col.sales_count as number) ?? 0,
        listedCount: 0,
        totalSupply: (col.total_supply as number) ?? 0,
        uniqueOwners: 0,
      };
    } catch {
      return null;
    }
  }

  // ─── Buy / Sell ───────────────────────────────────────────────────────

  /**
   * Buy an NFT at a fixed price.
   * Uses Zora's Module Manager for settlement.
   */
  async buyNow(params: BuyNowParams): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraMarketplace: privateKey required to buy');
    }

    if (
      !params.contractAddress ||
      params.contractAddress === '0x0000000000000000000000000000000000000000'
    ) {
      throw new Error('Valid contract address required');
    }
    if (params.priceWei <= 0n) {
      throw new Error('Price must be greater than 0');
    }

    try {
      const { encodeFunctionData } = await import('viem');

      // Fill buy order through Zora Module Manager
      const data = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'fillBuyOrder',
            inputs: [
              { type: 'address', name: 'tokenContract' },
              { type: 'uint256', name: 'tokenId' },
              { type: 'address', name: 'seller' },
              { type: 'uint256', name: 'price' },
            ],
            outputs: [],
            stateMutability: 'payable',
          },
        ],
        functionName: 'fillBuyOrder',
        args: [params.contractAddress, BigInt(params.tokenId), params.seller, params.priceWei],
      });

      const hash = await this.walletClient.sendTransaction({
        to: ZORA_MODULE_MANAGER,
        data,
        value: params.priceWei,
        chain: base,
      });

      const { formatEther } = await import('viem');
      return {
        txHash: hash,
        explorerUrl: `https://basescan.org/tx/${hash}`,
        amountEth: formatEther(params.priceWei),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Buy failed: ${msg}`);
    }
  }

  /**
   * Sell an NFT at a fixed price.
   * Creates a listing through Zora's Module Manager.
   */
  async sell(params: {
    contractAddress: Address;
    tokenId: string;
    seller: Address;
    priceWei: bigint;
    chain?: string;
  }): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraMarketplace: privateKey required to sell');
    }

    if (params.priceWei <= 0n) {
      throw new Error('Price must be greater than 0');
    }

    try {
      const { encodeFunctionData, formatEther } = await import('viem');

      // Create sell order through Zora Module Manager
      const data = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'createSellOrder',
            inputs: [
              { type: 'address', name: 'tokenContract' },
              { type: 'uint256', name: 'tokenId' },
              { type: 'uint256', name: 'price' },
              { type: 'uint256', name: 'expiration' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
          },
        ],
        functionName: 'createSellOrder',
        args: [
          params.contractAddress,
          BigInt(params.tokenId),
          params.priceWei,
          0n, // No expiration
        ],
      });

      const hash = await this.walletClient.sendTransaction({
        to: ZORA_MODULE_MANAGER,
        data,
        chain: base,
      });

      return {
        txHash: hash,
        explorerUrl: `https://basescan.org/tx/${hash}`,
        amountEth: formatEther(params.priceWei),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Sell failed: ${msg}`);
    }
  }

  // ─── Bids ─────────────────────────────────────────────────────────────

  /**
   * Place a bid on an NFT auction.
   */
  async placeBid(params: PlaceBidParams): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraMarketplace: privateKey required to bid');
    }

    if (params.amountWei <= 0n) {
      throw new Error('Bid amount must be greater than 0');
    }

    try {
      const { encodeFunctionData, formatEther } = await import('viem');

      const data = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'placeBid',
            inputs: [
              { type: 'address', name: 'tokenContract' },
              { type: 'uint256', name: 'tokenId' },
              { type: 'uint256', name: 'amount' },
              { type: 'uint256', name: 'expiration' },
            ],
            outputs: [],
            stateMutability: 'payable',
          },
        ],
        functionName: 'placeBid',
        args: [
          params.contractAddress,
          BigInt(params.tokenId),
          params.amountWei,
          BigInt(params.expiresAt ?? Math.floor(Date.now() / 1000) + 86400 * 7), // 7 days
        ],
      });

      const hash = await this.walletClient.sendTransaction({
        to: ZORA_MODULE_MANAGER,
        data,
        value: params.amountWei,
        chain: base,
      });

      return {
        txHash: hash,
        explorerUrl: `https://basescan.org/tx/${hash}`,
        amountEth: formatEther(params.amountWei),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Bid failed: ${msg}`);
    }
  }

  /**
   * Make an offer on an NFT.
   */
  async makeOffer(params: MakeOfferParams): Promise<TradeResult> {
    if (!this.walletClient || !this.account) {
      throw new Error('ZoraMarketplace: privateKey required to make offer');
    }

    if (params.amountWei <= 0n) {
      throw new Error('Offer amount must be greater than 0');
    }

    try {
      const { encodeFunctionData, formatEther } = await import('viem');

      const data = encodeFunctionData({
        abi: [
          {
            type: 'function',
            name: 'makeOffer',
            inputs: [
              { type: 'address', name: 'tokenContract' },
              { type: 'uint256', name: 'tokenId' },
              { type: 'uint256', name: 'amount' },
              { type: 'uint256', name: 'expiration' },
            ],
            outputs: [],
            stateMutability: 'payable',
          },
        ],
        functionName: 'makeOffer',
        args: [
          params.contractAddress,
          BigInt(params.tokenId),
          params.amountWei,
          BigInt(params.expiresAt ?? Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
        ],
      });

      const hash = await this.walletClient.sendTransaction({
        to: ZORA_MODULE_MANAGER,
        data,
        value: params.amountWei,
        chain: base,
      });

      return {
        txHash: hash,
        explorerUrl: `https://basescan.org/tx/${hash}`,
        amountEth: formatEther(params.amountWei),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Offer failed: ${msg}`);
    }
  }

  // ─── Price History ────────────────────────────────────────────────────

  /**
   * Get price history for an NFT from our indexer.
   * Returns sale events in chronological order.
   */
  async getPriceHistory(contractAddress: Address, tokenId: string): Promise<PricePoint[]> {
    try {
      const url = `${this.indexerUrl}/api/sales?collection=${contractAddress.toLowerCase()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

      if (!res.ok) return [];

      const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
      if (!data.data) return [];

      return data.data
        .filter((s: Record<string, unknown>) => !tokenId || s.token_id === tokenId)
        .map((sale: Record<string, unknown>) => ({
          timestamp: sale.timestamp
            ? new Date(sale.timestamp as string).getTime() / 1000
            : Date.now() / 1000,
          priceWei: sale.buy_price_eth
            ? BigInt(Math.floor((sale.buy_price_eth as number) * 1e18)).toString()
            : '0',
          priceEth: sale.buy_price_eth ? `${(sale.buy_price_eth as number).toFixed(6)}` : '0',
          event: 'sale' as const,
        }))
        .sort((a: PricePoint, b: PricePoint) => a.timestamp - b.timestamp);
    } catch {
      return [];
    }
  }

  // ─── Health ───────────────────────────────────────────────────────────

  /**
   * Check indexer connectivity.
   */
  async healthCheck(): Promise<{ healthy: boolean; indexerUrl: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.indexerUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return {
        healthy: res.ok,
        indexerUrl: this.indexerUrl,
        latencyMs: Date.now() - start,
      };
    } catch {
      return {
        healthy: false,
        indexerUrl: this.indexerUrl,
        latencyMs: Date.now() - start,
      };
    }
  }

  private get indexer_url(): string {
    return this.indexerUrl;
  }
}
