/**
 * @degenfeed/realtime — Channel definitions (shared client/server constants)
 */

export const CHANNELS = {
  // Existing channels
  FEED_NEW: 'feed:new',
  FEED_UPDATE: 'feed:update',
  NOTIFICATIONS_NEW: 'notifications:new',
  DM_NEW: 'dm:new',
  DM_TYPING: 'dm:typing',
  SPACE_UPDATE: 'space:update',
  TIP_RECEIVED: 'tip:received',

  // ── Feed real-time events (DegenFeed timeline) ──
  /** Emitted when a new post is available from any protocol */
  FEED_NEW_POST: 'feed:new-post',
  /** Emitted when trending topics change */
  FEED_TRENDING_UPDATE: 'feed:trending-update',
  /** Emitted when a post's engagement metrics change */
  FEED_ENGAGEMENT_UPDATE: 'feed:engagement-update',
  /** Emitted when a protocol's health status changes */
  FEED_PROTOCOL_STATUS: 'feed:protocol-status',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export const CHANNEL_LIST = Object.values(CHANNELS) as ChannelName[];

// ─── Client-side subscription topics ─────────────────────────────
// These map to the server's subscribe:feed:* and subscribe:protocol:* patterns

export type FeedScope = 'for-you' | 'home' | 'trending';

export const FEED_SUBSCRIBE_PREFIX = 'subscribe:feed:' as const;
export const PROTOCOL_SUBSCRIBE_PREFIX = 'subscribe:protocol:' as const;
