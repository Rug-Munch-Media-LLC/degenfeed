/**
 * feed-curation-rules — Post-processing curation rules applied to ANY feed.
 *
 * Protocol interleaving, content type variety, freshness multipliers,
 * category rotation — all available as composable pipeline steps.
 * Designed to be applied AFTER scoring/ranking to reorder results.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { ALL_CATEGORIES, ensureCategory, type CategorySlug } from './feed-categories';

// ─── Freshness multiplier ─────────────────────────────────────────

export interface FreshnessMultiplier {
  post: UnifiedPost;
  multiplier: number;
}

/**
 * Apply freshness multipliers to a list of posts.
 * Posts from the last hour get 2x boost, last 6 hours get 1.5x.
 * Older posts are unchanged (1x).
 */
export function applyFreshnessMultiplier(
  posts: UnifiedPost[],
  now: number = Date.now(),
): FreshnessMultiplier[] {
  return posts.map((post) => {
    const ageMs = now - post.createdAt;
    const ageHours = ageMs / 3600000;
    let multiplier = 1.0;

    if (ageHours < 1) multiplier = 2.0;
    else if (ageHours < 6) multiplier = 1.5;

    return { post, multiplier };
  });
}

/**
 * Re-sort posts by freshness-multiplied score, then by engagement as tiebreaker.
 */
export function sortByFreshnessBoost(
  posts: UnifiedPost[],
  now: number = Date.now(),
): UnifiedPost[] {
  const boosted = applyFreshnessMultiplier(posts, now);

  const byId = new Map(boosted.map((b) => [b.post.id, b.multiplier]));

  return [...posts].sort((a, b) => {
    const aBase = a.score?.total ?? 0;
    const bBase = b.score?.total ?? 0;
    const aMult = byId.get(a.id) ?? 1.0;
    const bMult = byId.get(b.id) ?? 1.0;
    const aScore = aBase * aMult;
    const bScore = bBase * bMult;
    if (bScore !== aScore) return bScore - aScore;

    const aEng = a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
    const bEng = b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);
    return bEng - aEng;
  });
}

// ─── Protocol interleaving ────────────────────────────────────────

/**
 * Interleave posts so that the same protocol doesn't appear
 * consecutively more than `maxConsecutive` times.
 * Uses a round-robin bucket approach for strong interleaving.
 *
 * Every 3rd post should be from a different protocol.
 */
export function interleaveProtocols(
  posts: UnifiedPost[],
  maxConsecutive: number = 2,
): UnifiedPost[] {
  if (posts.length <= 1) return posts;

  // Group by protocol
  const buckets = new Map<string, UnifiedPost[]>();
  for (const p of posts) {
    const proto = p.protocol ?? 'unknown';
    const bucket = buckets.get(proto) || [];
    bucket.push(p);
    buckets.set(proto, bucket);
  }

  const result: UnifiedPost[] = [];
  const usedRecently = new Map<string, number>();

  while (result.length < posts.length) {
    let bestProto: string | null = null;
    let bestBucket: UnifiedPost[] | null = null;

    for (const [proto, bucket] of buckets) {
      if (bucket.length === 0) continue;
      const recent = usedRecently.get(proto) ?? 0;
      if (recent >= maxConsecutive) continue;

      if (!bestProto || bucket.length > (bestBucket?.length ?? 0)) {
        bestProto = proto;
        bestBucket = bucket;
      }
    }

    if (!bestProto || !bestBucket) {
      // All protocols at their limit — take any remaining
      let fallback: UnifiedPost[] | undefined;
      for (const [, bucket] of buckets) {
        if (bucket.length > 0) {
          fallback = bucket;
          break;
        }
      }
      if (!fallback) break;
      const post = fallback.shift()!;
      result.push(post);
      usedRecently.clear();
      usedRecently.set(post.protocol ?? 'unknown', 1);
      continue;
    }

    const post = bestBucket.shift()!;
    result.push(post);

    // Update recency tracking
    for (const [proto] of usedRecently) {
      usedRecently.set(proto, 0); // reset: not consecutive anymore
    }
    usedRecently.set(bestProto, 1);
  }

  return result;
}

// ─── Content type variety ─────────────────────────────────────────

const CONTENT_TYPE_ORDER: string[] = ['text', 'image', 'video', 'link', 'thread'];

function getContentType(post: UnifiedPost): string {
  if (post.contentType) return post.contentType;
  // Infer from embeds
  if (post.embeds.some((e) => e.kind === 'video')) return 'video';
  if (post.embeds.some((e) => e.kind === 'image')) return 'image';
  if (post.embeds.some((e) => e.kind === 'link')) return 'link';
  return 'text';
}

/**
 * Enforce that no more than `maxConsecutive` posts of the same content type
 * appear in a row. Reorders posts within a local window to break up runs.
 */
export function enforceContentTypeVariety(
  posts: UnifiedPost[],
  maxConsecutive: number = 3,
): UnifiedPost[] {
  if (posts.length <= maxConsecutive) return posts;

  const result: UnifiedPost[] = [];
  const pool = [...posts];

  while (pool.length > 0) {
    const tailCount = Math.min(maxConsecutive, result.length);
    const recentTypes = new Set<string>();
    for (let i = result.length - tailCount; i < result.length; i++) {
      const item = result[i];
      if (item) recentTypes.add(getContentType(item));
    }

    // Find the next post that breaks type monotony, or take the first
    let chosenIdx = 0;
    for (let i = 0; i < pool.length; i++) {
      const type = getContentType(pool[i]!);
      if (recentTypes.size === 1 && recentTypes.has(type) && tailCount >= maxConsecutive) {
        continue; // we'd exceed maxConsecutive
      }
      chosenIdx = i;
      break;
    }

    const chosen = pool[chosenIdx]!;
    result.push(chosen);
    pool.splice(chosenIdx, 1);
  }

  return result;
}

// ─── Category rotation ────────────────────────────────────────────

/**
 * Ensure at least `minCategories` distinct categories appear in the page.
 * Promotes underrepresented category posts toward the top.
 */
export function enforceCategoryRotation(
  posts: UnifiedPost[],
  minCategories: number = 3,
): UnifiedPost[] {
  if (posts.length < minCategories) return posts;

  const result: UnifiedPost[] = [];
  const pool = [...posts];
  const seenCategories = new Set<CategorySlug>();

  // Phase 1: Ensure at least one of each required category
  const prioritySlots = Math.min(minCategories, pool.length);
  for (let i = 0; i < prioritySlots; i++) {
    // Find the best post from an unseen category
    let bestIdx = -1;
    for (let j = 0; j < pool.length; j++) {
      const cat = ensureCategory(pool[j]!);
      if (seenCategories.has(cat) && seenCategories.size < minCategories) continue;
      bestIdx = j;
      break;
    }
    if (bestIdx === -1) bestIdx = 0; // fallback

    const chosen = pool[bestIdx]!;
    seenCategories.add(ensureCategory(chosen));
    result.push(chosen);
    pool.splice(bestIdx, 1);
  }

  // Phase 2: Fill remaining with category-aware interleaving
  const categoryBuckets = new Map<CategorySlug, UnifiedPost[]>();
  for (const p of pool) {
    const cat = ensureCategory(p);
    const bucket = categoryBuckets.get(cat) || [];
    bucket.push(p);
    categoryBuckets.set(cat, bucket);
  }

  const catOrder = [...ALL_CATEGORIES];
  let catIdx = 0;
  while (result.length < posts.length) {
    let added = false;
    for (let i = 0; i < catOrder.length; i++) {
      const cat = catOrder[(catIdx + i) % catOrder.length]!;
      const bucket = categoryBuckets.get(cat);
      if (bucket && bucket.length > 0) {
        result.push(bucket.shift()!);
        catIdx = (catIdx + i + 1) % catOrder.length;
        added = true;
        break;
      }
    }
    if (!added) break; // all buckets empty
  }

  return result;
}

// ─── Orchestrator ─────────────────────────────────────────────────

export interface CurationPipelineOptions {
  /** Enable freshness multiplier sorting (default true). */
  freshnessBoost?: boolean;
  /** Enable protocol interleaving (default true). */
  interleaveProtocols?: boolean;
  /** Max consecutive posts from same protocol (default 2). */
  maxConsecutiveProtocols?: number;
  /** Enable content type variety enforcement (default true). */
  contentTypeVariety?: boolean;
  /** Max consecutive posts of same content type (default 3). */
  maxConsecutiveContentType?: number;
  /** Enable category rotation (default true). */
  categoryRotation?: boolean;
  /** Minimum distinct categories per page (default 3). */
  minCategories?: number;
  /** Current time for freshness calculation. */
  now?: number;
}

/**
 * Apply the full curation pipeline to a ranked list of posts.
 * Order: freshness boost → protocol interleaving → content type variety → category rotation.
 */
export function applyCurationPipeline(
  posts: UnifiedPost[],
  opts: CurationPipelineOptions = {},
): UnifiedPost[] {
  const now = opts.now ?? Date.now();
  let result = posts;

  // 1. Freshness boost — re-sort by freshness-multiplied scores
  if (opts.freshnessBoost !== false) {
    result = sortByFreshnessBoost(result, now);
  }

  // 2. Protocol interleaving
  if (opts.interleaveProtocols !== false) {
    result = interleaveProtocols(result, opts.maxConsecutiveProtocols ?? 2);
  }

  // 3. Content type variety
  if (opts.contentTypeVariety !== false) {
    result = enforceContentTypeVariety(result, opts.maxConsecutiveContentType ?? 3);
  }

  // 4. Category rotation
  if (opts.categoryRotation !== false) {
    result = enforceCategoryRotation(result, opts.minCategories ?? 3);
  }

  return result;
}
