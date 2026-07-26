/**
 * @degenfeed/api-worker — YouTube Content Routes
 *
 * Dedicated YouTube video discovery endpoints with algorithmic curation.
 * All YouTube content is clearly labeled as YouTube (not PeerTube).
 *
 * Cache: 15-minute KV cache for trending/channel/search responses.
 * Personalized recommendations bypass cache.
 *
 * Routes:
 *   GET /api/youtube/trending     — Trending videos in a category
 *   GET /api/youtube/recommended  — Personalized recommendations
 *   GET /api/youtube/search       — Search YouTube videos
 *   GET /api/youtube/channels/:id — Channel info + videos
 *   GET /api/youtube/shorts       — YouTube Shorts feed
 *   GET /api/youtube/categories   — Available categories
 */

import { Hono } from 'hono';
import {
