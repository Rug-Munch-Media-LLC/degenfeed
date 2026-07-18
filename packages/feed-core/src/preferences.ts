/**
 * @degenfeed/feed-core — User preference learning
 *
 * Tracks user interactions to build a behavior profile that personalizes
 * the For You feed. Every interaction (view, like, repost, reply, tip,
 * bookmark, dismiss) updates topic interests, protocol preferences, and
 * creator affinity in a weighted decay model.
 *
 * Profiles are stored in KV at `user:behavior:{wallet}` and updated
 * server-side on every engagement action.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Profile shape ─────────────────────────────────────────────────

export interface UserBehaviorProfile {
  /** topic → interest weight (-1 to 1, positive = interested) */
  topics: Record<string, number>;
  /** protocol → preference weight */
  protocols: Record<string, number>;
  /** Content-type preference (post/image/video) */
  contentTypes: Record<string, number>;
  /** Frequently engaged creator IDs (FIFO, max 100) */
  creators: string[];
  /** Average session duration in minutes */
  avgSessionMinutes: number;
  /** likes + reposts / viewed — engagement rate 0-1 */
  engagementRate: number;
  /** When the profile was last updated (unix ms) */
  updatedAt: number;
  /** Running counters for computing engagementRate */
  _totalViews: number;
  _totalEngagements: number;
}

// ─── Default / empty profile ────────────────────────────────────────

export function emptyBehaviorProfile(): UserBehaviorProfile {
  return {
    topics: {},
    protocols: {},
    contentTypes: {},
    creators: [],
    avgSessionMinutes: 0,
    engagementRate: 0,
    updatedAt: 0,
    _totalViews: 0,
    _totalEngagements: 0,
  };
}

// ─── Interaction weights ────────────────────────────────────────────

export const INTERACTION_WEIGHTS: Record<string, number> = {
  view: 0.1,
  like: 0.3,
  repost: 0.4,
  reply: 0.5,
  tip: 0.6,
  bookmark: 0.4,
  dismiss: -0.3,
};

// ─── Learn from interaction ─────────────────────────────────────────

/**
 * Update a user's behavior profile based on an interaction with a post.
 * Returns a new profile reference (immutable-style update).
 */
export function learnFromInteraction(
  profile: UserBehaviorProfile,
  post: UnifiedPost,
  action: 'view' | 'like' | 'repost' | 'reply' | 'tip' | 'bookmark' | 'dismiss',
): UserBehaviorProfile {
  const weight = INTERACTION_WEIGHTS[action] ?? 0;

  // Deep-clone mutable fields so we don't mutate the caller's ref
  const next: UserBehaviorProfile = {
    ...profile,
    topics: { ...profile.topics },
    protocols: { ...profile.protocols },
    contentTypes: { ...profile.contentTypes },
    creators: [...profile.creators],
  };

  // ── Update topic interests ─────────────────────────────────────
  const contentType = post.contentType ?? detectContentTypeFromPost(post);
  const niches = post.niches ?? [];

  for (const topic of niches) {
    const current = next.topics[topic] ?? 0;
    next.topics[topic] = Math.max(-1, Math.min(1, current + weight));
  }

  // ── Content type preference ────────────────────────────────────
  const currentCt = next.contentTypes[contentType] ?? 0;
  next.contentTypes[contentType] = Math.max(-1, Math.min(1, currentCt + weight * 0.3));

  // ── Update protocol preferences ────────────────────────────────
  const currentProto = next.protocols[post.protocol] ?? 0;
  next.protocols[post.protocol] = Math.max(-1, Math.min(1, currentProto + weight * 0.5));

  // ── Track creators (positive signals only) ────────────────────
  if (weight > 0.2 && post.author?.id) {
    next.creators = next.creators.filter((id) => id !== post.author.id);
    next.creators.unshift(post.author.id);
    if (next.creators.length > 100) next.creators = next.creators.slice(0, 100);
  }

  // ── Running counters for engagement rate ──────────────────────
  if (action === 'view') {
    next._totalViews = (profile._totalViews ?? 0) + 1;
  } else if (action !== 'dismiss') {
    // Positive engagement
    next._totalEngagements = (profile._totalEngagements ?? 0) + 1;
    next._totalViews = (profile._totalViews ?? 0) + 1;
  }
  if (next._totalViews > 0) {
    next.engagementRate = Math.min(1, next._totalEngagements / next._totalViews);
  }

  next.updatedAt = Date.now();
  return next;
}

// ─── Personalization score ─────────────────────────────────────────

/**
 * Compute a personalization boost for a post given a user's behavior
 * profile. Positive values mean "the user is more likely to enjoy this".
 * Used by the For You feed to re-rank results.
 */
export function personalizeScore(
  post: UnifiedPost,
  profile: UserBehaviorProfile,
): {
  boost: number;
  reasons: string[];
} {
  let boost = 0;
  const reasons: string[] = [];

  const niches = post.niches ?? [];
  const contentType = post.contentType ?? detectContentTypeFromPost(post);

  // ── Topic match ────────────────────────────────────────────────
  let topicBoost = 0;
  for (const topic of niches) {
    const weight = profile.topics[topic];
    if (weight !== undefined) {
      topicBoost += weight * 2;
    }
  }
  if (topicBoost > 0) {
    boost += topicBoost;
    const likedTopics = niches.filter((t) => (profile.topics[t] ?? 0) > 0);
    if (likedTopics.length > 0) {
      reasons.push(`you like ${likedTopics.slice(0, 2).join(', ')}`);
    }
  }

  // ── Creator affinity ───────────────────────────────────────────
  if (post.author?.id && profile.creators.includes(post.author.id)) {
    boost += 0.5;
    reasons.push(`you follow ${post.author.displayName || post.author.id.slice(0, 8)}`);
  }

  // ── Protocol preference ────────────────────────────────────────
  const protoWeight = profile.protocols[post.protocol];
  if (protoWeight !== undefined && protoWeight > 0) {
    boost += protoWeight;
    reasons.push(`you engage on ${post.protocol}`);
  }

  // ── Content type ───────────────────────────────────────────────
  const ctWeight = profile.contentTypes[contentType];
  if (ctWeight !== undefined && ctWeight > 0) {
    boost += ctWeight * 0.5;
  }

  // ── Freshness bonus for preferred topics ───────────────────────
  const ageHours = (Date.now() - post.createdAt) / 3_600_000;
  if (boost > 0 && ageHours < 1) {
    boost *= 1.5;
    reasons.push('recently active in this topic');
  }

  // ── New-user onboarding: boost popular content ────────────────
  const totalInteractions = (profile._totalViews ?? 0) + (profile._totalEngagements ?? 0);
  if (totalInteractions < 20) {
    // New user — boost high-engagement posts
    const totalEng = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
    if (totalEng > 10) {
      const onboardingBoost = Math.min(1.0, totalEng / 100);
      boost += onboardingBoost;
      reasons.push('trending content');
    }
  }

  // Clamp: -2 to +5
  boost = Math.max(-2, Math.min(5, boost));

  return { boost, reasons };
}

// ─── Onboarding mode detection ──────────────────────────────────────

export function isOnboardingMode(profile: UserBehaviorProfile): boolean {
  const totalInteractions = (profile._totalViews ?? 0) + (profile._totalEngagements ?? 0);
  return totalInteractions < 20;
}

// ─── Internal helpers ───────────────────────────────────────────────

function detectContentTypeFromPost(post: UnifiedPost): string {
  const hasVideo = post.embeds?.some((e) => e.kind === 'video');
  if (hasVideo) return 'video';
  const hasImage = post.embeds?.some((e) => e.kind === 'image');
  if (hasImage) return 'image';
  return 'post';
}

// ─── Topic management helpers ───────────────────────────────────────

export interface TopicPreference {
  topic: string;
  weight: number;
  direction: 'up' | 'down' | 'neutral';
}

/**
 * Get a sorted list of topic preferences from a user profile,
 * suitable for display in settings UI.
 */
export function getLearnedTopics(profile: UserBehaviorProfile): TopicPreference[] {
  return Object.entries(profile.topics)
    .filter(([_, weight]) => Math.abs(weight) > 0.05)
    .map(([topic, weight]) => ({
      topic,
      weight,
      direction:
        weight > 0.05 ? ('up' as const) : weight < -0.05 ? ('down' as const) : ('neutral' as const),
    }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

/**
 * Manually adjust a topic weight (upvote or downvote).
 * Called from the settings UI when a user clicks ↑ or ↓ on a learned topic.
 */
export function adjustTopicWeight(
  profile: UserBehaviorProfile,
  topic: string,
  delta: number,
): UserBehaviorProfile {
  const next: UserBehaviorProfile = {
    ...profile,
    topics: { ...profile.topics },
  };
  const current = next.topics[topic] ?? 0;
  next.topics[topic] = Math.max(-1, Math.min(1, current + delta));
  next.updatedAt = Date.now();
  return next;
}

/**
 * Remove a topic from the learned profile entirely.
 */
export function clearTopic(profile: UserBehaviorProfile, topic: string): UserBehaviorProfile {
  const next: UserBehaviorProfile = {
    ...profile,
    topics: { ...profile.topics },
  };
  delete next.topics[topic];
  next.updatedAt = Date.now();
  return next;
}
