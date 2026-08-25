/**
 * /api/chat/call — Live Audio/Video Calling Routes
 *
 * Routes:
 *   POST /api/chat/call/start     — Initiate a call
 *   POST /api/chat/call/accept    — Accept a call
 *   POST /api/chat/call/end       — End a call
 *   POST /api/chat/call/mute      — Toggle mute
 *   POST /api/chat/call/camera    — Toggle camera
 *   POST /api/chat/call/share     — Start/stop screen share
 *   GET  /api/chat/call/active    — Get active calls for user
 *   GET  /api/chat/call/history   — Get call history
 *   POST /api/chat/call/voicemail — Leave a voicemail
 */

import type { CallManager } from '@degenfeed/chat-super-app';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

let _callManager: CallManager | null = null;
async function getCallManager(): Promise<CallManager> {
  if (!_callManager) {
    const mod = await import('@degenfeed/chat-super-app');
    _callManager = mod.getCallManager();
  }
  return _callManager!;
}

// ─── POST /api/chat/call/start ───────────────────────────────────────────

export async function handleCallStart(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    conversationId: string;
    type: 'audio' | 'video';
    participants: string[];
    displayNames?: Record<string, string>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.type || !body.participants) {
    return jsonResponse(
      { error: 'Missing required fields: conversationId, type, participants' },
      400,
    );
  }

  if (!['audio', 'video'].includes(body.type)) {
    return jsonResponse({ error: 'Type must be "audio" or "video"' }, 400);
  }

  try {
    const cm = await getCallManager();
    const call = await cm.initiateCall(
      env,
      body.conversationId,
      body.type,
      session.address,
      body.participants,
      body.displayNames || {},
    );

    return jsonResponse(
      {
        ok: true,
        call: {
          callId: call.callId,
          type: call.type,
          state: call.state,
          participants: call.participants.map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
            isHost: p.isHost,
          })),
          roomName: call.roomName,
          livekitToken: call.livekitToken,
        },
      },
      201,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to initiate call',
      },
      500,
    );
  }
}

// ─── POST /api/chat/call/accept ──────────────────────────────────────────

export async function handleCallAccept(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { callId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId) {
    return jsonResponse({ error: 'Missing callId' }, 400);
  }

  try {
    const cm = await getCallManager();
    const call = await cm.acceptCall(env, body.callId, session.address);

    if (!call) {
      return jsonResponse({ error: 'Call not found or expired' }, 404);
    }

    return jsonResponse(
      {
        ok: true,
        call: {
          callId: call.callId,
          type: call.type,
          state: call.state,
          roomName: call.roomName,
          livekitToken: call.livekitToken,
        },
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to accept call',
      },
      500,
    );
  }
}

// ─── POST /api/chat/call/end ─────────────────────────────────────────────

export async function handleCallEnd(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { callId: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId) {
    return jsonResponse({ error: 'Missing callId' }, 400);
  }

  try {
    const cm = await getCallManager();
    const call = await cm.endCall(
      env,
      body.callId,
      session.address,
      (body.reason as any) || 'user-ended',
    );

    if (!call) {
      return jsonResponse({ error: 'Call not found' }, 404);
    }

    return jsonResponse(
      {
        ok: true,
        call: {
          callId: call.callId,
          duration: call.duration,
          state: call.state,
          endReason: call.endReason,
        },
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to end call',
      },
      500,
    );
  }
}

// ─── POST /api/chat/call/mute ────────────────────────────────────────────

export async function handleCallMute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { callId: string; muted: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId || body.muted === undefined) {
    return jsonResponse({ error: 'Missing callId or muted' }, 400);
  }

  try {
    const cm = await getCallManager();
    const _call = await cm.toggleMute(env, body.callId, session.address, body.muted);
    return jsonResponse({ ok: true, muted: body.muted });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to toggle mute' },
      500,
    );
  }
}

// ─── POST /api/chat/call/camera ──────────────────────────────────────────

export async function handleCallCamera(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { callId: string; enabled: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId || body.enabled === undefined) {
    return jsonResponse({ error: 'Missing callId or enabled' }, 400);
  }

  try {
    const cm = await getCallManager();
    await cm.toggleCamera(env, body.callId, session.address, body.enabled);
    return jsonResponse({ ok: true, videoEnabled: body.enabled });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to toggle camera' },
      500,
    );
  }
}

// ─── POST /api/chat/call/share ───────────────────────────────────────────

export async function handleCallShare(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { callId: string; sharing: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId || body.sharing === undefined) {
    return jsonResponse({ error: 'Missing callId or sharing' }, 400);
  }

  try {
    const cm = await getCallManager();
    if (body.sharing) {
      await cm.startScreenShare(env, body.callId, session.address);
    } else {
      await cm.stopScreenShare(env, body.callId, session.address);
    }
    return jsonResponse({ ok: true, screenSharing: body.sharing });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to toggle share' },
      500,
    );
  }
}

// ─── GET /api/chat/call/active ───────────────────────────────────────────

export async function handleCallActive(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const cm = await getCallManager();
    const activeCalls = cm.getActiveCallsForUser(session.address);

    return noCacheJsonResponse({
      ok: true,
      activeCalls: activeCalls.map((call) => ({
        callId: call.callId,
        conversationId: call.conversationId,
        type: call.type,
        state: call.state,
        initiator: call.initiator,
        participants: call.participants.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          muted: p.muted,
          videoEnabled: p.videoEnabled,
          isHost: p.isHost,
        })),
        startedAt: call.startedAt,
        roomName: call.roomName,
        isRecording: call.isRecording,
      })),
      count: activeCalls.length,
    });
  } catch {
    return jsonResponse({ error: 'Failed to get active calls' }, 500);
  }
}

// ─── GET /api/chat/call/history ──────────────────────────────────────────

export async function handleCallHistory(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  try {
    const cm = await getCallManager();
    const history = await cm.getCallHistory(env, session.address, limit);

    return noCacheJsonResponse({
      ok: true,
      calls: history,
      total: history.length,
    });
  } catch {
    return jsonResponse({ error: 'Failed to get call history' }, 500);
  }
}

// ─── POST /api/chat/call/voicemail ───────────────────────────────────────

export async function handleCallVoicemail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    callId: string;
    toUserId: string;
    conversationId: string;
    audioUrl: string;
    duration: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.callId || !body.toUserId || !body.conversationId || !body.audioUrl) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  try {
    const cm = await getCallManager();
    const voicemail = await cm.leaveVoicemail(
      env,
      body.callId,
      session.address,
      body.toUserId,
      body.conversationId,
      body.audioUrl,
      body.duration || 0,
    );

    return jsonResponse({ ok: true, voicemail }, 201);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to leave voicemail' },
      500,
    );
  }
}
