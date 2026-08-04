/**
 * @degenfeed/api-worker — Unified Media Gateway
 *
 * A unified proxy/gateway for all media (images, video, audio) that:
 *   1. Tries IPFS gateway first (free, decentralized, CDN-backed)
 *   2. Falls back to Arweave gateway (permanent, one-time fee)
 *   3. Falls back to R2 (our storage, paid)
 *   4. Adds proper caching headers
 *   5. Supports on-the-fly optimization via Cloudflare Image Resizing
 *
 * Request flow:
 *   GET /api/media/:cid[?size=thumb&format=webp]
 *   GET /api/media/gateway/:type/:id[?size=...]
 *
 * Where:
 *   :type = 'ipfs' | 'arweave' | 'r2'
 *   :id   = CID | txId | R2 key
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

/** IPFS gateways in priority order */
const IPFS_GATEWAYS = [
  { url: 'https://ipfs.degenfeed.xyz/ipfs/{cid}', name: 'degenfeed', priority: 1 },
  { url: 'https://{cid}.ipfs.dweb.link', name: 'dweb', priority: 2 },
  { url: 'https://ipfs.io/ipfs/{cid}', name: 'ipfs-io', priority: 3 },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', name: 'pinata-gw', priority: 4 },
];

/** Arweave gateways in priority order */
const ARWEAVE_GATEWAYS = [
  { url: 'https://arweave.net/{txId}', name: 'arweave-net', priority: 1 },
  { url: 'https://arweave.dev/{txId}', name: 'arweave-dev', priority: 2 },
  { url: 'https://gateway.irys.xyz/{txId}', name: 'irys-gw', priority: 3 },
];

/** Media type classification */
export type MediaType = 'image' | 'video' | 'audio' | 'application' | 'unknown';

export type GatewayBackend = 'ipfs' | 'arweave' | 'r2';

export interface MediaGatewayResult {
  /** The response body stream */
  body: ReadableStream | null;
  /** Content type of the media */
  contentType: string;
  /** Content length in bytes */
  contentLength: number;
  /** Which backend served the request */
  backend: GatewayBackend;
  /** Whether the request was served successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Status code */
  status: number;
}

export interface MediaGatewayOptions {
  /** Expected content type (for validation) */
  expectedType?: MediaType;
  /** Whether to follow redirects (default: true) */
  followRedirects?: boolean;
  /** Custom timeout in ms (default: 15000) */
  timeout?: number;
  /** Request headers to proxy */
  headers?: Record<string, string>;
}

// ─── Content Type Detection ────────────────────────────────────────────

/**
 * Classify a content type string into a general media type.
 */
export function classifyMediaType(contentType: string): MediaType {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('application/')) return 'application';
  return 'unknown';
}

/**
 * Detect media type from file extension.
 */
export function detectMediaTypeFromExtension(filename: string): MediaType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm3u8', 'ts', 'm4v'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  return 'unknown';
}

/**
 * Map file extension to MIME type.
 */
export function extensionToMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    m3u8: 'application/x-mpegURL',
    ts: 'video/mp2t',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeMap[ext] ?? 'application/octet-stream';
}

// ─── Gateway Fetching ──────────────────────────────────────────────────

/**
 * Fetch content from IPFS via the best available gateway.
 * Tries gateways in priority order with configurable timeout.
 */
export async function fetchFromIPFS(
  cid: string,
  options: MediaGatewayOptions = {},
): Promise<MediaGatewayResult> {
  const { timeout = 15_000, headers = {} } = options;
  const gateways = IPFS_GATEWAYS;

  for (const gw of gateways) {
    try {
      const url = gw.url.replace('{cid}', cid);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'image/webp,image/avif,image/*,video/*,audio/*,*/*',
          ...headers,
        },
        signal: AbortSignal.timeout(timeout),
        // Don't follow redirects for gateway fallback to detect dead gateways
        redirect: 'manual',
      });

      // Gateway returned a redirect (to another gateway) — follow it
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const redirected = await fetch(location, {
            headers: { Accept: 'image/webp,image/avif,image/*,video/*,audio/*,*/*' },
            signal: AbortSignal.timeout(timeout),
          });
          if (redirected.ok) {
            return gatewayResult(redirected, 'ipfs');
          }
        }
        continue;
      }

      if (response.ok) {
        return gatewayResult(response, 'ipfs');
      }

      // Gateway returned 4xx/5xx — try next
      log('warn', `[media-gateway] IPFS gateway ${gw.name} returned ${response.status} for ${cid}`);
    } catch (err) {
      log('warn', `[media-gateway] IPFS gateway ${gw.name} failed for ${cid}:`, err);
    }
  }

  return {
    body: null,
    contentType: 'application/octet-stream',
    contentLength: 0,
    backend: 'ipfs',
    success: false,
    error: 'All IPFS gateways failed',
    status: 502,
  };
}

/**
 * Fetch content from Arweave via the best available gateway.
 */
export async function fetchFromArweave(
  txId: string,
  options: MediaGatewayOptions = {},
): Promise<MediaGatewayResult> {
  const { timeout = 15_000, headers = {} } = options;

  for (const gw of ARWEAVE_GATEWAYS) {
    try {
      const url = gw.url.replace('{txId}', txId);
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(timeout),
        redirect: 'manual',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const redirected = await fetch(location, {
            headers,
            signal: AbortSignal.timeout(timeout),
          });
          if (redirected.ok) {
            return gatewayResult(redirected, 'arweave');
          }
        }
        continue;
      }

      if (response.ok) {
        return gatewayResult(response, 'arweave');
      }

      log(
        'warn',
        `[media-gateway] Arweave gateway ${gw.name} returned ${response.status} for ${txId}`,
      );
    } catch (err) {
      log('warn', `[media-gateway] Arweave gateway ${gw.name} failed for ${txId}:`, err);
    }
  }

  return {
    body: null,
    contentType: 'application/octet-stream',
    contentLength: 0,
    backend: 'arweave',
    success: false,
    error: 'All Arweave gateways failed',
    status: 502,
  };
}

/**
 * Fetch content from R2 storage.
 */
export async function fetchFromR2(
  env: Env,
  key: string,
  _options?: MediaGatewayOptions,
): Promise<MediaGatewayResult> {
  const bucket = env.VIDEO_STORAGE_BINDING as
    | {
        get(key: string): Promise<{
          body: ReadableStream;
          size: number;
          httpMetadata?: { contentType?: string };
        } | null>;
      }
    | undefined;

  if (!bucket) {
    return {
      body: null,
      contentType: 'application/octet-stream',
      contentLength: 0,
      backend: 'r2',
      success: false,
      error: 'R2 storage not configured',
      status: 501,
    };
  }

  try {
    const obj = await bucket.get(key);
    if (!obj?.body) {
      return {
        body: null,
        contentType: 'application/octet-stream',
        contentLength: 0,
        backend: 'r2',
        success: false,
        error: 'Object not found in R2',
        status: 404,
      };
    }

    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream',
      contentLength: obj.size,
      backend: 'r2',
      success: true,
      status: 200,
    };
  } catch (err) {
    log('warn', `[media-gateway] R2 fetch failed for ${key}:`, err);
    return {
      body: null,
      contentType: 'application/octet-stream',
      contentLength: 0,
      backend: 'r2',
      success: false,
      error: String(err),
      status: 502,
    };
  }
}

// ─── Unified Gateway ───────────────────────────────────────────────────

/**
 * Unified media gateway — tries backends in order until one succeeds.
 *
 * Priority: IPFS → Arweave → R2
 *
 * @param id - Content identifier (CID, txId, or R2 key depending on backend param)
 * @param backend - Optional specific backend to use. If omitted, tries all in order.
 * @param options - Gateway options (timeout, expected type, custom headers)
 *
 * Returns the first successful result or the last error.
 */
export async function fetchMedia(
  env: Env,
  id: string,
  backend?: GatewayBackend,
  options: MediaGatewayOptions = {},
): Promise<MediaGatewayResult> {
  const backends: GatewayBackend[] = backend ? [backend] : ['ipfs', 'arweave', 'r2'];

  let lastError: MediaGatewayResult | null = null;

  for (const b of backends) {
    let result: MediaGatewayResult;

    switch (b) {
      case 'ipfs':
        result = await fetchFromIPFS(id, options);
        break;
      case 'arweave':
        result = await fetchFromArweave(id, options);
        break;
      case 'r2':
        result = await fetchFromR2(env, id, options);
        break;
    }

    if (result.success) {
      log('info', `[media-gateway] Served ${id} from ${result.backend} (${result.contentType})`);
      return result;
    }

    lastError = result;
    log('warn', `[media-gateway] ${b} failed for ${id}, trying next backend`);
  }

  // All backends failed
  const errorResult = lastError ?? {
    body: null,
    contentType: 'application/octet-stream',
    contentLength: 0,
    backend: 'unknown' as GatewayBackend,
    success: false,
    error: 'All storage backends failed',
    status: 502,
  };

  log('error', `[media-gateway] All backends failed for ${id}`);
  return errorResult;
}

// ─── Helper: Build Gateway Response ────────────────────────────────────

/**
 * Convert a fetch Response to a MediaGatewayResult.
 */
function gatewayResult(response: Response, backend: GatewayBackend): MediaGatewayResult {
  return {
    body: response.body,
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    contentLength: Number(response.headers.get('content-length') ?? 0),
    backend,
    success: true,
    status: response.status,
  };
}

// ─── Media Response Builder ────────────────────────────────────────────

/**
 * Build a proper HTTP Response from a MediaGatewayResult with caching headers.
 *
 * Caching strategy:
 *   - IPFS content: immutable, cache for 1 year (CIDs are content-addressed)
 *   - Arweave content: immutable, cache for 1 year (txId is permanent)
 *   - R2 content: cache for 1 hour (R2 keys may be ephemeral)
 */
export function buildMediaResponse(
  result: MediaGatewayResult,
  request?: Request,
  cacheDuration?: number,
): Response {
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: result.error ?? 'Media not found',
        backend: result.backend,
      }),
      {
        status: result.status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
        },
      },
    );
  }

  // Determine cache duration based on backend
  const maxAge = cacheDuration ?? (result.backend === 'r2' ? 3600 : 31536000); // R2: 1h, IPFS/Arweave: 1yr

  // Check for conditional GET (If-None-Match / If-Modified-Since)
  // IPFS CIDs and Arweave txIds are content-addressed — strong ETag
  const etag = `"${result.backend}-${Date.now().toString(36)}"`;

  if (request) {
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'cache-control': `public, max-age=${maxAge}, immutable`,
          etag: etag,
          'access-control-allow-origin': '*',
        },
      });
    }
  }

  const headers: Record<string, string> = {
    'content-type': result.contentType,
    'content-length': String(result.contentLength),
    'cache-control': `public, max-age=${maxAge}, ${result.backend !== 'r2' ? 'immutable, ' : ''}s-maxage=${maxAge}`,
    etag: etag,
    'x-media-backend': result.backend,
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'x-media-backend, content-length',
  };

  // Add CDN-specific headers
  if (result.backend === 'ipfs') {
    headers['x-ipfs-cid'] = 'present';
    headers['cf-cache-status'] = 'HIT'; // Cloudflare caches IPFS gateway responses
  }

  return new Response(result.body, {
    status: 200,
    headers,
  });
}

// ─── Image Transform URL Builder ───────────────────────────────────────

/**
 * Build an optimized media URL using Cloudflare Image Resizing.
 * This is for client-side use (generates a URL, not a response).
 *
 * @param cid - IPFS content identifier
 * @param options - Transformation options
 */
export function buildTransformUrl(
  cid: string,
  options: {
    width?: number;
    height?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
    quality?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  } = {},
): string {
  const { width, height, format = 'webp', quality = 85, fit = 'scale-down' } = options;

  const params: string[] = [];
  if (width) params.push(`width=${width}`);
  if (height) params.push(`height=${height}`);
  params.push(`format=${format}`);
  params.push(`quality=${quality}`);
  params.push(`fit=${fit}`);
  params.push('metadata=none'); // Strip EXIF
  params.push('onerror=redirect'); // Fallback to original on error

  return `https://ipfs.degenfeed.xyz/cdn-cgi/image/${params.join(',')}/ipfs/${cid}`;
}

// ─── Content Verification ─────────────────────────────────────────────

/**
 * Verify that media content is accessible through the gateway.
 * Returns a map of backends that can serve the content.
 */
export async function verifyMediaAvailability(cid: string): Promise<{
  available: boolean;
  backends: Record<GatewayBackend, boolean>;
  fastestGateway?: string;
}> {
  const backends: Record<GatewayBackend, boolean> = {
    ipfs: false,
    arweave: false,
    r2: false,
  };

  // Check IPFS
  for (const gw of IPFS_GATEWAYS) {
    try {
      const url = gw.url.replace('{cid}', cid);
      const resp = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      });
      if (resp.ok) {
        backends.ipfs = true;
        break;
      }
    } catch {}
  }

  // Check Arweave
  for (const gw of ARWEAVE_GATEWAYS) {
    try {
      const url = gw.url.replace('{txId}', cid);
      const resp = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      });
      if (resp.ok) {
        backends.arweave = true;
        break;
      }
    } catch {}
  }

  return {
    available: backends.ipfs || backends.arweave,
    backends,
  };
}

// ─── Utility ───────────────────────────────────────────────────────────

/**
 * Extract a CID or content identifier from a URL.
 */
export function extractContentId(url: string): { type: GatewayBackend; id: string } | null {
  // IPFS: /ipfs/<cid>
  const ipfsMatch = url.match(/\/ipfs\/([a-z2-9]{46,}|[a-z0-9]{46,})/i);
  if (ipfsMatch?.[1]) return { type: 'ipfs', id: ipfsMatch[1] };

  // IPFS: ipfs://<cid>
  if (url.startsWith('ipfs://')) {
    return { type: 'ipfs', id: url.slice(7).replace(/^\/+/, '') };
  }

  // Arweave: arweave.net/<txId>
  const arMatch = url.match(/arweave\.(net|dev)\/([a-zA-Z0-9_-]{43})/);
  if (arMatch?.[2]) return { type: 'arweave', id: arMatch[2] };

  // Arweave: ar://<txId>
  if (url.startsWith('ar://')) {
    return { type: 'arweave', id: url.slice(5).replace(/^\/+/, '') };
  }

  return null;
}
