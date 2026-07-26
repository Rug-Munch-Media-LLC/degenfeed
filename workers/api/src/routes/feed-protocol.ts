/**
 * @degenfeed/api-worker — Protocol-specific feed routes
 *
 * Endpoints that return feeds scoped to a single protocol with
 * different sort/ranking modes. Works for ANY protocol in the system.
 *
 * Routes:
 *   GET /api/feed/protocol/:protocol          — Protocol feed (default: scored)
 *   GET /api/feed/protocol/:protocol/popular  — By engagement (likes + reposts)
 *   GET /api/feed/protocol/:protocol/trending — By velocity (engagement rate over time)
 *   GET /api/feed/protocol/:protocol/newest   — Chronological (newest first)
 *   GET /api/feed/protocol/:protocol/videos   — Video/image content only
 */

import type { UnifiedPost } from '@degenfeed/types';
import {
