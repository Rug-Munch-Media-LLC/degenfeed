/**
 * @degenfeed/api-worker — Zora Video NFT Routes
 *
 * Full REST API for Zora video NFT lifecycle:
 *   POST   /api/zora/video/mint                    — Mint a video as Zora NFT
 *   GET    /api/zora/video/:id                     — Get video NFT details
 *   GET    /api/zora/video/trending                — Trending video NFTs
 *   GET    /api/zora/video/creator/:address        — Creator's video NFTs
 *   POST   /api/zora/video/:id/collect             — Collect/buy a video NFT
 *   POST   /api/zora/video/:id/tip                 — Tip via creator coin on video
 *   POST   /api/zora/video/:id/announce            — Announce to all protocols
 *
 * KV schema (CACHE namespace):
 *   zora:video:trending:{chain}          → ZoraVideoNFT[] (cached for 5 min)
 *   zora:video:creator:{address}         → ZoraVideoNFT[]
 *   zora:video:lookup:{chain}:{id}       → ZoraVideoNFT
 *   zora:video:announce:{id}             → AnnounceResult
 *
 * Integrates with @degenfeed/zora-sdk for on-chain operations and
 * the existing cross-protocol announcement system.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ZoraVideoMintRequest = {}
