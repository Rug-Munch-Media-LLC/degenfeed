/**
 * /api/messages/chat — Enhanced Chat Features Routes
 *
 * Routes for rich media, polls, reactions, timers, files, voice notes, stickers, GIFs.
 *
 * POST   /api/messages/react                  — Toggle reaction on a message
 * POST   /api/messages/edit                    — Edit a message
 * POST   /api/messages/unsend                  — Unsend message within 5s
 * POST   /api/messages/delete-for-me           — Delete for me
 * POST   /api/messages/mark-read/:messageId    — Mark message as read (for disappearing)
 * GET    /api/chat/timer/:conversationId       — Get conversation timer
 * POST   /api/chat/timer/:conversationId       — Set conversation timer
 * DELETE /api/chat/timer/:conversationId       — Remove conversation timer
 * POST   /api/chat/media/upload                — Upload chat media
 * GET    /api/chat/media/:mediaId              — Get media metadata
 * GET    /api/chat/media/list/:conversationId  — List media in conversation
 * POST   /api/chat/polls/create                — Create a poll
 * POST   /api/chat/polls/vote                  — Vote on a poll
 * GET    /api/chat/polls/:pollId               — Get poll results
 * GET    /api/chat/gifs/search                 — Search GIFs
 * POST   /api/chat/files/upload                — Upload a file
 * GET    /api/chat/files/:fileId               — Get file metadata
 * GET    /api/chat/files/download/:fileId      — Download file (with resume)
 * GET    /api/chat/files/list/:conversationId  — List files in conversation
 * DELETE /api/chat/files/:fileId               — Delete a file
 * GET    /api/chat/quota                       — Get storage quota
 * POST   /api/chat/link-preview                — Generate link preview
 * POST   /api/chat/stickers/create-pack        — Create sticker pack
 * GET    /api/chat/stickers/packs              — Get user's sticker packs
 * GET    /api/chat/stickers/pack/:packId       — Get sticker pack
 * POST   /api/chat/voice/upload                — Upload voice note
 */

import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Feature libraries ─────────────────────────────────────────────────────

let _chatMedia: typeof import('../lib/chat-media') | null = null;
let _chatTimers: typeof import('../lib/chat-timers') | null = null;
let _chatFiles: typeof import('../lib/chat-files') | null = null;

async function getChatMedia() {
  if (!_chatMedia) _chatMedia = await import('../lib/chat-media');
  return _chatMedia;
}

async function getChatTimers() {
  if (!_chatTimers) _chatTimers = await import('../lib/chat-timers');
  return _chatTimers;
}

async function getChatFiles() {
  if (!_chatFiles) _chatFiles = await import('../lib/chat-files');
  return _chatFiles;
}

// ═══════════════════════════════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/messages/react — Toggle reaction on a message.
 */
export async function handleToggleReaction(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { conversationId: string; messageId: string; emoji: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.messageId || !body.emoji) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // Store reaction in KV
  const reactionKey = `chat:reaction:${body.conversationId}:${body.messageId}:${body.emoji}`;
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return jsonResponse({ error: 'Storage unavailable' }, 503);

  try {
    const existing = await kv.get(reactionKey);
    const voters: string[] = existing ? JSON.parse(existing) : [];
    const idx = voters.indexOf(userId);

    if (idx >= 0) {
      voters.splice(idx, 1); // Remove reaction
      if (voters.length === 0) {
        await kv.delete(reactionKey);
      } else {
        await kv.put(reactionKey, JSON.stringify(voters), { expirationTtl: 86400 * 90 });
      }
      return noCacheJsonResponse({
        ok: true,
        reaction: body.emoji,
        active: false,
        count: voters.length,
      });
    } else {
      voters.push(userId); // Add reaction
      await kv.put(reactionKey, JSON.stringify(voters), { expirationTtl: 86400 * 90 });
      return noCacheJsonResponse({
        ok: true,
        reaction: body.emoji,
        active: true,
        count: voters.length,
      });
    }
  } catch (_err) {
    return jsonResponse({ error: 'Failed to toggle reaction' }, 500);
  }
}

/**
 * POST /api/messages/edit — Edit a sent message.
 */
export async function handleEditMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { conversationId: string; messageId: string; content: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.content?.trim()) {
    return jsonResponse({ error: 'Missing messageId or content' }, 400);
  }

  try {
    const { editMessage } = await getChatTimers();
    const meta = await editMessage(env, body.messageId, userId, body.content.trim());
    if (!meta) {
      return jsonResponse({ error: 'Message not found or not owned by you' }, 404);
    }
    return noCacheJsonResponse({ ok: true, edited: true, editedAt: meta.editedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Edit failed';
    return jsonResponse({ error: msg }, 400);
  }
}

/**
 * POST /api/messages/unsend — Unsend a message within 5 seconds.
 */
export async function handleUnsendMessage(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string; createdAt: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'Missing messageId or conversationId' }, 400);
  }

  try {
    const { unsendMessage } = await getChatTimers();
    const result = await unsendMessage(
      env,
      body.messageId,
      userId,
      body.conversationId,
      body.createdAt ?? Date.now(),
    );
    if (!result) {
      return jsonResponse({ error: 'Failed to unsend message' }, 500);
    }
    return noCacheJsonResponse({ ok: true, unsent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unsend failed';
    return jsonResponse({ error: msg }, 400);
  }
}

/**
 * POST /api/messages/delete-for-me — Delete a message for me only.
 */
export async function handleDeleteForMe(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'Missing messageId or conversationId' }, 400);
  }

  try {
    const { deleteForMe } = await getChatTimers();
    await deleteForMe(env, body.messageId, userId, body.conversationId);
    return noCacheJsonResponse({ ok: true });
  } catch (_err) {
    return jsonResponse({ error: 'Failed to delete message' }, 500);
  }
}

/**
 * POST /api/messages/mark-read/:messageId — Mark message as read (handles disappearing).
 */
export async function handleMarkMessageRead(
  request: Request,
  env: Env,
  messageId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { conversationId: string; timerSeconds?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const { handleDisappearingMessage } = await getChatTimers();
    if (body.timerSeconds) {
      await handleDisappearingMessage(
        env,
        messageId,
        body.conversationId,
        Date.now(),
        body.timerSeconds,
      );
    }
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to mark read' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION TIMERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/timer/:conversationId — Get conversation auto-delete timer.
 */
export async function handleGetTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getConversationTimer, getTimerDisplayLabel } = await getChatTimers();
    const timer = await getConversationTimer(env, conversationId);
    const label = await getTimerDisplayLabel(env, conversationId);
    return noCacheJsonResponse({ timer, label });
  } catch {
    return jsonResponse({ error: 'Failed to get timer' }, 500);
  }
}

/**
 * POST /api/chat/timer/:conversationId — Set conversation auto-delete timer.
 * Body: { durationSeconds: 60|300|3600|86400|604800|2592000 }
 */
export async function handleSetTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { durationSeconds: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const validDurations = [0, 5, 60, 300, 3600, 86400, 604800, 2592000];
  if (!validDurations.includes(body.durationSeconds)) {
    return jsonResponse(
      { error: 'Invalid duration. Valid: 0, 5, 60, 300, 3600, 86400, 604800, 2592000' },
      400,
    );
  }

  try {
    const { setConversationTimer, removeConversationTimer } = await getChatTimers();
    if (body.durationSeconds === 0) {
      await removeConversationTimer(env, conversationId);
      return noCacheJsonResponse({ ok: true, timer: null });
    }
    const timer = await setConversationTimer(env, conversationId, body.durationSeconds, userId);
    return noCacheJsonResponse({ ok: true, timer });
  } catch {
    return jsonResponse({ error: 'Failed to set timer' }, 500);
  }
}

/**
 * DELETE /api/chat/timer/:conversationId — Remove timer.
 */
export async function handleRemoveTimer(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { removeConversationTimer } = await getChatTimers();
    await removeConversationTimer(env, conversationId);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to remove timer' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA UPLOAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/media/upload — Upload media to chat.
 */
export async function handleUploadMedia(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return jsonResponse({ error: 'File and conversationId required' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const { uploadChatMedia } = await getChatMedia();
    const { validateMediaSize } = await getChatMedia();

    const validation = validateMediaSize(buffer.byteLength, file.type, false);
    if (!validation.allowed) {
      return jsonResponse({ error: validation.reason }, 413);
    }

    const media = await uploadChatMedia(buffer, file.name, file.type, conversationId, userId, env);

    return noCacheJsonResponse({ ok: true, media });
  } catch (err) {
    log('error', '[chat-features] media upload failed', err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Media upload failed',
      },
      500,
    );
  }
}

/**
 * GET /api/chat/media/:mediaId — Get media metadata.
 */
export async function handleGetMedia(
  _request: Request,
  env: Env,
  mediaId: string,
): Promise<Response> {
  try {
    const { getMedia } = await getChatMedia();
    const media = await getMedia(env, mediaId);
    if (!media) return jsonResponse({ error: 'Media not found' }, 404);
    return noCacheJsonResponse({ media });
  } catch {
    return jsonResponse({ error: 'Failed to get media' }, 500);
  }
}

/**
 * GET /api/chat/media/list/:conversationId — List media in conversation.
 */
export async function handleListMedia(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const type = url.searchParams.get('type') as any;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  try {
    const { getConversationMedia } = await getChatMedia();
    const media = await getConversationMedia(env, conversationId, { type, limit });
    return noCacheJsonResponse({ media, count: media.length });
  } catch {
    return jsonResponse({ error: 'Failed to list media' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/polls/create — Create a poll.
 */
export async function handleCreatePoll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: {
    conversationId: string;
    question: string;
    options: string[];
    multipleChoice?: boolean;
    endsAt?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.question || !body.options || body.options.length < 2) {
    return jsonResponse({ error: 'question and at least 2 options required' }, 400);
  }

  try {
    const { createPoll } = await getChatMedia();
    const endsInMinutes = body.endsAt ? Math.ceil((body.endsAt - Date.now()) / 60000) : undefined;
    const poll = await createPoll(
      env,
      body.conversationId,
      userId,
      body.question,
      body.options,
      body.multipleChoice ?? false,
      endsInMinutes,
    );
    return noCacheJsonResponse({ ok: true, poll });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Poll creation failed' },
      400,
    );
  }
}

/**
 * POST /api/chat/polls/vote — Vote on a poll.
 */
export async function handleVotePoll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { pollId: string; optionIds: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.pollId || !body.optionIds?.length) {
    return jsonResponse({ error: 'pollId and optionIds required' }, 400);
  }

  try {
    const { votePoll } = await getChatMedia();
    const poll = await votePoll(env, body.pollId, userId, body.optionIds);
    if (!poll) return jsonResponse({ error: 'Poll not found' }, 404);
    return noCacheJsonResponse({ ok: true, poll });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Vote failed' }, 400);
  }
}

/**
 * GET /api/chat/polls/:pollId — Get poll.
 */
export async function handleGetPoll(
  _request: Request,
  env: Env,
  pollId: string,
): Promise<Response> {
  try {
    const { getPoll } = await getChatMedia();
    const poll = await getPoll(env, pollId);
    if (!poll) return jsonResponse({ error: 'Poll not found' }, 404);
    return noCacheJsonResponse({ poll });
  } catch {
    return jsonResponse({ error: 'Failed to get poll' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GIFs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/gifs/search — Search GIFs.
 */
export async function handleSearchGifs(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const provider = url.searchParams.get('provider') as 'tenor' | 'giphy' | null;

  if (!query?.trim()) {
    return jsonResponse({ error: 'Search query required' }, 400);
  }

  try {
    const { searchGifs } = await getChatMedia();
    const results = await searchGifs(env, query, { limit, provider: provider ?? undefined });
    return noCacheJsonResponse({ results });
  } catch {
    return jsonResponse({ error: 'GIF search failed' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LINK PREVIEWS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/link-preview — Generate link preview.
 */
export async function handleLinkPreview(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { url: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.url?.trim()) {
    return jsonResponse({ error: 'URL required' }, 400);
  }

  try {
    const { generateLinkPreview } = await getChatMedia();
    const preview = await generateLinkPreview(body.url, env);
    if (!preview) return jsonResponse({ error: 'Could not generate preview' }, 422);
    return noCacheJsonResponse({ preview });
  } catch {
    return jsonResponse({ error: 'Link preview failed' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/files/upload — Upload a file.
 */
export async function handleUploadFile(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return jsonResponse({ error: 'File and conversationId required' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const { uploadChatFile } = await getChatFiles();
    const chatFile = await uploadChatFile(
      buffer,
      file.name,
      file.type,
      conversationId,
      userId,
      env,
    );

    return noCacheJsonResponse({ ok: true, file: chatFile });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'File upload failed',
      },
      err instanceof Error && err.message.includes('quota') ? 413 : 500,
    );
  }
}

/**
 * GET /api/chat/files/:fileId — Get file metadata.
 */
export async function handleGetFile(
  _request: Request,
  env: Env,
  fileId: string,
): Promise<Response> {
  try {
    const { getFile } = await getChatFiles();
    const file = await getFile(env, fileId);
    if (!file) return jsonResponse({ error: 'File not found' }, 404);
    return noCacheJsonResponse({ file });
  } catch {
    return jsonResponse({ error: 'Failed to get file' }, 500);
  }
}

/**
 * GET /api/chat/files/download/:fileId — Stream file download (with resume).
 */
export async function handleDownloadFile(
  request: Request,
  env: Env,
  fileId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { streamFileDownload } = await getChatFiles();
    const response = await streamFileDownload(
      env,
      fileId,
      request.headers.get('range') ?? undefined,
    );
    if (!response) return jsonResponse({ error: 'File not found' }, 404);
    return response;
  } catch {
    return jsonResponse({ error: 'Download failed' }, 500);
  }
}

/**
 * GET /api/chat/files/list/:conversationId — List files in conversation.
 */
export async function handleListFiles(
  request: Request,
  env: Env,
  conversationId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const category = url.searchParams.get('category') as any;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  try {
    const { getConversationFiles } = await getChatFiles();
    const files = await getConversationFiles(env, conversationId, { category, limit });
    return noCacheJsonResponse({ files, count: files.length });
  } catch {
    return jsonResponse({ error: 'Failed to list files' }, 500);
  }
}

/**
 * DELETE /api/chat/files/:fileId — Delete a file.
 */
export async function handleDeleteFile(
  request: Request,
  env: Env,
  fileId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { deleteChatFile } = await getChatFiles();
    const result = await deleteChatFile(env, fileId, userId);
    if (!result) return jsonResponse({ error: 'File not found or not owned by you' }, 404);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to delete file' }, 500);
  }
}

/**
 * GET /api/chat/quota — Get storage quota for current user.
 */
export async function handleGetQuota(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { getStorageQuota } = await getChatFiles();
    const quota = await getStorageQuota(env, userId);
    return noCacheJsonResponse({ quota });
  } catch {
    return jsonResponse({ error: 'Failed to get quota' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STICKERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/chat/stickers/create-pack — Create a sticker pack.
 */
export async function handleCreateStickerPack(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const formData = await request.formData();
    const name = formData.get('name') as string | null;
    const stickerFiles = formData.getAll('stickers') as File[];

    if (!name || !stickerFiles.length) {
      return jsonResponse({ error: 'Name and at least one sticker required' }, 400);
    }

    const { createStickerPack } = await getChatMedia();
    const stickers = await Promise.all(
      stickerFiles.map(async (f) => ({
        buffer: await f.arrayBuffer(),
        mimeType: f.type,
        emoji: undefined as string | undefined,
      })),
    );

    const pack = await createStickerPack(env, name, userId, stickers);
    return noCacheJsonResponse({ ok: true, pack });
  } catch {
    return jsonResponse({ error: 'Failed to create sticker pack' }, 500);
  }
}

/**
 * GET /api/chat/stickers/packs — Get user's sticker packs.
 */
export async function handleGetStickerPacks(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { getUserStickerPacks } = await getChatMedia();
    const packs = await getUserStickerPacks(env, userId);
    return noCacheJsonResponse({ packs });
  } catch {
    return jsonResponse({ error: 'Failed to get sticker packs' }, 500);
  }
}

/**
 * GET /api/chat/stickers/pack/:packId — Get sticker pack.
 */
export async function handleGetStickerPack(
  _request: Request,
  env: Env,
  packId: string,
): Promise<Response> {
  try {
    const { getStickerPack } = await getChatMedia();
    const pack = await getStickerPack(env, packId);
    if (!pack) return jsonResponse({ error: 'Sticker pack not found' }, 404);
    return noCacheJsonResponse({ pack });
  } catch {
    return jsonResponse({ error: 'Failed to get sticker pack' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE NOTES
// ═══════════════════════════════════════════════════════════════════════════

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

    // Store via video-storage-router as audio content
    const { storeVideo } = await import('../lib/video-storage-router');
    const storageResult = await storeVideo(buffer, audioFile.name, audioFile.type, duration, env, {
      creatorWallet: userId,
      title: `Voice note - ${new Date().toISOString()}`,
      explicitType: 'podcast',
    });

    // Index for search
    const { indexMessageForSearch } = await import('./chat-search');

    // Store voice note metadata
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
          url: storageResult.primaryUrl,
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
      url: storageResult.primaryUrl,
      duration,
    });
  } catch (err) {
    log('error', '[chat-features] voice upload failed', err);
    return jsonResponse({ error: 'Voice upload failed' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA CLEANUP CRON
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run cleanup of expired messages and files.
 * Called by cron every minute.
 */
export async function handleCleanupCron(
  env: Env,
): Promise<{ cleanedMessages: number; cleanedFiles: number }> {
  const { cleanupExpiredMessages } = await getChatTimers();
  const { cleanupExpiredFiles } = await getChatFiles();

  const [cleanedMessages, cleanedFiles] = await Promise.all([
    cleanupExpiredMessages(env),
    cleanupExpiredFiles(env),
  ]);

  return { cleanedMessages, cleanedFiles };
}

// ═══════════════════════════════════════════════════════════════════════════
// DELIVERY STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/messages/delivery/status — Get delivery status for one or more messages.
 */
export async function handleDeliveryStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { conversationId: string; messageIds: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.messageIds?.length) {
    return jsonResponse({ error: 'conversationId and messageIds required' }, 400);
  }

  try {
    const { getConversationDeliveryStatus } = await import('../lib/message-delivery');
    const statuses = await getConversationDeliveryStatus(env, body.conversationId, body.messageIds);
    return noCacheJsonResponse({ statuses });
  } catch {
    return jsonResponse({ error: 'Failed to get delivery status' }, 500);
  }
}

/**
 * POST /api/messages/delivery/read — Mark a message as read.
 */
export async function handleMarkRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'messageId and conversationId required' }, 400);
  }

  try {
    const { markMessageRead, notifyDeliveryWebhook, getDeliveryRecord } = await import(
      '../lib/message-delivery'
    );
    const record = await markMessageRead(env, body.messageId, userId);
    if (record) {
      await notifyDeliveryWebhook(env, record);
    }
    return noCacheJsonResponse({ ok: true, status: record?.status ?? 'unknown' });
  } catch {
    return jsonResponse({ error: 'Failed to mark as read' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

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
    const { registerDevice } = await import('../lib/message-delivery');
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
    const { getUserDevices } = await import('../lib/message-delivery');
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
    const { removeDevice } = await import('../lib/message-delivery');
    await removeDevice(env, deviceId);
    return noCacheJsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to remove device' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE TIER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/chat/quota/tiered — Get tiered storage quota.
 */
export async function handleGetTieredQuota(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { getTieredStorageQuota } = await import('../lib/chat-files-enhanced');
    const quota = await getTieredStorageQuota(env, userId);
    return noCacheJsonResponse({ quota });
  } catch {
    return jsonResponse({ error: 'Failed to get quota' }, 500);
  }
}

/**
 * GET /api/chat/files/downloads/:fileId — Get download history for a file.
 */
export async function handleGetDownloadHistory(
  _request: Request,
  env: Env,
  fileId: string,
): Promise<Response> {
  try {
    const { getDownloadHistory, getDownloadCount } = await import('../lib/chat-files-enhanced');
    const [history, count] = await Promise.all([
      getDownloadHistory(env, fileId),
      getDownloadCount(env, fileId),
    ]);
    return noCacheJsonResponse({
      downloads: history.map((d) => ({
        downloadedBy: d.downloadedBy,
        downloadedAt: d.downloadedAt,
        bytesTransferred: d.bytesTransferred,
      })),
      totalDownloads: count,
    });
  } catch {
    return jsonResponse({ error: 'Failed to get download history' }, 500);
  }
}
