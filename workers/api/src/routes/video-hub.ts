/**
 * @degenfeed/api-worker — Video Hub Router
 *
 * Unified video discovery API aggregating YouTube, PeerTube, Shorts,
 * and Live Streams into a single categorized browsing experience.
 *
 * Routes:
 *   GET  /api/video/hub                   — Main hub feed (all sources, categorized)
 *   GET  /api/video/categories            — Category list with trends
 *   GET  /api/video/category/:id          — Videos in a specific category
 *   GET  /api/video/recommended           — Personalized recommendations
 *   GET  /api/video/search                — Unified search across all sources
 *   GET  /api/video/sources               — Available sources with health status
 *   POST /api/video/preferences           — Save user video category preferences
 *   GET  /api/video/trending              — Trending videos (with category filter)
 *   GET  /api/video/recommendations       — Personalized discovery page
 *   GET  /api/video/recommendations/related — Related to a specific video
 *   GET  /api/video/continue-watching     — Videos in progress
 *   GET  /api/video/creators/:creatorId   — Creator's video catalog
 *   GET  /api/video/playlists/:playlistId — Playlist with autoplay queue
 *   POST /api/video/watch                 — Record watch progress
 *   GET  /api/video/history               — Watch history (paginated)
 *   DELETE /api/video/history/:videoId    — Remove from history
 *   POST /api/video/history/clear         — Clear all history
 */

import { Hono } from 'hono';
import { type DiscoveryPage, discoveryEngine } from '../feed/video-discovery';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
