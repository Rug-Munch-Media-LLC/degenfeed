/**
 * @degenfeed/api-worker — Multi-Device Sync for Chat
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

/**
 * POST /api/messages/devices/register — Register a device for multi-device sync.
 */
export async function handleRegisterDevice(request: Request, env: Env): Promise<Response> {
