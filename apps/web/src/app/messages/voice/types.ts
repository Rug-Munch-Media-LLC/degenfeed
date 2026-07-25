'use client';

export interface VoiceRoom {
  id: string;
  name: string;
  type: 'voice' | 'video';
  createdBy: string;
  createdAt: number;
  lastActivity: number;
  active: boolean;
  maxParticipants: number;
  passwordHash: string;
  inviteOnly: boolean;
  participants: VoiceParticipant[];
}

export interface VoiceRoomSummary {
  id: string;
  name: string;
  type: 'voice' | 'video';
  participantCount: number;
  maxParticipants: number;
  hasPassword: boolean;
  inviteOnly: boolean;
  createdBy: string;
  lastActivity: number;
}

export interface VoiceParticipant {
  walletAddress: string;
  displayName: string;
  joinedAt: number;
  muted: boolean;
  videoMuted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  handRaised: boolean;
  connected: boolean;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function _shortAddr(addr: string): string {
  if (!addr) return 'Unknown';
  return addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;
}

export function getInitials(name: string): string {
  return (
    name
      .split(/[\s:@]+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}
