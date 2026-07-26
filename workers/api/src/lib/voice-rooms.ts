/**
 * @degenfeed/api-worker — Voice & Video Room Management
 *
 * Server-side state for voice/video rooms using KV.
 * WebRTC signaling is handled client-to-client via the realtime WebSocket.
 * This module manages room lifecycle, participant tracking, and metadata.
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoomType = 'voice' | 'video';

export type VoiceRoom = {}
