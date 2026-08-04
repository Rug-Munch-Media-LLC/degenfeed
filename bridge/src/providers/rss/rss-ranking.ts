export function freshnessScore(createdAt: number, now = Date.now()): number {
  const ageHours = Math.max(0, now - createdAt) / 3_600_000;
  if (ageHours < 0.5) return 1;
  if (ageHours < 6) return 0.9;
  if (ageHours < 24) return 0.7;
  if (ageHours < 72) return 0.45;
  if (ageHours < 168) return 0.2;
  return 0.05;
}

/**
 * Cross-reference grounding: an article covered by multiple feeds gets
 * higher authority. Diminishing returns after 5 sources.
 */
export function crossReferenceScore(crossReference: unknown): number {
  const refs = Array.isArray(crossReference) ? crossReference.length : 0;
  if (refs <= 1) return 0;
  return Math.min(1, 0.25 + (refs - 1) * 0.15);
}

// ─── Price Impact, Signals & Category Boost ──────────────────────────
// CryptoPanic-beating features: price-impact tagging (which coins an
// article affects), a simulated community vote signal (until real users
// vote), and multi-category boosts (preferred niches + trending velocity).

/** Preferred niche taxonomy used for the user-category boost. */
export const PREFERRED_NICHES: ReadonlySet<string> = new Set([
  'crypto',
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'ai',
  'layer2',
  'stablecoin',
]);

/**
 * Price-impact score 0..1: an article that mentions top market-cap coins
 * gets a boost proportional to the highest-weight coin mentioned, with a
 * small additive bonus for multi-coin coverage (capped at 1).
 */
export function priceImpactScore(priceImpact: unknown): number {
  if (!Array.isArray(priceImpact) || priceImpact.length === 0) return 0;
  const entries = priceImpact as PriceImpactEntry[];
  const maxWeight = entries.reduce((max, c) => Math.max(max, c.weight ?? 0), 0);
  const multiBonus = Math.min(0.3, (entries.length - 1) * 0.15);
  return Math.min(1, maxWeight + multiBonus);
}

export interface SyntheticSignals {
  votes: number;
  reasons: string[];
  breakdown: {
    tier1Source: boolean;
    crossReference: boolean;
    trendingCoin: boolean;
    verified: boolean;
  };
}

/**
 * Simulate community vote signals until real users exist:
 *  - tier-1 source (CoinDesk etc.):        +3
 *  - cited by 3+ feeds (cross-reference):  +2
 *  - mentions a trending coin:             +1
 *  - verified author/org:                  +1
 * Max possible = 7.
 */
export function computeSyntheticSignals(opts: {
  tier: number;
  crossReferenceCount: number;
  priceImpact: unknown;
  verified: boolean;
}): SyntheticSignals {
  let votes = 0;
  const reasons: string[] = [];
  const breakdown: SyntheticSignals['breakdown'] = {
    tier1Source: false,
    crossReference: false,
    trendingCoin: false,
    verified: false,
  };

  if (opts.tier === 1) {
    votes += 3;
    breakdown.tier1Source = true;
    reasons.push('tier-1 source');
  }
  if (opts.crossReferenceCount >= 3) {
    votes += 2;
    breakdown.crossReference = true;
    reasons.push('cited by 3+ feeds');
  }
  if (Array.isArray(opts.priceImpact)) {
    const symbols = (opts.priceImpact as PriceImpactEntry[]).map((c) => c.symbol);
    if (symbols.some((s) => TRENDING_COINS.has(s))) {
      votes += 1;
      breakdown.trendingCoin = true;
      reasons.push('mentions trending coin');
    }
  }
  if (opts.verified) {
    votes += 1;
    breakdown.verified = true;
    reasons.push('verified author/org');
  }

  return { votes, reasons, breakdown };
}

/**
 * Normalized per-niche article velocity (0..1) over a rolling window.
 * Used for the "trending category" boost: categories with the most recent
 * article volume get a higher weight.
 */
export function computeCategoryVelocity(
  posts: UnifiedPost[],
  now = Date.now(),
  windowMs = 6 * 60 * 60 * 1000,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (now - post.createdAt > windowMs) continue;
    for (const niche of post.niches ?? []) {
      counts.set(niche, (counts.get(niche) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...counts.values());
  const normalized = new Map<string, number>();
  for (const [niche, count] of counts) normalized.set(niche, count / max);
  return normalized;
}

/** Rank context: preferred niches + per-niche velocity for this batch. */
export interface RankContext {
  preferredNiches?: ReadonlySet<string>;
  categoryVelocity?: ReadonlyMap<string, number>;
}

/**
 * Compute the final news rank for a post (0..100).
 *
 * Signals (CryptoPanic-beating):
 *  - source reputation (tier 1 → high)
 *  - freshness decay (newer → higher)
 *  - cross-reference grounding (multiple feeds → higher authority)
 *  - price impact (top market-cap coins mentioned → boost)
 *  - simulated community votes (tier-1, cross-ref, trending coin, verified)
 *  - category boost (preferred niches + trending-category velocity)
 *  - sentiment (marginally boost positive/neutral over negative)
 *
 * Scores are stored on `raw.rank`, `raw.rankSignals`, `raw.signals` and
 * `raw.priceImpact` for transparency.
 */
export function rankNewsPost(post: UnifiedPost, now = Date.now(), ctx: RankContext = {}): number {
  const raw = post.raw as Record<string, unknown> | undefined;
  const label = (raw?.feedLabel as string | undefined) || post.author?.displayName || '';
  const tier = sourceTier(label);

  const reputation = (4 - tier) / 3; // tier 1 → 1.0, tier 4 → 0
  const freshness = freshnessScore(post.createdAt, now);
  const grounding = crossReferenceScore(raw?.crossReference);

  // Price impact: articles mentioning top market-cap coins rank higher.
  const priceImpact = Array.isArray(raw?.priceImpact) ? raw.priceImpact : [];
  const impact = priceImpactScore(priceImpact);

  // Simulated community vote signal (proportional weight in ranking).
  const crossReferenceCount = Array.isArray(raw?.crossReference)
    ? (raw.crossReference as unknown[]).length
    : 0;
  const signals = computeSyntheticSignals({
    tier,
    crossReferenceCount,
    priceImpact,
    verified: tier <= 2,
  });
  const signalScore = Math.min(1, signals.votes / 7); // 7 = max synthetic votes

  // Category boost: preferred niches (user categories) + trending velocity.
  const preferred = ctx.preferredNiches ?? PREFERRED_NICHES;
  const velocity = ctx.categoryVelocity ?? new Map<string, number>();
  const postNiches = post.niches ?? [];
  const preferredBoost = postNiches.some((n) => preferred.has(n)) ? 0.6 : 0;
  const trendingBoost = postNiches.reduce((max, n) => Math.max(max, velocity.get(n) ?? 0), 0);
  const categoryBoost = Math.min(1, preferredBoost + trendingBoost * 0.4);

  // Sentiment signal: normalized -1..+1 scaled to a ±5% rank adjustment.
  const sentimentRaw = raw?.sentiment as { normalized?: number } | undefined;
  const rawSentiment = sentimentRaw?.normalized;
  const sentimentValue =
    typeof rawSentiment === 'number' && Number.isFinite(rawSentiment) ? rawSentiment : 0;
  const sentimentSignal = Math.max(-1, Math.min(1, sentimentValue)) * 0.05;

  const score = Math.round(
    (reputation * 0.3 +
      freshness * 0.25 +
      grounding * 0.12 +
      impact * 0.1 +
      signalScore * 0.15 +
      categoryBoost * 0.08 +
      sentimentSignal) *
      100,
  );

  if (raw) {
    raw.sourceTier = tier;
    raw.rank = score;
    raw.signals = {
      votes: signals.votes,
      reasons: signals.reasons,
      breakdown: signals.breakdown,
      synthetic: true,
    };
    raw.rankSignals = {
      sourceReputation: Math.round(reputation * 100) / 100,
      freshness: Math.round(freshness * 100) / 100,
      crossReference: Math.round(grounding * 100) / 100,
      priceImpact: Math.round(impact * 100) / 100,
      signalVotes: Math.round(signalScore * 100) / 100,
      categoryBoost: Math.round(categoryBoost * 100) / 100,
      sentiment: Math.round(sentimentSignal * 100) / 100,
    };
  }
  return score;
}

/**
 * Rank a batch of posts by news rank (best first), then by freshness as
 * a stable tie-breaker. Populates raw.rank/raw.rankSignals/raw.signals on
 * each post. Computes per-niche velocity from the batch to power the
 * trending-category boost.
 */
export function rankNewsPosts(posts: UnifiedPost[], ctx: RankContext = {}): UnifiedPost[] {
  const now = Date.now();
  const velocity = computeCategoryVelocity(posts, now);
  const fullCtx: RankContext = { ...ctx, categoryVelocity: velocity };
  const scored = posts.map((post) => ({
    post,
    rank: rankNewsPost(post, now, fullCtx),
  }));
  scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return b.post.createdAt - a.post.createdAt;
  });
  return scored.map((s) => s.post);
}

// ─── Story Coverage & Blindspot Detection (Ground News killer) ────────
// Pure functions over the deduped/ranked post batch. The dedup pass already
// records `raw.crossReference` (feed labels covering the same story), so we
// can compute per-story coverage WITHOUT re-clustering titles: each post is
// its own story; the cross-reference list IS the multi-source coverage.
// These power the frontend "Full Coverage" and "Blindspot" sections.
