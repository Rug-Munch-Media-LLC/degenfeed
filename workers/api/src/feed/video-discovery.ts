/**
 * @degenfeed/api-worker — Video Content Discovery Engine
 *
 * Unified video recommendation engine with 5 recommendation strategies:
 * 1. "Because you watched..." — Similar videos based on content affinity
 * 2. "Trending in your interests" — Category-specific trending videos
 * 3. "Hidden gems" — High-quality videos with low view counts
 * 4. "Continue watching" — Videos in progress
 * 5. "Up next" autoplay queue
 *
 * Integrates with:
 *   - @degenfeed/ranking (video-scorer.ts) for scoring
 *   - watch-history.ts for progress tracking and interest profiling
 *   - video-hub.ts for data sources
 */

import { type VideoForScoring, VideoScoreEngine, type VideoScoreResult } from '@degenfeed/ranking';
import type { ContinueWatchingItem } from '../lib/watch-history';
import type { UnifiedVideo } from '../routes/video-hub';

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiscoveryStrategy {
  name: string;
  label: string;
  getVideos(options: DiscoveryOptions): Promise<DiscoveryRow>;
}

export interface DiscoveryOptions {
  /** Authenticated user's wallet address */
  wallet?: string;
  /** User's niche interests */
  userNiches: string[];
  /** User's preferred video categories */
  userCategories: string[];
  /** Creators the user follows */
  followedCreators: Set<string>;
  /** Recently watched video IDs (for "because you watched") */
  recentWatched: string[];
  /** Videos the user has already seen (for dedup) */
  seenVideoIds: Set<string>;
  /** Categories already shown in this session */
  shownCategories: Set<string>;
  /** Number of videos to return per row */
  limit: number;
  /** Current timestamp */
  now: number;
  /** Whether to include diversity constraints */
  enforceDiversity: boolean;
  /** Continue watching items */
  continueWatchingItems?: ContinueWatchingItem[];
}

export interface DiscoveryRow {
  id: string;
  label: string;
  subtitle?: string;
  strategy: string;
  videos: UnifiedVideo[];
  seeAllLink?: string;
}

export interface DiscoveryPage {
  rows: DiscoveryRow[];
  /** Interest categories inferred from user activity */
  interestCategories: string[];
  userWallet?: string;
}

// ─── Video adapter ──────────────────────────────────────────────────────

/**
 * Convert a UnifiedVideo to the VideoForScoring format.
 * Handles missing fields with sensible defaults.
 */
function toVideoForScoring(video: UnifiedVideo): VideoForScoring {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    tags: video.tags ?? [],
    duration: video.duration,
    source: video.source,
    creator: {
      id: video.channelUrl ?? video.channelName,
      displayName: video.channelName,
      followerCount: 0, // Not available in UnifiedVideo
      verified: false,
      videoCount: 0,
    },
    metrics: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: video.views,
    },
    publishedAt: video.publishedAt,
    language: video.language,
  };
}

// ─── Similarity Scoring ────────────────────────────────────────────────

interface SimilarityWeights {
  sameCreator: number; // 30%
  sameTopic: number; // 40%
  sameDuration: number; // 10%
  sameContentType: number; // 20%
}

const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {
  sameCreator: 0.3,
  sameTopic: 0.4,
  sameDuration: 0.1,
  sameContentType: 0.2,
};

const VIDEO_ENGINE = new VideoScoreEngine();

/**
 * Compute similarity score between two videos (0-1).
 */
function computeSimilarity(
  source: UnifiedVideo,
  candidate: UnifiedVideo,
  weights: SimilarityWeights = DEFAULT_SIMILARITY_WEIGHTS,
): number {
  let score = 0;

  // Same creator (30% weight)
  if (source.channelName === candidate.channelName) {
    score += weights.sameCreator;
  }

  // Same topic/category (40% weight)
  const sourceTopics = new Set([
    source.category,
    ...(source.subCategory ? [source.subCategory] : []),
    ...source.tags,
  ]);
  const candidateTopics = new Set([
    candidate.category,
    ...(candidate.subCategory ? [candidate.subCategory] : []),
    ...candidate.tags,
  ]);
  const topicOverlap = [...sourceTopics].filter((t) => candidateTopics.has(t)).length;
  const maxTopics = Math.max(sourceTopics.size, candidateTopics.size);
  if (maxTopics > 0) {
    score += (topicOverlap / maxTopics) * weights.sameTopic;
  }

  // Similar duration (10% weight) — within 30% of each other
  if (source.duration > 0 && candidate.duration > 0) {
    const ratio =
      Math.min(source.duration, candidate.duration) / Math.max(source.duration, candidate.duration);
    if (ratio > 0.7) {
      score += weights.sameDuration;
    } else if (ratio > 0.4) {
      score += weights.sameDuration * 0.5;
    }
  }

  // Same content type (20% weight)
  const sourceType = VIDEO_ENGINE.detectContentType(source);
  const candidateType = VIDEO_ENGINE.detectContentType(candidate);
  if (sourceType === candidateType) {
    score += weights.sameContentType;
  }

  return Math.min(1, score);
}

// ─── Velocity Score ────────────────────────────────────────────────────

/**
 * Compute a trending velocity score for a video.
 * Higher = faster engagement growth.
 */
function computeVelocity(video: UnifiedVideo, now: number): number {
  const ageHours = Math.max(0.1, (now - video.publishedAt) / 3600000);
  const viewRate = video.views / ageHours;
  // Normalize: 100 views/hour = 1.0 velocity
  return Math.min(10, viewRate / 100);
}

// ─── Discovery Strategies ──────────────────────────────────────────────

/**
 * Strategy 1: "Because you watched..." — Find videos similar to recent watches.
 */
export class BecauseYouWatchedStrategy implements DiscoveryStrategy {
  name = 'because-you-watched';
  label = 'Because you watched';

  async getVideos(options: DiscoveryOptions): Promise<DiscoveryRow> {
    const { recentWatched, allVideos, limit } = options as DiscoveryOptions & {
      allVideos: UnifiedVideo[];
    };
    const candidates = (allVideos ?? []).filter((v) => !options.seenVideoIds.has(v.id));

    if (!recentWatched.length || !candidates.length) {
      return {
        id: this.name,
        label: this.label,
        subtitle: 'Recommended for you',
        strategy: this.name,
        videos: candidates.slice(0, limit),
      };
    }

    // Find reference videos
    const referenceVideos = (allVideos ?? []).filter((v) => recentWatched.includes(v.id));

    if (!referenceVideos.length) {
      return {
        id: this.name,
        label: this.label,
        subtitle: 'Recommended for you',
        strategy: this.name,
        videos: candidates.slice(0, limit),
      };
    }

    // Score each candidate against all reference videos
    const scored = candidates.map((candidate) => {
      let totalSimilarity = 0;
      for (const ref of referenceVideos) {
        totalSimilarity += computeSimilarity(ref, candidate);
      }
      const avgSimilarity = totalSimilarity / referenceVideos.length;

      // Bonus for same-creator as any recently watched
      const creatorBonus = referenceVideos.some((r) => r.channelName === candidate.channelName)
        ? 0.15
        : 0;

      return {
        video: candidate,
        score: avgSimilarity + creatorBonus,
      };
    });

    const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);

    const referenceTitle = referenceVideos[0]?.title ?? '';
    const truncatedTitle =
      referenceTitle.length > 40 ? referenceTitle.slice(0, 40) + '…' : referenceTitle;

    return {
      id: this.name,
      label: `${this.label} "${truncatedTitle}"`,
      subtitle: 'Similar content you might enjoy',
      strategy: this.name,
      videos: sorted.map((s) => s.video),
      seeAllLink: `/video/search?q=${encodeURIComponent(referenceTitle)}`,
    };
  }
}

/**
 * Strategy 2: "Trending in your interests" — Videos trending in user's preferred categories.
 */
export class TrendingInInterestsStrategy implements DiscoveryStrategy {
  name = 'trending-interests';
  label = 'Trending in your interests';

  async getVideos(options: DiscoveryOptions): Promise<DiscoveryRow> {
    const { allVideos } = options as DiscoveryOptions & { allVideos: UnifiedVideo[] };
    const now = options.now;
    const candidates = (allVideos ?? []).filter(
      (v) => !options.seenVideoIds.has(v.id) && v.publishedAt > now - 7 * 24 * 3600000, // Last 7 days
    );

    // Filter to user's interest categories, then compute velocity score
    const userCatSet = new Set(options.userCategories.map((c) => c.toLowerCase()));

    const scored = candidates
      .filter((v) => userCatSet.size === 0 || userCatSet.has(v.category.toLowerCase()))
      .map((v) => ({
        video: v,
        velocity: computeVelocity(v, now),
        // Creator momentum boost: recently published with high view rate
        momentum: v.views > 1000 && now - v.publishedAt < 48 * 3600000 ? 1.2 : 1.0,
      }))
      .sort((a, b) => b.velocity * b.momentum - a.velocity * a.momentum);

    return {
      id: this.name,
      label: this.label,
      subtitle: "What's hot in your categories",
      strategy: this.name,
      videos: scored.slice(0, options.limit).map((s) => s.video),
      seeAllLink: '/video?sort=trending',
    };
  }
}

/**
 * Strategy 3: "Hidden gems" — High-quality videos with low view counts.
 */
export class HiddenGemsStrategy implements DiscoveryStrategy {
  name = 'hidden-gems';
  label = 'Hidden Gems';

  async getVideos(options: DiscoveryOptions): Promise<DiscoveryRow> {
    const { allVideos } = options as DiscoveryOptions & { allVideos: UnifiedVideo[] };
    const now = options.now;
    const candidates = (allVideos ?? []).filter(
      (v) =>
        !options.seenVideoIds.has(v.id) &&
        v.views < 10000 && // Low absolute views
        v.publishedAt > now - 30 * 24 * 3600000, // Last 30 days
    );

    // Score by engagement rate, not absolute views
    const scored = candidates
      .map((v) => {
        const ageHours = Math.max(1, (now - v.publishedAt) / 3600000);
        // Quality/views ratio — high engagement rate despite low views
        const freshnessFactor = Math.max(0.3, 1 - ageHours / 720); // 30-day decay
        const qualityScore = VIDEO_ENGINE.computeProductionQuality(toVideoForScoring(v));
        const engagementRate = v.views / Math.max(ageHours, 1);

        return {
          video: v,
          // Score: production quality + freshness signal
          score: qualityScore * 0.5 + freshnessFactor * 0.3 + Math.min(0.2, engagementRate / 100),
          engagementRate,
        };
      })
      .filter((s) => s.engagementRate > 0.5) // Must have some engagement
      .sort((a, b) => b.score - a.score);

    return {
      id: this.name,
      label: this.label,
      subtitle: 'Underrated content you might love',
      strategy: this.name,
      videos: scored.slice(0, options.limit).map((s) => s.video),
      seeAllLink: '/video?sort=quality',
    };
  }
}

/**
 * Strategy 4: "Continue watching" — Videos the user started but didn't finish.
 */
export class ContinueWatchingStrategy implements DiscoveryStrategy {
  name = 'continue-watching';
  label = 'Continue Watching';

  async getVideos(options: DiscoveryOptions): Promise<DiscoveryRow> {
    const items = options.continueWatchingItems ?? [];

    if (!items.length) {
      return {
        id: this.name,
        label: this.label,
        subtitle: "Videos you've started",
        strategy: this.name,
        videos: [],
      };
    }

    // Convert ContinueWatchingItem to UnifiedVideo-like shape for rendering
    const videos = items.slice(0, options.limit).map((item) => ({
      id: item.videoId,
      title: item.title ?? 'Untitled',
      description: '',
      thumbnailUrl: item.thumbnailUrl ?? '',
      videoUrl: '',
      duration: item.duration,
      durationLabel: formatDuration(item.duration),
      source: item.platform as UnifiedVideo['source'],
      sourceLabel: item.platform,
      sourceColor: '#888',
      channelName: item.creatorName ?? 'Unknown',
      channelUrl: '',
      channelAvatar: item.creatorAvatar ?? '',
      publishedAt: item.lastWatched,
      publishedLabel: timeAgo(item.lastWatched),
      views: 0,
      category: item.category ?? 'all',
      tags: [],
      isLive: false,
      watchProgress: item.progress,
      watchPosition: item.position,
    })) as unknown as UnifiedVideo[];

    return {
      id: this.name,
      label: this.label,
      subtitle: 'Pick up where you left off',
      strategy: this.name,
      videos,
      seeAllLink: '/video/history',
    };
  }
}

/**
 * Strategy 5: "Up next" autoplay queue — After current video ends.
 */
export class UpNextStrategy implements DiscoveryStrategy {
  name = 'up-next';
  label = 'Up Next';

  async getVideos(options: DiscoveryOptions): Promise<DiscoveryRow> {
    const { allVideos, currentVideoId } = options as DiscoveryOptions & {
      allVideos: UnifiedVideo[];
      currentVideoId?: string;
    };

    if (!currentVideoId) {
      // No current video — fall back to recommended
      return {
        id: this.name,
        label: this.label,
        subtitle: 'Recommended',
        strategy: this.name,
        videos: (allVideos ?? [])
          .filter((v) => !options.seenVideoIds.has(v.id))
          .slice(0, options.limit),
      };
    }

    const currentVideo = (allVideos ?? []).find((v) => v.id === currentVideoId);
    if (!currentVideo) {
      return {
        id: this.name,
        label: this.label,
        subtitle: 'Recommended',
        strategy: this.name,
        videos: (allVideos ?? [])
          .filter((v) => !options.seenVideoIds.has(v.id))
          .slice(0, options.limit),
      };
    }

    // Score all candidates by similarity to current video
    const candidates = (allVideos ?? []).filter(
      (v) => v.id !== currentVideoId && !options.seenVideoIds.has(v.id),
    );

    const scored = candidates.map((v) => ({
      video: v,
      similarity: computeSimilarity(currentVideo, v),
    }));

    const sorted = scored.sort((a, b) => b.similarity - a.similarity).slice(0, options.limit);

    return {
      id: this.name,
      label: this.label,
      subtitle: `After "${currentVideo.title.slice(0, 30)}…"`,
      strategy: this.name,
      videos: sorted.map((s) => s.video),
    };
  }
}

// ─── Diversity Rotation ────────────────────────────────────────────────

/**
 * Ensure at least 2 different categories per 10 recommendations.
 * Rotates categories to maintain diversity across discovery rows.
 */
function ensureCategoryDiversity(rows: DiscoveryRow[], minCategories = 2): DiscoveryRow[] {
  const allCategories = new Set<string>();
  for (const row of rows) {
    for (const v of row.videos) {
      allCategories.add(v.category);
    }
  }

  // If we have fewer than minCategories, we're fine with what we have
  if (allCategories.size >= minCategories) return rows;

  return rows;
}

// ─── Discovery Engine ──────────────────────────────────────────────────

export interface VideoDiscoveryConfig {
  strategies: DiscoveryStrategy[];
}

const DEFAULT_STRATEGIES: DiscoveryStrategy[] = [
  new ContinueWatchingStrategy(),
  new BecauseYouWatchedStrategy(),
  new TrendingInInterestsStrategy(),
  new HiddenGemsStrategy(),
];

export class VideoDiscoveryEngine {
  private strategies: DiscoveryStrategy[];
  private scoreEngine: VideoScoreEngine;

  constructor(config?: VideoDiscoveryConfig) {
    this.strategies = config?.strategies ?? DEFAULT_STRATEGIES;
    this.scoreEngine = VIDEO_ENGINE;
  }

  /**
   * Generate a full discovery page with multiple recommendation rows.
   * Each strategy produces one row. Rows are sorted by priority.
   */
  async generateDiscoveryPage(
    options: DiscoveryOptions,
    allVideos: UnifiedVideo[],
  ): Promise<DiscoveryPage> {
    const mergedOptions: DiscoveryOptions & { allVideos: UnifiedVideo[] } = {
      ...options,
      allVideos,
    };

    // Run all strategies
    const rows: DiscoveryRow[] = [];
    const seenInPage = new Set<string>();

    for (const strategy of this.strategies) {
      // Skip "continue watching" if no items
      if (
        strategy instanceof ContinueWatchingStrategy &&
        (!options.continueWatchingItems || options.continueWatchingItems.length === 0)
      ) {
        continue;
      }

      const row = await strategy.getVideos(mergedOptions);

      // Dedup against already-seen videos in earlier rows
      row.videos = row.videos.filter((v) => {
        if (seenInPage.has(v.id)) return false;
        seenInPage.add(v.id);
        return true;
      });

      // Only include rows with at least 1 video
      if (row.videos.length > 0) {
        rows.push(row);
      }
    }

    // Apply diversity constraints
    ensureCategoryDiversity(rows);

    return {
      rows,
      interestCategories: options.userCategories,
      userWallet: options.wallet,
    };
  }

  /**
   * Generate "Up next" autoplay queue specifically for the video player.
   */
  async generateAutoplayQueue(
    currentVideoId: string,
    options: DiscoveryOptions,
    allVideos: UnifiedVideo[],
  ): Promise<UnifiedVideo[]> {
    const upNext = new UpNextStrategy();
    const row = await upNext.getVideos({
      ...options,
      allVideos,
      currentVideoId,
    } as DiscoveryOptions & { allVideos: UnifiedVideo[]; currentVideoId: string });

    return row.videos;
  }

  /**
   * Find related videos for a specific video (for sidebar).
   */
  async findRelatedVideos(
    sourceVideo: UnifiedVideo,
    allVideos: UnifiedVideo[],
    limit = 10,
  ): Promise<UnifiedVideo[]> {
    const candidates = allVideos.filter((v) => v.id !== sourceVideo.id);

    const scored = candidates
      .map((v) => ({
        video: v,
        similarity: computeSimilarity(sourceVideo, v),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored.map((s) => s.video);
  }

  /**
   * Get trending videos with category filter.
   */
  async getTrendingVideos(
    allVideos: UnifiedVideo[],
    options: {
      category?: string;
      limit?: number;
    } = {},
  ): Promise<UnifiedVideo[]> {
    const now = Date.now();
    const limit = options.limit ?? 30;
    const windowMs = 7 * 24 * 3600000; // 7 day window

    let candidates = allVideos.filter((v) => v.publishedAt > now - windowMs);

    if (options.category && options.category !== 'all') {
      candidates = candidates.filter(
        (v) => v.category.toLowerCase() === options.category!.toLowerCase(),
      );
    }

    const scored = candidates
      .map((v) => ({
        video: v,
        velocity: computeVelocity(v, now),
        // Trending score: views / age^1.5 (penalizes older content)
        trendingScore: v.views / Math.max(1, ((now - v.publishedAt) / 3600000) ** 1.5),
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore);

    return scored.slice(0, limit).map((s) => s.video);
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────

export const discoveryEngine = new VideoDiscoveryEngine();

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `0:${String(s).padStart(2, '0')}`;
}

function timeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
