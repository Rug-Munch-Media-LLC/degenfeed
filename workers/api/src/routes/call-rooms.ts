/**
 * @degenfeed/api-worker — Persistent Group Call Rooms
 *
 * Persistent rooms that anyone can join, like Discord voice channels.
 * Rooms persist until manually deleted or pruned after inactivity.
 *
 * Routes:
 *   POST /api/rooms/create        — Create a persistent room
 *   GET  /api/rooms/:id            — Room info
 *   POST /api/rooms/:id/join       — Join room
 *   GET  /api/rooms/active         — Active rooms
 *   POST /api/rooms/:id/invite     — Invite someone to room
 *   POST /api/rooms/:id/leave      — Leave room
 *   POST /api/rooms/:id/delete     — Delete room (creator only)
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ──────────────────────────────────────────────────────────────

export type CallRoom = {}
