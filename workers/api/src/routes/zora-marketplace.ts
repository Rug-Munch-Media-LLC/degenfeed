/**
 * @degenfeed/api-worker — Zora Marketplace Routes
 *
 * Marketplace operations for Zora NFTs:
 *   GET    /api/zora/marketplace/trending       — Trending marketplace listings
 *   GET    /api/zora/marketplace/collection/:addr — Collection floor + analytics
 *   GET    /api/zora/marketplace/nft/:addr/:id   — NFT price history
 *   POST   /api/zora/marketplace/buy             — Buy NFT at fixed price
 *   POST   /api/zora/marketplace/sell            — List NFT for sale
 *   POST   /api/zora/marketplace/bid             — Place bid on auction
 *   POST   /api/zora/marketplace/offer           — Make offer on NFT
 *   GET    /api/zora/marketplace/analytics       — Marketplace analytics
 *   GET    /api/zora/marketplace/health          — Marketplace health check
 */
import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraMarketplace = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/trending — Trending marketplace listings
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/trending', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);
  const sort = c.req.query('sort') ?? 'volume';

  try {
    const url = `${INDEXER_URL}/api/collections?limit=${limit}&sort=${sort}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      return jsonResponse({ error: 'Indexer unavailable' }, 502);
    }

    const data = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
      meta?: Record<string, unknown>;
    };

    if (!data.data) {
      return noCacheJsonResponse({ listings: [], meta: { total: 0 } });
    }

    const listings = data.data.map((col: Record<string, unknown>) => ({
      id: `zora:listing:${col.address}`,
      contractAddress: col.address,
      name: col.name,
      symbol: col.symbol,
      totalSupply: col.total_supply,
      floorPrice: col.floor_price ?? 0,
      floorChange: col.floor_change ?? 0,
      volume: col.volume ?? 0,
      volumeChange: col.volume_change ?? 0,
      salesCount: col.sales_count ?? 0,
      image: col.image,
      nftStandard: col.nft_standard,
      chainId: col.chain_id ?? 8453,
    }));

    return noCacheJsonResponse({
      listings,
      meta: data.meta ?? { total: listings.length, returned: listings.length, limit },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch trending: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/collection/:address — Collection details + floor
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/collection/:address', async (c) => {
  const addr = c.req.param('address').toLowerCase();

  if (!addr.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid address' }, 400);
  }

  try {
    const res = await fetch(`${INDEXER_URL}/api/collections/${addr}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const data = (await res.json()) as { data?: Record<string, unknown> };

    if (!data.data) {
      return jsonResponse({ error: 'Collection not found' }, 404);
    }

    const col = data.data;
    const collectionDetails = {
      address: col.address,
      name: col.name,
      symbol: col.symbol,
      description: col.description,
      image: col.image,
      totalSupply: col.total_supply,
      nftStandard: col.nft_standard,
      floorPrice: col.floor_price ?? 0,
      floorChange: col.floor_change ?? 0,
      volume: col.volume ?? 0,
      volumeChange: col.volume_change ?? 0,
      salesCount: col.sales_count ?? 0,
      chainId: col.chain_id ?? 8453,
      zoraUrl: `https://zora.co/explore/${addr}`,
      basescanUrl: `https://basescan.org/address/${addr}`,
    };

    return noCacheJsonResponse({ collection: collectionDetails });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch collection: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/nft/:address/:id — NFT price history
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/nft/:address/sales', async (c) => {
  const addr = c.req.param('address').toLowerCase();

  if (!addr.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid address' }, 400);
  }

  try {
    const res = await fetch(`${INDEXER_URL}/api/sales?collection=${addr}&limit=100`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return jsonResponse({ data: [], sales: [] });
    }

    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return noCacheJsonResponse({
      sales: data.data ?? [],
      total: data.data?.length ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch sales: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/marketplace/buy — Buy NFT at fixed price
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.post('/buy', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.contractAddress || !body.priceWei) {
      return jsonResponse({ error: 'contractAddress and priceWei required' }, 400);
    }

    const { ZoraMarketplace } = await import('@degenfeed/zora-sdk/marketplace');
    const marketplace = new ZoraMarketplace({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
      indexerUrl: INDEXER_URL,
    });

    const result = await marketplace.buyNow({
      contractAddress: body.contractAddress as `0x${string}`,
      tokenId: (body.tokenId as string) ?? '1',
      buyer: session.address! as `0x${string}`,
      priceWei: BigInt(body.priceWei as string),
      seller: (body.seller as `0x${string}`) || '0x0000000000000000000000000000000000000000',
    });

    return noCacheJsonResponse({ ok: true, trade: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Buy failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/marketplace/sell — List NFT for sale
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.post('/sell', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.contractAddress || !body.priceWei) {
      return jsonResponse({ error: 'contractAddress and priceWei required' }, 400);
    }

    const { ZoraMarketplace } = await import('@degenfeed/zora-sdk/marketplace');
    const marketplace = new ZoraMarketplace({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
      indexerUrl: INDEXER_URL,
    });

    const result = await marketplace.sell({
      contractAddress: body.contractAddress as `0x${string}`,
      tokenId: (body.tokenId as string) ?? '1',
      seller: session.address! as `0x${string}`,
      priceWei: BigInt(body.priceWei as string),
    });

    return noCacheJsonResponse({ ok: true, trade: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Sell failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/marketplace/bid — Place bid on auction
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.post('/bid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.contractAddress || !body.amountWei) {
      return jsonResponse({ error: 'contractAddress and amountWei required' }, 400);
    }

    const { ZoraMarketplace } = await import('@degenfeed/zora-sdk/marketplace');
    const marketplace = new ZoraMarketplace({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
      indexerUrl: INDEXER_URL,
    });

    const result = await marketplace.placeBid({
      contractAddress: body.contractAddress as `0x${string}`,
      tokenId: (body.tokenId as string) ?? '1',
      bidder: session.address! as `0x${string}`,
      amountWei: BigInt(body.amountWei as string),
      expiresAt: body.expiresAt as number | undefined,
    });

    return noCacheJsonResponse({ ok: true, bid: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Bid failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/marketplace/offer — Make offer on NFT
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.post('/offer', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.contractAddress || !body.amountWei) {
      return jsonResponse({ error: 'contractAddress and amountWei required' }, 400);
    }

    const { ZoraMarketplace } = await import('@degenfeed/zora-sdk/marketplace');
    const marketplace = new ZoraMarketplace({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
      indexerUrl: INDEXER_URL,
    });

    const result = await marketplace.makeOffer({
      contractAddress: body.contractAddress as `0x${string}`,
      tokenId: (body.tokenId as string) ?? '1',
      maker: session.address! as `0x${string}`,
      amountWei: BigInt(body.amountWei as string),
      expiresAt: body.expiresAt as number | undefined,
    });

    return noCacheJsonResponse({ ok: true, offer: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Offer failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/analytics — Marketplace analytics
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/analytics', async (c) => {
  try {
    // Get indexer stats
    const statsRes = await fetch(`${INDEXER_URL}/api/stats`, {
      signal: AbortSignal.timeout(5000),
    });

    // Get top collections for volume
    const topRes = await fetch(`${INDEXER_URL}/api/collections?limit=5&sort=volume`, {
      signal: AbortSignal.timeout(5000),
    });

    const stats = statsRes.ok ? ((await statsRes.json()) as Record<string, unknown>) : {};
    const topCollections = topRes.ok
      ? (((await topRes.json()) as { data?: Record<string, unknown>[] }).data ?? [])
      : [];

    // Build analytics summary
    const volumeTop = topCollections
      .map((c: Record<string, unknown>) => ({
        address: c.address,
        name: c.name,
        volume: c.volume ?? 0,
        salesCount: c.sales_count ?? 0,
        floorPrice: c.floor_price ?? 0,
      }))
      .sort((a, b) => (b.volume as number) - (a.volume as number));

    return noCacheJsonResponse({
      stats: {
        totalCollections: stats.collections ?? 0,
        totalTokens: stats.tokens ?? 0,
        totalMints: stats.mints ?? 0,
        totalSales: stats.sales ?? 0,
        totalTips: stats.tips ?? 0,
        totalEarnings: stats.earnings_events ?? 0,
      },
      topCollections: volumeTop.slice(0, 5),
      source: 'self-hosted indexer',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Analytics fetch failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/health — Marketplace health check
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/health', async (c) => {
  const start = Date.now();
  let indexerHealthy = false;

  try {
    const res = await fetch(`${INDEXER_URL}/health`, { signal: AbortSignal.timeout(3000) });
    indexerHealthy = res.ok;
  } catch {
    // Indexer unavailable
  }

  return noCacheJsonResponse({
    service: 'zora-marketplace',
    indexer: indexerHealthy ? 'connected' : 'unavailable',
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
});

export default zoraMarketplace;
