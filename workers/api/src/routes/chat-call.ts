/**
 * /api/chat/call — Live Audio/Video Calling Routes
 *
 * Routes:
 *   POST /api/chat/call/start     — Initiate a call
 *   POST /api/chat/call/accept    — Accept a call
 *   POST /api/chat/call/end       — End a call
 *   POST /api/chat/call/mute      — Toggle mute
 *   POST /api/chat/call/camera    — Toggle camera
 *   POST /api/chat/call/share     — Start/stop screen share
 *   GET  /api/chat/call/active    — Get active calls for user
 *   GET  /api/chat/call/history   — Get call history
 *   POST /api/chat/call/voicemail — Leave a voicemail
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const _callManager: typeof import('@degenfeed/chat-super-app').CallManager | null = null;
async function getCallManager() {
