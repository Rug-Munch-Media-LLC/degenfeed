/**
 * /api/call — WebRTC Group Video/Voice Call Routes
 *
 * Routes:
 *   POST   /api/call/create        — Create a group call (mesh/SFU)
 *   POST   /api/call/:callId/join  — Join a group call
 *   POST   /api/call/:callId/leave — Leave a group call
 *   POST   /api/call/:callId/end   — End a group call (organizer)
 *   GET    /api/call/:callId       — Get call state
 *   GET    /api/call/conversation/:conversationId — Get active call for conversation
 *
 *   POST   /api/call/:callId/screen/start    — Start screen share
 *   POST   /api/call/:callId/screen/stop     — Stop screen share
 *   POST   /api/call/:callId/speaking        — Update speaking status
 *   POST   /api/call/:callId/hand/raise      — Raise hand
 *   POST   /api/call/:callId/hand/lower      — Lower hand (organizer)
 *   GET    /api/call/:callId/hands           — Get raised hands
 *
 *   POST   /api/call/:callId/breakout/create — Create breakout room
 *   POST   /api/call/:callId/breakout/join   — Join breakout room
 *   POST   /api/call/:callId/breakout/return  — Return to main room
 *
 *   POST   /api/call/:callId/signal          — WebRTC signalling (mesh)
 *   GET    /api/call/:callId/signals/:userId  — Consume pending signals
 *
 *   POST   /api/call/:callId/mute            — Mute participant (organizer)
 *   POST   /api/call/:callId/remove          — Remove participant (organizer)
 *   POST   /api/call/:callId/quality         — Update connection quality
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Lazy imports ───────────────────────────────────────────────────────

const _webrtc: typeof import('../lib/webrtc-group-call') | null = null;

async function getWebrtc() {
