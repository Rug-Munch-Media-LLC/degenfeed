export function freshnessScore(createdAt: number, now = Date.now()): number {
  const ageHours = Math.max(0, now - createdAt) / 3_600_000;
  if (ageHours < 0.5) return 1;
  if (ageHours < 6) return 0.9;
  if (ageHours < 24) return 0.7;
  if (ageHours < 72) return 0.45;
  if (ageHours < 168) return 0.2;
  return 0.05;
}

// ─── Content freshness policy (Fix 3) ─────────────────────────────────
// Posts older than this are rejected from the feed entirely. Configurable
// via FEED_MAX_AGE_HOURS (default 48h). 0 disables the filter.
export const FEED_MAX_AGE_HOURS = (() => {
  try {
    const raw = (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env?.FEED_MAX_AGE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 48;
})();

/** True when a post is within the max-age window (48h default). */
export function isFreshEnough(createdAt: number, now = Date.now()): boolean {
  if (FEED_MAX_AGE_HOURS <= 0) return true;
  return now - createdAt <= FEED_MAX_AGE_HOURS * 3_600_000;
}

/**
 * Niche relevance keywords — crypto/web3/DeFi vocabulary that signals
 * high-relevance content for the degenfeed audience. Matched against the
 * post title + text (case-insensitive, word-boundary).
 */
export const NICHE_RELEVANCE_KEYWORDS: ReadonlyArray<string> = [
  'bitcoin',
  'ethereum',
  'defi',
  'nft',
  'trading',
  'blockchain',
  'web3',
  'solana',
  'crypto',
  'token',
  'dex',
  'layer2',
  'stablecoin',
  'onchain',
  'dao',
  'smart contract',
  'yield',
  'liquidity',
  'airdrop',
];

const NICHE_RELEVANCE_RE = new RegExp(
  `\\b(${NICHE_RELEVANCE_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(
    '|',
  )})\\b`,
  'i',
);

/**
 * Niche relevance boost (0..1): 0.12 for a single keyword hit, up to a
 * 0.25 cap for 4+ hits. Rewards posts squarely inside the crypto/web3
 * beat over tangential general news.
 */
export function nicheRelevanceBoost(text: string | undefined): number {
  const haystack = (text || '').slice(0, 3000);
  if (!haystack.trim()) return 0;
  const matches = haystack.match(NICHE_RELEVANCE_RE);
  if (!matches) return 0;
  // Count distinct keyword hits (case-insensitive)
  const lowered = haystack.toLowerCase();
  let hits = 0;
  for (const kw of NICHE_RELEVANCE_KEYWORDS) {
    // word-boundary search per keyword
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lowered)) hits++;
  }
  return Math.min(0.25, 0.12 + Math.max(0, hits - 1) * 0.05);
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

  // Niche relevance: posts squarely in the crypto/web3/DeFi beat get a boost.
  const nicheBoost = nicheRelevanceBoost(`${post.text ?? ''} ${raw?.description ?? ''}`);

  let score =
    reputation * 0.3 +
    freshness * 0.25 +
    grounding * 0.12 +
    impact * 0.1 +
    signalScore * 0.15 +
    categoryBoost * 0.08 +
    sentimentSignal +
    nicheBoost * 0.12;

  // Freshness boost (Fix 3): posts younger than 2h get +30%.
  const ageHours = Math.max(0, now - post.createdAt) / 3_600_000;
  if (ageHours < 2) {
    score *= 1.3;
  } else if (ageHours > 24) {
    // Stale penalty (Fix 3): posts older than 24h get -50%.
    score *= 0.5;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score * 100)));

  if (raw) {
    raw.sourceTier = tier;
    raw.rank = finalScore;
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
      nicheRelevance: Math.round(nicheBoost * 100) / 100,
      freshnessBoost: ageHours < 2 ? 0.3 : 0,
      stalePenalty: ageHours > 24 ? 0.5 : 0,
    };
  }
  return finalScore;
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

// ─── Bias diversity mix (Ground News killer) ───────────────────────────
// The plain rank ordering can be dominated by the most prolific sources
// (e.g. CoinTelegraph + CoinDesk crowding out every other perspective).
// `ensureBiasDiversity` rebalances the top of the feed so the user sees a
// BALANCED mix of left / center / right sources — without ever dropping
// the single highest-ranked story, and without pulling in low-quality
// sources just to fill a quota.
//
// Buckets follow the numeric bias score:
//   left         bias <= -0.2
//   center      -0.2 <  bias < +0.2
//   right        bias >= +0.2

const LEFT_BIAS_BUCKET = 'left';
const CENTER_BIAS_BUCKET = 'center';
const RIGHT_BIAS_BUCKET = 'right';
type BiasBucket = typeof LEFT_BIAS_BUCKET | typeof CENTER_BIAS_BUCKET | typeof RIGHT_BIAS_BUCKET;

function biasBucketOf(label: string | undefined): BiasBucket {
  const score = sourceBiasScore(label);
  if (score <= -0.2) return LEFT_BIAS_BUCKET;
  if (score >= 0.2) return RIGHT_BIAS_BUCKET;
  return CENTER_BIAS_BUCKET;
}

/**
 * Rebalance a ranked post list toward bias diversity.
 *
 * Strategy (deterministic, score-preserving):
 *  1. Start with the top-ranked post as the headline (never dropped).
 *  2. Walk the remaining ranked list, always taking the highest-ranked post
 *     whose bias bucket has not yet reached its quota for the current pass.
 *  3. After every `perPass` picks, rotate the quota priority so no bucket
 *     starves: pass 1 favors center, pass 2 favors left, pass 3 favors
 *     right, then repeat.
 *  4. When a bucket is exhausted (or cannot be filled from the remaining
 *     pool), fall back to the next best post so the feed still fills.
 *
 * Returns the rebalanced list (same length as input, up to `limit`).
 */
export function ensureBiasDiversity(
  ranked: UnifiedPost[],
  limit = 50,
  minPerBucket = 2,
): UnifiedPost[] {
  if (ranked.length <= minPerBucket * 3) return ranked.slice(0, limit);

  const buckets: Record<BiasBucket, UnifiedPost[]> = { left: [], center: [], right: [] };
  for (const p of ranked) {
    const raw = p.raw as { feedLabel?: string } | undefined;
    const label = raw?.feedLabel ?? p.author?.displayName;
    buckets[biasBucketOf(label)].push(p);
  }

  const out: UnifiedPost[] = [];
  const quota: Record<BiasBucket, number> = {
    left: minPerBucket,
    center: minPerBucket,
    right: minPerBucket,
  };
  const picked = new Set<string>();
  const pickFrom = (bucket: BiasBucket): UnifiedPost | undefined => {
    const arr = buckets[bucket];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (!picked.has(p.id)) {
        picked.add(p.id);
        quota[bucket] = Math.max(0, quota[bucket] - 1);
        return p;
      }
    }
    return undefined;
  };

  // Headline: the single highest-ranked post (diversity must never bury it).
  const head = ranked[0];
  out.push(head);
  picked.add(head.id);
  // Consume the headline from its bucket's quota.
  const headRaw = head.raw as { feedLabel?: string } | undefined;
  const headBucket = biasBucketOf(headRaw?.feedLabel ?? head.author?.displayName);
  quota[headBucket] = Math.max(0, quota[headBucket] - 1);

  // Rotate the "preferred" bucket each pass so the mix stays balanced even
  // when one political wing is over-represented in the pool.
  const order: BiasBucket[] = [CENTER_BIAS_BUCKET, LEFT_BIAS_BUCKET, RIGHT_BIAS_BUCKET];
  let pass = 0;
  let cursor = 0;

  while (out.length < limit && cursor < ranked.length) {
    const preferred = order[pass % order.length];
    // First pass: fill every bucket to its quota, preferring the rotation.
    const tried: BiasBucket[] = [preferred, ...order.filter((b) => b !== preferred)];
    let pickedThisPass = false;
    for (const bucket of tried) {
      if (quota[bucket] > 0) {
        const p = pickFrom(bucket);
        if (p) {
          out.push(p);
          pickedThisPass = true;
          break;
        }
      }
    }
    if (pickedThisPass) {
      pass++;
      continue;
    }
    // All quotas met (or unfillable) — fill remaining slots by rank order.
    const next = ranked[cursor];
    if (next && !picked.has(next.id)) {
      picked.add(next.id);
      out.push(next);
      pickedThisPass = true;
    }
    cursor++;
    if (pickedThisPass) pass++;
  }

  // Safety: never shrink the result below what we already had if some
  // pathological bucket interplay dropped posts.
  return out.length >= limit
    ? out.slice(0, limit)
    : [...out, ...ranked.filter((p) => !picked.has(p.id))].slice(0, limit);
}

// ─── Story Coverage & Blindspot Detection (Ground News killer) ────────
// Pure functions over the deduped/ranked post batch. The dedup pass already
// records `raw.crossReference` (feed labels covering the same story), so we
// can compute per-story coverage WITHOUT re-clustering titles: each post is
// its own story; the cross-reference list IS the multi-source coverage.
// These power the frontend "Full Coverage" and "Blindspot" sections.
