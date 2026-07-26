/**
 * @degenfeed/api-worker — WebRTC Group Call Engine
 *
 * Group video/voice chat engine supporting:
 *   - Mesh mode (P2P, <6 participants, zero cost)
 *   - SFU mode (Selective Forwarding Unit, 6+ participants)
 *   - Screen sharing in group calls
 *   - Active speaker detection
 *   - Hand raise / virtual hand
 *   - Breakout rooms (split group into sub-rooms)
 *
 * Architecture:
 *   Mesh: Participants connect P2P via WebRTC — each sends N-1 streams.
 *         Best for 2-5 participants. No server cost for media relay.
 *
 *   SFU:  Each participant sends 1 stream to the SFU, which forwards
 *         to all others. Participants receive N-1 streams from SFU.
 *         Uses Livepeer or self-hosted mediasoup. Server cost scales
 *         with bandwidth (N streams up, N*(N-1) down).
 *
 * Integration:
 *   - Mesh mode: WebRTC offer/answer via WebSocket signalling (ws-broadcast)
 *   - SFU mode:  Livepeer API for room creation + stream forwarding
 *   - Both:      Room state tracked in KV
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type CallMode = 'mesh' | 'sfu';
export type CallState = 'connecting' | 'ringing' | 'connected' | 'ended';
export type StreamType = 'camera' | 'screen' | 'audio';

export type CallParticipant = {}
