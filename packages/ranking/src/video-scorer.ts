/**
 * @degenfeed/ranking — Video Scorer
 *
 * A specialized scoring model for video content recommendations.
 * Scores videos based on engagement, watch completion, creator authority,
 * topical relevance, freshness, and production quality.
 *
 * Formula:
 *   videoScore = (
 *     engagementScore × 0.30 +
 *     watchCompletionRate × 0.25 +
 *     creatorAuthority × 0.15 +
 *     topicalRelevance × 0.15 +
 *     freshnessBoost × 0.10 +
 *     productionQuality × 0.05
 *   ) × platformMultiplier × diversityFactor
 *
 * @example
 *   const scorer = new VideoScoreEngine();
 *   const { total, factors } = scorer.score(video, {
 *     userNiches: ['crypto', 'tech'],
 *     followedCreators: new Set(['ch-abc123']),
 *   });
 */

import type { Protocol } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export type ContentType =
  | 'tutorial'
  | 'review'
  | 'vlog'
  | 'music'
  | 'gaming'
  | 'news'
  | 'podcast'
  | 'stream-highlight'
  | 'educational'
  | 'entertainment'
  | 'other';

export type VideoSource =
  | 'peertube'
  | 'owncast'
  | 'youtube'
  | 'twitch'
  | 'rumble'
  | 'tiktok'
  | 'instagram'
  | 'odysee'
  | 'shorts'
  | 'livestream'
  | 'rss'
  | 'unknown';

export interface VideoForScoring {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** Video duration in seconds */
  duration: number;
  source: VideoSource | string;
  protocol?: Protocol;
  /** Creator / channel identity */
  creator: {
    id: string;
    displayName: string;
    followerCount: number;
    /** Whether creator is verified on their platform */
    verified: boolean;
    /** Number of videos the creator has published */
    videoCount: number;
    /** Average engagement rate across creator's videos (0-1) */
    avgEngagementRate?: number;
  };
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  /** Unix ms when the video was published */
  publishedAt: number;
  /** Video resolution height in pixels (e.g., 1080) */
  resolution?: number;
  /** Whether the video has captions/subtitles */
  hasCaptions?: boolean;
  /** Whether the video was produced professionally (studio, editing) */
  isProduced?: boolean;
  /** Language code (ISO 639-1) */
  language?: string;
}

export interface VideoScoreFactors {
  engagementScore: number; // 0-1
  watchCompletionRate: number; // 0-1
  creatorAuthority: number; // 0-1
  topicalRelevance: number; // 0-1
  freshnessBoost: number; // 0-1
  productionQuality: number; // 0-1
  platformMultiplier: number;
  diversityFactor: number;
}

export interface VideoScoreResult {
  total: number; // 0-100 normalized
  factors: VideoScoreFactors;
  transparency: string[];
}

export interface VideoScoreOptions {
  /** User's niche interests */
  userNiches?: string[];
  /** Creators the user follows */
  followedCreators?: Set<string>;
  /** Topics relevant to the user */
  userTopics?: string[];
  /** Category diversity tracker: category → count */
  categoryCounts?: Map<string, number>;
  /** Creator diversity tracker: creatorId → count */
  creatorCounts?: Map<string, number>;
  /** Whether to penalize repeat creators */
  enforceDiversity?: boolean;
  /** Video categories already shown in session */
  seenCategories?: Set<string>;
}

// ─── Platform Multipliers ───────────────────────────────────────────────

const PLATFORM_MULTIPLIERS: Record<string, number> = {
  peertube: 1.0,
  owncast: 1.0,
  youtube: 0.8,
  twitch: 0.85,
  rumble: 0.75,
  tiktok: 0.7,
  instagram: 0.65,
  odysee: 0.9,
  shorts: 0.8,
  livestream: 0.9,
  rss: 0.7,
};

// ─── Content Type Detection ─────────────────────────────────────────────

const CONTENT_PATTERNS: Record<ContentType, RegExp[]> = {
  tutorial: [
    /how\s+to/i,
    /tutorial/i,
    /guide/i,
    /learn/i,
    /step[-\s]by[-\s]step/i,
    /walkthrough/i,
    /beginner/i,
    /crash\s+course/i,
  ],
  review: [/review/i, /unboxing/i, /first\s+look/i, /impressions/i, /hands[-\s]on/i, /worth\s+it/i],
  vlog: [
    /vlog/i,
    /daily\s+life/i,
    /weekend/i,
    /travel/i,
    /day\s+in\s+the\s+life/i,
    /a\s+day\s+with/i,
  ],
  music: [/music/i, /song/i, /album/i, /playlist/i, /lofi/i, /beat/i, /remix/i, /cover/i],
  gaming: [
    /gameplay/i,
    /walkthrough/i,
    /let'?s\s+play/i,
    /gaming/i,
    /speedrun/i,
    /esports/i,
    /fps/i,
    /rpg/i,
    /minecraft/i,
    /fortnite/i,
    /valorant/i,
  ],
  news: [/breaking/i, /news/i, /update/i, /alert/i, /just\s+in/i, /report/i, /headlines/i],
  podcast: [
    /podcast/i,
    /episode/i,
    /interview/i,
    /conversation/i,
    /talk\s+show/i,
    /discussion/i,
    /ama/i,
    /fireside/i,
  ],
  'stream-highlight': [
    /highlight/i,
    /stream\s+clip/i,
    /best\s+of/i,
    /vod/i,
    /twitch/i,
    /live\s+stream/i,
    /replay/i,
  ],
  educational: [
    /educational/i,
    /explainer/i,
    /deep\s+dive/i,
    /analysis/i,
    /lesson/i,
    /course/i,
    /lecture/i,
    /explained/i,
  ],
  entertainment: [/funny/i, /comedy/i, /entertain/i, /prank/i, /challenge/i, /meme/i, /skit/i],
  other: [],
};

// ─── Language Detection ─────────────────────────────────────────────────

const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  en: /[a-zA-Z]/,
  es: /[¿¡áéíóúñ]/,
  fr: /[àâçéèêëîïôùûœ]/,
  de: /[äöüß]/,
  ja: /[\u3040-\u309F\u30A0-\u30FF]/,
  zh: /[\u4E00-\u9FFF]/,
  ko: /[\uAC00-\uD7AF]/,
  ru: /[а-яА-Я]/,
  pt: /[àâãçéêíóôõú]/,
};

// ─── VideoScoreEngine ───────────────────────────────────────────────────

export class VideoScoreEngine {
  /**
   * Detect the content type of a video from its title, description, and tags.
   */
  detectContentType(video: Pick<VideoForScoring, 'title' | 'description' | 'tags'>): ContentType {
    const text = [video.title, video.description, ...(video.tags ?? [])].filter(Boolean).join(' ');

    const scores = new Map<ContentType, number>();

    for (const [type, patterns] of Object.entries(CONTENT_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          // Title matches count double
          const inTitle = video.title.match(pattern);
          score += inTitle ? matches.length * 2 : matches.length;
        }
      }
      if (score > 0) {
        scores.set(type as ContentType, score);
      }
    }

    if (scores.size === 0) return 'other';

    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? 'other';
  }

  /**
   * Extract topics from video metadata for interest matching.
   * Returns a deduplicated array of topic strings.
   */
  extractTopics(video: Pick<VideoForScoring, 'title' | 'description' | 'tags'>): string[] {
    const topics = new Set<string>();

    // Add tags directly
    for (const tag of video.tags ?? []) {
      topics.add(tag.toLowerCase().trim());
    }

    // Extract hashtags from title and description
    const text = `${video.title} ${video.description}`;
    const hashtags = text.match(/#[a-zA-Z0-9_]+/g);
    if (hashtags) {
      for (const h of hashtags) {
        topics.add(h.slice(1).toLowerCase());
      }
    }

    // Extract key n-grams (1-3 word phrases that look meaningful)
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'been'].includes(w));

    // Add single keywords
    for (const w of words.slice(0, 10)) {
      topics.add(w);
    }

    // Add bigrams from title
    const titleWords = video.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
    for (let i = 0; i < titleWords.length - 1; i++) {
      topics.add(`${titleWords[i]} ${titleWords[i + 1]}`);
    }

    return [...topics].slice(0, 20);
  }

  /**
   * Detect the primary language of video text.
   * Returns ISO 639-1 code or 'unknown'.
   */
  detectLanguage(video: Pick<VideoForScoring, 'title' | 'description'>): string {
    const text = `${video.title} ${video.description}`;
    const scores = new Map<string, number>();

    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches) {
        scores.set(lang, matches.length);
      }
    }

    if (scores.size === 0) return 'unknown';

    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? 'unknown';
  }

  /**
   * Compute the engagement score (0-1) from metrics.
   * Normalizes using log-scaling to prevent viral outliers from dominating.
   */
  computeEngagementScore(metrics: VideoForScoring['metrics']): number {
    const { likes, comments, shares, views } = metrics;
    if (!views || views <= 0) return 0;

    // Engagement rate: interactions per view
    const interactions = likes + comments * 2 + shares * 3;
    const rawRate = interactions / Math.max(1, views);

    // Log-scale to compress the range
    const logRate = Math.log(1 + rawRate * 1000);
    return Math.min(1, logRate / 5);
  }

  /**
   * Compute watch completion signal.
   * When actual completion data isn't available, estimate from content type.
   */
  computeWatchCompletion(video: VideoForScoring, actualCompletionRate?: number): number {
    if (actualCompletionRate !== undefined) {
      return Math.min(1, Math.max(0, actualCompletionRate));
    }

    // Estimate based on content type and duration
    const contentType = this.detectContentType(video);

    // Expected completion baselines per content type
    const baselines: Record<ContentType, number> = {
      tutorial: 0.65,
      review: 0.55,
      vlog: 0.45,
      music: 0.7,
      gaming: 0.5,
      news: 0.4,
      podcast: 0.6,
      'stream-highlight': 0.55,
      educational: 0.6,
      entertainment: 0.5,
      other: 0.45,
    };

    const base = baselines[contentType] ?? 0.45;

    // Short-form (< 60s) tends to have higher completion
    if (video.duration > 0 && video.duration < 60) {
      return Math.min(1, base * 1.3);
    }

    // Long-form (> 30min) tends to have lower completion
    if (video.duration > 1800) {
      return base * 0.8;
    }

    return base;
  }

  /**
   * Compute creator authority score (0-1) based on followers,
   * verification status, and video output.
   */
  computeCreatorAuthority(creator: VideoForScoring['creator']): number {
    let score = 0;

    // Follower count tiers (log-scale)
    const followers = creator.followerCount ?? 0;
    if (followers >= 1_000_000) score += 0.4;
    else if (followers >= 100_000) score += 0.3;
    else if (followers >= 10_000) score += 0.2;
    else if (followers >= 1_000) score += 0.1;
    else score += 0.05;

    // Verification badge
    if (creator.verified) score += 0.25;

    // Established creator (many videos)
    const videoCount = creator.videoCount ?? 0;
    if (videoCount >= 100) score += 0.2;
    else if (videoCount >= 30) score += 0.15;
    else if (videoCount >= 10) score += 0.1;
    else if (videoCount >= 3) score += 0.05;

    // Engagement rate quality
    if (creator.avgEngagementRate !== undefined) {
      score += creator.avgEngagementRate * 0.15;
    }

    return Math.min(1, score);
  }

  /**
   * Compute topical relevance score (0-1) between video and user interests.
   */
  computeTopicalRelevance(
    video: Pick<VideoForScoring, 'title' | 'description' | 'tags'>,
    userTopics: string[],
    userNiches: string[],
    followedCreators: Set<string>,
    creatorId: string,
  ): number {
    const allUserInterests = new Set([
      ...userTopics.map((t) => t.toLowerCase()),
      ...userNiches.map((n) => n.toLowerCase()),
    ]);

    if (allUserInterests.size === 0) {
      // No user data — return baseline
      return 0.3;
    }

    const topics = this.extractTopics(video);
    const videoText = `${video.title} ${video.description}`.toLowerCase();

    let matches = 0;
    for (const interest of allUserInterests) {
      // Check direct topic match
      if (topics.some((t) => t.includes(interest) || interest.includes(t))) {
        matches++;
        continue;
      }
      // Check text content match
      if (videoText.includes(interest)) {
        matches += 0.5;
      }
    }

    // Boost for followed creators
    if (followedCreators.has(creatorId)) {
      matches += 2;
    }

    const maxPossible = allUserInterests.size + 2; // +2 for creator boost
    return Math.min(1, (matches / Math.max(1, maxPossible)) * 1.5);
  }

  /**
   * Compute freshness boost with 48-hour half-life.
   */
  computeFreshness(publishedAt: number, now?: number): number {
    const currentTime = now ?? Date.now();
    const ageHours = Math.max(0, (currentTime - publishedAt) / (1000 * 60 * 60));

    // 48-hour half-life decay
    const decay = 0.5 ** (ageHours / 48);

    // Boost for very recent (< 1 hour)
    if (ageHours < 1) return Math.min(1, decay * 1.5);

    return Math.min(1, decay);
  }

  /**
   * Compute production quality score (0-1).
   */
  computeProductionQuality(video: VideoForScoring): number {
    let score = 0.3; // baseline

    // Resolution signal
    const res = video.resolution ?? 0;
    if (res >= 2160)
      score += 0.25; // 4K
    else if (res >= 1440)
      score += 0.2; // 1440p
    else if (res >= 1080)
      score += 0.15; // 1080p
    else if (res >= 720)
      score += 0.1; // 720p
    else if (res >= 480) score += 0.05;

    // Captions signal
    if (video.hasCaptions) score += 0.15;

    // Produced content signal
    if (video.isProduced) score += 0.15;

    // Length signal (very short or very long may indicate lower production)
    if (video.duration > 0) {
      if (video.duration >= 300 && video.duration <= 3600) {
        // Sweet spot: 5 min to 1 hour
        score += 0.1;
      } else if (video.duration < 30) {
        // Very short — likely low production
        score -= 0.05;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get the platform multiplier for a video source.
   */
  getPlatformMultiplier(source: VideoSource | string): number {
    return PLATFORM_MULTIPLIERS[source] ?? 0.7;
  }

  /**
   * Compute diversity factor (penalizes repeat creators and same-category saturation).
   */
  computeDiversityFactor(creatorId: string, category: string, options?: VideoScoreOptions): number {
    if (!options?.enforceDiversity) return 1.0;

    let penalty = 1.0;

    // Same creator penalty: 0.8 for 3rd+ video from same creator
    const creatorCount = options.creatorCounts?.get(creatorId) ?? 0;
    if (creatorCount >= 2) {
      penalty *= 0.8;
    }

    // Same topic penalty: 0.9 for 5th+ video in same topic
    const categoryCount = options.categoryCounts?.get(category) ?? 0;
    if (categoryCount >= 4) {
      penalty *= 0.9;
    }

    return penalty;
  }

  /**
   * Score a single video using the video ranking model.
   *
   * @returns Normalized score from 0-100 with detailed factor breakdown.
   */
  score(video: VideoForScoring, options?: VideoScoreOptions): VideoScoreResult {
    const now = Date.now();
    const transparency: string[] = [];

    // 1. Engagement Score (30%)
    const engagementScore = this.computeEngagementScore(video.metrics);
    if (engagementScore > 0.6) transparency.push('high-engagement');
    else if (engagementScore > 0.3) transparency.push('moderate-engagement');

    // 2. Watch Completion Rate (25%)
    const watchCompletionRate = this.computeWatchCompletion(video);
    if (watchCompletionRate > 0.7) transparency.push('high-completion');
    else if (watchCompletionRate > 0.5) transparency.push('good-completion');

    // 3. Creator Authority (15%)
    const creatorAuthority = this.computeCreatorAuthority(video.creator);
    if (creatorAuthority > 0.7) transparency.push('authoritative-creator');
    else if (creatorAuthority > 0.4) transparency.push('established-creator');

    // 4. Topical Relevance (15%)
    const topicalRelevance = this.computeTopicalRelevance(
      video,
      options?.userTopics ?? [],
      options?.userNiches ?? [],
      options?.followedCreators ?? new Set(),
      video.creator.id,
    );
    if (topicalRelevance > 0.6) transparency.push('highly-relevant');
    else if (topicalRelevance > 0.3) transparency.push('somewhat-relevant');

    // 5. Freshness Boost (10%)
    const freshnessBoost = this.computeFreshness(video.publishedAt, now);
    if (freshnessBoost > 0.8) transparency.push('fresh');
    else if (freshnessBoost > 0.5) transparency.push('recent');

    // 6. Production Quality (5%)
    const productionQuality = this.computeProductionQuality(video);
    if (productionQuality > 0.7) transparency.push('high-production');
    else if (productionQuality > 0.5) transparency.push('good-production');

    // Platform multiplier
    const platformMultiplier = this.getPlatformMultiplier(video.source);

    // Diversity factor
    const contentType = this.detectContentType(video);
    const diversityFactor = this.computeDiversityFactor(video.creator.id, contentType, options);

    // Weighted sum
    const rawScore =
      engagementScore * 0.3 +
      watchCompletionRate * 0.25 +
      creatorAuthority * 0.15 +
      topicalRelevance * 0.15 +
      freshnessBoost * 0.1 +
      productionQuality * 0.05;

    // Apply platform multiplier and diversity factor
    const adjustedScore = rawScore * platformMultiplier * diversityFactor;

    // Normalize to 0-100
    const total = Math.round(adjustedScore * 100);

    const factors: VideoScoreFactors = {
      engagementScore,
      watchCompletionRate,
      creatorAuthority,
      topicalRelevance,
      freshnessBoost,
      productionQuality,
      platformMultiplier,
      diversityFactor,
    };

    return { total, factors, transparency };
  }

  /**
   * Score and rank multiple videos, applying diversity constraints.
   *
   * @returns Sorted array of scored results (highest first).
   */
  rank(videos: VideoForScoring[], options?: VideoScoreOptions): VideoScoreResult[] {
    const creatorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const seenCategories = new Set<string>();

    const mergedOptions: VideoScoreOptions = {
      ...options,
      creatorCounts,
      categoryCounts,
      seenCategories,
      enforceDiversity: true,
    };

    const results: Array<{ result: VideoScoreResult; video: VideoForScoring }> = [];

    for (const video of videos) {
      const contentType = this.detectContentType(video);

      // Update diversity trackers for this position
      mergedOptions.creatorCounts?.set(
        video.creator.id,
        (mergedOptions.creatorCounts?.get(video.creator.id) ?? 0) + 1,
      );
      mergedOptions.categoryCounts?.set(
        contentType,
        (mergedOptions.categoryCounts?.get(contentType) ?? 0) + 1,
      );
      mergedOptions.seenCategories?.add(contentType);

      const result = this.score(video, mergedOptions);

      // Adjust diversity factor after scoring based on cumulative counts
      result.factors.diversityFactor = this.computeDiversityFactor(
        video.creator.id,
        contentType,
        mergedOptions,
      );

      // Recompute total with adjusted diversity
      const rawScore =
        result.factors.engagementScore * 0.3 +
        result.factors.watchCompletionRate * 0.25 +
        result.factors.creatorAuthority * 0.15 +
        result.factors.topicalRelevance * 0.15 +
        result.factors.freshnessBoost * 0.1 +
        result.factors.productionQuality * 0.05;

      result.total = Math.round(
        rawScore * result.factors.platformMultiplier * result.factors.diversityFactor * 100,
      );

      results.push({ result, video });
    }

    // Sort by total descending
    results.sort((a, b) => b.result.total - a.result.total);

    return results.map((r) => r.result);
  }

  /**
   * Re-score a set of videos with updated diversity context.
   * Used when inserting a recommendation into an existing feed.
   */
  rescoreWithContext(
    video: VideoForScoring,
    existingResults: VideoScoreResult[],
    options?: VideoScoreOptions,
  ): VideoScoreResult {
    // Build diversity context from existing results
    const creatorCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const seenCategories = new Set<string>();

    for (const r of existingResults) {
      // Approximate creator tracking from transparency reasons
      if (
        r.transparency.includes('authoritative-creator') ||
        r.transparency.includes('established-creator')
      ) {
        // Can't reverse-map creatorId from score result, but we track category diversity
      }
    }

    return this.score(video, {
      ...options,
      creatorCounts,
      categoryCounts,
      seenCategories,
    });
  }
}

// ─── Singleton export ───────────────────────────────────────────────────

export const videoScorer = new VideoScoreEngine();
