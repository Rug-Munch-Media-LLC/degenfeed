/**
 * @degenfeed/shorts-provider — Shorts Ranking Algorithm
 *
 * Ranks short-form video content using a weighted scoring model:
 *   - Topic match (40%)
 *   - Engagement quality (25%)
 *   - Freshness (20%)
 *   - Quality signal (15%)
 *   - Explore bonus: 20% of feed should be discovery content
 *
 * The scorer is stateless and deterministic except for the explore bonus
 * which adds a small random boost for content discovery.
 */

import type { ShortVideoItem } from './index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UserInterestProfile {
  /** Topic name → interest weight (0-1, >0.5 = interested) */
  topics: Record<string, number>;
  /** Wallet address (for personalization) */
  wallet?: string;
}

export interface ShortScoreBreakdown {
  topicMatch: number;
  engagement: number;
  freshness: number;
  quality: number;
  exploreBonus: number;
  total: number;
  reasons: string[];
}

// ─── Ranking ──────────────────────────────────────────────────────────────

/**
 * Rank shorts by relevance to the user's interests.
 * Filters out already-seen videos, scores each, sorts descending.
 *
 * @param videos - List of available short videos
 * @param userProfile - User's interest profile
 * @param seenIds - Set of video IDs the user has already seen
 * @param limit - Max results (default 20)
 * @returns Ranked ShortVideoItem array with scores attached
 */
interface ScoredShort extends ShortVideoItem {
  score: number;
}

export function rankShorts(
  videos: ShortVideoItem[],
  userProfile: UserInterestProfile,
  seenIds: Set<string> = new Set(),
  limit = 20,
): ShortVideoItem[] {
  const scored: ScoredShort[] = videos
    .filter((v) => !seenIds.has(v.id))
    .map((v) => ({ ...v, score: computeShortScore(v, userProfile) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Compute a weighted relevance score for a single short video.
 *
 * Factors:
 *   1. Topic match (40%) — how well the video's topics align with user interests
 *   2. Engagement quality (25%) — like/view ratio as a quality signal
 *   3. Freshness (20%) — exponential decay over 7 days
 *   4. Quality signal (15%) — source + content quality
 *   5. Explore bonus — random discovery boost (applied externally)
 *
 * @param v - Short video item
 * @param profile - User interest profile
 * @returns Score breakdown with reasons
 */
export function computeShortScore(v: ShortVideoItem, profile: UserInterestProfile): number {
  const reasons: string[] = [];
  let score = 0;

  // 1. Topic match (40% weight)
  const relevantTopics = profile.topics;
  const activeTopics = Object.entries(relevantTopics)
    .filter(([_, weight]) => weight > 0.5)
    .map(([topic]) => topic);

  if (v.topics.length > 0 && activeTopics.length > 0) {
    const matchCount = v.topics.filter((t) => activeTopics.includes(t)).length;
    const topicMatch = matchCount / Math.max(v.topics.length, 1);
    score += topicMatch * 0.4;
    if (topicMatch > 0.5) reasons.push('on-topic');
    else if (topicMatch > 0) reasons.push('related');
  } else if (v.topics.length > 0) {
    // No profile topics yet — mild boost for having any topics
    score += 0.1;
  }

  // 2. Engagement quality (25% weight)
  if (v.views > 0) {
    const likeRatio = v.likes / Math.max(v.views, 1);
    const engagement = Math.min(likeRatio, 0.1); // cap at 10% like ratio
    score += engagement * 0.25;
    if (engagement > 0.05) reasons.push('popular');
  }

  // 3. Freshness (20% weight) — decay over 7 days
  const ageHours = Math.max(0, (Date.now() - v.publishedAt) / 3600000);
  const freshness = Math.max(0, 1 - ageHours / 168); // 168h = 7 days
  score += freshness * 0.2;
  if (freshness > 0.5) reasons.push('fresh');

  // 4. Quality signal (15% weight)
  score += v.qualityScore * 0.15;
  if (v.qualityScore > 0.7) reasons.push('high-quality');

  return score;
}

/**
 * Get score breakdown for a single video (used for UI transparency).
 */
export function shortScoreBreakdown(
  v: ShortVideoItem,
  profile: UserInterestProfile,
): ShortScoreBreakdown {
  const relevantTopics = profile.topics;
  const activeTopics = Object.entries(relevantTopics)
    .filter(([_, weight]) => weight > 0.5)
    .map(([topic]) => topic);

  const topicMatch =
    v.topics.length > 0 && activeTopics.length > 0
      ? v.topics.filter((t) => activeTopics.includes(t)).length / Math.max(v.topics.length, 1)
      : 0;

  const engagement = v.views > 0 ? Math.min(v.likes / Math.max(v.views, 1), 0.1) : 0;

  const ageHours = Math.max(0, (Date.now() - v.publishedAt) / 3600000);
  const freshness = Math.max(0, 1 - ageHours / 168);

  const quality = v.qualityScore;

  const exploreBonus = Math.random() * 0.1;

  const total =
    topicMatch * 0.4 + engagement * 0.25 + freshness * 0.2 + quality * 0.15 + exploreBonus;

  const reasons: string[] = [];
  if (topicMatch > 0.5) reasons.push('on-topic');
  if (engagement > 0.05) reasons.push('popular');
  if (freshness > 0.5) reasons.push('fresh');
  if (quality > 0.7) reasons.push('high-quality');

  return {
    topicMatch,
    engagement,
    freshness,
    quality,
    exploreBonus,
    total,
    reasons,
  };
}
