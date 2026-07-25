/**
 * @degenfeed/api-worker — Cloudflare R2 Storage Integration
 *
 * Dedicated R2 video storage with:
 *   - Direct upload via R2 binding (primary) or presigned S3-compatible URLs
 *   - CDN URL generation through Cloudflare
 *   - Configurable lifecycle rules (auto-delete after N days per tier)
 *   - Metadata tracking in KV
 *
 * Integrates with the existing VideoStorageService for backward compatibility
 * but adds lifecycle management, presigned URL generation, and tier support.
 */

import type { Env } from '../index';
import { log } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export type StorageTier = 'standard' | 'premium' | 'archive' | 'temporary';

export interface R2UploadResult {
  /** Storage key (path within bucket) */
  key: string;
  /** CDN URL for playback */
  cdnUrl: string;
  /** Direct R2.dev URL (no CDN) */
  directUrl: string;
  /** File size in bytes */
  size: number;
  /** Content type */
  contentType: string;
  /** Storage tier applied */
  tier: StorageTier;
  /** When this object will be deleted (if lifecycle applies) */
  expiresAt: number | null;
  /** Whether the upload was successful */
  success: boolean;
}

export interface R2ObjectInfo {
  key: string;
  size: number;
  uploadedAt: number;
  contentType: string;
  tier: StorageTier;
  expiresAt: number | null;
  cdnUrl: string;
  metadata?: Record<string, string>;
}

export interface R2LifecycleRule {
  /** Prefix pattern to match (e.g. "videos/temporary/") */
  prefix: string;
  /** Delete after N days from upload */
  retentionDays: number;
  /** Label for the rule */
  label: string;
}

// ─── Lifecycle Rules ────────────────────────────────────────────────────
//
// These are the default lifecycle rules. They are enforced at read-time
// by the router and should also be mirrored as R2 lifecycle policies
// in the Cloudflare dashboard for server-side enforcement.
//
// To set server-side lifecycle rules via wrangler:
//   npx wrangler r2 bucket lifecycle add degenfeed-video-storage \
//     --prefix 'videos/temporary/' --age 7d
//

export const DEFAULT_LIFECYCLE_RULES: R2LifecycleRule[] = [
  { prefix: 'videos/temporary/', retentionDays: 7, label: 'Temp uploads (7d)' },
  { prefix: 'videos/livestream/', retentionDays: 30, label: 'Live stream VODs (30d)' },
  { prefix: 'videos/shorts/', retentionDays: 90, label: 'Short-form content (90d)' },
  { prefix: 'videos/longform/', retentionDays: 90, label: 'Long-form VODs (90d)' },
  { prefix: 'videos/premium/', retentionDays: 0, label: 'Premium (permanent)' },
  { prefix: 'videos/archive/', retentionDays: 0, label: 'Archive (permanent)' },
];

// ─── KV Key Prefix ─────────────────────────────────────────────────────

const KV_PREFIX = 'r2:object:';

// ─── CDN URL Generation ────────────────────────────────────────────────

/**
 * Generate a CDN URL for an R2 object.
 * Uses the custom domain if configured, otherwise falls back to R2.dev.
 */
export function getR2CDNUrl(env: Env, key: string): string {
  if (env.CDN_URL) {
    return `${env.CDN_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://video.degenfeed.xyz/storage/${key}`;
}

/**
 * Generate a direct R2.dev URL (bypasses CDN).
 */
export function getR2DirectUrl(key: string): string {
  return `https://pub-degenfeed-video-storage.r2.dev/${key}`;
}

// ─── Tier Helpers ──────────────────────────────────────────────────────

/**
 * Determine the storage tier from a key prefix.
 */
export function tierFromKey(key: string): StorageTier {
  if (key.startsWith('videos/premium/')) return 'premium';
  if (key.startsWith('videos/archive/')) return 'archive';
  if (key.startsWith('videos/temporary/')) return 'temporary';
  if (key.startsWith('videos/livestream/')) return 'standard';
  if (key.startsWith('videos/shorts/')) return 'standard';
  if (key.startsWith('videos/longform/')) return 'standard';
  return 'standard';
}

/**
 * Get the retention days for a given key based on lifecycle rules.
 * Returns 0 for permanent storage, or number of days.
 */
export function getRetentionDays(key: string): number {
  for (const rule of DEFAULT_LIFECYCLE_RULES) {
    if (key.startsWith(rule.prefix)) {
      return rule.retentionDays;
    }
  }
  return 90; // Default: 90 days
}

/**
 * Compute the expiration timestamp for a given key and upload time.
 */
export function computeExpiry(key: string, uploadedAt: number): number | null {
  const days = getRetentionDays(key);
  if (days <= 0) return null; // Never expires
  return uploadedAt + days * 86400 * 1000;
}

// ─── Upload ─────────────────────────────────────────────────────────────

/**
 * Upload a file to R2 using the Worker's R2 bucket binding.
 *
 * @param key - Storage key (e.g. "videos/longform/abc123.mp4")
 * @param body - File body as ArrayBuffer
 * @param contentType - MIME type
 * @param env - Worker env (must have VIDEO_STORAGE_BINDING)
 * @param metadata - Optional custom metadata
 * @param tier - Optional override storage tier (auto-detected from key)
 */
export async function uploadToR2(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  env: Env,
  metadata?: Record<string, string>,
  tier?: StorageTier,
): Promise<R2UploadResult> {
  const bucket = env.VIDEO_STORAGE_BINDING as R2Bucket | undefined;

  if (!bucket) {
    throw new Error('R2 not configured — set VIDEO_STORAGE_BINDING in wrangler.toml');
  }

  const resolvedTier = tier ?? tierFromKey(key);
  const now = Date.now();
  const expiresAt = computeExpiry(key, now);

  // Apply custom metadata with lifecycle hints
  const customMetadata: Record<string, string> = {
    'uploaded-at': String(now),
    'storage-tier': resolvedTier,
    ...(expiresAt ? { 'expires-at': String(expiresAt) } : {}),
    ...metadata,
  };

  await bucket.put(key, body, {
    httpMetadata: { contentType },
    customMetadata,
  });

  const result: R2UploadResult = {
    key,
    cdnUrl: getR2CDNUrl(env, key),
    directUrl: getR2DirectUrl(key),
    size: body.byteLength,
    contentType,
    tier: resolvedTier,
    expiresAt,
    success: true,
  };

  // Store metadata in KV
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    const info: R2ObjectInfo = {
      key,
      size: body.byteLength,
      uploadedAt: now,
      contentType,
      tier: resolvedTier,
      expiresAt,
      cdnUrl: result.cdnUrl,
      metadata: customMetadata,
    };
    await kv
      .put(`${KV_PREFIX}${key}`, JSON.stringify(info), {
        expirationTtl: expiresAt ? Math.ceil((expiresAt - now) / 1000) : undefined,
      })
      .catch((err: unknown) => log('warn', `[r2-storage] KV put failed: ${key}`, err));
  }

  return result;
}

// ─── Read / Access ──────────────────────────────────────────────────────

/**
 * Get metadata for a stored R2 object.
 */
export async function getR2Object(
  env: Env,
  key: string,
): Promise<{
  body: ReadableStream | null;
  size: number;
  contentType: string;
  etag: string;
} | null> {
  try {
    const r2 = env.R2_BUCKET as R2Bucket | undefined;
    if (!r2) return null;
    const obj = await r2.get(key);
    if (!obj) return null;
    return {
      body: obj.body,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
      etag: obj.etag,
    };
  } catch {
    return null;
  }
}

export async function getR2ObjectInfo(env: Env, key: string): Promise<R2ObjectInfo | null> {
  // Try KV first for fast metadata
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    try {
      const raw = await kv.get(`${KV_PREFIX}${key}`);
      if (raw) return JSON.parse(raw) as R2ObjectInfo;
    } catch {
      // Fall through to direct R2 lookup
    }
  }

  // Fall back to direct R2 head request
  const bucket = env.VIDEO_STORAGE_BINDING as R2Bucket | undefined;
  if (!bucket) return null;

  try {
    const head = await bucket.head(key);
    if (!head) return null;

    const uploadedAt = head.customMetadata?.['uploaded-at']
      ? Number(head.customMetadata['uploaded-at'])
      : Date.now();
    const tier = (head.customMetadata?.['storage-tier'] as StorageTier) ?? tierFromKey(key);
    const expiresAt = head.customMetadata?.['expires-at']
      ? Number(head.customMetadata['expires-at'])
      : computeExpiry(key, uploadedAt);

    return {
      key,
      size: head.size,
      uploadedAt,
      contentType: head.httpMetadata?.contentType ?? 'application/octet-stream',
      tier,
      expiresAt,
      cdnUrl: getR2CDNUrl(env, key),
      metadata: head.customMetadata ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Check if an R2 object exists and has not expired.
 */
export async function isR2ObjectValid(env: Env, key: string): Promise<boolean> {
  const info = await getR2ObjectInfo(env, key);
  if (!info) return false;
  if (info.expiresAt && info.expiresAt < Date.now()) return false;
  return true;
}

// ─── Delete ─────────────────────────────────────────────────────────────

/**
 * Delete an object from R2, including its KV metadata.
 */
export async function deleteFromR2(env: Env, key: string): Promise<boolean> {
  const bucket = env.VIDEO_STORAGE_BINDING as R2Bucket | undefined;
  if (!bucket) return false;

  try {
    await bucket.delete(key);
    // Clean up KV metadata
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.delete(`${KV_PREFIX}${key}`).catch(() => {});
    }
    return true;
  } catch (err) {
    log('warn', `[r2-storage] Delete failed: ${key}`, err);
    return false;
  }
}

// ─── Presigned URLs ─────────────────────────────────────────────────────

/**
 * Generate a presigned URL for temporary direct upload access.
 *
 * NOTE: R2 Workers bindings don't natively support presigned URLs.
 * This generates a signed URL using the S3-compatible API.
 * Falls back to CDN URL if presigning is unavailable.
 *
 * @param env - Worker env
 * @param key - Object key
 * @param expiresInSeconds - URL validity duration (default: 3600)
 */
export async function getPresignedUploadUrl(
  env: Env,
  key: string,
  expiresInSeconds = 3600,
): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  // If we have S3 credentials, generate a presigned URL
  if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_ENDPOINT) {
    try {
      const endpoint = env.S3_ENDPOINT.replace(/\/$/, '');
      const bucket = env.S3_BUCKET ?? 'degenfeed-videos';
      const _expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

      // Simple presigned URL for PUT
      const url = new URL(`${endpoint}/${bucket}/${key}`);
      url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));
      // In production, use a proper AWS SigV4 signing library
      // For now, return the unsigned PUT URL + headers
      return {
        uploadUrl: url.toString(),
        publicUrl: getR2CDNUrl(env, key),
      };
    } catch (err) {
      log('warn', `[r2-storage] Presigned URL generation failed`, err);
      return null;
    }
  }

  // Without S3 credentials, return the CDN URL (user uploads via worker)
  return {
    uploadUrl: `/api/video/upload?key=${encodeURIComponent(key)}`,
    publicUrl: getR2CDNUrl(env, key),
  };
}

// ─── List & Cleanup ────────────────────────────────────────────────────

/**
 * List objects in R2 with the given prefix.
 */
export async function listR2Objects(
  env: Env,
  prefix: string,
  limit = 100,
): Promise<R2ObjectInfo[]> {
  const bucket = env.VIDEO_STORAGE_BINDING as R2Bucket | undefined;
  if (!bucket) return [];

  try {
    const list = await bucket.list({ prefix, limit });
    return list.objects.map((obj: any) => ({
      key: obj.key,
      size: obj.size,
      uploadedAt: obj.uploadedAt ?? Date.now(),
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
      tier: tierFromKey(obj.key),
      expiresAt: computeExpiry(obj.key, obj.uploadedAt ?? Date.now()),
      cdnUrl: getR2CDNUrl(env, obj.key),
    }));
  } catch (err) {
    log('warn', `[r2-storage] List failed: ${prefix}`, err);
    return [];
  }
}

/**
 * Enforce lifecycle rules: delete expired objects.
 * Should be called from a cron trigger (e.g., daily).
 *
 * Returns summary of deletions.
 */
export async function enforceLifecycle(
  env: Env,
): Promise<{ deleted: number; freedBytes: number; errors: string[] }> {
  const result = { deleted: 0, freedBytes: 0, errors: [] as string[] };

  for (const rule of DEFAULT_LIFECYCLE_RULES) {
    if (rule.retentionDays <= 0) continue; // Skip permanent tiers

    const cutoff = Date.now() - rule.retentionDays * 86400 * 1000;
    const objects = await listR2Objects(env, rule.prefix, 1000);

    for (const obj of objects) {
      if (obj.uploadedAt < cutoff) {
        const ok = await deleteFromR2(env, obj.key);
        if (ok) {
          result.deleted++;
          result.freedBytes += obj.size;
        } else {
          result.errors.push(obj.key);
        }
      }
    }
  }

  return result;
}

// ─── Usage Stats ────────────────────────────────────────────────────────

export interface StorageUsage {
  /** Total bytes stored */
  totalBytes: number;
  /** Breakdown by tier */
  byTier: Record<StorageTier, number>;
  /** Breakdown by content type */
  byType: Record<string, number>;
  /** Number of objects */
  objectCount: number;
  /** Usage by creator wallet (if available) */
  byCreator?: Record<string, number>;
}

/**
 * Calculate storage usage across the R2 bucket.
 * Expensive operation — use sparingly or cache results.
 */
export async function getStorageUsage(env: Env, prefix = 'videos/'): Promise<StorageUsage> {
  const bucket = env.VIDEO_STORAGE_BINDING as R2Bucket | undefined;
  if (!bucket) {
    return { totalBytes: 0, byTier: {} as Record<StorageTier, number>, byType: {}, objectCount: 0 };
  }

  const usage: StorageUsage = {
    totalBytes: 0,
    byTier: { standard: 0, premium: 0, archive: 0, temporary: 0 },
    byType: {},
    objectCount: 0,
  };

  try {
    let cursor: string | undefined;
    do {
      const list = await bucket.list({ prefix, limit: 1000, cursor });
      for (const obj of list.objects) {
        usage.totalBytes += obj.size;
        usage.objectCount++;
        const tier = tierFromKey(obj.key);
        usage.byTier[tier] = (usage.byTier[tier] ?? 0) + obj.size;

        // Classify by type prefix
        const typePrefix = obj.key.split('/')[1] ?? 'unknown';
        usage.byType[typePrefix] = (usage.byType[typePrefix] ?? 0) + obj.size;
      }
      cursor = list.cursor;
    } while (cursor);

    return usage;
  } catch (err) {
    log('warn', `[r2-storage] Usage calculation failed`, err);
    return usage;
  }
}

// ─── R2Bucket Type (for internal use) ───────────────────────────────────

interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  head(key: string): Promise<{
    key: string;
    size: number;
    uploadedAt: Date;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  } | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: Array<{
      key: string;
      size: number;
      uploadedAt: Date;
      httpMetadata?: { contentType?: string };
    }>;
    cursor?: string;
  }>;
}
