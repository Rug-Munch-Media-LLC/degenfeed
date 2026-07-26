/**
 * /api/newsletter/bridge — Substack / Ghost Newsletter Bridge
 *
 * Connect Substack or Ghost RSS feeds to auto-cross-post new articles
 * to all connected DegenFeed protocols.
 *
 * Endpoints:
 *   POST   /api/newsletter/bridge/connect    { type, url, apiKey?, autoCrossPost, targetProtocols[] }
 *   DELETE /api/newsletter/bridge/disconnect { id }
 *   GET    /api/newsletter/bridge/list       → list bridges
 *   POST   /api/newsletter/bridge/poll       { id } — poll a single bridge
 *   POST   /api/newsletter/bridge/auto-poll  — poll all (cron)
 *   GET    /api/newsletter/bridge/stats      → bridge stats
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

function safeKey(s: string): string {
