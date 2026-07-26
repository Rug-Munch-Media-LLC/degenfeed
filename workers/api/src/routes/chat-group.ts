/**
 * /api/chat/group — Standardized Group Chat (Matrix-Backed)
 *
 * Every group chat is a Matrix E2E room (Olm/Megolm).
 * Each member receives messages via their preferred protocol.
 * Moderation: kick, ban, promote to admin.
 *
 * POST   /api/chat/group/create      — Create E2E group room
 * POST   /api/chat/group/send        — Send message to group
 * POST   /api/chat/group/invite      — Invite new member
 * POST   /api/chat/group/kick        — Remove member
 * POST   /api/chat/group/promote     — Promote to admin
 * GET    /api/chat/group/messages    — Get group messages
 * GET    /api/chat/group/list        — List user's groups
 * GET    /api/chat/group/info        — Get group metadata
 * PUT    /api/chat/group/settings    — Update group settings
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
