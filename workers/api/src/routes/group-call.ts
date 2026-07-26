/**
 * /api/call — WebRTC Group Video/Voice Call Routes
 *
 * Routes:
 *   POST   /api/call/create        — Create a group call (mesh/SFU)
 *   POST   /api/call/:callId/join  — Join a group call
 *   POST   /api/call/:callId/leave — Leave a group call
 *   POST   /api/call/:callId/end   — End a group call (organizer)
 *   GET    /api/call/:callId       — Get call state
 *   GET    /api/call/conversation/:conversationId — Get active call for conversation
 *
 *   POST   /api/call/:callId/screen/start    — Start screen share
 *   POST   /api/call/:callId/screen/stop     — Stop screen share
 *   POST   /api/call/:callId/speaking        — Update speaking status
 *   POST   /api/call/:callId/hand/raise      — Raise hand
 *   POST   /api/call/:callId/hand/lower      — Lower hand (organizer)
 *   GET    /api/call/:callId/hands           — Get raised hands
 *
 *   POST   /api/call/:callId/breakout/create — Create breakout room
 *   POST   /api/call/:callId/breakout/join   — Join breakout room
 *   POST   /api/call/:callId/breakout/return  — Return to main room
 *
 *   POST   /api/call/:callId/signal          — WebRTC signalling (mesh)
 *   GET    /api/call/:callId/signals/:userId  — Consume pending signals
 *
 *   POST   /api/call/:callId/mute            — Mute participant (organizer)
 *   POST   /api/call/:callId/remove          — Remove participant (organizer)
 *   POST   /api/call/:callId/quality         — Update connection quality
 */

import { log } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Lazy imports ───────────────────────────────────────────────────────

let _webrtc: typeof import('../lib/webrtc-group-call') | null = null;

async function getWebrtc() {
  if (!_webrtc) _webrtc = await import('../lib/webrtc-group-call');
  return _webrtc;
}

// ─── POST /api/call/create ──────────────────────────────────────────────

export async function handleCreateCall(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: {
    conversationId: string;
    participantIds: string[];
    videoEnabled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.participantIds?.length) {
    return jsonResponse({ error: 'conversationId and participantIds required' }, 400);
  }

  try {
    const { createGroupCall } = await getWebrtc();
    const call = await createGroupCall(env, body.conversationId, userId, body.participantIds, {
      videoEnabled: body.videoEnabled,
    });

    return noCacheJsonResponse({
      ok: true,
      callId: call.id,
      mode: call.mode,
      sfuRoomId: call.sfuRoomId,
      sfuStreamToken: call.sfuStreamToken,
      participantCount: Object.keys(call.participants).length,
    });
  } catch (err) {
    log('error', '[group-call] create failed', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Create call failed' }, 500);
  }
}

// ─── POST /api/call/:callId/join ────────────────────────────────────────

export async function handleJoinCall(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { videoEnabled?: boolean; audioEnabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const { joinGroupCall } = await getWebrtc();
    const call = await joinGroupCall(env, callId, userId, body);

    if (!call) {
      return jsonResponse({ error: 'Call not found or ended' }, 404);
    }

    return noCacheJsonResponse({
      ok: true,
      callId: call.id,
      mode: call.mode,
      participants: Object.keys(call.participants).length,
      sfuStreamToken: call.sfuStreamToken,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Join failed' }, 500);
  }
}

// ─── POST /api/call/:callId/leave ───────────────────────────────────────

export async function handleLeaveCall(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { leaveGroupCall } = await getWebrtc();
    const call = await leaveGroupCall(env, callId, userId);

    if (!call) return jsonResponse({ error: 'Call not found' }, 404);

    return noCacheJsonResponse({
      ok: true,
      callEnded: call.state === 'ended',
      remainingParticipants: Object.keys(call.participants).length,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Leave failed' }, 500);
  }
}

// ─── POST /api/call/:callId/end ─────────────────────────────────────────

export async function handleEndCall(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { endGroupCall } = await getWebrtc();
    const call = await endGroupCall(env, callId, userId);

    if (!call) return jsonResponse({ error: 'Call not found' }, 404);

    return noCacheJsonResponse({
      ok: true,
      duration: call.duration,
      maxParticipants: call.maxParticipants,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'End call failed' }, 500);
  }
}

// ─── GET /api/call/:callId ──────────────────────────────────────────────

export async function handleGetCall(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  try {
    const { getGroupCall } = await getWebrtc();
    const call = await getGroupCall(env, callId);

    if (!call) return jsonResponse({ error: 'Call not found' }, 404);

    // Return public state (strip internal signalling)
    return noCacheJsonResponse({
      call: {
        id: call.id,
        conversationId: call.conversationId,
        mode: call.mode,
        state: call.state,
        organizerId: call.organizerId,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
        duration: call.duration,
        maxParticipants: call.maxParticipants,
        participants: call.participants,
        activeSpeaker: call.activeSpeaker,
        breakoutRooms: Object.keys(call.breakoutRooms),
        settings: call.settings,
        mutedByHost: call.mutedByHost,
      },
    });
  } catch (_err) {
    return jsonResponse({ error: 'Failed to get call' }, 500);
  }
}

// ─── GET /api/call/conversation/:conversationId ─────────────────────────

export async function handleGetConversationCall(
  _request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  try {
    const { getActiveCallForConversation } = await getWebrtc();
    const call = await getActiveCallForConversation(env, conversationId);

    return noCacheJsonResponse({
      activeCall: call
        ? {
            id: call.id,
            state: call.state,
            mode: call.mode,
            participantCount: Object.keys(call.participants).length,
          }
        : null,
    });
  } catch {
    return jsonResponse({ error: 'Failed to check call' }, 500);
  }
}

// ─── POST /api/call/:callId/screen/start ────────────────────────────────

export async function handleStartScreenShare(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { startScreenShare } = await getWebrtc();
    const call = await startScreenShare(env, callId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Screen share failed' }, 500);
  }
}

// ─── POST /api/call/:callId/screen/stop ─────────────────────────────────

export async function handleStopScreenShare(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { stopScreenShare } = await getWebrtc();
    const call = await stopScreenShare(env, callId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Stop screen share failed' },
      500,
    );
  }
}

// ─── POST /api/call/:callId/speaking ────────────────────────────────────

export async function handleSpeaking(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { level: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { updateSpeakingStatus } = await getWebrtc();
    const call = await updateSpeakingStatus(env, callId, userId, body.level);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true, activeSpeaker: call.activeSpeaker });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Update failed' }, 500);
  }
}

// ─── POST /api/call/:callId/hand/raise ──────────────────────────────────

export async function handleRaiseHand(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { raiseHand } = await getWebrtc();
    const call = await raiseHand(env, callId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);

    const participant = call.participants[userId.toLowerCase()];
    return noCacheJsonResponse({ ok: true, handRaised: participant?.handRaised ?? false });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Hand raise failed' }, 500);
  }
}

// ─── POST /api/call/:callId/hand/lower ──────────────────────────────────

export async function handleLowerHand(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { targetUserId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { lowerHand } = await getWebrtc();
    const call = await lowerHand(env, callId, body.targetUserId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Lower hand failed' }, 500);
  }
}

// ─── GET /api/call/:callId/hands ────────────────────────────────────────

export async function handleGetRaisedHands(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  try {
    const { getGroupCall, getRaisedHands } = await getWebrtc();
    const call = await getGroupCall(env, callId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);

    const hands = getRaisedHands(call);
    return noCacheJsonResponse({
      hands: hands.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        raisedAt: p.handRaisedAt,
      })),
    });
  } catch {
    return jsonResponse({ error: 'Failed to get hands' }, 500);
  }
}

// ─── POST /api/call/:callId/breakout/create ─────────────────────────────

export async function handleCreateBreakout(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { roomName: string; memberIds: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { createBreakoutRoom } = await getWebrtc();
    const call = await createBreakoutRoom(env, callId, body.roomName, body.memberIds, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true, breakoutRooms: Object.keys(call.breakoutRooms) });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Breakout failed' }, 500);
  }
}

// ─── POST /api/call/:callId/breakout/join ───────────────────────────────

export async function handleJoinBreakout(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { roomId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { joinBreakoutRoom } = await getWebrtc();
    const call = await joinBreakoutRoom(env, callId, body.roomId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Breakout join failed' },
      500,
    );
  }
}

// ─── POST /api/call/:callId/breakout/return ─────────────────────────────

export async function handleReturnToMain(
  _request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { returnToMainRoom } = await getWebrtc();
    const call = await returnToMainRoom(env, callId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Return failed' }, 500);
  }
}

// ─── POST /api/call/:callId/signal ──────────────────────────────────────

export async function handleSignal(request: Request, env: Env, callId: string): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { toUserId: string; signal: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { storeMeshSignal } = await getWebrtc();
    const call = await storeMeshSignal(env, callId, userId, body.toUserId, body.signal);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Signal failed' }, 500);
  }
}

// ─── GET /api/call/:callId/signals/:userId ──────────────────────────────

export async function handleGetSignals(
  _request: Request,
  env: Env,
  callId: string,
  targetUserId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;

  try {
    const { consumeMeshSignals } = await getWebrtc();
    const signals = await consumeMeshSignals(env, callId, targetUserId);
    return noCacheJsonResponse({ signals });
  } catch {
    return jsonResponse({ error: 'Failed to get signals' }, 500);
  }
}

// ─── POST /api/call/:callId/mute ────────────────────────────────────────

export async function handleMuteParticipant(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { targetUserId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { muteParticipant } = await getWebrtc();
    const call = await muteParticipant(env, callId, body.targetUserId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Mute failed' }, 500);
  }
}

// ─── POST /api/call/:callId/remove ──────────────────────────────────────

export async function handleRemoveParticipant(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { targetUserId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { removeParticipant } = await getWebrtc();
    const call = await removeParticipant(env, callId, body.targetUserId, userId);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Remove failed' }, 500);
  }
}

// ─── POST /api/call/:callId/quality ─────────────────────────────────────

export async function handleConnectionQuality(
  request: Request,
  env: Env,
  callId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { quality: 'good' | 'fair' | 'poor' };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid body' }, 400);
  }

  try {
    const { updateConnectionQuality } = await getWebrtc();
    const call = await updateConnectionQuality(env, callId, userId, body.quality);
    if (!call) return jsonResponse({ error: 'Call not found' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Quality update failed' },
      500,
    );
  }
}
