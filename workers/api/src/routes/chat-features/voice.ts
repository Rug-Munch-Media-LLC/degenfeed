/**
 * @degenfeed/api-worker — Chat Voice Notes
 */

import { log } from '../../logger';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

/**
 * POST /api/messages/voice/upload — Upload a recorded voice note.
 */
export async function handleUploadVoiceNote(request: Request, env: Env): Promise<Response> {
