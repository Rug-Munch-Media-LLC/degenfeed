/**
 * /api/follow — Protocol-native follow/unfollow API
 *
 * POST   /api/follow          — Follow a user on a specific protocol
 * DELETE /api/follow          — Unfollow a user
 * GET    /api/follow/list     — List all follows for the authenticated user
 * GET    /api/follow/check    — Check if following a specific user
 * GET    /api/follow/feed     — Feed filtered to content from followed users only
 *
 * All endpoints require a valid session cookie.
 * Data stored in KV under key: `user:following:{wallet_address}`
 * Backward-compat key: `user:follows:{wallet_address}` (flat ID array for feed pipeline)
 */

import { GtSClient } from '@degenfeed/mastodon-sdk';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────

type FollowEntry = {}
