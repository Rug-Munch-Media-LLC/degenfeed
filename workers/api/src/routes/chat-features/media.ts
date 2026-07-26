/**
 * @degenfeed/api-worker — Chat Media, GIFs, Link Previews, Stickers
 */

import { log } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

let _chatMedia: typeof import('../../lib/chat-media') | null = null;

async function getChatMedia() {
  if (!_chatMedia) _chatMedia = await import('../../lib/chat-media');
  return _chatMedia;
}

// ─── Media Upload ──────────────────────────────────────────────────────────

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
    const { uploadChatMedia, validateMediaSize } = await getChatMedia();
    const validation = validateMediaSize(buffer.byteLength, file.type, false);
    if (!validation.allowed) {
      return jsonResponse({ error: validation.reason }, 413);
    }

    const media = await uploadChatMedia(buffer, file.name, file.type, conversationId, userId, env);
    return noCacheJsonResponse({ ok: true, media });
  } catch (err) {
    log('error', '[chat-features] media upload failed', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Media upload failed' }, 500);
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

// ─── GIFs ──────────────────────────────────────────────────────────────────

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
    const results = await searchGifs(query, env, { limit, provider: provider ?? undefined });
    return noCacheJsonResponse({ results });
  } catch {
    return jsonResponse({ error: 'GIF search failed' }, 500);
  }
}

// ─── Link Previews ─────────────────────────────────────────────────────────

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

// ─── Stickers ──────────────────────────────────────────────────────────────

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
