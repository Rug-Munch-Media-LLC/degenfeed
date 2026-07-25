export interface VideoRoom {
  id: string;
  name: string;
  participants: VideoParticipant[];
  createdBy: string;
}

export interface VideoParticipant {
  walletAddress: string;
  displayName: string;
  muted: boolean;
  videoMuted: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  connected: boolean;
}

export interface VideoRoomSummary {
  id: string;
  name: string;
  participantCount: number;
  hasPassword: boolean;
  createdBy: string;
  lastActivity: number;
}

export interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
}
