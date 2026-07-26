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
 * 10. Recency — post freshness (added v2.1 — weighted at 40% of total prediction)
 *
 * Explicit weight target: recency (40%), engagement (30%), relevance (20%), diversity (10%)
 *
 * v2.1 changes:
 * - Recency is now the highest-weighted single factor (40%)
 * - Engagement signals (social proof, creator affinity) = 30%
 * - Relevance signals (content similarity, topic match) = 20%
 * - Diversity signals (diversity bonus, post type) = 10%
 */

import type { UnifiedPost } from '@degenfeed/types';
import { computeRecencyScore } from '../ranking/ranking-weights';
import type { BehaviorProfile } from './feed-curator';

export interface EngagementPredictionV2Input {

export interface EngagementPredictionV2Output {

export interface PreditionFactor {

function cosineSimilarityVec(a: Set<string>, b: Set<string>): number {

function _decayWeight(value: number, ageMs: number, halfLifeMs: number): number {

// ─── Factor weights (tunable) v2.1 — recency(40%) + engagement(30%) + relevance(20%) + diversity(10%)
//
// Recency group (40%): recency + timing
// Engagement group (30%): creatorAffinity + socialProof
// Relevance group (20%): contentSimilarity + topicMatch
// Diversity group (10%): postType + diversityBonus

const WEIGHTS = {

export function predictEngagementV2(
  input: EngagementPredictionV2Input,
): EngagementPredictionV2Output {

/**
 * Cold start: generates algorithm reasons for new users (no behavior data).
 * Falls back to global quality signals.
 */
export function coldStartReasons(post: UnifiedPost): string[] {

