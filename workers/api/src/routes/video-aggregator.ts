/**
 * @degenfeed/api-worker — Video Aggregator Routes
 *
 * "Follow creators, not platforms" — API endpoints for the intelligent
 * cross-platform video aggregator. Users follow creators ONCE and get
 * content from every platform that creator is on.
 *
 * Routes:
 *   GET    /api/video/aggregator/creator/:id    — All videos from a creator (all platforms)
 *   GET    /api/video/aggregator/trending/:category — Trending in category (all platforms)
 *   GET    /api/video/aggregator/feed           — Personalized feed (follows across platforms)
 *   GET    /api/video/aggregator/search         — Search across all video platforms
 *   POST   /api/video/aggregator/follow         — Follow creator across all platforms
 *
 * KV schema:
 *   video:agg:creator:{id}:{limit}    → UnifiedVideo[]
 *   video:agg:trending:{cat}:{limit}  → UnifiedVideo[]
 *   video:agg:feed:{wallet}:{limit}   → UnifiedVideo[]
 *   video:agg:search:{q}:{limit}      → UnifiedVideo[]
 *   follow:{wallet}                   → string[] (creator IDs)
 */

import { Hono } from 'hono';
import { VideoAggregator } from '../feed/video-aggregator';
import type { VideoPlatform } from '../lib/creator-resolver';
import { CreatorResolver } from '../lib/creator-resolver';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Badge colors for all supported platforms ──────────────────────────────

export const PLATFORM_BADGES: Record<string, { label: string; color: string }> = {
