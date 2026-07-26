/**
 * @degenfeed/api-worker — Content Library API Routes
 *
 * CRUD operations for the unified content library.
 *
 * GET    /api/content/library                      — List all content (filterable)
 * GET    /api/content/library/:contentId            — Get content detail with all protocol copies
 * PUT    /api/content/library/:contentId            — Update content (edit, add protocols)
 * DELETE /api/content/library/:contentId            — Delete content (optionally from protocols)
 * POST   /api/content/library/:contentId/sync       — Sync engagement metrics from all protocols
 *
 * POST   /api/content/library/:contentId/license    — Set content license
 * GET    /api/content/library/:contentId/license    — Get content license
 *
 * POST   /api/content/library/:contentId/monetization  — Set monetization config
 * GET    /api/content/library/:contentId/monetization  — Get monetization config
 *
 * GET    /api/content/library/:contentId/usage         — Get usage history
 *
 * POST   /api/content/library/sync-all                 — Sync engagement for ALL content
 */

import type { ContentType } from '../lib/content-library';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
