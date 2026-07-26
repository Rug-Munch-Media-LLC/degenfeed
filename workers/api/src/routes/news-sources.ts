/**
 * /api/news/sources — Source Health Dashboard.
 *
 * Endpoints:
 *   GET  /api/news/sources/health      — All sources with health status, last fetch, error rate
 *   POST /api/news/sources/refresh     — Force refresh all sources
 *   GET  /api/news/sources/stats       — Stats: total articles, by source, by category
 */

import { aggregateNews } from '../feed/news-aggregator';
import { NEWS_SOURCES } from '../feed/news-source-tiers';
import { log } from '../logger';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── KV Keys ──────────────────────────────────────────────────────────────

const SOURCE_HEALTH_PREFIX = 'news:source:health:';
const _SOURCE_COUNTS_PREFIX = 'news:source:counts:';
const CACHE_TTL_LONG = 86400; // 24 hours
const _CACHE_TTL_SHORT = 300; // 5 min

// ─── Types ────────────────────────────────────────────────────────────────

type SourceHealthEntry = {}
