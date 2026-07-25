/**
 * @degenfeed/api-worker — Shorts Recommendation Algorithm
 *
 * TikTok-style "next video" engine with three phases:
 *
 * Phase 1 — Cold Start (<10 watches):
 *   Serve trending shorts across categories with weighted random
 *
 * Phase 2 — Learning (10-50 watches):
 *   Build interest profile from watch behavior
 *
 * Phase 3 — Personalized (50+ watches):
 *   Content-based + collaborative + creator affinity scoring
 *
 * Scoring formula:
 *   score = (contentMatch × 0.30) + (engagementPred × 0.25) +
 *           (creatorAffinity × 0.15) + (freshness × 0.10) +
 *           (diversity × 0.10) + (watchCompletion × 0.10)
 */

import type { AggregatedShort, ExtendedSource } from './shorts-aggregator-v2';

// ─── Types ───────────────────────────────────────────────────────────────

export interface WatchEvent {
  shortId: string;
  watchPercent: number; // 0.0 - 1.0
  liked: boolean;
  shared: boolean;
  watchedFull: boolean;
  skipped: boolean;
  watchDurationMs: number;
  timestamp: number;
}

export interface UserShortsProfile {
  /** Total number of watches tracked */
  totalWatches: number;
  /** Per-tag affinity score (0-1) */
  tagAffinities: Record<string, number>;
  /** Per-creator affinity score (0-1) */
  creatorAffinities: Record<string, number>;
  /** Per-source affinity score (0-1) */
  sourceAffinities: Record<string, number>;
  /** Watch completion stats per creator */
  creatorCompletion: Record<string, { totalMs: number; count: number }>;
  /** Watch completion stats per tag */
  tagCompletion: Record<string, { totalMs: number; count: number }>;
  /** Recently watched short IDs (for dedup) */
  recentShorts: string[];
  /** Recently watched creators (for session diversity) */
  recentCreators: string[];
  /** Average watch time percentage */
  avgWatchPercent: number;
  /** Optimal session duration preference (shorter vs longer) */
  preferredDuration: number;
  /** Last algorithm version used */
  algorithmVersion: string;
  /** Last updated timestamp */
  updatedAt: number;
}

export type AlgorithmPhase = 'cold_start' | 'learning' | 'personalized';

export interface AlgorithmResult {
  shorts: AggregatedShort[];
  scores: Record<string, number>;
  phase: AlgorithmPhase;
  reasons: Record<string, string[]>;
}

export interface AlgorithmOptions {
  /** Limit results */
  limit?: number;
  /** Seen short IDs to filter out */
  seenIds?: Set<string>;
  /** Force a specific category/tag */
  category?: string;
  /** Force a specific source */
  source?: ExtendedSource;
  /** User profile (if available) */
  profile?: UserShortsProfile;
  /** Current session start time */
  sessionStartedAt?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────

const PHASE_COLD_START_THRESHOLD = 10;
const PHASE_LEARNING_THRESHOLD = 50;
const WATCH_HISTORY_MAX = 200;
const RECENT_CREATORS_MAX = 10;
const EXPLORATION_RATIO = 0.15;
const FRESHNESS_BOOST_DURATION_MS = 3600000; // 1 hour
const SIMILAR_USERS_KEY = 'shorts:algorithm:similar_users';
const COLLAB_FILTER_KEY = 'shorts:algorithm:collaborative';

// ─── Algorithm Engine ───────────────────────────────────────────────────

export class ShortsAlgorithm {
  constructor() {}

  /**
   * Determine algorithm phase based on user watch count.
   */
  getPhase(profile?: UserShortsProfile): AlgorithmPhase {
    if (!profile || profile.totalWatches < PHASE_COLD_START_THRESHOLD) {
      return 'cold_start';
    }
    if (profile.totalWatches < PHASE_LEARNING_THRESHOLD) {
      return 'learning';
    }
    return 'personalized';
  }

  /**
   * Main recommendation entry point.
   * Takes a pool of aggregated shorts and a user profile, returns scored/sorted results.
   */
  recommend(shorts: AggregatedShort[], opts: AlgorithmOptions = {}): AlgorithmResult {
    const { limit = 20, seenIds = new Set(), category, source, profile, sessionStartedAt } = opts;

    const phase = this.getPhase(profile);

    // Filter out seen shorts + category/source filters
    let pool = shorts.filter((s) => !seenIds.has(s.id));
    if (category) {
      pool = pool.filter(
        (s) =>
          s.categories.includes(category) ||
          s.tags.includes(category) ||
          s.title.toLowerCase().includes(category.toLowerCase()),
      );
    }
    if (source) {
      pool = pool.filter((s) => s.source === source);
    }

    if (pool.length === 0) {
      return { shorts: [], scores: {}, phase, reasons: {} };
    }

    // Score each short
    const scored = pool.map((s) => ({
      short: s,
      score: this.computeScore(s, phase, profile, sessionStartedAt, shorts),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Build scores and reasons maps
    const scores: Record<string, number> = {};
    const reasons: Record<string, string[]> = {};
    const result: AggregatedShort[] = [];

    // Interleave: take top scored, then inject exploration content
    const topCount = Math.ceil(limit * (1 - EXPLORATION_RATIO));
    const exploreCount = limit - topCount;

    // Take top scored (excluding from explore pool)
    const topShorts = scored.slice(0, topCount);
    const remaining = scored.slice(topCount);

    // For exploration, pick random shorts from lower scores (avoid same creator consecutively)
    const usedCreators = new Set<string>();
    const explorePool = this.diversifyPool(remaining, usedCreators);

    for (const item of topShorts) {
      result.push(item.short);
      scores[item.short.id] = item.score;
      reasons[item.short.id] = this.getScoreReasons(item.short, phase, profile);
      usedCreators.add(item.short.creatorName);
    }

    // Add exploration shorts (diverse picks)
    for (let i = 0; i < Math.min(exploreCount, explorePool.length); i++) {
      const item = explorePool[i];
      if (!item) continue;
      result.push(item.short);
      scores[item.short.id] = item.score;
      reasons[item.short.id] = [...this.getScoreReasons(item.short, phase, profile), 'exploration'];
    }

    // Enforce session diversity: no 2 shorts from same creator consecutively
    const finalResult = this.enforceCreatorDiversity(result);

    return {
      shorts: finalResult.slice(0, limit),
      scores,
      phase,
      reasons,
    };
  }

  /**
   * Compute the composite score for a single short.
   */
  private computeScore(
    short: AggregatedShort,
    phase: AlgorithmPhase,
    profile?: UserShortsProfile,
    sessionStartedAt?: number,
    pool?: AggregatedShort[],
  ): number {
    let score = 0;

    switch (phase) {
      case 'cold_start':
        score = this.coldStartScore(short, pool);
        break;
      case 'learning':
        score = this.learningScore(short, profile);
        break;
      case 'personalized':
        score = this.personalizedScore(short, profile, sessionStartedAt, pool);
        break;
    }

    return Math.max(0, score);
  }

  // ── Phase 1: Cold Start ──────────────────────────────────────────────

  /**
   * Cold start scoring: weighted random with exploration bias.
   * 30% trending, 30% high engagement, 20% diverse categories, 20% popular creators
   */
  private coldStartScore(short: AggregatedShort, pool?: AggregatedShort[]): number {
    const rand = Math.random();

    // Trending factor (30% weight)
    const trendingFactor = this.computeTrendingFactor(short) * 0.3;

    // Engagement factor (30% weight)
    const engagementFactor = Math.min(short.engagementRate * 10, 1) * 0.3;

    // Diversity factor (20% weight) — category rarity
    const diversityFactor = this.computeDiversityFactor(short, pool) * 0.2;

    // Creator popularity factor (20% weight)
    const creatorFactor = Math.min(short.views / 100000, 1) * 0.2;

    // Small random jitter for exploration
    const jitter = Math.random() * 0.1;

    return trendingFactor + engagementFactor + diversityFactor + creatorFactor + jitter;
  }

  // ── Phase 2: Learning ────────────────────────────────────────────────

  /**
   * Learning phase: incorporate watch behavior signals.
   */
  private learningScore(short: AggregatedShort, profile?: UserShortsProfile): number {
    // Content match from tag affinities (40%)
    const contentMatch = this.computeContentMatch(short, profile) * 0.4;

    // Engagement prediction (25%)
    const engagementPred = this.predictEngagement(short, profile) * 0.25;

    // Creator affinity (15%)
    const creatorAffinity = this.computeCreatorAffinity(short, profile) * 0.15;

    // Freshness (10%)
    const freshness = this.computeFreshness(short) * 0.1;

    // Source preference (10%)
    const sourcePref = this.computeSourcePreference(short, profile) * 0.1;

    return contentMatch + engagementPred + creatorAffinity + freshness + sourcePref;
  }

  // ── Phase 3: Personalized ────────────────────────────────────────────

  /**
   * Fully personalized scoring with multi-factor formula:
   * score = (contentMatch × 0.30) + (engagementPred × 0.25) +
   *         (creatorAffinity × 0.15) + (freshness × 0.10) +
   *         (diversity × 0.10) + (watchCompletion × 0.10)
   */
  private personalizedScore(
    short: AggregatedShort,
    profile?: UserShortsProfile,
    sessionStartedAt?: number,
    pool?: AggregatedShort[],
  ): number {
    const contentMatch = this.computeContentMatch(short, profile) * 0.3;
    const engagementPred = this.predictEngagement(short, profile) * 0.25;
    const creatorAffinity = this.computeCreatorAffinity(short, profile) * 0.15;

    // Freshness: new shorts get 2x boost for first hour
    const freshnessRaw = this.computeFreshness(short);
    const freshnessBoost = sessionStartedAt
      ? this.computeSessionFreshnessBoost(short, sessionStartedAt)
      : 1;
    const freshness = freshnessRaw * freshnessBoost * 0.1;

    const diversity = this.computeDiversityFactor(short, pool) * 0.1;
    const watchCompletion = this.predictWatchCompletion(short, profile) * 0.1;

    // Collaborative signal: "users who liked this also liked..."
    // This is computed as a small bonus from the collaborative filter
    const collabBonus = 0; // Placeholder for KV-based collaborative filter

    return (
      contentMatch +
      engagementPred +
      creatorAffinity +
      freshness +
      diversity +
      watchCompletion +
      collabBonus
    );
  }

  // ── Factor Computation Helpers ───────────────────────────────────────

  /**
   * Compute content match (tag affinities vs short tags).
   */
  private computeContentMatch(short: AggregatedShort, profile?: UserShortsProfile): number {
    if (!profile || Object.keys(profile.tagAffinities).length === 0) {
      // Fallback: score by tag count
      return Math.min(short.tags.length / 5, 1);
    }

    let matchScore = 0;
    let matchCount = 0;

    for (const tag of short.tags) {
      const affinity = profile.tagAffinities[tag.toLowerCase()];
      if (affinity !== undefined) {
        matchScore += affinity;
        matchCount++;
      }
    }

    if (matchCount === 0) {
      // No tag overlap — mild baseline
      return 0.2;
    }

    return matchScore / matchCount;
  }

  /**
   * Predict engagement likelihood based on user history.
   */
  private predictEngagement(short: AggregatedShort, profile?: UserShortsProfile): number {
    if (!profile) {
      return Math.min(short.engagementRate * 5, 1);
    }

    // Shorter videos have higher completion in user's history
    const durationPreference =
      profile.preferredDuration > 0
        ? 1 - Math.abs(short.duration - profile.preferredDuration) / 120
        : 0.5;

    // Users tend to engage with same-type content
    const sourceMatch = profile.sourceAffinities[short.source] ?? 0.5;

    // Average watch percent as engagement signal
    const watchSignal = profile.avgWatchPercent;

    return durationPreference * 0.4 + sourceMatch * 0.3 + watchSignal * 0.3;
  }

  /**
   * Compute creator affinity from user's watch history.
   */
  private computeCreatorAffinity(short: AggregatedShort, profile?: UserShortsProfile): number {
    if (!profile) {
      return Math.min(short.views / 100000, 1);
    }

    return profile.creatorAffinities[short.creatorName] ?? 0.3;
  }

  /**
   * Compute source preference.
   */
  private computeSourcePreference(short: AggregatedShort, profile?: UserShortsProfile): number {
    if (!profile) {
      return 0.5;
    }
    return profile.sourceAffinities[short.source] ?? 0.5;
  }

  /**
   * Freshness: exponential decay over 7 days. New = 1.0, 7 days = 0.0.
   */
  private computeFreshness(short: AggregatedShort): number {
    const ageHours = Math.max(0, (Date.now() - short.publishedAt) / 3600000);
    return Math.max(0, 1 - ageHours / 168); // 168h = 7 days
  }

  /**
   * Extra freshness boost for very new content (< 1 hour = 2x).
   */
  private computeSessionFreshnessBoost(short: AggregatedShort, sessionStartedAt: number): number {
    const ageMs = Date.now() - short.publishedAt;
    if (ageMs < FRESHNESS_BOOST_DURATION_MS) return 2.0;
    if (ageMs < FRESHNESS_BOOST_DURATION_MS * 4) return 1.5;
    return 1.0;
  }

  /**
   * Diversity factor: prefers less common categories/tags in the pool.
   */
  private computeDiversityFactor(short: AggregatedShort, pool?: AggregatedShort[]): number {
    if (!pool || pool.length === 0) return 0.5;

    // Count how many shorts share the same tags
    const tagFrequency: Record<string, number> = {};
    for (const s of pool) {
      for (const tag of s.tags) {
        tagFrequency[tag] = (tagFrequency[tag] ?? 0) + 1;
      }
    }

    // Rarer tags = higher diversity score
    let rarity = 0;
    for (const tag of short.tags) {
      const freq = tagFrequency[tag] ?? 1;
      rarity += 1 - Math.min(freq / pool.length, 1);
    }

    return short.tags.length > 0 ? rarity / short.tags.length : 0.5;
  }

  /**
   * Trending factor: engagement velocity (likes + views per hour).
   */
  private computeTrendingFactor(short: AggregatedShort): number {
    const ageHours = Math.max(1, (Date.now() - short.publishedAt) / 3600000);
    const totalEngagement = short.likes + short.views * 0.01;
    const velocity = totalEngagement / ageHours;
    return Math.min(velocity / 100, 1);
  }

  /**
   * Predict watch completion percentage based on duration, creator, and niche history.
   */
  private predictWatchCompletion(short: AggregatedShort, profile?: UserShortsProfile): number {
    if (!profile) {
      // Cold start: shorter = higher completion
      return Math.max(0, 1 - short.duration / 120);
    }

    // Factor 1: duration (shorter = higher completion)
    const durationScore = Math.max(0, 1 - short.duration / 120);

    // Factor 2: creator completion history
    const creatorStats = profile.creatorCompletion[short.creatorName];
    const creatorScore =
      creatorStats && creatorStats.count > 0
        ? creatorStats.totalMs / (creatorStats.count * 30000) // normalized to 30s avg
        : 0.5;

    // Factor 3: tag completion history
    let tagScore = 0;
    let tagCount = 0;
    for (const tag of short.tags) {
      const tagStats = profile.tagCompletion[tag.toLowerCase()];
      if (tagStats && tagStats.count > 0) {
        tagScore += tagStats.totalMs / (tagStats.count * 30000);
        tagCount++;
      }
    }
    const nicheScore = tagCount > 0 ? tagScore / tagCount : 0.5;

    // Weighted: 40% duration, 30% creator, 30% niche
    return durationScore * 0.4 + creatorScore * 0.3 + nicheScore * 0.3;
  }

  /**
   * Enforce that no two consecutive shorts are from the same creator.
   */
  private enforceCreatorDiversity(shorts: AggregatedShort[]): AggregatedShort[] {
    if (shorts.length <= 1) return shorts;

    const result: AggregatedShort[] = [shorts[0]];
    for (let i = 1; i < shorts.length; i++) {
      const short = shorts[i];
      if (!short) continue;
      const lastCreator = result[result.length - 1]?.creatorName;

      if (short.creatorName === lastCreator) {
        // Try to swap with the next item
        let swapped = false;
        for (let j = i + 1; j < shorts.length; j++) {
          const candidate = shorts[j];
          if (candidate && candidate.creatorName !== lastCreator) {
            result.push(candidate);
            shorts[j] = short;
            swapped = true;
            break;
          }
        }
        if (!swapped) {
          result.push(short);
        }
      } else {
        result.push(short);
      }
    }

    return result;
  }

  /**
   * Diversify the exploration pool: pick shorts avoiding creators already shown.
   */
  private diversifyPool(
    scored: Array<{ short: AggregatedShort; score: number }>,
    usedCreators: Set<string>,
  ): Array<{ short: AggregatedShort; score: number }> {
    // Shuffle for randomness
    const shuffled = [...scored].sort(() => Math.random() - 0.5);

    // Prioritize creators not yet shown
    const fresh = shuffled.filter((s) => !usedCreators.has(s.short.creatorName));
    const rest = shuffled.filter((s) => usedCreators.has(s.short.creatorName));

    return [...fresh, ...rest];
  }

  /**
   * Get human-readable reasons for a short's score.
   */
  private getScoreReasons(
    short: AggregatedShort,
    phase: AlgorithmPhase,
    profile?: UserShortsProfile,
  ): string[] {
    const reasons: string[] = [];

    if (phase === 'cold_start') {
      if (short.engagementRate > 0.05) reasons.push('trending');
      if (short.views > 10000) reasons.push('popular');
      reasons.push('exploration');
      return reasons;
    }

    if (profile) {
      const contentMatch = this.computeContentMatch(short, profile);
      if (contentMatch > 0.6) reasons.push('your-topics');

      const creatorAffinity = this.computeCreatorAffinity(short, profile);
      if (creatorAffinity > 0.6) reasons.push('favorite-creator');

      const freshness = this.computeFreshness(short);
      if (freshness > 0.8) reasons.push('fresh');
    }

    if (short.engagementRate > 0.05) reasons.push('trending');
    if (short.qualityScore > 0.7) reasons.push('high-quality');

    return reasons;
  }

  // ── Profile Management ──────────────────────────────────────────────

  /**
   * Update a user profile based on a watch event.
   * Called by POST /api/shorts/watch handler.
   */
  updateProfile(
    profile: UserShortsProfile,
    event: WatchEvent,
    short: AggregatedShort,
  ): UserShortsProfile {
    const updated = { ...profile };

    // Increment total watches
    updated.totalWatches++;

    // Update tag affinities
    for (const tag of short.tags) {
      const key = tag.toLowerCase();
      const current = updated.tagAffinities[key] ?? 0;
      // Positive signal: watched a decent amount + liked/shared
      let delta = 0;
      if (event.watchPercent > 0.5) delta += 0.05;
      if (event.liked) delta += 0.1;
      if (event.shared) delta += 0.1;
      if (event.skipped) delta -= 0.05;
      if (event.watchedFull) delta += 0.1;

      updated.tagAffinities[key] = Math.max(0, Math.min(1, current + delta));
    }

    // Update creator affinities
    const creatorKey = short.creatorName;
    const currentCreatorAffinity = updated.creatorAffinities[creatorKey] ?? 0;
    let creatorDelta = 0;
    if (event.watchPercent > 0.5) creatorDelta += 0.05;
    if (event.liked) creatorDelta += 0.15;
    if (event.shared) creatorDelta += 0.1;
    if (event.skipped && event.watchPercent < 0.2) creatorDelta -= 0.1;
    if (event.watchedFull) creatorDelta += 0.15;

    updated.creatorAffinities[creatorKey] = Math.max(
      0,
      Math.min(1, currentCreatorAffinity + creatorDelta),
    );

    // Update source affinities
    const sourceKey = short.source;
    const currentSource = updated.sourceAffinities[sourceKey] ?? 0.5;
    let sourceDelta = 0;
    if (event.watchPercent > 0.5) sourceDelta += 0.05;
    if (event.skipped) sourceDelta -= 0.03;
    updated.sourceAffinities[sourceKey] = Math.max(0, Math.min(1, currentSource + sourceDelta));

    // Update creator completion stats
    if (!updated.creatorCompletion[creatorKey]) {
      updated.creatorCompletion[creatorKey] = { totalMs: 0, count: 0 };
    }
    updated.creatorCompletion[creatorKey].totalMs += event.watchDurationMs;
    updated.creatorCompletion[creatorKey].count++;

    // Update tag completion stats
    for (const tag of short.tags) {
      const tKey = tag.toLowerCase();
      if (!updated.tagCompletion[tKey]) {
        updated.tagCompletion[tKey] = { totalMs: 0, count: 0 };
      }
      updated.tagCompletion[tKey].totalMs += event.watchDurationMs;
      updated.tagCompletion[tKey].count++;
    }

    // Update recent shorts list
    updated.recentShorts = [...updated.recentShorts.slice(-WATCH_HISTORY_MAX), event.shortId];

    // Update recent creators list
    if (!updated.recentCreators.includes(creatorKey)) {
      updated.recentCreators = [...updated.recentCreators.slice(-RECENT_CREATORS_MAX), creatorKey];
    }

    // Update average watch percent
    const totalWatchTime =
      (updated.avgWatchPercent * (updated.totalWatches - 1) + event.watchPercent) /
      updated.totalWatches;
    updated.avgWatchPercent = totalWatchTime;

    // Update preferred duration (rolling average)
    if (event.watchedFull || event.watchPercent > 0.8) {
      updated.preferredDuration =
        updated.preferredDuration > 0
          ? updated.preferredDuration * 0.7 + short.duration * 0.3
          : short.duration;
    }

    updated.algorithmVersion = 'v2';
    updated.updatedAt = Date.now();

    return updated;
  }

  /**
   * Create a fresh default profile.
   */
  createDefaultProfile(address?: string): UserShortsProfile {
    return {
      totalWatches: 0,
      tagAffinities: {},
      creatorAffinities: {},
      sourceAffinities: {},
      creatorCompletion: {},
      tagCompletion: {},
      recentShorts: [],
      recentCreators: [],
      avgWatchPercent: 0,
      preferredDuration: 30,
      algorithmVersion: 'v2',
      updatedAt: Date.now(),
    };
  }

  /**
   * Get trending categories from a pool of shorts.
   */
  getTrendingCategories(
    shorts: AggregatedShort[],
    windowHours: number = 24,
  ): Array<{ category: string; count: number; topShort: AggregatedShort }> {
    const cutoff = Date.now() - windowHours * 3600000;
    const recent = shorts.filter((s) => s.publishedAt > cutoff);

    const categoryCounts: Record<string, { count: number; shorts: AggregatedShort[] }> = {};
    for (const short of recent) {
      for (const cat of short.categories) {
        if (!categoryCounts[cat]) {
          categoryCounts[cat] = { count: 0, shorts: [] };
        }
        categoryCounts[cat].count++;
        categoryCounts[cat].shorts.push(short);
      }
    }

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([category, data]) => ({
        category,
        count: data.count,
        topShort: data.shorts.sort((a, b) => b.views - a.views)[0]!,
      }));
  }
}
