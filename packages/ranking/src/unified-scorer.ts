/**
 * @degenfeed/ranking — Unified Feed Algorithm Scorer
 *
 * Merges three competing scoring systems into ONE function:
 * 1. FeedAlgorithm (user-configurable weights, 5 preset modes)
 * 2. scoreBreakdownV2 (fixed WEIGHTS_V2: engagement, quality, reputation, velocity)
 * 3. V3.1 formula (recency40%+engagement30%+relevance20%+diversity10% + dwell/feedback boosts)
 *
 * **Features from each system:**
 *   - FeedAlgorithm: user-configurable weight system, mode presets, freshness boosts
 *   - scoreBreakdownV2: engagement = log(1 + likes + 2×reposts + 3×replies + 4×quotes),
 *     quality signals (original content, media, length), velocity from KV snapshots,
 *     source protocol tiers, author reputation
 *   - V3.1: dwell/feedback boosts, behavior-profile personalization
 *
 * Use scorePost() instead of the old scoring functions.
 *
 * @example
 *   const { total, breakdown, transparency } = scorePost(post, {
 *     mode: 'breaking-news',
 *     userWeights: { recency: 90, engagement: 80 },
 *     now: Date.now(),
 *   });
 *
 * @example
 *   // For-you feed with personalization:
 *   const dwellResult = computeDwellBoost(post, dwellProfile);
 *   const feedbackResult = computeFeedbackBoost(post, feedbackProfile);
 *   const { total, breakdown, transparency } = scorePost(post, {
 *     mode: 'for-you',
 *     userNiches,
 *     followedCreators: userCtx.followed,
 *     isPersonalized: true,
 *   });
 */

import type { AlgorithmMode, UserBehaviorProfile } from '@degenfeed/feed-core';
import {
  buildQualityAuthorProfile,
  computeQualityScore,
  MODE_PRESETS,
  personalizeScore,
} from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { computeAuthorReputation, computeQualitySignals } from './scorer';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ScoringWeights {
  /** Freshness of the post (0-100) */
  recency: number;
  /** Community engagement signals (0-100) */
  engagement: number;
  /** Niche & topic relevance (0-100) */
  relevance: number;
  /** Content quality signals (0-100) */
  quality: number;
  /** Author reputation (0-100) */
  reputation: number;
  /** Feed diversity / anti-clustering (0-100) */
  diversity: number;
  /** Protocol source tier (0-100) */
  source: number;
  /** Engagement velocity / trending (0-100) */
  velocity: number;
}

/** All supported feed modes — the original 5 plus "for-you" */
export type UnifiedMode = AlgorithmMode | 'for-you';

export interface ScoreBreakdown {
  total: number;
  recency: number;
  engagement: number;
  relevance: number;
  quality: number;
  reputation: number;
  diversity: number;
  source: number;
  velocity: number;
  reasons: string[];
}

export interface EngagementSnapshot {
  likes: number;
  reposts: number;
  replies: number;
  at: number;
}

// ─── Default Weights ────────────────────────────────────────────────────

/**
 * Default scoring weights (balanced for the "standard" mode).
 * Each weight is 0-100 representing the relative importance of that factor.
 */
export const DEFAULT_UNIFIED_WEIGHTS: ScoringWeights = {
  recency: 60,
  engagement: 70,
  relevance: 50,
  quality: 40,
  reputation: 30,
  diversity: 30,
  source: 20,
  velocity: 40,
};

/**
 * Mode presets mapped to unified weights.
 * Extends the original FeedAlgorithm MODE_PRESETS with the 8-factor system.
 */
export const UNIFIED_MODE_PRESETS: Record<UnifiedMode, Partial<ScoringWeights>> = {
  standard: {},
  'morning-digest': {
    recency: 80,
    engagement: 50,
    relevance: 60,
    quality: 50,
    reputation: 40,
    diversity: 50,
    source: 30,
    velocity: 30,
  },
  'breaking-news': {
    recency: 95,
    engagement: 80,
    relevance: 40,
    quality: 20,
    reputation: 20,
    diversity: 30,
    source: 20,
    velocity: 70,
  },
  'deep-dive': {
    recency: 30,
    engagement: 60,
    relevance: 80,
    quality: 80,
    reputation: 60,
    diversity: 60,
    source: 40,
    velocity: 20,
  },
  'quick-scroll': {
    recency: 70,
    engagement: 70,
    relevance: 50,
    quality: 30,
    reputation: 30,
    diversity: 40,
    source: 30,
    velocity: 50,
  },
  'for-you': {
    recency: 80,
    engagement: 70,
    relevance: 70,
    quality: 40,
    reputation: 40,
    diversity: 30,
    source: 20,
    velocity: 50,
  },
};

// ─── Platform/Protocol Source Tiers ────────────────────────────────────

const PLATFORM_TIER: Record<string, number> = {
  nostr: 1.0,
  farcaster: 1.0,
  lens: 1.0,
  bluesky: 1.0,
  mastodon: 1.0,
  lemmy: 1.0,
  pixelfed: 1.0,
  threads: 0.7,
  atproto: 1.0,
  zora: 0.8,
  telegram: 0.6,
  reddit: 0.8,
  rss: 0.8,
  ponder: 0.8,
  ethereum: 0.6,
  solana: 0.6,
  peertube: 0.9,
  youtube: 0.9,
  kbin: 0.7,
  tildes: 0.7,
  discord: 0.6,
  matrix: 0.6,
  webhook: 0.5,
  github: 0.6,
  'newsletter-bridge': 0.5,
  mirror: 0.8,
  paragraph: 0.8,
  email: 0.5,
  google: 0.5,
  twitter: 0.5,
};

// ─── Recency half-life by mode ─────────────────────────────────────────

const MODE_HALF_LIFE: Record<UnifiedMode, number> = {
  standard: 12,
  'morning-digest': 8,
  'breaking-news': 1,
  'deep-dive': 12,
  'quick-scroll': 12,
  'for-you': 6,
};

// ─── Factor Computation Helpers ─────────────────────────────────────────

/**
 * Exponential decay for recency.  Half-life varies by mode so that
 * "breaking-news" decays aggressively (<1 h) while "deep-dive" lingers.
 */
export function recencyDecay(createdAt: number, now: number, halfLifeHours: number): number {
  const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return 0.5 ** (ageHours / halfLifeHours);
}

/**
 * Freshness boost multiplier based on post age:
 *   <15 min → 2.0x,  <1h → 1.5x,  <2h → 1.2x,  older → 1.0x
 */
export function freshnessBoost(createdAt: number, now: number): number {
  const ageMin = (now - createdAt) / 60000;
  if (ageMin < 15) return 2.0;
  if (ageMin < 60) return 1.5;
  if (ageMin < 120) return 1.2;
  return 1.0;
}

/**
 * Log-scaled engagement: log(1 + likes + 2×reposts + 3×replies + 4×quotes)
 * Prevents viral outliers from dominating.
 */
export function normalizeEngagement(post: UnifiedPost): number {
  const m = post.metrics;
  const raw = m.likes + m.reposts * 2 + m.replies * 3 + (m.quotes ?? 0) * 4;
  return Math.log(1 + raw);
}

/**
 * Engagement velocity from KV-snapshot deltas.
 * Returns a multiplier: 1.0 (no change) to 3.0 (high velocity).
 */
export function engagementVelocity(
  post: UnifiedPost,
  prev: EngagementSnapshot | undefined,
  now: number,
): number {
  if (!prev) return 1;
  const ageHrs = Math.max(0.1, (now - prev.at) / 3600000);
  const dLikes = Math.max(0, post.metrics.likes - prev.likes);
  const dReposts = Math.max(0, post.metrics.reposts - prev.reposts);
  const dReplies = Math.max(0, post.metrics.replies - prev.replies);
  const delta = dLikes + dReposts * 2 + dReplies * 3;
  const velocity = delta / ageHrs;
  return 1 + Math.min(velocity / 5, 2);
}

/**
 * Source weight by protocol tier.
 */
export function sourceWeight(protocol: string): number {
  return PLATFORM_TIER[protocol] ?? 0.5;
}

/**
 * Build the effective weights from user overrides + mode presets.
 */
function resolveWeights(userWeights?: Partial<ScoringWeights>, mode?: UnifiedMode): ScoringWeights {
  const base = { ...DEFAULT_UNIFIED_WEIGHTS, ...userWeights };
  if (mode && mode !== 'standard') {
    const preset = UNIFIED_MODE_PRESETS[mode] ?? {};
    for (const key of Object.keys(preset) as Array<keyof ScoringWeights>) {
      if (preset[key] !== undefined) {
        base[key] = preset[key] as number;
      }
    }
  }
  return base;
}

/**
 * Sum all weight values so contributions can be normalized.
 */
function totalWeight(weights: ScoringWeights): number {
  return (
    weights.recency +
    weights.engagement +
    weights.relevance +
    weights.quality +
    weights.reputation +
    weights.diversity +
    weights.source +
    weights.velocity
  );
}

/**
 * Mode-specific freshness/length boost.
 * Extended from FeedAlgorithm's freshnessBoost logic.
 */
function modeFreshnessBoost(
  post: UnifiedPost,
  mode: UnifiedMode,
  now: number,
): { multiplier: number; reason: string } {
  if (mode === 'morning-digest') {
    const ageHours = (now - post.createdAt) / (1000 * 60 * 60);
    if (ageHours < 24) return { multiplier: 1.5, reason: 'morning-digest:last-24h' };
    return { multiplier: 1.0, reason: '' };
  }
  if (mode === 'breaking-news') {
    const ageHours = (now - post.createdAt) / (1000 * 60 * 60);
    if (ageHours < 1) return { multiplier: 3.0, reason: 'breaking-news:under-1h' };
    if (ageHours < 4) return { multiplier: 2.0, reason: 'breaking-news:under-4h' };
    if (ageHours < 12) return { multiplier: 1.3, reason: 'breaking-news:under-12h' };
    return { multiplier: 1.0, reason: '' };
  }
  if (mode === 'deep-dive') {
    const textLen = (post.text ?? '').trim().length;
    if (textLen > 1000) return { multiplier: 1.8, reason: 'deep-dive:long-form' };
    if (textLen > 500) return { multiplier: 1.3, reason: 'deep-dive:substantial' };
    if (textLen < 100) return { multiplier: 0.6, reason: 'deep-dive:too-short' };
    return { multiplier: 1.0, reason: '' };
  }
  if (mode === 'quick-scroll') {
    const textLen = (post.text ?? '').trim().length;
    if (textLen > 500) return { multiplier: 0.5, reason: 'quick-scroll:too-long' };
    if (textLen > 200) return { multiplier: 0.8, reason: 'quick-scroll:medium' };
    if (textLen < 50) return { multiplier: 1.5, reason: 'quick-scroll:short' };
    return { multiplier: 1.0, reason: '' };
  }
  // For standard and for-you, use the general freshness boost
  const fb = freshnessBoost(post.createdAt, now);
  if (fb > 1.0) {
    const label = fb >= 2.0 ? 'very-fresh' : fb >= 1.5 ? 'fresh' : 'moderately-fresh';
    const detail = ageDetail(post.createdAt, now);
    return { multiplier: fb, reason: `${label}:${detail}` };
  }
  return { multiplier: 1.0, reason: '' };
}

function ageDetail(createdAt: number, now: number): string {
  const ageMin = Math.round((now - createdAt) / 60000);
  if (ageMin < 60) return `${ageMin}m`;
  return `${Math.round(ageMin / 60)}h`;
}

/**
 * Score a dwell boost from a pre-computed multiplier.
 * The multiplier should come from computeDwellBoost() in the worker layer,
 * which uses the full DwellProfile (niche/creator matching + dwell time).
 *
 * When no pre-computed multiplier is available, a simple boost is derived
 * from raw dwellMs using the same bucket thresholds as the worker.
 */
function scoreDwellBoost(
  dwellMsOrMultiplier: number,
  isMultiplier: boolean,
  nicheRelevance: number,
): { multiplier: number; reason: string } {
  if (isMultiplier) {
    // Pre-computed from worker-layer computeDwellBoost
    const label =
      dwellMsOrMultiplier >= 2.0
        ? 'dwell:deep-engagement'
        : dwellMsOrMultiplier >= 1.5
          ? 'dwell:high-engagement'
          : dwellMsOrMultiplier > 1.0
            ? 'dwell:moderate'
            : dwellMsOrMultiplier >= 0.6
              ? 'dwell:low'
              : 'dwell:skipped';
    return { multiplier: dwellMsOrMultiplier, reason: label };
  }
  // Raw dwell ms — compute a simple boost
  if (dwellMsOrMultiplier < 800) return { multiplier: 0.5, reason: 'dwell:skipped' };
  if (dwellMsOrMultiplier < 3000) return { multiplier: 0.8, reason: 'dwell:glanced' };
  if (dwellMsOrMultiplier < 15000) {
    const boost = 1.0 + nicheRelevance * 0.3;
    return { multiplier: boost, reason: `dwell:read(${Math.round(dwellMsOrMultiplier / 1000)}s)` };
  }
  if (dwellMsOrMultiplier < 60000) {
    const boost = 1.2 + nicheRelevance * 0.5;
    return {
      multiplier: boost,
      reason: `dwell:engaged(${Math.round(dwellMsOrMultiplier / 1000)}s)`,
    };
  }
  return {
    multiplier: 1.8 + nicheRelevance * 0.5,
    reason: `dwell:deep(${Math.round(dwellMsOrMultiplier / 1000)}s)`,
  };
}

// ─── Main Scoring Function ─────────────────────────────────────────────

export interface ScorePostOptions {
  /**
   * Feed mode.  The original 5 modes from FeedAlgorithm plus "for-you" as a
   * 6th mode that incorporates dwell/feedback personalization.
   * @default 'standard'
   */
  mode?: UnifiedMode;

  /**
   * User-configurable weight overrides (0-100 per factor).
   * Merged with mode presets — user weights take precedence.
   */
  userWeights?: Partial<ScoringWeights>;

  /** ─── Core context (shared across all modes) ─── */

  /** Niches the user is interested in (for relevance scoring). */
  userNiches?: Set<string>;
  /** Creators the user follows (boosts relevance). */
  followedCreators?: Set<string>;
  /** Niches the user has muted (penalizes relevance). */
  mutedNiches?: Set<string>;
  /**
   * Map of authorId → post count in the current batch.
   * Used for diversity penalty (anti-clustering).
   */
  recentAuthors?: Map<string, number>;
  /**
   * Previous engagement snapshot for velocity delta tracking.
   * Typically loaded from KV by the caller.
   */
  previousEngagement?: Map<string, EngagementSnapshot>;
  /**
   * Source quality per authorId (from follower counts etc.).
   */
  sourceQuality?: Map<string, number>;
  /** Current timestamp (ms).  Defaults to Date.now(). */
  now?: number;

  /** ─── For-You personalization ─── */

  /**
   * User behavior profile for topic/creator/content-type personalization.
   * Uses the feed-core personalizeScore() function when provided.
   */
  userBehavior?: Partial<UserBehaviorProfile> & { sessionStartedAt?: number };
  /**
   * Dwell boost multiplier from the worker-layer computeDwellBoost().
   * Pass computeDwellBoost(post, dwellProfile).multiplier here.
   * When unset, no dwell adjustment is applied.
   * When set to a raw ms value (>3.0), a simple dwell boost is computed
   * from the raw dwell time using the same bucket thresholds as the worker.
   * Values: <0.5 (skipped), ~0.8 (glanced), ~1.3 (read), ~2.0 (engaged), ~3.0+ (deep).
   */
  dwellMs?: number;
  /**
   * Feedback score multiplier from the worker-layer computeFeedbackBoost().
   * Pass computeFeedbackBoost(post, feedbackProfile).multiplier here.
   * Values: 0.2-0.5 (strong demotion), 1.0 (neutral), up to ~3.0 (strong boost).
   */
  feedbackScore?: number;
  /**
   * Enables for-you personalization using userBehavior, dwellMs, feedbackScore.
   * When true and mode === 'for-you', additional personalization layers are applied.
   */
  isPersonalized?: boolean;
}

/**
 * Score a single post using the unified feed algorithm.
 *
 * @param post - The post to score
 * @param options - Scoring options (mode, weights, context, personalization)
 * @returns An object with total score, per-factor breakdown, and human-readable reasons
 */
export function scorePost(
  post: UnifiedPost,
  options: ScorePostOptions = {},
): { total: number; breakdown: ScoreBreakdown; transparency: string[] } {
  const now = options.now ?? Date.now();
  const mode = options.mode ?? 'standard';
  const weights = resolveWeights(options.userWeights, mode);
  const tw = totalWeight(weights) || 1;

  const transparency: string[] = [];
  const reasons: string[] = [];

  // ── 1. Recency ───────────────────────────────────────────────────────
  const halfLife = MODE_HALF_LIFE[mode] ?? 12;
  const rawRecency = recencyDecay(post.createdAt, now, halfLife);
  if (rawRecency > 0.8) reasons.push('fresh');
  else if (rawRecency < 0.2) reasons.push('aging');

  // ── 2. Engagement (log-scaled, from scoreBreakdownV2) ────────────────
  const rawEngagement = normalizeEngagement(post);
  // Normalize log result to 0-1 range (log(1+1000)/log(1000) ≈ 1.0)
  const normalizedEngagement = Math.min(1, rawEngagement / Math.log(1000));
  if (normalizedEngagement > 0.6) reasons.push('viral');
  else if (normalizedEngagement > 0.3) reasons.push('trending');

  // ── 3. Relevance (niche match + followed boost) ──────────────────────
  const userNiches = options.userNiches ?? new Set<string>();
  const mutedNiches = new Set(options.mutedNiches ?? []);
  const followedCreators = options.followedCreators ?? new Set<string>();
  let rawRelevance = 0.3; // neutral baseline

  // Niche overlap
  let nicheMatches = 0;
  let mutedHits = 0;
  for (const n of post.niches) {
    const lower = n.toLowerCase();
    if (userNiches.has(lower)) nicheMatches++;
    if (mutedNiches.has(lower)) mutedHits++;
  }
  const matchBoost = nicheMatches * 0.25;
  const mutedPenalty = mutedHits > 0 ? 0.3 : 0;

  // Followed author boost
  const followedBoost = followedCreators.has(post.author.id) ? 0.3 : 0;

  rawRelevance = Math.max(0, Math.min(1, 0.3 + matchBoost + followedBoost - mutedPenalty));
  if (nicheMatches > 0) reasons.push('on-topic');
  if (followedCreators.has(post.author.id)) reasons.push('followed');
  if (mutedHits > 0) reasons.push('muted-niche');

  // ── 4. Quality signals (from scorer.ts) ────────────────────────────
  const sigCtx = { followed: followedCreators, now };
  const sigs = computeQualitySignals(post, sigCtx);
  // Normalize quality signals to 0-1 (max bonus is ~3+ for original content)
  const rawQuality = Math.min(1, Math.max(0, (sigs.total + 2) / 10));
  if (sigs.originalContentBonus > 0) reasons.push('original-content');
  if (sigs.mediaBonus > 0) reasons.push('has-media');

  // ── 5. Author reputation ────────────────────────────────────────────
  const authorRep = computeAuthorReputation(post, sigCtx);
  // Normalize reputation to 0-1 (max possible score is 2.0)
  const rawReputation = Math.min(1, authorRep.score / 2);
  if (authorRep.isVerified) reasons.push('verified-author');
  else if (authorRep.isEstablished) reasons.push('established-author');

  // ── 6. Diversity (author frequency penalty) ─────────────────────────
  const recentAuthors = options.recentAuthors ?? new Map<string, number>();
  const authorCount = recentAuthors.get(post.author.id) ?? 0;
  // Zero occurrences = no penalty; each additional reduces score
  const rawDiversity = Math.max(0, 1 - authorCount * 0.15);
  if (authorCount > 2) reasons.push('author-diversity');

  // ── 7. Source (protocol tier) ───────────────────────────────────────
  const rawSource = sourceWeight(post.protocol);

  // ── 8. Velocity (engagement rate + KV snapshot blend) ───────────────
  const prev = options.previousEngagement?.get(post.id);
  const kvVelocity = engagementVelocity(post, prev, now);
  // Blend KV velocity with engagement-rate velocity from signals
  const rawVelocity = Math.max(kvVelocity, sigs.engagementVelocity * 0.4 + 0.6);
  if (rawVelocity > 1.3) reasons.push('trending-now');

  // ── Weighted sum ─────────────────────────────────────────────────────
  const contributions = {
    recency: (rawRecency * weights.recency) / tw,
    engagement: (normalizedEngagement * weights.engagement) / tw,
    relevance: (rawRelevance * weights.relevance) / tw,
    quality: (rawQuality * weights.quality) / tw,
    reputation: (rawReputation * weights.reputation) / tw,
    diversity: (rawDiversity * weights.diversity) / tw,
    source: (rawSource * weights.source) / tw,
    velocity: (rawVelocity * weights.velocity) / tw,
  };

  const baseScore =
    contributions.recency +
    contributions.engagement +
    contributions.relevance +
    contributions.quality +
    contributions.reputation +
    contributions.diversity +
    contributions.source +
    contributions.velocity;

  // ── Quality score multiplier (from computeQualityScore, 0-100) ─────
  const qualityScore = computeQualityScore(post, {
    author: buildQualityAuthorProfile(post.author),
    uniqueness: 10,
  });
  const qualityMultiplier = Math.max(0.05, qualityScore / 100);

  // ── Mode-specific freshness/length boost ────────────────────────────
  const modeBoost = modeFreshnessBoost(post, mode, now);
  if (modeBoost.reason) {
    transparency.push(modeBoost.reason);
    reasons.push(modeBoost.reason);
  }

  let total = baseScore * qualityMultiplier * modeBoost.multiplier;

  // ── For-You personalization ──────────────────────────────────────────
  if (mode === 'for-you' && options.isPersonalized) {
    // A. Behavior profile personalization
    if (options.userBehavior) {
      const bpResult = personalizeScore(post, options.userBehavior as UserBehaviorProfile);
      if (bpResult.boost !== 0) {
        // apply as a multiplicative boost (range -0.5 to +1.0ish)
        const bpMultiplier = 1 + bpResult.boost;
        total *= Math.max(0.5, bpMultiplier);
        for (const r of bpResult.reasons) {
          transparency.push(`personalization:${r}`);
          reasons.push(r);
        }
      }
    }

    // B. Dwell boost
    // Values > 3.0 are treated as raw dwell ms; ≤ 3.0 as pre-computed multiplier
    if (options.dwellMs !== undefined && options.dwellMs > 0) {
      const isMultiplier = options.dwellMs <= 3.0;
      const dwellResult = scoreDwellBoost(options.dwellMs, isMultiplier, rawRelevance);
      total *= dwellResult.multiplier;
      transparency.push(dwellResult.reason);
      reasons.push(dwellResult.reason);
    }

    // C. Feedback boost (pre-computed multiplier from worker layer)
    if (options.feedbackScore !== undefined && options.feedbackScore !== 0) {
      const feedbackBoost = Math.max(0.1, Math.min(3.0, options.feedbackScore));
      total *= feedbackBoost;
      const fbReason = feedbackBoost < 1.0 ? 'feedback:demoted' : 'feedback:boosted';
      transparency.push(`${fbReason}(${feedbackBoost.toFixed(2)}x)`);
      reasons.push(fbReason);
    }
  }

  // ── Build output ─────────────────────────────────────────────────────
  const finalTotal = Math.round(total * 10000) / 10000;

  const breakdown: ScoreBreakdown = {
    total: finalTotal,
    recency: Math.round(rawRecency * 1000) / 1000,
    engagement: Math.round(normalizedEngagement * 1000) / 1000,
    relevance: Math.round(rawRelevance * 1000) / 1000,
    quality: Math.round(rawQuality * 1000) / 1000,
    reputation: Math.round(rawReputation * 1000) / 1000,
    diversity: Math.round(rawDiversity * 1000) / 1000,
    source: Math.round(rawSource * 1000) / 1000,
    velocity: Math.round(rawVelocity * 1000) / 1000,
    reasons: [...new Set(reasons)],
  };

  return { total: finalTotal, breakdown, transparency };
}
