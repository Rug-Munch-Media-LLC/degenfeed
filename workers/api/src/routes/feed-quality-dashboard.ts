/**
 * @degenfeed/api-worker — Feed Quality Dashboard Route
 *
 * Admin-only endpoint that returns feed quality metrics:
 * quality scores, category distribution, diversity, engagement, freshness.
 *
 * GET /api/admin/feed-quality/dashboard
 * GET /api/admin/feed-quality/history
 * POST /api/admin/feed-quality/snapshot
 */

import { Hono } from 'hono';
import {
