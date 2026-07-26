/**
 * @degenfeed/api-worker — DegenFeed Native Live Short Strategy
 *
 * Our own native experience — the BEST possible live short viewing experience.
 * Vertical swipe UI, HLS player with low latency, real-time chat + reactions,
 * tips overlay, countdown timer, and "Swipe up for next live short".
 *
 * Strategy: Build the most immersive live short experience on DegenFeed:
 *   1. Vertical swipe UI (already built in ShortsFeed)
 *   2. HLS player with low-latency chunked transfer
 *   3. Real-time chat via WebSocket (DegenFeed channels)
 *   4. Reaction overlays (🔥, 💎, 🚀, etc.)
 *   5. Tips overlay with real-time notifications
 *   6. Countdown timer showing remaining seconds
 *   7. "Swipe up for next live short" at end
 *   8. Auto-save recording and publish as regular short
 *
 * Native live support: FULL — this is our own platform.
 */

import type { Env } from '../../../types';
import { broadcastToAll } from '../../../ws-broadcast';
import { CHANNELS } from '../../../ws-channels';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.degenfeed;

/**
 * DegenFeed native live short strategy.
 */
export const degenfeedLiveStrategy: ProtocolStrategy = {

