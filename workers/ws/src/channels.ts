/**
 * @degenfeed/ws-worker — Real-time event channel definitions
 *
 * Channels represent named streams of real-time events that clients can
 * subscribe to over WebSocket connections. Each channel corresponds to a
 * domain event that was previously handled by polling.
 */

export const CHANNELS = {
  /** New post available in the feed */
  FEED_NEW: 'feed:new',
  /** Post engagement updated (likes, reposts, replies) */
  FEED_UPDATE: 'feed:update',
  /** New notification received */
  NOTIFICATIONS_NEW: 'notifications:new',
  /** New direct message received */
  DM_NEW: 'dm:new',
  /** Typing indicator in DM conversation */
  DM_TYPING: 'dm:typing',
  /** Space state changed (started, ended, speaker change) */
  SPACE_UPDATE: 'space:update',
  /** Tip received notification */
  TIP_RECEIVED: 'tip:received',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export const CHANNEL_LIST = Object.values(CHANNELS) as ChannelName[];
