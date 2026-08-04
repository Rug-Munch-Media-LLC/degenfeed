'use client';

export interface CallInfo {
  callId: string;
  host: string;
  participants: string[];
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  startedAt: number;
  recording: boolean;
  groupMode?: 'mesh' | 'sfu' | 'p2p';
}

export interface CallHistoryEntry {
  callId: string;
  peer: string;
  type: 'audio' | 'video';
  status: 'missed' | 'completed';
  duration: number;
  timestamp: number;
}

export interface IncomingCall {
  callId: string;
  from: string;
  displayName: string;
  avatarUrl?: string;
  type: 'audio' | 'video';
  participants: number;
}

export type CallViewState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'active'
  | 'ended';

export interface PeerConnection {
  peerId: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
}

export const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
];
