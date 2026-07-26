/**
 * /api/custom-feeds — Custom feed recipes (Bluesky-style feed builder)
 *
 * POST   /api/custom-feeds            — Create a custom feed
 * GET    /api/custom-feeds            — List my custom feeds
 * GET    /api/custom-feeds/public     — List public feeds (discoverable)
 * GET    /api/custom-feeds/:id        — Get feed details
 * PUT    /api/custom-feeds/:id        — Update feed recipe
 * DELETE /api/custom-feeds/:id        — Delete feed
 * POST   /api/custom-feeds/:id/subscribe   — Subscribe to a public feed
 *
 * KV keys:
 *   custom-feed:{id}              → JSON CustomFeed
 *   user:custom-feeds:{wallet}    → JSON array of feed IDs (created by user)
 *   custom-feed:subscribers:{id}  → JSON array of wallet addresses
 *   user:subscriptions:{wallet}   → JSON array of feed IDs (subscribed to)
 */

import { scorePost } from '@degenfeed/ranking';
import type { CustomFeed, FeedRecipe, Protocol, UnifiedPost } from '@degenfeed/types';
import { ContentPipeline } from '../feed/content-pipeline';
import { log } from '../logger';
import { requirePremiumTier } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Helpers ──────────────────────────────────────────────────

function feedKey(id: string): string {
