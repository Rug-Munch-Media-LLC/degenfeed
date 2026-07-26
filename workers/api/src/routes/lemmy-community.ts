/**
 * @degenfeed/api-worker — Lemmy Community Management
 *
 * Create, moderate, and manage Lemmy communities on our instance
 * and across the fediverse.
 *
 * Endpoints:
 *   POST /api/lemmy/community/create        — Create community on our instance
 *   POST /api/lemmy/community/follow        — Subscribe/unsubscribe to community
 *   POST /api/lemmy/community/moderate      — Moderate: remove posts, ban users
 *   GET  /api/lemmy/community/:name/settings — Get community settings
 *   PUT  /api/lemmy/community/:name/settings — Update community settings
 *   POST /api/lemmy/post/vote               — Upvote/downvote a post
 *   POST /api/lemmy/comment/create          — Create a comment
 *
 * All write operations require a valid Lemmy JWT (from POST /api/lemmy/auth).
 */

import { log } from '../logger';
import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const LEMMY_INSTANCE_URL = 'https://community.degenfeed.xyz';
const LEMMY_API = `${LEMMY_INSTANCE_URL}/api/v3`;
const USER_AGENT = 'DegenFeed/0.1';
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 50000;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_SIDEBAR_LENGTH = 10000;

// ─── Helpers ───────────────────────────────────────────────────────────

function getJwtFromAuth(env: Env, bodyJwt?: string): string | null {
