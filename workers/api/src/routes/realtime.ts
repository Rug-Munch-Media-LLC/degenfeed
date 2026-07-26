/**
 * @degenfeed/api-worker — WebSocket + Webhook Route for RealTime Sync
 *
 * Two entry points:
 *   1. GET /ws/realtime — WebSocket upgrade for client connections
 *      wss://api.degenfeed.xyz/ws/realtime?topics=posts,likes,tips
 *      Keeps browsers, mobile apps, and servers in sync with all protocol
 *      activity in real-time.
 *
 *   2. POST /api/webhook/realtime/:protocol — Webhook receivers for
 *      protocol event callbacks (Nostr, Bluesky JetStream, Farcaster, etc.)
 *
 * WebSocket Protocol:
 *   Client sends:  { type: "ping" }  (every 30s to keep alive)
 *   Server sends:  { type: "pong" }
 *   Server sends:  { type: "sync_event", eventType, sourceProtocol, dfUri, ... }
 *
 * Security:
 *   - Origin validation against allowed domains
 *   - Per-IP connection rate limiting (20/min)
 *   - 5-minute idle timeout
 *   - Max 100 concurrent connections total
 */

import type { Protocol } from '@degenfeed/types';
import { processSyncAction } from '../lib/realtime-sync';
import { processQueue } from '../lib/sync-queue';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';
import type { SyncTopic } from '../ws-channels';
import { CHANNELS, FEED_SUBSCRIBE_TOPICS, SYNC_TOPICS } from '../ws-channels';

// ─── Constants ────────────────────────────────────────────────────────────

const ALLOWED_WS_ORIGINS = new Set([
  'https://degenfeed.xyz',
  'https://app.degenfeed.xyz',
  'https://www.degenfeed.xyz',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://api.degenfeed.xyz',
]);

const _WS_IDLE_TIMEOUT_MS = 300_000; // 5 min
const PING_INTERVAL_MS = 30_000; // 30s
const MAX_CONCURRENT_CONNS = 100;
const IP_RATE_LIMIT = 20; // connections per minute per IP
const IP_RATE_WINDOW_MS = 60_000;

// ─── In-memory State ─────────────────────────────────────────────────────

type ClientConnection = {}
