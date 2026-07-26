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

import { log } from '../logger';
import type { Env } from '../types';
import { getIPFSGatewayUrl, uploadBufferToIPFS } from './ipfs-storage';
import { deleteFromR2, getR2Object, uploadToR2 } from './r2-storage';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

export const FILE_PREFIX = 'chat:file:';
export const FILE_INDEX_PREFIX = 'chat:file:index:';
export const QUOTA_PREFIX = 'chat:file:quota:';
export const UPLOAD_TOKEN_PREFIX = 'chat:file:token:';

// ─── Types ────────────────────────────────────────────────────────────────

export type StorageTier = 'ipfs' | 'r2_standard' | 'r2_premium';

export type ChatFile = {}
