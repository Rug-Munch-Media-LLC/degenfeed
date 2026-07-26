/**
 * @degenfeed/api-worker — Scheduled post route
 *
 * POST /api/schedule   — Schedule a cross-platform post
 * GET  /api/scheduled  — List active scheduled posts for the current user
 *
 * Premium gating:
 *   Free users:   max 5 active scheduled posts
 *   Pro+:         unlimited
 *
 * The GET endpoint requires authentication and returns all scheduled posts
 * (pending, published, failed) for the requesting user, newest first.
 */

import { requirePremiumTier } from '../premium';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

/** Scheduled post KV prefix */
const SCHEDULED_PREFIX = 'scheduled:';
/** Per-user index KV key */
function userScheduledKey(wallet: string): string {
