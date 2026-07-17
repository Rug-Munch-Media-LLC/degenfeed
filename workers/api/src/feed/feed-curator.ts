/**
 * feed-curator — Smarter feed algorithm components.
 *
 * Seen tracking, freshness bias, explore/exploit, engagement prediction,
 * scroll depth tracking, content variety enforcement.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';

// ─── 1. SEEN POST TRACKING ───────────────────────────────────────────

const SEEN_KEY_PREFIX = 'user:seen:';
const SEEN_CAP = 1000;
const SEEN_TTL = 60 * 60 * 24 * 7; // 7 days

export async function loadSeenPosts(env: Env, wallet: string): Promise<Set<string>> {
  if (!env.CACHE || !wallet) return new Set();
  try {
    const raw = await env.CACHE.get(`${SEEN_KEY_PREFIX}${wallet.toLowerCase()}`);
    if (!raw) return new Set();
    const ids: string[] = JSON.parse(raw);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function recordSeenPosts(env: Env, wallet: string, postIds: string[]): Promise<void> {
  if (!env.CACHE || !wallet || postIds.length === 0) return;
  try {
    const key = `${SEEN_KEY_PREFIX}${wallet.toLowerCase()}`;
    const raw = await env.CACHE.get(key);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    for (const id of postIds) {
      if (!existing.includes(id)) existing.push(id);
    }
    const capped = existing.slice(-SEEN_CAP);
    await env.CACHE.put(key, JSON.stringify(capped), { expirationTtl: SEEN_TTL });
  } catch {
    /* non-critical */
  }
}

export function filterSeenPosts(posts: UnifiedPost[], seen: Set<string>): UnifiedPost[] {
  if (seen.size === 0) return posts;
  return posts.filter((p) => !seen.has(p.id));
}

// ─── 2. FRESHNESS BIAS ───────────────────────────────────────────────

export interface FreshnessBoost {
  post: UnifiedPost;
  boost: number;
}

export function applyFreshnessBias(posts: UnifiedPost[], now: number): FreshnessBoost[] {
  return posts.map((post) => {
    const ageMs = now - post.createdAt;
    const ageHours = ageMs / 3600000;
    let boost = 0;

    if (ageHours < 1) boost = 3;
    else if (ageHours < 6) boost = 2;
    else if (ageHours < 24) boost = 1;
    else if (ageHours > 72) boost = -1;

    return { post, boost };
  });
}

// ─── 3. EXPLORE vs EXPLOIT ──────────────────────────────────────────

export interface ExploreExploitSplit {
  exploit: UnifiedPost[];
  explore: UnifiedPost[];
}

/**
 * Splits posts into exploit (80%) and explore (20%) pools.
 * Exploit = content from followed/interested sources matching user's niches.
 * Explore = high-engagement content from different topics/creators.
 */
export function splitExploreExploit(
  posts: UnifiedPost[],
  followed: Set<string>,
  preferredNiches: Set<string>,
): ExploreExploitSplit {
  const exploit: UnifiedPost[] = [];
  const explore: UnifiedPost[] = [];

  for (const post of posts) {
    const isFollowed = followed.has(post.author.id);
    const nicheMatch = post.niches.some((n) => preferredNiches.has(n.toLowerCase()));
    const totalEngagement =
      (post.metrics.likes ?? 0) +
      (post.metrics.reposts ?? 0) +
      (post.metrics.replies ?? 0) +
      (post.metrics.quotes ?? 0);

    if (isFollowed || nicheMatch) {
      exploit.push(post);
    } else if (totalEngagement >= 3) {
      explore.push(post);
    }
  }

  return { exploit, explore };
}

/**
 * Interleaves explore posts every Nth position (default every 5th).
 */
export function interleaveExplore(
  exploitPosts: UnifiedPost[],
  explorePosts: UnifiedPost[],
  interval = 5,
): UnifiedPost[] {
  const result: UnifiedPost[] = [];
  const explorePool = [...explorePosts];
  let exploreIdx = 0;

  for (let i = 0; i < exploitPosts.length; i++) {
    const exploitPost = exploitPosts[i];
    if (exploitPost) result.push(exploitPost);
    if ((i + 1) % interval === 0 && exploreIdx < explorePool.length) {
      const candidate = explorePool[exploreIdx];
      if (candidate) {
        result.push(candidate);
        exploreIdx++;
      }
    }
  }

  return result;
}

// ─── 4. ENGAGEMENT PREDICTION ───────────────────────────────────────

export interface EngagementPrediction {
  post: UnifiedPost;
  predictedScore: number;
  factors: string[];
}

/**
 * Predicts how likely a user is to engage with a post.
 * Factors: topic match, creator affinity, content type preference, time of day.
 */
export function predictEngagement(
  posts: UnifiedPost[],
  preferredNiches: Set<string>,
  preferredContentTypes: Set<string>,
  engagedCreators: Set<string>,
  now: number,
): EngagementPrediction[] {
  return posts.map((post) => {
    let score = 0;
    const factors: string[] = [];

    for (const niche of post.niches) {
      if (preferredNiches.has(niche.toLowerCase())) {
        score += 2;
        factors.push(`topic:${niche}`);
      }
    }

    if (engagedCreators.has(post.author.id)) {
      score += 1.5;
      factors.push('creator-affinity');
    }

    const contentType = post.contentType ?? 'text';
    if (preferredContentTypes.has(contentType)) {
      score += 1;
      factors.push(`type:${contentType}`);
    }

    const hour = new Date(now).getHours();
    const postHour = new Date(post.createdAt).getHours();
    if (Math.abs(hour - postHour) <= 2) {
      score += 0.5;
      factors.push('time-proximity');
    }

    return { post, predictedScore: score, factors };
  });
}

// ─── 5. SCROLL DEPTH TRACKING ───────────────────────────────────────

const SCROLL_KEY_PREFIX = 'user:scroll:';

export interface ScrollProfile {
  sessions: number;
  avgDepth: number;
  maxDepth: number;
  bounceRate: number;
  lastSessionDepth: number;
  updatedAt: number;
}

export function emptyScrollProfile(): ScrollProfile {
  return {
    sessions: 0,
    avgDepth: 0,
    maxDepth: 0,
    bounceRate: 0,
    lastSessionDepth: 0,
    updatedAt: Date.now(),
  };
}

export async function loadScrollProfile(env: Env, wallet: string): Promise<ScrollProfile> {
  if (!env.CACHE || !wallet) return emptyScrollProfile();
  try {
    const raw = await env.CACHE.get(`${SCROLL_KEY_PREFIX}${wallet.toLowerCase()}`);
    if (!raw) return emptyScrollProfile();
    return JSON.parse(raw) as ScrollProfile;
  } catch {
    return emptyScrollProfile();
  }
}

export async function recordScrollDepth(
  env: Env,
  wallet: string,
  depth: number,
  sessionBounced: boolean,
): Promise<ScrollProfile> {
  const profile = await loadScrollProfile(env, wallet);

  profile.lastSessionDepth = depth;
  profile.sessions += 1;

  const totalDepthSoFar = profile.avgDepth * (profile.sessions - 1) + depth;
  profile.avgDepth = totalDepthSoFar / profile.sessions;

  if (depth > profile.maxDepth) profile.maxDepth = depth;

  const newBounces = sessionBounced ? 1 : 0;
  const totalBouncesSoFar = profile.bounceRate * (profile.sessions - 1) + newBounces;
  profile.bounceRate = totalBouncesSoFar / profile.sessions;

  profile.updatedAt = Date.now();

  if (env.CACHE) {
    try {
      await env.CACHE.put(`${SCROLL_KEY_PREFIX}${wallet.toLowerCase()}`, JSON.stringify(profile), {
        expirationTtl: 60 * 60 * 24 * 30,
      });
    } catch {
      /* non-critical */
    }
  }

  return profile;
}

/**
 * Adjusts fetch limit based on scroll behavior history.
 */
export function adjustLimitFromScroll(profile: ScrollProfile, defaultLimit: number): number {
  if (profile.sessions < 3) return defaultLimit;
  if (profile.bounceRate > 0.5) return Math.max(10, Math.floor(defaultLimit * 0.5));
  if (profile.avgDepth > defaultLimit * 0.8) return Math.min(100, defaultLimit * 2);
  return defaultLimit;
}

// ─── 6. CONTENT VARIETY ENFORCEMENT ──────────────────────────────────

export interface VarietyLimits {
  maxPerCreator: number;
  maxPerTopic: number;
}

export function enforceVariety(
  posts: UnifiedPost[],
  limits: VarietyLimits = { maxPerCreator: 2, maxPerTopic: 3 },
): UnifiedPost[] {
  const creatorCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const result: UnifiedPost[] = [];

  for (const post of posts) {
    const creatorId = post.author.id;
    const creatorCount = creatorCounts.get(creatorId) ?? 0;
    if (creatorCount >= limits.maxPerCreator) continue;

    let topicBlocked = false;
    for (const niche of post.niches) {
      const topicCount = topicCounts.get(niche.toLowerCase()) ?? 0;
      if (topicCount >= limits.maxPerTopic) {
        topicBlocked = true;
        break;
      }
    }
    if (topicBlocked && post.niches.length > 0) continue;

    creatorCounts.set(creatorId, creatorCount + 1);
    for (const niche of post.niches) {
      topicCounts.set(niche.toLowerCase(), (topicCounts.get(niche.toLowerCase()) ?? 0) + 1);
    }
    result.push(post);
  }

  return result;
}

const CONTENT_TYPE_ROTATION: Array<NonNullable<UnifiedPost['contentType']>> = [
  'text',
  'image',
  'video',
  'link',
  'thread',
];

/**
 * Rotates posts so content types are well-distributed.
 * Groups by type, then interleaves type groups.
 */
export function rotateContentTypes(posts: UnifiedPost[]): UnifiedPost[] {
  const byType = new Map<string, UnifiedPost[]>();
  for (const post of posts) {
    const type = post.contentType ?? 'text';
    const group = byType.get(type) || [];
    group.push(post);
    byType.set(type, group);
  }

  const result: UnifiedPost[] = [];
  const typeQueue = [...CONTENT_TYPE_ROTATION];
  let added = true;

  while (added) {
    added = false;
    for (const type of typeQueue) {
      const group = byType.get(type);
      if (group && group.length > 0) {
        const next = group.shift();
        if (next) {
          result.push(next);
          added = true;
        }
      }
    }
  }

  return result;
}

// ─── 7. CURATED FEED ORCHESTRATOR ────────────────────────────────────

export interface CuratedFeedOptions {
  wallet?: string;
  limit: number;
  followed: Set<string>;
  preferredNiches: Set<string>;
  preferredContentTypes: Set<string>;
  engagedCreators: Set<string>;
  scrollProfile?: ScrollProfile;
}

export interface CuratedFeedResult {
  posts: UnifiedPost[];
  meta: {
    total: number;
    seenFiltered: number;
    freshnessBoosts: number;
    exploreCount: number;
    exploitCount: number;
    predictedEngagementAvg: number;
    adjustedLimit: number;
  };
}

export function curateFeed(
  posts: UnifiedPost[],
  seenPosts: Set<string>,
  opts: CuratedFeedOptions,
): CuratedFeedResult {
  const now = Date.now();
  const adjustedLimit = opts.scrollProfile
    ? adjustLimitFromScroll(opts.scrollProfile, opts.limit)
    : opts.limit;

  // 1. Filter seen posts
  const beforeSeen = posts.length;
  const unseenPosts = filterSeenPosts(posts, seenPosts);
  const seenFiltered = beforeSeen - unseenPosts.length;

  // 2. Apply freshness bias
  const biasedPosts = applyFreshnessBias(unseenPosts, now);
  const freshnessBoosts = biasedPosts.filter((b) => b.boost > 0).length;

  // 3. Engagement prediction
  const predicted = predictEngagement(
    biasedPosts.map((b) => {
      const post = b.post;
      const baseScore = (post.score?.total ?? 0) + b.boost;
      return {
        ...post,
        score: post.score ? { ...post.score, total: baseScore } : undefined,
      };
    }),
    opts.preferredNiches,
    opts.preferredContentTypes,
    opts.engagedCreators,
    now,
  );

  // Sort: freshness-boosted score + predicted engagement
  predicted.sort((a, b) => {
    const scoreA = (a.post.score?.total ?? 0) + a.predictedScore;
    const scoreB = (b.post.score?.total ?? 0) + b.predictedScore;
    return scoreB - scoreA;
  });

  const sortedPosts = predicted.map((p) => p.post);
  const predictedEngagementAvg =
    predicted.length > 0
      ? predicted.reduce((sum, p) => sum + p.predictedScore, 0) / predicted.length
      : 0;

  // 4. Explore/exploit split
  const { exploit, explore } = splitExploreExploit(
    sortedPosts,
    opts.followed,
    opts.preferredNiches,
  );

  // Limit exploit to ~80% and explore to ~20%
  const exploitTarget = Math.min(Math.max(1, Math.floor(adjustedLimit * 0.8)), exploit.length);
  const exploreTarget = Math.min(Math.max(0, Math.floor(adjustedLimit * 0.2)), explore.length);

  const exploitLimited = exploit.slice(0, exploitTarget);
  const exploreLimited = explore.slice(0, exploreTarget);

  // 5. Interleave: every 5th post is explore
  const interleaved = interleaveExplore(exploitLimited, exploreLimited, 5);

  // 6. Enforce content variety
  const varied = enforceVariety(interleaved, { maxPerCreator: 2, maxPerTopic: 3 });

  // 7. Rotate content types for visual variety
  const rotated = rotateContentTypes(varied);

  const finalPosts = rotated.slice(0, adjustedLimit);

  return {
    posts: finalPosts,
    meta: {
      total: finalPosts.length,
      seenFiltered,
      freshnessBoosts,
      exploreCount: exploreLimited.length,
      exploitCount: exploitLimited.length,
      predictedEngagementAvg: Math.round(predictedEngagementAvg * 100) / 100,
      adjustedLimit,
    },
  };
}
