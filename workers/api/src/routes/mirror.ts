/**
 * @degenfeed/api-worker — Mirror.xyz Bridge Routes
 *
 * Endpoints for the Mirror bridge integration:
 *   POST  /api/mirror/publish          — Publish article to Mirror network
 *   GET   /api/mirror/articles         — Get Mirror articles
 *   GET   /api/mirror/articles/:txId   — Single Mirror article by Arweave tx ID
 *   POST  /api/mirror/import           — Import Mirror article to DegenFeed
 *   GET   /api/mirror/trending         — Trending Mirror articles
 *   GET   /api/mirror/search           — Search Mirror articles
 */

import { MirrorBridge } from '@degenfeed/mirror-bridge';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────

interface MirrorEnv extends Env {
