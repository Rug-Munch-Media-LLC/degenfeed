/**
 * feed-feedback — "Not interested" / "Show more like this" feedback.
 *
 * TikTok-style: when a user says "Show less like this", immediately
 * demote that topic/creator with a strong negative weight. When they
 * say "Show more like this", boost.
 *
 * Feedback is persisted to the user's behavior profile in KV.
 * Weights decay over time (14-day half-life) so stale feedback fades.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../types';

export type FeedbackAction = 'show-more' | 'show-less';

export interface FeedbackEntry {
  postId: string;
  action: FeedbackAction;
  topics: string[];
  creatorId: string;
  contentTypes: string[];
  timestamp: number;
}

export interface FeedbackProfile {
  entries: FeedbackEntry[];
  topicWeights: Record<string, number>;
  creatorWeights: Record<string, number>;
  contentTypeWeights: Record<string, number>;
  lastUpdated: number;
}

const FEEDBACK_KEY_PREFIX = 'user:feedback:';
const FEEDBACK_TTL = 60 * 60 * 24 * 30; // 30 days
const TOPIC_BOOST_DELTA = 0.3;
const TOPIC_DEMOTE_DELTA = -0.5;
const CREATOR_BOOST_DELTA = 0.2;
const CREATOR_DEMOTE_DELTA = -0.4;
const CONTENT_TYPE_BOOST_DELTA = 0.15;
const CONTENT_TYPE_DEMOTE_DELTA = -0.3;
const DECAY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function feedbackKey(userId: string): string {
  return `${FEEDBACK_KEY_PREFIX}${userId.toLowerCase()}`;
}

export function emptyFeedbackProfile(): FeedbackProfile {
  return {
    entries: [],
    topicWeights: {},
    creatorWeights: {},
    contentTypeWeights: {},
    lastUpdated: Date.now(),
  };
}

export async function loadFeedbackProfile(env: Env, userId: string): Promise<FeedbackProfile> {
  if (!env.CACHE || !userId) return emptyFeedbackProfile();
  try {
    const raw = await env.CACHE.get(feedbackKey(userId));
    if (!raw) return emptyFeedbackProfile();
    return JSON.parse(raw) as FeedbackProfile;
  } catch {
    return emptyFeedbackProfile();
  }
}

function applyDecay(profile: FeedbackProfile): FeedbackProfile {
  const now = Date.now();
  const decayFactor = 0.5 ** ((now - profile.lastUpdated) / DECAY_HALF_LIFE_MS);
  if (decayFactor > 0.95) return profile;

  for (const key of Object.keys(profile.topicWeights)) {
    const w = profile.topicWeights[key];
    if (w !== undefined) profile.topicWeights[key] = w * decayFactor;
  }
  for (const key of Object.keys(profile.creatorWeights)) {
    const w = profile.creatorWeights[key];
    if (w !== undefined) profile.creatorWeights[key] = w * decayFactor;
  }
  for (const key of Object.keys(profile.contentTypeWeights)) {
    const w = profile.contentTypeWeights[key];
    if (w !== undefined) profile.contentTypeWeights[key] = w * decayFactor;
  }
  profile.lastUpdated = now;
  return profile;
}

export async function recordFeedback(
  env: Env,
  userId: string,
  post: UnifiedPost,
  action: FeedbackAction,
): Promise<FeedbackProfile> {
  let profile = await loadFeedbackProfile(env, userId);
  profile = applyDecay(profile);

  const delta =
    action === 'show-more'
      ? {
          topic: TOPIC_BOOST_DELTA,
          creator: CREATOR_BOOST_DELTA,
          ctype: CONTENT_TYPE_BOOST_DELTA,
        }
      : {
          topic: TOPIC_DEMOTE_DELTA,
          creator: CREATOR_DEMOTE_DELTA,
          ctype: CONTENT_TYPE_DEMOTE_DELTA,
        };

  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    profile.topicWeights[lower] = Math.max(
      -3,
      Math.min(3, (profile.topicWeights[lower] ?? 0) + delta.topic),
    );
  }

  const creatorId = post.author.id.toLowerCase();
  profile.creatorWeights[creatorId] = Math.max(
    -3,
    Math.min(3, (profile.creatorWeights[creatorId] ?? 0) + delta.creator),
  );

  const ctype = post.contentType ?? 'text';
  profile.contentTypeWeights[ctype] = Math.max(
    -3,
    Math.min(3, (profile.contentTypeWeights[ctype] ?? 0) + delta.ctype),
  );

  profile.entries.push({
    postId: post.id,
    action,
    topics: post.niches,
    creatorId: post.author.id,
    contentTypes: [post.contentType ?? 'text'],
    timestamp: Date.now(),
  });

  if (profile.entries.length > 200) {
    profile.entries = profile.entries.slice(-200);
  }

  profile.lastUpdated = Date.now();

  if (env.CACHE) {
    try {
      await env.CACHE.put(feedbackKey(userId), JSON.stringify(profile), {
        expirationTtl: FEEDBACK_TTL,
      });
    } catch {
      /* non-critical */
    }
  }

  return profile;
}

export interface FeedbackBoostResult {
  multiplier: number;
  demotedTopics: string[];
  demotedCreators: string[];
  boostedTopics: string[];
  factors: string[];
}

export function computeFeedbackBoost(
  post: UnifiedPost,
  profile: FeedbackProfile,
): FeedbackBoostResult {
  const factors: string[] = [];
  const demotedTopics: string[] = [];
  const demotedCreators: string[] = [];
  const boostedTopics: string[] = [];

  let topicBoost = 1.0;
  let creatorBoost = 1.0;
  let ctypeBoost = 1.0;

  for (const niche of post.niches) {
    const lower = niche.toLowerCase();
    const weight = profile.topicWeights[lower] ?? 0;
    if (weight < -1.0) {
      topicBoost = Math.min(topicBoost, 0.3);
      demotedTopics.push(niche);
    } else if (weight < -0.3) {
      topicBoost = Math.min(topicBoost, 0.6);
      demotedTopics.push(niche);
    } else if (weight > 1.0) {
      topicBoost = Math.max(topicBoost, 2.0 + weight);
      boostedTopics.push(niche);
    } else if (weight > 0.3) {
      topicBoost = Math.max(topicBoost, 1.3);
      boostedTopics.push(niche);
    }
  }

  const creatorWeight = profile.creatorWeights[post.author.id.toLowerCase()] ?? 0;
  if (creatorWeight < -1.0) {
    creatorBoost = 0.2;
    demotedCreators.push(post.author.id);
  } else if (creatorWeight < -0.3) {
    creatorBoost = 0.5;
    demotedCreators.push(post.author.id);
  } else if (creatorWeight > 1.0) {
    creatorBoost = 2.0;
    factors.push('boosted-creator');
  } else if (creatorWeight > 0.3) {
    creatorBoost = 1.3;
    factors.push('preferred-creator');
  }

  const ctypeWeight = profile.contentTypeWeights[post.contentType ?? 'text'] ?? 0;
  if (ctypeWeight < -0.5) ctypeBoost = 0.5;
  else if (ctypeWeight > 0.5) {
    ctypeBoost = 1.3;
    factors.push('preferred-content-type');
  }

  const multiplier = topicBoost * creatorBoost * ctypeBoost;

  return { multiplier, demotedTopics, demotedCreators, boostedTopics, factors };
}

/**
 * Filters posts that should be completely suppressed based on strong
 * negative feedback (topic weight < -2.0 or creator weight < -2.0).
 */
export function filterSuppressedPosts(
  posts: UnifiedPost[],
  profile: FeedbackProfile,
): UnifiedPost[] {
  return posts.filter((post) => {
    for (const niche of post.niches) {
      const lower = niche.toLowerCase();
      if ((profile.topicWeights[lower] ?? 0) <= -2.0) return false;
    }
    const creatorWeight = profile.creatorWeights[post.author.id.toLowerCase()] ?? 0;
    if (creatorWeight <= -2.0) return false;
    return true;
  });
}
