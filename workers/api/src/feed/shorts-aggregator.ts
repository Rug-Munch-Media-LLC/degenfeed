/**
 * shorts-aggregator — Class-based aggregator for short-form video content.
 *
 * Fetches from all sources (YouTube Shorts, TikTok RSS, Instagram Reels,
 * PeerTube), normalizes to ShortPost, enriches with DegenFeed metadata,
 * ranks algorithmically, diversifies sources, and paginates.
 *
 * This is the core engine powering the /api/shorts/* endpoints.
 */

import {
  fetchInstagramReels,
  fetchPeerTubeShorts,
  fetchTikTokShorts,
  fetchYouTubeShorts,
  type ShortVideoItem,
  type ShortVideoSource,
  SOURCE_COLORS,
} from '@degenfeed/shorts-provider';
import { rankShorts, type UserInterestProfile } from '@degenfeed/shorts-provider/scorer';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ShortPost extends ShortVideoItem {
  sourceColor: string;
  canTip: boolean;
  creatorCoinSymbol?: string;
  creatorCoinAddress?: string;
}

export interface ShortsAggregatorOptions {
  /** Max videos to return (default 20) */
  limit?: number;
  /** Comma-separated topic filter */
  topics?: string[];
  /** Source filter ('all' or specific source) */
  source?: ShortVideoSource | 'all';
  /** Pagination cursor (video ID) */
  cursor?: string;
  /** Set of already-seen video IDs */
  seenIds?: Set<string>;
  /** User interest profile for personalization */
  userProfile?: UserInterestProfile;
  /** Seconds of history for trending (default: 604800 = 7 days) */
  trendingWindow?: number;
}

export interface ShortsFeedResponse {
  videos: ShortPost[];
  sources: Record<string, number>;
  cursor: string | null;
  hasMore: boolean;
  aggregatedAt: number;
}

// ─── Aggregator ─────────────────────────────────────────────────────────

export class ShortsAggregator {
  constructor(env: Env) {
    this.env = env;
  }

  // ── Main feed ───────────────────────────────────────────────────────

  /**
   * Get the main shorts feed — aggregate from all sources, rank, paginate.
   */
  async getFeed(opts: ShortsAggregatorOptions = {}): Promise<ShortsFeedResponse> {
    const { limit = 20, cursor, topics, seenIds = new Set() } = opts;

    const raw = await this.fetchAllSources(limit * 2);

    let videos = raw.videos.map((v) => this.enrichVideo(v));

    // Apply cursor pagination
    if (cursor) {
      const cursorIdx = videos.findIndex((v) => v.id === cursor);
      if (cursorIdx >= 0) {
        videos = videos.slice(cursorIdx + 1);
      }
    }

    // Apply topic filter
    if (topics && topics.length > 0) {
      videos = videos.filter((v) => v.topics.some((t) => topics.includes(t)));
    }

    // Filter seen IDs
    if (seenIds.size > 0) {
      videos = videos.filter((v) => !seenIds.has(v.id));
    }

    // Score and rank
    const ranked = this.scoreAndRank(videos);
    const diversified = this.diversifySources(ranked);
    const paginated = diversified.slice(0, limit);

    return {
      videos: paginated,
      sources: {
        peertube: raw.peertube,
        youtube: raw.youtube,
        tiktok: raw.tiktok,
        instagram: raw.instagram,
      },
      cursor: paginated.length > 0 ? (paginated[paginated.length - 1]?.id ?? null) : null,
      hasMore: diversified.length > limit,
      aggregatedAt: Date.now(),
    };
  }

  // ── Trending ─────────────────────────────────────────────────────────

  /**
   * Get trending shorts — highest engagement from last N seconds.
   */
  async getTrending(opts: ShortsAggregatorOptions = {}): Promise<ShortsFeedResponse> {
    const { limit = 20, trendingWindow = 7 * 24 * 60 * 60 } = opts;
    const cutoff = Date.now() - trendingWindow * 1000;

    const raw = await this.fetchAllSources(limit * 3);
    const videos = raw.videos.map((v) => this.enrichVideo(v)).filter((v) => v.publishedAt > cutoff);

    // Score by engagement velocity
    const scored = videos.map((v) => {
      const ageHours = Math.max(1, (Date.now() - v.publishedAt) / 3600000);
      const engagementRate = (v.likes + v.views * 0.01) / ageHours;
      return { ...v, _score: engagementRate };
    });

    scored.sort(
      (a, b) =>
        (b as typeof a & { _score: number })._score - (a as typeof a & { _score: number })._score,
    );
    const ranked = scored.map(({ _score: _, ...rest }) => rest);
    const paginated = ranked.slice(0, limit);

    return {
      videos: paginated,
      sources: raw.sources,
      cursor: paginated.length > 0 ? (paginated[paginated.length - 1]?.id ?? null) : null,
      hasMore: ranked.length > limit,
      aggregatedAt: Date.now(),
    };
  }

  // ── For You ──────────────────────────────────────────────────────────

  /**
   * Get personalized shorts for a user based on their interest profile.
   */
  async getForYou(
    userProfile: UserInterestProfile,
    opts: ShortsAggregatorOptions = {},
  ): Promise<ShortsFeedResponse> {
    const { limit = 20, seenIds = new Set() } = opts;

    const raw = await this.fetchAllSources(limit * 3);
    const enriched = raw.videos.map((v) => this.enrichVideo(v));

    // Use the existing rankShorts from scorer
    const ranked = rankShorts(enriched, userProfile, seenIds, limit * 2);

    const shortPosts = ranked.map((v) => this.enrichVideo(v));
    const diversified = this.diversifySources(shortPosts);
    const paginated = diversified.slice(0, limit);

    return {
      videos: paginated,
      sources: raw.sources,
      cursor: paginated.length > 0 ? (paginated[paginated.length - 1]?.id ?? null) : null,
      hasMore: diversified.length > limit,
      aggregatedAt: Date.now(),
    };
  }

  // ── By Source ────────────────────────────────────────────────────────

  /**
   * Get shorts filtered by a single source.
   */
  async getBySource(
    source: ShortVideoSource,
    opts: ShortsAggregatorOptions = {},
  ): Promise<ShortsFeedResponse> {
    const { limit = 20, cursor, topics } = opts;

    let videos: ShortVideoItem[] = [];

    switch (source) {
      case 'youtube':
        videos = await fetchYouTubeShorts(limit * 2);
        break;
      case 'peertube':
        videos = await fetchPeerTubeShorts(limit * 2);
        break;
      case 'tiktok_rss':
        videos = await fetchTikTokShorts(limit * 2);
        break;
      case 'instagram':
        videos = await fetchInstagramReels(limit * 2);
        break;
      default:
        break;
    }

    let enriched = videos.map((v) => this.enrichVideo(v));

    if (cursor) {
      const cursorIdx = enriched.findIndex((v) => v.id === cursor);
      if (cursorIdx >= 0) enriched = enriched.slice(cursorIdx + 1);
    }

    if (topics && topics.length > 0) {
      enriched = enriched.filter((v) => v.topics.some((t) => topics.includes(t)));
    }

    const paginated = enriched.slice(0, limit);

    return {
      videos: paginated,
      sources: { [source]: paginated.length },
      cursor: paginated.length > 0 ? (paginated[paginated.length - 1]?.id ?? null) : null,
      hasMore: enriched.length > limit,
      aggregatedAt: Date.now(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Fetch from all sources in parallel with graceful degradation.
   */
  private async fetchAllSources(limit: number): Promise<
    { videos: ShortVideoItem[]; sources: Record<string, number> } & {
      peertube: number;
      youtube: number;
      tiktok: number;
      instagram: number;
    }
  > {
    const [peerTubeResult, youTubeResult, tikTokResult, instagramResult] = await Promise.allSettled(
      [
        fetchPeerTubeShorts(limit),
        fetchYouTubeShorts(limit),
        fetchTikTokShorts(limit),
        fetchInstagramReels(limit),
      ],
    );

    const peerTubeVideos = peerTubeResult.status === 'fulfilled' ? peerTubeResult.value : [];
    const youTubeVideos = youTubeResult.status === 'fulfilled' ? youTubeResult.value : [];
    const tikTokVideos = tikTokResult.status === 'fulfilled' ? tikTokResult.value : [];
    const instagramVideos = instagramResult.status === 'fulfilled' ? instagramResult.value : [];

    const srcCounts: Record<string, number> = {
      peertube: peerTubeVideos.length,
      youtube: youTubeVideos.length,
      tiktok: tikTokVideos.length,
      instagram: instagramVideos.length,
    };
    return {
      videos: [...peerTubeVideos, ...youTubeVideos, ...tikTokVideos, ...instagramVideos],
      sources: srcCounts,
      peertube: peerTubeVideos.length,
      youtube: youTubeVideos.length,
      tiktok: tikTokVideos.length,
      instagram: instagramVideos.length,
    };
  }

  /**
   * Enrich a ShortVideoItem with DegenFeed metadata.
   */
  private enrichVideo(v: ShortVideoItem): ShortPost {
    const sourceColor = v.sourceColor ?? SOURCE_COLORS[v.source] ?? '#666666';

    return {
      ...v,
      sourceColor,
      canTip: v.canTip ?? v.source === 'peertube',
      creatorCoinSymbol: v.creatorCoinSymbol,
      creatorCoinAddress: v.creatorCoinAddress,
    };
  }

  /**
   * Simple scoring: engagement rate + freshness + source quality.
   */
  private scoreAndRank(videos: ShortPost[]): ShortPost[] {
    return [...videos].sort((a, b) => {
      const aScore = this.computeScore(a);
      const bScore = this.computeScore(b);
      return bScore - aScore;
    });
  }

  /**
   * Compute a composite score for a short video.
   */
  private computeScore(v: ShortPost): number {
    let score = 0;

    // Engagement rate (views + likes)
    if (v.views > 0) {
      const likeRatio = v.likes / Math.max(v.views, 1);
      score += Math.min(likeRatio * 20, 3); // up to 3 points
      // View count bonus
      if (v.views > 10000) score += 2;
      else if (v.views > 1000) score += 1;
    }

    // Freshness (decay over 7 days)
    const ageHours = Math.max(0, (Date.now() - v.publishedAt) / 3600000);
    score += Math.max(0, 1 - ageHours / 168) * 2; // up to 2 points

    // Quality signal
    score += v.qualityScore * 1.5;

    // Source preference
    if (v.source === 'peertube') score += 0.5; // prefer our own content

    return score;
  }

  /**
   * Diversify sources — avoid showing too many from same source in a row.
   * Interleaves sources so the feed has variety.
   */
  private diversifySources(videos: ShortPost[]): ShortPost[] {
    if (videos.length <= 4) return videos;

    const result: ShortPost[] = [];
    const buckets: Record<string, ShortPost[]> = {};

    // Group by source
    for (const v of videos) {
      const key = v.source;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(v);
    }

    // Round-robin interleaving
    const keys = Object.keys(buckets);
    let maxLen = 0;
    for (const k of keys) {
      const bucket = buckets[k];
      if (bucket && bucket.length > maxLen) maxLen = bucket.length;
    }

    for (let i = 0; i < maxLen; i++) {
      for (const key of keys) {
        const bucket = buckets[key];
        if (bucket && i < bucket.length) {
          result.push(bucket[i]!);
        }
      }
    }

    return result;
  }
}
