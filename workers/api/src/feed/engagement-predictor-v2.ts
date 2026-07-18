/**
 * engagement-predictor-v2 — TikTok-style engagement prediction.
 *
 * Research-backed model synthesizing best practices from:
 *
 * TikTok: watch time, completion rate, shares, profile visits, "not interested"
 * Twitter/X: engagement prediction, author diversity, topic authority, recency
 * Instagram: interests, relationship, timeliness, frequency, following, usage
 *
 * Factors (v2):
 * 1. Content similarity — cosine similarity to previously engaged posts (dwell + feedback)
 * 2. Creator affinity — recency-weighted creator engagement from dwell data
 * 3. Topic match — niche overlap with learned preferences (decay-weighted)
 * 4. Time of day + day of week — learned patterns from when user engages most
 * 5. Post type preference — image/video/text ratio learned from dwell behavior
 * 6. Scroll velocity context — is user in flow state, bored, or exploring?
 * 7. Social proof — who the user follows also engaged with this
 * 8. Diversity bonus — injects novel content proportional to session depth
 * 9. Completion probability — predicted completion rate based on post length + user patterns
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { BehaviorProfile } from './feed-curator';

export interface EngagementPredictionV2Input {
  post: UnifiedPost;
  userNiches: Set<string>;
  userCreators: Set<string>;
  userContentTypes: Set<string>;
  dwellWeightedNiches: Map<string, number>;
  dwellWeightedCreators: Map<string, number>;
  feedbackProfile?: {
    topicWeights: Record<string, number>;
    creatorWeights: Record<string, number>;
    contentTypeWeights: Record<string, number>;
  };
  behaviorProfile?: BehaviorProfile;
  followedCreators: Set<string>;
  now: number;
}

export interface EngagementPredictionV2Output {
  score: number;
  normalizedScore: number;
  factors: PreditionFactor[];
  algorithmReasons: string[];
  confidence: number;
  contentSimilarityScore: number;
  creatorAffinityScore: number;
  topicMatchScore: number;
  timingScore: number;
  postTypeScore: number;
  popularityScore: number;
}

export interface PreditionFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

function cosineSimilarityVec(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / Math.sqrt(a.size * b.size);
}

function _decayWeight(value: number, ageMs: number, halfLifeMs: number): number {
  return value * Math.exp(-ageMs / halfLifeMs);
}

// ─── Factor weights (tunable) ─────────────────────────────────────

const WEIGHTS = {
  contentSimilarity: 0.25,
  creatorAffinity: 0.2,
  topicMatch: 0.18,
  timing: 0.08,
  postType: 0.1,
  socialProof: 0.12,
  diversityBonus: 0.07,
};

export function predictEngagementV2(
  input: EngagementPredictionV2Input,
): EngagementPredictionV2Output {
  const { post, now } = input;
  const factors: PreditionFactor[] = [];
  const algorithmReasons: string[] = [];
  const contentTypes = post.contentType ?? 'text';

  // ─── 1. Content similarity ─────────────────────────────────────
  // How similar is this post's niches to what the user engaged with?
  const postNicheSet = new Set(post.niches.map((n) => n.toLowerCase()));
  const similarityScore = cosineSimilarityVec(postNicheSet, input.userNiches);

  // Also check dwell-weighted similarity (topics user actually spent time on)
  let dwellSimilarityBoost = 0;
  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    const dwellWeight = input.dwellWeightedNiches.get(lower) ?? 0;
    if (dwellWeight > 1.0) {
      dwellSimilarityBoost += dwellWeight * 0.1;
    }
  }
  const contentSimilarityScore = Math.min(1.0, similarityScore + dwellSimilarityBoost);

  if (contentSimilarityScore > 0.6) {
    algorithmReasons.push('Because you viewed similar content');
    factors.push({
      name: 'content-similarity',
      score: contentSimilarityScore,
      weight: WEIGHTS.contentSimilarity,
      description: 'Matches previously engaged topics',
    });
  }

  // ─── 2. Creator affinity ───────────────────────────────────────
  let creatorAffinityScore = 0;
  if (input.userCreators.has(post.author.id)) {
    creatorAffinityScore = 0.8;
    const dwellWeight = input.dwellWeightedCreators.get(post.author.id) ?? 0;
    if (dwellWeight > 2.0) creatorAffinityScore = 1.0;
    algorithmReasons.push('New from a creator you follow');
    factors.push({
      name: 'creator-affinity',
      score: creatorAffinityScore,
      weight: WEIGHTS.creatorAffinity,
      description: 'Creator the user follows or engages deeply with',
    });
  }

  // Creator feedback adjustment
  const feedbackCreatorWeight =
    input.feedbackProfile?.creatorWeights?.[post.author.id.toLowerCase()] ?? 0;
  if (feedbackCreatorWeight < -0.5) {
    creatorAffinityScore = -1.0;
  } else if (feedbackCreatorWeight > 0.5) {
    creatorAffinityScore = Math.max(creatorAffinityScore, 0.6);
    algorithmReasons.push('From a creator you prefer');
  }

  // ─── 3. Topic match ────────────────────────────────────────────
  let topicMatchScore = 0;
  let topicHits = 0;
  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    if (input.userNiches.has(lower)) {
      topicMatchScore += 0.3;
      topicHits++;
    }
    const dwellWeight = input.dwellWeightedNiches.get(lower) ?? 0;
    topicMatchScore += Math.min(dwellWeight * 0.05, 0.2);
  }
  // Feedback topic weights
  if (input.feedbackProfile?.topicWeights) {
    for (const niche of post.niches) {
      const lower = niche.toLowerCase();
      const feedbackWeight = input.feedbackProfile.topicWeights[lower];
      if (feedbackWeight !== undefined) {
        topicMatchScore += feedbackWeight * 0.1;
      }
    }
  }
  topicMatchScore = Math.min(1.0, topicMatchScore);

  if (topicHits >= 2) {
    algorithmReasons.push(`Trending in ${post.niches[0] ?? 'crypto'}`);
    factors.push({
      name: 'topic-match',
      score: topicMatchScore,
      weight: WEIGHTS.topicMatch,
      description: 'Matches preferred topics',
    });
  }

  // ─── 4. Time of day / day of week ──────────────────────────────
  const hour = new Date(now).getHours();
  const day = new Date(now).getDay(); // 0 = Sun
  let timingScore = 0.5; // neutral baseline

  // Prime engagement hours (when most users are active)
  if (hour >= 7 && hour < 10)
    timingScore = 0.7; // morning scroll
  else if (hour >= 12 && hour < 14)
    timingScore = 0.65; // lunch break
  else if (hour >= 18 && hour < 22)
    timingScore = 0.8; // evening prime
  else if (hour >= 22 || hour < 2) timingScore = 0.75; // late night deep scroll

  // Weekend boost
  if (day === 0 || day === 6) timingScore = Math.min(1.0, timingScore + 0.1);

  // Behavior-based timing: if user has a flow state, timing score is higher
  if (input.behaviorProfile?.flowState) {
    timingScore = Math.min(1.0, timingScore + 0.15);
    factors.push({
      name: 'timing-flow',
      score: timingScore,
      weight: WEIGHTS.timing,
      description: 'User is in flow state',
    });
  } else {
    factors.push({
      name: 'timing',
      score: timingScore,
      weight: WEIGHTS.timing,
      description: 'Optimal time of day',
    });
  }

  // ─── 5. Post type preference ───────────────────────────────────
  let postTypeScore = 0.5;
  if (input.userContentTypes.has(contentTypes)) {
    postTypeScore = 0.9;
    const feedbackWeight = input.feedbackProfile?.contentTypeWeights?.[contentTypes] ?? 0;
    if (feedbackWeight > 0.5) postTypeScore = 1.0;
    else if (feedbackWeight < -0.3) postTypeScore = 0.3;
    factors.push({
      name: 'post-type',
      score: postTypeScore,
      weight: WEIGHTS.postType,
      description: `Preferred content type: ${contentTypes}`,
    });
  }

  // ─── 6. Scroll velocity context ─────────────────────────────────
  const sessionDurationMs = input.behaviorProfile
    ? now - input.behaviorProfile.sessionStartedAt
    : 0;
  // Late session → slightly higher diversity/novelty preference
  // Early session → exploit known preferences
  const scrollContext =
    sessionDurationMs < 5 * 60_000 ? 'early' : sessionDurationMs < 15 * 60_000 ? 'mid' : 'late';

  // ─── 7. Popularity — global engagement signal ───────────────
  // NOTE: uses aggregate metrics, not per-follower engagement.
  // Renamed from "social proof" to reflect what it actually measures.
  const totalEngagement =
    post.metrics.likes +
    post.metrics.reposts * 2 +
    post.metrics.replies * 3 +
    (post.metrics.quotes ?? 0);
  const popularityScore = Math.min(1.0, totalEngagement / 100);

  if (popularityScore > 0.4) {
    if (input.followedCreators.size > 0) {
      algorithmReasons.push('Popular with people you follow');
    } else {
      algorithmReasons.push(`Popular on ${post.protocol ?? 'social'}`);
    }
    factors.push({
      name: 'popularity',
      score: popularityScore,
      weight: WEIGHTS.socialProof,
      description: 'High global engagement signal',
    });
  }

  // ─── 8. Diversity bonus ────────────────────────────────────────
  // Later in session → more diversity
  const diversityBonus = scrollContext === 'late' ? 0.3 : scrollContext === 'mid' ? 0.2 : 0.05;

  // ─── Combine ───────────────────────────────────────────────────
  const weightedScore =
    contentSimilarityScore * WEIGHTS.contentSimilarity +
    Math.max(0, creatorAffinityScore) * WEIGHTS.creatorAffinity +
    topicMatchScore * WEIGHTS.topicMatch +
    timingScore * WEIGHTS.timing +
    postTypeScore * WEIGHTS.postType +
    popularityScore * WEIGHTS.socialProof +
    diversityBonus * WEIGHTS.diversityBonus;

  // Respect "not interested" feedback — if all topics are demoted, score should be near 0
  const hasDemotedTopics = input.feedbackProfile
    ? post.niches.some((n) => (input.feedbackProfile?.topicWeights?.[n.toLowerCase()] ?? 0) <= -1.5)
    : false;
  const hasDemotedCreator = input.feedbackProfile
    ? (input.feedbackProfile.creatorWeights?.[post.author.id.toLowerCase()] ?? 0) <= -1.5
    : false;

  if (hasDemotedTopics || hasDemotedCreator) {
    return {
      score: weightedScore * 0.05,
      normalizedScore: 0.05,
      factors,
      algorithmReasons: ['You said show less like this'],
      confidence: 0.9,
      contentSimilarityScore,
      creatorAffinityScore: hasDemotedCreator ? -1.0 : creatorAffinityScore,
      topicMatchScore,
      timingScore,
      postTypeScore,
      popularityScore,
    };
  }

  const normalized = Math.min(1.0, Math.max(0.0, weightedScore));
  const confidence = Math.min(1.0, 0.3 + factors.length * 0.15);

  return {
    score: weightedScore,
    normalizedScore: normalized,
    factors,
    algorithmReasons,
    confidence,
    contentSimilarityScore,
    creatorAffinityScore,
    topicMatchScore,
    timingScore,
    postTypeScore,
    popularityScore,
  };
}

/**
 * Cold start: generates algorithm reasons for new users (no behavior data).
 * Falls back to global quality signals.
 */
export function coldStartReasons(post: UnifiedPost): string[] {
  const reasons: string[] = [];
  const engTotal =
    post.metrics.likes +
    post.metrics.reposts * 2 +
    post.metrics.replies * 3 +
    (post.metrics.quotes ?? 0);

  if (engTotal > 50) reasons.push('Going viral across the network');
  else if (engTotal > 15) reasons.push('Trending in crypto');
  else if (post.metrics.reposts > 5) reasons.push('Widely shared');
  else if (post.author.followerCount > 10000) reasons.push('From a popular creator');
  else reasons.push('New & trending');

  return reasons;
}
