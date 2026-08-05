/**
 * @degenfeed/feed-core — Diversity Algorithm
 *
 * Ensures feeds show diverse content:
 * 1. Category rotation: No more than 3 posts from same category in a row
 * 2. Creator rotation: No more than 2 posts from same creator in a row
 * 3. Protocol rotation: Mix content from multiple protocols
 * 4. Serendipity injection: 10% of feed is discovery content
 * 5. Filter bubble prevention: Show opposing viewpoints occasionally
 *
 * Uses a greedy slot-filling algorithm that respects all diversity constraints
 * while maximizing total score.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiversityConfig {
  /** Max consecutive posts from same category */
  maxConsecutiveCategory: number;
  /** Max consecutive posts from same creator */
  maxConsecutiveCreator: number;
  /** Max consecutive posts from same protocol */
  maxConsecutiveProtocol: number;
  /** Max total posts from same category before rotation */
  maxTotalCategory: number;
  /** Max total posts from same creator */
  maxTotalCreator: number;
  /** Max total posts from same protocol */
  maxTotalProtocol: number;
  /** Percentage of feed reserved for serendipity/discovery (0-1) */
  serendipityFraction: number;
  /** Minimum score a serendipity post needs to qualify */
  serendipityMinScore: number;
  /** Percentage of feed for filter-bubble-break content (0-1) */
  filterBubbleFraction: number;
  /** Whether to enforce protocol interleaving */
  interleaveProtocols: boolean;
}

export const DEFAULT_DIVERSITY_CONFIG: DiversityConfig = {
  maxConsecutiveCategory: 3,
  maxConsecutiveCreator: 2,
  maxConsecutiveProtocol: 2,
  maxTotalCategory: 8,
  maxTotalCreator: 4,
  maxTotalProtocol: 6,
  serendipityFraction: 0.10,
  serendipityMinScore: 0.3,
  filterBubbleFraction: 0.05,
  interleaveProtocols: true,
};

export interface DiversityState {
  lastCategory: string | null;
  lastCreator: string | null;
  lastProtocol: string | null;
  consecutiveCategory: number;
  consecutiveCreator: number;
  consecutiveProtocol: number;
  categoryCounts: Map<string, number>;
  creatorCounts: Map<string, number>;
  protocolCounts: Map<string, number>;
  serendipitySlotsUsed: number;
  filterBubbleSlotsUsed: number;
  totalSlotsPlaced: number;
}

export interface ScoredItem {
  post: UnifiedPost;
  score: number;
  /** Pre-computed category (defaults to post.niches[0] or 'general') */
  category?: string;
  /** Pre-computed filter bubble flag — posts that challenge the user */
  isOpposingViewpoint?: boolean;
  /** Serendipity eligibility — novel/unfamiliar content */
  isSerendipitous?: boolean;
}

export interface DiversityResult {
  items: ScoredItem[];
  state: DiversityState;
  stats: {
    categoriesUsed: Map<string, number>;
    creatorsUsed: Map<string, number>;
    protocolsUsed: Map<string, number>;
    serendipityInjected: number;
    filterBubbleInjected: number;
    rotations: number; // How many times we skipped a higher-score post for diversity
  };
}

// ─── Diversity Engine ──────────────────────────────────────────────────

/**
 * Greedy diversity-aware ranking.
 *
 * Slots are filled one at a time. At each step, we evaluate the highest-scoring
 * remaining post that doesn't violate diversity constraints. If no post can fill
 * a slot without violation, the constraint is relaxed for that slot.
 */
export function diversifyFeed(
  items: ScoredItem[],
  config: DiversityConfig = DEFAULT_DIVERSITY_CONFIG,
  initialCategory?: string,
): DiversityResult {
  const state: DiversityState = {
    lastCategory: initialCategory ?? null,
    lastCreator: null,
    lastProtocol: null,
    consecutiveCategory: 0,
    consecutiveCreator: 0,
    consecutiveProtocol: 0,
    categoryCounts: new Map(),
    creatorCounts: new Map(),
    protocolCounts: new Map(),
    serendipitySlotsUsed: 0,
    filterBubbleSlotsUsed: 0,
    totalSlotsPlaced: 0,
  };

  const result: ScoredItem[] = [];
  const remaining = [...items];
  const stats = {
    categoriesUsed: new Map<string, number>(),
    creatorsUsed: new Map<string, number>(),
    protocolsUsed: new Map<string, number>(),
    serendipityInjected: 0,
    filterBubbleInjected: 0,
    rotations: 0,
  };

  // First pass: sort by score descending
  remaining.sort((a, b) => b.score - a.score);

  const totalSlots = remaining.length;
  const serendipityTarget = Math.round(totalSlots * config.serendipityFraction);
  const filterBubbleTarget = Math.round(totalSlots * config.filterBubbleFraction);

  while (remaining.length > 0) {
    const { pick, pickIndex, reason } = findBestDiversePick(
      remaining,
      state,
      config,
      {
        serendipityTarget,
        filterBubbleTarget,
        serendipityUsed: state.serendipitySlotsUsed,
        filterBubbleUsed: state.filterBubbleSlotsUsed,
        totalSlots,
        slotsPlaced: state.totalSlotsPlaced,
      },
    );

    if (pick === null) {
      // No post can meet even relaxed constraints — drop the highest-scoring
      // remaining post when it exceeds hard total caps, otherwise take it.
      const highest = remaining.shift()!;
      if (violatesTotalConstraints(highest, state, config)) {
        continue;
      }
      result.push(highest);
      updateDiversityState(state, highest, config);
      recordUsage(stats, highest);
    } else {
      const selected = remaining.splice(pickIndex, 1)[0]!;
      result.push(selected);
      updateDiversityState(state, selected, config);
      recordUsage(stats, selected);

      if (reason === 'serendipity') state.serendipitySlotsUsed++;
      if (reason === 'filter-bubble') state.filterBubbleSlotsUsed++;
      if (reason === 'rotation') stats.rotations++;
    }

    state.totalSlotsPlaced++;

    // Re-sort remaining to keep highest scores first
    // (we only do this periodically for performance)
    if (state.totalSlotsPlaced % 5 === 0) {
      remaining.sort((a, b) => b.score - a.score);
    }
  }

  return { items: result, state, stats };
}

// ─── Pick Selection ────────────────────────────────────────────────────

interface PickContext {
  serendipityTarget: number;
  filterBubbleTarget: number;
  serendipityUsed: number;
  filterBubbleUsed: number;
  totalSlots: number;
  slotsPlaced: number;
}

function findBestDiversePick(
  remaining: ScoredItem[],
  state: DiversityState,
  config: DiversityConfig,
  ctx: PickContext,
): { pick: ScoredItem | null; pickIndex: number; reason: string } {
  // ── Phase 1: Try to fill serendipity slots ─────────────────────────
  if (ctx.serendipityUsed < ctx.serendipityTarget) {
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      if (item.isSerendipitous && item.score >= config.serendipityMinScore) {
        if (!violatesConstraints(item, state, config)) {
          return { pick: item, pickIndex: i, reason: 'serendipity' };
        }
      }
    }
  }

  // ── Phase 2: Try to fill filter-bubble slots ───────────────────────
  if (ctx.filterBubbleUsed < ctx.filterBubbleTarget) {
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      if (item.isOpposingViewpoint && !violatesConstraints(item, state, config)) {
        return { pick: item, pickIndex: i, reason: 'filter-bubble' };
      }
    }
  }

  // ── Phase 3: Best scoring post that respects all constraints ───────
  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i]!;
    if (!violatesConstraints(item, state, config)) {
      return { pick: item, pickIndex: i, reason: 'best-fit' };
    }
  }

  // ── Phase 4: Relax protocol consecutive constraint only ────────────
  // Keep category + creator consecutive limits and hard total caps, so a
  // feed that is homogeneous on one axis (e.g. all posts from one protocol)
  // still interleaves on the other axes.
  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i]!;
    if (!violatesConsecutiveExcept(item, state, config, ['protocol'])) {
      return { pick: item, pickIndex: i, reason: 'rotation' };
    }
  }

  // ── Phase 5: Relax protocol + creator consecutive constraints ──────
  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i]!;
    if (!violatesConsecutiveExcept(item, state, config, ['protocol', 'creator'])) {
      return { pick: item, pickIndex: i, reason: 'rotation' };
    }
  }

  // ── Phase 6: Relax all consecutive constraints, keep hard totals ───
  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i]!;
    if (!violatesTotalConstraints(item, state, config)) {
      return { pick: item, pickIndex: i, reason: 'rotation' };
    }
  }

  // ── Phase 7: Everything relaxed — signal the caller to drop ────────
  return { pick: null, pickIndex: -1, reason: 'relaxed' };
}

// ─── Constraint Checking ───────────────────────────────────────────────

function getItemCategory(item: ScoredItem): string {
  return item.category ?? item.post.niches[0] ?? 'general';
}

function violatesConstraints(
  item: ScoredItem,
  state: DiversityState,
  config: DiversityConfig,
): boolean {
  const category = getItemCategory(item);
  const creator = item.post.author.id;
  const protocol = item.post.protocol;

  // Consecutive constraints
  if (category === state.lastCategory && state.consecutiveCategory >= config.maxConsecutiveCategory) {
    return true;
  }
  if (creator === state.lastCreator && state.consecutiveCreator >= config.maxConsecutiveCreator) {
    return true;
  }
  if (protocol === state.lastProtocol && state.consecutiveProtocol >= config.maxConsecutiveProtocol) {
    return true;
  }

  // Total count constraints
  const catCount = state.categoryCounts.get(category) ?? 0;
  if (catCount >= config.maxTotalCategory) return true;

  const creatorCount = state.creatorCounts.get(creator) ?? 0;
  if (creatorCount >= config.maxTotalCreator) return true;

  const protocolCount = state.protocolCounts.get(protocol) ?? 0;
  if (protocolCount >= config.maxTotalProtocol) return true;

  return false;
}

/**
 * Check the consecutive-count constraints for all axes EXCEPT the ones
 * listed in `relaxedAxes`. Total caps are always enforced. Used for
 * phased relaxation so a homogeneous feed still rotates on other axes.
 */
function violatesConsecutiveExcept(
  item: ScoredItem,
  state: DiversityState,
  config: DiversityConfig,
  relaxedAxes: Array<'category' | 'creator' | 'protocol'>,
): boolean {
  const category = getItemCategory(item);
  const creator = item.post.author.id;
  const protocol = item.post.protocol;

  if (
    !relaxedAxes.includes('category') &&
    category === state.lastCategory &&
    state.consecutiveCategory >= config.maxConsecutiveCategory
  ) {
    return true;
  }
  if (
    !relaxedAxes.includes('creator') &&
    creator === state.lastCreator &&
    state.consecutiveCreator >= config.maxConsecutiveCreator
  ) {
    return true;
  }
  if (
    !relaxedAxes.includes('protocol') &&
    protocol === state.lastProtocol &&
    state.consecutiveProtocol >= config.maxConsecutiveProtocol
  ) {
    return true;
  }

  // Total caps are hard limits and are never relaxed.
  return violatesTotalConstraints(item, state, config);
}

function violatesTotalConstraints(
  item: ScoredItem,
  state: DiversityState,
  config: DiversityConfig,
): boolean {
  const category = getItemCategory(item);
  const creator = item.post.author.id;
  const protocol = item.post.protocol;

  const catCount = state.categoryCounts.get(category) ?? 0;
  if (catCount >= config.maxTotalCategory) return true;

  const creatorCount = state.creatorCounts.get(creator) ?? 0;
  if (creatorCount >= config.maxTotalCreator) return true;

  const protocolCount = state.protocolCounts.get(protocol) ?? 0;
  if (protocolCount >= config.maxTotalProtocol) return true;

  return false;
}

// ─── State Management ─────────────────────────────────────────────────

function updateDiversityState(
  state: DiversityState,
  item: ScoredItem,
  _config: DiversityConfig,
): void {
  const category = getItemCategory(item);
  const creator = item.post.author.id;
  const protocol = item.post.protocol;

  // Update consecutive counters
  state.consecutiveCategory = category === state.lastCategory ? state.consecutiveCategory + 1 : 1;
  state.consecutiveCreator = creator === state.lastCreator ? state.consecutiveCreator + 1 : 1;
  state.consecutiveProtocol = protocol === state.lastProtocol ? state.consecutiveProtocol + 1 : 1;

  state.lastCategory = category;
  state.lastCreator = creator;
  state.lastProtocol = protocol;

  // Update total counters
  state.categoryCounts.set(category, (state.categoryCounts.get(category) ?? 0) + 1);
  state.creatorCounts.set(creator, (state.creatorCounts.get(creator) ?? 0) + 1);
  state.protocolCounts.set(protocol, (state.protocolCounts.get(protocol) ?? 0) + 1);
}

function recordUsage(
  stats: DiversityResult['stats'],
  item: ScoredItem,
): void {
  const category = getItemCategory(item);
  stats.categoriesUsed.set(category, (stats.categoriesUsed.get(category) ?? 0) + 1);
  stats.creatorsUsed.set(item.post.author.id, (stats.creatorsUsed.get(item.post.author.id) ?? 0) + 1);
  stats.protocolsUsed.set(item.post.protocol, (stats.protocolsUsed.get(item.post.protocol) ?? 0) + 1);
}

// ─── Interleaving ───────────────────────────────────────────────────────

/**
 * Simplified protocol interleaving: ensures no more than N posts from
 * the same protocol appear consecutively. Applied AFTER diversification.
 */
export function interleaveProtocols(
  items: ScoredItem[],
  maxConsecutive: number = 2,
): ScoredItem[] {
  if (items.length <= maxConsecutive) return items;

  const result: ScoredItem[] = [];
  // Group by protocol, maintaining order
  const groups = new Map<string, ScoredItem[]>();
  for (const item of items) {
    const p = item.post.protocol;
    const g = groups.get(p) ?? [];
    g.push(item);
    groups.set(p, g);
  }

  const keys = [...groups.keys()];
  const maxLen = Math.max(...keys.map((k) => groups.get(k)?.length ?? 0));

  // Round-robin interleave
  let consecCount = 0;
  let lastProtocol: string | null = null;

  for (let i = 0; i < maxLen; i++) {
    for (const key of keys) {
      const group = groups.get(key);
      if (group && i < group.length) {
        const item = group[i]!;

        // Check consecutive constraint
        if (item.post.protocol === lastProtocol) {
          consecCount++;
          if (consecCount >= maxConsecutive) continue; // Skip, let other protocols fill
        } else {
          consecCount = 1;
          lastProtocol = item.post.protocol;
        }

        result.push(item);
      }
    }
  }

  // Fill any remaining
  const resultIds = new Set(result.map((r) => r.post.id));
  for (const item of items) {
    if (!resultIds.has(item.post.id)) {
      result.push(item);
    }
  }

  return result;
}

// ─── Serendipity Detection ─────────────────────────────────────────────

/**
 * Determine if a post is serendipitous for a user.
 * A post is serendipitous if it:
 * - Is from a niche the user hasn't interacted with
 * - Has decent quality (not low-effort spam)
 * - Comes from a protocol/user the viewer hasn't seen
 */
export function isSerendipitous(
  post: UnifiedPost,
  seenNiches: Set<string>,
  seenCreators: Set<string>,
  seenProtocols: Set<string>,
): boolean {
  // Must have at least some quality
  const spamScore = ((post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
  if (spamScore > 0.5) return false;

  const postNiches = new Set(post.niches.map((n) => n.toLowerCase()));

  // Check if the post is from completely novel territory
  const novelNiche = ![...postNiches].some((n) => seenNiches.has(n));
  const novelCreator = !seenCreators.has(post.author.id);
  const novelProtocol = !seenProtocols.has(post.protocol);

  // Must be novel in at least 2 dimensions
  const noveltyDimensions = [novelNiche, novelCreator, novelProtocol].filter(Boolean).length;
  if (noveltyDimensions < 2) return false;

  // Must have some engagement (not completely ignored)
  const totalEng = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
  if (totalEng === 0 && seenCreators.size > 0) return false; // Zero engagement filtering after initial

  // Must have minimum content
  const textLen = (post.text ?? '').trim().length;
  if (textLen < 20 && post.embeds.length === 0) return false;

  return true;
}

// ─── Filter Bubble Prevention ──────────────────────────────────────────

/**
 * Determine if a post represents an opposing/alternative viewpoint
 * that should be shown to prevent filter bubbles.
 *
 * This is a simplified heuristic. A full implementation would use
 * topic clustering + stance detection.
 */
export function isOpposingViewpoint(
  post: UnifiedPost,
  userPreferredNiches: Set<string>,
): boolean {
  const postNiches = new Set(post.niches.map((n) => n.toLowerCase()));

  // Check if the post covers topics outside the user's usual bubble
  const nicheOverlap = [...postNiches].filter((n) => userPreferredNiches.has(n)).length;

  // Low overlap means it's from outside the bubble
  if (userPreferredNiches.size > 0) {
    const overlapRatio = nicheOverlap / Math.max(postNiches.size, 1);
    return overlapRatio < 0.3 && postNiches.size > 0;
  }

  return false;
}

// ─── Convenience Wrapper ───────────────────────────────────────────────

/**
 * One-shot diversity pass: score each post, then apply diversity algorithm.
 */
export function rankWithDiversity(
  posts: UnifiedPost[],
  scores: Map<string, number>,
  options: {
    config?: DiversityConfig;
    categories?: Map<string, string>;
    serendipitous?: Set<string>;
    opposingViewpoints?: Set<string>;
    userPreferredNiches?: Set<string>;
  } = {},
): UnifiedPost[] {
  const config = options.config ?? DEFAULT_DIVERSITY_CONFIG;

  // Build scored items
  const items: ScoredItem[] = posts.map((p) => ({
    post: p,
    score: scores.get(p.id) ?? 0.5,
    category: options.categories?.get(p.id),
    isSerendipitous: options.serendipitous?.has(p.id),
    isOpposingViewpoint: options.opposingViewpoints?.has(p.id),
  }));

  const result = diversifyFeed(items, config);
  const interleaved = config.interleaveProtocols
    ? interleaveProtocols(result.items)
    : result.items;

  return interleaved.map((i) => i.post);
}
