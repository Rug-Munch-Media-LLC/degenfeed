/**
 * @degenfeed/api-worker — Decentralized Image Storage Pipeline
 *
 * Upload flow: User uploads image → validate → optimize (resize, compress, WebP)
 * → strip EXIF → store on IPFS → return CDN-backed IPFS URLs
 *
 * Generates three variants per upload:
 *   - thumbnail (150px) — for feed/card previews
 *   - medium (600px) — for post detail / gallery
 *   - full (original, WebP) — for full-resolution viewing
 *
 * All variants are auto-converted to WebP for web delivery.
 * Original format is preserved in IPFS as a fallback.
 * EXIF metadata is stripped from all variants for privacy.
 *
 * Served via Cloudflare IPFS gateway for CDN acceleration.
 */

import { log } from '../logger';
import type { Env } from '../types';
import type { IPFSUploadResult } from './ipfs-storage';
import { uploadToIPFS } from './ipfs-storage';

// ─── Constants ──────────────────────────────────────────────────────────

/** Maximum upload size: 20MB — sufficient for high-res photos */
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/** Allowed MIME types for image upload */
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

/** Image size presets generated for each upload */
export const IMAGE_SIZES = {
