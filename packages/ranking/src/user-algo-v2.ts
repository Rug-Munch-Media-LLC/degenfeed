/**
 * @degenfeed/ranking — User Algorithm V2
 *
 * Enhanced user personalization beyond the V1 behavior profile:
 * 1. Interest learning: Auto-detect user interests from engagement patterns
 * 2. Temporal preferences: User's active hours, preferred content at different times
 * 3. Format preferences: User prefers text/images/video/audio
 * 4. Creator loyalty: Show more from creators user consistently engages with
 * 5. Discovery injection: Always include some new content (15% minimum)
 * 6. Feedback loop: "Show more like this" / "Show less like this" signals
 */

import type { UnifiedPost } from '@degenfeed/types';
import { personalizeScore as feedCorePersonalizeScore } from '@degenfeed/feed-core';
import type { UserBehaviorProfile } from '@degenfeed/feed-core';

// ─── Types ──────────────────────────────────────────────────────────────

export interface UserAlgoV2Profile {
  /** Interest weights: topic → confidence 0-1 */
  interests: Record<string, number>;
  /** Temporal preferences: hourOfDay (0-23) → preferred content type */
  temporalPrefs: Partial<Record<number, TemporalSlot>>;
  /** Format preference weights 0-1 */
  formatPrefs: FormatPreferences;
  /** Creator loyalty: creatorId → loyalty score 0-1 */
  creatorLoyalty: Record<string, number>;
  /** Creators the user has explicitly asked to see more/less of */
  feedbackSignals: FeedbackSignal[];
  /** Last content type consumed per hour band */
  lastActivityByHour: Partial<Record<number, string[]>>;
  /** Discovery counter: how many posts since last discovery injection */
  postsSinceDiscovery: number;
  /** Total discovery posts shown */
  discoveryShown: number;
}

export interface TemporalSlot {
  hourStart: number;
  hourEnd: number;
  /** Preferred content types during this time */
  preferredContentTypes: string[];
  /** Preferred topics during this time */
  preferredTopics: string[];
  /** Activity level: 0-1 */
  activityLevel: number;
}

export interface FormatPreferences {
  text: number;
  image: number;
  video: number;
  audio: number;
  link: number;
}

export interface FeedbackSignal {
  /** 'more' | 'less' | 'mute' */
  type: 'more' | 'less' | 'mute';
  /** What to apply feedback to: 'creator', 'topic', 'contentType' */
  target: 'creator' | 'topic' | 'contentType';
  /** Target identifier (creatorId, topic name, contentType) */
  targetId: string;
  /** When the feedback was given */
  timestamp: number;
  /** Confidence: how many times this feedback was repeated */
  confidence: number;
}

export interface UserAlgoV2Context {
  /** User's current behavior profile from feed-core */
  behaviorProfile: UserBehaviorProfile;
  /** V2 extended profile (stored separately) */
  v2Profile: UserAlgoV2Profile;
  /** Current hour of day (0-23) */
  currentHour: number;
  /** Creator IDs the user follows */
  followedCreators: Set<string>;
  /** Creators the user has engaged with in the last 7 days */
  recentEngagements: Set<string>;
  /** Total posts seen in current session */
  totalPostsSeen: number;
  /** Whether to force a discovery injection */
  forceDiscovery?: boolean;
}

export interface UserAlgoV2Result {
  /** Personalization multiplier: 0-3+ */
  multiplier: number;
  /** Whether this post is a discovery injection */
  isDiscovery: boolean;
  /** Human-readable reasons */
  reasons: string[];
}

// ─── Default profile ───────────────────────────────────────────────────

export function emptyUserAlgoV2Profile(): UserAlgoV2Profile {
  return {
    interests: {},
    temporalPrefs: {},
    formatPrefs: { text: 0.5, image: 0.5, video: 0.5, audio: 0.3, link: 0.4 },
    creatorLoyalty: {},
    feedbackSignals: [],
    lastActivityByHour: {},
    postsSinceDiscovery: 0,
    discoveryShown: 0,
  };
}

// ─── Interest Learning ─────────────────────────────────────────────────

/**
 * Update interest weights based on a user's engagement with a post.
 * Called on every like, repost, reply, bookmark, or dismiss.
 */
export function learnInterests(
  profile: UserAlgoV2Profile,
  post: UnifiedPost,
  action: 'engage' | 'dismiss' | 'view',
): UserAlgoV2Profile {
  const next: UserAlgoV2Profile = {
    ...profile,
    interests: { ...profile.interests },
    creatorLoyalty: { ...profile.creatorLoyalty },
    feedbackSignals: [...profile.feedbackSignals],
    lastActivityByHour: { ...profile.lastActivityByHour },
  };

  const weight = action === 'engage' ? 0.15 : action === 'dismiss' ? -0.1 : 0.05;
  const niches = post.niches ?? [];

  // Update topic interests
  for (const niche of niches) {
    const current = next.interests[niche] ?? 0;
    next.interests[niche] = Math.max(0, Math.min(1, current + weight));
  }

  // Update creator loyalty on positive engagement
  if (action === 'engage') {
    const current = next.creatorLoyalty[post.author.id] ?? 0;
    next.creatorLoyalty[post.author.id] = Math.min(1, current + 0.1);

    // Decay others slightly (forgetfulness)
    for (const [creatorId, score] of Object.entries(next.creatorLoyalty)) {
      if (creatorId !== post.author.id) {
        next.creatorLoyalty[creatorId] = Math.max(0, score - 0.01);
      }
    }
  }

  if (action === 'dismiss') {
    // Decay loyalty for dismissed posts' creators
    const current = next.creatorLoyalty[post.author.id] ?? 0;
    next.creatorLoyalty[post.author.id] = Math.max(0, current - 0.05);
  }

  // Update format preferences
  const contentType = post.contentType ?? detectContentType(post);
  if (next.formatPrefs[contentType as keyof FormatPreferences] !== undefined) {
    const delta = action === 'engage' ? 0.05 : action === 'dismiss' ? -0.03 : 0;
    const key = contentType as keyof FormatPreferences;
    next.formatPrefs[key] = Math.max(0, Math.min(1, (next.formatPrefs[key] ?? 0.5) + delta));
  }

  // Track temporal activity
  const hour = new Date().getHours();
  const currentTypes = next.lastActivityByHour[hour] ?? [];
  next.lastActivityByHour[hour] = [...new Set([...currentTypes, contentType])].slice(-10);

  return next;
}

// ─── Temporal Preference Learning ──────────────────────────────────────

/**
 * Learn temporal preferences from a sequence of engagement timestamps.
 * Call periodically with the user's activity log.
 */
export function learnTemporalPrefs(
  profile: UserAlgoV2Profile,
  activityLog: Array<{ hour: number; contentType: string; niches: string[] }>,
): UserAlgoV2Profile {
  const next: UserAlgoV2Profile = {
    ...profile,
    temporalPrefs: { ...profile.temporalPrefs },
  };

  // Group activity by hour
  const byHour = new Map<number, { contentTypes: Map<string, number>; topics: Map<string, number>; count: number }>();
  for (const entry of activityLog) {
    const bucket = byHour.get(entry.hour) ?? {
      contentTypes: new Map<string, number>(),
      topics: new Map<string, number>(),
      count: 0,
    };
    bucket.contentTypes.set(entry.contentType, (bucket.contentTypes.get(entry.contentType) ?? 0) + 1);
    for (const niche of entry.niches) {
      bucket.topics.set(niche, (bucket.topics.get(niche) ?? 0) + 1);
    }
    bucket.count++;
    byHour.set(entry.hour, bucket);
  }

  // Convert to temporal slots
  for (const [hour, data] of byHour) {
    if (data.count < 3) continue; // Not enough data

    const sortedTypes = [...data.contentTypes.entries()].sort((a, b) => b[1] - a[1]);
    const sortedTopics = [...data.topics.entries()].sort((a, b) => b[1] - a[1]);

    next.temporalPrefs[hour] = {
      hourStart: hour,
      hourEnd: hour,
      preferredContentTypes: sortedTypes.slice(0, 2).map(([t]) => t),
      preferredTopics: sortedTopics.slice(0, 3).map(([t]) => t),
      activityLevel: Math.min(1, data.count / 20),
    };
  }

  return next;
}

// ─── Discovery Injection ───────────────────────────────────────────────

/**
 * Check whether the next post should be a discovery injection.
 * Ensures at least 15% of posts are discovery content.
 */
export function shouldInjectDiscovery(
  ctx: UserAlgoV2Context,
  isFollowedAuthor: boolean,
  matchingNiches: number,
): boolean {
  const { v2Profile, totalPostsSeen, forceDiscovery } = ctx;

  if (forceDiscovery) return true;

  // Always inject if we've gone too long without discovery
  if (v2Profile.postsSinceDiscovery >= 10) return true;

  // Calculate current discovery ratio
  const discoveryRatio = totalPostsSeen > 0
    ? v2Profile.discoveryShown / totalPostsSeen
    : 0;

  // If below 15% threshold and this post is from a non-followed author with new niche
  if (discoveryRatio < 0.15 && !isFollowedAuthor && matchingNiches === 0) {
    return true;
  }

  return false;
}

// ─── Feedback loop processing ──────────────────────────────────────────

/**
 * Process a "Show more like this" / "Show less like this" feedback signal.
 */
export function processFeedback(
  profile: UserAlgoV2Profile,
  post: UnifiedPost,
  type: 'more' | 'less',
): UserAlgoV2Profile {
  const next: UserAlgoV2Profile = {
    ...profile,
    interests: { ...profile.interests },
    creatorLoyalty: { ...profile.creatorLoyalty },
    feedbackSignals: [...profile.feedbackSignals],
  };

  const now = Date.now();

  // Creator feedback
  next.feedbackSignals.push({
    type,
    target: 'creator',
    targetId: post.author.id,
    timestamp: now,
    confidence: 1,
  });

  // Topic feedback
  for (const niche of post.niches ?? []) {
    next.feedbackSignals.push({
      type,
      target: 'topic',
      targetId: niche,
      timestamp: now,
      confidence: 1,
    });
  }

  // Content type feedback
  const contentType = post.contentType ?? detectContentType(post);
  next.feedbackSignals.push({
    type,
    target: 'contentType',
    targetId: contentType,
    timestamp: now,
    confidence: 1,
  });

  // Deduplicate and increment confidence for repeated signals
  const deduped = new Map<string, FeedbackSignal>();
  for (const signal of next.feedbackSignals) {
    const key = `${signal.type}:${signal.target}:${signal.targetId}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.confidence++;
      existing.timestamp = Math.max(existing.timestamp, signal.timestamp);
    } else {
      deduped.set(key, { ...signal });
    }
  }

  // Remove stale signals (>30 days old)
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  next.feedbackSignals = [...deduped.values()].filter((s) => s.timestamp > cutoff);

  return next;
}

// ─── Main personalization scorer ───────────────────────────────────────

/**
 * Score a post using the V2 user algorithm.
 * Combines feed-core personalization with V2 enhancements.
 */
export function scoreUserAlgoV2(
  post: UnifiedPost,
  ctx: UserAlgoV2Context,
): UserAlgoV2Result {
  const reasons: string[] = [];
  let multiplier = 1.0;
  let isDiscovery = false;

  // ── 1. Feed-core base personalization ───────────────────────────
  const basePersonalization = feedCorePersonalizeScore(post, ctx.behaviorProfile);
  if (basePersonalization.boost !== 0) {
    multiplier *= 1 + basePersonalization.boost * 0.5;
  }

  // ── 2. Interest matching (V2) ──────────────────────────────────
  let interestScore = 0;
  for (const niche of post.niches ?? []) {
    const weight = ctx.v2Profile.interests[niche] ?? 0;
    if (weight > 0.3) interestScore += weight * 2; // Strong interest
    else if (weight > 0.1) interestScore += weight; // Mild interest
  }
  if (interestScore > 0) {
    multiplier *= 1 + Math.min(interestScore, 0.5);
    if (interestScore > 0.3) reasons.push('matches your interests');
  }

  // ── 3. Temporal preference matching ────────────────────────────
  const temporalSlot = ctx.v2Profile.temporalPrefs[ctx.currentHour];
  if (temporalSlot) {
    const contentType = post.contentType ?? detectContentType(post);
    const matchesTimeType = temporalSlot.preferredContentTypes.includes(contentType);
    const matchesTimeTopic = (post.niches ?? []).some((n) =>
      temporalSlot.preferredTopics.includes(n),
    );

    if (matchesTimeType) {
      multiplier *= 1.2;
      reasons.push(`great for this time of day`);
    }
    if (matchesTimeTopic) {
      multiplier *= 1.15;
    }

    // Boost base multiplier if user is very active at this hour
    if (temporalSlot.activityLevel > 0.6) {
      multiplier *= 1.1;
    }
  }

  // ── 4. Format preference matching ───────────────────────────────
  const contentType = post.contentType ?? detectContentType(post);
  const formatPref = ctx.v2Profile.formatPrefs[contentType as keyof FormatPreferences] ?? 0.5;
  if (formatPref > 0.6) {
    multiplier *= 1 + (formatPref - 0.5) * 0.4;
    reasons.push(`you prefer ${contentType} content`);
  } else if (formatPref < 0.3) {
    multiplier *= 1 - (0.3 - formatPref) * 0.3;
    reasons.push(`you rarely engage with ${contentType}`);
  }

  // ── 5. Creator loyalty boost ────────────────────────────────────
  const loyaltyScore = ctx.v2Profile.creatorLoyalty[post.author.id] ?? 0;
  if (loyaltyScore > 0.3) {
    multiplier *= 1 + loyaltyScore * 0.3;
    reasons.push(`you consistently engage with ${post.author.displayName}`);
  }

  // Followed creator base boost
  if (ctx.followedCreators.has(post.author.id)) {
    multiplier *= 1.15;
    reasons.push('you follow this creator');
  }

  // Recent engagement boost
  if (ctx.recentEngagements.has(post.author.id)) {
    multiplier *= 1.1;
    reasons.push('recently engaged with this creator');
  }

  // ── 6. Feedback signal processing ───────────────────────────────
  for (const signal of ctx.v2Profile.feedbackSignals) {
    if (signal.type === 'more') {
      const matches =
        (signal.target === 'creator' && signal.targetId === post.author.id) ||
        (signal.target === 'topic' && (post.niches ?? []).includes(signal.targetId)) ||
        (signal.target === 'contentType' && contentType === signal.targetId);

      if (matches) {
        const boost = Math.min(0.5, signal.confidence * 0.1);
        multiplier *= 1 + boost;
        reasons.push(`you asked for more ${signal.targetId}`);
      }
    }

    if (signal.type === 'less') {
      const matches =
        (signal.target === 'creator' && signal.targetId === post.author.id) ||
        (signal.target === 'topic' && (post.niches ?? []).includes(signal.targetId)) ||
        (signal.target === 'contentType' && contentType === signal.targetId);

      if (matches) {
        const penalty = Math.min(0.7, signal.confidence * 0.15);
        multiplier *= 1 - penalty;
        reasons.push(`you asked for less ${signal.targetId}`);
      }
    }

    if (signal.type === 'mute') {
      const matches =
        (signal.target === 'creator' && signal.targetId === post.author.id) ||
        (signal.target === 'topic' && (post.niches ?? []).includes(signal.targetId));

      if (matches) {
        multiplier *= 0.1; // Heavy demotion
        reasons.push(`you muted ${signal.targetId}`);
      }
    }
  }

  // ── 7. Discovery injection ─────────────────────────────────────
  const isFollowed = ctx.followedCreators.has(post.author.id);
  const nicheMatch = (post.niches ?? []).filter((n) => (ctx.v2Profile.interests[n] ?? 0) > 0.1).length;

  if (shouldInjectDiscovery(ctx, isFollowed, nicheMatch)) {
    isDiscovery = true;
    // Boost fresh/new content for discovery
    const ageHours = (Date.now() - post.createdAt) / 3600000;
    if (ageHours < 24) {
      multiplier *= 1.3;
      reasons.push('new discovery for you');
    } else {
      multiplier *= 1.1;
      reasons.push('exploring outside your interests');
    }
  }

  // Clamp multiplier to reasonable range
  multiplier = Math.max(0.05, Math.min(5, multiplier));

  return {
    multiplier,
    isDiscovery,
    reasons: [...new Set(reasons)],
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────

function detectContentType(post: UnifiedPost): string {
  if (post.contentType) return post.contentType;
  const hasVideo = post.embeds?.some((e) => e.kind === 'video');
  if (hasVideo) return 'video';
  const hasImage = post.embeds?.some((e) => e.kind === 'image');
  if (hasImage) return 'image';
  const textLen = (post.text ?? '').trim().length;
  if (textLen > 500) return 'article';
  if (textLen > 0) return 'text';
  return 'text';
}

// ─── Dedicated "Should ignore?" check for muted content ────────────────

/**
 * Check whether a post should be completely excluded based on feedback signals.
 */
export function isMutedByFeedback(
  post: UnifiedPost,
  profile: UserAlgoV2Profile,
): boolean {
  const contentType = post.contentType ?? detectContentType(post);

  for (const signal of profile.feedbackSignals) {
    if (signal.type === 'mute') {
      const matches =
        (signal.target === 'creator' && signal.targetId === post.author.id) ||
        (signal.target === 'topic' && (post.niches ?? []).includes(signal.targetId));
      if (matches && signal.confidence >= 2) return true; // Muted with confidence
    }
  }

  return false;
}
