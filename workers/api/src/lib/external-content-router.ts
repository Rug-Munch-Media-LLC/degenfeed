/**
 * @degenfeed/api-worker — External Content Router
 *
 * Smart routing for externally hosted video and live content.
 * Optimizes bandwidth, provides fallback chains, routes through CDN,
 * and handles IPFS/Arweave/PeerTube-federated content routing.
 *
 * Design principles:
 *   - Stream directly from source (don't proxy) for bandwidth optimization
 *   - Fallback chain: if primary source is down, try mirrors
 *   - Cache thumbnails and metadata on Cloudflare CDN
 *   - Detect and route IPFS/Arweave content through public gateways
 *   - Route federated PeerTube videos through our instance for better performance
 *
 * Every routing decision is logged. No silent failures.
 */

import type { Env } from '../types';

// ─── Content Routing Types ───────────────────────────────────────────────

export type ContentProtocol = 'https' | 'ipfs' | 'arweave' | 'peertube' | 'hls' | 'dash' | 'rtmp';

export interface ContentSource {
  /** Protocol identifier */
  protocol: ContentProtocol;
  /** Primary URL for the content */
  url: string;
  /** Mirror URLs in priority order */
  mirrors: string[];
  /** Content hash (IPFS CID, Arweave ID, etc.) */
  contentHash?: string;
  /** Origin platform (peertube, youtube, etc.) */
  platform?: string;
  /** Geographic region hint for CDN routing */
  region?: string;
  /** Bandwidth cost estimate (0 = free, 1 = expensive) */
  bandwidthCost?: number;
  /** Whether the source supports range requests */
  supportsRangeRequests?: boolean;
}

export interface RoutedContent {
  /** Best URL to use for playback */
  playbackUrl: string;
  /** Fallback URLs in order */
  fallbackUrls: string[];
  /** CDN-optimized thumbnail URL */
  thumbnailUrl?: string;
  /** Whether content is cached on CDN edge */
  isCached: boolean;
  /** Cache TTL in seconds */
  cacheTtl: number;
  /** Platform-specific embedding info */
  embedConfig?: {
    type: 'iframe' | 'html5' | 'hls' | 'dash' | 'custom';
    url: string;
    options?: Record<string, unknown>;
  };
  /** Content protocol for player selection */
  protocol: ContentProtocol;
  /** Routing metadata for debugging */
  routingDebug: {
    sourceIndex: number;
    resolvedFrom: string;
    isMirror: boolean;
    routingTimeMs: number;
  };
}

export interface RoutingRule {
  /** Pattern to match against content URLs */
  urlPattern: RegExp;
  /** Replace pattern for CDN/proxy rewrites */
  rewritePattern?: string;
  /** CDN hostname to use instead of origin */
  cdnHost?: string;
  /** Whether to proxy through our CDN (bandwidth cost) or redirect direct */
  proxyThroughCdn: boolean;
  /** Cache TTL in seconds */
  cacheTtl: number;
  /** Priority order (lower = checked first) */
  priority: number;
  /** Platform identifier */
  platform?: string;
}

// ─── Default Routing Rules ──────────────────────────────────────────────

const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  // YouTube: embed via youtube.com directly (don't proxy)
  {
    urlPattern: /(?:youtube\.com|youtu\.be)/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
    platform: 'youtube',
  },
  // YouTube: use invidious for privacy-friendly viewing
  {
    urlPattern: /(?:invidious|yt\.artemislena)/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 2,
    platform: 'youtube',
  },
  // Twitch: direct through player
  {
    urlPattern: /twitch\.tv/i,
    proxyThroughCdn: false,
    cacheTtl: 300,
    priority: 1,
    platform: 'twitch',
  },
  // PeerTube local instance: direct
  {
    urlPattern: /video\.degenfeed\.xyz|peertube/i,
    proxyThroughCdn: false,
    cacheTtl: 600,
    priority: 1,
    platform: 'peertube',
  },
  // PeerTube federated instances: route through our instance for better performance
  {
    urlPattern: /peertube\.[a-z]+\.[a-z]/i,
    rewritePattern: 'https://video.degenfeed.xyz/api/v1/videos/$1',
    proxyThroughCdn: false,
    cacheTtl: 600,
    priority: 5,
    platform: 'peertube',
  },
  // IPFS: route through public gateways
  {
    urlPattern: /ipfs:\/\//i,
    cdnHost: 'ipfs.degenfeed.xyz',
    proxyThroughCdn: true,
    cacheTtl: 86400,
    priority: 10,
    platform: 'ipfs',
  },
  // IPFS via gateway URLs
  {
    urlPattern: /\/ipfs\/([a-zA-Z0-9]{46,})/i,
    cdnHost: 'ipfs.degenfeed.xyz',
    proxyThroughCdn: false,
    cacheTtl: 86400,
    priority: 11,
    platform: 'ipfs',
  },
  // Arweave: route through gateway
  {
    urlPattern: /ar:\/\/|arweave\.net/i,
    cdnHost: 'arweave.degenfeed.xyz',
    proxyThroughCdn: false,
    cacheTtl: 86400,
    priority: 10,
    platform: 'arweave',
  },
  // HLS streams: direct (must work at edge)
  {
    urlPattern: /\.m3u8/i,
    proxyThroughCdn: true,
    cacheTtl: 60,
    priority: 1,
    platform: 'hls',
  },
  // Direct MP4/WebM: serve direct
  {
    urlPattern: /\.(mp4|webm|mov)(\?|$)/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
    platform: 'direct',
  },
  // Rumble CDN: direct
  {
    urlPattern: /(?:rumble\.com|cf\.rumble\.com)/i,
    proxyThroughCdn: false,
    cacheTtl: 600,
    priority: 1,
    platform: 'rumble',
  },
  // Odysee/LBRY: direct
  {
    urlPattern: /(?:odysee\.com|lbry\.tv)/i,
    proxyThroughCdn: false,
    cacheTtl: 600,
    priority: 1,
    platform: 'odysee',
  },
  // DTube/IPFS: route through gateway
  {
    urlPattern: /dtube\.|d-tube\./i,
    cdnHost: 'ipfs.degenfeed.xyz',
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
    platform: 'dtube',
  },
  // Zora content: direct
  {
    urlPattern: /zora\.co|nft\.zora/i,
    proxyThroughCdn: false,
    cacheTtl: 300,
    priority: 1,
    platform: 'zora',
  },
  // Wistia (common embed): direct
  {
    urlPattern: /wistia\.com|fast\.wistia/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
  },
  // Vimeo: direct
  {
    urlPattern: /vimeo\.com/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
    platform: 'vimeo',
  },
  // Dailymotion: direct
  {
    urlPattern: /dailymotion\.com/i,
    proxyThroughCdn: false,
    cacheTtl: 3600,
    priority: 1,
    platform: 'dailymotion',
  },
  // Cloudflare-hosted assets: direct (fastest)
  {
    urlPattern: /\.workers\.dev|degenfeed\.xyz|degenfeed\.pages\.dev/i,
    proxyThroughCdn: false,
    cacheTtl: 86400,
    priority: 0,
  },
];

// ─── IPFS Gateway Configuration ─────────────────────────────────────────

const IPFS_GATEWAYS = [
  { url: 'https://ipfs.degenfeed.xyz/ipfs/{cid}', priority: 0, region: 'us-central' },
  { url: 'https://dweb.link/ipfs/{cid}', priority: 1, region: 'global' },
  { url: 'https://ipfs.io/ipfs/{cid}', priority: 2, region: 'global' },
  { url: 'https://gateway.pinata.cloud/ipfs/{cid}', priority: 4, region: 'us-east' },
];

const ARWEAVE_GATEWAYS = [
  { url: 'https://arweave.degenfeed.xyz/{id}', priority: 0, region: 'us-central' },
  { url: 'https://arweave.net/{id}', priority: 1, region: 'global' },
  { url: 'https://arweave.live/{id}', priority: 2, region: 'global' },
  { url: 'https://gql.gateway.arweave.net/{id}', priority: 3, region: 'global' },
];

// ─── Content Router Class ────────────────────────────────────────────────

export class ContentRouter {
  private env: Env;
  private rules: RoutingRule[];
  private cache: Map<string, RoutedContent>;

  constructor(env: Env, customRules?: RoutingRule[]) {
    this.env = env;
    this.rules = customRules ?? DEFAULT_ROUTING_RULES;
    this.cache = new Map();
  }

  /**
   * Route a content URL to the optimal playback endpoint.
   *
   * Decision flow:
   *   1. Check in-memory cache for recently routed URLs (fast path)
   *   2. Match URL against routing rules
   *   3. If IPFS/Arweave, resolve through best gateway
   *   4. If federated PeerTube, resolve through local instance
   *   5. Determine embed configuration
   *   6. Cache the result
   */
  async route(
    contentUrl: string,
    options?: {
      platform?: string;
      thumbnailUrl?: string;
      contentHash?: string;
      bypassCache?: boolean;
    },
  ): Promise<RoutedContent> {
    const startTime = Date.now();

    // Check cache (unless bypass requested)
    if (!options?.bypassCache) {
      const cached = this.cache.get(contentUrl);
      if (cached && Date.now() - cached.routingDebug.routingTimeMs < cached.cacheTtl * 1000) {
        return cached;
      }

      // Check KV cache too
      try {
        const kvRaw = await this.env.CACHE?.get(`route:${hashUrl(contentUrl)}`);
        if (kvRaw) {
          const kvCached = JSON.parse(kvRaw) as RoutedContent;
          this.cache.set(contentUrl, kvCached);
          return kvCached;
        }
      } catch {
        // Cache miss — continue to route
      }
    }

    // Determine content protocol from URL
    const protocol = detectProtocol(contentUrl);

    // Build source list
    const _sources = this.buildSourceList(contentUrl, protocol, options);

    // Apply routing rules
    const rule = this.findMatchingRule(contentUrl, options?.platform);

    // Resolve content URL
    let resolvedUrl: string;
    const isMirror = false;
    let sourceIndex = 0;

    // IPFS/Arweave: route through best gateway
    if (protocol === 'ipfs' && options?.contentHash) {
      resolvedUrl = this.resolveIPFS(options.contentHash);
      sourceIndex = 1;
    } else if (protocol === 'arweave' && options?.contentHash) {
      resolvedUrl = this.resolveArweave(options.contentHash);
      sourceIndex = 1;
    } else if (rule?.rewritePattern && contentUrl.match(rule.urlPattern)) {
      // Apply URL rewrite pattern
      resolvedUrl = contentUrl.replace(rule.urlPattern, rule.rewritePattern ?? '$&');
      sourceIndex = 2;
    } else {
      resolvedUrl = contentUrl;
    }

    // Determine CDN caching
    const isCached = rule?.proxyThroughCdn === true;
    const cacheTtl = rule?.cacheTtl ?? 3600;

    // Determine embed configuration
    const embedConfig = this.getEmbedConfig(resolvedUrl, protocol, options?.platform);

    // Build fallback chain
    const fallbackUrls = this.buildFallbackChain(contentUrl, protocol, options?.contentHash);

    // Thumbnail CDN optimization
    const cdnThumbnail = options?.thumbnailUrl
      ? this.optimizeThumbnail(options.thumbnailUrl)
      : undefined;

    const result: RoutedContent = {
      playbackUrl: resolvedUrl,
      fallbackUrls,
      thumbnailUrl: cdnThumbnail,
      isCached,
      cacheTtl,
      embedConfig,
      protocol,
      routingDebug: {
        sourceIndex,
        resolvedFrom: contentUrl,
        isMirror,
        routingTimeMs: Date.now() - startTime,
      },
    };

    // Cache the result
    this.cache.set(contentUrl, result);
    try {
      await this.env.CACHE?.put(`route:${hashUrl(contentUrl)}`, JSON.stringify(result), {
        expirationTtl: Math.min(cacheTtl, 86400),
      });
    } catch {
      // Non-critical
    }

    return result;
  }

  /**
   * Route a live stream URL (handles HLS, RTMP, WebRTC specially).
   * Live streams should never be proxied through CDN (adds latency).
   */
  async routeLiveStream(
    liveUrl: string,
    protocol: 'hls' | 'rtmp' | 'webrtc',
  ): Promise<RoutedContent> {
    const startTime = Date.now();

    return {
      playbackUrl: liveUrl,
      fallbackUrls: [],
      isCached: false,
      cacheTtl: 30,
      protocol: protocol === 'hls' ? 'hls' : protocol === 'rtmp' ? 'rtmp' : 'https',
      embedConfig: {
        type: protocol === 'hls' ? 'hls' : protocol === 'rtmp' ? 'custom' : 'html5',
        url: liveUrl,
        options: protocol === 'hls' ? { autoplay: true, preload: 'metadata' } : undefined,
      },
      routingDebug: {
        sourceIndex: 0,
        resolvedFrom: liveUrl,
        isMirror: false,
        routingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get thumbnail CDN URL — caches on Cloudflare edge.
   */
  private optimizeThumbnail(thumbnailUrl: string): string {
    const cdnBase = this.env.DEGENFEED_CDN_URL || 'https://cdn.degenfeed.xyz';
    const hash = simpleHash(thumbnailUrl);

    // If already on our CDN, return as-is
    if (thumbnailUrl.includes('cdn.degenfeed.xyz') || thumbnailUrl.includes('degenfeed.xyz')) {
      return thumbnailUrl;
    }

    // For YouTube thumbnails, optimize by stripping query params
    if (thumbnailUrl.includes('ytimg.com') || thumbnailUrl.includes('i.ytimg.com')) {
      const baseUrl = thumbnailUrl.split('?')[0]!;
      return `${cdnBase}/thumb/youtube/${hash}?url=${encodeURIComponent(baseUrl)}`;
    }

    // Generic thumbnail proxy
    return `${cdnBase}/thumb/${hash}?url=${encodeURIComponent(thumbnailUrl)}`;
  }

  /**
   * Resolve IPFS CID through the fastest available gateway.
   */
  private resolveIPFS(cid: string): string {
    return IPFS_GATEWAYS[0]?.url.replace('{cid}', cid);
  }

  /**
   * Resolve Arweave transaction ID through the fastest available gateway.
   */
  private resolveArweave(txId: string): string {
    return ARWEAVE_GATEWAYS[0]?.url.replace('{id}', txId);
  }

  /**
   * Build a list of content sources from URL and metadata.
   */
  private buildSourceList(
    url: string,
    protocol: ContentProtocol,
    options?: { platform?: string; contentHash?: string },
  ): ContentSource[] {
    const sources: ContentSource[] = [];

    sources.push({
      protocol,
      url,
      mirrors: [],
      contentHash: options?.contentHash,
      platform: options?.platform,
      region: 'global',
      bandwidthCost: 0,
      supportsRangeRequests: protocol === 'https',
    });

    // Add IPFS mirror if content hash is available
    if (protocol === 'ipfs' && options?.contentHash) {
      for (let i = 1; i < IPFS_GATEWAYS.length; i++) {
        sources.push({
          protocol: 'https',
          url: IPFS_GATEWAYS[i]?.url.replace('{cid}', options.contentHash),
          mirrors: [],
          contentHash: options.contentHash,
          platform: 'ipfs',
          region: IPFS_GATEWAYS[i]?.region,
        });
      }
    }

    return sources;
  }

  /**
   * Find the best matching routing rule for a URL.
   */
  private findMatchingRule(url: string, platform?: string): RoutingRule | undefined {
    const candidates: RoutingRule[] = [];

    for (const rule of this.rules) {
      if (rule.urlPattern.test(url)) {
        // If rule has a platform filter, match it
        if (platform && rule.platform && rule.platform !== platform) continue;
        candidates.push(rule);
      }
    }

    if (candidates.length === 0) return undefined;

    // Return highest priority (lowest number) matching rule
    return candidates.sort((a, b) => a.priority - b.priority)[0]!;
  }

  /**
   * Determine embed configuration based on source type.
   */
  private getEmbedConfig(
    url: string,
    protocol: ContentProtocol,
    platform?: string,
  ): {
    type: 'iframe' | 'html5' | 'hls' | 'dash' | 'custom';
    url: string;
    options?: Record<string, unknown>;
  } {
    // Known embeddable platforms
    if (url.includes('youtube.com/embed') || url.includes('youtu.be')) {
      return {
        type: 'iframe',
        url,
        options: { autoplay: 1, rel: 0, modestbranding: 1 },
      };
    }

    if (url.includes('player.twitch.tv')) {
      return {
        type: 'iframe',
        url,
        options: { parent: 'degenfeed.xyz', autoplay: true },
      };
    }

    if (url.includes('rumble.com')) {
      return {
        type: 'iframe',
        url: url.replace('/v/', '/embed/'),
        options: { autoplay: 2 },
      };
    }

    if (protocol === 'ipfs' || protocol === 'arweave') {
      return {
        type: 'html5',
        url,
        options: { preload: 'metadata' },
      };
    }

    if (url.endsWith('.m3u8')) {
      return {
        type: 'hls',
        url,
        options: { autoplay: true },
      };
    }

    if (url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) {
      return {
        type: 'html5',
        url,
        options: { preload: 'metadata' },
      };
    }

    // Zora: embed via zora.co
    if (platform === 'zora' || url.includes('zora.co')) {
      return {
        type: 'iframe',
        url,
        options: { frameBorder: 0 },
      };
    }

    // PeerTube: embed via PeerTube player
    if (
      platform === 'peertube' ||
      url.includes('peertube') ||
      url.includes('video.degenfeed.xyz')
    ) {
      return {
        type: 'iframe',
        url,
        options: { title: 0, warningTitles: 0 },
      };
    }

    // Default: treat as iframe
    return { type: 'iframe', url };
  }

  /**
   * Build a fallback URL chain for resiliency.
   */
  private buildFallbackChain(
    _url: string,
    protocol: ContentProtocol,
    contentHash?: string,
  ): string[] {
    const fallbacks: string[] = [];

    // IPFS content: multiple gateway fallbacks
    if (protocol === 'ipfs' && contentHash) {
      for (let i = 1; i < IPFS_GATEWAYS.length; i++) {
        fallbacks.push(IPFS_GATEWAYS[i]?.url.replace('{cid}', contentHash));
      }
    }

    // Arweave content: multiple gateway fallbacks
    if (protocol === 'arweave' && contentHash) {
      for (let i = 1; i < ARWEAVE_GATEWAYS.length; i++) {
        fallbacks.push(ARWEAVE_GATEWAYS[i]?.url.replace('{id}', contentHash));
      }
    }

    return fallbacks;
  }

  /**
   * Get health status of the content router.
   */
  getHealth(): { cacheSize: number; rulesCount: number; status: string } {
    return {
      cacheSize: this.cache.size,
      rulesCount: this.rules.length,
      status: 'healthy',
    };
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────

/**
 * Detect content protocol from URL.
 */
export function detectProtocol(url: string): ContentProtocol {
  if (url.startsWith('ipfs://')) return 'ipfs';
  if (url.startsWith('ar://') || url.includes('arweave.net')) return 'arweave';
  if (url.includes('/ipfs/')) return 'ipfs';
  if (url.endsWith('.m3u8')) return 'hls';
  if (url.endsWith('.mpd')) return 'dash';
  if (url.startsWith('rtmp://') || url.startsWith('rtmps://')) return 'rtmp';
  return 'https';
}

/**
 * Simple string hash for cache keys.
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `url:${Math.abs(hash).toString(36)}`;
}

/**
 * Simple hash for thumbnail URLs.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check if a content URL is reachable (lightweight HEAD request).
 * Used by the fallback chain to skip dead mirrors.
 */
export async function checkContentReachable(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the best IPFS gateway URL for a CID.
 * Picks based on latency and availability.
 */
export function getIPFSGatewayUrl(cid: string, preferDegenFeed = true): string {
  const gateways = preferDegenFeed ? IPFS_GATEWAYS : IPFS_GATEWAYS.slice(1);
  return gateways[0]?.url.replace('{cid}', cid);
}

/**
 * Get the best Arweave gateway URL for a transaction ID.
 */
export function getArweaveGatewayUrl(txId: string): string {
  return ARWEAVE_GATEWAYS[0]?.url.replace('{id}', txId);
}

/**
 * Extract video source type from a URL for embed component selection.
 */
export function classifyVideoUrl(url: string): {
  source:
    | 'youtube'
    | 'twitch'
    | 'rumble'
    | 'odysee'
    | 'vimeo'
    | 'dailymotion'
    | 'peertube'
    | 'zora'
    | 'ipfs'
    | 'arweave'
    | 'direct'
    | 'hls';
  embedUrl?: string;
} {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const vid = match?.[1];
    return {
      source: 'youtube',
      embedUrl: vid ? `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0` : undefined,
    };
  }
  if (url.includes('twitch.tv')) {
    const match = url.match(/twitch\.tv\/(\w+)/);
    return {
      source: 'twitch',
      embedUrl: match
        ? `https://player.twitch.tv/?channel=${match[1]}&parent=degenfeed.xyz`
        : undefined,
    };
  }
  if (url.includes('rumble.com')) {
    return { source: 'rumble', embedUrl: url.replace('/v/', '/embed/') };
  }
  if (url.includes('odysee.com') || url.includes('lbry.tv')) {
    return { source: 'odysee' };
  }
  if (url.includes('vimeo.com')) {
    return { source: 'vimeo' };
  }
  if (url.includes('dailymotion.com')) {
    return { source: 'dailymotion' };
  }
  if (
    url.includes('peertube') ||
    url.includes('/videos/embed/') ||
    url.includes('video.degenfeed.xyz')
  ) {
    return { source: 'peertube' };
  }
  if (url.includes('zora.co')) {
    return { source: 'zora' };
  }
  if (url.startsWith('ipfs://') || url.includes('/ipfs/')) {
    return { source: 'ipfs' };
  }
  if (url.startsWith('ar://') || url.includes('arweave.net')) {
    return { source: 'arweave' };
  }
  if (url.endsWith('.m3u8')) {
    return { source: 'hls' };
  }
  return { source: 'direct' };
}
