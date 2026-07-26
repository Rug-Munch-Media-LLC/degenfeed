/**
 * @degenfeed/api-worker — Creator Storage API
 *
 * GET /api/creator/storage — Returns storage usage for the authenticated creator.
 *
 * Integrates with the video-storage-router and image-storage to provide:
 *   - Total storage used (bytes + human-readable)
 *   - Breakdown by backend (IPFS, R2, Arweave)
 *   - Breakdown by content type (shorts, VODs, images, podcasts, etc.)
 *   - Decentralized media status (IPFS permanent, CDN-backed)
 *   - Expiring content warnings
 *   - Current plan tier
 */

import { getCreatorImageStats } from '../lib/image-storage';
import type { CreatorStorageUsage } from '../lib/video-storage-router';
import { getCreatorStorageUsage } from '../lib/video-storage-router';
import { log } from '../logger';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const CF_IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs';

/**
 * GET /api/creator/storage
 *
 * Returns storage usage statistics for the authenticated creator,
 * including decentralized media storage dashboard data.
 * Falls back to empty stats if storage is not configured.
 */
export async function handleCreatorStorage(request: Request, env: Env): Promise<Response> {
