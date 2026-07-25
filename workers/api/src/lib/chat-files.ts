/**
 * @degenfeed/api-worker — File Storage & Transfer for Chat
 *
 * Telegram/WhatsApp-style file handling:
 *   - Upload to IPFS (small files, free)
 *   - Upload to R2 (large files, cheap)
 *   - Generate preview (image thumbnails, video thumbnails, file icons)
 *   - Progress tracking during upload
 *   - Download with resume support (Range headers)
 *   - File expiry: auto-delete after X days
 *   - Storage quota per user (tracked and enforced)
 *
 * Integrates with existing:
 *   - r2-storage.ts (R2 upload/download)
 *   - ipfs-storage.ts (IPFS via Pinata/web3.storage)
 *   - video-storage-router.ts (smart routing)
 */

import type { Env } from '../index';
import { log } from '../index';
import { uploadToR2, getR2Object, deleteFromR2 } from './r2-storage';
import { uploadBufferToIPFS, getIPFSGatewayUrl } from './ipfs-storage';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const FILE_PREFIX = 'chat:file:';
const FILE_INDEX_PREFIX = 'chat:file:index:';
const QUOTA_PREFIX = 'chat:file:quota:';
const UPLOAD_TOKEN_PREFIX = 'chat:file:token:';

// ─── Types ────────────────────────────────────────────────────────────────

export type StorageTier = 'ipfs' | 'r2_standard' | 'r2_premium';

export interface ChatFile {
  /** Unique file ID */
  id: string;
  /** Conversation ID */
  conversationId: string;
  /** Sender wallet address */
  senderId: string;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** Storage backend */
  storage: StorageTier;
  /** Primary download URL */
  url: string;
  /** CDN URL (for R2 storage) */
  cdnUrl?: string;
  /** Direct URL (for resume downloads) */
  directUrl?: string;
  /** IPFS CID (if stored on IPFS) */
  ipfsCid?: string;
  /** R2 key (if stored on R2) */
  r2Key?: string;
  /** Preview/thumbnail URL */
  previewUrl?: string;
  /** Thumbnail for video files */
  thumbnailUrl?: string;
  /** File icon for unsupported preview types */
  fileIcon?: string;
  /** Upload timestamp */
  uploadedAt: number;
  /** Expiration timestamp */
  expiresAt: number | null;
  /** Whether file is for premium users only */
  premium: boolean;
  /** MIME category for display */
  category: FileCategory;
  /** Download count (for analytics) */
  downloadCount: number;
  /** Last accessed timestamp */
  lastAccessedAt: number;
}

export type FileCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'archive'
  | 'code'
  | 'other';

/** File type icons for unsupported previews */
export const FILE_ICONS: Record<FileCategory, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  document: '📄',
  archive: '📦',
  code: '💻',
  other: '📁',
};

export interface StorageQuota {
  /** User's wallet address */
  userId: string;
  /** Total bytes used */
  totalBytes: number;
  /** Free tier limit (100MB) */
  freeLimit: number;
  /** Premium tier limit (2GB) */
  premiumLimit: number;
  /** Whether user is premium */
  isPremium: boolean;
  /** Human-readable usage */
  totalReadable: string;
  /** Percentage of limit used */
  usagePercent: number;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface UploadProgress {
  /** Upload token for progress tracking */
  token: string;
  /** File ID */
  fileId: string;
  /** Total bytes */
  totalBytes: number;
  /** Bytes uploaded so far */
  uploadedBytes: number;
  /** Percentage (0-100) */
  percent: number;
  /** Current phase */
  phase: 'uploading' | 'processing' | 'complete' | 'error';
  /** Error message if failed */
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'chat/files/';
const DEFAULT_FILE_EXPIRY_DAYS = 30; // Free tier
const PREMIUM_FILE_EXPIRY_DAYS = 365; // Premium tier
const MAX_FILE_SIZE_FREE = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE_PREMIUM = 2 * 1024 * 1024 * 1024; // 2GB
const FREE_TIER_BYTES = 100 * 1024 * 1024; // 100MB quota
const PREMIUM_TIER_BYTES = 10 * 1024 * 1024 * 1024; // 10GB quota
const UPLOAD_TOKEN_TTL = 3600; // 1 hour

// ─── File ID Generation ───────────────────────────────────────────────────

function generateFileId(): string {
  return `file_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function generateUploadToken(): string {
  return `up_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

// ─── Category Detection ───────────────────────────────────────────────────

/**
 * Determine file category from MIME type or extension.
 */
export function getFileCategory(mimeType: string, fileName?: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';

  const ext = fileName?.toLowerCase().split('.').pop() ?? '';

  const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'md'];
  const archiveExts = ['zip', 'tar', 'gz', 'bz2', '7z', 'rar'];
  const codeExts = ['js', 'ts', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'sol', 'css', 'html', 'json', 'yaml', 'xml'];

  if (documentExts.includes(ext)) return 'document';
  if (archiveExts.includes(ext)) return 'archive';
  if (codeExts.includes(ext)) return 'code';

  return 'other';
}

// ─── Upload ───────────────────────────────────────────────────────────────

/**
 * Upload a file for chat sharing.
 *
 * Small files (<10MB): IPFS (free, decentralized)
 * Large files: R2 ($0.015/GB/month)
 * Premium files: R2 with longer retention
 */
export async function uploadChatFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  conversationId: string,
  senderId: string,
  env: Env,
  options?: {
    isPremium?: boolean;
    expiryDays?: number;
    thumbnailBuffer?: ArrayBuffer;
  },
): Promise<ChatFile> {
  const fileId = generateFileId();
  const size = buffer.byteLength;
  const category = getFileCategory(mimeType, fileName);
  const isPremium = options?.isPremium ?? false;
  const expiryDays = options?.expiryDays ?? (isPremium ? PREMIUM_FILE_EXPIRY_DAYS : DEFAULT_FILE_EXPIRY_DAYS);

  // Validate file size
  const maxSize = isPremium ? MAX_FILE_SIZE_PREMIUM : MAX_FILE_SIZE_FREE;
  if (size > maxSize) {
    throw new Error(
      `File too large (${formatSize(size)}). ` +
      `Maximum: ${isPremium ? '2GB' : '100MB'}. ` +
      `${isPremium ? '' : 'Upgrade to premium for 2GB uploads.'}`,
    );
  }

  // Check storage quota
  const quota = await getStorageQuota(env, senderId);
  const quotaLimit = isPremium ? PREMIUM_TIER_BYTES : FREE_TIER_BYTES;
  if (quota.totalBytes + size > quotaLimit) {
    throw new Error(
      `Storage quota exceeded (${formatSize(quota.totalBytes)} / ${formatSize(quotaLimit)}). ` +
      `Free up space or upgrade to premium for more storage.`,
    );
  }

  const file: ChatFile = {
    id: fileId,
    conversationId,
    senderId: senderId.toLowerCase(),
    fileName: fileName.slice(0, 255),
    size,
    mimeType,
    storage: 'r2_standard',
    url: '',
    uploadedAt: Date.now(),
    expiresAt: expiryDays > 0 ? Date.now() + expiryDays * 86400 * 1000 : null,
    premium: isPremium,
    category,
    downloadCount: 0,
    lastAccessedAt: Date.now(),
  };

  try {
    // Route to appropriate storage
    if (size < 10 * 1024 * 1024 && !isPremium) {
      // Small files: IPFS
      const ipfsResult = await uploadBufferToIPFS(buffer, fileName, mimeType, env);
      if (ipfsResult.cid) {
        file.url = ipfsResult.gatewayUrl;
        file.ipfsCid = ipfsResult.cid;
        file.storage = 'ipfs';
      } else {
        throw new Error('IPFS upload failed');
      }
    } else {
      // Large/premium files: R2
      const ext = fileName.includes('.')
        ? fileName.substring(fileName.lastIndexOf('.'))
        : '.bin';
      const storageKey = `${STORAGE_KEY_PREFIX}${conversationId}/${fileId}${ext}`;

      const r2Result = await uploadToR2(
        storageKey,
        buffer,
        mimeType,
        env,
        {
          'file-id': fileId,
          conversation: conversationId,
          sender: senderId,
          'file-name': fileName,
        },
        isPremium ? 'premium' : 'standard',
      );

      file.url = r2Result.cdnUrl;
      file.cdnUrl = r2Result.cdnUrl;
      file.directUrl = r2Result.directUrl;
      file.r2Key = r2Result.key;
      file.storage = isPremium ? 'r2_premium' : 'r2_standard';
    }

    // Generate preview/thumbnail
    if ((category === 'image' || category === 'video') && options?.thumbnailBuffer) {
      const thumbKey = `${STORAGE_KEY_PREFIX}${conversationId}/${fileId}_thumb.jpg`;
      const thumbResult = await uploadToR2(
        thumbKey,
        options.thumbnailBuffer,
        'image/jpeg',
        env,
        { 'file-id': fileId, type: 'thumbnail' },
      );
      file.thumbnailUrl = thumbResult.cdnUrl;
    }

    // File icon for non-previewable types
    if (category !== 'image' && category !== 'video') {
      file.fileIcon = FILE_ICONS[category];
    }
  } catch (err) {
    log('error', `[chat-files] upload failed: ${fileName}`, err);
    throw new Error(`File upload failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  // Store metadata in KV
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const ttl = file.expiresAt
      ? Math.ceil((file.expiresAt - Date.now()) / 1000) + 86400
      : 86400 * 365;

    await kv.put(`${FILE_PREFIX}${fileId}`, JSON.stringify(file), {
      expirationTtl: Math.max(3600, ttl),
    }).catch(() => {});

    // Index by conversation
    const indexKey = `${FILE_INDEX_PREFIX}${conversationId}`;
    const existingRaw = await kv.get(indexKey).catch(() => null);
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(fileId);
    await kv.put(indexKey, JSON.stringify(existing.slice(-500)), {
      expirationTtl: 86400 * 90,
    }).catch(() => {});

    // Update quota
    await updateStorageQuota(env, senderId, size);
  }

  return file;
}

// ─── Download ─────────────────────────────────────────────────────────────

/**
 * Get a download URL for a file, with optional range support for resume.
 */
export async function getFileDownloadUrl(
  env: Env,
  fileId: string,
  options?: { range?: { start: number; end: number } },
): Promise<{ url: string; file: ChatFile } | null> {
  const file = await getFile(env, fileId);
  if (!file) return null;

  // Update access tracking
  file.downloadCount++;
  file.lastAccessedAt = Date.now();
  await saveFile(env, file);

  // For IPFS files, return gateway URL directly
  if (file.storage === 'ipfs' && file.ipfsCid) {
    return { url: getIPFSGatewayUrl(file.ipfsCid), file };
  }

  // For R2 files, use the direct URL for Range header support
  const url = options?.range && file.directUrl
    ? file.directUrl
    : file.url;

  return { url, file };
}

/**
 * Stream a file download with Range header support (resume).
 */
export async function streamFileDownload(
  env: Env,
  fileId: string,
  rangeHeader?: string,
): Promise<Response | null> {
  const file = await getFile(env, fileId);
  if (!file || !file.r2Key) return null;

  try {
    // Get the R2 object
    const object = await getR2Object(env, file.r2Key);
    if (!object) return null;

    const size = object.size;
    const headers = new Headers({
      'content-type': file.mimeType,
      'content-disposition': `inline; filename="${file.fileName}"`,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=31536000, immutable',
    });

    // Handle Range header for resume support
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0]!, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

      if (start >= size || end >= size) {
        return new Response(null, {
          status: 416,
          headers: { 'content-range': `bytes */${size}` },
        });
      }

      headers.set('content-range', `bytes ${start}-${end}/${size}`);
      headers.set('content-length', String(end - start + 1));

      const stream = object.body?.slice(start, end + 1);
      return new Response(stream, {
        status: 206,
        headers,
      });
    }

    // Full file
    headers.set('content-length', String(size));
    return new Response(object.body, { headers });
  } catch (err) {
    log('error', `[chat-files] stream failed: ${fileId}`, err);
    return null;
  }
}

// ─── File Retrieval ───────────────────────────────────────────────────────

/**
 * Get file metadata by ID.
 */
export async function getFile(env: Env, fileId: string): Promise<ChatFile | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${FILE_PREFIX}${fileId}`);
    return raw ? (JSON.parse(raw) as ChatFile) : null;
  } catch {
    return null;
  }
}

async function saveFile(env: Env, file: ChatFile): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;
  await kv.put(`${FILE_PREFIX}${file.id}`, JSON.stringify(file), {
    expirationTtl: file.expiresAt
      ? Math.ceil((file.expiresAt - Date.now()) / 1000) + 86400
      : 86400 * 365,
  }).catch(() => {});
}

/**
 * Get all files in a conversation.
 */
export async function getConversationFiles(
  env: Env,
  conversationId: string,
  options?: {
    category?: FileCategory;
    limit?: number;
    before?: number;
  },
): Promise<ChatFile[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const indexRaw = await kv.get(`${FILE_INDEX_PREFIX}${conversationId}`);
    if (!indexRaw) return [];

    const fileIds: string[] = JSON.parse(indexRaw);
    const results: ChatFile[] = [];

    for (const id of fileIds) {
      const file = await getFile(env, id);
      if (!file) continue;
      if (options?.category && file.category !== options.category) continue;
      if (options?.before && file.uploadedAt >= options.before) continue;
      results.push(file);
    }

    results.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return results.slice(0, options?.limit ?? 50);
  } catch {
    return [];
  }
}

// ─── Storage Quota ────────────────────────────────────────────────────────

/**
 * Get storage quota for a user.
 */
export async function getStorageQuota(env: Env, userId: string): Promise<StorageQuota> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  const defaultQuota: StorageQuota = {
    userId: userId.toLowerCase(),
    totalBytes: 0,
    freeLimit: FREE_TIER_BYTES,
    premiumLimit: PREMIUM_TIER_BYTES,
    isPremium: false,
    totalReadable: '0 B',
    usagePercent: 0,
    updatedAt: Date.now(),
  };

  if (!kv) return defaultQuota;

  try {
    const raw = await kv.get(`${QUOTA_PREFIX}${userId.toLowerCase()}`);
    if (!raw) return defaultQuota;

    const quota = JSON.parse(raw) as StorageQuota;
    quota.usagePercent = Math.min(100, Math.round((quota.totalBytes / (quota.isPremium ? PREMIUM_TIER_BYTES : FREE_TIER_BYTES)) * 100));
    quota.totalReadable = formatSize(quota.totalBytes);
    return quota;
  } catch {
    return defaultQuota;
  }
}

async function updateStorageQuota(env: Env, userId: string, bytesAdded: number): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const quota = await getStorageQuota(env, userId);
    quota.totalBytes += bytesAdded;
    quota.totalReadable = formatSize(quota.totalBytes);
    quota.usagePercent = Math.min(100, Math.round((quota.totalBytes / (quota.isPremium ? PREMIUM_TIER_BYTES : FREE_TIER_BYTES)) * 100));
    quota.updatedAt = Date.now();

    await kv.put(`${QUOTA_PREFIX}${userId.toLowerCase()}`, JSON.stringify(quota), {
      expirationTtl: 86400 * 365,
    }).catch(() => {});
  } catch {
    // Non-critical
  }
}

/**
 * Delete a file and free up storage quota.
 */
export async function deleteChatFile(env: Env, fileId: string, userId: string): Promise<boolean> {
  const file = await getFile(env, fileId);
  if (!file) return false;

  // Only sender can delete
  if (file.senderId.toLowerCase() !== userId.toLowerCase()) {
    return false;
  }

  // Delete from storage
  if (file.r2Key) {
    await deleteFromR2(env, file.r2Key).catch(() => {});
  }

  // Remove from KV
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.delete(`${FILE_PREFIX}${fileId}`).catch(() => {});

    // Update quota (subtract file size)
    try {
      const quota = await getStorageQuota(env, userId);
      quota.totalBytes = Math.max(0, quota.totalBytes - file.size);
      quota.totalReadable = formatSize(quota.totalBytes);
      quota.updatedAt = Date.now();
      await kv.put(`${QUOTA_PREFIX}${userId.toLowerCase()}`, JSON.stringify(quota), {
        expirationTtl: 86400 * 365,
      }).catch(() => {});
    } catch {
      // Non-critical
    }
  }

  return true;
}

// ─── Upload Progress Tracking ────────────────────────────────────────────

/**
 * Create an upload progress tracker.
 */
export async function createUploadProgress(
  env: Env,
  fileId: string,
  totalBytes: number,
): Promise<UploadProgress> {
  const token = generateUploadToken();
  const progress: UploadProgress = {
    token,
    fileId,
    totalBytes,
    uploadedBytes: 0,
    percent: 0,
    phase: 'uploading',
  };

  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${UPLOAD_TOKEN_PREFIX}${token}`, JSON.stringify(progress), {
      expirationTtl: UPLOAD_TOKEN_TTL,
    }).catch(() => {});
  }

  return progress;
}

/**
 * Update upload progress.
 */
export async function updateUploadProgress(
  env: Env,
  token: string,
  uploadedBytes: number,
  phase?: UploadProgress['phase'],
  error?: string,
): Promise<UploadProgress | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const raw = await kv.get(`${UPLOAD_TOKEN_PREFIX}${token}`);
    if (!raw) return null;

    const progress = JSON.parse(raw) as UploadProgress;
    progress.uploadedBytes = uploadedBytes;
    progress.percent = Math.min(100, Math.round((uploadedBytes / progress.totalBytes) * 100));
    if (phase) progress.phase = phase;
    if (error) progress.error = error;

    await kv.put(`${UPLOAD_TOKEN_PREFIX}${token}`, JSON.stringify(progress), {
      expirationTtl: UPLOAD_TOKEN_TTL,
    }).catch(() => {});

    return progress;
  } catch {
    return null;
  }
}

/**
 * Get upload progress by token.
 */
export async function getUploadProgress(env: Env, token: string): Promise<UploadProgress | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${UPLOAD_TOKEN_PREFIX}${token}`);
    return raw ? (JSON.parse(raw) as UploadProgress) : null;
  } catch {
    return null;
  }
}

// ─── Cleanup Expired Files ───────────────────────────────────────────────

/**
 * Clean up expired files.
 * Called by the cron job.
 */
export async function cleanupExpiredFiles(env: Env): Promise<number> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return 0;

  let cleaned = 0;
  const now = Date.now();

  try {
    const list = await kv.list({ prefix: FILE_PREFIX, limit: 1000 });

    for (const key of list.keys) {
      try {
        const raw = await kv.get(key.name);
        if (!raw) continue;

        const file = JSON.parse(raw) as ChatFile;

        // Skip non-expiring files
        if (!file.expiresAt) continue;

        // If expired, delete
        if (now >= file.expiresAt) {
          // Delete from R2
          if (file.r2Key) {
            await deleteFromR2(env, file.r2Key).catch(() => {});
          }

          // Delete metadata
          await kv.delete(key.name).catch(() => {});
          cleaned++;
        }
      } catch {
        continue;
      }
    }
  } catch (err) {
    log('error', '[chat-files] cleanup expired failed', err);
  }

  if (cleaned > 0) {
    log('info', `[chat-files] cleaned ${cleaned} expired files`);
  }

  return cleaned;
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Format bytes to human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get the file extension from a filename.
 */
export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

/**
 * Check if a file type is previewable in-browser.
 */
export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain' ||
    mimeType.startsWith('text/')
  );
}
