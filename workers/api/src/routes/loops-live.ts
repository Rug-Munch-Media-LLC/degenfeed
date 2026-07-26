/**
 * @degenfeed/api-worker — Loops Live Bridge Handlers
 *
 * Bridge routes between DegenFeed and the Loops live streaming system.
 * Handles cross-platform broadcasting, stream lifecycle, and feed integration.
 *
 * Key endpoints:
 *   POST /api/loops/live/start      — Creator goes live on Loops
 *   POST /api/loops/live/stop       — Creator stops their Loops stream
 *   GET  /api/loops/live/active     — All active Loops streams
 *   POST /api/loops/live/broadcast  — Broadcast to 7+ platforms
 *   GET  /api/loops/live/broadcast/:id — Broadcast status
 *   GET  /api/loops/live/platforms  — Available broadcast platforms
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
