/**
 * @degenfeed/api-worker — Zora Compatibility Router
 *
 * Exposes coin data in Zora's API format so third-party apps (zora.co, Uniswap,
 * DexScreener, wallets, etc.) can discover and interact with DegenFeed creator
 * coins without any integration work.
 *
 * Our coins deploy through ZoraFactory on Base, so they ARE Zora coins — this
 * router just bridges between our internal KV storage and the external-facing
 * Zora-compatible data shapes.
 *
 * Routes:
 *   GET  /api/zora/compat/coin/:address    — Coin data in Zora API format
 *   GET  /api/zora/compat/trending          — Trending coins (Zora-compatible)
 *   POST /api/zora/compat/webhook           — Webhook receiver for external apps
 *   GET  /api/zora/compat/apps              — List compatible third-party apps
 *   GET  /api/zora/compat/verify/:address   — Verify Zora compatibility status
 *
 * KV schema (CACHE namespace):
 *   zora:compat:coin:<address>        → ZoraCompatCoinData (cached, 5min TTL)
 *   zora:compat:trending              → ZoraCompatCoinData[] (cached, 2min TTL)
 *   zora:compat:webhook:config        → WebhookConfig
 *
 * @see https://coins.zora.co/api/v1/ — Zora Coins API reference
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Coin data shaped to match Zora's API response format.
 * Third-party apps consuming Zora's /coins endpoint can switch to our
 * compat endpoint without changing their parser.
 */
export type ZoraCompatCoinData = {}
