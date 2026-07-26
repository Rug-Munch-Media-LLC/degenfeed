/**
 * /api/bookmarks — Cross-protocol bookmarks via KV storage
 *
 * POST   /api/bookmarks          — Add or update a bookmark
 * DELETE /api/bookmarks?id=...   — Remove a bookmark
 * GET    /api/bookmarks          — List all bookmarks for the authenticated user
 * GET    /api/bookmarks/check    — Check if a post is bookmarked
 *
 * All endpoints require a valid session cookie.
 * Data stored in KV under key: `bookmarks:{wallet_address}`
 */

import { bookmarksKey } from '../kv-key-patterns';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────

type BookmarkEntry = {};
