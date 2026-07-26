/**
 * @degenfeed/api-worker — Video Bridge Routes
 *
 * Direct API endpoints for all video platform bridges.
 * "Follow creators, not platforms" — get content from every platform.
 *
 * Routes:
 *   GET /api/video/bridges/:platform/channel/:channel   — Channel videos from a specific platform
 *   GET /api/video/bridges/:platform/trending           — Trending on a specific platform
 *   GET /api/video/bridges/:platform/search?q=          — Search a specific platform
 *   GET /api/video/bridges/sources                      — List all available bridge sources
 *   GET /api/video/bridges/search?q=&platforms=         — Cross-platform search
 *
 * Supported platforms: youtube, twitch, rumble, odysee, dtube,
 *                      peertube, bitchute, dailymotion, vimeo
 */

import { Hono } from 'hono';
import type { UnifiedVideo } from '../feed/video-aggregator';
import { BRIDGE_SOURCE_META, BRIDGE_SOURCES } from '../feed/video-bridges';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Import bridge fetchers ────────────────────────────────────────────────

import {
