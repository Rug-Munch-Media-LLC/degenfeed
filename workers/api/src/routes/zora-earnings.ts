/**
 * @degenfeed/api-worker — Zora Creator Earnings Routes
 *
 * Creator earnings on Zora via Protocol Rewards:
 *   GET    /api/zora/earnings/:address/summary     — Full earnings summary
 *   GET    /api/zora/earnings/:address/rewards      — Protocol Rewards balance
 *   POST   /api/zora/earnings/:address/claim        — Claim Protocol Rewards
 *   GET    /api/zora/earnings/:address/tips         — Recent tips received
 *   GET    /api/zora/earnings/:address/nfts         — Per-NFT earnings
 *   GET    /api/zora/earnings/:address/top          — Top earning NFTs
 *   POST   /api/zora/earnings/:address/record-earning — Record an earning event
 *   POST   /api/zora/earnings/tip                    — Send a tip
 *
 * All data is tracked via our self-hosted indexer + Zora Protocol Rewards.
 */
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraEarnings = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/summary — Full earnings summary
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/summary', async (c) => {
