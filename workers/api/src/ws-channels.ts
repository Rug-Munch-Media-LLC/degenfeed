export const CHANNELS = {
	FEED_NEW: "feed:new",
	FEED_UPDATE: "feed:update",
	FEED_FRESHNESS: "feed:freshness",
	NOTIFICATIONS_NEW: "notifications:new",
	NOTIFICATIONS_MARK_ALL_READ: "notifications:markAllRead",
	NOTIFICATIONS_READ: "notifications:read",
	DM_NEW: "dm:new",
	DM_TYPING: "dm:typing",
	SPACE_UPDATE: "space:update",
	TIP_RECEIVED: "tip:received",
	/** Real-time cross-platform bridged chat for streams */
	STREAM_CHAT: "stream:chat",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];
