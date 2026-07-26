/**
 * @degenfeed/api-worker — Cross-Platform Unified Room API Routes
 *
 * POST   /api/rooms/unified/create           — Create cross-platform room
 * POST   /api/rooms/unified/:id/join         — Join with protocol preference
 * POST   /api/rooms/unified/:id/leave        — Leave room
 * POST   /api/rooms/unified/:id/message      — Send message (routes to all members)
 * GET    /api/rooms/unified/:id/messages     — Get room messages
 * POST   /api/rooms/unified/:id/invite       — Invite someone
 * GET    /api/rooms/unified/mine             — My rooms
 * PUT    /api/rooms/unified/:id/transport    — Update transport preference
 * GET    /api/rooms/unified/:id              — Get room info
 * GET    /api/rooms/unified/:id/unread       — Get unread counts
 */

import type { RoomTransport } from '../lib/unified-room';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── POST /api/rooms/unified/create — Create Room ─────────────────────────

export async function handleUnifiedRoomCreate(request: Request, env: Env): Promise<Response> {
