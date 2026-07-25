/**
 * @degenfeed/ranking — Algorithm Transparency
 *
 * Provides full explainability for feed rankings:
 * 1. "Why this post?" — explain every post in feed
 * 2. Score breakdown: Show component scores
 * 3. "Tune your feed" — adjust weights directly
 * 4. A/B testing: Test algo changes on subset of users
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { ScoringWeights, ScoreBreakdown } from './unified-scorer';
import type { UserAlgoV2Profile, UserAlgoV2Result } from './user-algo-v2';
import type { ProtocolAlgoResult } from './protocol-algo';
import type { AntiGamingResult } from './anti-gaming';
import type { QualitySignalsV2 } from './quality-v2';

// ─── Types ──────────────────────────────────────────────────────────────

export interface WhyThisPost {
  /** One-line summary for the UI card title */
  title: string;
  /** Short sentence explaining why this post was surfaced */
  summary: string;
  /** Per-factor explanations */
  factors: FactorExplanation[];
  /** Total weighted score (0-100) */
  totalScore: number;
  /** Rank position in feed (0-based) */
  position?: number;
  /** Whether this was a discovery injection */
  isDiscovery?: boolean;
}

export interface FactorExplanation {
  /** Factor name (e.g., "Recency", "Engagement", "Quality") */
  name: string;
  /** Raw score 0-1 */
  score: number;
  /** User-configurable weight 0-100 */
  weight: number;
  /** Weighted contribution to total */
  contribution: number;
  /** Icon/emoji for UI display */
  icon: string;
  /** Human-readable label */
  label: string;
  /** Long description of what this factor means */
  description: string;
}

export interface ScoreBreakdownUI extends ScoreBreakdown {
  /** Per-factor weight used */
  weights: ScoringWeights;
  /** Protocol-specific add-on scores */
  protocolFactors?: Record<string, number>;
  /** Quality V2 signals */
  qualitySignals?: QualitySignalsV2;
  /** Personalization factors */
  personalization?: {
    multiplier: number;
    isDiscovery: boolean;
    reasons: string[];
  };
  /** Anti-gaming trust */
  antiGaming?: {
    trustMultiplier: number;
    penalties: Record<string, number>;
  };
}

export interface TuneYourFeedOption {
  /** Factor name */
  factor: string;
  /** Current weight 0-100 */
  currentWeight: number;
  /** Suggested adjustment for current context */
  suggestion: { direction: 'increase' | 'decrease' | 'keep'; reason: string };
}

export interface ABTestConfig {
  /** A/B test ID */
  testId: string;
  /** Percentage of users in variant */
  variantPercent: number;
  /** Whether this user is in the test group */
  isVariant: boolean;
  /** Test parameters */
  params: Record<string, unknown>;
}

// ─── Factor metadata for UI display ────────────────────────────────────

const FACTOR_META: Record<string, { icon: string; label: string; description: string }> = {
  recency: {
    icon: '🕐',
    label: 'Freshness',
    description: 'How recently this was posted. Newer content gets a boost.',
  },
  engagement: {
    icon: '🔥',
    label: 'Engagement',
    description: 'Total likes, reposts, replies, and quotes (log-scaled).',
  },
  relevance: {
    icon: '🎯',
    label: 'Relevance',
    description: 'How well the topic matches your interests and followed creators.',
  },
  quality: {
    icon: '⭐',
    label: 'Quality',
    description: 'Originality, media quality, grammar, and content depth.',
  },
  reputation: {
    icon: '🏅',
    label: 'Reputation',
    description: 'Author verification, follower count, and historical quality.',
  },
  diversity: {
    icon: '🎨',
    label: 'Diversity',
    description: 'Ensures variety — limits repeat authors to keep your feed fresh.',
  },
  source: {
    icon: '📡',
    label: 'Source',
    description: 'Protocol/platform tier weighting (Nostr > Twitter, etc.).',
  },
  velocity: {
    icon: '📈',
    label: 'Velocity',
    description: 'How fast engagement is growing. Trending content gets a boost.',
  },
};

// ─── 1. "Why This Post?" Builder ───────────────────────────────────────

/**
 * Build a comprehensive "Why This Post?" explanation for any post.
 */
export function whyThisPost(
  post: UnifiedPost,
  breakdown: ScoreBreakdown,
  weights: ScoringWeights,
  options?: {
    position?: number;
    isDiscovery?: boolean;
    protocolFactors?: Record<string, number>;
    personalization?: UserAlgoV2Result;
    antiGaming?: AntiGamingResult;
    qualitySignals?: QualitySignalsV2;
  },
): WhyThisPost {
  const factors: FactorExplanation[] = [];
  const topReasons: string[] = [];

  // Build factor explanations from breakdown
  const factorKeys: Array<keyof ScoreBreakdown> = [
    'recency', 'engagement', 'relevance', 'quality',
    'reputation', 'diversity', 'source', 'velocity',
  ];

  for (const key of factorKeys) {
    const rawScore = breakdown[key] as number;
    const meta = FACTOR_META[key] ?? { icon: '📊', label: key, description: '' };
    const weight = weights[key as keyof ScoringWeights] ?? 50;
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    const contribution = (rawScore * weight) / totalWeight;

    factors.push({
      name: key,
      score: Math.round(rawScore * 1000) / 1000,
      weight,
      contribution: Math.round(contribution * 1000) / 1000,
      icon: meta.icon,
      label: meta.label,
      description: meta.description,
    });

    // Collect top reasons for summary
    if (rawScore > 0.6) topReasons.push(meta.label);
  }

  // Sort factors by contribution descending
  factors.sort((a, b) => b.contribution - a.contribution);

  // Build summary
  const summaryParts: string[] = [];
  const topFactors = factors.slice(0, 3);

  for (const f of topFactors) {
    if (f.contribution > 0.05) {
      summaryParts.push(`${f.label} (${Math.round(f.contribution * 100)}%)`);
    }
  }

  // Add protocol-specific contributions
  if (options?.protocolFactors) {
    for (const [name, score] of Object.entries(options.protocolFactors)) {
      if (score > 0) {
        factors.push({
          name: `protocol:${name}`,
          score,
          weight: 100,
          contribution: score,
          icon: '🔌',
          label: `Protocol: ${name}`,
          description: `Protocol-specific signal for ${post.protocol}`,
        });
      }
    }
  }

  // Add personalization info
  if (options?.personalization) {
    const p = options.personalization;
    if (p.multiplier > 1) {
      summaryParts.push(`Personalized (+${Math.round((p.multiplier - 1) * 100)}%)`);
    }
  }

  // Build title
  const isFollowed = breakdown.reasons.includes('followed');
  const title = isFollowed
    ? `You follow ${post.author.displayName}`
    : options?.isDiscovery
      ? 'Discovery: exploring new content'
      : topFactors[0]
        ? `Top factor: ${topFactors[0].label}`
        : 'Algorithm match';

  const summary = summaryParts.length > 0
    ? `This post appeared because: ${summaryParts.slice(0, 3).join(', ')}`
    : 'This post matched your feed algorithm with a balanced score.';

  return {
    title,
    summary,
    factors,
    totalScore: breakdown.total,
    position: options?.position,
    isDiscovery: options?.isDiscovery,
  };
}

// ─── 2. Score breakdown with weights ───────────────────────────────────

/**
 * Build a UI-ready score breakdown with weight context.
 */
export function buildScoreBreakdownUI(
  breakdown: ScoreBreakdown,
  weights: ScoringWeights,
  extras?: Pick<ScoreBreakdownUI, 'protocolFactors' | 'qualitySignals' | 'personalization' | 'antiGaming'>,
): ScoreBreakdownUI {
  return {
    ...breakdown,
    weights,
    ...extras,
  };
}

// ─── 3. "Tune Your Feed" Suggestions ────────────────────────────────────

/**
 * Generate suggestions for tuning feed weights based on user behavior.
 */
export function suggestTuning(
  currentWeights: ScoringWeights,
  userProfile: UserAlgoV2Profile,
  recentEngagementRate: number,
): TuneYourFeedOption[] {
  const suggestions: TuneYourFeedOption[] = [];

  // Based on content format preferences
  const formatPrefs = userProfile.formatPrefs;
  const preferredFormats = Object.entries(formatPrefs)
    .filter(([_, v]) => v > 0.6)
    .map(([k]) => k);

  if (preferredFormats.length > 0 && currentWeights.quality < 60) {
    suggestions.push({
      factor: 'quality',
      currentWeight: currentWeights.quality,
      suggestion: {
        direction: 'increase',
        reason: `You prefer ${preferredFormats.join(', ')} content — increasing quality weight may surface better media`,
      },
    });
  }

  // Based on engagement rate
  if (recentEngagementRate < 0.1 && currentWeights.engagement < 50) {
    suggestions.push({
      factor: 'engagement',
      currentWeight: currentWeights.engagement,
      suggestion: {
        direction: 'decrease',
        reason: 'Low engagement rate suggests current content may not be interesting. Try reducing engagement weight.',
      },
    });
  }

  if (recentEngagementRate > 0.3 && currentWeights.relevance < 50) {
    suggestions.push({
      factor: 'relevance',
      currentWeight: currentWeights.relevance,
      suggestion: {
        direction: 'increase',
        reason: 'You engage a lot — increasing relevance may help surface more of what you like.',
      },
    });
  }

  // Based on creator loyalty
  const loyalCreators = Object.entries(userProfile.creatorLoyalty)
    .filter(([_, v]) => v > 0.5)
    .length;

  if (loyalCreators > 5 && currentWeights.reputation < 50) {
    suggestions.push({
      factor: 'reputation',
      currentWeight: currentWeights.reputation,
      suggestion: {
        direction: 'increase',
        reason: `You consistently engage with ${loyalCreators} creators — increase reputation weight to see more from trusted sources.`,
      },
    });
  }

  // Based on feedback signals
  const lessSignals = userProfile.feedbackSignals.filter((s) => s.type === 'less').length;
  if (lessSignals > 3 && currentWeights.diversity < 40) {
    suggestions.push({
      factor: 'diversity',
      currentWeight: currentWeights.diversity,
      suggestion: {
        direction: 'increase',
        reason: 'You\'ve asked for less of some content — increasing diversity spreads out your feed.',
      },
    });
  }

  return suggestions;
}

// ─── 4. A/B Testing Framework ─────────────────────────────────────────

/**
 * Deterministic A/B test assignment based on user ID and test config.
 */
export function assignABTest(
  userId: string,
  config: Omit<ABTestConfig, 'isVariant'>,
): ABTestConfig {
  // Deterministic hash of userId + testId for consistent assignment
  const hash = simpleHash(`${userId}:${config.testId}`);
  const isVariant = (hash % 100) < config.variantPercent;

  return {
    ...config,
    isVariant,
  };
}

/**
 * Simple string hash for deterministic test assignment.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export interface ABTestVariant {
  testId: string;
  params: Record<string, unknown>;
  controlParams: Record<string, unknown>;
}

/**
 * Get the active A/B test variants for a user.
 */
export function getActiveVariants(
  userId: string,
  activeTests: ABTestConfig[],
): ABTestVariant[] {
  return activeTests
    .filter((t) => assignABTest(userId, t).isVariant)
    .map((t) => ({
      testId: t.testId,
      params: t.params,
      controlParams: {}, // Would come from the test definition
    }));
}

// ─── Audit trail ───────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: number;
  userId: string;
  postId: string;
  postText: string;
  position: number;
  mode: string;
  weights: ScoringWeights;
  totalScore: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  abTestVariants?: string[];
}

/**
 * Create an audit entry for a scored post (for debugging / transparency API).
 */
export function createAuditEntry(
  userId: string,
  post: UnifiedPost,
  breakdown: ScoreBreakdown,
  weights: ScoringWeights,
  options?: { position?: number; mode?: string; abTests?: ABTestConfig[] },
): AuditEntry {
  const abTests = options?.abTests;
  const activeTests = abTests
    ? getActiveVariants(userId, abTests)
    : [];

  return {
    timestamp: Date.now(),
    userId,
    postId: post.id,
    postText: post.text.slice(0, 100),
    position: options?.position ?? 0,
    mode: options?.mode ?? 'standard',
    weights,
    totalScore: breakdown.total,
    breakdown,
    reasons: breakdown.reasons,
    abTestVariants: activeTests.map((t) => t.testId),
  };
}
