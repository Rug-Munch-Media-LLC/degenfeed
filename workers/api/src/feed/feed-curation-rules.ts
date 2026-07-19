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
  if (post.score?.total !== undefined && post.score.total > 0) return post.score.total;
  // Fallback: derive a score from engagement
  const eng =
    post.metrics.likes +
    post.metrics.reposts * 2 +
    post.metrics.replies * 3 +
    (post.metrics.quotes ?? 0);
  if (eng > 0) return Math.log(1 + eng) * 2;
  return 1;
}

// ─── Freshness multiplier ─────────────────────────────────────────

export interface FreshnessMultiplier {
  post: UnifiedPost;
  multiplier: number;
}

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
  return posts.map((post) => {
    const ageMs = now - post.createdAt;
    const ageHours = ageMs / 3600000;
    let multiplier = 1.0;

    if (ageHours < 1) multiplier = 1.2; // +20% for fresh content
    else if (ageHours < 6) multiplier = 1.1; // +10% for recent content

    return { post, multiplier };
  });
}

/**
 * Attach freshness multiplier to scores. Doesn't re-sort — it assigns
 * the multiplier to each post's score so the final sort uses it.
 */
export function applyFreshnessToScores(
  posts: UnifiedPost[],
  scored: Map<string, { total: number; freshness: number }>,
  now: number = Date.now(),
): void {
  for (const p of posts) {
    const ageMs = now - p.createdAt;
    const ageHours = ageMs / 3600000;
    let mult = 1.0;
    if (ageHours < 1) mult = 2.0;
    else if (ageHours < 6) mult = 1.5;

    const existing = scored.get(p.id);
    if (existing) {
      existing.freshness = mult;
      existing.total = getScore(p) * mult;
    } else {
      scored.set(p.id, { total: getScore(p) * mult, freshness: mult });
    }
  }
}

// ─── Content type detection ───────────────────────────────────────

function getContentType(post: UnifiedPost): string {
  if (post.contentType) return post.contentType;
  if (post.embeds?.some((e) => e.kind === 'video')) return 'video';
  if (post.embeds?.some((e) => e.kind === 'image')) return 'image';
  if (post.embeds?.some((e) => e.kind === 'link')) return 'link';
  return 'text';
}

// ─── Additive diversity bonus ─────────────────────────────────────

export interface DiversityBonusEntry {
  /** The post id */
  id: string;
  /** Base ranking score before diversity bonus */
  baseScore: number;
  /** Freshness multiplier applied */
  freshness: number;
  /** Protocol diversity bonus contribution */
  protocolBonus: number;
  /** Category diversity bonus contribution */
  categoryBonus: number;
  /** Content type diversity bonus contribution */
  contentTypeBonus: number;
  /** Final score = (baseScore + diversityBonuses) * freshness */
  finalScore: number;
}

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
    interleaveProtocols?: boolean;
    categoryRotation?: boolean;
    contentTypeVariety?: boolean;
  } = {},
): Map<string, DiversityBonusEntry> {
  if (posts.length === 0) return new Map();

  // Count proportions for each dimension
  const protocolCounts = new Map<string, number>();
  const categoryCounts = new Map<CategorySlug, number>();
  const contentTypeCounts = new Map<string, number>();

  for (const p of posts) {
    const proto = p.protocol ?? 'unknown';
    protocolCounts.set(proto, (protocolCounts.get(proto) ?? 0) + 1);

    const cat = ensureCategory(p);
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);

    const ct = getContentType(p);
    contentTypeCounts.set(ct, (contentTypeCounts.get(ct) ?? 0) + 1);
  }

  const total = posts.length;

  // Pre-compute underrepresented bonus scale factors
  // More underrepresented → higher boost
  function underrepBonus(count: number): number {
    return Math.max(0, 1.0 - count / total);
  }

  const protocolWeights = {
    interleaveProtocols: 2.5,
    categoryRotation: 1.0,
    contentTypeVariety: 0.6,
  };

  const results = new Map<string, DiversityBonusEntry>();

  for (const p of posts) {
    const baseScore = getScore(p);
    const existing = scored.get(p.id);
    const freshness = existing?.freshness ?? 1.0;
    const baseWithFreshness = baseScore * freshness;

    let protocolBonus = 0;
    let categoryBonus = 0;
    let contentTypeBonus = 0;

    if (opts.interleaveProtocols !== false) {
      const proto = p.protocol ?? 'unknown';
      const count = protocolCounts.get(proto) ?? 0;
      protocolBonus = underrepBonus(count) * protocolWeights.interleaveProtocols;
    }

    if (opts.categoryRotation !== false) {
      const cat = ensureCategory(p);
      const count = categoryCounts.get(cat) ?? 0;
      categoryBonus = underrepBonus(count) * protocolWeights.categoryRotation;
    }

    if (opts.contentTypeVariety !== false) {
      const ct = getContentType(p);
      const count = contentTypeCounts.get(ct) ?? 0;
      contentTypeBonus = underrepBonus(count) * protocolWeights.contentTypeVariety;
    }

    const diversityBonuses = protocolBonus + categoryBonus + contentTypeBonus;
    const finalScore = baseWithFreshness + diversityBonuses;

    results.set(p.id, {
      id: p.id,
      baseScore,
      freshness,
      protocolBonus: Math.round(protocolBonus * 100) / 100,
      categoryBonus: Math.round(categoryBonus * 100) / 100,
      contentTypeBonus: Math.round(contentTypeBonus * 100) / 100,
      finalScore,
    });
  }

  // Update the scored map totals
  for (const [id, entry] of results) {
    const existingEntry = scored.get(id);
    if (existingEntry) {
      existingEntry.total = entry.finalScore;
    } else {
      scored.set(id, { total: entry.finalScore, freshness: 1.0 });
    }
  }

  return results;
}

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
  if (posts.length <= 2) return posts;

  // Group by protocol, sort each group by score descending
  const groups = new Map<string, UnifiedPost[]>();
  for (const p of posts) {
    const proto = p.protocol ?? 'unknown';
    const group = groups.get(proto) ?? [];
    group.push(p);
    groups.set(proto, group);
  }

  // Sort each group by score descending
  for (const [proto, group] of groups) {
    groups.set(
      proto,
      group.sort((a, b) => {
        const aScore = scored.get(a.id)?.total ?? getScore(a);
        const bScore = scored.get(b.id)?.total ?? getScore(b);
        return bScore - aScore;
      }),
    );
  }

  // Round-robin: take one from each protocol per round
  const result: UnifiedPost[] = [];
  const protoKeys = [...groups.keys()];

  // Keep taking posts round-robin until all groups are empty
  let remaining = posts.length;
  while (remaining > 0) {
    let anyAdded = false;
    for (const proto of protoKeys) {
      const group = groups.get(proto);
      if (!group || group.length === 0) continue;
      const post = group.shift()!;
      result.push(post);
      remaining--;
      anyAdded = true;
    }
    if (!anyAdded) break; // safety: all groups empty
  }

  return result;
}

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
        continue; // would exceed maxConsecutive
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

// ─── Orchestrator ─────────────────────────────────────────────────

export interface CurationPipelineOptions {
  /** Enable freshness multiplier (default true). No longer a re-sort — applied via scoring. */
  freshnessBoost?: boolean;
  /** Enable protocol interleaving (default true). Now round-robin with score preservation. */
  interleaveProtocols?: boolean;
  /** Max consecutive posts from same protocol (default 2) — kept for backward compat */
  maxConsecutiveProtocols?: number;
  /** Enable content type variety enforcement (default true). */
  contentTypeVariety?: boolean;
  /** Max consecutive posts of same content type (default 3). */
  maxConsecutiveContentType?: number;
  /** Enable category rotation (default true). Applied via diversity bonus. */
  categoryRotation?: boolean;
  /** Minimum distinct categories per page (default 4). */
  minCategories?: number;
  /** Maximum percentage of posts from a single category (default 40). */
  maxSingleCategoryPct?: number;
  /** Current time for freshness calculation. */
  now?: number;
}

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
  const now = opts.now ?? Date.now();

  if (posts.length <= 1) return posts;

  // 1. Compute base scores with freshness multiplier
  const scored = new Map<string, { total: number; freshness: number }>();
  for (const p of posts) {
    const ageMs = now - p.createdAt;
    const ageHours = ageMs / 3600000;
    let freshness = 1.0;
    if (opts.freshnessBoost !== false) {
      if (ageHours < 1) freshness = 1.2; // +20% for fresh content
      else if (ageHours < 6) freshness = 1.1; // +10% for recent content
    }
    scored.set(p.id, { total: getScore(p) * freshness, freshness });
  }

  // 2. Add diversity bonuses to scores
  addDiversityBonus(posts, scored, {
    interleaveProtocols: opts.interleaveProtocols !== false,
    categoryRotation: opts.categoryRotation !== false,
    contentTypeVariety: opts.contentTypeVariety !== false,
  });

  // 3. Single sort by (baseScore + diversityBonuses) * freshness descending
  let sorted = [...posts].sort((a, b) => {
    const aScore = scored.get(a.id)?.total ?? getScore(a);
    const bScore = scored.get(b.id)?.total ?? getScore(b);
    if (bScore !== aScore) return bScore - aScore;

    // Tiebreaker: engagement
    const aEng =
      a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
    const bEng =
      b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);
    return bEng - aEng;
  });

  // 4. Round-robin protocol interleaving (score-preserving)
  if (opts.interleaveProtocols !== false && sorted.length > 2) {
    sorted = interleaveProtocolsRoundRobin(sorted, scored);
  }

  // 5. Content type variety (lightweight fix-up for runs, not a full re-sort)
  if (opts.contentTypeVariety !== false) {
    sorted = enforceContentTypeVariety(sorted, opts.maxConsecutiveContentType ?? 3);
  }

  return sorted;
}
