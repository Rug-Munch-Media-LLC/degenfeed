/**
 * @degenfeed/api-worker — WebRTC P2P Streaming Service
 *
 * Zero-bandwidth live streaming for audiences <10 viewers.
 * Handles WebRTC signaling (offer/answer/ICE exchange) in a P2P mesh.
 * Falls back to Livepeer transcoding when P2P fails (NAT traversal).
 *
 * Key design:
 *   - Broadcaster sends SDP offer → server stores it
 *   - Viewer polls for offer, creates answer, sends back
 *   - ICE candidates are relayed through server (cheap, text-only)
 *   - Video bytes flow P2P, never through our servers
 *   - Server only exchanges small JSON payloads (KB-scale, not GB-scale)
 *
 * API routes handled here:
 *   POST /api/live/webrtc/offer       — Broadcaster sends offer
 *   POST /api/live/webrtc/answer      — Viewer sends answer
 *   POST /api/live/webrtc/ice         — ICE candidate exchange
 *   GET  /api/live/webrtc/viewers     — Connected viewer count
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type WebRTCSession = {};
