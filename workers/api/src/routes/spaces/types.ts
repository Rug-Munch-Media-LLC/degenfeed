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
  summary?: string;
  transcript?: string;
}
