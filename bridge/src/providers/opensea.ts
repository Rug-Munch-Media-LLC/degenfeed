/**
 * OpenSea bridge provider
 *
 * Integrates the largest NFT marketplace's real-time event data into DegenFeed.
 * Uses the OpenSea Stream API (WebSocket) for real-time events + REST API for trending.
 *
 * API Docs: https://docs.opensea.io/reference/stream-api-overview
 * SDK: @opensea/stream-js (MIT)
 *
 * Features:
 * - Real-time NFT sales, listings, and offers via Stream API
 * - Trending collections and mints
 * - Cross-chain data (Ethereum, Polygon, Arbitrum, Optimism, Base)
 * - Floor price tracking
 *
 * Rate Limits: 10 req/s (REST), WebSocket (unlimited)
 * Auth: API Key from opensea.io/settings/developer
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const OPENSEA_API = process.env.OPENSEA_API_URL || 'https://api.opensea.io/api/v2';
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || '';
const _OPENSEA_STREAM_WS = process.env.OPENSEA_STREAM_WS || 'wss://stream-api.opensea.io/socket';

// ─── Types ─────────────────────────────────────────────────────────────

interface OpenSeaCollection {
  collection: string;
  name: string;
  description?: string;
  image_url?: string;
  slug: string;
  floor_price?: number;
  total_supply?: number;
  stats?: {
    total_volume: number;
    floor_price: number;
    num_owners: number;
    total_supply: number;
  };
}

interface OpenSeaAsset {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string;
  description?: string;
  image_url?: string;
  metadata_url?: string;
  opensea_url: string;
}

interface OpenSeaEvent {
  event_type: string;
  event_timestamp: number;
  payload: {
    item: OpenSeaAsset;
    collection: {
      slug: string;
      name: string;
      image_url?: string;
    };
    listing?: {
      price: { amount: string; currency: string };
      quantity: number;
      start_date: number;
      end_date: number;
    };
    sale?: {
      price: { amount: string; currency: string };
      quantity: number;
      transaction: string;
      timestamp: number;
    };
    bid?: {
      price: { amount: string; currency: string };
      quantity: number;
      bidder: { address: string };
      expiry: number;
    };
    offer?: {
      price: { amount: string; currency: string };
      maker: { address: string };
      expiry: number;
    };
    from_address?: string;
    to_address?: string;
    version: number;
  };
}

interface OpenSeaCollectionResponse {
  collections: OpenSeaCollection[];
  next?: string;
}

interface OpenSeaEventsResponse {
  asset_events: OpenSeaEvent[];
  next?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = `${text} ${tags.join(' ')}`.toLowerCase();

  if (/\b(nft|art|collectible|mint|collection)\b/.test(lower)) niches.push('nft');
  if (/\b(eth|ethereum|base|arbitrum|polygon|optimism)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana)\b/.test(lower)) niches.push('solana');
  if (/\b(btc|bitcoin|ordinals)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(gaming|game|play|guild)\b/.test(lower)) niches.push('gaming');
  if (/\b(ai |artificial|generative)\b/.test(lower)) niches.push('ai');
  if (/\b(defi|finance|yield)\b/.test(lower)) niches.push('defi');
  if (/\b(crypto|blockchain|web3|token)\b/.test(lower)) niches.push('crypto');

  if (niches.length === 0) niches.push('nft');
  return niches;
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'item_listed':
      return '📋 Listed';
    case 'item_sold':
      return '💎 Sold';
    case 'item_transferred':
      return '🔄 Transferred';
    case 'item_received_offer':
      return '💰 Offer Received';
    case 'item_received_bid':
      return '🔨 Bid Received';
    case 'item_cancelled':
      return '❌ Cancelled';
    case 'item_metadata_updated':
      return '📝 Metadata Updated';
    default:
      return '📌 Event';
  }
}

function openseaEventToPost(event: OpenSeaEvent): UnifiedPost | null {
  const item = event.payload.item;
  const collection = event.payload.collection;
  if (!item?.identifier) return null;

  const eventType = event.event_type || 'unknown';
  const eventLabel = getEventTypeLabel(eventType);

  const nftName = item.name || `${collection?.name || 'NFT'} #${item.identifier}`;
  const description = item.description || '';

  let text = `${eventLabel}: ${nftName}`;
  let priceStr = '';

  if (event.payload.sale) {
    priceStr = ` for ${event.payload.sale.price.amount} ${event.payload.sale.price.currency}`;
    text = `💎 Sold: ${nftName}${priceStr}`;
  } else if (event.payload.listing) {
    priceStr = ` for ${event.payload.listing.price.amount} ${event.payload.listing.price.currency}`;
    text = `📋 Listed: ${nftName}${priceStr}`;
  } else if (event.payload.bid) {
    priceStr = ` for ${event.payload.bid.price.amount} ${event.payload.bid.price.currency}`;
    text = `🔨 Bid: ${nftName}${priceStr}`;
  } else if (event.payload.offer) {
    priceStr = ` for ${event.payload.offer.price.amount} ${event.payload.offer.price.currency}`;
    text = `💰 Offer: ${nftName}${priceStr}`;
  }

  if (description) text += ` — ${description.slice(0, 200)}`;

  const chain = item.contract?.split(':')[0] || 'ethereum';

  return {
    id: `opensea:${item.identifier}:${eventType}:${event.event_timestamp}`,
    protocol: 'opensea',
    author: {
      id: `opensea:collection:${collection?.slug || 'unknown'}`,
      primary: { protocol: 'opensea', id: collection?.slug || 'unknown' },
      handles: { opensea: collection?.slug || null },
      displayName: collection?.name || 'OpenSea Collection',
      bio: '',
      avatarUrl: collection?.image_url || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: item.image_url ? [{ kind: 'image' as const, url: item.image_url }] : [],
    contentType: 'text',
    createdAt: event.event_timestamp ? event.event_timestamp * 1000 : Date.now(),
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: event,
    niches: guessNiches(text, [collection?.slug || '', chain]),
    community: collection
      ? {
          name: collection.slug || 'opensea',
          title: collection.name || 'OpenSea Collection',
        }
      : undefined,
  };
}

function openseaApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'DegenFeed-Bridge/0.1',
  };
  if (OPENSEA_API_KEY) {
    headers['X-API-KEY'] = OPENSEA_API_KEY;
  }
  return headers;
}

// ─── Data Sources ────────────────────────────────────────────────────────

async function fetchTrendingCollections(limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${OPENSEA_API}/collections?limit=${Math.min(limit, 50)}&order_by=seven_day_volume&order_direction=desc`;
    const res = await $fetch(url, {
      headers: openseaApiHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as OpenSeaCollectionResponse;
    const collections = data.collections || [];

    return collections.map((c) => {
      const floorPrice = c.stats?.floor_price || c.floor_price || 0;
      const totalVol = c.stats?.total_volume || 0;
      return {
        id: `opensea:collection:${c.collection || c.slug}`,
        protocol: 'opensea',
        author: {
          id: `opensea:collection:${c.slug}`,
          primary: { protocol: 'opensea', id: c.slug },
          handles: { opensea: c.slug || null },
          displayName: c.name || c.slug,
          bio: c.description?.slice(0, 160) || '',
          avatarUrl: c.image_url || '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `📊 Trending Collection: ${c.name}${floorPrice ? ` — Floor ${floorPrice} ETH` : ''}${totalVol ? ` (7d vol: ${totalVol.toFixed(1)} ETH)` : ''}`,
        embeds: c.image_url ? [{ kind: 'image' as const, url: c.image_url }] : [],
        contentType: 'text',
        createdAt: Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: c,
        niches: guessNiches(`${c.name} ${c.description || ''} nft`, []),
        community: {
          name: c.slug,
          title: c.name || c.slug,
        },
      } as UnifiedPost;
    });
  } catch (err) {
    // console.log(`[bridge] OpenSea trending collections error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchRecentEvents(limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${OPENSEA_API}/events?limit=${Math.min(limit, 50)}&event_type=sale&event_type=listing`;
    const res = await $fetch(url, {
      headers: openseaApiHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as OpenSeaEventsResponse;
    const events = data.asset_events || [];
    return events.map(openseaEventToPost).filter((p): p is UnifiedPost => p !== null);
  } catch (err) {
    // console.log(`[bridge] OpenSea events error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'opensea',
  name: 'OpenSea',
  description: 'Largest NFT marketplace — real-time sales, listings & trending collections',
  endpoint: '/api/feed/opensea',
  requiresAuth: false,
  authEnvVar: 'OPENSEA_API_KEY',
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchOpenSeaPosts(limit = 20): Promise<UnifiedPost[]> {
  if (!OPENSEA_API_KEY) {
    // console.log('[bridge] OpenSea: No API key configured, returning empty');
    return [];
  }

  const perSource = Math.max(5, Math.ceil(limit / 2));

  const [collections, events] = await Promise.all([
    fetchTrendingCollections(perSource),
    fetchRecentEvents(perSource),
  ]);

  const all = [...collections, ...events];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    const key = p.id;
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] OpenSea: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchOpenSeaPosts;
