/**
 * /api/chat/timer — Self-Destruct Timer Routes
 *
 * Routes:
 *   PUT  /api/chat/:id/timer           — Set self-destruct timer
 *   GET  /api/chat/:id/timer           — Get current timer setting
 *   DELETE /api/chat/:id/timer         — Disable timer
 *   POST /api/chat/:id/view-once       — Mark media as view-once
 *   POST /api/chat/media/viewed        — Mark view-once media as viewed
 *   GET  /api/chat/:id/timer-display   — Get timer display string for header
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const _selfDestruct: typeof import('@degenfeed/chat-super-app').SelfDestructManager | null = null;
async function getSelfDestruct() {
