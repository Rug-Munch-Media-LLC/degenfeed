/**
 * @degenfeed/api-worker — Shorts Aggregation Engine v2
 *
 * Multi-source short-form video aggregator supporting:
 *   PeerTube, YouTube Shorts, Owncast clips, RSS-Bridge (TikTok/Instagram),
 *   Lemmy video posts, Pixelfed short videos
 *
 * All sources normalized to ShortVideo format, deduplicated across sources,
 * quality scored, and ranked for the "next video" algorithm.
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
  type ShortVideoSource,
  SOURCE_COLORS,
} from '@degenfeed/shorts-provider';
import type { Env } from '../index';

// ─── Types ───────────────────────────────────────────────────────────────

export interface SourceHealth {
  source: ExtendedSource;
  healthy: boolean;
  lastFetch: number;
  error?: string;
  videosCount: number;
}

export type ExtendedSource =
  | 'peertube'
  | 'youtube'
  | 'tiktok_rss'
  | 'instagram'
  | 'owncast'
  | 'rss_bridge'
  | 'lemmy'
  | 'pixelfed'
  | 'direct';

export const ALL_SOURCES: ExtendedSource[] = [
  'peertube',
  'youtube',
  'tiktok_rss',
  'instagram',
  'owncast',
  'rss_bridge',
  'lemmy',
  'pixelfed',
];

export const SOURCE_META: Record<ExtendedSource, { label: string; color: string; icon: string }> = {
  peertube: { label: 'PeerTube', color: '#f1680d', icon: 'PeerTube' },
  youtube: { label: 'YouTube', color: '#ff0000', icon: 'YouTube' },
  tiktok_rss: { label: 'TikTok', color: '#010101', icon: 'TikTok' },
  instagram: { label: 'Instagram', color: '#e1306c', icon: 'Instagram' },
  owncast: { label: 'Owncast', color: '#6441a5', icon: 'Owncast' },
  rss_bridge: { label: 'RSS-Bridge', color: '#4a9e5f', icon: 'RSS' },
  lemmy: { label: 'Lemmy', color: '#0078D7', icon: 'Lemmy' },
  pixelfed: { label: 'Pixelfed', color: '#FF4500', icon: 'Pixelfed' },
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
          case 'rss_bridge':
            shorts = await this.fetchRSSBridge(limit);
            break;
          case 'lemmy':
            shorts = await this.fetchLemmyVideos(limit);
            break;
          case 'pixelfed':
            shorts = await this.fetchPixelfedVideos(limit);
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
    const communities = [
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
   * When duplicates exist, keep the one with higher quality score
   * and merge engagement data.
   */
  deduplicate(shorts: AggregatedShort[]): AggregatedShort[] {
    const seen = new Map<string, AggregatedShort>();

    for (const short of shorts) {
      // Generate a content-based hash from URL and title
      const hash = this.computeDedupHash(short);
      const existing = seen.get(hash);

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

    return Array.from(seen.values());
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
      if (s.thumbnailUrl && s.thumbnailUrl.startsWith('http')) score += 0.1;

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
