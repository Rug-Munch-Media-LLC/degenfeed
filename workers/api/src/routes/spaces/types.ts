/**
 * @degenfeed/api-worker — Spaces Types
 */

export interface SpaceSpeaker {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  isHost: boolean;
  isCoHost: boolean;
  speaking: boolean;
  muted: boolean;
  joinedAt: number;
}

export interface SpaceReaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

export interface HandRaise {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  raisedAt: number;
}

export interface SpaceInvite {
  userId: string;
  invitedBy: string;
  invitedAt: number;
  status: 'pending' | 'accepted' | 'declined';
}

export interface SpaceRecording {
  url?: string;
  startedAt?: number;
  endedAt?: number;
  duration?: number;
  transcriptUrl?: string;
  publishedToPeertube?: boolean;
  peertubeVideoId?: string;
}

export interface SpaceChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  text: string;
  timestamp: number;
  isTip: boolean;
  tipAmount?: number;
  tipCurrency?: string;
  isPinned: boolean;
  replyTo: string | null;         // ID of parent message
  mediaUrl?: string;
  mediaType?: 'image' | 'link' | 'audio';
  editedAt?: number;
  deleted: boolean;
  reactions: ChatReaction[];
}

export interface ChatReaction {
  userId: string;
  emoji: string;
  timestamp: number;
}

export interface SpaceClip {
  id: string;
  spaceId: string;
  title: string;
  startTime: number;
  endTime: number;
  createdBy: string;
  createdAt: number;
  url?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  viewCount: number;
}

export interface SpaceAnalytics {
  peakListeners: number;
  totalUniqueListeners: number;
  totalChatMessages: number;
  totalTips: number;
  tipAmountTotal: number;
  tipCurrency: string;
  averageListenDuration: number;
  engagementScore: number;
  reactionCount: number;
  handRaiseCount: number;
  clipCount: number;
}

export interface ScheduledSpaceNotification {
  userId: string;
  spaceId: string;
  reminded: boolean;
}

export type SpaceVisibility = 'public' | 'followers' | 'invite';
export type SpaceCategory = 'talk' | 'defi' | 'nft' | 'trading' | 'gaming' | 'music' | 'ama' | 'podcast' | 'other';

export interface SpaceRecord {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  hostAvatarUrl?: string;
  coHosts: string[];
  protocols: string[];
  status: 'scheduled' | 'live' | 'ended';
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  scheduledAt?: string;
  listeners: number;
  maxSpeakers: number;
  speakers: SpaceSpeaker[];
  reactions: SpaceReaction[];
  handRaised: HandRaise[];
  invites: SpaceInvite[];
  tipTokenAddress?: string;
  tippingEnabled: boolean;
  isRecorded: boolean;
  recording?: SpaceRecording;
  livekitRoom?: string;
  tags: string[];
  category: SpaceCategory;
  visibility: SpaceVisibility;
  coverColor?: string;
  coverUrl?: string;
  /** Chat messages for this space */
  chatMessages: SpaceChatMessage[];
  /** Pinned message IDs (ordered) */
  pinnedMessages: string[];
  /** Users muted in chat */
  chatMutedUsers: string[];
  /** Recording clips created from this space */
  clips: SpaceClip[];
  /** Analytics snapshot */
  analytics?: SpaceAnalytics;
  /** Nostr NIP-53 event ID */
  nostrEventId?: string;
  /** Farcaster Frame URL / cast hash */
  farcasterCastHash?: string;
  /** Users who set reminders */
  reminders: ScheduledSpaceNotification[];
  summary?: string;
  transcript?: string;
}
