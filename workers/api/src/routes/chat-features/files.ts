/**
 * @degenfeed/api-worker — Chat File Upload, Download, Quota
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

let _chatFiles: typeof import('../../lib/chat-files') | null = null;
let _enhanced: typeof import('../../lib/chat-files-enhanced') | null = null;

async function getChatFiles() {
  if (!_chatFiles) _chatFiles = await import('../../lib/chat-files');
  return _chatFiles;
}

async function getEnhanced() {
  if (!_enhanced) _enhanced = await import('../../lib/chat-files-enhanced');
  return _enhanced;
}

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
      { error: err instanceof Error ? err.message : 'File upload failed' },
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

/**
 * GET /api/chat/quota/tiered — Get tiered storage quota.
 */
export async function handleGetTieredQuota(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  try {
    const { getTieredStorageQuota } = await getEnhanced();
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
    const { getDownloadHistory, getDownloadCount } = await getEnhanced();
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
