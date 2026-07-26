/**
 * @degenfeed/api-worker — Trending Aggregation Endpoints
 *
 * GET /api/trending/aggregated   — All-platform trending merged
 * GET /api/trending/per-platform — Per-platform trending (?platform=reddit)
 *
 * Data sourced from KV cache populated by the trending scraper cron job.
 * Falls back to direct scraping if cache is stale.
 */

import { CrossNetworkSearch } from '../lib/cross-search';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
