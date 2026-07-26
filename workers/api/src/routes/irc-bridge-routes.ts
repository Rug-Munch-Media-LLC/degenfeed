/**
 * @degenfeed/api-worker — IRC Bridge Routes
 *
 * IRC bridge management via matrix-appservice-irc.
 *
 * GET    /api/irc/bridge/health          — Bridge health status
 * GET    /api/irc/bridge/channels        — List connected IRC channels
 * POST   /api/irc/bridge/join            — Join an IRC channel
 * POST   /api/irc/bridge/leave           — Leave an IRC channel
 * POST   /api/irc/bridge/send            — Send message to IRC channel
 * GET    /api/irc/bridge/curated         — List curated IRC channels
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── IRC Bridge Client Factory ──────────────────────────────────────────────

async function getIrcClient(env: Env) {
