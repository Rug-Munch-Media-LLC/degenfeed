/**
 * @degenfeed/api-worker — Coin Statistics & Leaderboard API (TASK 1)
 *
 * Public endpoints for platform-wide coin statistics:
 *   GET /api/coins/stats/overview        — Platform overview
 *   GET /api/coins/stats/top             — Top coins by dimension
 *   GET /api/coins/stats/trending        — Highest volume growth (24h)
 *   GET /api/coins/stats/new             — Newest coins (launched < 7 days)
 *   GET /api/coins/stats/gainers         — Top % gainers
 *   GET /api/coins/stats/losers          — Top % losers
 *   GET /api/coins/stats/most-holders    — Most holders
 *   GET /api/coins/stats/highest-volume  — Highest 24h volume
 */

import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type CoinStatsItem = {};
