/**
 * @degenfeed/api-worker — Zora Video Discovery & Integration Wrapper
 *
 * Integrates Zora video content (video NFTs) into the DegenFeed unified video hub,
 * shorts feed, and creator coin ecosystem.
 *
 * Capabilities:
 *   1. Zora video discovery — Pull trending/popular videos from Zora
 *   2. Unified player — Embed Zora videos in our video discovery + shorts feed
 *   3. Creator coin integration — Zora videos can be tipped with DegenFeed creator coins
 *   4. Cross-platform — Zora videos appear in our video hub alongside PeerTube/YouTube/etc.
 *
 * API endpoints (handled by zora-video-routes.ts):
 *   GET    /api/zora/videos/trending     — Trending Zora videos
 *   GET    /api/zora/videos/:id          — Video details
 *   POST   /api/zora/videos/:id/tip      — Tip creator via DegenFeed coin
 *   GET    /api/zora/creators/:address   — Creator's video catalog
 *
 * Uses @degenfeed/zora-sdk for on-chain operations and video SDK.
 * Integrates with the video-platform-wrapper for unified aggregation.
 */

import type { Env } from '../types';

// ─── Zora Video Types ────────────────────────────────────────────────────

export type ZoraNetwork = 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';

export type ZoraVideoItem = {}
