/**
 * @degenfeed/api-worker — PeerTube Livestream Management for Creator Tokens
 *
 * Full lifecycle: create, monitor, and end PeerTube livestreams
 * from the token community page. Integrates with:
 *   - PeerTube API for stream creation + RTMP keys
 *   - CONTENT_STORE KV for stream metadata + viewer tracking
 *   - Feed broadcast via WebSocket for real-time "creator went live"
 *   - Cross-protocol announcements (ActivityPub, Nostr, AT Protocol, etc.)
 *
 * Routes:
 *   POST   /api/token/:address/peertube/start     — Start a PeerTube stream
 *   GET    /api/token/:address/peertube            — Get active stream info
 *   POST   /api/token/:address/peertube/end       — End the stream
 *   GET    /api/token/:address/peertube/recording  — Get VOD recording
 *   GET    /api/token/:address/peertube/chat       — Get chat messages
 *   POST   /api/token/:address/peertube/chat       — Send chat message
 *   GET    /api/token/:address/peertube/history    — Past streams for this token
 *
 * KV schema (CONTENT_STORE):
 *   peertube:stream:{tokenAddress}:active  → { TokenStream + PeerTubeMetadata }
 *   peertube:stream:{tokenAddress}:{uuid}  → { archived stream recording }
 *   peertube:stream:creator:{creatorAddress} → { creator's streams list }
 *   peertube:chat:{tokenAddress}:{cursor}  → { cached chat messages }
 */

import { Hono } from 'hono';
import { announceStreamToAllProtocols as crossAnnounceStream } from '../lib/stream-announcer';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ───────────────────────────────────────────────────────────────

export type PeerTubeStreamRecord = {};
