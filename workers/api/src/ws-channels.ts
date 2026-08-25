export const CHANNELS = {
  // Existing channels
  FEED_NEW: 'feed:new',
  FEED_UPDATE: 'feed:update',
  FEED_FRESHNESS: 'feed:freshness',
  NOTIFICATIONS_NEW: 'notifications:new',
  NOTIFICATIONS_MARK_ALL_READ: 'notifications:markAllRead',
  NOTIFICATIONS_READ: 'notifications:read',
  DM_NEW: 'dm:new',
  DM_TYPING: 'dm:typing',
  SPACE_UPDATE: 'space:update',
  TIP_RECEIVED: 'tip:received',
  /** Global tip feed (for live overlays, leaderboards) */
  TIP_GLOBAL: 'tip:global',
  /** User-specific notification channel: user:{address} */
  USER_PREFIX: 'user:',
  /** Real-time cross-platform bridged chat for streams */
  STREAM_CHAT: 'stream:chat',
  /** Creator video published (upload/short live) */
  VIDEO_PUBLISH: 'video:publish',

  // ── Feed real-time events (DegenFeed timeline) ──
  /** Emitted when a new post is available from any protocol */
  FEED_NEW_POST: 'feed:new-post',
  /** Emitted when trending topics change */
  FEED_TRENDING_UPDATE: 'feed:trending-update',
  /** Emitted when a post's engagement metrics change */
  FEED_ENGAGEMENT_UPDATE: 'feed:engagement-update',
  /** Emitted when a protocol's health status changes */
  FEED_PROTOCOL_STATUS: 'feed:protocol-status',

  // ── Video Call events ──
  /** Emitted when a user receives an incoming call */
  CALL_INCOMING: 'call:incoming',
  /** Emitted when call state changes (join, leave, mute, end) */
  CALL_STATE: 'call:state',
} as const;

export const SYNC_TOPICS = Object.values(CHANNELS);

export type SyncTopic = (typeof SYNC_TOPICS)[number];

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

// ─── Feed subscription topic patterns ─────────────────────────────

export type FeedScope = 'for-you' | 'home' | 'trending';

/** Topic strings clients can subscribe to via subscribe:feed:* messages */
export const FEED_SUBSCRIBE_TOPICS = {
  FOR_YOU: 'subscribe:feed:for-you',
  HOME: 'subscribe:feed:home',
  TRENDING: 'subscribe:feed:trending',
  /** Per-protocol: subscribe:protocol:{name} */
  PROTOCOL_PREFIX: 'subscribe:protocol:',
} as const;
