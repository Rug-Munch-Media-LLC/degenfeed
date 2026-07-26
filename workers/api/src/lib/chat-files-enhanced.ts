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

import { log } from '../logger';
import type { Env } from '../types';
import { FILE_INDEX_PREFIX, FILE_PREFIX, getFileCategory, QUOTA_PREFIX } from './chat-files';
import { uploadBufferToIPFS } from './ipfs-storage';
import { uploadToR2 } from './r2-storage';

// ─── Types ────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'creator' | 'enterprise';

export type TieredFileLimits = {}
