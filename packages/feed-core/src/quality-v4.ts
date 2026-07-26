/**
 * @degenfeed/feed-core — Quality Scoring V4
 *
 * Enhanced scoring that layers on top of V3 with:
 * 1. Source diversity bonus: boost underrepresented protocols
 * 2. Content freshness decay: sigmoid-based curve instead of linear
 * 3. Engagement velocity: engagement/time ratio recency boost
 * 4. Cross-protocol virality: bonus for content appearing on 2+ protocols
 * 5. Creator reputation: historical quality tracking
 * 6. User preference alignment: boost matching user's niches
 *
 * Output: per-signal breakdown + normalized total (0-10).
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface QualityV4Context {
  /** Current timestamp (ms) */
  now: number;
  /** Per-protocol post count in current feed window */
  protocolCounts?: Map<string, number>;
  /** Total posts in window */
  totalPosts?: number;
  /** Per-creator historical quality scores (0-100 averages) */
  creatorHistory?: Map<string, number>;
  /** Previous engagement snapshot { likes, reposts, replies, at } */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
  /** User's niche preferences (e.g. ['bitcoin', 'defi', 'ai']) */
  userNiches?: string[];
  /** Cross-protocol tracking — which post IDs appear on 2+ protocols */
  crossProtocolPosts?: Set<string>;
  /** Protocol quality weights (overrides from V3) */
  protocolWeights?: Partial<Record<Protocol, number>>;
}

export interface QualityV4Signals {
  /** Total V4 score normalized 0-10 */
  total: number;
  /** Source diversity penalty/boost: -0.3 to +0.3 */
  sourceDiversityPenalty: number;
  /** Freshness score: 0 to 0.5 */
  freshnessScore: number;
  /** Engagement velocity: 0 to 0.4 */
  engagementVelocity: number;
  /** Cross-protocol boost: 0 to 0.3 */
  crossProtocolBoost: number;
  /** Creator reputation: 0 to 0.3 */
  creatorReputation: number;
  /** Preference alignment: 0 to 0.5 */
  preferenceAlignment: number;
  /** Human-readable reasons */
  reasons: string[];
}

// ─── Default protocol distribution (baseline for diversity) ────────────

const DEFAULT_PROTOCOL_WEIGHTS: Record<string, number> = {
  nostr: 0.2,
  farcaster: 0.18,
  bluesky: 0.15,
  lens: 0.1,
  mastodon: 0.1,
  reddit: 0.08,
  rss: 0.05,
  threads: 0.03,
  peertube: 0.02,
  youtube: 0.02,
  lemmy: 0.02,
  pixelfed: 0.01,
  other: 0.04,
};

// ─── Sigmoid freshness decay ───────────────────────────────────────────

/**
 * Compute a freshness score using a sigmoid decay curve.
 *
 * The sigmoid is centered at `halfLifeMs` (default 6 hours) so content
 * younger than ~4h gets a near-full boost, content older than ~12h drops
 * off rapidly, and content >24h gets minimal boost.
 *
 * Returns 0 to 0.5 (higher = fresher).
 */
export function sigmoidFreshness(
  createdAt: number,
  now: number,
  halfLifeMs = 6 * 60 * 60 * 1000,
): number {
  const age = Math.max(0, now - createdAt);
  // Normalize age relative to half-life, then apply sigmoid
  const x = (age - halfLifeMs) / (halfLifeMs * 0.4);
  const sigmoid = 1 / (1 + Math.exp(x));
  // Scale to 0-0.5 range and apply minimum floor
  return Math.round(Math.max(0.01, Math.min(0.5, sigmoid * 0.5)) * 100) / 100;
}

// ─── Source diversity ───────────────────────────────────────────────────

/**
 * Calculate source diversity penalty/boost.
 *
 * Compares the current protocol's representation against an expected
 * baseline. Over-represented protocols get a mild penalty; under-represented
 * ones get a boost to encourage diverse content.
 *
 * Returns -0.3 (over-represented) to +0.3 (under-represented).
 */
export function sourceDiversity(
  protocol: string,
  protocolCounts: Map<string, number>,
  totalPosts: number,
): number {
  if (totalPosts <= 0) return 0;

  const observedFreq = (protocolCounts.get(protocol) ?? 0) / totalPosts;
  const expectedFreq = DEFAULT_PROTOCOL_WEIGHTS[protocol] ?? DEFAULT_PROTOCOL_WEIGHTS.other ?? 0.04;

  const ratio = expectedFreq > 0 ? observedFreq / expectedFreq : 1;

  // Severe over-representation penalty
  if (ratio > 2.5) return -0.3;
  if (ratio > 1.8) return -0.2;
  if (ratio > 1.3) return -0.1;

  // Under-representation boost
  if (ratio < 0.3 && observedFreq < 0.05) return 0.3;
  if (ratio < 0.5) return 0.2;
  if (ratio < 0.8) return 0.1;

  return 0;
}

// ─── Engagement velocity ────────────────────────────────────────────────

/**
 * Compute engagement velocity score.
 *
 * Compares current engagement against a previous snapshot. A high ratio
 * indicates rising content (rapidly gaining interactions).
 *
 * Returns 0 to 0.4 (higher = faster rising).
 */
export function computeEngagementVelocityV4(
  postId: string,
  currentLikes: number,
  currentReposts: number,
  currentReplies: number,
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>,
): number {
  if (!previousEngagement) return 0;

  const prev = previousEngagement.get(postId);
  if (!prev) return 0;

  const currentTotal = currentLikes + currentReposts + currentReplies;
  const prevTotal = prev.likes + prev.reposts + prev.replies;

  const delta = currentTotal - prevTotal;
  if (delta <= 0) return 0;

  // Time-weighted: recent spikes matter more
  const timeDelta = Math.max(1, Date.now() - prev.at);
  const velocity = delta / (timeDelta / 1000 / 60); // engagements per minute

  if (velocity > 5) return 0.4; // Viral spike
  if (velocity > 2) return 0.3; // Fast rising
  if (velocity > 0.5) return 0.2; // Steady growth
  if (velocity > 0.1) return 0.1; // Slow growth

  return 0;
}

// ─── Cross-protocol virality ────────────────────────────────────────────

/**
 * Detect cross-protocol content and return a boost.
 *
 * Content that appears on 2+ protocols is likely valuable/interesting.
 * The more protocols, the higher the boost.
 *
 * Returns 0 to 0.3.
 */
export function crossProtocolBoost(
  protocolsCount: number,
  crossProtocolPosts?: Set<string>,
  postId?: string,
): number {
  // If explicit cross-protocol set is provided, use it
  if (crossProtocolPosts && postId && crossProtocolPosts.has(postId)) {
    return 0.3;
  }

  // Otherwise use the protocolsCount from the post's metadata
  if (protocolsCount >= 3) return 0.3;
  if (protocolsCount === 2) return 0.2;
  return 0;
}

// ─── Creator reputation ─────────────────────────────────────────────────

/**
 * Score based on creator's historical content quality.
 *
 * Creators with a track record of high-quality posts get a boost.
 * New/unrated creators default to 0.
 *
 * Returns 0 to 0.3.
 */
export function creatorReputation(creatorId: string, creatorHistory?: Map<string, number>): number {
  if (!creatorHistory) return 0;

  const avgQuality = creatorHistory.get(creatorId);
  if (avgQuality === undefined) return 0;

  if (avgQuality >= 90) return 0.3;
  if (avgQuality >= 75) return 0.2;
  if (avgQuality >= 60) return 0.1;
  if (avgQuality >= 40) return 0.05;

  return 0;
}

// ─── User preference alignment ──────────────────────────────────────────

/**
 * Score how well a post's niches match the user's stated preferences.
 *
 * Returns 0 to 0.5 (higher = better aligned).
 */
export function preferenceAlignment(
  postNiches: string[],
  userNiches?: string[],
  postText?: string,
): number {
  if (!userNiches || userNiches.length === 0) return 0;

  let matches = 0;
  for (const niche of postNiches) {
    if (userNiches.includes(niche)) matches++;
  }

  if (matches >= 3) return 0.5;
  if (matches === 2) return 0.35;
  if (matches === 1) return 0.2;

  // Check text for niche keywords
  if (postText && postText.length > 0) {
    const text = postText.toLowerCase();
    const textMatches = userNiches.filter((n) => text.includes(n.toLowerCase()));
    if (textMatches.length > 0) return 0.1;
  }

  return 0;
}

// ─── Composite scorer ───────────────────────────────────────────────────

/**
 * Compute the full V4 quality score for a post.
 *
 * Combines all 6 signals into a normalized 0-10 score with per-signal
 * breakdown and human-readable reasons.
 */
export function scoreQualityV4(
  post: Pick<UnifiedPost, 'id' | 'protocol' | 'createdAt' | 'niches' | 'text' | 'metrics'> & {
    author?: { id: string };
  },
  context: QualityV4Context,
): QualityV4Signals {
  const reasons: string[] = [];

  // 1. Source diversity
  const sd =
    context.protocolCounts && context.totalPosts
      ? sourceDiversity(post.protocol, context.protocolCounts, context.totalPosts)
      : 0;
  if (sd > 0) reasons.push(`Underrepresented protocol (+${sd.toFixed(1)})`);
  else if (sd < 0) reasons.push(`Over-represented protocol (${sd.toFixed(1)})`);

  // 2. Freshness (sigmoid decay)
  const fresh = sigmoidFreshness(post.createdAt, context.now);
  if (fresh > 0.3) reasons.push('Very recent content');
  else if (fresh > 0.1) reasons.push('Recent content');

  // 3. Engagement velocity
  const velo = context.previousEngagement
    ? computeEngagementVelocityV4(
        post.id,
        post.metrics?.likes ?? 0,
        post.metrics?.reposts ?? 0,
        post.metrics?.replies ?? 0,
        context.previousEngagement,
      )
    : 0;
  if (velo > 0.3) reasons.push('Viral engagement spike');
  else if (velo > 0.1) reasons.push('Rising engagement');

  // 4. Cross-protocol virality
  const cp = crossProtocolBoost(
    (post as unknown as Record<string, number>).crossProtocolCount ?? 0,
    context.crossProtocolPosts,
    post.id,
  );
  if (cp > 0) reasons.push(`Content on 2+ protocols (+${cp.toFixed(1)})`);

  // 5. Creator reputation
  const cr = creatorReputation(post.author?.id ?? '', context.creatorHistory);
  if (cr > 0) reasons.push('Known quality creator');

  // 6. Preference alignment
  const pa = preferenceAlignment(post.niches, context.userNiches, post.text);
  if (pa > 0) reasons.push('Matches your interests');

  const total = Math.round(
    Math.max(0, Math.min(10, (sd + fresh + velo + cp + cr + pa) * (10 / 2.3))),
  );

  return {
    total,
    sourceDiversityPenalty: Math.round(sd * 100) / 100,
    freshnessScore: fresh,
    engagementVelocity: Math.round(velo * 100) / 100,
    crossProtocolBoost: cp,
    creatorReputation: cr,
    preferenceAlignment: Math.round(pa * 100) / 100,
    reasons,
  };
}

export const QualityV4Scorer = {
  sigmoidFreshness,
  sourceDiversity,
  computeEngagementVelocityV4,
  crossProtocolBoost,
  creatorReputation,
  preferenceAlignment,
  scoreQualityV4,
};
