/**
 * @degenfeed/chat-super-app — Live Audio/Video Calling
 *
 * WebRTC P2P for 1-on-1 calls, LiveKit SFU for group calls (up to 50 participants).
 * Features: call ringing, mute, camera off, screen share, add participant,
 * call recording (with consent), voicemail, call history.
 *
 * Architecture:
 *   - 1-on-1: Browser WebRTC (P2P via Matrix signalling)
 *   - Group: LiveKit Selective Forwarding Unit (SFU)
 *   - Signalling: Matrix to-device messages or WebSocket
 */

import type { Env } from '@degenfeed/types';

// ─── Local WebSocket Broadcast Types (replaces fragile relative import) ──────
// [REVIEW] These interfaces mirror workers/api/src/ws-broadcast.ts and ws-channels.ts
// Keep in sync if those change. A proper package export would be better.

export type ChannelName =
  | 'feed:new'
  | 'feed:update'
  | 'feed:freshness'
  | 'notifications:new'
  | 'notifications:markAllRead'
  | 'notifications:read'
  | 'dm:new'
  | 'dm:typing'
  | 'space:update'
  | 'tip:received'
  | 'tip:global'
  | 'stream:chat'
  | 'feed:new-post'
  | 'feed:trending-update'
  | 'feed:engagement-update'
  | 'feed:protocol-status'
  | 'call:incoming'
  | 'call:state'
  | `user:${string}`
  | `subscribe:feed:${'for-you' | 'home' | 'trending'}`
  | `subscribe:protocol:${string}`;

interface WSBroadcastInterface {
  broadcastToAll: (channel: string, data: unknown) => void;
  broadcastToUser: (userId: string, channel: string, data: unknown) => void;
}

// ─── WS broadcast (local fire-and-forget; mirrors workers/api ws-broadcast) ──
const WS_BROADCAST_URL = 'https://realtime.degenfeed.xyz/broadcast';

function wsSend(payload: { channel: string; data: unknown; userId?: string }): void {
  void fetch(WS_BROADCAST_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // realtime worker may not be reachable — silently ignore
  });
}

const broadcastToUser: WSBroadcastInterface['broadcastToUser'] = (userId, channel, data) =>
  wsSend({ channel, data, userId });

// ─── Types ─────────────────────────────────────────────────────────────────

export type CallType = 'audio' | 'video' | 'screen';
export type CallState =
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'missed'
  | 'rejected'
  | 'voicemail';
export type CallEndReason =
  | 'user-ended'
  | 'timeout'
  | 'rejected'
  | 'network-error'
  | 'busy'
  | 'voicemail';

export interface CallParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
  muted: boolean;
  videoEnabled: boolean;
  isHost: boolean;
  audioLevel: number; // 0.0 - 1.0
}

export interface CallSession {
  callId: string;
  conversationId: string;
  type: CallType;
  state: CallState;
  initiator: string;
  participants: CallParticipant[];
  startedAt: number;
  endedAt?: number;
  duration?: number;
  endReason?: CallEndReason;
  roomName?: string; // LiveKit room name for group calls
  livekitToken?: string;
  isRecording: boolean;
  recordingConsent: Record<string, boolean>; // userId -> consented
}

export interface CallHistoryEntry {
  callId: string;
  conversationId: string;
  withUserId: string;
  withDisplayName: string;
  type: CallType;
  state: CallState;
  duration: number;
  startedAt: number;
  endedAt: number;
  initiator: string;
  isIncoming: boolean;
}

export interface Voicemail {
  callId: string;
  fromUserId: string;
  toUserId: string;
  conversationId: string;
  audioUrl: string;
  duration: number;
  createdAt: number;
  listened: boolean;
}

export interface CallSignallingMessage {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'hangup'
    | 'mute'
    | 'unmute'
    | 'camera-off'
    | 'camera-on'
    | 'screen-share-start'
    | 'screen-share-stop';
  callId: string;
  senderId: string;
  sdp?: string;
  candidate?: string;
  mediaType?: CallType;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CALL_PREFIX = 'chat:call:';
const CALL_HISTORY_PREFIX = 'chat:call:history:';
const VOICEMAIL_PREFIX = 'chat:voicemail:';
const LIVEKIT_API_URL = 'https://api.livekit.io';
const LIVEKIT_ROOM_PREFIX = 'degenfeed-call-';
const CALL_RING_TIMEOUT_MS = 30_000; // 30 seconds ringing before timeout
const MAX_GROUP_CALL_SIZE = 50;

// ─── Call Manager ─────────────────────────────────────────────────────────

export class CallManager {
  private activeCalls: Map<string, CallSession> = new Map();

  /**
   * Initiate a new call.
   */
  async initiateCall(
    env: Env,
    conversationId: string,
    type: CallType,
    initiator: string,
    participants: string[],
    displayNames: Record<string, string>,
  ): Promise<CallSession> {
    const callId = crypto.randomUUID();
    const isGroupCall = participants.length > 2;
    const now = Date.now();

    let roomName: string | undefined;
    let livekitToken: string | undefined;

    // For group calls, provision a LiveKit room
    if (isGroupCall) {
      roomName = `${LIVEKIT_ROOM_PREFIX}${callId}`;
      livekitToken = await this.provisionLiveKitRoom(env, roomName, initiator);
    }

    const callSession: CallSession = {
      callId,
      conversationId,
      type,
      state: 'ringing',
      initiator,
      participants: [
        {
          userId: initiator,
          displayName: displayNames[initiator] || initiator,
          joinedAt: now,
          muted: false,
          videoEnabled: type === 'video',
          isHost: true,
          audioLevel: 0,
        },
        ...participants
          .filter((p) => p !== initiator)
          .map((p) => ({
            userId: p,
            displayName: displayNames[p] || p,
            joinedAt: 0,
            muted: true,
            videoEnabled: false,
            isHost: false,
            audioLevel: 0,
          })),
      ],
      startedAt: now,
      roomName,
      livekitToken,
      isRecording: false,
      recordingConsent: {},
    };

    this.activeCalls.set(callId, callSession);
    await this.saveCallSession(env, callSession);

    // Send call ringing notifications to all participants
    await this.sendCallRinging(env, callSession, participants, initiator);

    // Set ringing timeout
    this.scheduleTimeout(callId, callSession, env);

    console.log(
      `[calling] Call ${callId} initiated: ${type} with ${participants.length} participants`,
    );
    return callSession;
  }

  /**
   * Accept an incoming call.
   */
  async acceptCall(env: Env, callId: string, userId: string): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    // If this is a group call, get LiveKit token for the participant
    if (call.roomName && call.participants.length > 2) {
      call.livekitToken = await this.provisionLiveKitRoom(env, call.roomName, userId);
    }

    // Update participant state
    const participant = call.participants.find((p) => p.userId === userId);
    if (participant) {
      participant.joinedAt = Date.now();
      participant.muted = false;
      participant.videoEnabled = call.type === 'video';
    }

    call.state = 'connecting';
    await this.saveCallSession(env, call);

    return call;
  }

  /**
   * End a call.
   */
  async endCall(
    env: Env,
    callId: string,
    _endedBy: string,
    reason: CallEndReason = 'user-ended',
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    const now = Date.now();
    call.state = 'ended';
    call.endedAt = now;
    call.duration = now - call.startedAt;
    call.endReason = reason;

    // Save to history
    await this.saveCallHistory(env, call);

    // Delete active call
    this.activeCalls.delete(callId);
    await this.deleteCallSession(env, callId);

    // If was ringing and not answered, send voicemail option
    if (reason === 'timeout' || reason === 'rejected') {
      // In production, prompt caller to leave a voicemail
    }

    return call;
  }

  /**
   * Get an active call session.
   */
  getCall(callId: string): CallSession | null {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Get all active calls for a user.
   */
  getActiveCallsForUser(userId: string): CallSession[] {
    return Array.from(this.activeCalls.values())
      .filter(
        (call) =>
          call.state === 'ringing' || call.state === 'connecting' || call.state === 'connected',
      )
      .filter((call) => call.participants.some((p) => p.userId === userId));
  }

  /**
   * Toggle mute for a participant.
   */
  async toggleMute(
    env: Env,
    callId: string,
    userId: string,
    muted: boolean,
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    const participant = call.participants.find((p) => p.userId === userId);
    if (participant) participant.muted = muted;

    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Toggle camera for a participant.
   */
  async toggleCamera(
    env: Env,
    callId: string,
    userId: string,
    enabled: boolean,
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    const participant = call.participants.find((p) => p.userId === userId);
    if (participant) participant.videoEnabled = enabled;

    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Start screen sharing.
   */
  async startScreenShare(env: Env, callId: string, _userId: string): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    call.type = 'screen';
    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Stop screen sharing.
   */
  async stopScreenShare(env: Env, callId: string, _userId: string): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    call.type = 'video';
    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Add a participant to an active call.
   */
  async addParticipant(
    env: Env,
    callId: string,
    newUserId: string,
    displayName: string,
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    if (call.participants.length >= MAX_GROUP_CALL_SIZE) {
      throw new Error(`[calling] Max participants (${MAX_GROUP_CALL_SIZE}) reached`);
    }

    call.participants.push({
      userId: newUserId,
      displayName,
      joinedAt: Date.now(),
      muted: true,
      videoEnabled: false,
      isHost: false,
      audioLevel: 0,
    });

    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Start recording the call (with consent).
   */
  async startRecording(
    env: Env,
    callId: string,
    _requestedBy: string,
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    // Check consent from all participants
    const allConsented = call.participants.every((p) => call.recordingConsent[p.userId]);

    if (!allConsented) {
      // Request consent — don't start yet
      return call;
    }

    call.isRecording = true;
    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Give/revoke consent for recording.
   */
  async setRecordingConsent(
    env: Env,
    callId: string,
    userId: string,
    consented: boolean,
  ): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    call.recordingConsent[userId] = consented;
    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Stop recording.
   */
  async stopRecording(env: Env, callId: string): Promise<CallSession | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    call.isRecording = false;
    await this.saveCallSession(env, call);
    return call;
  }

  /**
   * Leave a voicemail.
   */
  async leaveVoicemail(
    env: Env,
    callId: string,
    fromUserId: string,
    toUserId: string,
    conversationId: string,
    audioUrl: string,
    duration: number,
  ): Promise<Voicemail> {
    const voicemail: Voicemail = {
      callId,
      fromUserId,
      toUserId,
      conversationId,
      audioUrl,
      duration,
      createdAt: Date.now(),
      listened: false,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(`${VOICEMAIL_PREFIX}${callId}`, JSON.stringify(voicemail), {
        expirationTtl: 86400 * 30, // Keep for 30 days
      });
    }

    return voicemail;
  }

  /**
   * Get voicemail.
   */
  async getVoicemail(env: Env, callId: string): Promise<Voicemail | null> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return null;

    try {
      const raw = await kv.get(`${VOICEMAIL_PREFIX}${callId}`);
      return raw ? (JSON.parse(raw) as Voicemail) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get call history for a user.
   */
  async getCallHistory(env: Env, userId: string, limit = 50): Promise<CallHistoryEntry[]> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return [];

    try {
      const raw = await kv.get(`${CALL_HISTORY_PREFIX}${userId}`);
      if (!raw) return [];

      const history: CallHistoryEntry[] = JSON.parse(raw);
      return history.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  /**
   * Handle an incoming call signalling message (WebRTC).
   */
  async handleSignalling(env: Env, message: CallSignallingMessage): Promise<CallSession | null> {
    const call = this.activeCalls.get(message.callId);
    if (!call) return null;

    switch (message.type) {
      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // WebRTC signalling passes through — stored for the other peer
        await this.storeSignallingMessage(env, message);
        break;
      case 'hangup':
        return this.endCall(env, message.callId, message.senderId, 'user-ended');
      case 'mute':
        return this.toggleMute(env, message.callId, message.senderId, true);
      case 'unmute':
        return this.toggleMute(env, message.callId, message.senderId, false);
      case 'camera-off':
        return this.toggleCamera(env, message.callId, message.senderId, false);
      case 'camera-on':
        return this.toggleCamera(env, message.callId, message.senderId, true);
      case 'screen-share-start':
        return this.startScreenShare(env, message.callId, message.senderId);
      case 'screen-share-stop':
        return this.stopScreenShare(env, message.callId, message.senderId);
    }

    return call;
  }

  /**
   * Handle WebRTC offer from Matrix to-device messages.
   */
  handleWebRTCOffer(offer: RTCSessionDescriptionInit): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: process.env.TURN_URL || 'turn:turn.degenfeed.xyz:3478',
          username: process.env.TURN_USERNAME || '',
          credential: process.env.TURN_CREDENTIAL || '',
        },
      ],
    });

    pc.setRemoteDescription(new RTCSessionDescription(offer)).catch(console.error);
    return pc;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  /**
   * Provision a LiveKit room for group calls.
   */
  private async provisionLiveKitRoom(
    env: Env,
    roomName: string,
    participant: string,
  ): Promise<string> {
    const livekitKey = env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY;

    // If no LiveKit configured, return a placeholder token
    if (!livekitKey) {
      // Generate a simple token for testing
      return `test-token-${roomName}-${participant}`;
    }

    try {
      // Create room via LiveKit REST API
      const createRes = await fetch(`${LIVEKIT_API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${livekitKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          empty_timeout: 300,
          max_participants: MAX_GROUP_CALL_SIZE,
        }),
      });

      if (!createRes.ok) {
        console.warn('[calling] LiveKit room creation failed, using local');
        return `local-token-${roomName}-${participant}`;
      }

      // Generate access token for participant
      const tokenRes = await fetch(`${LIVEKIT_API_URL}/tokens`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${livekitKey}`,
        },
        body: JSON.stringify({
          room: roomName,
          identity: participant,
          name: participant,
          video: { room: true, publish: true, subscribe: true },
        }),
      });

      if (!tokenRes.ok) {
        return `local-token-${roomName}-${participant}`;
      }

      const tokenData = (await tokenRes.json()) as { token: string };
      return tokenData.token;
    } catch {
      return `local-token-${roomName}-${participant}`;
    }
  }

  /**
   * Send call ringing notifications to participants.
   */
  private async sendCallRinging(
    env: Env,
    call: CallSession,
    participants: string[],
    _initiator: string,
  ): Promise<void> {
    for (const participantId of participants) {
      try {
        // Send via Matrix to-device messages
        const matrixToken = env.MATRIX_ACCESS_TOKEN;
        if (matrixToken) {
          const matrixUrl = env.MATRIX_INSTANCE_URL || 'http://localhost:8448';

          await fetch(
            `${matrixUrl}/_matrix/client/v3/sendToDevice/m.call.invite/${crypto.randomUUID()}`,
            {
              method: 'PUT',
              headers: {
                authorization: `Bearer ${matrixToken}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                messages: {
                  [participantId]: {
                    '*': {
                      call_id: call.callId,
                      party_id: call.initiator,
                      version: '1',
                      lifetime: CALL_RING_TIMEOUT_MS,
                      offer: {
                        type: call.type === 'video' ? 'video' : 'audio',
                        sdp: '',
                      },
                    },
                  },
                },
              }),
            },
          );
        }

        // Broadcast via WebSocket — fire-and-forget to realtime worker
        await broadcastToUser(participantId, 'call:incoming', {
          callId: call.callId,
          conversationId: call.conversationId,
          type: call.type,
          initiator: call.initiator,
          participants: call.participants,
        });
      } catch (err) {
        console.error(`[calling] Failed to notify ${participantId}:`, err);
      }
    }
  }

  /**
   * Schedule a timeout for unanswered calls.
   */
  private scheduleTimeout(callId: string, call: CallSession, env: Env): void {
    setTimeout(async () => {
      const activeCall = this.activeCalls.get(callId);
      if (activeCall && activeCall.state === 'ringing') {
        await this.endCall(env, callId, call.initiator, 'timeout');
      }
    }, CALL_RING_TIMEOUT_MS);
  }

  /**
   * Save call session to KV.
   */
  private async saveCallSession(env: Env, call: CallSession): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return;

    await kv.put(`${CALL_PREFIX}${call.callId}`, JSON.stringify(call), {
      expirationTtl: 86400, // Keep active calls for 1 day
    });
  }

  /**
   * Delete call session from KV.
   */
  private async deleteCallSession(env: Env, callId: string): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.delete(`${CALL_PREFIX}${callId}`).catch(() => {});
    }
  }

  /**
   * Save call to history.
   */
  private async saveCallHistory(env: Env, call: CallSession): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return;

    // Save for each participant
    for (const participant of call.participants) {
      const entry: CallHistoryEntry = {
        callId: call.callId,
        conversationId: call.conversationId,
        withUserId:
          call.initiator === participant.userId
            ? call.participants.find((p) => p.userId !== participant.userId)?.userId || ''
            : call.initiator,
        withDisplayName:
          call.initiator === participant.userId
            ? call.participants.find((p) => p.userId !== participant.userId)?.displayName || ''
            : participant.displayName,
        type: call.type,
        state: call.state,
        duration: call.duration || 0,
        startedAt: call.startedAt,
        endedAt: call.endedAt || Date.now(),
        initiator: call.initiator,
        isIncoming: participant.userId !== call.initiator,
      };

      try {
        const raw = await kv.get(`${CALL_HISTORY_PREFIX}${participant.userId}`);
        const history: CallHistoryEntry[] = raw ? JSON.parse(raw) : [];
        history.push(entry);
        await kv.put(
          `${CALL_HISTORY_PREFIX}${participant.userId}`,
          JSON.stringify(history.slice(-200)),
          { expirationTtl: 86400 * 365 },
        );
      } catch {
        // Best-effort
      }
    }
  }

  /**
   * Store a WebRTC signalling message.
   */
  private async storeSignallingMessage(env: Env, message: CallSignallingMessage): Promise<void> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return;

    const key = `${CALL_PREFIX}${message.callId}:signal:${message.senderId}`;
    await kv.put(key, JSON.stringify(message), { expirationTtl: 300 }); // 5 min TTL
  }
}

// ─── Client-Side WebRTC Helpers ────────────────────────────────────────────

/**
 * Create a WebRTC peer connection with STUN/TURN.
 */
export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onTrack: (stream: MediaStream) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:turn.degenfeed.xyz:3478',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
      },
    ],
    iceCandidatePoolSize: 10,
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0];
    if (stream) onTrack(stream);
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange(pc.connectionState);
  };

  return pc;
}

/**
 * Get user media (microphone/camera).
 */
export async function getUserMedia(video = false, _audio = true): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    throw new Error('Failed to get user media. Check permissions.');
  }
}

/**
 * Get display media for screen sharing.
 */
export async function getDisplayMedia(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch {
    throw new Error('Failed to start screen sharing.');
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _callManagerInstance: CallManager | null = null;

export function getCallManager(): CallManager {
  if (!_callManagerInstance) _callManagerInstance = new CallManager();
  return _callManagerInstance;
}
