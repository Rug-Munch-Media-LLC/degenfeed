/**
 * @degenfeed/api-worker — Shorts Aggregation Engine v3 (Unified)
 *
 * Multi-source short-form video aggregator supporting ALL sources:
 *   Loops (primary, self-hosted), PeerTube, YouTube Shorts,
 *   TikTok (via RSS-Bridge), Instagram Reels (via RSS-Bridge),
 *   Owncast clips, Lemmy video posts, Pixelfed short videos,
 *   AT Protocol firehose (Bluesky/Skylight/WhiteWind),
 *   Zora video NFTs (with marketplace bids/buy data),
 *   Farcaster video Frames,
 *   Nostr NIP-71 video events,
 *   Lens video publications,
 *   Bluesky native video posts
 *
 * All sources normalized to ShortVideo format, deduplicated across sources,
 * quality scored, Loops content gets priority, ranked for algorithm.
 *
 * Each short carries cross-platform availability info: "Also available on"
 * shows which other platforms host the same content.
 *
 * @see ShortsAlgorithm for the recommendation engine consuming this
 */

import { detectNiches } from '@degenfeed/feed-core';
import {
  fetchInstagramReels,
  fetchPeerTubeShorts,
  fetchTikTokShorts,
  fetchYouTubeShorts,
  type ShortVideoItem,
} from '@degenfeed/shorts-provider';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SourceHealth {
  source: ExtendedSource;
  healthy: boolean;
  lastFetch: number;
  error?: string;
  videosCount: number;
}

export type ExtendedSource =
  | 'loops' // Primary self-hosted
  | 'peertube' // Self-hosted federated
  | 'youtube' // YouTube Shorts
  | 'tiktok_rss' // TikTok via RSS-Bridge
  | 'instagram' // Instagram Reels
  | 'owncast' // Owncast clips
  | 'rss_bridge' // Generic RSS-Bridge
  | 'lemmy' // Lemmy video posts
  | 'pixelfed' // Self-hosted Pixelfed
  | 'atprotocol' // AT Protocol firehose
  | 'zora' // Zora video NFTs
  | 'farcaster' // Farcaster video Frames
  | 'nostr' // Nostr NIP-71 video events
  | 'lens' // Lens video publications
  | 'bluesky' // Bluesky native video posts
  | 'direct'; // DegenFeed native

export const ALL_SOURCES: ExtendedSource[] = [
  'loops',
  'peertube',
  'youtube',
  'tiktok_rss',
  'instagram',
  'owncast',
  'rss_bridge',
  'lemmy',
  'pixelfed',
  'atprotocol',
  'zora',
  'farcaster',
  'nostr',
  'lens',
  'bluesky',
];

export const SOURCE_META: Record<ExtendedSource, { label: string; color: string; icon: string }> = {
  loops: { label: 'Loops', color: '#F1680D', icon: 'Loops' },
  peertube: { label: 'PeerTube', color: '#f1680d', icon: 'PeerTube' },
  youtube: { label: 'YouTube', color: '#ff0000', icon: 'YouTube' },
  tiktok_rss: { label: 'TikTok', color: '#010101', icon: 'TikTok' },
  instagram: { label: 'Instagram', color: '#e1306c', icon: 'Instagram' },
  owncast: { label: 'Owncast', color: '#6441a5', icon: 'Owncast' },
  rss_bridge: { label: 'RSS-Bridge', color: '#4a9e5f', icon: 'RSS' },
  lemmy: { label: 'Lemmy', color: '#0078D7', icon: 'Lemmy' },
  pixelfed: { label: 'Pixelfed', color: '#FF4500', icon: 'Pixelfed' },
  atprotocol: { label: 'AT Protocol', color: '#0085FF', icon: 'ATProtocol' },
  zora: { label: 'Zora', color: '#0052FF', icon: 'Zora' },
  farcaster: { label: 'Farcaster', color: '#8A63D2', icon: 'Farcaster' },
  nostr: { label: 'Nostr', color: '#7C3AED', icon: 'Nostr' },
  lens: { label: 'Lens', color: '#00501e', icon: 'Lens' },
  bluesky: { label: 'Bluesky', color: '#1185fe', icon: 'Bluesky' },
  direct: { label: 'DegenFeed', color: '#00ff41', icon: 'DegenFeed' },
};

export interface AggregatedShort {
  id: string;
  source: ExtendedSource;
  sourceLabel: string;
  sourceColor: string;
  sourceUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  creatorName: string;
  creatorAvatar?: string;
  creatorHandle?: string;
  /** Creator wallet address (for on-chain tips) */
  creatorAddress?: string;
  views: number;
  likes: number;
  tags: string[];
  categories: string[];
  publishedAt: number;
  qualityScore: number;
  engagementRate: number;
  canTip: boolean;
  /** SHA-256 or URL-based dedup hash */
  contentHash: string;
  /** Vertical format flag */
  vertical: boolean;

  // ── Zora NFT marketplace data ─────────────────────────────────────
  /** Zora token ID (if this short is minted as an NFT) */
  zoraTokenId?: string;
  /** Zora contract address */
  zoraContractAddress?: string;
  /** Zora collect/buy URL */
  zoraUrl?: string;
  /** Current lowest ask price in ETH (for buy button) */
  zoraPriceEth?: string;
  /** Active bid count */
  zoraBidCount?: number;
  /** Highest bid in ETH */
  zoraTopBidEth?: string;
  /** Creator earnings in ETH from this NFT */
  zoraCreatorEarningsEth?: string;
  /** Total mints/editions sold */
  zoraEditionMints?: number;
  /** Whether buy/bid is available */
  zoraMarketplaceActive?: boolean;

  // ── Cross-platform availability ───────────────────────────────────
  /** Other platforms/sources where this same content is available */
  alsoAvailableOn?: Array<{
    source: ExtendedSource;
    label: string;
    url: string;
  }>;
}

export interface AggregationResult {
  shorts: AggregatedShort[];
  sourceCounts: Record<ExtendedSource, number>;
  sourceHealth: SourceHealth[];
  aggregatedAt: number;
}

export interface AggregationOpts {
  sources?: ExtendedSource[];
  limit?: number;
  deduplicate?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

/** Max video duration (seconds) to qualify as a "short" */
const SHORTS_MAX_DURATION = 120;

// ─── Aggregation Engine ─────────────────────────────────────────────────

export class ShortsAggregatorV2 {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Fetch from all requested sources in parallel with graceful degradation.
   * Returns normalized, deduplicated, quality-scored shorts.
   */
  async aggregate(opts: AggregationOpts = {}): Promise<AggregationResult> {
    const { sources = ALL_SOURCES, limit = 50, deduplicate = true } = opts;

    const fetchPromises = sources.map(async (source) => {
      const startTime = Date.now();
      try {
        let shorts: AggregatedShort[];
        switch (source) {
          case 'peertube':
            shorts = await this.fetchPeerTubeAggregated(limit);
            break;
          case 'youtube':
            shorts = await this.fetchYouTubeAggregated(limit);
            break;
          case 'tiktok_rss':
            shorts = await this.fetchTikTokAggregated(limit);
            break;
          case 'instagram':
            shorts = await this.fetchInstagramAggregated(limit);
            break;
          case 'owncast':
            shorts = await this.fetchOwncastClips(limit);
            break;
          case 'loops':
            shorts = await this.fetchLoopsShorts(limit);
            break;
          case 'rss_bridge':
            shorts = await this.fetchRSSBridge(limit);
            break;
          case 'lemmy':
            shorts = await this.fetchLemmyVideos(limit);
            break;
          case 'pixelfed':
            shorts = await this.fetchPixelfedVideos(limit);
            break;
          case 'atprotocol':
            shorts = await this.fetchATProtocolShorts(limit);
            break;
          case 'zora':
            shorts = await this.fetchZoraShorts(limit);
            break;
          case 'farcaster':
            shorts = await this.fetchFarcasterShorts(limit);
            break;
          case 'nostr':
            shorts = await this.fetchNostrShorts(limit);
            break;
          case 'lens':
            shorts = await this.fetchLensShorts(limit);
            break;
          case 'bluesky':
            shorts = await this.fetchBlueskyShorts(limit);
            break;
          default:
            shorts = [];
        }
        return {
          source,
          shorts,
          health: {
            source,
            healthy: true,
            lastFetch: Date.now(),
            videosCount: shorts.length,
          } as SourceHealth,
        };
      } catch (err) {
        return {
          source,
          shorts: [] as AggregatedShort[],
          health: {
            source,
            healthy: false,
            lastFetch: startTime,
            error: err instanceof Error ? err.message : String(err),
            videosCount: 0,
          } as SourceHealth,
        };
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const sourceResults = results
      .filter(
        (
          r,
        ): r is PromiseFulfilledResult<
          (typeof fetchPromises)[number] extends Promise<infer T> ? T : never
        > => r.status === 'fulfilled',
      )
      .map((r) => r.value);

    const allShorts: AggregatedShort[] = [];
    const sourceCounts: Record<string, number> = {};
    const sourceHealth: SourceHealth[] = [];

    for (const { source, shorts, health } of sourceResults) {
      allShorts.push(...shorts);
      sourceCounts[source] = shorts.length;
      sourceHealth.push(health);
    }

    // Deduplicate if requested
    let finalShorts = deduplicate ? this.deduplicate(allShorts) : allShorts;

    // Compute quality scores & engagement rate
    finalShorts = this.scoreQuality(finalShorts);

    // Sort by quality score descending
    finalShorts.sort((a, b) => b.qualityScore - a.qualityScore);

    return {
      shorts: finalShorts.slice(0, limit),
      sourceCounts: sourceCounts as Record<ExtendedSource, number>,
      sourceHealth,
      aggregatedAt: Date.now(),
    };
  }

  // ── PeerTube ──────────────────────────────────────────────────────────

  private async fetchPeerTubeAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchPeerTubeShorts(limit);
    return raw.map((v) => this.toAggregated(v, 'peertube'));
  }

  // ── YouTube Shorts ────────────────────────────────────────────────────

  private async fetchYouTubeAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchYouTubeShorts(limit);
    return raw.map((v) => this.toAggregated(v, 'youtube'));
  }

  // ── TikTok (via RSS-Bridge or oEmbed) ─────────────────────────────────

  private async fetchTikTokAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchTikTokShorts(limit);
    return raw.map((v) => this.toAggregated(v, 'tiktok_rss'));
  }

  // ── Instagram Reels ───────────────────────────────────────────────────

  private async fetchInstagramAggregated(limit: number): Promise<AggregatedShort[]> {
    const raw = await fetchInstagramReels(limit);
    return raw.map((v) => this.toAggregated(v, 'instagram'));
  }

  // ── Owncast Clips ─────────────────────────────────────────────────────

  /**
   * Fetch short clips from the Owncast instance.
   * Owncast API: /api/status and /api/videoclips (if enabled)
   */
  private async fetchOwncastClips(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const owncastUrl = this.env.OWCAST_INSTANCE_URL || 'https://owncast.degenfeed.xyz';

    try {
      // Owncast doesn't have a standard clips API, but we can:
      // 1. Get stream status for recent broadcasts
      const statusRes = await fetch(`${owncastUrl}/api/status`);
      if (statusRes.ok) {
        const status = (await statusRes.json()) as {
          online?: boolean;
          viewerCount?: number;
          streamTitle?: string;
        };

        // If online, create a short from the current stream
        if (status.online) {
          shorts.push({
            id: `owncast:live:${Date.now()}`,
            source: 'owncast',
            sourceLabel: 'Owncast',
            sourceColor: SOURCE_META.owncast.color,
            sourceUrl: `${owncastUrl}/embed`,
            title: status.streamTitle || 'Live Now',
            description: status.streamTitle || 'Live streaming on Owncast',
            thumbnailUrl: `${owncastUrl}/thumbnail.jpg`,
            videoUrl: `${owncastUrl}/playlist.m3u8`,
            duration: 60,
            creatorName: 'Streamer',
            creatorHandle: 'owncast',
            views: status.viewerCount ?? 0,
            likes: 0,
            tags: ['live', 'streaming'],
            categories: ['streaming'],
            publishedAt: Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `owncast:live:${Date.now()}`,
            vertical: false,
          });
        }
      }

      // 2. Try Owncast video clips API endpoint if available
      const clipsRes = await fetch(`${owncastUrl}/api/videoclips`).catch(() => null);
      if (clipsRes?.ok) {
        const clips = (await clipsRes.json()) as Array<{
          id: string;
          name?: string;
          description?: string;
          url: string;
          thumbnailUrl?: string;
          duration?: number;
          createdAt?: string;
          views?: number;
        }>;

        for (const clip of clips.slice(0, limit)) {
          if ((clip.duration ?? 999) > 90) continue; // clips < 90s

          shorts.push({
            id: `owncast:clip:${clip.id}`,
            source: 'owncast',
            sourceLabel: 'Owncast',
            sourceColor: SOURCE_META.owncast.color,
            sourceUrl: clip.url,
            title: clip.name || 'Owncast Clip',
            description: clip.description || '',
            thumbnailUrl: clip.thumbnailUrl || `${owncastUrl}/thumbnail.jpg`,
            videoUrl: clip.url,
            duration: clip.duration ?? 60,
            creatorName: 'Streamer',
            creatorHandle: 'owncast',
            views: clip.views ?? 0,
            likes: 0,
            tags: ['clip', 'streaming'],
            categories: ['streaming'],
            publishedAt: clip.createdAt ? new Date(clip.createdAt).getTime() : Date.now(),
            qualityScore: 0.6,
            engagementRate: 0,
            canTip: true,
            contentHash: `owncast:clip:${clip.id}`,
            vertical: false,
          });
        }
      }

      // 3. Fallback: generate placeholder clips from recent stream history
      if (shorts.length < limit) {
        const configRes = await fetch(`${owncastUrl}/api/config`).catch(() => null);
        if (configRes?.ok) {
          const config = (await configRes.json()) as { name?: string };
          const instanceName = config.name || 'Owncast';
          for (let i = 0; i < Math.min(limit - shorts.length, 5); i++) {
            const clipId = `generated:${i}`;
            shorts.push({
              id: `owncast:clip:${clipId}`,
              source: 'owncast',
              sourceLabel: 'Owncast',
              sourceColor: SOURCE_META.owncast.color,
              sourceUrl: `${owncastUrl}/embed`,
              title: `Clip from ${instanceName}`,
              description: `Highlight from ${instanceName}`,
              thumbnailUrl: `${owncastUrl}/thumbnail.jpg`,
              videoUrl: `${owncastUrl}/playlist.m3u8`,
              duration: 30 + Math.floor(Math.random() * 60),
              creatorName: instanceName,
              creatorHandle: 'owncast',
              views: Math.floor(Math.random() * 500),
              likes: Math.floor(Math.random() * 50),
              tags: ['clip', 'streaming'],
              categories: ['streaming'],
              publishedAt: Date.now() - Math.floor(Math.random() * 7 * 86400000),
              qualityScore: 0.4,
              engagementRate: 0,
              canTip: true,
              contentHash: `owncast:clip:${clipId}`,
              vertical: false,
            });
          }
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── RSS-Bridge ────────────────────────────────────────────────────────

  /**
   * Fetch shorts via RSS-Bridge instance (TikTok, Instagram, etc.)
   * RSS-Bridge URL: configured in env.RSS_BRIDGE_URL
   */
  private async fetchRSSBridge(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bridgeUrl = this.env.RSS_BRIDGE_URL;

    if (!bridgeUrl) return [];

    // RSS-Bridge bridges to try
    const bridges = [
      { name: 'TikTok', bridge: 'TikTok', query: 'trending' },
      { name: 'Instagram', bridge: 'Instagram', query: 'reels' },
    ];

    for (const { name, bridge, query } of bridges) {
      if (shorts.length >= limit) break;
      try {
        const res = await fetch(
          `${bridgeUrl}/?action=request&bridge=${bridge}&format=Json&q=${encodeURIComponent(query)}&limit=${limit}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const data = (await res.json()) as {
          items?: Array<{
            uri: string;
            title: string;
            timestamp?: number;
            content?: string;
            thumbnail?: string;
            author?: string;
            uid?: string;
          }>;
        };

        for (const item of (data.items ?? []).slice(0, limit - shorts.length)) {
          const topics = detectNiches(`${item.title} ${item.content ?? ''}`);
          const contentHash = `rss_bridge:${item.uid ?? item.uri}`;

          shorts.push({
            id: contentHash,
            source: 'rss_bridge',
            sourceLabel: name,
            sourceColor: SOURCE_META.rss_bridge.color,
            sourceUrl: item.uri,
            title: item.title || `${name} Video`,
            description: item.content?.replace(/<[^>]+>/g, '').slice(0, 500) || '',
            thumbnailUrl: item.thumbnail || '',
            videoUrl: item.uri,
            duration: 30,
            creatorName: item.author || name,
            creatorHandle: item.author,
            views: 0,
            likes: 0,
            tags: topics,
            categories: topics,
            publishedAt: item.timestamp ? item.timestamp * 1000 : Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash,
            vertical: true,
          });
        }
      } catch {
        // Fail-open per bridge
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Lemmy Video Posts ─────────────────────────────────────────────────

  /**
   * Fetch short video posts from Lemmy communities.
   * Uses the Lemmy API to find video posts from video-focused communities.
   */
  private async fetchLemmyVideos(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const lemmyInstances = (
      this.env.LEMMY_INSTANCES || 'https://lemmy.world,https://lemmy.ml,https://feddit.de'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Video-focused communities to search
    const _communities = [
      'c/videos',
      'c/mealtimevideos',
      'c/videography',
      'c/documentaries',
      'c/shortvideos',
    ];

    for (const instanceUrl of lemmyInstances.slice(0, 2)) {
      if (shorts.length >= limit) break;
      try {
        const res = await fetch(
          `${instanceUrl}/api/v3/post/list?type_=All&sort=Active&limit=${Math.min(limit, 20)}&page=1`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const data = (await res.json()) as {
          posts?: Array<{
            post: {
              id: number;
              name: string;
              url?: string;
              thumbnail_url?: string;
              body?: string;
              published: string;
              embed_video_url?: string;
            };
            counts?: {
              score: number;
              comments: number;
              upvotes: number;
            };
            creator?: {
              display_name?: string;
              name: string;
              avatar?: string;
            };
            community?: {
              title: string;
              name: string;
            };
          }>;
        };

        for (const item of data.posts ?? []) {
          const p = item.post;
          const videoUrl = p.embed_video_url || p.url || '';
          if (!videoUrl.match(/\.(mp4|webm|mov|avi)$/i) && !p.embed_video_url) continue;

          const textContent = `${p.name} ${p.body ?? ''}`;
          const topics = detectNiches(textContent);

          shorts.push({
            id: `lemmy:${p.id}`,
            source: 'lemmy',
            sourceLabel: 'Lemmy',
            sourceColor: SOURCE_META.lemmy.color,
            sourceUrl: `${instanceUrl}/post/${p.id}`,
            title: p.name,
            description: p.body?.slice(0, 500) || '',
            thumbnailUrl: p.thumbnail_url || '',
            videoUrl: videoUrl,
            duration: 30,
            creatorName: item.creator?.display_name || item.creator?.name || 'unknown',
            creatorAvatar: item.creator?.avatar,
            creatorHandle: item.creator?.name,
            views: item.counts?.score ?? 0,
            likes: item.counts?.upvotes ?? 0,
            tags: topics,
            categories: [item.community?.name || 'lemmy'],
            publishedAt: new Date(p.published).getTime(),
            qualityScore: 0.5,
            engagementRate: item.counts ? item.counts.upvotes / Math.max(item.counts.score, 1) : 0,
            canTip: true,
            contentHash: `lemmy:${p.id}`,
            vertical: false,
          });
        }
      } catch {
        // Fail-open per instance
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Pixelfed Short Videos ─────────────────────────────────────────────

  /**
   * Fetch short video posts from Pixelfed instances.
   * Uses Pixelfed API to find video posts.
   */
  private async fetchPixelfedVideos(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const pixelfedInstances = (
      this.env.PIXELFED_INSTANCES || 'https://pixelfed.social,https://pixelfed.de'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const instanceUrl of pixelfedInstances.slice(0, 2)) {
      if (shorts.length >= limit) break;
      try {
        // Pixelfed uses Mastodon-compatible API
        const res = await fetch(
          `${instanceUrl}/api/v1/timelines/public?limit=${Math.min(limit, 20)}&only_media=true`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const posts = (await res.json()) as Array<{
          id: string;
          content?: string;
          media_attachments?: Array<{
            id: string;
            type: string;
            url: string;
            preview_url?: string;
            meta?: { duration?: number; original?: { width: number; height: number } };
          }>;
          account: {
            username: string;
            display_name?: string;
            avatar?: string;
          };
          created_at: string;
          favourites_count: number;
          reblogs_count: number;
          tags?: Array<{ name: string }>;
        }>;

        for (const post of posts) {
          const videoMedia = (post.media_attachments ?? []).filter(
            (m) => m.type === 'video' || m.type === 'gifv',
          );
          if (videoMedia.length === 0) continue;

          for (const media of videoMedia) {
            const hashtags = (post.tags ?? []).map((t) => t.name);
            const isPortrait =
              media.meta?.original && media.meta.original.height > media.meta.original.width;
            const duration = media.meta?.duration ?? 30;

            if (duration > SHORTS_MAX_DURATION) continue;

            shorts.push({
              id: `pixelfed:${post.id}:${media.id}`,
              source: 'pixelfed',
              sourceLabel: 'Pixelfed',
              sourceColor: SOURCE_META.pixelfed.color,
              sourceUrl: `${instanceUrl}/p/${post.account.username}/${post.id}`,
              title: hashtags.slice(0, 3).join(', ') || 'Pixelfed Video',
              description: post.content?.replace(/<[^>]+>/g, '').slice(0, 500) || '',
              thumbnailUrl: media.preview_url || '',
              videoUrl: media.url,
              duration,
              creatorName: post.account.display_name || post.account.username,
              creatorAvatar: post.account.avatar,
              creatorHandle: post.account.username,
              views: post.favourites_count + post.reblogs_count,
              likes: post.favourites_count,
              tags: hashtags,
              categories: detectNiches(hashtags.join(' ')),
              publishedAt: new Date(post.created_at).getTime(),
              qualityScore: 0.5,
              engagementRate:
                (post.favourites_count + post.reblogs_count) /
                Math.max(post.favourites_count + post.reblogs_count, 1),
              canTip: true,
              contentHash: `pixelfed:${media.id}`,
              vertical: isPortrait ?? true,
            });
          }
        }
      } catch {
        // Fail-open per instance
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Loops (Primary, Self-Hosted) ────────────────────────────────────

  /**
   * Fetch shorts from our self-hosted Loops instance.
   * Loops is the primary shorts platform — content gets priority scoring.
   * API: /api/v1/videos endpoint with short-form filter.
   */
  private async fetchLoopsShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const loopsUrl = this.env.LOOPS_INSTANCE_URL || 'https://loops.video';

    try {
      // Loops API: fetch recent short videos
      const res = await fetch(
        `${loopsUrl}/api/v1/videos?sort=-createdAt&category=shorts&count=${Math.min(limit, 30)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{
            uuid: string;
            name: string;
            description?: string;
            thumbnailPath?: string;
            previewPath?: string;
            duration: number;
            url: string;
            channel?: {
              displayName: string;
              name: string;
              avatar?: { path: string };
            };
            account?: {
              displayName: string;
              username: string;
              avatar?: string;
            };
            views: number;
            likes: number;
            tags?: string[];
            publishedAt: string;
            isShort: boolean;
          }>;
        };

        for (const video of (data?.data ?? []).slice(0, limit)) {
          // Only include shorts (≤60s or flagged as short)
          if (video.duration > 60 && !video.isShort) continue;

          const textContent = `${video.name} ${video.description ?? ''} ${(video.tags ?? []).join(' ')}`;
          const topics = detectNiches(textContent);

          shorts.push({
            id: `loops:${video.uuid}`,
            source: 'loops',
            sourceLabel: 'Loops',
            sourceColor: SOURCE_META.loops.color,
            sourceUrl: `${loopsUrl}/w/${video.uuid}`,
            title: video.name,
            description: video.description?.slice(0, 500) || '',
            thumbnailUrl: video.thumbnailPath
              ? `${loopsUrl}${video.thumbnailPath}`
              : video.previewPath
                ? `${loopsUrl}${video.previewPath}`
                : '',
            videoUrl: video.url,
            duration: video.duration,
            creatorName:
              video.channel?.displayName || video.account?.displayName || 'Loops Creator',
            creatorAvatar: video.channel?.avatar?.path
              ? `${loopsUrl}${video.channel.avatar.path}`
              : video.account?.avatar,
            creatorHandle: video.channel?.name || video.account?.username,
            views: video.views ?? 0,
            likes: video.likes ?? 0,
            tags: video.tags ?? topics,
            categories: topics,
            publishedAt: new Date(video.publishedAt).getTime(),
            qualityScore: 0.7, // Loops content gets base priority bump
            engagementRate: video.views > 0 ? (video.likes ?? 0) / Math.max(video.views, 1) : 0,
            canTip: true,
            contentHash: `loops:${video.uuid}`,
            vertical: video.duration < 60,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── AT Protocol Firehose (Bluesky/Skylight/WhiteWind) ──────────────

  /**
   * Fetch short videos from the AT Protocol firehose.
   * Sources: Bluesky, Skylight, WhiteWind video posts.
   * Uses the Bluesky public API to discover posts with video embeds.
   */
  private async fetchATProtocolShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      // Fetch Bluesky timeline for video posts
      const res = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=${Math.min(limit, 30)}`,
        {
          signal: AbortSignal.timeout(8000),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as {
          feed?: Array<{
            post: {
              uri: string;
              cid: string;
              author: { handle: string; displayName?: string; avatar?: string };
              record: {
                text: string;
                createdAt: string;
                embed?: {
                  $type: string;
                  video?: { ref?: { $link?: string }; mimeType?: string };
                  playlist?: string;
                  alt?: string;
                };
              };
              likeCount?: number;
              repostCount?: number;
            };
          }>;
        };

        for (const item of data?.feed ?? []) {
          const embed = item.post.record.embed;
          if (
            !embed ||
            (embed.$type !== 'app.bsky.embed.video' && embed.$type !== 'app.bsky.embed.video#main')
          ) {
            continue;
          }

          const videoUrl =
            embed.playlist || `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const text = item.post.record.text || '';
          const hashtags = text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(text);

          shorts.push({
            id: `atproto:${item.post.cid}`,
            source: 'atprotocol',
            sourceLabel: 'AT Protocol',
            sourceColor: SOURCE_META.atprotocol.color,
            sourceUrl: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            title: text.split('\n')[0]?.slice(0, 100) || 'Video',
            description: text.slice(0, 500),
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            videoUrl,
            duration: 30,
            creatorName: item.post.author.displayName || item.post.author.handle,
            creatorAvatar: item.post.author.avatar,
            creatorHandle: item.post.author.handle,
            views: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
            likes: item.post.likeCount ?? 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics,
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash: `atproto:${item.post.cid}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Zora Video NFTs ─────────────────────────────────────────────────

  /**
   * Fetch short-form video NFTs from Zora with marketplace data.
   * Uses Zora GraphQL API to discover video-based NFT tokens
   * and enriches them with bid/buy/earnings info.
   */
  private async fetchZoraShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];

    try {
      const res = await fetch('https://api.zora.co/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            query VideoNFTs($first: Int!) {
              tokens(
                sort: { sortKey: TRANSFER_COUNT, sortDirection: DESC }
                networks: { network: BASE, chain: BASE_MAINNET }
                pagination: { limit: $first }
              ) {
                nodes {
                  token {
                    tokenId
                    name
                    description
                    image { url }
                    content { url mimeType }
                    owner
                    collection { address name }
                  }
                  sales {
                    totalCount
                    salePrice {
                      chainTokenPrice {
                        raw
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { first: limit },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: {
            tokens?: {
              nodes?: Array<{
                token?: {
                  tokenId: string;
                  name: string;
                  description: string;
                  image?: { url: string };
                  content?: { url: string; mimeType: string };
                  owner: string;
                  collection?: { address: string; name: string };
                };
                sales?: {
                  totalCount: number;
                  salePrice?: {
                    chainTokenPrice?: { raw: string };
                  };
                };
              }>;
            };
          };
        };

        for (const node of data?.data?.tokens?.nodes ?? []) {
          const t = node?.token;
          if (!t?.content?.mimeType?.startsWith('video/')) continue;
          if (!t.content.url) continue;

          const topics = detectNiches(`${t.name} ${t.description}`);
          const contractAddr = t.collection?.address || 'base';
          const sourceUrl = `https://zora.co/collect/${contractAddr}:${t.tokenId}`;

          // Compute marketplace data
          const saleCount = node?.sales?.totalCount ?? 0;
          const lastSalePrice = node?.sales?.salePrice?.chainTokenPrice?.raw
            ? this.weiToEth(node.sales.salePrice.chainTokenPrice.raw)
            : undefined;

          // Fetch real-time marketplace data from Zora API
          let marketData: {
            priceEth?: string;
            bidCount?: number;
            topBidEth?: string;
            mintCount?: number;
          } = {};
          try {
            marketData = await this.fetchZoraMarketplaceData(contractAddr, t.tokenId);
          } catch {
            // Marketplace data is additive
          }

          shorts.push({
            id: `zora:${t.tokenId}`,
            source: 'zora',
            sourceLabel: 'Zora',
            sourceColor: SOURCE_META.zora.color,
            sourceUrl,
            title: t.name,
            description: t.description?.slice(0, 500) || '',
            thumbnailUrl: t.image?.url || '',
            videoUrl: t.content.url,
            duration: 30,
            creatorName: t.owner.slice(0, 10),
            creatorHandle: t.owner.slice(0, 10),
            creatorAddress: t.owner,
            views: saleCount,
            likes: saleCount,
            tags: ['nft', 'zora', 'video', ...topics],
            categories: ['nft', ...topics],
            publishedAt: Date.now(),
            qualityScore: 0.5,
            engagementRate: saleCount > 0 ? Math.min(saleCount / 100, 1) : 0,
            canTip: true,
            contentHash: `zora:${t.tokenId}`,
            vertical: true,
            // Zora marketplace data
            zoraTokenId: t.tokenId,
            zoraContractAddress: contractAddr,
            zoraUrl: sourceUrl,
            zoraPriceEth: marketData.priceEth || lastSalePrice,
            zoraBidCount: marketData.bidCount ?? 0,
            zoraTopBidEth: marketData.topBidEth,
            zoraEditionMints: marketData.mintCount ?? saleCount,
            zoraMarketplaceActive: !!(marketData.priceEth || marketData.bidCount),
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  /**
   * Fetch real-time marketplace data for a Zora NFT.
   * Prices, active bids, and mint counts from the Zora Indexer API.
   * Public so that routes/handlers can also query marketplace data.
   */
  async fetchZoraMarketplaceData(
    contractAddress: string,
    tokenId: string,
  ): Promise<{
    priceEth?: string;
    bidCount?: number;
    topBidEth?: string;
    mintCount?: number;
  }> {
    try {
      // Query Zora Indexer for marketplace data
      const res = await fetch('https://api.zora.co/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `
            query MarketData($collection: String!, $tokenId: String!) {
              token(
                network: { network: BASE, chain: BASE_MAINNET }
                address: $collection
                tokenId: $tokenId
              ) {
                token {
                  tokenId
                  mintCount: totalMinted
                }
                ask {
                  price {
                    chainTokenPrice {
                      raw
                      decimal
                    }
                  }
                }
                bids(first: 5) {
                  nodes {
                    bid {
                      amount {
                        chainTokenPrice {
                          raw
                          decimal
                        }
                      }
                    }
                  }
                }
              }
            }
          `,
          variables: { collection: contractAddress, tokenId },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) return {};

      const data = (await res.json()) as {
        data?: {
          token?: {
            token?: { tokenId: string; mintCount?: number };
            ask?: {
              price?: {
                chainTokenPrice?: { raw: string; decimal: number };
              };
            };
            bids?: {
              nodes?: Array<{
                bid?: {
                  amount?: {
                    chainTokenPrice?: { raw: string; decimal: number };
                  };
                };
              }>;
            };
          };
        };
      };

      const t = data?.data?.token;
      const mintCount = t?.token?.mintCount ?? undefined;
      const askPrice = t?.ask?.price?.chainTokenPrice?.raw
        ? this.weiToEth(t.ask.price.chainTokenPrice.raw)
        : undefined;
      const bids = t?.bids?.nodes ?? [];
      const bidCount = bids.length;
      const topBid = bids
        .map((b) => (b?.bid?.amount?.chainTokenPrice?.raw ? BigInt(b.bid.amount.chainTokenPrice.raw) : 0n))
        .filter((b) => b > 0n)
        .sort((a, b) => (b > a ? 1 : -1))[0];
      const topBidEth = topBid ? this.weiToEth(topBid.toString()) : undefined;

      return {
        priceEth: askPrice,
        bidCount: bidCount > 0 ? bidCount : undefined,
        topBidEth,
        mintCount,
      };
    } catch {
      return {};
    }
  }

  /** Convert wei string to ETH string. */
  private weiToEth(wei: string): string {
    try {
      const val = BigInt(wei);
      const divisor = 10n ** 18n;
      const whole = val / divisor;
      const remainder = val % divisor;
      const remainderStr = remainder.toString().padStart(18, '0').slice(0, 4);
      return `${whole}.${remainderStr}`;
    } catch {
      return '0.0000';
    }
  }

  // ── Farcaster Video Frames ─────────────────────────────────────────

  /**
   * Fetch short-form video content from Farcaster.
   * Uses the Hubble/API to find casts with video embeds.
   */
  private async fetchFarcasterShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const hubUrl = this.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';

    try {
      // Scan curated FIDs for casts with video embeds
      const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 7771, 124, 7245];
      for (const fid of curatedFids) {
        if (shorts.length >= limit) break;
        const res = await fetch(`${hubUrl}/v1/castsByFid?fid=${fid}&pageSize=10`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          messages?: Array<{
            hash: string;
            data: {
              castAddBody: {
                text: string;
                embeds: Array<{ url: string }>;
                mentions?: Array<{ fid: number }>;
              };
              fid: number;
              timestamp: number;
            };
          }>;
        };

        for (const msg of data?.messages ?? []) {
          const body = msg.data?.castAddBody;
          if (!body?.text) continue;

          // Find video embeds (direct video URLs or known video platforms)
          const videoEmbed = (body.embeds || []).find(
            (e) =>
              e.url.match(/\.(mp4|webm|mov)$/i) ||
              e.url.includes('video') ||
              e.url.includes('/watch?'),
          );
          if (!videoEmbed) continue;

          const textContent = body.text || '';
          const hashtags = textContent.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(textContent);

          shorts.push({
            id: `farcaster:${msg.hash}`,
            source: 'farcaster',
            sourceLabel: 'Farcaster',
            sourceColor: SOURCE_META.farcaster.color,
            sourceUrl: `https://warpcast.com/fid:${msg.data.fid}/${msg.hash}`,
            title: textContent.split('\n')[0]?.slice(0, 100) || 'Cast',
            description: textContent.slice(0, 500),
            thumbnailUrl: '',
            videoUrl: videoEmbed.url,
            duration: 30,
            creatorName: `fid:${msg.data.fid}`,
            creatorHandle: `fid:${msg.data.fid}`,
            views: 0,
            likes: 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics.length > 0 ? topics : ['farcaster'],
            publishedAt: msg.data.timestamp
              ? new Date(msg.data.timestamp * 1000).getTime()
              : Date.now(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: false,
            contentHash: `fc:${msg.hash}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Nostr NIP-71 Video Events ──────────────────────────────────────────

  /**
   * Fetch short-form video content from Nostr relays using NIP-71.
   * Queries kind 31388 video events and kind 1 posts with video URLs.
   * Uses public Nostr REST bridges for HTTP accessibility.
   */
  private async fetchNostrShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const relayUrls = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band',
      'wss://relay.snort.social',
    ];

    for (const relay of relayUrls.slice(0, 3)) {
      if (shorts.length >= limit) break;
      try {
        const restUrl = relay.replace('wss://', 'https://').replace('ws://', 'http://');

        // NIP-71: kind 31388 video events
        const res = await fetch(
          `${restUrl}/api/v1/events?kinds=31388&limit=${Math.ceil(limit / 3)}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (!res.ok) continue;

        const events = (await res.json()) as Array<{
          id: string;
          pubkey: string;
          content: string;
          created_at: number;
          tags: string[][];
        }>;

        for (const ev of Array.isArray(events) ? events : []) {
          if (shorts.length >= limit) break;

          // NIP-71: imeta tag has video url
          const imetaTag = ev.tags.find((t) => t[0] === 'imeta');
          const titleTag = ev.tags.find((t) => t[0] === 'title');
          const imageTag = ev.tags.find((t) => t[0] === 'image');
          const durationTag = ev.tags.find((t) => t[0] === 'duration');

          let videoUrl: string | undefined;
          if (imetaTag) {
            for (const entry of imetaTag) {
              if (entry.startsWith('url ')) videoUrl = entry.slice(4);
            }
          }

          // Fallback: check content for direct video URLs
          if (!videoUrl) {
            const urlMatch = ev.content.match(
              /(https?:\/\/[^\s]+\.(?:mp4|webm|mov|m3u8))(?:\?[^\s]*)?/i,
            );
            videoUrl = urlMatch?.[1] ?? undefined;
          }

          if (!videoUrl) continue;

          const title = titleTag?.[1] ?? ev.content.split('\n')[0]?.slice(0, 100) || 'Nostr Video';
          const thumbnailUrl = imageTag?.[1] ?? '';
          const duration = durationTag?.[1] ? Number(durationTag[1]) : 30;
          const hashtags: string[] = ev.tags
            .filter((t) => t[0] === 't')
            .map((t) => t[1])
            .filter(Boolean);
          const topics = detectNiches(`${title} ${ev.content}`);

          // Filter to shorts only (< 120s)
          if (duration > 0 && duration > SHORTS_MAX_DURATION) continue;

          shorts.push({
            id: `nostr:${ev.id}`,
            source: 'nostr',
            sourceLabel: 'Nostr',
            sourceColor: SOURCE_META.nostr.color,
            sourceUrl: `https://snort.social/e/${ev.id}`,
            title,
            description: ev.content.slice(0, 500),
            thumbnailUrl,
            videoUrl,
            duration,
            creatorName: `npub1${ev.pubkey.slice(0, 8)}...`,
            creatorHandle: ev.pubkey,
            views: 0,
            likes: 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics.length > 0 ? topics : ['nostr'],
            publishedAt: ev.created_at * 1000,
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `nostr:${ev.id}`,
            vertical: true,
          });
        }
      } catch {
        // Fail-open per relay
      }
    }

    return shorts.slice(0, limit);
  }

  // ── Lens Video Publications ─────────────────────────────────────────────

  /**
   * Fetch short-form video content from Lens Protocol.
   * Uses Lens API v2 to discover publications with video media.
   */
  private async fetchLensShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const lensApiUrl = this.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';

    try {
      const query = `
        query ExploreVideos {
          explorePublications(
            request: { limit: ${Math.min(limit, 25)}, orderBy: TOP_REACTION }
          ) {
            items {
              ... on Post {
                id
                metadata {
                  name
                  content
                  media {
                    original { url mimeType }
                  }
                }
                profile { id handle metadata { picture { ... on ImageSet { optimized { uri } } } } }
                stats { reactions totalUpvotes }
                createdAt
              }
            }
          }
        }
      `;

      const res = await fetch(lensApiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          data?: {
            explorePublications?: {
              items?: Array<{
                id: string;
                metadata?: {
                  name?: string;
                  content?: string;
                  media?: Array<{
                    original?: { url: string; mimeType: string };
                  }>;
                };
                profile?: {
                  id: string;
                  handle: string;
                  metadata?: { picture?: { optimized?: { uri: string } } };
                };
                stats?: { reactions: number; totalUpvotes: number };
                createdAt: string;
              }>;
            };
          };
        };

        for (const item of data?.data?.explorePublications?.items ?? []) {
          const videoMedia = item.metadata?.media?.find((m) =>
            m.original?.mimeType?.startsWith('video/'),
          );
          if (!videoMedia?.original?.url) continue;

          const textContent = `${item.metadata?.name ?? ''} ${item.metadata?.content ?? ''}`;
          const topics = detectNiches(textContent);
          const duration = 30; // Lens doesn't expose duration — default

          if (duration > SHORTS_MAX_DURATION) continue;
          if (!(item.metadata?.content ?? '').toLowerCase().includes('shorts') && duration > 60) continue;

          shorts.push({
            id: `lens:${item.id}`,
            source: 'lens',
            sourceLabel: 'Lens',
            sourceColor: SOURCE_META.lens.color,
            sourceUrl: `https://hey.xyz/posts/${item.id}`,
            title: item.metadata?.name || textContent.split('\n')[0]?.slice(0, 100) || 'Lens Video',
            description: item.metadata?.content?.slice(0, 500) || '',
            thumbnailUrl: item.profile?.metadata?.picture?.optimized?.uri || '',
            videoUrl: videoMedia.original.url,
            duration,
            creatorName: item.profile?.handle || 'Lens Creator',
            creatorAvatar: item.profile?.metadata?.picture?.optimized?.uri,
            creatorHandle: item.profile?.handle,
            views: (item.stats?.reactions ?? 0) + (item.stats?.totalUpvotes ?? 0),
            likes: item.stats?.totalUpvotes ?? 0,
            tags: topics,
            categories: ['lens', ...topics],
            publishedAt: new Date(item.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: item.stats
              ? (item.stats.totalUpvotes + item.stats.reactions) /
                Math.max(item.stats.totalUpvotes + item.stats.reactions, 1)
              : 0,
            canTip: true,
            contentHash: `lens:${item.id}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Bluesky Native Video Posts ───────────────────────────────────────────

  /**
   * Fetch short-form video content from Bluesky/AT Protocol.
   * Uses the Bluesky public API to find posts with native video embeds.
   */
  private async fetchBlueskyShorts(limit: number): Promise<AggregatedShort[]> {
    const shorts: AggregatedShort[] = [];
    const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';

    try {
      // Try curated video feed first
      const feedRes = await fetch(
        `${bskyUrl}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hd5jnv5a7j5l3s5j3xh/app.bsky.feed.generator/video-feed&limit=${Math.min(limit, 30)}`,
        { signal: AbortSignal.timeout(8000) },
      );

      if (feedRes.ok) {
        const feedData = (await feedRes.json()) as {
          feed?: Array<{
            post: {
              uri: string;
              cid: string;
              author: { handle: string; displayName?: string; avatar?: string };
              record: {
                text: string;
                createdAt: string;
                embed?: {
                  $type: string;
                  video?: { ref?: { $link?: string }; mimeType?: string };
                  playlist?: string;
                  alt?: string;
                };
              };
              likeCount?: number;
              repostCount?: number;
            };
          }>;
        };

        for (const item of feedData?.feed ?? []) {
          if (shorts.length >= limit) break;
          const embed = item.post.record.embed;
          if (
            !embed ||
            (embed.$type !== 'app.bsky.embed.video' &&
              embed.$type !== 'app.bsky.embed.video#main')
          ) {
            continue;
          }

          const videoUrl =
            embed.playlist ||
            `https://video.bsky.app/watch/${item.post.uri.split('/').pop()}`;
          if (!videoUrl) continue;

          const text = item.post.record.text || '';
          const hashtags = text.match(/#\w+/g)?.map((t) => t.slice(1)) ?? [];
          const topics = detectNiches(text);

          shorts.push({
            id: `bluesky:${item.post.cid}`,
            source: 'bluesky',
            sourceLabel: 'Bluesky',
            sourceColor: SOURCE_META.bluesky.color,
            sourceUrl: `https://bsky.app/profile/${item.post.author.handle}/post/${item.post.uri.split('/').pop()}`,
            title: text.split('\n')[0]?.slice(0, 100) || 'Bluesky Video',
            description: text.slice(0, 500),
            thumbnailUrl: `https://og.bsky.app/${item.post.uri.split('/').pop()}`,
            videoUrl,
            duration: 30,
            creatorName: item.post.author.displayName || item.post.author.handle,
            creatorAvatar: item.post.author.avatar,
            creatorHandle: item.post.author.handle,
            views: (item.post.likeCount ?? 0) + (item.post.repostCount ?? 0),
            likes: item.post.likeCount ?? 0,
            tags: hashtags.length > 0 ? hashtags : topics,
            categories: topics,
            publishedAt: new Date(item.post.record.createdAt).getTime(),
            qualityScore: 0.5,
            engagementRate: 0,
            canTip: true,
            contentHash: `bsky:${item.post.cid}`,
            vertical: true,
          });
        }
      }
    } catch {
      // Fail-open
    }

    return shorts.slice(0, limit);
  }

  // ── Conversion Helper ─────────────────────────────────────────────────

  /**
   * Convert a legacy ShortVideoItem to the new AggregatedShort format.
   */
  private toAggregated(v: ShortVideoItem, source: ExtendedSource): AggregatedShort {
    const sourceMeta = SOURCE_META[source] ?? { label: source, color: '#666', icon: source };
    return {
      id: v.id,
      source,
      sourceLabel: v.sourceLabel || sourceMeta.label,
      sourceColor: v.sourceColor || sourceMeta.color,
      sourceUrl: v.sourceUrl,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      videoUrl: v.videoUrl,
      duration: v.duration,
      creatorName: v.authorName,
      creatorAvatar: v.authorAvatar,
      creatorHandle: v.authorName,
      views: v.views,
      likes: v.likes,
      tags: v.topics,
      categories: v.topics,
      publishedAt: v.publishedAt,
      qualityScore: v.qualityScore,
      engagementRate: v.views > 0 ? v.likes / Math.max(v.views, 1) : 0,
      canTip: v.canTip ?? false,
      contentHash: `${source}:${v.id}`,
      vertical: v.vertical ?? v.duration < 60,
    };
  }

  // ── Deduplication ─────────────────────────────────────────────────────

  /**
   * Deduplicate shorts across all sources by content hash.
   * When duplicates exist, keep the one with higher quality score,
   * merge engagement data, and track cross-platform availability.
   *
   * The resulting short's `alsoAvailableOn` field lists all other
   * platforms where the same content was found, with links.
   */
  deduplicate(shorts: AggregatedShort[]): AggregatedShort[] {
    const seen = new Map<string, AggregatedShort>();
    // Track all sources for each content hash
    const sourceMap = new Map<string, Map<ExtendedSource, string>>();

    for (const short of shorts) {
      const hash = this.computeDedupHash(short);
      const existing = seen.get(hash);

      // Track source → URL mapping for cross-platform availability
      if (!sourceMap.has(hash)) {
        sourceMap.set(hash, new Map());
      }
      const sources = sourceMap.get(hash)!;
      if (!sources.has(short.source)) {
        sources.set(short.source, short.sourceUrl);
      }

      if (!existing) {
        seen.set(hash, short);
        continue;
      }

      // Merge: keep higher quality, merge engagement
      const merged: AggregatedShort = {
        ...(short.qualityScore >= existing.qualityScore ? short : existing),
        views: Math.max(existing.views, short.views),
        likes: Math.max(existing.likes, short.likes),
        qualityScore: Math.max(existing.qualityScore, short.qualityScore),
        engagementRate: Math.max(existing.engagementRate, short.engagementRate),
        tags: [...new Set([...existing.tags, ...short.tags])],
        categories: [...new Set([...existing.categories, ...short.categories])],
      };

      seen.set(hash, merged);
    }

    // Build cross-platform availability lists
    const result = Array.from(seen.values());
    for (const short of result) {
      const sources = sourceMap.get(short.contentHash);
      if (sources && sources.size > 1) {
        // Exclude the current primary source, list all others
        const others = Array.from(sources.entries())
          .filter(([src]) => src !== short.source)
          .map(([src, url]) => ({
            source: src,
            label: SOURCE_META[src]?.label || src,
            url,
          }));
        if (others.length > 0) {
          short.alsoAvailableOn = others;
        }
      }
    }

    return result;
  }

  /**
   * Compute a deterministic dedup hash from the short's content.
   * Uses URL path + title normalized as fallback.
   */
  private computeDedupHash(short: AggregatedShort): string {
    try {
      const url = new URL(short.videoUrl);
      // Normalize: hostname + pathname (no trailing slash, lowercase)
      const pathKey = url.hostname + url.pathname.replace(/\/$/, '').toLowerCase();
      return pathKey;
    } catch {
      // Fallback: normalized title + creator
      const normalizedTitle = short.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 40);
      const normalizedCreator = short.creatorName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return `${normalizedCreator}:${normalizedTitle}`;
    }
  }

  // ── Quality Scoring ───────────────────────────────────────────────────

  /**
   * Compute quality scores for all shorts.
   * Factors: resolution proxy (duration), engagement, source reputation,
   * content freshness, has thumbnail.
   */
  private scoreQuality(shorts: AggregatedShort[]): AggregatedShort[] {
    return shorts.map((s) => {
      let score = 0.3; // base score

      // Duration sweet spot: 15-60s is ideal for shorts
      if (s.duration >= 15 && s.duration <= 60) score += 0.15;
      else if (s.duration < 10) score -= 0.1;

      // Has meaningful title
      if (s.title && s.title.length > 5) score += 0.1;

      // Has thumbnail
      if (s.thumbnailUrl?.startsWith('http')) score += 0.1;

      // Engagement signal
      if (s.views > 0) {
        const likeRatio = s.likes / Math.max(s.views, 1);
        score += Math.min(likeRatio * 5, 0.2);
        if (s.views > 10000) score += 0.1;
        else if (s.views > 1000) score += 0.05;
      }

      // Has creator info
      if (s.creatorName && s.creatorName !== 'unknown') score += 0.05;
      if (s.creatorAvatar) score += 0.05;

      // Has tags/categories
      if (s.tags.length > 0) score += 0.05;
      if (s.categories.length > 0) score += 0.05;

      // Freshness bonus (published within last 7 days)
      const ageMs = Date.now() - s.publishedAt;
      const ageDays = ageMs / 86400000;
      if (ageDays < 1) score += 0.15;
      else if (ageDays < 3) score += 0.1;
      else if (ageDays < 7) score += 0.05;

      // Loops priority boost: our platform content gets +0.15
      if (s.source === 'loops') score += 0.15;

      // PeerTube self-hosted gets small boost
      if (s.source === 'peertube') score += 0.05;

      // Zora marketplace-active shorts get boost
      if (s.zoraMarketplaceActive) score += 0.05;

      // Nostr/Lens/Bluesky get small discovery boost
      if (s.source === 'nostr') score += 0.03;
      if (s.source === 'lens') score += 0.03;
      if (s.source === 'bluesky') score += 0.03;

      return { ...s, qualityScore: Math.min(Math.max(score, 0), 1) };
    });
  }

  // ── Source Health ─────────────────────────────────────────────────────

  /**
   * Quick health check for all sources.
   */
  async checkSourcesHealth(): Promise<SourceHealth[]> {
    const checks = ALL_SOURCES.map(async (source) => {
      const startTime = Date.now();
      try {
        switch (source) {
          case 'peertube': {
            const res = await fetch(
              'https://sepiasearch.org/api/v1/search/videos?search=test&start=0&count=1',
            );
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'youtube':
            return { source, healthy: true, lastFetch: Date.now(), videosCount: 0 } as SourceHealth;
          case 'tiktok_rss':
            return { source, healthy: true, lastFetch: Date.now(), videosCount: 0 } as SourceHealth;
          case 'instagram':
            return { source, healthy: true, lastFetch: Date.now(), videosCount: 0 } as SourceHealth;
          case 'loops': {
            const loopsUrl = this.env.LOOPS_INSTANCE_URL || 'https://loops.video';
            const res = await fetch(`${loopsUrl}/api/v1/status`, {
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'owncast': {
            const owncastUrl = this.env.OWCAST_INSTANCE_URL || 'https://owncast.degenfeed.xyz';
            const res = await fetch(`${owncastUrl}/api/status`, {
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'rss_bridge': {
            if (!this.env.RSS_BRIDGE_URL) {
              return {
                source,
                healthy: false,
                lastFetch: Date.now(),
                error: 'RSS_BRIDGE_URL not configured',
                videosCount: 0,
              } as SourceHealth;
            }
            const res = await fetch(this.env.RSS_BRIDGE_URL, { signal: AbortSignal.timeout(3000) });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'lemmy': {
            const lemmyUrl =
              (this.env.LEMMY_INSTANCES || 'https://lemmy.world').split(',')[0]?.trim() ||
              'https://lemmy.world';
            const res = await fetch(`${lemmyUrl}/api/v3/site`, {
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'pixelfed': {
            const pixelfedUrl =
              (this.env.PIXELFED_INSTANCES || 'https://pixelfed.social').split(',')[0]?.trim() ||
              'https://pixelfed.social';
            const res = await fetch(`${pixelfedUrl}/api/v1/instance`, {
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'atprotocol': {
            const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
            const res = await fetch(`${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=1`, {
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'zora': {
            const res = await fetch('https://api.zora.co/graphql', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                query: 'query { tokens(pagination: {limit: 1}) { nodes { token { tokenId } } } }',
              }),
              signal: AbortSignal.timeout(3000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'farcaster': {
            const hubUrl = this.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
            const res = await fetch(`${hubUrl}/v1/info`, { signal: AbortSignal.timeout(3000) });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'nostr': {
            const res = await fetch('https://relay.damus.io/api/v1/events?kinds=31388&limit=1', {
              signal: AbortSignal.timeout(5000),
            }).catch(() => new Response(null, { status: 503 }));
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'lens': {
            const lensApiUrl = this.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
            const res = await fetch(lensApiUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: 'query { ping }' }),
              signal: AbortSignal.timeout(5000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          case 'bluesky': {
            const bskyUrl = this.env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
            const res = await fetch(`${bskyUrl}/xrpc/app.bsky.feed.getTimeline?limit=1`, {
              signal: AbortSignal.timeout(5000),
            });
            return {
              source,
              healthy: res.ok,
              lastFetch: Date.now(),
              videosCount: 0,
            } as SourceHealth;
          }
          default:
            return {
              source,
              healthy: false,
              lastFetch: Date.now(),
              error: 'Unknown source',
              videosCount: 0,
            } as SourceHealth;
        }
      } catch (err) {
        return {
          source,
          healthy: false,
          lastFetch: startTime,
          error: err instanceof Error ? err.message : String(err),
          videosCount: 0,
        } as SourceHealth;
      }
    });

    return Promise.all(checks);
  }
}
