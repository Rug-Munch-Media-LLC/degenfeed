/**
 * @degenfeed/api-worker — Unified Video Feed Routes
 *
 * Consolidated video feed aggregating content from ALL video platforms.
 * Each item is labeled with its source platform for transparency.
 *
 * Routes:
 *   GET /api/video/unified-feed         — Paginated feed (filter by source, category)
 *   GET /api/video/unified-feed/trending — Trending across all platforms
 *
 * Zero-cost hosting: all external video served directly from source.
 */

import { Hono } from 'hono';
import { noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Router ────────────────────────────────────────────────────────────────

const unifiedVideoFeed = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/video/unified-feed — Paginated video feed from all platforms
// ═══════════════════════════════════════════════════════════════════════════

unifiedVideoFeed.get('/', async (c) => {
