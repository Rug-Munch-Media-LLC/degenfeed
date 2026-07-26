/**
 * @degenfeed/api-worker — Multi-Device Sync for Chat
 */

import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { requireSession } from '../../session';

/**
 * POST /api/messages/devices/register — Register a device for multi-device sync.
 */
export async function handleRegisterDevice(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: {
    deviceId: string;
    name: string;
    type: 'web' | 'mobile' | 'desktop' | 'api';
    pushToken?: string;
    devicePublicKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.deviceId || !body.name) {
    return jsonResponse({ error: 'deviceId and name required' }, 400);
  }

  try {
    const { registerDevice } = await import('../../lib/message-delivery');
    const device = await registerDevice(env, userId, {
      deviceId: body.deviceId,
      name: body.name,
      type: body.type || 'web',
      lastSeenAt: Date.now(),
      online: true,
      pushToken: body.pushToken,
      devicePublicKey: body.devicePublicKey,
    });
    return noCacheJsonResponse({ ok: true, device });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Registration failed' }, 500);
  }
}

/**
 * GET /api/messages/devices — Get all devices for current user.
 */
export async function handleGetDevices(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { getUserDevices } = await import('../../lib/message-delivery');
    const devices = await getUserDevices(env, userId);
    return noCacheJsonResponse({ devices });
  } catch {
    return jsonResponse({ error: 'Failed to get devices' }, 500);
  }
}

/**
 * DELETE /api/messages/devices/:deviceId — Remove a device.
 */
export async function handleRemoveDevice(
  _request: Request,
  env: Env,
  deviceId: string,
): Promise<Response> {
  const session = await requireSession(_request, env);
  if (session instanceof Response) return session;

  try {
    const { removeDevice } = await import('../../lib/message-delivery');
    await removeDevice(env, deviceId);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to remove device' }, 500);
  }
}
