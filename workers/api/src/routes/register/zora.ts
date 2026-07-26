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
