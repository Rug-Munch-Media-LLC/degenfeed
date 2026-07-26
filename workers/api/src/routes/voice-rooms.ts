/**
 * /api/voice — Voice & Video Room Management
 *
 * POST   /api/voice/create            — Create voice/video room
 * POST   /api/voice/:id/join          — Join a room
 * POST   /api/voice/:id/leave         — Leave a room
 * POST   /api/voice/:id/update        — Update participant state
 * GET    /api/voice/:id/participants  — Who's in the room
 * GET    /api/voice/:id/invite        — Generate invite link
 * GET    /api/voice/active            — Active voice rooms
 * GET    /api/voice/invite/:code      — Resolve invite code
 * POST   /api/voice/:id/signal        — Send WebRTC signal
 * GET    /api/voice/:id/signals       — Get pending signals
 */

import type { RoomType, VoiceRoomParticipant } from '../lib/voice-rooms';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

import {
