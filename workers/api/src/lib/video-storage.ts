/**
 * @degenfeed/api-worker — S3-Compatible Video Storage Service
 *
 * Offloads video storage from local disk to S3-compatible object storage:
 *   - Cloudflare R2 (via Worker binding or S3 API)
 *   - MinIO (self-hosted S3-compatible)
 *   - Any S3-compatible provider
 *
 * Integrates with Livepeer for transcoding pipeline:
 *   Upload → S3 → Livepeer transcode → Store variants in S3 → CDN delivery
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export type VideoVariant = {}
