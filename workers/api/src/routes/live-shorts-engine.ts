/**
 * @degenfeed/api-worker — Live Shorts: Core Engine
 *
 * KV helpers and core engine functions for live short management.
 * Internal functions are exported for use by the router modules.
 */

import type { ProtocolId } from '../lib/live-shorts/live-strategy';
import { selectBackend } from '../lib/live-shorts/protocol-strategies';
import { getStrategy } from '../lib/live-shorts/strategies';
import { announceStreamToAllProtocols } from '../lib/stream-announcer';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { LiveShortRecord, Protocol, ViewerCounts } from './live-shorts-types';
import { MAX_LIVE_SHORT_DURATION_SECONDS } from './live-shorts-types';

// ─── KV Key Helpers ──────────────────────────────────────────────────────
export function liveShortKey(id: string): string {
