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

import { log } from '../index';
import { getCreatorImageStats } from '../lib/image-storage';
import type { CreatorStorageUsage } from '../lib/video-storage-router';
import { getCreatorStorageUsage } from '../lib/video-storage-router';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const CF_IPFS_GATEWAY = 'https://ipfs.degenfeed.xyz/ipfs';

/**
 * GET /api/creator/storage
 *
 * Returns storage usage statistics for the authenticated creator,
 * including decentralized media storage dashboard data.
 * Falls back to empty stats if storage is not configured.
 */
export async function handleCreatorStorage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address?.toLowerCase();
  if (!wallet) {
    return jsonResponse({ error: 'No wallet address in session' }, 400);
  }

  // Check if storage router is configured
  const isR2Configured = !!env.VIDEO_STORAGE_BINDING;
  const isIPFSConfigured = !!env.PINATA_API_KEY || !!env.WEB3_STORAGE_API_KEY;
  const isArweaveConfigured = false; // Arweave requires funded Irys node
  const isMediaStorageConfigured = isIPFSConfigured;

  try {
    const usage = await getCreatorStorageUsage(env, wallet);
    const imageStats = await getCreatorImageStats(env, wallet);

    // Merge image stats into the response
    const decentralizedMedia = {
      totalImages: imageStats.totalImages,
      totalBytes: imageStats.totalBytes,
      totalReadable: imageStats.totalReadable,
      backend: 'IPFS (decentralized, permanent)',
      cdn: 'Served via Cloudflare CDN, cached globally',
      cdnUrl: CF_IPFS_GATEWAY,
      gatewayUrls: [
        'https://ipfs.degenfeed.xyz/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://dweb.link/ipfs/',
      ],
      exifStripped: true, // All uploaded images have EXIF stripped for privacy
      makePermanentAvailable: false, // Requires ARWEAVE_WALLET or IRYS_NODE_URL env var
      makePermanentCostEstimate: '~$0.01/MB (one-time fee)',
      makePermanentHowTo:
        'Set ARWEAVE_WALLET env var or deploy an Irys node to enable Arweave permanence',
      images: imageStats.images.map((img) => ({
        cid: img.cid,
        url: `${CF_IPFS_GATEWAY}/${img.cid}`,
        fileName: img.metadata.fileName,
        width: img.metadata.width,
        height: img.metadata.height,
        size: img.metadata.processedSize,
        sizeReadable: formatBytes(img.metadata.processedSize),
        source: img.metadata.source,
        uploadedAt: img.metadata.uploadedAt,
        exifStripped: img.metadata.exifStripped,
        isAnimated: img.metadata.isAnimated,
        variants: {
          thumbnail: `https://ipfs.degenfeed.xyz/cdn-cgi/image/width=150,format=webp,quality=80/ipfs/${img.cid}`,
          medium: `https://ipfs.degenfeed.xyz/cdn-cgi/image/width=600,format=webp,quality=85/ipfs/${img.cid}`,
          full: `https://ipfs.degenfeed.xyz/cdn-cgi/image/width=2048,format=webp,quality=90/ipfs/${img.cid}`,
        },
      })),
    };

    return noCacheJsonResponse({
      ...usage,
      decentralizedMedia,
      configured: {
        r2: isR2Configured,
        ipfs: isIPFSConfigured,
        arweave: isArweaveConfigured,
        mediaStorage: isMediaStorageConfigured,
      },
      storageNotice:
        'Your media is stored on IPFS (decentralized, permanent). Served via Cloudflare CDN, cached globally.',
    });
  } catch (err) {
    log('warn', `[creator-storage] Failed to get storage usage for ${wallet}`, err);

    // Return empty stats on error (don't break the dashboard)
    const fallback: CreatorStorageUsage & {
      configured: Record<string, boolean>;
      decentralizedMedia?: Record<string, unknown>;
      storageNotice?: string;
    } = {
      totalBytes: 0,
      totalReadable: '0 B',
      freeLimit: 5 * 1_073_741_824,
      usagePercent: 0,
      byBackend: {
        ipfs: { bytes: 0, readable: '0 B', count: 0 },
        r2: { bytes: 0, readable: '0 B', count: 0 },
        arweave: { bytes: 0, readable: '0 B', count: 0 },
      },
      byType: {},
      plan: 'free',
      expiringSoon: [],
      configured: {
        r2: isR2Configured,
        ipfs: isIPFSConfigured,
        arweave: isArweaveConfigured,
        mediaStorage: isMediaStorageConfigured,
      },
      storageNotice:
        'Your media is stored on IPFS (decentralized, permanent). Served via Cloudflare CDN, cached globally.',
    };

    return noCacheJsonResponse(fallback);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}
