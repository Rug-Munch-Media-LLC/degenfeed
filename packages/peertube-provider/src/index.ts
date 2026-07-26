/**
 * @degenfeed/peertube-provider
 *
 * PeerTube API client for the DegenFeed video feed.
 */

// ─── Local circuit breaker ───────────────────────────────────────────
const __cbStore = new Map<string, { failures: number; openUntil: number }>();

function __cbState(name: string, _threshold = 3, _cooldownMs = 60000): 'CLOSED' | 'OPEN' {
  const cb = __cbStore.get(name);
  if (!cb) return 'CLOSED';
  if (cb.openUntil > Date.now()) return 'OPEN';
  __cbStore.delete(name);
  return 'CLOSED';
}

function __cbFail(name: string, threshold = 3, cooldownMs = 60000): void {
  const now = Date.now();
  const cb = __cbStore.get(name) ?? { failures: 0, openUntil: 0 };
  cb.failures++;
  if (cb.failures >= threshold) {
    cb.openUntil = now + cooldownMs;
    console.warn(`[circuit-breaker] ${name}: OPEN after ${cb.failures} failures`);
  }
  __cbStore.set(name, cb);
}

function __cbSuccess(name: string): void {
  __cbStore.delete(name);
}

/**
 * Connects to the self-hosted instance at https://video.degenfeed.xyz
 *
 * PeerTube has a well-documented REST API (no auth required for read-only):
 *   https://docs.joinpeertube.org/api/reference
 *
 * The API returns videos, channels, and accounts from the local instance
 * AND from federated instances (ActivityPub). This gives us access to
 * crypto/Web3 video content from the broader PeerTube federation.
 *
 * ## Usage
 * ```ts
 * import { fetchPeerTubeVideos } from '@degenfeed/peertube-provider';
 * const { data, total } = await fetchPeerTubeVideos({ limit: 20 });
 * ```
 *
 * ## PeerTube RSS fallback (currently used by feed pipeline):
 *   https://video.degenfeed.xyz/feeds/videos.xml?sort=-publishedAt
 *   https://video.degenfeed.xyz/feeds/videos.xml?sort=-createdAt&language=1
 *   https://video.degenfeed.xyz/feeds/videos.xml?sort=-publishedAt&category=1
 *   https://video.degenfeed.xyz/feeds/videos.xml?subtitle=en&sort=-publishedAt
 *
 * The provider below is the JSON API version. The RSS feeds are handled
 * by @degenfeed/rss-sdk.
 */

import type { Protocol } from '@degenfeed/types';

// ─── Re-exports ──────────────────────────────────────────────────────

export { getFederatedFeed } from './federated';
export type {
  ChatFetchResult,
  ChatMessage,
  PeerTubeLiveStreamConfig,
  StreamCreateOptions,
  StreamCreateResult,
  StreamRecording,
  StreamStatus,
  StreamUpdateOptions,
} from './livestream';
export { PeerTubeLiveError, PeerTubeLiveStream } from './livestream';

// ─── Upload / Creator Video Management ───────────────────────────────

export type {
  ShortUploadResult,
  UploadProgress,
  UploadResult,
  UploadVideoOptions,
  VideoUpdateOptions,
} from './upload';
export { createPeerTubeUploader, PeerTubeUploadError, PeerTubeUploader } from './upload';

// ─── Constants ───────────────────────────────────────────────────────

/** Default PeerTube instance (our self-hosted). */
export const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

/** Default pagination limit. PeerTube max is 100. */
export const DEFAULT_PAGE_LIMIT = 20;

// ─── Types ───────────────────────────────────────────────────────────

export type { PeerTubeFetchOptions, PeerTubeVideo, PeerTubeVideoResponse } from './types';

// ─── API client ──────────────────────────────────────────────────────

/**
 * Fetch videos from a PeerTube instance.
 *
 * Uses the REST API at /api/v1/videos. No auth required for read-only.
 * Returns paginated results. Use `start` and `limit` for pagination.
 *
 * @example
 * ```ts
 * const { data, total } = await fetchPeerTubeVideos({ limit: 10 });
 * console.log(`Found ${total} videos`);
 * for (const video of data) {
 *   console.log(video.name, video.url);
 * }
 * ```
 */
export async function fetchPeerTubeVideos(
  options: PeerTubeFetchOptions = {},
): Promise<PeerTubeVideoResponse> {
  if (__cbState('peertube') === 'OPEN') {
    console.warn('[circuit-breaker] peertube: skipping fetch — circuit open');
    return { data: [], total: 0 };
  }

  try {
    const {
      baseUrl = PEERTUBE_INSTANCE,
      limit = DEFAULT_PAGE_LIMIT,
      sort = '-publishedAt',
      categoryId,
      language,
      tags,
      search,
      start = 1,
      isLive,
      signal,
    } = options;

    const params = new URLSearchParams();
    params.set('count', String(Math.min(limit, 100)));
    params.set('sort', sort);
    params.set('start', String((start - 1) * limit));

    if (categoryId !== undefined) params.set('categoryOneOf', String(categoryId));
    if (language) params.set('languageOneOf', language);
    if (tags) params.set('tagsOneOf', tags);
    if (search) params.set('search', search);
    if (isLive !== undefined) params.set('isLive', String(isLive));

    const url = `${baseUrl}/api/v1/videos?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/1.0',
      },
      signal,
    });

    if (!response.ok) {
      __cbFail('peertube');
      throw new Error(`PeerTube API error: ${response.status} ${response.statusText} — ${url}`);
    }

    __cbSuccess('peertube');
    return response.json() as Promise<PeerTubeVideoResponse>;
  } catch (err) {
    __cbFail('peertube');
    throw err;
  }
}

/**
 * Fetch a single video by its UUID or short UUID.
 */
export async function fetchPeerTubeVideo(
  uuid: string,
  baseUrl: string = PEERTUBE_INSTANCE,
): Promise<PeerTubeVideo> {
  const url = `${baseUrl}/api/v1/videos/${uuid}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'DegenFeed/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(
      `PeerTube video fetch error: ${response.status} ${response.statusText} — ${url}`,
    );
  }

  return response.json() as Promise<PeerTubeVideo>;
}

/**
 * Check if the PeerTube instance is reachable.
 */
export async function healthCheck(
  baseUrl: string = PEERTUBE_INSTANCE,
): Promise<{ healthy: boolean; latencyMs: number; instanceName?: string }> {
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/v1/config`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/1.0',
      },
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return { healthy: false, latencyMs };
    }

    const config = (await response.json()) as { instance?: { name?: string } } | undefined;
    return {
      healthy: true,
      latencyMs,
      instanceName: config?.instance?.name,
    };
  } catch {
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - start),
    };
  }
}

// ─── Normalize to UnifiedPost ─────────────────────────────────────────

/**
 * Convert a PeerTube video to a minimal object compatible with UnifiedPost.
 */
export function peerTubeVideoToFeedItem(video: PeerTubeVideo) {
  const thumbnailUrl = video.thumbnailPath
    ? `${PEERTUBE_INSTANCE}${video.thumbnailPath}`
    : undefined;

  return {
    protocol: 'peertube' as Protocol,
    nativeId: video.uuid,
    title: video.name,
    url: video.url,
    text: video.shortDescription || video.description?.slice(0, 500) || '',
    createdAt: new Date(video.publishedAt).getTime(),
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    isLive: video.isLive,
    channelName: video.channel?.displayName || video.channel?.name || 'unknown',
    channelUrl: video.channel?.url,
    thumbnailUrl,
    tags: video.tags,
    embedUrl: video.embedPath ? `${PEERTUBE_INSTANCE}${video.embedPath}` : undefined,
  };
}

/**
 * Get the base URL for PeerTube RSS feeds.
 */
export function getPeerTubeRssUrl(
  sort: string = '-publishedAt',
  baseUrl: string = PEERTUBE_INSTANCE,
): string {
  return `${baseUrl}/feeds/videos.xml?sort=${sort}`;
}
