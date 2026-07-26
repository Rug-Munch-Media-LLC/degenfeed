/**
 * @degenfeed/api-worker — Zora NFT Routes
 *
 * Full NFT lifecycle on Zora:
 *   POST   /api/zora/mint                     — Mint NFT on Zora
 *   POST   /api/zora/nft/create-collection    — Create NFT collection
 *   POST   /api/zora/nft/gasless-prepare      — Prepare gasless mint
 *   POST   /api/zora/nft/gasless-submit       — Submit gasless mint
 *   GET    /api/zora/nft/trending             — Trending NFTs
 *   GET    /api/zora/nft/:address/:tokenId    — NFT details
 *   GET    /api/zora/nft/:address             — All NFTs in collection
 *   POST   /api/zora/upload                   — Upload media to IPFS
 *
 * All data is self-hosted via our Zora indexer (port 8091).
 * On-chain operations go through @degenfeed/zora-sdk.
 */
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraNFT = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/mint — Mint an NFT on Zora
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/mint', async (c) => {
