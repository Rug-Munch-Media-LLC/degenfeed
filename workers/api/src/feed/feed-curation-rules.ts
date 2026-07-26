/**
 * feed-curation-rules — Post-processing curation rules applied to ANY feed.
 *
 * Architecture: additive diversity bonuses instead of destructive re-sorts.
 *
 * The pipeline used to do 4 sequential destructive re-sorts (freshness,
 * protocol interleaving, content type variety, category rotation), each
 * overwriting the ranking of the previous step. This destroyed ranking
 * quality — the final output had good diversity but poor score ordering.
 *
 * NEW APPROACH: Add diversity bonuses to each post's score *before* a
 * single final sort. `addDiversityBonus()` scans the post set for unique
 * protocols, categories, and content types, and rewards posts that
 * contribute to diversity:
 *   +0.5 per unique protocol when interleaving
 *   +0.3 per unique category
 *   +0.2 per unique content type
 *
 * Round-robin protocol interleaving replaces "max 2 consecutive":
 * alternating protocols, keeping the highest-scored post from each round,
 * so both diversity and ranking quality are preserved.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type CategorySlug, ensureCategory } from './feed-categories';

// ─── Score extractor ───────────────────────────────────────────────

/**
 * Get the effective ranking score from a post. Checks score.total first
 * (set by the ranking v2 pipeline), then falls back to a heuristic from
 * engagement metrics.
 */
function getScore(post: UnifiedPost): number {

// ─── Freshness multiplier ─────────────────────────────────────────

export interface FreshnessMultiplier {

/**
 * Apply freshness multipliers to a list of posts.
 * Posts from the last hour get +20% boost (1.2x), last 6 hours get +10% (1.1x).
 * Older posts are unchanged (1x).
 *
 * This is a moderate boost — enough to surface fresh content without
 * overwhelming the ranking with recency-only signals.
 */
export function applyFreshnessMultiplier(
  posts: UnifiedPost[],
  now: number = Date.now(),
): FreshnessMultiplier[] {

/**
 * Attach freshness multiplier to scores. Doesn't re-sort — it assigns
 * the multiplier to each post's score so the final sort uses it.
 */
export function applyFreshnessToScores(
  posts: UnifiedPost[],
  scored: Map<string, { total: number; freshness: number }>,
  now: number = Date.now(),
): void {

// ─── Content type detection ───────────────────────────────────────

function getContentType(post: UnifiedPost): string {

// ─── Additive diversity bonus ─────────────────────────────────────

export interface DiversityBonusEntry {

/**
 * Add diversity bonuses to scored posts instead of destructive re-sorting.
 *
 * Instead of giving every post the same bonus (which is a no-op for ranking),
 * this rewards posts from UNDERREPRESENTED protocols, categories, and content
 * types relative to their share of the post pool. A post from a protocol that
 * represents only 10% of the pool gets a higher bonus than one from a protocol
 * that represents 50%.
 *
 * Bonus formula per dimension: (1.0 - proportionOfPool) × weight
 *   Protocol weight: 2.5 when interleaving
 *   Category weight: 1.0 when category rotation
 *   Content type weight: 0.6 when content type variety
 *
 * The final sort uses (baseScore + diversityBonuses) * freshness so both
 * ranking signal and diversity are preserved in a single pass.
 *
 * @param posts   The full list of posts being curated
 * @param scored  A map of post id → { total, freshness } (mutated in-place)
 * @param opts    Which diversity bonuses to apply
 * @returns       Diversity bonus entries for diagnostics
 */
export function addDiversityBonus(
  posts: UnifiedPost[],
  scored: Map<string, { total: number; freshness: number }>,
  opts: {
): Map<string, DiversityBonusEntry> {

// ─── Round-robin protocol interleaving (with score preservation) ───

/**
 * Round-robin protocol interleaving that preserves ranking quality.
 *
 * Unlike the old "max 2 consecutive" approach that destructively re-sorted,
 * this round-robin alternates protocols, taking the highest-scored
 * remaining post from each protocol in each round. This guarantees:
 *
 *   - No two consecutive posts from the same protocol
 *   - Higher-scored posts from each protocol appear first
 *   - Overall ranking quality is preserved because selection within
 *     each protocol is score-ordered
 *
 * @param posts  Full list of posts (with score metadata)
 * @param scored Map of post id → { total, freshness }
 * @returns      Posts reordered with round-robin interleaving
 */
export function interleaveProtocolsRoundRobin(
  posts: UnifiedPost[],
  scored: Map<string, { total: number; freshness: number }>,
): UnifiedPost[] {

// ─── Content type variety (preserves score ordering) ───────────────

/**
 * Enforce that no more than `maxConsecutive` posts of the same content
 * type appear consecutively. Unlike the old destructive approach, this
 * scans the list and only swaps posts when a run exceeds the limit,
 * preserving the score ordering as much as possible.
 */
export function enforceContentTypeVariety(
  posts: UnifiedPost[],
  maxConsecutive: number = 3,
): UnifiedPost[] {

// ─── Orchestrator ─────────────────────────────────────────────────

export interface CurationPipelineOptions {

/**
 * Apply the full curation pipeline to a ranked list of posts.
 *
 * NEW APPROACH: additive diversity bonuses + single sort + round-robin
 * interleaving. No more destructive re-sorts.
 *
 * Pipeline:
 *   1. Compute freshness multipliers on each post's score
 *   2. Add diversity bonuses (+0.5/protocol, +0.3/category, +0.2/type)
 *   3. Sort by the combined (score + diversity) * freshness
 *   4. Apply round-robin protocol interleaving (score-preserving)
 *   5. Apply content type variety if needed (lightweight reorder)
 *
 * The key insight: diversity bonuses ensure underrepresented protocols/
 * categories/content-types get a score boost, so the single sort naturally
 * surfaces diverse content without destructive re-ordering.
 */
export function applyCurationPipeline(
  posts: UnifiedPost[],
  opts: CurationPipelineOptions = {},
): UnifiedPost[] {

