/**
 * Rarible Protocol bridge provider
 *
 * Integrates cross-chain NFT marketplace data into DegenFeed.
 * API Docs: https://docs.rarible.org
 * SDK: @rarible/sdk (MIT)
 *
 * Features:
 * - NFT sales, listings, and mints across 7+ chains
 * - Collection stats and floor prices
 * - Aggregated orderbook (OpenSea + Rarible + more)
 * - Real-time market activity
 *
 * Rate Limits: Free tier available
 * Auth: API Key
 */

import type { ProtocolProvider, RawPost, FetchOptions, UnifiedPost } from '../types';

export class RaribleProvider implements ProtocolProvider {
  id = 'rarible';
  name = 'NFT Markets';
  private baseUrl = 'https://api.rarible.org/v0.1';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.RARIBLE_API_KEY || '';
  }

  async fetch(options: FetchOptions): Promise<RawPost[]> {
    const limit = options.limit || 20;
    const response = await fetch(
      `${this.baseUrl}/activities?limit=${limit}&type=SELL&type=MINT&type=LIST`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-API-KEY': this.apiKey } : {}),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Rarible API error: ${response.status}`);
    }

    const data = await response.json();
    return data.activities || [];
  }

  normalize(raw: any): UnifiedPost {
    const nftName = raw.nft?.name || raw.nft?.meta?.name || 'Unknown NFT';
    const collectionName = raw.collection?.name || 'Unknown Collection';

    return {
      id: `rarible:${raw.id}`,
      protocol: 'rarible',
      type: 'nft',
      author: {
        displayName: raw.maker?.address || 'Unknown',
        handle: '',
        avatar: null,
      },
      content: {
        title: `${raw.type === 'SELL' ? '💎' : raw.type === 'MINT' ? '🆕' : '📋'} ${nftName}`,
        description: `${raw.type} — ${collectionName}`,
        chain: raw.blockchain || 'ethereum',
        value: raw.price?.amount || '',
        currency: raw.price?.currency || 'ETH',
      },
      url: `https://rarible.com/token/${raw.contract}/${raw.tokenId}`,
      media: raw.nft?.meta?.image?.url
        ? { url: raw.nft.meta.image.url, type: 'image' }
        : null,
      timestamp: raw.createdAt
        ? new Date(raw.createdAt).getTime()
        : Date.now(),
      stats: {
        likes: 0,
        comments: 0,
      },
    };
  }

  async healthCheck(): Promise<number> {
    const start = Date.now();
    await fetch(`${this.baseUrl}/activities?limit=1`, {
      headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
    });
    return Date.now() - start;
  }
}
