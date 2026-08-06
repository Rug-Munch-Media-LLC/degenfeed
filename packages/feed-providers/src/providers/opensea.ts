/**
 * OpenSeaProvider — NFT marketplace feed from OpenSea API v2.
 *
 * Endpoint: https://api.opensea.io/api/v2/ (requires an X-API-KEY header;
 * a free-tier key can be obtained from the OpenSea developer portal and
 * wired via the OPENSEA_API_KEY wrangler var / env).
 *
 * This provider surfaces:
 *   - Trending collections (by 24h volume)
 *   - Notable sales (recent high-value sales from the events feed)
 *   - Collection metadata (floor price, total volume)
 *
 * Protocol: 'opensea' (already present in @degenfeed/types).
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { buildIdentity } from './shared';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

export const OPENSEA_API_URL = 'https://api.opensea.io/api/v2';

export interface OpenSeaCollectionStats {
  one_day_volume?: number | null;
  one_day_change?: number | null;
  total_volume?: number | null;
  floor_price?: number | null;
  total_supply?: number | null;
}

export interface OpenSeaCollectionInfo {
  slug: string;
  name: string;
  image_url?: string | null;
  description?: string | null;
  stats?: OpenSeaCollectionStats | null;
}

export interface OpenSeaCollection {
  collection: OpenSeaCollectionInfo;
}

export interface OpenSeaCollectionsResponse {
  collections?: OpenSeaCollection[] | null;
}

export interface OpenSeaSaleEvent {
  event_type?: string | null;
  nft?: {
    identifier?: string | null;
    collection?: { slug?: string | null; name?: string | null } | null;
  } | null;
  sale?: {
    total_price?: string | null;
    quantity?: string | null;
    payment_token?: { symbol?: string | null; decimals?: number | null } | null;
  } | null;
}

export interface OpenSeaEventsResponse {
  events?: OpenSeaSaleEvent[] | null;
  next?: string | null;
}

/** Runtime guard for a collection entry (minimal shape). */
export function isOpenSeaCollection(obj: unknown): obj is OpenSeaCollection {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const c = obj as Record<string, unknown>;
  const coll = c.collection;
  return typeof coll === 'object' && coll !== null && typeof (coll as Record<string, unknown>).slug === 'string';
}

/** Runtime guard for a sale event (minimal shape). */
export function isOpenSeaSaleEvent(obj: unknown): obj is OpenSeaSaleEvent {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const e = obj as Record<string, unknown>;
  return e.event_type === 'sale' || e.event_type === 'successful';
}

function collectionIdentity(c: OpenSeaCollectionInfo): UnifiedIdentity {
  const id = c.slug;
  return buildIdentity(id, 'opensea' as Protocol, id, id, c.name || c.slug, {
    bio: c.description ?? '',
    avatarUrl: c.image_url ?? '',
    keys: { openseaSlug: c.slug },
  });
}

function fmtUsd(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function collectionToUnifiedPost(c: OpenSeaCollection): UnifiedPost {
  const info = c.collection;
  const stats = info.stats ?? {};
  const floor = stats.floor_price ?? 0;
  const lines = [
    `🏛️ ${info.name}`,
    '',
    `24h volume: ${fmtUsd(stats.one_day_volume)}`,
    `Floor: ${fmtUsd(floor)} · Total: ${fmtUsd(stats.total_volume)}`,
  ];
  if (stats.one_day_change !== undefined && stats.one_day_change !== null) {
    const chg = stats.one_day_change;
    lines.push(`24h change: ${chg >= 0 ? '+' : ''}${(chg * 100).toFixed(1)}%`);
  }

  return buildUnifiedPost({
    protocol: 'opensea',
    nativeId: `collection:${info.slug}`,
    author: collectionIdentity(info),
    text: lines.join('\n'),
    embeds: [
      { kind: 'link', url: `https://opensea.io/collection/${info.slug}`, meta: { title: info.name } },
    ],
    createdAt: Date.now(),
    metrics: {
      likes: Math.round(stats.one_day_volume ?? 0),
      reposts: 0,
      replies: 0,
      quotes: 0,
    },
    raw: c,
  });
}

function saleToUnifiedPost(e: OpenSeaSaleEvent): UnifiedPost {
  const nft = e.nft ?? {};
  const collectionName = nft.collection?.name ?? nft.collection?.slug ?? 'OpenSea';
  const identifier = nft.identifier ?? '';
  const sale = e.sale ?? {};
  const totalPrice = Number(sale.total_price ?? 0);
  const decimals = sale.payment_token?.decimals ?? 18;
  const symbol = sale.payment_token?.symbol ?? 'ETH';
  const price = totalPrice > 0 ? totalPrice / Math.pow(10, decimals) : 0;

  const lines = [
    `💰 Sale: ${collectionName} #${identifier}`,
    '',
    `Price: ${price.toFixed(4)} ${symbol}`,
  ];
  const link = nft.collection?.slug
    ? `https://opensea.io/assets/ethereum/${nft.collection.slug}/${identifier}`
    : `https://opensea.io/`;

  return buildUnifiedPost({
    protocol: 'opensea',
    nativeId: `${collectionName}:${identifier}:${Date.now()}`,
    author: collectionIdentity({
      slug: nft.collection?.slug ?? 'opensea',
      name: collectionName,
    }),
    text: lines.join('\n'),
    embeds: [{ kind: 'link', url: link, meta: { title: `${collectionName} #${identifier}` } }],
    createdAt: Date.now(),
    metrics: { likes: Math.round(price), reposts: 0, replies: 0, quotes: 0 },
    raw: e,
  });
}

export interface OpenSeaProviderOptions {
  /** API base URL (default https://api.opensea.io/api/v2). */
  baseUrl?: string;
  /** OpenSea API key (sent as X-API-KEY header). */
  apiKey?: string;
  /** Optional chain filter for sales events (default ethereum). */
  chain?: string;
}

export class OpenSeaProvider implements FeedProvider {
  readonly protocol: Protocol = 'opensea';
  readonly schema: SchemaGuard = (data): boolean =>
    Array.isArray(data) || typeof data === 'object';
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly chain: string;
  private readonly breaker = new CircuitBreaker('opensea');

  constructor(options: OpenSeaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? OPENSEA_API_URL).replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.chain = options.chain ?? 'ethereum';
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.apiKey) headers['X-API-KEY'] = this.apiKey;
    return headers;
  }

  /** Fetch trending collections (primary signal). */
  private async fetchTrendingCollections(timeoutMs: number): Promise<OpenSeaCollection[]> {
    const url = `${this.baseUrl}/collections/trending?limit=20`;
    const data = await withTimeout(
      fetchJson<OpenSeaCollectionsResponse | OpenSeaCollection[]>(url, { headers: this.headers() }),
      timeoutMs,
      'opensea:trending',
    );
    if (Array.isArray(data)) return data.filter(isOpenSeaCollection);
    return (data.collections ?? []).filter(isOpenSeaCollection);
  }

  /** Fetch recent sales from the events feed (secondary signal). */
  private async fetchNotableSales(timeoutMs: number): Promise<OpenSeaSaleEvent[]> {
    const url = `${this.baseUrl}/events?event_type=sale&limit=20&chain=${encodeURIComponent(this.chain)}`;
    const data = await withTimeout(
      fetchJson<OpenSeaEventsResponse | OpenSeaSaleEvent[]>(url, { headers: this.headers() }),
      timeoutMs,
      'opensea:sales',
    );
    if (Array.isArray(data)) return data.filter(isOpenSeaSaleEvent);
    return (data.events ?? []).filter(isOpenSeaSaleEvent);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        let collections: OpenSeaCollection[] = [];
        let sales: OpenSeaSaleEvent[] = [];

        try {
          collections = await this.fetchTrendingCollections(timeoutMs);
        } catch {
          collections = [];
        }
        try {
          sales = await this.fetchNotableSales(timeoutMs);
        } catch {
          sales = [];
        }

        // Sort collections by 24h volume (desc)
        collections.sort(
          (a, b) =>
            (b.collection.stats?.one_day_volume ?? 0) - (a.collection.stats?.one_day_volume ?? 0),
        );

        const posts: UnifiedPost[] = [
          ...collections.slice(0, 20).map(collectionToUnifiedPost),
          ...sales.slice(0, 8).map(saleToUnifiedPost),
        ];

        if (posts.length === 0) {
          return {
            posts: [],
            notice: this.apiKey
              ? 'OpenSea returned no collections/sales'
              : 'OpenSea returned no data — set OPENSEA_API_KEY for full access',
          };
        }
        return {
          posts,
          notice: `OpenSea: ${collections.length} trending collections, ${sales.length} notable sales`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'OpenSea: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `OpenSea feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(`${this.baseUrl}/collections/trending?limit=1`, { headers: this.headers() }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'opensea:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
