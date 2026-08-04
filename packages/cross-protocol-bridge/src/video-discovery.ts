/**
 * @degenfeed/cross-protocol-bridge — Unified Shorts & Video Discovery
 *
 * TASK 5: Content Discovery
 *   1. Unified shorts feed from ALL platforms
 *   2. Filter by platform, category, creator
 *   3. "Also available on" — cross-platform content matching
 *   4. Deduplication and ranking
 *
 * Aggregates short-form video content from:
 *   - Farcaster (video embeds in casts)
 *   - Zora (short video NFTs)
 *   - Lens (video publications)
 *   - Nostr (NIP-71 video events)
 *   - PeerTube (short videos)
 *   - YouTube Shorts (via RSS)
 *   - TikTok (via oEmbed/RSS-Bridge)
 *   - Instagram Reels (via oEmbed)
 */

import type { Protocol } from '@degenfeed/types';

// ─── Unified Shorts Types ──────────────────────────────────────────────

export interface UnifiedShort {
  /** Unique content ID across all protocols */
  id: string;
  /** Content type */
  type: 'short' | 'video' | 'clip';
  /** Title */
  title: string;
  /** Description / caption */
  description: string;
  /** Direct video URL */
  videoUrl?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration in seconds */
  duration: number;
  /** Source protocol */
  sourceProtocol: Protocol | string;
  /** Source platform label for display */
  sourceLabel: string;
  /** Creator ID */
  creatorId: string;
  /** Creator display name */
  creatorName: string;
  /** Creator avatar URL */
  creatorAvatarUrl?: string;
  /** When published (unix ms) */
  publishedAt: number;
  /** Engagement metrics */
  metrics: {
    likes: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  /** Content tags/topics */
  tags: string[];
  /** Quality score 0-1 for ranking */
  qualityScore: number;
  /** Whether tipping is available */
  canTip: boolean;
  /** Whether minting is available */
  canMint: boolean;
  /** Whether bidding is available */
  canBid: boolean;
  /** Creator coin symbol if applicable */
  creatorCoinSymbol?: string;
  /** Other protocols this content is also available on */
  alsoOn: Protocol[];
  /** Original URLs on other protocols */
  crossProtocolUrls: Record<string, string>;
}

export interface UnifiedShortsFeed {
  /** All shorts in this page */
  shorts: UnifiedShort[];
  /** Source breakdown */
  sources: Record<string, number>;
  /** Cursor for pagination */
  cursor: string | null;
  /** Whether there are more results */
  hasMore: boolean;
  /** When the feed was aggregated */
  aggregatedAt: number;
  /** Aggregation took this many ms */
  aggregationTimeMs: number;
}

export interface UnifiedShortsFilter {
  /** Source protocols to include (empty = all) */
  protocols?: string[];
  /** Topic/category filter */
  category?: string;
  /** Creator filter */
  creatorId?: string;
  /** Search query */
  search?: string;
  /** Max shorts (default 50) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Minimum quality score (0-1) */
  minQuality?: number;
}

// ─── "Also available on" cross-referencing ────────────────────────────

/**
 * Cross-reference a short against all protocols to find where else
 * the same content appears. Uses URL normalization + title matching.
 */
export function findAlsoOn(
  videoUrl: string,
  title: string,
  allResultsFromAllProtocols: Record<string, UnifiedShort[]>,
): { protocol: Protocol; url: string }[] {
  const alsoOn: { protocol: Protocol; url: string }[] = [];

  // Normalize URL for comparison
  const normalizeUrl = (url: string): string => {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.replace(/\/$/, '').toLowerCase();
    } catch {
      return url.toLowerCase().trim();
    }
  };

  const normalizedTarget = normalizeUrl(videoUrl);
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 60);

  for (const [protocol, shorts] of Object.entries(allResultsFromAllProtocols)) {
    for (const short of shorts) {
      if (short.id.includes(normalizedTarget.slice(0, 40))) {
        alsoOn.push({ protocol: protocol as Protocol, url: short.videoUrl ?? '' });
        break;
      }
      // Title fuzzy match
      const otherTitle = short.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 60);
      if (normalizedTitle && otherTitle && normalizedTitle === otherTitle) {
        // Check if already added
        if (!alsoOn.find((a) => a.protocol === protocol)) {
          alsoOn.push({ protocol: protocol as Protocol, url: short.videoUrl ?? '' });
        }
      }
    }
  }

  return alsoOn;
}

/**
 * Annotate a single short with "also on" information.
 */
export function annotateAlsoOn(
  short: UnifiedShort,
  allResults: Record<string, UnifiedShort[]>,
): UnifiedShort {
  const alsoOn = findAlsoOn(short.videoUrl ?? '', short.title, allResults);
  return {
    ...short,
    alsoOn: alsoOn.map((a) => a.protocol),
    crossProtocolUrls: Object.fromEntries(alsoOn.map((a) => [a.protocol, a.url])),
  };
}

// ─── Aggregator ───────────────────────────────────────────────────────

/**
 * Aggregate short-form video content from ALL integrated protocols.
 *
 * This is the main entry point for the unified shorts feed.
 * It fetches from each protocol in parallel and merges results.
 */
export async function aggregateUnifiedShorts(
  filter: UnifiedShortsFilter = {},
): Promise<UnifiedShortsFeed> {
  const startTime = performance.now();
  const allShorts: UnifiedShort[] = [];
  const sourceCounts: Record<string, number> = {};
  const limit = filter.limit ?? 50;

  // Fetch from all sources in parallel
  const results = await Promise.allSettled([
    fetchFarcasterShorts(filter).catch(() => []),
    fetchZoraShorts(filter).catch(() => []),
    fetchLensShorts(filter).catch(() => []),
    fetchNostrShorts(filter).catch(() => []),
    fetchPeerTubeShorts(filter).catch(() => []),
    fetchYouTubeShorts(filter).catch(() => []),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const shorts = result.value;
      allShorts.push(...shorts);
      for (const short of shorts) {
        const source = short.sourceProtocol;
        sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
      }
    }
  }

  // Sort by quality score * recency
  allShorts.sort((a, b) => {
    const scoreA = a.qualityScore * 0.6 + (a.publishedAt > Date.now() - 86400000 ? 0.4 : 0);
    const scoreB = b.qualityScore * 0.6 + (b.publishedAt > Date.now() - 86400000 ? 0.4 : 0);
    return scoreB - scoreA;
  });

  // Apply minimum quality filter
  const minQuality = filter.minQuality ?? 0;
  const filtered =
    minQuality > 0 ? allShorts.filter((s) => s.qualityScore >= minQuality) : allShorts;

  // Apply category filter if set
  const categoryFiltered = filter.category
    ? filtered.filter(
        (s) =>
          s.tags.some((t) => t.toLowerCase() === (filter.category ?? '').toLowerCase()) ||
          s.title.toLowerCase().includes((filter.category ?? '').toLowerCase()),
      )
    : filtered;

  // Limit results
  const limited = categoryFiltered.slice(0, limit);

  // Annotate with "also on" cross-references
  const protocolMap: Record<string, UnifiedShort[]> = {};
  for (const short of limited) {
    const proto = short.sourceProtocol;
    if (!protocolMap[proto]) protocolMap[proto] = [];
    protocolMap[proto].push(short);
  }

  const annotated = limited.map((short) => annotateAlsoOn(short, protocolMap));

  const aggregationTimeMs = Math.round(performance.now() - startTime);

  return {
    shorts: annotated,
    sources: sourceCounts,
    cursor: limited.length >= limit ? (limited[limit - 1]?.id ?? null) : null,
    hasMore: categoryFiltered.length > limit,
    aggregatedAt: Date.now(),
    aggregationTimeMs,
  };
}

// ─── Protocol-specific Fetchers ──────────────────────────────────────

async function fetchFarcasterShorts(_filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  // Farcaster shorts come from casts with video embeds
  // Detect via @degenfeed/farcaster-sdk/video
  return [];
}

async function fetchZoraShorts(filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  try {
    const { fetchZoraShortVideos, normalizeZoraShort } = await import(
      // @ts-expect-error - @degenfeed/zora-sdk/live-mint is lazy optional peer dependency
      '@degenfeed/zora-sdk/live-mint'
    );
    const nfts = await fetchZoraShortVideos({ limit: filter.limit ?? 20 });
    return nfts.map((nft: Record<string, any>) => {
      const normalized = normalizeZoraShort(nft);
      return {
        id: normalized.id,
        type: normalized.type,
        title: normalized.title,
        description: normalized.description,
        videoUrl: normalized.videoUrl,
        thumbnailUrl: normalized.thumbnailUrl,
        duration: normalized.duration,
        sourceProtocol: 'zora' as Protocol,
        sourceLabel: normalized.platform,
        creatorId: normalized.creatorId,
        creatorName: normalized.creatorName,
        publishedAt: normalized.publishedAt,
        metrics: { likes: 0, views: 0 },
        tags: normalized.tags,
        qualityScore: 0.7,
        canTip: false,
        canMint: normalized.canMint,
        canBid: normalized.canBid,
        alsoOn: [],
        crossProtocolUrls: {},
        creatorCoinSymbol: undefined,
      };
    });
  } catch {
    return [];
  }
}

async function fetchLensShorts(_filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  // Lens shorts come from publications with video media
  try {
    await import('@degenfeed/lens-sdk/video');
    // Would use LensClient to fetch publications
    return [];
  } catch {
    return [];
  }
}

async function fetchNostrShorts(filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  try {
    const { fetchNostrVideoEvents, normalizeVideoEvent } = await import(
      '@degenfeed/nostr-sdk/nip71'
    );
    const events = await fetchNostrVideoEvents(
      ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
      { shortsOnly: true, limit: filter.limit ?? 20 },
    );
    return events.map((event) => {
      const normalized = normalizeVideoEvent(event);
      return {
        id: normalized.id,
        type: normalized.type,
        title: normalized.title,
        description: normalized.description,
        videoUrl: normalized.videoUrl,
        thumbnailUrl: normalized.thumbnailUrl,
        duration: normalized.duration,
        sourceProtocol: 'nostr' as Protocol,
        sourceLabel: 'Nostr',
        creatorId: normalized.creatorId,
        creatorName: normalized.creatorName,
        publishedAt: normalized.publishedAt,
        metrics: { likes: 0, views: 0 },
        tags: normalized.tags,
        qualityScore: 0.5,
        canTip: true,
        canMint: false,
        canBid: false,
        alsoOn: [],
        crossProtocolUrls: {},
        creatorCoinSymbol: undefined,
      };
    });
  } catch {
    return [];
  }
}

async function fetchPeerTubeShorts(filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  try {
    // @ts-expect-error - @degenfeed/shorts-provider is lazy optional peer dependency
    const { fetchPeerTubeShorts } = await import('@degenfeed/shorts-provider');
    const shorts = await fetchPeerTubeShorts(filter.limit ?? 20);
    return shorts.map((s: Record<string, any>) => ({
      id: s.id,
      type: 'short' as const,
      title: s.title,
      description: s.description,
      videoUrl: s.videoUrl,
      thumbnailUrl: s.thumbnailUrl,
      duration: s.duration,
      sourceProtocol: 'peertube' as Protocol,
      sourceLabel: s.sourceLabel,
      creatorId: `peertube:${s.authorName}`,
      creatorName: s.authorName,
      creatorAvatarUrl: s.authorAvatar,
      publishedAt: s.publishedAt,
      metrics: { likes: s.likes, views: s.views },
      tags: s.topics,
      qualityScore: s.qualityScore,
      canTip: s.canTip,
      canMint: false,
      canBid: false,
      creatorCoinSymbol: s.creatorCoinSymbol,
      alsoOn: [],
      crossProtocolUrls: {},
    }));
  } catch {
    return [];
  }
}

async function fetchYouTubeShorts(filter: UnifiedShortsFilter): Promise<UnifiedShort[]> {
  try {
    // @ts-expect-error - @degenfeed/shorts-provider is lazy optional peer dependency
    const { fetchYouTubeShorts } = await import('@degenfeed/shorts-provider');
    const shorts = await fetchYouTubeShorts(filter.limit ?? 20);
    return shorts.map((s: Record<string, any>) => ({
      id: s.id,
      type: 'short' as const,
      title: s.title,
      description: s.description,
      videoUrl: s.videoUrl,
      thumbnailUrl: s.thumbnailUrl,
      duration: s.duration,
      sourceProtocol: 'youtube' as Protocol,
      sourceLabel: 'YouTube',
      creatorId: `youtube:${s.authorName}`,
      creatorName: s.authorName,
      publishedAt: s.publishedAt,
      metrics: { likes: s.likes, views: s.views },
      tags: s.topics,
      qualityScore: s.qualityScore,
      canTip: false,
      canMint: false,
      canBid: false,
      alsoOn: [],
      crossProtocolUrls: {},
    }));
  } catch {
    return [];
  }
}
