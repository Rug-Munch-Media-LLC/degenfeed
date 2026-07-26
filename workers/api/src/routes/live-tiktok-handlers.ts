/**
 * @degenfeed/api-worker — Live TikTok-Style API Handlers
 *
 * Endpoints:
 *   Emojis:     POST /api/live/emojis/create
 *               GET  /api/live/emojis/marketplace
 *               POST /api/live/emojis/:id/buy
 *               GET  /api/live/emojis/my-purchases
 *               GET  /api/live/emojis/creator/:creatorId
 *
 *   Custom Gifts: POST  /api/live/gifts/custom/create
 *                 GET   /api/live/gifts/custom/:creatorId
 *                 POST  /api/live/gifts/custom/:id/buy
 *                 POST  /api/live/gifts/custom/:id/send
 *
 *   Filters:    GET  /api/live/filters
 *               POST /api/live/filters/:id/buy
 *               GET  /api/live/filters/my-filters
 *
 *   Stickers:   GET  /api/live/stickers
 *               POST /api/live/stickers/:id/buy
 *               POST /api/live/stickers/:id/trigger
 *
 *   Earnings:   GET /api/live/creator-content/earnings
 */

import { badRequest, ok } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
