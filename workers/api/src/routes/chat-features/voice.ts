/**
 * @degenfeed/api-worker — Chat Voice Notes
 */

import { log } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

/**
 * POST /api/messages/voice/upload — Upload a recorded voice note.
 */
export async function handleUploadVoiceNote(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const duration = parseFloat((formData.get('duration') as string) || '0');
    const waveformStr = formData.get('waveform') as string | null;
    const transcript = formData.get('transcript') as string | null;

    if (!audioFile || !conversationId) {
      return jsonResponse({ error: 'Audio file and conversationId required' }, 400);
    }

    const buffer = await audioFile.arrayBuffer();

    const { storeVideo } = await import('../../lib/video-storage-router');
    const storageResult = await storeVideo(env, {
      contentId: `voice-${conversationId}-${Date.now()}`,
      buffer,
      duration,
      fileSize: audioFile.size,
      format: audioFile.type,
      isTemporary: true,
    });

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      const voiceKey = `chat:voice:${conversationId}:${storageResult.contentId}`;
      const waveform = waveformStr ? JSON.parse(waveformStr) : [];
      await kv.put(
        voiceKey,
        JSON.stringify({
          contentId: storageResult.contentId,
          conversationId,
          senderId: userId,
          duration,
          waveform,
          url: storageResult.url,
          transcript: transcript ?? null,
          played: false,
          createdAt: Date.now(),
        }),
        { expirationTtl: 86400 * 90 },
      );
    }

    return noCacheJsonResponse({
      ok: true,
      mediaId: storageResult.contentId,
      url: storageResult.url,
      duration,
    });
  } catch (err) {
    log('error', '[chat-features] voice upload failed', err);
    return jsonResponse({ error: 'Voice upload failed' }, 500);
  }
}
