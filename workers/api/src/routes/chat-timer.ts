/**
 * /api/chat/timer — Self-Destruct Timer Routes
 *
 * Routes:
 *   PUT  /api/chat/:id/timer           — Set self-destruct timer
 *   GET  /api/chat/:id/timer           — Get current timer setting
 *   DELETE /api/chat/:id/timer         — Disable timer
 *   POST /api/chat/:id/view-once       — Mark media as view-once
 *   POST /api/chat/media/viewed        — Mark view-once media as viewed
 *   GET  /api/chat/:id/timer-display   — Get timer display string for header
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';

let _selfDestruct: typeof import('@degenfeed/chat-super-app').SelfDestructManager | null = null;
async function getSelfDestruct() {
  if (!_selfDestruct) {
    const mod = await import('@degenfeed/chat-super-app');
    _selfDestruct = mod.getSelfDestructManager();
  }
  return _selfDestruct!;
}

const VALID_DURATIONS = [0, 5, 30, 60, 300, 3600, 86400, 604800, 2592000];

// ─── PUT /api/chat/:id/timer ─────────────────────────────────────────────

export async function handleSetTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { duration: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (body.duration === undefined || !VALID_DURATIONS.includes(body.duration)) {
    return jsonResponse({
      error: 'Invalid duration. Valid values: 0 (off), 5, 30, 60, 300, 3600, 86400, 604800, 2592000',
    }, 400);
  }

  try {
    const sd = await getSelfDestruct();
    const timer = await sd.setTimer(env, conversationId, body.duration as any, session.address);
    const display = sd.getTimerDisplay(timer.duration as any);

    return jsonResponse({
      ok: true,
      timer: {
        enabled: timer.enabled,
        duration: timer.duration,
        display,
        setBy: timer.setBy,
        setAt: timer.setAt,
      },
    }, 200);
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to set timer',
    }, 500);
  }
}

// ─── GET /api/chat/:id/timer ─────────────────────────────────────────────

export async function handleGetTimer(
  _request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  try {
    const sd = await getSelfDestruct();
    const timer = await sd.getTimer(env, conversationId);

    if (!timer) {
      return noCacheJsonResponse({
        ok: true,
        timer: {
          enabled: false,
          duration: 0,
          display: null,
        },
      });
    }

    const display = sd.getTimerDisplay(timer.duration as any);

    return noCacheJsonResponse({
      ok: true,
      timer: {
        enabled: timer.enabled,
        duration: timer.duration,
        display,
        setBy: timer.setBy,
        setAt: timer.setAt,
      },
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to get timer',
    }, 500);
  }
}

// ─── DELETE /api/chat/:id/timer ──────────────────────────────────────────

export async function handleDisableTimer(
  _request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  try {
    const sd = await getSelfDestruct();
    await sd.disableTimer(env, conversationId);

    return jsonResponse({
      ok: true,
      timer: { enabled: false, duration: 0, display: null },
    }, 200);
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to disable timer',
    }, 500);
  }
}

// ─── GET /api/chat/:id/timer-display ─────────────────────────────────────

export async function handleTimerDisplay(
  _request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  try {
    const sd = await getSelfDestruct();
    const timer = await sd.getTimer(env, conversationId);
    const display = timer ? sd.getTimerDisplay(timer.duration as any) : null;

    return noCacheJsonResponse({
      ok: true,
      display,
      enabled: timer?.enabled || false,
      duration: timer?.duration || 0,
    });
  } catch (err) {
    return jsonResponse({ error: 'Failed to get timer display' }, 500);
  }
}

// ─── POST /api/chat/:id/view-once — Mark a message as view-once ─────────

export async function handleViewOnce(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { messageId: string; mediaUrl: string; mediaType: 'image' | 'video'; duration?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.mediaUrl) {
    return jsonResponse({ error: 'Missing messageId or mediaUrl' }, 400);
  }

  try {
    const sd = await getSelfDestruct();
    const timer = await sd.getTimer(env, conversationId);
    const duration = body.duration || timer?.duration || 30; // Default 30s view-once

    const media = await sd.registerViewOnce(
      env,
      body.messageId,
      body.messageId,
      conversationId,
      body.mediaUrl,
      body.mediaType || 'image',
      duration as any,
    );

    return jsonResponse({
      ok: true,
      viewOnce: {
        mediaId: media.mediaId,
        type: media.type,
        expiresAt: media.expiresAt,
      },
    }, 201);
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to create view-once media',
    }, 500);
  }
}

// ─── POST /api/chat/media/viewed — Mark view-once media as viewed ────────

export async function handleMediaViewed(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { mediaId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.mediaId) {
    return jsonResponse({ error: 'Missing mediaId' }, 400);
  }

  try {
    const sd = await getSelfDestruct();
    const media = await sd.markViewOnceViewed(env, body.mediaId);

    return jsonResponse({
      ok: true,
      viewed: media?.viewed || false,
      mediaId: body.mediaId,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Failed to mark viewed',
    }, 500);
  }
}

// ─── POST /api/chat/screenshot — Report a screenshot ─────────────────────

export async function handleScreenshotDetected(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { conversationId: string; messageId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.messageId) {
    return jsonResponse({ error: 'Missing conversationId or messageId' }, 400);
  }

  try {
    const sd = await getSelfDestruct();
    await sd.reportScreenshot(env, body.conversationId, body.messageId, session.address);

    return jsonResponse({ ok: true, detected: true }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Failed to report screenshot' }, 500);
  }
}
