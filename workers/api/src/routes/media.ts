/**
 * @degenfeed/api-worker — Media Storage Route Handlers
 *
 * POST   /api/media/upload/image        — Upload image (multipart)
 * POST   /api/media/upload              — Generic media upload
 * GET    /api/media/image/:cid          — Get image (with size and format params)
 * GET    /api/media/image/:cid/metadata — Image metadata
 * GET    /api/media/gateway/:type/:id   — Unified media gateway
 * GET    /api/media/health              — Media service health check
 * POST   /api/media/make-permanent      — Make media permanent on Arweave
 *
 * All uploads are stored on IPFS first. Optional Arweave permanence.
 * All URLs are CDN-backed via Cloudflare IPFS gateway.
 */

import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import {
  checkImageServiceHealth,
  getCreatorImageStats,
  getDefaultImageUrl,
  getImageMetadataByCid,
  getOptimizedImageUrl,
  type ImageSizeName,
  linkImageToCreator,
  uploadImageToIPFS,
  validateImage,
} from '../lib/image-storage';
import { uploadBufferToIPFS } from '../lib/ipfs-storage';
import { buildMediaResponse, fetchMedia, type GatewayBackend } from '../lib/media-gateway';
import { requireSession } from '../session';

// ─── Constants ──────────────────────────────────────────────────────────

const VALID_IMAGE_SIZES: ImageSizeName[] = ['thumbnail', 'medium', 'full'];
const VALID_IMAGE_FORMATS = ['webp', 'avif', 'jpeg', 'png', 'original'];

// ─── POST /api/media/upload/image ─────────────────────────────────────

/**
 * Handle image upload via multipart/form-data.
 *
 * Flow:
 *   1. Validate session
 *   2. Parse multipart form data
 *   3. Validate image type and size
 *   4. Process image (EXIF strip, dimension parse)
 *   5. Upload processed image + metadata JSON to IPFS
 *   6. Store creator link in KV
 *   7. Return image URLs for all sizes
 */
export async function handleImageUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed — use POST' }, 405);
  }

  // Require authentication
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address?.toLowerCase();

  try {
    // Parse multipart form
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Content-Type must be multipart/form-data' }, 400);
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return jsonResponse({ error: 'No image file provided. Use form field "image"' }, 400);
    }

    // Optional: custom source label
    const source = (formData.get('source') as string) ?? undefined;

    // Validate the image
    const validation = validateImage(file);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Upload to IPFS with processing
    const fileName = file.name.replace(/\.[^/.]+$/, '') || `image-${Date.now()}`;
    const result = await uploadImageToIPFS(env, buffer, fileName, file.type, {
      uploadedBy: wallet,
      source,
    });

    // Link image to creator for dashboard
    if (wallet) {
      await linkImageToCreator(env, result.cid, wallet);
    }

    log('info', `[media] Image uploaded: ${result.cid} by ${wallet}`, {
      width: result.metadata.width,
      height: result.metadata.height,
      size: result.metadata.processedSize,
    });

    return jsonResponse(
      {
        success: true,
        cid: result.cid,
        url: result.url,
        sizes: result.sizes,
        metadata: {
          width: result.metadata.width,
          height: result.metadata.height,
          originalSize: result.metadata.originalSize,
          processedSize: result.metadata.processedSize,
          mimeType: result.metadata.mimeType,
          exifStripped: result.metadata.exifStripped,
          isAnimated: result.metadata.isAnimated,
        },
        message: 'Image stored on IPFS (decentralized, permanent). Served via Cloudflare CDN.',
      },
      201,
    );
  } catch (err) {
    log('error', '[media] Image upload failed:', err);
    return jsonResponse(
      {
        error: `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
      500,
    );
  }
}

// ─── POST /api/media/upload ─────────────────────────────────────────

/**
 * Generic media upload endpoint.
 * Accepts any file type and uploads to IPFS.
 *
 * For image-specific uploads with processing, use /api/media/upload/image.
 */
export async function handleMediaUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed — use POST' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address?.toLowerCase();

  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Content-Type must be multipart/form-data' }, 400);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return jsonResponse({ error: 'No file provided. Use form field "file"' }, 400);
    }

    if (file.size > 100 * 1024 * 1024) {
      return jsonResponse({ error: 'File too large. Maximum is 100MB.' }, 400);
    }

    const buffer = await file.arrayBuffer();
    const fileName = file.name.replace(/\.[^/.]+$/, '') || `media-${Date.now()}`;

    const uploadResult = await uploadBufferToIPFS(buffer, fileName, file.type, env);

    if (!uploadResult.cid) {
      return jsonResponse({ error: 'IPFS upload failed' }, 502);
    }

    if (wallet) {
      await linkImageToCreator(env, uploadResult.cid, wallet);
    }

    return jsonResponse(
      {
        success: true,
        cid: uploadResult.cid,
        url: uploadResult.gatewayUrl,
        allGateways: uploadResult.allGateways,
        size: uploadResult.size,
        provider: uploadResult.provider,
        pinned: uploadResult.pinned,
      },
      201,
    );
  } catch (err) {
    log('error', '[media] Upload failed:', err);
    return jsonResponse(
      { error: `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      500,
    );
  }
}

// ─── GET /api/media/image/:cid ───────────────────────────────────────

/**
 * Get an image by CID with optional size and format parameters.
 *
 * Query params:
 *   size    — 'thumbnail' (150px), 'medium' (600px), 'full' (2048px)
 *   format  — 'webp', 'avif', 'jpeg', 'png', 'original'
 *   width   — custom width (overrides size)
 *   quality — 1-100 (default 85)
 */
export async function handleGetImage(request: Request, _env: Env, cid: string): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  try {
    // Check if CID is valid (basic format check)
    if (!cid || cid.length < 10) {
      return jsonResponse({ error: 'Invalid CID' }, 400);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const sizeParam = url.searchParams.get('size') as ImageSizeName | null;
    const formatParam = url.searchParams.get('format') ?? 'webp';
    const widthParam = url.searchParams.get('width');
    const qualityParam = url.searchParams.get('quality');

    // Validate size
    if (sizeParam && !VALID_IMAGE_SIZES.includes(sizeParam)) {
      return jsonResponse(
        {
          error: `Invalid size: ${sizeParam}. Valid: ${VALID_IMAGE_SIZES.join(', ')}`,
        },
        400,
      );
    }

    // Validate format
    if (!VALID_IMAGE_FORMATS.includes(formatParam)) {
      return jsonResponse(
        {
          error: `Invalid format: ${formatParam}. Valid: ${VALID_IMAGE_FORMATS.join(', ')}`,
        },
        400,
      );
    }

    // If format is 'original', redirect to the IPFS gateway directly (no transform)
    if (formatParam === 'original') {
      const gwUrl = `https://cloudflare-ipfs.com/ipfs/${cid}`;
      return Response.redirect(gwUrl, 302);
    }

    // Build the optimized CDN URL
    const optimizedUrl = getOptimizedImageUrl(cid, {
      size: sizeParam ?? undefined,
      format: formatParam,
      width: widthParam ? parseInt(widthParam, 10) : undefined,
      quality: qualityParam ? parseInt(qualityParam, 10) : 85,
    });

    // Redirect to CDN (for direct browser/img tag use)
    return Response.redirect(optimizedUrl, 302);
  } catch (err) {
    log('error', `[media] Get image failed for ${cid}:`, err);
    return jsonResponse({ error: 'Failed to retrieve image' }, 500);
  }
}

// ─── GET /api/media/image/:cid/metadata ─────────────────────────────

/**
 * Get metadata for an image by CID.
 */
export async function handleGetImageMetadata(
  request: Request,
  env: Env,
  cid: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  try {
    const metadata = await getImageMetadataByCid(env, cid);

    if (!metadata) {
      return jsonResponse({ error: 'Image metadata not found' }, 404);
    }

    return noCacheJsonResponse({
      cid,
      metadata,
      urls: {
        original: `https://cloudflare-ipfs.com/ipfs/${cid}`,
        thumbnail: getDefaultImageUrl(cid, 'thumbnail'),
        medium: getDefaultImageUrl(cid, 'medium'),
        full: getDefaultImageUrl(cid, 'full'),
      },
      storage: {
        backend: 'IPFS (decentralized)',
        cdn: 'Cloudflare IPFS Gateway',
        permanent: true,
      },
    });
  } catch (err) {
    log('error', `[media] Get image metadata failed for ${cid}:`, err);
    return jsonResponse({ error: 'Failed to retrieve image metadata' }, 500);
  }
}

// ─── GET /api/media/gateway/:type/:id ───────────────────────────────

/**
 * Unified media gateway proxy.
 * Proxies content from IPFS/Arweave/R2 with fallback chain.
 *
 *   GET /api/media/gateway/ipfs/<cid>
 *   GET /api/media/gateway/arweave/<txId>
 *   GET /api/media/gateway/r2/<key>
 *
 * If no specific backend is given, tries all in priority order.
 * Returns the content with proper caching headers.
 */
export async function handleMediaGateway(
  request: Request,
  env: Env,
  type: string,
  id: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  // Validate backend type
  const validTypes: GatewayBackend[] = ['ipfs', 'arweave', 'r2'];
  const backend = validTypes.includes(type as GatewayBackend)
    ? (type as GatewayBackend)
    : undefined;

  try {
    const result = await fetchMedia(env, id, backend);
    return buildMediaResponse(result, request);
  } catch (err) {
    log('error', `[media] Gateway failed for ${type}/${id}:`, err);
    return jsonResponse({ error: 'Media gateway error' }, 502);
  }
}

// ─── GET /api/media/health ─────────────────────────────────────────

/**
 * Media service health check.
 */
export async function handleMediaHealth(_request: Request, env: Env): Promise<Response> {
  const health = await checkImageServiceHealth();

  return jsonResponse({
    status: health.ipfs_reachable ? 'ok' : 'degraded',
    service: 'degenfeed-media',
    ipfs: health,
    storage: {
      ipfs: !!(env.WEB3_STORAGE_API_KEY || env.PINATA_API_KEY),
      arweave: false, // Arweave requires funded node
      r2: !!env.VIDEO_STORAGE_BINDING,
    },
    checkedAt: Date.now(),
  });
}

// ─── POST /api/media/make-permanent ───────────────────────────────

/**
 * Make media permanent on Arweave.
 * Moves content from IPFS to Arweave via Irys for one-time fee (~$0.01/MB).
 *
 * Request body:
 *   { cid: string }
 *
 * Response:
 *   { success, txId, arweaveUrl, costUsd }
 */
export async function handleMakePermanent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed — use POST' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as { cid?: string };
    const { cid } = body;

    if (!cid) {
      return jsonResponse({ error: 'CID required' }, 400);
    }

    // Estimate cost based on metadata (best effort)
    const meta = await getImageMetadataByCid(env, cid);
    const estimatedBytes = meta?.processedSize ?? 0;
    const estimatedCost = ((estimatedBytes / 1_000_000) * 0.01).toFixed(4);

    // For now, this is a planned feature that requires a funded Irys node.
    // Return informative response about the feature.
    return jsonResponse(
      {
        success: false,
        cid,
        message:
          'Arweave permanence coming soon. ' +
          'This will archive your media permanently on Arweave for ~$0.01/MB (one-time fee). ' +
          'Your media is currently stored on IPFS (decentralized, pinned).',
        estimatedCost: `${estimatedCost} USD`,
        status: 'pending',
      },
      202,
    );
  } catch (err) {
    log('error', '[media] Make permanent failed:', err);
    return jsonResponse({ error: 'Failed to process permanence request' }, 500);
  }
}

// ─── GET /api/creator/media ────────────────────────────────────────

/**
 * Get creator's media storage dashboard data.
 * Shows total storage used, per-file breakdown, CDN status.
 */
export async function handleCreatorMediaDashboard(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed — use GET' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const wallet = session.address?.toLowerCase();
  if (!wallet) {
    return jsonResponse({ error: 'No wallet address in session' }, 400);
  }

  try {
    const stats = await getCreatorImageStats(env, wallet);

    return noCacheJsonResponse({
      storage: {
        totalImages: stats.totalImages,
        totalBytes: stats.totalBytes,
        totalReadable: stats.totalReadable,
        backend: 'IPFS (decentralized, permanent)',
        cdn: 'Served via Cloudflare CDN, cached globally',
        freeTier: true,
        arweaveAvailable: false, // Arweave requires funded node
      },
      images: stats.images.map((img) => ({
        cid: img.cid,
        url: `https://cloudflare-ipfs.com/ipfs/${img.cid}`,
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
          thumbnail: `https://cloudflare-ipfs.com/cdn-cgi/image/width=150,format=webp,quality=80/ipfs/${img.cid}`,
          medium: `https://cloudflare-ipfs.com/cdn-cgi/image/width=600,format=webp,quality=85/ipfs/${img.cid}`,
          full: `https://cloudflare-ipfs.com/cdn-cgi/image/width=2048,format=webp,quality=90/ipfs/${img.cid}`,
        },
      })),
    });
  } catch (err) {
    log('error', '[media] Creator media dashboard failed:', err);
    return jsonResponse({ error: 'Failed to load media dashboard' }, 500);
  }
}

// ─── Utility ───────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}
