/**
 * @degenfeed/api-worker — Feed Explainer
 *
 * Server-side utility that produces structured, human-readable explanations
 * for why a post appeared in the user's feed. Integrates with the unified
 * scorer from @degenfeed/ranking and the FeedWhyCard UI component.
 *
 * Used by /api/algo/explain/:postId to power the "Why am I seeing this?" UI.
 *
 * Output format matches what the FeedWhyCard expects — main reason,
 * secondary signals, score breakdown, and actionable links to settings.
 */

import { scorePost, type ScoringWeights } from '@degenfeed/ranking';
import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ExplainerContext {
  /** Niches the user is interested in */
  userNiches?: Set<string>;
  /** Set of followed creator IDs */
  followedCreators?: Set<string>;
  /** Set of muted niche slugs */
  mutedNiches?: Set<string>;
  /** Current algorithm weights (user-configured) */
  weights?: Partial<ScoringWeights>;
  /** Feed mode */
  mode?: string;
  /** Custom rules active for this user */
  customRules?: FeedRule[];
  /** Map of authorId → post count in current batch (for diversity) */
  recentAuthors?: Map<string, number>;
  /** Previous engagement snapshot for velocity */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
  /** Source quality per authorId */
  sourceQuality?: Map<string, number>;
  /** Timestamp (ms) */
  now?: number;
}

export interface FeedRule {
  id: string;
  type: 'boost-creator' | 'mute-hashtag' | 'min-engagement' | 'content-type';
  /** For boost-creator: the creator ID to boost */
  creatorId?: string;
  /** For boost-creator: display name */
  creatorName?: string;
  /** For mute-hashtag: the hashtag to mute */
  hashtag?: string;
  /** For min-engagement: minimum likes threshold */
  minLikes?: number;
  /** For content-type: the content type to filter to */
  contentType?: string;
  /** Score adjustment (-100 to +100) */
  adjustment?: number;
  /** Human-readable description */
  description: string;
}

export interface ExplainerSignal {
  icon: string;
  label: string;
  detail: string;
  score: number;
  contribution: number; // 0-1 weight
  adjustable: boolean;
  settingLink?: string;
}

export interface PostExplanation {
  totalScore: number;
  normalizedScore: number; // 0-100
  mainReason: { icon: string; text: string };
  signals: ExplainerSignal[];
  customRuleEffects: Array<{
    ruleId: string;
    description: string;
    effect: string;
    scoreDelta: number;
  }>;
  isFollowed: boolean;
  isMuted: boolean;
  protocol: string;
  settingsLink: string;
}

// ─── Signal metadata ────────────────────────────────────────────────────

const SIGNAL_META: Record<
  string,
  { icon: string; label: string; settingLink: string }
> = {
  recency: {
    icon: '🕐',
    label: 'Recency',
    settingLink: '/feed/tune?weight=recency',
  },
  engagement: {
    icon: '🔥',
    label: 'Popularity',
    settingLink: '/feed/tune?weight=popularity',
  },
  relevance: {
    icon: '🎯',
    label: 'Relevance',
    settingLink: '/feed/tune?weight=relevance',
  },
  quality: {
    icon: '💎',
    label: 'Content Quality',
    settingLink: '/feed/tune?weight=quality',
  },
  reputation: {
    icon: '⭐',
    label: 'Creator Reputation',
    settingLink: '/feed/tune?weight=reputation',
  },
  diversity: {
    icon: '🌈',
    label: 'Diversity',
    settingLink: '/feed/tune?weight=diversity',
  },
  source: {
    icon: '📡',
    label: 'Source Quality',
    settingLink: '/feed/tune?weight=source',
  },
  velocity: {
    icon: '📈',
    label: 'Trending Velocity',
    settingLink: '/feed/tune?weight=velocity',
  },
  followed: {
    icon: '👤',
    label: 'Creator Affinity',
    settingLink: '/feed/tune?weight=affinity',
  },
};

// ─── Human-readable reason builders ──────────────────────────────────────

function describeRecency(createdAt: number, now: number): string {
  const ageMs = now - createdAt;
  const ageMin = Math.round(ageMs / 60000);
  if (ageMin < 1) return 'Posted just now';
  if (ageMin < 60) return `Posted ${ageMin}m ago`;
  const ageHr = Math.round(ageMin / 60);
  if (ageHr < 24) return `Posted ${ageHr}h ago`;
  const ageDay = Math.round(ageHr / 24);
  return `Posted ${ageDay}d ago`;
}

function describeEngagement(post: UnifiedPost): string {
  const total = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
  if (total === 0) return 'No engagement yet';
  if (total > 500) return `${total}+ total engagements — highly viral`;
  if (total > 100) return `${total} engagements — trending in your network`;
  if (total > 20) return `${total} engagements — moderate activity`;
  return `${total} engagements`;
}

function describeRelevance(
  post: UnifiedPost,
  userNiches: Set<string>,
  followedCreators: Set<string>,
): string {
  const parts: string[] = [];
  const matchedNiches = post.niches.filter((n) => userNiches.has(n.toLowerCase()));
  if (matchedNiches.length > 0) {
    parts.push(`Matches your interest in ${matchedNiches.slice(0, 3).join(', ')}`);
  }
  if (followedCreators.has(post.author.id)) {
    parts.push(`You follow @${post.author.displayName || post.author.id.slice(0, 8)}`);
  }
  return parts.length > 0 ? parts.join('; ') : 'General content';
}

// ─── Main explainer function ────────────────────────────────────────────

/**
 * Build a detailed, human-readable explanation for why a post was scored
 * the way it was. Calls the unified scorer and translates the raw scores
 * into user-facing language.
 *
 * @param post - The post to explain
 * @param ctx - User context (niches, follows, weights, etc.)
 * @returns A structured PostExplanation ready for the API response
 */
export function explainPost(
  post: UnifiedPost,
  ctx: ExplainerContext,
): PostExplanation {
  const now = ctx.now ?? Date.now();
  const userNiches = ctx.userNiches ?? new Set<string>();
  const followedCreators = ctx.followedCreators ?? new Set<string>();
  const mutedNiches = ctx.mutedNiches ?? new Set<string>();

  // 1. Score the post using the unified scorer
  const { total, breakdown, transparency } = scorePost(post, {
    mode: (ctx.mode as 'standard' | 'for-you' | 'breaking-news' | 'morning-digest' | 'deep-dive' | 'quick-scroll') ?? 'standard',
    userWeights: ctx.weights,
    userNiches,
    followedCreators,
    mutedNiches,
    recentAuthors: ctx.recentAuthors,
    previousEngagement: ctx.previousEngagement as Map<string, { likes: number; reposts: number; replies: number; at: number }> | undefined,
    sourceQuality: ctx.sourceQuality,
    now,
  });

  // 2. Build signals list
  const signals: ExplainerSignal[] = [];

  // Recency signal
  signals.push({
    icon: SIGNAL_META.recency.icon,
    label: SIGNAL_META.recency.label,
    detail: describeRecency(post.createdAt, now),
    score: breakdown.recency,
    contribution: breakdown.recency * (ctx.weights?.recency ?? 60) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.recency.settingLink,
  });

  // Engagement/popularity signal
  signals.push({
    icon: SIGNAL_META.engagement.icon,
    label: SIGNAL_META.engagement.label,
    detail: describeEngagement(post),
    score: breakdown.engagement,
    contribution: breakdown.engagement * (ctx.weights?.engagement ?? 70) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.engagement.settingLink,
  });

  // Relevance signal
  signals.push({
    icon: SIGNAL_META.relevance.icon,
    label: SIGNAL_META.relevance.label,
    detail: describeRelevance(post, userNiches, followedCreators),
    score: breakdown.relevance,
    contribution: breakdown.relevance * (ctx.weights?.relevance ?? 50) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.relevance.settingLink,
  });

  // Quality signal
  signals.push({
    icon: SIGNAL_META.quality.icon,
    label: SIGNAL_META.quality.label,
    detail: breakdown.quality > 0.7
      ? 'High-quality content (original, substantial, or has media)'
      : breakdown.quality > 0.4
        ? 'Standard quality content'
        : 'Low-quality signal (short or minimal content)',
    score: breakdown.quality,
    contribution: breakdown.quality * (ctx.weights?.quality ?? 40) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.quality.settingLink,
  });

  // Reputation signal
  signals.push({
    icon: SIGNAL_META.reputation.icon,
    label: SIGNAL_META.reputation.label,
    detail: breakdown.reputation > 0.7
      ? 'From a reputable/verified creator'
      : breakdown.reputation > 0.4
        ? 'From an established creator'
        : 'From a newer or unverified account',
    score: breakdown.reputation,
    contribution: breakdown.reputation * (ctx.weights?.reputation ?? 30) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.reputation.settingLink,
  });

  // Diversity signal
  signals.push({
    icon: SIGNAL_META.diversity.icon,
    label: SIGNAL_META.diversity.label,
    detail: breakdown.diversity > 0.8
      ? 'Fresh author — helps keep feed diverse'
      : breakdown.diversity > 0.5
        ? 'Moderate author frequency in feed'
        : 'You\'ve seen this author recently — shown less for diversity',
    score: breakdown.diversity,
    contribution: breakdown.diversity * (ctx.weights?.diversity ?? 30) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.diversity.settingLink,
  });

  // Source signal
  signals.push({
    icon: SIGNAL_META.source.icon,
    label: SIGNAL_META.source.label,
    detail: `From ${post.protocol}${breakdown.source > 0.7 ? ' (high-quality source)' : breakdown.source > 0.4 ? '' : ' (lower-tier source)'}`,
    score: breakdown.source,
    contribution: breakdown.source * (ctx.weights?.source ?? 20) / 100,
    adjustable: true,
    settingLink: SIGNAL_META.source.settingLink,
  });

  // Velocity signal
  signals.push({
    icon: SIGNAL_META.velocity.icon,
    label: SIGNAL_META.velocity.label,
    detail: breakdown.velocity > 1.3
      ? 'Gaining engagement rapidly right now'
      : breakdown.velocity > 1.0
        ? 'Steady engagement'
        : 'Normal engagement velocity',
    score: breakdown.velocity,
    contribution: breakdown.velocity > 1
      ? (breakdown.velocity - 1) * (ctx.weights?.velocity ?? 40) / 100
      : 0,
    adjustable: true,
    settingLink: SIGNAL_META.velocity.settingLink,
  });

  // 3. Compute custom rule effects
  const customRuleEffects: PostExplanation['customRuleEffects'] = [];
  for (const rule of ctx.customRules ?? []) {
    let effect: string | null = null;
    let scoreDelta = 0;

    switch (rule.type) {
      case 'boost-creator':
        if (post.author.id === rule.creatorId) {
          effect = `Boosted: ${rule.creatorName ?? rule.creatorId} (+${rule.adjustment ?? 30} score)`;
          scoreDelta = (rule.adjustment ?? 30) / 100;
        }
        break;
      case 'mute-hashtag':
        if (rule.hashtag && post.text.toLowerCase().includes(rule.hashtag.toLowerCase())) {
          effect = `Muted: #${rule.hashtag} (penalty applied)`;
          scoreDelta = -0.5;
        }
        break;
      case 'min-engagement':
        if (post.metrics.likes < (rule.minLikes ?? 10)) {
          effect = `Below minimum ${rule.minLikes} likes (filtered down)`;
          scoreDelta = -0.3;
        }
        break;
      case 'content-type':
        if (rule.contentType && post.contentType !== rule.contentType) {
          effect = `Not matching content type "${rule.contentType}" (filtered out)`;
          scoreDelta = -0.5;
        } else if (rule.contentType && post.contentType === rule.contentType) {
          effect = `Matches content type "${rule.contentType}"`;
          scoreDelta = 0.2;
        }
        break;
    }

    if (effect) {
      customRuleEffects.push({ ruleId: rule.id, description: rule.description, effect, scoreDelta });
    }
  }

  // 4. Determine main reason
  const sortedSignals = [...signals].sort((a, b) => b.contribution - a.contribution);
  const topSignal = sortedSignals[0];
  const mainReason: { icon: string; text: string } = followedCreators.has(post.author.id)
    ? { icon: '👤', text: `You follow @${post.author.displayName || post.author.id.slice(0, 8)}` }
    : topSignal
      ? { icon: topSignal.icon, text: `${topSignal.label}: ${topSignal.detail}` }
      : { icon: '◆', text: 'Scored by the DegenFeed ranking algorithm' };

  // 5. Normalize total to 0-100
  const maxPossibleScore = 3.0; // rough max after multipliers
  const normalizedScore = Math.min(100, Math.round((total / maxPossibleScore) * 100));

  return {
    totalScore: Math.round(total * 10000) / 10000,
    normalizedScore,
    mainReason,
    signals: sortedSignals,
    customRuleEffects,
    isFollowed: followedCreators.has(post.author.id),
    isMuted: mutedNiches.size > 0 && post.niches.some((n) => mutedNiches.has(n.toLowerCase())),
    protocol: post.protocol,
    settingsLink: '/feed/tune',
  };
}

/**
 * Format an explanation as a human-readable paragraph for use in toasts,
 * tooltips, or accessibility announcements.
 */
export function explainerToText(explanation: PostExplanation): string {
  const lines: string[] = [
    `This post scored ${explanation.normalizedScore}/100 because:`,
  ];
  for (const s of explanation.signals.slice(0, 4)) {
    if (s.contribution > 0.01) {
      const pct = Math.round(s.contribution * 100);
      lines.push(`• ${s.label}: ${s.detail} (+${pct}%)`);
    }
  }
  if (explanation.customRuleEffects.length > 0) {
    for (const rule of explanation.customRuleEffects) {
      const sign = rule.scoreDelta >= 0 ? '+' : '';
      lines.push(`• Custom rule: ${rule.description} (${sign}${Math.round(rule.scoreDelta * 100)}%)`);
    }
  }
  lines.push('You can adjust your algorithm settings at /feed/tune');
  return lines.join('\n');
}
