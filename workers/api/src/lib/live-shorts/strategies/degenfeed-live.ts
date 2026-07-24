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

import type { Env } from '../../../index';
import { broadcastToAll } from '../../../ws-broadcast';
import { CHANNELS } from '../../../ws-channels';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.degenfeed;

/**
 * DegenFeed native live short strategy.
 */
export const degenfeedLiveStrategy: ProtocolStrategy = {
  config: STRATEGY,

  async announceLive(
    _env: Env,
    sessionId: string,
    creator: string,
    creatorHandle: string,
    title: string,
    playbackUrl: string,
    duration: number,
  ): Promise<LiveSessionInfo> {
    // Announce to DegenFeed users via WebSocket
    // The live short is already registered in KV by the route handler
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'live_short_started',
      sessionId,
      creator,
      creatorHandle,
      title,
      playbackUrl,
      duration,
      startedAt: Date.now(),
      platform: 'degenfeed',
    });

    return {
      protocolId: sessionId,
      protocolUrl: `https://app.degenfeed.xyz/live/${sessionId}`,
      announced: true,
    };
  },

  async updateEnded(
    _env: Env,
    sessionId: string,
    _protocolId: string,
    title: string,
    recordingUrl: string,
  ): Promise<void> {
    broadcastToAll(CHANNELS.FEED_NEW, {
      type: 'live_short_ended',
      sessionId,
      title,
      recordingUrl,
      endedAt: Date.now(),
      platform: 'degenfeed',
    });
  },

  async getViewerCount(env: Env, protocolId: string): Promise<ViewerCountResult> {
    // DegenFeed: count active WebSocket connections viewing this live short
    // In production, this would read from a real-time viewer counter in KV
    // or a Durable Object tracking active connections.
    try {
      const viewerKey = `live-short:viewers:${protocolId}`;
      const raw = await env.CONTENT_STORE?.get(viewerKey);
      if (raw) {
        const data = JSON.parse(raw) as { degenfeed?: number; total?: number };
        const count = data.degenfeed ?? data.total ?? 0;
        return { count, rawSignal: count };
      }
    } catch {
      // Fall through
    }

    return { count: 0, rawSignal: 0 };
  },

  async postTipNotification(
    _env: Env,
    protocolId: string,
    tipper: string,
    amount: string,
    chain: string,
    message?: string,
  ): Promise<void> {
    // Broadcast tip to all viewers of this live short
    const fromShort = tipper.length > 10 ? `${tipper.slice(0, 6)}...${tipper.slice(-4)}` : tipper;

    broadcastToAll(CHANNELS.TIP_RECEIVED, {
      type: 'live_short_tip',
      sessionId: protocolId,
      amount,
      chain,
      from: fromShort,
      message: message || `Live short tip! 🎁`,
      platform: 'degenfeed',
    });
  },
};
