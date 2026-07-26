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
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraMarketplace = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/marketplace/trending — Trending marketplace listings
// ═════════════════════════════════════════════════════════════════════════

zoraMarketplace.get('/trending', async (c) => {
