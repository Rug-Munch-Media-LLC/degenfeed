/**
 * @degenfeed/api-worker — Creator Coin Dashboard API (TASK 3)
 *
 * Admin endpoints for creators who have launched coins:
 *   GET    /api/creator/coins                  — list creator's coins
 *   GET    /api/creator/coin/:address/stats    — real-time stats
 *   GET    /api/creator/coin/:address/holders  — holder list with balances
 *   GET    /api/creator/coin/:address/trades   — recent trades
 *   POST   /api/creator/coin/:address/burn     — burn tokens
 *   POST   /api/creator/coin/:address/airdrop  — airdrop to addresses
 *   POST   /api/creator/coin/:address/gated-post — create token-gated content
 *   GET    /api/creator/coin/:address/revenue  — revenue breakdown
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
