/**
 * Feed unified routes — /api/feed/unified/*
 *
 * Universal content pipeline API that fills DegenFeed timelines with
 * quality content from EVERY connected network.
 *
 * Endpoints:
 *   GET  /api/feed/unified              — Unified feed with all sources
 *   GET  /api/feed/unified/trending      — Trending across all networks
 *   GET  /api/feed/unified/for-you       — Personalized feed
 *   GET  /api/feed/unified/category/:id  — Category-specific feed
 *   GET  /api/feed/unified/search        — Search across all networks
 *   GET  /api/feed/unified/sources       — Available feed sources with health
 *   POST /api/feed/unified/default       — Build default feed (new users)
 *
 * Query params (most endpoints):
 *   wallet     — User's wallet address (for personalization)
 *   sort       — trending | newest | curated | for-you
 *   limit      — Max posts (default 50, max 200)
 *   cursor     — Pagination cursor
 *   sources    — Comma-separated source keys (activitypub,nostr,farcaster,...)
 *   protocols  — Comma-separated protocol names
 *   q          — Search query (search endpoint only)
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import {
