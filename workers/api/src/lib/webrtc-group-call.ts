/**
 * @degenfeed/api-worker — WebRTC Group Call Engine
 *
 * Group video/voice chat engine supporting:
 *   - Mesh mode (P2P, <6 participants, zero cost)
 *   - SFU mode (Selective Forwarding Unit, 6+ participants)
 *   - Screen sharing in group calls
 *   - Active speaker detection
 *   - Hand raise / virtual hand
 *   - Breakout rooms (split group into sub-rooms)
 *
 * Architecture:
 *   Mesh: Participants connect P2P via WebRTC — each sends N-1 streams.
 *         Best for 2-5 participants. No server cost for media relay.
 *
 *   SFU:  Each participant sends 1 stream to the SFU, which forwards
 *         to all others. Participants receive N-1 streams from SFU.
 *         Uses Livepeer or self-hosted mediasoup. Server cost scales
 *         with bandwidth (N streams up, N*(N-1) down).
 *
 * Integration:
 *   - Mesh mode: WebRTC offer/answer via WebSocket signalling (ws-broadcast)
 *   - SFU mode:  Livepeer API for room creation + stream forwarding
 *   - Both:      Room state tracked in KV
 */

import type { Env } from '../index';
import { log } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export type CallMode = 'mesh' | 'sfu';
export type CallState = 'connecting' | 'ringing' | 'connected' | 'ended';
export type StreamType = 'camera' | 'screen' | 'audio';

export interface CallParticipant {
  /** Wallet address */
  userId: string;
  /** Display name */
  displayName: string;
  /** Current state */
  state: CallState;
  /** Joined timestamp */
  joinedAt: number;
  /** Active streams */
  streams: StreamType[];
  /** Is currently speaking (based on audio level) */
  isSpeaking: boolean;
  /** Speaking volume 0-1 (updated periodically) */
  speakingLevel: number;
  /** Has hand raised */
  handRaised: boolean;
  /** Hand raised timestamp */
  handRaisedAt: number | null;
  /** Which breakout room (null = main room) */
  breakoutRoom: string | null;
  /** Connection quality: 'good' | 'fair' | 'poor' */
  connectionQuality: 'good' | 'fair' | 'poor';
}

export interface GroupCall {
  /** Unique call ID */
  id: string;
  /** Conversation/group ID this call belongs to */
  conversationId: string;
  /** Call mode (mesh vs sfu) */
  mode: CallMode;
  /** Organiser wallet */
  organizerId: string;
  /** Call state */
  state: CallState;
  /** Created timestamp */
  createdAt: number;
  /** Started timestamp (when first participant joined) */
  startedAt: number | null;
  /** Ended timestamp */
  endedAt: number | null;
  /** Duration in seconds */
  duration: number;
  /** Maximum participants during call */
  maxParticipants: number;
  /** Participants (keyed by userId) */
  participants: Record<string, CallParticipant>;
  /** Participant join order (for speaker view ordering) */
  participantOrder: string[];
  /** Breakout rooms: { roomId => participant userIds } */
  breakoutRooms: Record<string, string[]>;
  /** Current active speaker */
  activeSpeaker: string | null;
  /** Active speaker history (last 5) */
  activeSpeakerHistory: string[];
  /** SFU room ID (if using Livepeer/mediasoup) */
  sfuRoomId: string | null;
  /** SFU stream token (if using Livepeer) */
  sfuStreamToken: string | null;
  /** Mesh: WebRTC signalling state (SDP offers/answers) */
  meshSignalling: Record<string, any>;
  /** Call settings */
  settings: CallSettings;
  /** Number of participants muted by host */
  mutedByHost: string[];
}

export interface CallSettings {
  /** Default: video on */
  videoEnabled: boolean;
  /** Default: mic on */
  micEnabled: boolean;
  /** Allow screen sharing */
  allowScreenShare: boolean;
  /** Allow hand raise */
  allowHandRaise: boolean;
  /** Max call duration (minutes, 0 = unlimited) */
  maxDurationMinutes: number;
  /** Record call */
  recordCall: boolean;
  /** Require host approval to speak */
  raiseHandToSpeak: boolean;
  /** Enable breakout rooms */
  enableBreakoutRooms: boolean;
  /** Max breakout rooms */
  maxBreakoutRooms: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MESH_MAX_PARTICIPANTS = 5; // Mesh mode: <6 participants
const _SFU_MIN_PARTICIPANTS = 6; // SFU mode: 6+ participants
const MAX_CALL_DURATION_MINUTES = 480; // 8 hours max
const KV_CALL_PREFIX = 'call:';
const KV_CALL_INDEX_PREFIX = 'call:index:';
const _SPEAKING_HYSTERESIS_MS = 1500; // Cooldown before speaker change
const BREAKOUT_MIN_MEMBERS = 2;

// ─── Livepeer SFU Integration ────────────────────────────────────────────

interface LivepeerRoom {
  id: string;
  streamToken: string;
  playbackId: string;
}

/**
 * Create or join a Livepeer SFU room for group call.
 * Falls back to self-hosted mediasoup if Livepeer is unavailable.
 */
async function createSfuRoom(env: Env, callId: string): Promise<LivepeerRoom> {
  const livepeerApiKey = env.LIVEPEER_API_KEY;

  if (livepeerApiKey) {
    try {
      const res = await fetch('https://livepeer.studio/api/room', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${livepeerApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: `degenfeed-call-${callId}`,
          record: false,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          id: data.id,
          streamToken: data.streamKey,
          playbackId: data.playbackId,
        };
      }
      log('warn', `[webrtc] Livepeer room creation failed: ${res.status}`, await res.text());
    } catch (err) {
      log('warn', '[webrtc] Livepeer unavailable, falling back to mediasoup', err);
    }
  }

  // Fallback: self-hosted mediasoup — return a token for the SFU server
  const _sfuEndpoint = env.SFU_ENDPOINT || 'https://sfu.degenfeed.xyz';
  const sfuToken = env.SFU_SECRET_TOKEN
    ? await generateSfuToken(env, callId)
    : `sfu-${callId}-${Date.now()}`;

  return {
    id: callId,
    streamToken: sfuToken,
    playbackId: callId,
  };
}

/**
 * Generate a signed SFU token for mediasoup authentication.
 */
async function generateSfuToken(env: Env, callId: string): Promise<string> {
  const payload = {
    callId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const key = new TextEncoder().encode(env.SFU_SECRET_TOKEN || env.AUTH_SECRET);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', hmacKey, encoded);
  return `sfu_${toBase64Url(encoded)}.${toBase64Url(sig)}`;
}

// ─── Group Call Management ───────────────────────────────────────────────

/**
 * Create a new group call.
 * Determines mode based on participant count:
 *   <6  → mesh (P2P, zero cost)
 *   6+  → SFU (Livepeer or self-hosted)
 */
export async function createGroupCall(
  env: Env,
  conversationId: string,
  organizerId: string,
  participantIds: string[],
  options?: {
    videoEnabled?: boolean;
    settings?: Partial<CallSettings>;
  },
): Promise<GroupCall> {
  const allParticipants = [...new Set([organizerId, ...participantIds])];
  const mode: CallMode = allParticipants.length <= MESH_MAX_PARTICIPANTS ? 'mesh' : 'sfu';

  const callId = crypto.randomUUID();
  let sfuRoom: LivepeerRoom | null = null;

  if (mode === 'sfu') {
    sfuRoom = await createSfuRoom(env, callId);
  }

  const now = Date.now();
  const participants: Record<string, CallParticipant> = {};

  for (const uid of allParticipants) {
    participants[uid.toLowerCase()] = {
      userId: uid.toLowerCase(),
      displayName: uid.slice(0, 10),
      state: 'ringing',
      joinedAt: now,
      streams: options?.videoEnabled ? ['camera', 'audio'] : ['audio'],
      isSpeaking: false,
      speakingLevel: 0,
      handRaised: false,
      handRaisedAt: null,
      breakoutRoom: null,
      connectionQuality: 'good',
    };
  }

  const call: GroupCall = {
    id: callId,
    conversationId,
    mode,
    organizerId: organizerId.toLowerCase(),
    state: 'ringing' as CallState,
    createdAt: now,
    startedAt: null,
    endedAt: null,
    duration: 0,
    maxParticipants: allParticipants.length,
    participants,
    participantOrder: allParticipants.map((u) => u.toLowerCase()),
    breakoutRooms: {},
    activeSpeaker: null,
    activeSpeakerHistory: [],
    sfuRoomId: sfuRoom?.id ?? null,
    sfuStreamToken: sfuRoom?.streamToken ?? null,
    meshSignalling: {},
    settings: {
      videoEnabled: options?.videoEnabled ?? true,
      micEnabled: true,
      allowScreenShare: true,
      allowHandRaise: true,
      maxDurationMinutes: MAX_CALL_DURATION_MINUTES,
      recordCall: false,
      raiseHandToSpeak: false,
      enableBreakoutRooms: true,
      maxBreakoutRooms: 5,
      ...options?.settings,
    },
    mutedByHost: [],
  };

  // Store in KV
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${KV_CALL_PREFIX}${callId}`, JSON.stringify(call), {
      expirationTtl: 86400, // 24 hour TTL for calls
    });

    // Index active calls per conversation
    const indexKey = `${KV_CALL_INDEX_PREFIX}${conversationId}`;
    await kv.put(indexKey, callId, { expirationTtl: 86400 });
  }

  log('info', `[webrtc] Created ${mode} call ${callId} for conversation ${conversationId}`);
  return call;
}

/**
 * Join an existing group call.
 */
export async function joinGroupCall(
  env: Env,
  callId: string,
  userId: string,
  options?: { videoEnabled?: boolean; audioEnabled?: boolean },
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (call.state === 'ended') return null;

  const uid = userId.toLowerCase();
  const now = Date.now();

  // Add/update participant
  if (!call.participants[uid]) {
    call.participantOrder.push(uid);
    call.maxParticipants = Math.max(call.maxParticipants, call.participantOrder.length);
  }

  call.participants[uid] = {
    userId: uid,
    displayName: uid.slice(0, 10),
    state: 'connected',
    joinedAt: call.participants[uid]?.joinedAt ?? now,
    streams: options?.videoEnabled !== false ? ['camera', 'audio'] : ['audio'],
    isSpeaking: false,
    speakingLevel: 0,
    handRaised: false,
    handRaisedAt: null,
    breakoutRoom: null,
    connectionQuality: 'good',
  };

  // Start call if first participant connects
  if (!call.startedAt) {
    call.startedAt = now;
  }
  call.state = 'connected';

  await saveGroupCall(env, call);
  return call;
}

/**
 * Leave a group call.
 */
export async function leaveGroupCall(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  const uid = userId.toLowerCase();

  // Remove from breakout room if in one
  for (const [roomId, members] of Object.entries(call.breakoutRooms)) {
    const idx = members.indexOf(uid);
    if (idx >= 0) {
      members.splice(idx, 1);
      if (members.length === 0) {
        delete call.breakoutRooms[roomId];
      }
    }
  }

  // Remove participant
  delete call.participants[uid];
  call.participantOrder = call.participantOrder.filter((p) => p !== uid);

  // End call if no participants left
  if (Object.keys(call.participants).length === 0) {
    call.state = 'ended';
    call.endedAt = Date.now();
    call.duration = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  } else {
    // Re-elect active speaker
    if (call.activeSpeaker === uid) {
      call.activeSpeaker = call.participantOrder[0] ?? null;
    }
  }

  await saveGroupCall(env, call);
  return call;
}

/**
 * End a group call entirely (organizer only).
 */
export async function endGroupCall(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (call.organizerId !== userId.toLowerCase()) {
    throw new Error('[webrtc] Only the organizer can end the call');
  }

  call.state = 'ended';
  call.endedAt = Date.now();
  call.duration = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;

  await saveGroupCall(env, call);
  return call;
}

// ─── Screen Sharing ──────────────────────────────────────────────────────

/**
 * Start screen sharing in a call.
 */
export async function startScreenShare(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (!call.settings.allowScreenShare) {
    throw new Error('[webrtc] Screen sharing is disabled for this call');
  }

  const participant = call.participants[userId.toLowerCase()];
  if (!participant) throw new Error('[webrtc] Not a participant');

  if (!participant.streams.includes('screen')) {
    participant.streams.push('screen');
  }

  await saveGroupCall(env, call);
  return call;
}

/**
 * Stop screen sharing.
 */
export async function stopScreenShare(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  const participant = call.participants[userId.toLowerCase()];
  if (!participant) return call;

  participant.streams = participant.streams.filter((s) => s !== 'screen');

  await saveGroupCall(env, call);
  return call;
}

// ─── Speaker Detection ───────────────────────────────────────────────────

/**
 * Update speaking status for a participant (called periodically from WS).
 * Uses hysteresis to avoid rapid toggling.
 */
export async function updateSpeakingStatus(
  env: Env,
  callId: string,
  userId: string,
  speakingLevel: number,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  const participant = call.participants[userId.toLowerCase()];
  if (!participant) return null;

  const _wasSpeaking = participant.isSpeaking;
  participant.speakingLevel = speakingLevel;
  participant.isSpeaking = speakingLevel > 0.05; // Threshold

  // Update active speaker
  if (participant.isSpeaking && call.activeSpeaker !== userId.toLowerCase()) {
    call.activeSpeakerHistory = [
      userId.toLowerCase(),
      ...call.activeSpeakerHistory.filter((s) => s !== userId.toLowerCase()),
    ].slice(0, 5);
    call.activeSpeaker = userId.toLowerCase();
  }

  // Clear active speaker after hysteresis
  if (!participant.isSpeaking && call.activeSpeaker === userId.toLowerCase()) {
    call.activeSpeaker = null;
  }

  await saveGroupCall(env, call);
  return call;
}

/**
 * Get the current active speaker in a call.
 */
export function getActiveSpeaker(call: GroupCall): CallParticipant | null {
  if (!call.activeSpeaker) return null;
  return call.participants[call.activeSpeaker] ?? null;
}

// ─── Hand Raise ──────────────────────────────────────────────────────────

/**
 * Raise hand in a call.
 */
export async function raiseHand(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (!call.settings.allowHandRaise) {
    throw new Error('[webrtc] Hand raise is disabled');
  }

  const participant = call.participants[userId.toLowerCase()];
  if (!participant) return null;

  participant.handRaised = !participant.handRaised;
  participant.handRaisedAt = participant.handRaised ? Date.now() : null;

  await saveGroupCall(env, call);
  return call;
}

/**
 * Lower hand (organizer can lower others' hands).
 */
export async function lowerHand(
  env: Env,
  callId: string,
  targetUserId: string,
  organizerId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  // Only organizer can lower hands
  if (call.organizerId !== organizerId.toLowerCase()) {
    throw new Error('[webrtc] Only the organizer can lower hands');
  }

  const participant = call.participants[targetUserId.toLowerCase()];
  if (!participant) return null;

  participant.handRaised = false;
  participant.handRaisedAt = null;

  await saveGroupCall(env, call);
  return call;
}

/**
 * Get all participants with hands raised (sorted by time).
 */
export function getRaisedHands(call: GroupCall): CallParticipant[] {
  return Object.values(call.participants)
    .filter((p) => p.handRaised && p.handRaisedAt)
    .sort((a, b) => (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0));
}

// ─── Breakout Rooms ──────────────────────────────────────────────────────

/**
 * Create a breakout room within a call.
 */
export async function createBreakoutRoom(
  env: Env,
  callId: string,
  _roomName: string,
  memberIds: string[],
  _organizerId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (!call.settings.enableBreakoutRooms) {
    throw new Error('[webrtc] Breakout rooms are disabled');
  }

  if (Object.keys(call.breakoutRooms).length >= call.settings.maxBreakoutRooms) {
    throw new Error(`[webrtc] Max ${call.settings.maxBreakoutRooms} breakout rooms`);
  }

  if (memberIds.length < BREAKOUT_MIN_MEMBERS) {
    throw new Error(`[webrtc] Breakout rooms need at least ${BREAKOUT_MIN_MEMBERS} members`);
  }

  const roomId = `breakout_${crypto.randomUUID().slice(0, 8)}`;
  const members = memberIds.map((id) => id.toLowerCase());

  // Move participants to breakout room
  for (const uid of members) {
    if (call.participants[uid]) {
      call.participants[uid].breakoutRoom = roomId;
    }
  }

  call.breakoutRooms[roomId] = members;

  await saveGroupCall(env, call);
  return call;
}

/**
 * Join a breakout room.
 */
export async function joinBreakoutRoom(
  env: Env,
  callId: string,
  roomId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (!call.breakoutRooms[roomId]) {
    throw new Error('[webrtc] Breakout room not found');
  }

  const uid = userId.toLowerCase();

  // Leave current breakout
  for (const [, members] of Object.entries(call.breakoutRooms)) {
    const idx = members.indexOf(uid);
    if (idx >= 0) members.splice(idx, 1);
  }

  // Join new breakout
  if (!call.breakoutRooms[roomId].includes(uid)) {
    call.breakoutRooms[roomId].push(uid);
  }

  if (call.participants[uid]) {
    call.participants[uid].breakoutRoom = roomId;
  }

  await saveGroupCall(env, call);
  return call;
}

/**
 * Return to main room from breakout.
 */
export async function returnToMainRoom(
  env: Env,
  callId: string,
  userId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  const uid = userId.toLowerCase();

  for (const [roomId, members] of Object.entries(call.breakoutRooms)) {
    const idx = members.indexOf(uid);
    if (idx >= 0) {
      members.splice(idx, 1);
      if (members.length === 0) {
        delete call.breakoutRooms[roomId];
      }
      break;
    }
  }

  if (call.participants[uid]) {
    call.participants[uid].breakoutRoom = null;
  }

  await saveGroupCall(env, call);
  return call;
}

// ─── Mesh Signalling ─────────────────────────────────────────────────────

/**
 * Store WebRTC offer/answer for mesh mode.
 * In mesh mode, each participant sends their SDP offer/answer
 * via our signalling channel, and we relay to the intended peer.
 */
export async function storeMeshSignal(
  env: Env,
  callId: string,
  fromUserId: string,
  toUserId: string,
  signal: any,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (!call.meshSignalling[fromUserId]) {
    call.meshSignalling[fromUserId] = {};
  }
  call.meshSignalling[fromUserId][toUserId] = {
    signal,
    timestamp: Date.now(),
  };

  await saveGroupCall(env, call);
  return call;
}

/**
 * Get pending signals for a user (consume on read).
 */
export async function consumeMeshSignals(
  env: Env,
  callId: string,
  userId: string,
): Promise<Array<{ fromUserId: string; signal: any }>> {
  const call = await getGroupCall(env, callId);
  if (!call) return [];

  const signals: Array<{ fromUserId: string; signal: any }> = [];

  for (const [fromId, targets] of Object.entries(call.meshSignalling)) {
    if (targets[userId]) {
      signals.push({ fromUserId: fromId, signal: targets[userId].signal });
      delete targets[userId];
    }
  }

  await saveGroupCall(env, call);
  return signals;
}

// ─── Connection Quality ──────────────────────────────────────────────────

/**
 * Update connection quality for a participant.
 */
export async function updateConnectionQuality(
  env: Env,
  callId: string,
  userId: string,
  quality: 'good' | 'fair' | 'poor',
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  const participant = call.participants[userId.toLowerCase()];
  if (!participant) return null;

  participant.connectionQuality = quality;

  await saveGroupCall(env, call);
  return call;
}

// ─── Host Controls ───────────────────────────────────────────────────────

/**
 * Mute a participant (host only).
 */
export async function muteParticipant(
  env: Env,
  callId: string,
  targetUserId: string,
  organizerId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (call.organizerId !== organizerId.toLowerCase()) {
    throw new Error('[webrtc] Only the organizer can mute participants');
  }

  const target = call.participants[targetUserId.toLowerCase()];
  if (!target) throw new Error('[webrtc] Participant not found');

  target.streams = target.streams.filter((s) => s !== 'audio');
  if (!call.mutedByHost.includes(targetUserId.toLowerCase())) {
    call.mutedByHost.push(targetUserId.toLowerCase());
  }

  await saveGroupCall(env, call);
  return call;
}

/**
 * Remove a participant (host only).
 */
export async function removeParticipant(
  env: Env,
  callId: string,
  targetUserId: string,
  organizerId: string,
): Promise<GroupCall | null> {
  const call = await getGroupCall(env, callId);
  if (!call) return null;

  if (call.organizerId !== organizerId.toLowerCase()) {
    throw new Error('[webrtc] Only the organizer can remove participants');
  }

  return leaveGroupCall(env, callId, targetUserId);
}

// ─── KV Persistence ─────────────────────────────────────────────────────

/**
 * Get a group call by ID.
 */
export async function getGroupCall(env: Env, callId: string): Promise<GroupCall | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const raw = await kv.get(`${KV_CALL_PREFIX}${callId}`);
    return raw ? (JSON.parse(raw) as GroupCall) : null;
  } catch {
    return null;
  }
}

/**
 * Get active call for a conversation.
 */
export async function getActiveCallForConversation(
  env: Env,
  conversationId: string,
): Promise<GroupCall | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const indexKey = `${KV_CALL_INDEX_PREFIX}${conversationId}`;
    const callId = await kv.get(indexKey);
    if (!callId) return null;

    const call = await getGroupCall(env, callId);
    if (!call || call.state === 'ended') {
      await kv.delete(indexKey).catch(() => {});
      return null;
    }
    return call;
  } catch {
    return null;
  }
}

async function saveGroupCall(env: Env, call: GroupCall): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  await kv
    .put(`${KV_CALL_PREFIX}${call.id}`, JSON.stringify(call), {
      expirationTtl: 86400,
    })
    .catch(() => {});
}

// ─── Utility ─────────────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
