/**
 * @degenfeed/api-worker — Zora Protocol route registration
 *
 * Full Zora Protocol REST API for NFT minting, marketplace, and earnings.
 * All routes are self-hosted through our local Zora indexer.
 *
 * Routes registered:
 *   /api/zora/mint                    — Mint NFT on Zora
 *   /api/zora/nft/*                   — NFT management (collection, trending, details)
 *   /api/zora/marketplace/*           — Marketplace (buy, sell, bid, offer, analytics)
 *   /api/zora/earnings/*              — Creator earnings & Protocol Rewards
 */
import type { Hono } from 'hono';
import zoraCompat from '../../routes/zora-compat';
import zoraEarnings from '../../routes/zora-earnings';
import zoraMarketplace from '../../routes/zora-marketplace';
import zoraNFT from '../../routes/zora-nft';
import zoraVideo from '../../routes/zora-video';
import type { Env } from '../../types';

export function registerZoraRoutes(app: Hono<{ Bindings: Env }>): void {
  // Zora NFT Minting & Management
  //   POST /api/zora/mint          — Mint NFT
  //   POST /api/zora/nft/create-collection — Create collection
  //   GET  /api/zora/nft/trending  — Trending NFTs
  //   GET  /api/zora/nft/:address  — Collection NFTs
  //   GET  /api/zora/nft/:address/:tokenId — Single NFT
  //   POST /api/zora/nft/gasless-prepare  — Prepare gasless mint
  //   POST /api/zora/nft/gasless-submit   — Submit gasless mint
  //   POST /api/zora/upload        — Upload media to IPFS
  app.route('/api/zora', zoraNFT);

  // Zora Marketplace
  //   GET  /api/zora/marketplace/trending
  //   GET  /api/zora/marketplace/collection/:addr
  //   GET  /api/zora/marketplace/nft/:address/sales
  //   POST /api/zora/marketplace/buy
  //   POST /api/zora/marketplace/sell
  //   POST /api/zora/marketplace/bid
  //   POST /api/zora/marketplace/offer
  //   GET  /api/zora/marketplace/analytics
  //   GET  /api/zora/marketplace/health
  app.route('/api/zora/marketplace', zoraMarketplace);

  // Zora Creator Earnings & Protocol Rewards
  //   GET  /api/zora/earnings/:address/summary
  //   GET  /api/zora/earnings/:address/rewards
  //   POST /api/zora/earnings/:address/claim
  //   GET  /api/zora/earnings/:address/tips
  //   GET  /api/zora/earnings/:address/nfts
  //   GET  /api/zora/earnings/:address/top
  //   POST /api/zora/earnings/tip
  //   POST /api/zora/earnings/record
  app.route('/api/zora/earnings', zoraEarnings);

  // Zora Video NFTs (existing routes — kept for backwards compat)
  app.route('/api/zora/video', zoraVideo);

  // Zora Compatibility API (existing routes — third-party app integration)
  app.route('/api/zora/compat', zoraCompat);
}
