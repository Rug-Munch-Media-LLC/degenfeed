/**
 * @routes/shorts — Unified Multi-Protocol Short-Form Video Endpoints
 *
 * Core pipeline:
 *   ShortsAggregator (legacy single-source) → legacy routes
 *   ShortsAggregatorV2 (enhanced multi-source) → new feed routes
 *   ShortsAlgorithm (recommendation engine) → personalized routes
 *   UnifiedShortsPipeline (publish to ALL protocols) → new publish routes
 *   UnifiedShortsFeed (fetch from ALL protocols) → new feed routes
 *   ZoraVideoIntegration (video NFTs) → Zora routes
 *
 * Legacy routes (unchanged):
 *   GET  /api/shorts             — Main shorts feed
 *   GET  /api/shorts/feed        — Main shorts feed (alias)
 *   GET  /api/shorts/trending    — Trending shorts (24h/7d window)
 *   GET  /api/shorts/for-you     — Personalized shorts
 *   GET  /api/shorts/source/:src — Shorts by source
 *   POST /api/shorts/create      — Create short via PeerTube
 *
 * New v2 routes:
 *   GET    /api/shorts/category/:cat       — Shorts by category (music, gaming, tech, comedy, etc.)
 *   POST   /api/shorts/watch               — Record watch event (for algorithm learning)
 *   POST   /api/shorts/feedback            — Explicit feedback (like/dislike/not-interested)
 *   GET    /api/shorts/algorithm/status    — Algorithm phase and profile stats for current user
 *
 * Unified routes (unchanged):
 *   POST /api/shorts/publish       — Publish short to selected protocols
 *   POST /api/shorts/mint          — Mint as Zora video NFT (after publish)
 *   GET  /api/shorts/unified/feed  — Unified multi-protocol shorts feed
 *   GET  /api/shorts/unified/:src  — Source-specific feed
 *   POST /api/shorts/:id/tip       — Tip a short
 *   POST /api/shorts/:id/share     — Share to a protocol
 *   GET  /api/shorts/zora/trending — Trending Zora video NFTs
 *   GET  /api/shorts/zora/creator  — Creator's Zora video NFTs
 */

import type { ShortVideoSource } from '@degenfeed/shorts-provider';
import type { UserInterestProfile } from '@degenfeed/shorts-provider/scorer';
import { ShortsAggregator } from '../feed/shorts-aggregator';
import { ShortsAggregatorV2 } from '../feed/shorts-aggregator-v2';
import { ShortsAlgorithm, type UserShortsProfile, type WatchEvent } from '../feed/shorts-algorithm';
import { FEED_SOURCE_LABELS, UnifiedShortsFeed } from '../feed/shorts-unified';
import { type ShortProtocol, UnifiedShortsPipeline } from '../lib/unified-shorts';
import { ZoraVideoIntegration } from '../lib/zora-video';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/shorts/publish — Publish short to selected protocols ─────

export async function handleUnifiedPublish(request: Request, env: Env): Promise<Response> {
