export const CHANNELS = {
  FEED_NEW: 'feed:new',
  FEED_UPDATE: 'feed:update',
  NOTIFICATIONS_NEW: 'notifications:new',
  DM_NEW: 'dm:new',
  DM_TYPING: 'dm:typing',
  SPACE_UPDATE: 'space:update',
  TIP_RECEIVED: 'tip:received',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
