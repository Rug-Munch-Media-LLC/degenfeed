/**
 * @degenfeed/api-worker — Unified Image Feed Router
 *
 * Aggregates images from ALL sources into one unified feed:
 *   GET /api/feed/images/trending    — Trending images
 *   GET /api/feed/images/latest      — Latest images
 *   GET /api/feed/images/category    — By category (art, photography, memes, nft)
 *   GET /api/feed/images/creator     — By creator
 *
 * Types: ./image-feed-types
 * Source fetchers: ./image-feed-sources
 */

import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import type { ImageCategory, ImageFeedResponse, UnifiedImage } from './image-feed-types';
import {
