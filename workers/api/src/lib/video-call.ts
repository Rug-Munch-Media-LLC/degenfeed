/**
 * @degenfeed/api-worker — WebRTC Video Call Service
 *
 * P2P video calling with zero bandwidth cost.
 *   - 1-on-1: Direct P2P (offer/answer/ICE via KV, text-only)
 *   - Group <6: Full mesh — each peer connects to every other
 *   - Group 6+: SFU mode via Livepeer (or mesh with reduced quality)
 *   - Screen sharing: Add screen share track
 *   - Recording: Optional recording via Livepeer
 *
 * Server cost: zero for signaling (KV text exchange, KB-scale).
 * Video bytes flow peer-to-peer, never through our servers.
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import { broadcastToUser } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import { methodNotAllowed } from '../response-helpers';

// ─── Types ──────────────────────────────────────────────────────────────

export interface VideoCall {
  callId: string;
  host: string; // wallet who created the call
  participants: string[]; // wallet addresses of all participants
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  startedAt: number;
  endedAt?: number;
  recording: boolean;
  livepeerStreamId?: string;
  livepeerPlaybackUrl?: string;
  /** For group calls: 'mesh' (<6) | 'sfu' (6+) */
  groupMode?: 'mesh' | 'sfu';
}

export interface SignalData {
  type: 'offer' | 'answer';
  sdp: string;
  from: string;
  to: string;
}

export interface IceCandidateData {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  from: string;
  to: string;
}

export interface CallHistoryEntry {
  callId: string;
  peer: string;
  type: 'audio' | 'video';
  status: 'missed' | 'completed';
  duration: number;
  timestamp: number;
}

// ─── KV Key Helpers ─────────────────────────────────────────────────────

const CALL_TTL = 86400; // 24h for active calls, shorter for ended

function callKey(callId: string): string {
  return `call:${callId}`;
}

function signalKey(callId: string, peerId: string): string {
  return `call:signal:${callId}:${peerId}`;
}

function iceKey(callId: string, from: string, to: string): string {
  return `call:ice:${callId}:${from}:${to}`;
}

function activeIndexKey(): string {
  return 'calls:active';
}

function callHistoryKey(wallet: string): string {
  return `call:history:${wallet}`;
}

// ─── Video Call Manager ─────────────────────────────────────────────────

export class VideoCallManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Create a new video/audio call.
   */
  async createCall(
    host: string,
    type: 'audio' | 'video',
    participants: string[],
    recording = false,
  ): Promise<VideoCall> {
    const callId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

    const uniqueParticipants = [...new Set([host, ...participants])];
    const totalPeers = uniqueParticipants.length;
    const groupMode: 'mesh' | 'sfu' | undefined =
      totalPeers > 6 ? 'sfu' : totalPeers > 2 ? 'mesh' : undefined;

    const call: VideoCall = {
      callId,
      host,
      participants: uniqueParticipants,
      type,
      status: 'ringing',
      startedAt: Date.now(),
      recording,
      groupMode,
    };

    // If recording and >2 participants, create Livepeer stream
    if (recording && totalPeers > 2) {
      try {
        const { LivepeerService } = await import('./livepeer-service');
        const livepeer = new LivepeerService(this.env);
        const stream = await livepeer.createStream(`call-${callId}`, {
          record: true,
        });
        call.livepeerStreamId = stream.id;
        call.livepeerPlaybackUrl = stream.playbackUrl;
      } catch {
        // Livepeer fallback failed silently — no recording
        call.recording = false;
      }
    }

    // Store call in KV
    await this.env.CACHE?.put(callKey(callId), JSON.stringify(call), {
      expirationTtl: CALL_TTL,
    });

    // Add to active index
    await this.addToActiveIndex(callId);

    return call;
  }

  /**
   * Get a call by ID.
   */
  async getCall(callId: string): Promise<VideoCall | null> {
    try {
      const raw = await this.env.CACHE?.get(callKey(callId));
      if (!raw) return null;
      return JSON.parse(raw) as VideoCall;
    } catch {
      return null;
    }
  }

  /**
   * Update call status and metadata.
   */
  async updateCall(callId: string, updates: Partial<VideoCall>): Promise<VideoCall | null> {
    const call = await this.getCall(callId);
    if (!call) return null;

    Object.assign(call, updates);

    await this.env.CACHE?.put(callKey(callId), JSON.stringify(call), {
      expirationTtl: call.status === 'ended' ? 3600 : CALL_TTL,
    });

    if (call.status === 'ended') {
      await this.removeFromActiveIndex(callId);
      // Record call history for each participant
      for (const participant of call.participants) {
        await this.recordCallHistory(participant, call);
      }
    }

    return call;
  }

  /**
   * Add participant to an existing call.
   */
  async addParticipant(callId: string, wallet: string): Promise<VideoCall | null> {
    const call = await this.getCall(callId);
    if (call?.status !== 'ringing') return null;

    if (!call.participants.includes(wallet)) {
      call.participants.push(wallet);
      // Re-evaluate group mode if new total is >6
      if (call.participants.length > 6) {
        call.groupMode = 'sfu';
      }
    }

    await this.env.CACHE?.put(callKey(callId), JSON.stringify(call), {
      expirationTtl: CALL_TTL,
    });

    // Notify host that someone joined
    broadcastToUser(call.host, CHANNELS.CALL_STATE, {
      type: 'participant_joined',
      callId,
      wallet,
    });

    return call;
  }

  /**
   * Remove participant from a call.
   */
  async removeParticipant(callId: string, wallet: string): Promise<VideoCall | null> {
    const call = await this.getCall(callId);
    if (!call) return null;

    call.participants = call.participants.filter((p) => p !== wallet);

    // If no participants left, end the call
    if (call.participants.length === 0) {
      return this.updateCall(callId, { status: 'ended', endedAt: Date.now() });
    }

    // If host leaves, transfer host to next participant
    if (call.host === wallet && call.participants.length > 0) {
      call.host = call.participants[0] ?? call.host;
    }

    await this.env.CACHE?.put(callKey(callId), JSON.stringify(call), {
      expirationTtl: CALL_TTL,
    });

    return call;
  }

  /**
   * Store SDP signal (offer/answer) for a peer.
   */
  async storeSignal(callId: string, peerId: string, signal: SignalData): Promise<boolean> {
    try {
      const key = signalKey(callId, peerId);
      const raw = await this.env.CACHE?.get(key);
      const signals: SignalData[] = raw ? JSON.parse(raw) : [];
      signals.push(signal);
      // Keep only last 10 signals
      const trimmed = signals.slice(-10);
      await this.env.CACHE?.put(key, JSON.stringify(trimmed), {
        expirationTtl: CALL_TTL,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Poll for signals intended for a peer.
   */
  async pollSignals(callId: string, peerId: string): Promise<SignalData[]> {
    try {
      const raw = await this.env.CACHE?.get(signalKey(callId, peerId));
      if (!raw) return [];
      return JSON.parse(raw) as SignalData[];
    } catch {
      return [];
    }
  }

  /**
   * Clear signals after consumption (to avoid re-processing).
   */
  async clearSignals(callId: string, peerId: string): Promise<void> {
    try {
      await this.env.CACHE?.delete(signalKey(callId, peerId));
    } catch {
      // Non-critical
    }
  }

  /**
   * Store ICE candidate for a specific peer-to-peer link.
   */
  async storeIceCandidate(
    callId: string,
    from: string,
    to: string,
    candidate: IceCandidateData,
  ): Promise<boolean> {
    try {
      const key = iceKey(callId, from, to);
      const raw = await this.env.CACHE?.get(key);
      const candidates: IceCandidateData[] = raw ? JSON.parse(raw) : [];
      candidates.push(candidate);
      // Keep only last 50 candidates
      const trimmed = candidates.slice(-50);
      await this.env.CACHE?.put(key, JSON.stringify(trimmed), {
        expirationTtl: CALL_TTL,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Poll for ICE candidates intended for a specific link.
   */
  async pollIceCandidates(callId: string, from: string, to: string): Promise<IceCandidateData[]> {
    try {
      const raw = await this.env.CACHE?.get(iceKey(callId, from, to));
      if (!raw) return [];
      return JSON.parse(raw) as IceCandidateData[];
    } catch {
      return [];
    }
  }

  /**
   * List all active calls.
   */
  async listActiveCalls(limit = 20): Promise<VideoCall[]> {
    try {
      const raw = await this.env.CACHE?.get(activeIndexKey());
      if (!raw) return [];
      const ids: string[] = JSON.parse(raw);
      const calls: VideoCall[] = [];
      for (const id of ids.slice(0, limit)) {
        const call = await this.getCall(id);
        if (call && (call.status === 'ringing' || call.status === 'active')) {
          calls.push(call);
        }
      }
      return calls;
    } catch {
      return [];
    }
  }

  /**
   * Get call history for a wallet.
   */
  async getCallHistory(wallet: string): Promise<CallHistoryEntry[]> {
    try {
      const raw = await this.env.CACHE?.get(callHistoryKey(wallet));
      if (!raw) return [];
      return JSON.parse(raw) as CallHistoryEntry[];
    } catch {
      return [];
    }
  }

  /**
   * Record a call history entry.
   */
  private async recordCallHistory(wallet: string, call: VideoCall): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(callHistoryKey(wallet));
      const history: CallHistoryEntry[] = raw ? JSON.parse(raw) : [];

      // Determine the "peer" — the other person in 1-on-1, or "Group Call"
      const otherParticipants = call.participants.filter((p) => p !== wallet);
      const peer: string =
        otherParticipants.length === 1 ? (otherParticipants[0] ?? 'Unknown') : 'Group Call';

      const duration = call.endedAt ? call.endedAt - call.startedAt : 0;

      history.unshift({
        callId: call.callId,
        peer,
        type: call.type,
        status: duration === 0 ? 'missed' : 'completed',
        duration,
        timestamp: call.startedAt,
      });

      // Keep only last 50 entries
      const trimmed = history.slice(0, 50);

      await this.env.CACHE?.put(callHistoryKey(wallet), JSON.stringify(trimmed), {
        expirationTtl: 30 * 86400, // 30 days
      });
    } catch {
      // Non-critical
    }
  }

  // ─── Index Management ─────────────────────────────────────────────

  private async addToActiveIndex(callId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(activeIndexKey());
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(callId)) {
        ids.push(callId);
        await this.env.CACHE?.put(activeIndexKey(), JSON.stringify(ids), {
          expirationTtl: CALL_TTL,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async removeFromActiveIndex(callId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(activeIndexKey());
      if (!raw) return;
      const ids: string[] = JSON.parse(raw).filter((id: string) => id !== callId);
      await this.env.CACHE?.put(activeIndexKey(), JSON.stringify(ids), {
        expirationTtl: CALL_TTL,
      });
    } catch {
      // Non-critical
    }
  }
}

// ─── Route Handlers ─────────────────────────────────────────────────────

/**
 * POST /api/calls/create — Create a call (1-on-1 or group)
 */
export async function handleCallCreate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      type?: 'audio' | 'video';
      participants?: string[];
      recording?: boolean;
    };

    if (!body.participants || body.participants.length === 0) {
      return jsonResponse({ error: 'At least one participant is required' }, 400);
    }

    if (body.participants.length > 50) {
      return jsonResponse({ error: 'Maximum 50 participants per call' }, 400);
    }

    const manager = new VideoCallManager(env);
    const call = await manager.createCall(
      session.address,
      body.type || 'video',
      body.participants,
      body.recording ?? false,
    );

    // Notify all non-host participants about the incoming call
    const others = call.participants.filter((p) => p !== session.address);
    for (const participant of others) {
      broadcastToUser(participant, CHANNELS.CALL_INCOMING, {
        callId: call.callId,
        from: session.address,
        displayName: session.displayName || session.address.slice(0, 8),
        avatarUrl: session.avatarUrl,
        type: call.type,
        participants: call.participants.length,
      });
    }

    return jsonResponse({ ok: true, call }, 201);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] create failed:', error);
    return jsonResponse({ error: `Failed to create call: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/join — Join a call
 */
export async function handleCallJoin(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    if (call.status === 'ended') {
      return jsonResponse({ error: 'Call has ended' }, 410);
    }

    const updated = await manager.addParticipant(callId, session.address);
    if (!updated) {
      return jsonResponse({ error: 'Failed to join call' }, 500);
    }

    // If call was ringing and has multiple participants, move to active
    if (updated.status === 'ringing' && updated.participants.length > 1) {
      await manager.updateCall(callId, { status: 'active' });
      updated.status = 'active';
    }

    return jsonResponse({
      ok: true,
      call: updated,
      signaling: {
        peers: updated.participants.filter((p) => p !== session.address && p !== call.host),
        host: call.host,
        groupMode: updated.groupMode || 'p2p',
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] join failed:', error);
    return jsonResponse({ error: `Failed to join call: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/leave — Leave a call
 */
export async function handleCallLeave(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new VideoCallManager(env);
    const updated = await manager.removeParticipant(callId, session.address);

    if (!updated) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    // Notify remaining participants
    for (const participant of updated.participants) {
      broadcastToUser(participant, CHANNELS.CALL_STATE, {
        type: 'participant_left',
        callId,
        wallet: session.address,
      });
    }

    return jsonResponse({ ok: true, call: updated });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] leave failed:', error);
    return jsonResponse({ error: `Failed to leave call: ${error}` }, 500);
  }
}

/**
 * GET /api/calls/:id/status — Call status + participants
 */
export async function handleCallStatus(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    return noCacheJsonResponse({ call });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] status failed:', error);
    return jsonResponse({ error: `Failed to get call status: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/signal — WebRTC signaling relay (offer/answer/ICE)
 */
export async function handleCallSignal(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      type: 'offer' | 'answer' | 'ice';
      sdp?: string;
      candidate?: string;
      sdpMid?: string;
      sdpMLineIndex?: number;
      to: string;
    };

    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call || call.status === 'ended') {
      return jsonResponse({ error: 'Call not found or ended' }, 404);
    }

    if (body.type === 'offer' || body.type === 'answer') {
      if (!body.sdp) {
        return jsonResponse({ error: 'sdp is required for offer/answer' }, 400);
      }

      const signal: SignalData = {
        type: body.type,
        sdp: body.sdp,
        from: session.address,
        to: body.to,
      };

      // Store for the receiving peer to poll
      // We store under the RECEIVER's key so they can poll for it
      await manager.storeSignal(callId, body.to, signal);
    } else if (body.type === 'ice') {
      const candidate: IceCandidateData = {
        candidate: body.candidate || '',
        sdpMid: body.sdpMid || null,
        sdpMLineIndex: body.sdpMLineIndex ?? null,
        from: session.address,
        to: body.to,
      };
      await manager.storeIceCandidate(callId, session.address, body.to, candidate);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] signal failed:', error);
    return jsonResponse({ error: `Failed to relay signal: ${error}` }, 500);
  }
}

/**
 * GET /api/calls/:id/signal/poll — Poll for signals and ICE candidates
 */
export async function handleCallSignalPoll(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call || call.status === 'ended') {
      return jsonResponse({ error: 'Call not found or ended' }, 404);
    }

    // Get signals intended for this peer
    const signals = await manager.pollSignals(callId, session.address);

    // Get ICE candidates for this peer
    const iceCandidates: IceCandidateData[] = [];
    for (const peer of call.participants) {
      if (peer === session.address) continue;
      const candidates = await manager.pollIceCandidates(callId, peer, session.address);
      iceCandidates.push(...candidates);
    }

    // Clear consumed signals
    if (signals.length > 0) {
      await manager.clearSignals(callId, session.address);
    }

    return noCacheJsonResponse({
      ok: true,
      signals,
      iceCandidates,
      participants: call.participants,
      status: call.status,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] signal poll failed:', error);
    return jsonResponse({ error: `Failed to poll signals: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/kick — Remove participant
 */
export async function handleCallKick(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { wallet?: string };
    if (!body.wallet) {
      return jsonResponse({ error: 'wallet is required' }, 400);
    }

    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    if (call.host !== session.address) {
      return jsonResponse({ error: 'Only the call host can kick participants' }, 403);
    }

    const updated = await manager.removeParticipant(callId, body.wallet);
    if (!updated) {
      return jsonResponse({ error: 'Failed to kick participant' }, 500);
    }

    // Notify the kicked participant
    broadcastToUser(body.wallet, CHANNELS.CALL_STATE, {
      type: 'kicked',
      callId,
    });

    return jsonResponse({ ok: true, call: updated });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] kick failed:', error);
    return jsonResponse({ error: `Failed to kick participant: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/mute — Mute/unmute self (broadcast to participants)
 */
export async function handleCallMute(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      audio?: boolean;
      video?: boolean;
    };

    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call || call.status === 'ended') {
      return jsonResponse({ error: 'Call not found or ended' }, 404);
    }

    // Notify participants of mute state change
    for (const participant of call.participants) {
      if (participant !== session.address) {
        broadcastToUser(participant, CHANNELS.CALL_STATE, {
          type: 'mute_change',
          callId,
          wallet: session.address,
          audio: body.audio,
          video: body.video,
        });
      }
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] mute failed:', error);
    return jsonResponse({ error: `Failed to update mute state: ${error}` }, 500);
  }
}

/**
 * POST /api/calls/:id/end — End a call (host only)
 */
export async function handleCallEnd(request: Request, env: Env, callId: string): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new VideoCallManager(env);
    const call = await manager.getCall(callId);

    if (!call) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    // Allow host or any participant to end (self-removal auto-ends if last)
    if (call.host !== session.address && call.participants.length > 1) {
      // Non-host: just remove self
      const updated = await manager.removeParticipant(callId, session.address);
      return jsonResponse({ ok: true, call: updated });
    }

    // Host: end the entire call
    const ended = await manager.updateCall(callId, {
      status: 'ended',
      endedAt: Date.now(),
    });

    // Notify all participants
    for (const participant of call.participants) {
      if (participant !== session.address) {
        broadcastToUser(participant, CHANNELS.CALL_STATE, {
          type: 'call_ended',
          callId,
        });
      }
    }

    // Clean up Livepeer stream if recording
    if (ended?.livepeerStreamId) {
      try {
        const { LivepeerService } = await import('./livepeer-service');
        const livepeer = new LivepeerService(env);
        await livepeer.terminateStream(ended.livepeerStreamId);
      } catch {
        // Non-critical cleanup
      }
    }

    return jsonResponse({ ok: true, call: ended });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] end failed:', error);
    return jsonResponse({ error: `Failed to end call: ${error}` }, 500);
  }
}

/**
 * GET /api/calls/history — Call history for current user
 */
export async function handleCallHistory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const manager = new VideoCallManager(env);
    const history = await manager.getCallHistory(session.address);

    return noCacheJsonResponse({ history });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[calls] history failed:', error);
    return jsonResponse({ error: `Failed to get call history: ${error}` }, 500);
  }
}
