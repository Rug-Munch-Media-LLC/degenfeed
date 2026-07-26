/**
 * @degenfeed/api-worker — Enhanced File Sharing (replaces chat-files.ts)
 *
 * Tiered file sharing with:
 *   - Any file type: images, videos, documents, code, archives
 *   - Size limits: Free 100MB, Pro 500MB, Creator 2GB, Enterprise 10GB
 *   - IPFS for small files (free), R2 for large (cheap)
 *   - Image/video thumbnails, document previews
 *   - Auto-delete after configurable expiry (X days)
 *   - Download tracking: who downloaded your file
 *
 * Extends the existing chat-files.ts system with tier support
 * and download tracking.
 */

import type { Env } from '../types';
import { log } from '../types';
import { FILE_INDEX_PREFIX, FILE_PREFIX, getFileCategory, QUOTA_PREFIX } from './chat-files';
import { uploadBufferToIPFS } from './ipfs-storage';
import { uploadToR2 } from './r2-storage';

// ─── Types ────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'creator' | 'enterprise';

export interface TieredFileLimits {
  maxFileSize: number; // bytes
  totalQuota: number; // bytes
  retentionDays: number; // auto-delete after days
  uploadSpeed: string; // priority tier
  previewGeneration: boolean;
  downloadTracking: boolean;
}

export const TIER_LIMITS: Record<UserTier, TieredFileLimits> = {
  free: {
    maxFileSize: 100 * 1024 * 1024, // 100 MB
    totalQuota: 500 * 1024 * 1024, // 500 MB
    retentionDays: 30, // 30 days
    uploadSpeed: 'standard',
    previewGeneration: true,
    downloadTracking: false,
  },
  pro: {
    maxFileSize: 500 * 1024 * 1024, // 500 MB
    totalQuota: 10 * 1024 * 1024 * 1024, // 10 GB
    retentionDays: 90, // 90 days
    uploadSpeed: 'high',
    previewGeneration: true,
    downloadTracking: true,
  },
  creator: {
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2 GB
    totalQuota: 50 * 1024 * 1024 * 1024, // 50 GB
    retentionDays: 365, // 1 year
    uploadSpeed: 'priority',
    previewGeneration: true,
    downloadTracking: true,
  },
  enterprise: {
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10 GB
    totalQuota: 500 * 1024 * 1024 * 1024, // 500 GB
    retentionDays: 0, // Never expires
    uploadSpeed: 'dedicated',
    previewGeneration: true,
    downloadTracking: true,
  },
};

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const DOWNLOAD_TRACKER_PREFIX = 'chat:file:dl:';
const TIER_PREFIX = 'chat:tier:';
const FILE_EXPIRY_PREFIX = 'chat:file:expiry:';
const _PREVIEW_PREFIX = 'chat:preview:';

// ─── Tier Helpers ─────────────────────────────────────────────────────────

/**
 * Get the user's storage tier (default: free).
 */
export async function getUserTier(env: Env, userId: string): Promise<UserTier> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return 'free';

  try {
    const raw = await kv.get(`${TIER_PREFIX}${userId.toLowerCase()}`);
    if (!raw) return 'free';

    const data = JSON.parse(raw) as { tier: UserTier };
    return TIER_LIMITS[data.tier] ? data.tier : 'free';
  } catch {
    return 'free';
  }
}

/**
 * Set or upgrade a user's storage tier.
 */
export async function setUserTier(env: Env, userId: string, tier: UserTier): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  if (!TIER_LIMITS[tier]) {
    throw new Error(`Invalid tier: ${tier}. Valid: free, pro, creator, enterprise`);
  }

  await kv.put(`${TIER_PREFIX}${userId.toLowerCase()}`, JSON.stringify({ tier }), {
    expirationTtl: 86400 * 365,
  });
}

/**
 * Get the file size limit for a user's tier.
 */
export async function getMaxFileSize(env: Env, userId: string): Promise<number> {
  const tier = await getUserTier(env, userId);
  return TIER_LIMITS[tier].maxFileSize;
}

/**
 * Get storage quota for a user based on tier.
 */
export async function getTieredStorageQuota(
  env: Env,
  userId: string,
): Promise<{
  tier: UserTier;
  used: number;
  limit: number;
  available: number;
  percentUsed: number;
  retentionDays: number;
}> {
  const tier = await getUserTier(env, userId);
  const limits = TIER_LIMITS[tier];
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;

  let used = 0;
  if (kv) {
    try {
      const raw = await kv.get(`${QUOTA_PREFIX}${userId.toLowerCase()}`);
      if (raw) {
        const quota = JSON.parse(raw);
        used = quota.totalBytes ?? 0;
      }
    } catch {}
  }

  return {
    tier,
    used,
    limit: limits.totalQuota,
    available: Math.max(0, limits.totalQuota - used),
    percentUsed: limits.totalQuota > 0 ? Math.round((used / limits.totalQuota) * 100) : 0,
    retentionDays: limits.retentionDays,
  };
}

// ─── File Expiry ──────────────────────────────────────────────────────────

/**
 * Set file expiry (overrides tier default).
 */
export async function setFileExpiry(env: Env, fileId: string, expiryDays: number): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const expiresAt = expiryDays > 0 ? Date.now() + expiryDays * 86400 * 1000 : null;
  await kv.put(`${FILE_EXPIRY_PREFIX}${fileId}`, JSON.stringify({ expiresAt, expiryDays }), {
    expirationTtl: expiryDays > 0 ? expiryDays * 86400 + 86400 : 86400 * 365,
  });
}

/**
 * Get file expiry.
 */
export async function getFileExpiry(
  env: Env,
  fileId: string,
): Promise<{ expiresAt: number | null; expiryDays: number } | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  try {
    const raw = await kv.get(`${FILE_EXPIRY_PREFIX}${fileId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Download Tracking ────────────────────────────────────────────────────

export interface DownloadRecord {
  fileId: string;
  downloadedBy: string;
  downloadedAt: number;
  ipAddress?: string;
  userAgent?: string;
  bytesTransferred: number;
}

/**
 * Track a file download (who downloaded your file).
 */
export async function trackDownload(
  env: Env,
  fileId: string,
  downloadedBy: string,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    bytesTransferred?: number;
  },
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  const record: DownloadRecord = {
    fileId,
    downloadedBy: downloadedBy.toLowerCase(),
    downloadedAt: Date.now(),
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    bytesTransferred: options?.bytesTransferred ?? 0,
  };

  const key = `${DOWNLOAD_TRACKER_PREFIX}${fileId}`;
  const raw = await kv.get(key).catch(() => null);
  const records: DownloadRecord[] = raw ? JSON.parse(raw) : [];
  records.push(record);

  // Keep last 100 download records per file
  await kv.put(key, JSON.stringify(records.slice(-100)), {
    expirationTtl: 86400 * 365,
  });
}

/**
 * Get download history for a file.
 */
export async function getDownloadHistory(env: Env, fileId: string): Promise<DownloadRecord[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const raw = await kv.get(`${DOWNLOAD_TRACKER_PREFIX}${fileId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get download count for a file.
 */
export async function getDownloadCount(env: Env, fileId: string): Promise<number> {
  const history = await getDownloadHistory(env, fileId);
  return history.length;
}

// ─── Enhanced Upload (tier-aware) ────────────────────────────────────────

export interface EnhancedFileUploadOptions {
  fileName: string;
  mimeType: string;
  conversationId: string;
  senderId: string;
  /** Override expiry (defaults to tier setting) */
  expiryDays?: number;
  /** Thumbnail/preview buffer */
  thumbnailBuffer?: ArrayBuffer;
  /** Generate preview image for documents */
  generatePreview?: boolean;
}

/**
 * Upload file with tier-aware enforcement.
 * Uses IPFS for small files, R2 for large.
 */
export async function uploadTieredFile(
  buffer: ArrayBuffer,
  options: EnhancedFileUploadOptions,
  env: Env,
): Promise<{
  fileId: string;
  url: string;
  previewUrl?: string;
  storage: 'ipfs' | 'r2';
  expiresAt: number | null;
}> {
  const fileId = `file_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const size = buffer.byteLength;
  const senderId = options.senderId.toLowerCase();

  // Check tier limits
  const tier = await getUserTier(env, senderId);
  const limits = TIER_LIMITS[tier];

  if (size > limits.maxFileSize) {
    const _tierNames: Record<UserTier, string> = {
      free: 'Free (100MB)',
      pro: 'Pro (500MB)',
      creator: 'Creator (2GB)',
      enterprise: 'Enterprise (10GB)',
    };
    throw new Error(
      `File too large (${formatSize(size)}). ` +
        `Your ${tier} tier limit is ${formatSize(limits.maxFileSize)}. ` +
        `Upgrade to ${getNextTier(tier)} for larger uploads.`,
    );
  }

  // Check quota
  const quota = await getTieredStorageQuota(env, senderId);
  if (size > quota.available) {
    throw new Error(
      `Storage quota exceeded (${formatSize(quota.used)} / ${formatSize(quota.limit)}). ` +
        `Free up space or upgrade to increase your limit.`,
    );
  }

  // Determine retention
  const retentionMs = (options.expiryDays ?? limits.retentionDays) * 86400 * 1000;
  const expiresAt = retentionMs > 0 ? Date.now() + retentionMs : null;

  const ext = options.fileName.includes('.')
    ? options.fileName.substring(options.fileName.lastIndexOf('.'))
    : '.bin';
  const storageKey = `chat/files/${options.conversationId}/${fileId}${ext}`;

  let url: string;
  let storage: 'ipfs' | 'r2';
  let previewUrl: string | undefined;

  try {
    // Small files → IPFS (free, decentralized)
    // Large files → R2 ($0.015/GB/month, cheap for large)
    if (size < 10 * 1024 * 1024 && tier === 'free') {
      const ipfsResult = await uploadBufferToIPFS(buffer, options.fileName, options.mimeType, env);
      if (!ipfsResult.cid) throw new Error('IPFS upload failed');
      url = ipfsResult.gatewayUrl;
      storage = 'ipfs';
    } else {
      const r2Result = await uploadToR2(storageKey, buffer, options.mimeType, env, {
        'file-id': fileId,
        conversation: options.conversationId,
        sender: senderId,
        tier,
        'file-name': options.fileName,
      });
      url = r2Result.cdnUrl;
      storage = 'r2';
    }

    // Generate preview/thumbnail
    if (limits.previewGeneration && options.thumbnailBuffer) {
      const thumbKey = `${storageKey}_thumb.jpg`;
      const thumbResult = await uploadToR2(thumbKey, options.thumbnailBuffer, 'image/jpeg', env, {
        'file-id': fileId,
        type: 'thumbnail',
      });
      previewUrl = thumbResult.cdnUrl;
    }
  } catch (err) {
    log('error', `[chat-files-enhanced] upload failed: ${options.fileName}`, err);
    throw new Error(`File upload failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Store metadata (leveraging existing chat-files system)
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const fileData = {
      id: fileId,
      conversationId: options.conversationId,
      senderId,
      fileName: options.fileName.slice(0, 255),
      size,
      mimeType: options.mimeType,
      storage: storage === 'ipfs' ? 'ipfs' : `r2_${tier}`,
      url,
      previewUrl,
      category: getFileCategory(options.mimeType, options.fileName),
      uploadedAt: Date.now(),
      expiresAt,
      tier,
      downloadCount: 0,
      lastAccessedAt: Date.now(),
    };

    await kv
      .put(`${FILE_PREFIX}${fileId}`, JSON.stringify(fileData), {
        expirationTtl: expiresAt ? Math.ceil((expiresAt - Date.now()) / 1000) + 86400 : 86400 * 365,
      })
      .catch(() => {});

    // Index by conversation
    const indexKey = `${FILE_INDEX_PREFIX}${options.conversationId}`;
    const existingRaw = await kv.get(indexKey).catch(() => null);
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(fileId);
    await kv
      .put(indexKey, JSON.stringify(existing.slice(-500)), {
        expirationTtl: 86400 * 90,
      })
      .catch(() => {});

    // Update quota
    updateQuota(env, senderId, size, tier).catch(() => {});
  }

  return { fileId, url, previewUrl, storage, expiresAt };
}

async function updateQuota(
  env: Env,
  userId: string,
  bytesAdded: number,
  _tier: UserTier,
): Promise<void> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return;

  try {
    const raw = await kv.get(`${QUOTA_PREFIX}${userId}`);
    const quota = raw ? JSON.parse(raw) : { totalBytes: 0 };
    quota.totalBytes = (quota.totalBytes ?? 0) + bytesAdded;
    quota.totalReadable = formatSize(quota.totalBytes);
    quota.updatedAt = Date.now();

    await kv
      .put(`${QUOTA_PREFIX}${userId}`, JSON.stringify(quota), {
        expirationTtl: 86400 * 365,
      })
      .catch(() => {});
  } catch {}
}

// ─── Helper ───────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getNextTier(current: UserTier): string {
  const order: UserTier[] = ['free', 'pro', 'creator', 'enterprise'];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : 'enterprise';
}
