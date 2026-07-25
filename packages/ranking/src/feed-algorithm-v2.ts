/**
 * @degenfeed/ranking — Feed Algorithm V2 Orchestrator
 *
 * Integrates all V2 improvements into a single scoring pipeline:
 * 1. Base score: scorePost() from unified-scorer
 * 2. Quality V2: Enhanced quality signals (engagement rate, text quality, etc.)
 * 3. User Algo V2: Personalization (interests, temporal, format, discovery)
 * 4. Protocol Algo: Protocol-specific scoring (Nostr, Farcaster, etc.)
 * 5. Anti-Gaming: Trust multiplier (bot/spam/sybil detection)
 * 6. Transparency: Full explainability for every post
 */

import type { UnifiedPost } from '@degenfeed/types';
import { scorePost } from './unified-scorer';
import type { ScorePostOptions, ScoreBreakdown, ScoringWeights } from './unified-scorer';
import { scoreQualityV2 } from './quality-v2';
import type { QualitySignalsV2, QualityScorerContext } from './quality-v2';
import { scoreUserAlgoV2 } from './user-algo-v2';
import type { UserAlgoV2Context, UserAlgoV2Profile, UserAlgoV2Result } from './user-algo-v2';
import { scoreProtocolAlgo, extractProtocolSignalsFromPost } from './protocol-algo';
import type { ProtocolAlgoResult, ProtocolScoringContext } from './protocol-algo';
import { scoreAntiGaming } from './anti-gaming';
import type { AntiGamingContext, AntiGamingResult } from './anti-gaming';
import { whyThisPost, buildScoreBreakdownUI, suggestTuning, assignABTest } from './transparency';
import type {
  WhyThisPost,
  ScoreBreakdownUI,
  TuneYourFeedOption,
  ABTestConfig,
  AuditEntry,
} from './transparency';
import { emptyBehaviorProfile } from '@degenfeed/feed-core';
import type { UserBehaviorProfile } from '@degenfeed/feed-core';
import { DEFAULT_UNIFIED_WEIGHTS } from './unified-scorer';

// ─── Types ──────────────────────────────────────────────────────────────

export interface FeedAlgorithmV2Options extends ScorePostOptions {
  /** Quality V2 scorer context */
  qualityContext?: QualityScorerContext;
  /** User Algorithm V2 context */
  userAlgoContext?: UserAlgoV2Context;
  /** Protocol-specific signals context */
  protocolContext?: ProtocolScoringContext;
  /** Anti-gaming detection context */
  antiGamingContext?: AntiGamingContext;
  /** User ID for A/B test assignment */
  userId?: string;
  /** Active A/B tests */
  activeABTests?: ABTestConfig[];
}

export interface FeedAlgorithmV2Result {
  /** Final post score (0-100 range for UI display) */
  total: number;
  /** Unified scorer breakdown */
  baseBreakdown: ScoreBreakdown;
  /** Quality V2 signals */
  qualityV2?: QualitySignalsV2;
  /** User personalization result */
  personalization?: UserAlgoV2Result;
  /** Protocol-specific scoring */
  protocol?: ProtocolAlgoResult;
  /** Anti-gaming assessment */
  antiGaming?: AntiGamingResult;
  /** "Why This Post?" explanation */
  explanation: WhyThisPost;
  /** Full UI-ready breakdown */
  breakdownUI: ScoreBreakdownUI;
  /** Whether this is a discovery injection */
  isDiscovery: boolean;
  /** Active A/B test variants applied */
  activeABVariants?: string[];
}

export interface FeedRankingV2Options {
  /** Per-user V2 options */
  userOptions?: FeedAlgorithmV2Options;
  /** Diversity constraints */
  maxPerAuthor?: number;
  /** Whether to interleave protocols */
  interleave?: boolean;
}

// ─── Score a single post with V2 pipeline ─────────────────────────────

/**
 * Score a single post using the complete V2 feed algorithm pipeline.
 */
export function scorePostV2(
  post: UnifiedPost,
  options: FeedAlgorithmV2Options = {},
): FeedAlgorithmV2Result {
  // ── Step 1: Base scoring (unified scorer) ────────────────────────
  const { total, breakdown, transparency } = scorePost(post, options);
  const weights = resolveWeightsFromOptions(options);

  // ── Step 2: Quality V2 signals ───────────────────────────────────
  const qualityV2 = scoreQualityV2(post, {
    context: options.qualityContext,
  });

  // ── Step 3: User personalization ─────────────────────────────────
  let personalization: UserAlgoV2Result | undefined;
  if (options.userAlgoContext) {
    personalization = scoreUserAlgoV2(post, options.userAlgoContext);
  }

  // ── Step 4: Protocol-specific scoring ───────────────────────────
  let protocol: ProtocolAlgoResult | undefined;
  const protocolContext = options.protocolContext ?? extractProtocolSignalsFromPost(post);
  // Only compute if we have signals or a specific protocol
  if (protocolContext && Object.keys(protocolContext).length > 0) {
    protocol = scoreProtocolAlgo(post, protocolContext);
  } else {
    protocol = scoreProtocolAlgo(post, {});
  }

  // ── Step 5: Anti-gaming ─────────────────────────────────────────
  let antiGaming: AntiGamingResult | undefined;
  if (options.antiGamingContext) {
    antiGaming = scoreAntiGaming(post, options.antiGamingContext);
  }

  // ── Step 6: Combine scores ──────────────────────────────────────
  let finalScore = total;

  // Apply quality V2 as a multiplier (compositeScore is 0-100, normalize to 0-1 multiplier)
  const qualityMultiplier = 0.5 + (qualityV2.compositeScore / 100) * 0.5;
  finalScore *= qualityMultiplier;

  // Apply personalization multiplier
  if (personalization) {
    finalScore *= personalization.multiplier;
  }

  // Apply protocol multiplier
  if (protocol) {
    finalScore *= protocol.multiplier;
  }

  // Apply anti-gaming trust multiplier
  if (antiGaming) {
    finalScore *= antiGaming.trustMultiplier;
  }

  finalScore = Math.round(finalScore * 10000) / 10000;

  // ── Step 7: Build transparency / explanation ─────────────────────
  const explanation = whyThisPost(post, breakdown, weights, {
    protocolFactors: protocol?.factors,
    personalization,
    antiGaming,
    qualitySignals: qualityV2,
  });

  const breakdownUI = buildScoreBreakdownUI(breakdown, weights, {
    protocolFactors: protocol?.factors,
    qualitySignals: qualityV2,
    personalization: personalization
      ? {
          multiplier: personalization.multiplier,
          isDiscovery: personalization.isDiscovery,
          reasons: personalization.reasons,
        }
      : undefined,
    antiGaming: antiGaming
      ? {
          trustMultiplier: antiGaming.trustMultiplier,
          penalties: antiGaming.penalties,
        }
      : undefined,
  });

  // A/B test assignment
  let activeABVariants: string[] | undefined;
  if (options.userId && options.activeABTests?.length) {
    activeABVariants = options.activeABTests
      .filter((t) => assignABTest(options.userId!, t).isVariant)
      .map((t) => t.testId);
  }

  return {
    total: finalScore,
    baseBreakdown: breakdown,
    qualityV2,
    personalization,
    protocol,
    antiGaming,
    explanation,
    breakdownUI,
    isDiscovery: personalization?.isDiscovery ?? false,
    activeABVariants,
  };
}

// ─── Rank posts with V2 pipeline ──────────────────────────────────────

/**
 * Score and rank multiple posts using the V2 algorithm.
 * Applies diversity constraints and discovery injection.
 */
export function rankV2(
  posts: UnifiedPost[],
  options: FeedRankingV2Options = {},
): Array<{ post: UnifiedPost; result: FeedAlgorithmV2Result }> {
  const results: Array<{ post: UnifiedPost; result: FeedAlgorithmV2Result }> = [];
  const authorCounts = new Map<string, number>();
  const maxPerAuthor = options.maxPerAuthor ?? 5;

  for (const post of posts) {
    const result = scorePostV2(post, options.userOptions);
    results.push({ post, result });
  }

  // Sort by score descending
  results.sort((a, b) => b.result.total - a.result.total);

  // Apply diversity constraints
  const filtered: Array<{ post: UnifiedPost; result: FeedAlgorithmV2Result }> = [];
  for (const item of results) {
    const authorCount = authorCounts.get(item.post.author.id) ?? 0;
    if (authorCount >= maxPerAuthor) continue;
    authorCounts.set(item.post.author.id, authorCount + 1);
    filtered.push(item);
  }

  // Assign positions for transparency
  return filtered.map((item, i) => ({
    ...item,
    result: {
      ...item.result,
      explanation: {
        ...item.result.explanation,
        position: i,
      },
    },
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────

function resolveWeightsFromOptions(options: FeedAlgorithmV2Options): ScoringWeights {
  const modePresets: Record<string, Partial<ScoringWeights>> = {
    standard: {},
    'morning-digest': { recency: 80, engagement: 50, relevance: 60, quality: 50, reputation: 40, diversity: 50, source: 30, velocity: 30 },
    'breaking-news': { recency: 95, engagement: 80, relevance: 40, quality: 20, reputation: 20, diversity: 30, source: 20, velocity: 70 },
    'deep-dive': { recency: 30, engagement: 60, relevance: 80, quality: 80, reputation: 60, diversity: 60, source: 40, velocity: 20 },
    'quick-scroll': { recency: 70, engagement: 70, relevance: 50, quality: 30, reputation: 30, diversity: 40, source: 30, velocity: 50 },
    'for-you': { recency: 80, engagement: 70, relevance: 70, quality: 40, reputation: 40, diversity: 30, source: 20, velocity: 50 },
  };

  const base = { ...DEFAULT_UNIFIED_WEIGHTS, ...options.userWeights };
  const mode = options.mode ?? 'standard';
  if (mode !== 'standard') {
    const preset = modePresets[mode] ?? {};
    for (const key of Object.keys(preset) as Array<keyof ScoringWeights>) {
      if (preset[key] !== undefined) {
        base[key] = preset[key] as number;
      }
    }
  }
  return base;
}

// ─── Convenience wrappers for common operations ───────────────────────

/**
 * Create a V2 user context for personalization.
 * Shortcut for building the UserAlgoV2Context from parts.
 */
export function createUserAlgoV2Context(
  behaviorProfile?: UserBehaviorProfile,
  v2Profile?: UserAlgoV2Profile,
  followedCreators?: Set<string>,
  currentHour?: number,
): UserAlgoV2Context {
  return {
    behaviorProfile: behaviorProfile ?? emptyBehaviorProfile(),
    v2Profile: v2Profile ?? {
      interests: {},
      temporalPrefs: {},
      formatPrefs: { text: 0.5, image: 0.5, video: 0.5, audio: 0.3, link: 0.4 },
      creatorLoyalty: {},
      feedbackSignals: [],
      lastActivityByHour: {},
      postsSinceDiscovery: 0,
      discoveryShown: 0,
    },
    followedCreators: followedCreators ?? new Set(),
    recentEngagements: new Set(),
    totalPostsSeen: 0,
    currentHour: currentHour ?? new Date().getHours(),
  };
}

/**
 * Get tune-able suggestions for the user's current feed setup.
 */
export function getTuningSuggestions(
  currentWeights: ScoringWeights,
  v2Profile: UserAlgoV2Profile,
  recentEngagementRate: number,
): TuneYourFeedOption[] {
  return suggestTuning(currentWeights, v2Profile, recentEngagementRate);
}

export {
  whyThisPost,
  buildScoreBreakdownUI,
  suggestTuning,
  assignABTest,
};

export type {
  WhyThisPost,
  ScoreBreakdownUI,
  TuneYourFeedOption,
  ABTestConfig,
  AuditEntry,
};
