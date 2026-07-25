/**
 * @routes/shorts — Unified Multi-Protocol Short-Form Video Endpoints
 *
 * Core pipeline:
 *   ShortsAggregator (legacy single-source) → legacy routes
 *   ShortsAggregatorV2 (enhanced multi-source) → new feed routes
 *   ShortsAlgorithm (recommendation engine) → personalized routes
 *   UnifiedShortsPipeline (publish to ALL protocols) → new publish routes
 *   UnifiedShortsFeed (fetch from ALL protocols) → new feed routes
 *   ZoraVideoIntegration (video NFTs) → Zora routes
 *
 * Legacy routes (unchanged):
 *   GET  /api/shorts             — Main shorts feed
 *   GET  /api/shorts/feed        — Main shorts feed (alias)
 *   GET  /api/shorts/trending    — Trending shorts (24h/7d window)
 *   GET  /api/shorts/for-you     — Personalized shorts
 *   GET  /api/shorts/source/:src — Shorts by source
 *   POST /api/shorts/create      — Create short via PeerTube
 *
 * New v2 routes:
 *   GET    /api/shorts/category/:cat       — Shorts by category (music, gaming, tech, comedy, etc.)
 *   POST   /api/shorts/watch               — Record watch event (for algorithm learning)
 *   POST   /api/shorts/feedback            — Explicit feedback (like/dislike/not-interested)
 *   GET    /api/shorts/algorithm/status    — Algorithm phase and profile stats for current user
 *
 * Unified routes (unchanged):
 *   POST /api/shorts/publish       — Publish short to selected protocols
 *   POST /api/shorts/mint          — Mint as Zora video NFT (after publish)
 *   GET  /api/shorts/unified/feed  — Unified multi-protocol shorts feed
 *   GET  /api/shorts/unified/:src  — Source-specific feed
 *   POST /api/shorts/:id/tip       — Tip a short
 *   POST /api/shorts/:id/share     — Share to a protocol
 *   GET  /api/shorts/zora/trending — Trending Zora video NFTs
 *   GET  /api/shorts/zora/creator  — Creator's Zora video NFTs
 */

import type { ShortVideoSource } from '@degenfeed/shorts-provider';
import type { UserInterestProfile } from '@degenfeed/shorts-provider/scorer';
import { ShortsAggregator } from '../feed/shorts-aggregator';
import { ShortsAggregatorV2 } from '../feed/shorts-aggregator-v2';
import { ShortsAlgorithm, type UserShortsProfile, type WatchEvent } from '../feed/shorts-algorithm';
import { FEED_SOURCE_LABELS, UnifiedShortsFeed } from '../feed/shorts-unified';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { type ShortProtocol, UnifiedShortsPipeline } from '../lib/unified-shorts';
import { ZoraVideoIntegration } from '../lib/zora-video';
import { methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';

// ─── GET /api/shorts/zora/trending — Trending Zora video NFTs ───────────

export async function handleZoraTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 50);

  const zora = new ZoraVideoIntegration(env);
  const nfts = await zora.getTrendingVideoNFTs(limit);

  return noCacheJsonResponse({ nfts, count: nfts.length });
}

// ─── GET /api/shorts/zora/creator — Creator's Zora video NFTs ──────────

export async function handleZoraCreator(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const creatorAddress = url.searchParams.get('creator');

  if (!creatorAddress) {
    return jsonResponse({ error: 'creator query parameter is required' }, 400);
  }

  const zora = new ZoraVideoIntegration(env);
  const nfts = await zora.getCreatorVideoNFTs(creatorAddress);

  return noCacheJsonResponse({ nfts, count: nfts.length });
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW ZORA SHORTS FEED + MARKETPLACE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/shorts/zora — Dedicated Zora shorts feed with marketplace data.
 *
 * Returns Zora video NFTs enriched with:
 *   - Current ask prices (buy button data)
 *   - Active bids (bid button data)
 *   - Creator earnings info
 *   - Edition counts
 *   - Cross-platform availability
 *
 * Query params: ?limit=20&include_marketplace=true&include_earnings=false
 */
export async function handleZoraFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit')) || 20), 100);
    const includeMarketplace = url.searchParams.get('include_marketplace') !== 'false';
    const includeEarnings = url.searchParams.get('include_earnings') === 'true';

    // Use ShortsAggregatorV2 to get Zora-only shorts (it now includes marketplace data)
    const aggregator = new ShortsAggregatorV2(env);
    const result = await aggregator.aggregate({
      sources: ['zora'],
      limit,
      deduplicate: true,
    });

    // If earnings requested, enrich with creator earnings
    const earningsMap: Record<string, string> = {};
    if (includeEarnings) {
      const { ZoraMarketplace } = await import('@degenfeed/zora-sdk');
      const marketplace = new ZoraMarketplace({});
      for (const short of result.shorts) {
        if (short.creatorAddress) {
          try {
            const earnings = await marketplace.getByCreator(
              short.creatorAddress as `0x${string}`,
              5,
            );
            const totalEth = earnings.reduce((sum, e) => sum + parseFloat(e.priceEth || '0'), 0);
            if (totalEth > 0) {
              earningsMap[short.id] = totalEth.toFixed(6);
            }
          } catch {
            // Non-critical
          }
        }
      }
    }

    return noCacheJsonResponse({
      shorts: result.shorts,
      sourceHealth: result.sourceHealth,
      marketplace: includeMarketplace
        ? {
            enabled: true,
            totalWithPrice: result.shorts.filter((s) => s.zoraPriceEth).length,
            totalWithBids: result.shorts.filter((s) => s.zoraBidCount && s.zoraBidCount > 0).length,
          }
        : undefined,
      earnings: includeEarnings ? earningsMap : undefined,
      count: result.shorts.length,
      aggregatedAt: result.aggregatedAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load Zora shorts feed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/zora/:tokenId/marketplace — Zora marketplace data for a specific NFT.
 *
 * Returns full marketplace state: current ask, active bids, price history.
 */
export async function handleZoraMarketplaceDetail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const url = new URL(request.url);
    const tokenId = url.pathname.split('/')[4]; // /api/shorts/zora/:tokenId/marketplace
    const contractAddress = url.searchParams.get('contract');
    const chain = url.searchParams.get('chain') || 'base';

    if (!tokenId) {
      return jsonResponse({ error: 'tokenId is required' }, 400);
    }

    // Get marketplace data from Zora SDK
    const shortAgg = new ShortsAggregatorV2(env);
    const marketData = await shortAgg['fetchZoraMarketplaceData'](
      contractAddress || 'base',
      tokenId,
    );

    // Get price history
    let priceHistory: Array<{ price: string; timestamp: number; event: string }> = [];
    try {
      const { ZoraMarketplace } = await import('@degenfeed/zora-sdk');
      const marketplace = new ZoraMarketplace({});
      const history = await marketplace.getPriceHistory(
        (contractAddress || '0x0000') as `0x${string}`,
        tokenId,
      );
      priceHistory = history.map((h) => ({
        price: h.priceEth,
        timestamp: h.timestamp * 1000,
        event: h.event,
      }));
    } catch {
      // Non-critical
    }

    return noCacheJsonResponse({
      tokenId,
      contractAddress,
      chain,
      marketplace: {
        askPrice: marketData.priceEth || null,
        bidCount: marketData.bidCount ?? 0,
        topBid: marketData.topBidEth || null,
        mintCount: marketData.mintCount ?? 0,
        canBuy: !!marketData.priceEth,
        canBid: (marketData.bidCount ?? 0) > 0,
      },
      priceHistory,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load marketplace data',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/zora/:tokenId/bid — Place a bid on a Zora video NFT.
 */
export async function handleZoraBid(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const tokenId = url.pathname.split('/')[4]; // /api/shorts/zora/:tokenId/bid
    const contractAddress = url.searchParams.get('contract') || '';
    const chain = url.searchParams.get('chain') || 'base';

    if (!tokenId || !contractAddress) {
      return jsonResponse({ error: 'tokenId and contract query param required' }, 400);
    }

    const body = (await request.json()) as {
      amount: string; // ETH amount
      expiresAt?: number;
    };

    if (!body.amount || parseFloat(body.amount) <= 0) {
      return jsonResponse({ error: 'amount must be a positive number' }, 400);
    }

    // Import viem for ether conversion
    const { parseEther } = await import('viem');

    // Use ZoraMarketplace SDK to place bid
    const { ZoraMarketplace } = await import('@degenfeed/zora-sdk');

    // For client-side signing, return encoded calldata
    // For relayer-based, submit via relayer
    const relayerUrl = (env as Record<string, string | undefined>).ZORA_RELAYER_URL;

    if (relayerUrl) {
      const relayRes = await fetch(relayerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chain,
          action: 'place_bid',
          tokenId,
          contractAddress,
          amountWei: parseEther(body.amount).toString(),
          bidder: session.address,
          expiresAt: body.expiresAt ?? Math.floor(Date.now() / 1000) + 86400 * 7,
        }),
      });

      if (!relayRes.ok) {
        const errText = await relayRes.text().catch(() => '');
        return jsonResponse({ error: `Relayer bid failed: ${errText.slice(0, 200)}` }, 502);
      }

      const relayData = (await relayRes.json()) as { txHash?: string };
      return noCacheJsonResponse({
        success: true,
        txHash: relayData.txHash,
        amount: body.amount,
        chain,
      });
    }

    // Without relayer, return bid params for client-side execution
    return noCacheJsonResponse({
      success: true,
      requiresSignature: true,
      tokenId,
      contractAddress,
      amountWei: parseEther(body.amount).toString(),
      bidder: session.address,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Bid failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * POST /api/shorts/zora/:tokenId/buy — Buy (collect) a Zora video NFT.
 */
export async function handleZoraBuy(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const tokenId = url.pathname.split('/')[4]; // /api/shorts/zora/:tokenId/buy
    const contractAddress = url.searchParams.get('contract') || '';
    const chain = url.searchParams.get('chain') || 'base';

    if (!tokenId || !contractAddress) {
      return jsonResponse({ error: 'tokenId and contract query param required' }, 400);
    }

    const body = (await request.json()) as {
      price?: string; // ETH amount (optional, defaults to ask price)
      recipient?: string;
    };

    const { parseEther } = await import('viem');

    // If no price specified, fetch current ask
    let priceWei: bigint;
    if (body.price) {
      priceWei = parseEther(body.price);
    } else {
      // Fetch current ask price from marketplace
      const shortAgg = new ShortsAggregatorV2(env);
      const marketData = await shortAgg['fetchZoraMarketplaceData'](contractAddress, tokenId);
      if (!marketData.priceEth) {
        return jsonResponse({ error: 'No active listing found for this NFT' }, 404);
      }
      priceWei = parseEther(marketData.priceEth);
    }

    const relayerUrl = (env as Record<string, string | undefined>).ZORA_RELAYER_URL;

    if (relayerUrl) {
      const relayRes = await fetch(relayerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chain,
          action: 'buy_nft',
          tokenId,
          contractAddress,
          priceWei: priceWei.toString(),
          buyer: session.address,
          recipient: body.recipient || session.address,
        }),
      });

      if (!relayRes.ok) {
        const errText = await relayRes.text().catch(() => '');
        return jsonResponse({ error: `Relayer buy failed: ${errText.slice(0, 200)}` }, 502);
      }

      const relayData = (await relayRes.json()) as { txHash?: string };
      return noCacheJsonResponse({
        success: true,
        txHash: relayData.txHash,
        priceEth: body.price || 'fetched',
        chain,
        explorerUrl: `https://basescan.org/tx/${relayData.txHash}`,
      });
    }

    // Without relayer, return buy params for client-side execution
    return noCacheJsonResponse({
      success: true,
      requiresSignature: true,
      tokenId,
      contractAddress,
      priceWei: priceWei.toString(),
      buyer: session.address,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Buy failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

/**
 * GET /api/shorts/zora/earnings/:address — Creator earnings from Zora mints.
 *
 * Returns total earnings, per-NFT breakdown, and Protocol Rewards.
 */
export async function handleZoraEarnings(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const url = new URL(request.url);
    const creatorAddress = url.pathname.split('/')[5]; // /api/shorts/zora/earnings/:address

    if (!creatorAddress || creatorAddress.length < 10) {
      return jsonResponse({ error: 'Valid creator address is required' }, 400);
    }

    // Use Zora SDK Earnings class
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk');
    const earnings = new ZoraEarnings({
      indexerUrl:
        (env as Record<string, string | undefined>).ZORA_INDEXER_URL || 'http://127.0.0.1:8091',
      rpcUrl: 'https://mainnet.base.org',
    });

    const [summary, topNFTs, protocolRewards] = await Promise.all([
      earnings.getCreatorEarnings(creatorAddress as `0x${string}`),
      earnings.getTopEarningNFTs(creatorAddress as `0x${string}`, 10),
      earnings.getProtocolRewards(creatorAddress as `0x${string}`),
    ]);

    return noCacheJsonResponse({
      creatorAddress,
      summary,
      topNFTs,
      protocolRewards,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Failed to load earnings',
        details: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 ENHANCED ENDPOINTS (ShortsAggregatorV2 + ShortsAlgorithm)
// ═══════════════════════════════════════════════════════════════════════════
