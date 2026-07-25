/**
 * @degenfeed/api-worker — Live Route Handlers
 *
 * Live/streaming route handlers. All endpoints are wired to the live
 * aggregator which fetches from Owncast, PeerTube, YouTube, Twitch, Kick,
 * Spaces, Farcaster, and Nostr in parallel.
 *
 * Rules:
 *   - Every provider integration has: error handling, rate limit tracking,
 *     response validation, fallback
 *   - No silent failures. No unhandled API changes.
 *   - All provider responses validated before passing to scanners
 */

import {
  aggregateAllStreams,
  aggregateUpcomingStreams,
  createSchedule,
  generateLiveId,
  getSourceHealth,
  getStreamViewerCount,
  startLiveStream,
  stopLiveStream,
  type UnifiedLiveStream,
} from '../../feed/live-aggregator';
import { isKickChannelLive } from '../../feed/live-sources/kick';
import {
  detectLiveWatchedCreators,
  getPendingNotifications,
  getWatchedCreators,
  unwatchCreator,
  upsertWatcherProfile,
  watchCreator,
} from '../../feed/live-sources/notifications';
import { fetchCuratedTwitchStreams } from '../../feed/live-sources/twitch';
import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { broadcastToAll } from '../../ws-broadcast';
import { CHANNELS } from '../../ws-channels';

// ─── Re-exports — split into domain files ──────────────────────────────

export * from './chat-handlers';
export * from './external-handlers';
export * from './handlers-core';
export * from './interaction-handlers';
export * from './webrtc-handlers';
