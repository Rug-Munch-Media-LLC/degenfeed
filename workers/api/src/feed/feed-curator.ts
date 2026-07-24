/**
 * feed-curator — Addictive feed algorithm components.
 *
 * Seen tracking, freshness bias, dynamic explore/exploit, engagement prediction,
 * scroll depth tracking, content variety enforcement, behavior profiles,
 * session engagement tracking, content hooks, temporal patterns,
 * dopamine loops, and velocity boosting.
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
    await env.CACHE.put(key, JSON.stringify(capped), {
      expirationTtl: SEEN_TTL,
    });
  } catch {
    /* non-critical */
  }
}

export function filterSeenPosts(posts: UnifiedPost[], seen: Set<string>): UnifiedPost[] {
  if (seen.size === 0) return posts;
  return posts.filter((p) => !seen.has(p.id));
}

// ─── 2. BEHAVIOR PROFILE ─────────────────────────────────────────────
// Tracks user engagement patterns across sessions for personalization.

const BEHAVIOR_KEY_PREFIX = 'user:behavior:';
const BEHAVIOR_TTL = 60 * 60 * 24 * 30;
const SCROLL_SPEED_WINDOW = 20;

export interface BehaviorProfile {
  scrollTimestamps: number[];
  lingerPosts: Record<string, number>;
  scrollSpeeds: number[];
  preferredContentTypesInferred: Record<string, number>;
  preferredNichesInferred: Record<string, number>;
  streak: { count: number; lastVisitDate: string };
  sessionStartedAt: number;
  postsShown: number;
  flowState: boolean;
  tippedCreators: string[];
  memberCommunities: string[];
}

export function emptyBehaviorProfile(): BehaviorProfile {
  return {
    scrollTimestamps: [],
    lingerPosts: {},
    scrollSpeeds: [],
    preferredContentTypesInferred: {},
    preferredNichesInferred: {},
    streak: { count: 0, lastVisitDate: '' },
    sessionStartedAt: Date.now(),
    postsShown: 0,
    flowState: false,
    tippedCreators: [],
    memberCommunities: [],
  };
}

export async function loadBehaviorProfile(env: Env, wallet: string): Promise<BehaviorProfile> {
  if (!env.CACHE || !wallet) return emptyBehaviorProfile();
  try {
    const raw = await env.CACHE.get(`${BEHAVIOR_KEY_PREFIX}${wallet.toLowerCase()}`);
    if (!raw) return emptyBehaviorProfile();
    const stored = JSON.parse(raw) as BehaviorProfile;
    stored.sessionStartedAt = Date.now();
    stored.postsShown = 0;
    stored.flowState = false;
    stored.scrollTimestamps = [];
    return stored;
  } catch {
    return emptyBehaviorProfile();
  }
}

export async function storeBehaviorProfile(
  env: Env,
  wallet: string,
  profile: BehaviorProfile,
): Promise<void> {
  if (!env.CACHE || !wallet) return;
  try {
    const key = `${BEHAVIOR_KEY_PREFIX}${wallet.toLowerCase()}`;
    const toStore = {
      ...profile,
      scrollTimestamps: [],
      scrollSpeeds: profile.scrollSpeeds.slice(-SCROLL_SPEED_WINDOW),
    };
    await env.CACHE.put(key, JSON.stringify(toStore), {
      expirationTtl: BEHAVIOR_TTL,
    });
  } catch {
    /* non-critical */
  }
}

export function updateStreak(profile: BehaviorProfile): BehaviorProfile {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.streak.lastVisitDate === today) return profile;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (profile.streak.lastVisitDate === yesterday) {
    profile.streak.count += 1;
  } else {
    profile.streak.count = 1;
  }
  profile.streak.lastVisitDate = today;
  return profile;
}

export function recordScrollEvent(
  profile: BehaviorProfile,
  _postId: string,
): {
  avgSpeed: number;
  speedTrend: 'accelerating' | 'steady' | 'slowing';
  isBored: boolean;
} {
  const now = Date.now();
  profile.scrollTimestamps.push(now);
  profile.postsShown += 1;

  if (profile.scrollTimestamps.length >= 2) {
    const lastIdx = profile.scrollTimestamps.length - 1;
    const t1 = profile.scrollTimestamps[lastIdx]!;
    const t0 = profile.scrollTimestamps[lastIdx - 1]!;
    const speed = t1 - t0;
    profile.scrollSpeeds.push(speed);
    if (profile.scrollSpeeds.length > SCROLL_SPEED_WINDOW) {
      profile.scrollSpeeds.shift();
    }
  }

  profile.flowState =
    profile.scrollSpeeds.length >= 5 && profile.scrollSpeeds.slice(-5).every((s) => s < 3000);

  const speeds = profile.scrollSpeeds;
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  let speedTrend: 'accelerating' | 'steady' | 'slowing' = 'steady';
  let isBored = false;

  if (speeds.length >= 8) {
    const recent = speeds.slice(-4).reduce((a, b) => a + b, 0) / 4;
    const older = speeds.slice(-8, -4).reduce((a, b) => a + b, 0) / 4;
    if (recent > older * 1.3) {
      speedTrend = 'slowing';
      isBored = true;
    } else if (recent < older * 0.7) {
      speedTrend = 'accelerating';
    }
  }

  return { avgSpeed, speedTrend, isBored };
}

export function recordLinger(profile: BehaviorProfile, postId: string, ms: number): void {
  profile.lingerPosts[postId] = (profile.lingerPosts[postId] ?? 0) + ms;
}

export function inferPreferences(profile: BehaviorProfile, posts: UnifiedPost[]): void {
  const lingeredIds = new Set(
    Object.keys(profile.lingerPosts).filter((k) => (profile.lingerPosts[k] ?? 0) > 2000),
  );
  for (const post of posts) {
    if (!lingeredIds.has(post.id)) continue;
    const type = post.contentType ?? 'text';
    profile.preferredContentTypesInferred[type] =
      (profile.preferredContentTypesInferred[type] ?? 0) + 1;
    for (const niche of post.niches) {
      const lower = niche.toLowerCase();
      profile.preferredNichesInferred[lower] = (profile.preferredNichesInferred[lower] ?? 0) + 1;
    }
  }
}

// ─── 3. FRESHNESS BIAS ───────────────────────────────────────────────

export interface FreshnessBoost {
  post: UnifiedPost;
  boost: number;
  multiplier: number;
}

export function applyFreshnessBias(posts: UnifiedPost[], now: number): FreshnessBoost[] {
  return posts.map((post) => {
    const ageMs = now - post.createdAt;
    const ageHours = ageMs / 3600000;
    let boost = 0;
    let multiplier = 1.0;

    if (ageHours < 1) {
      boost = 2;
      multiplier = 2.0;
    } else if (ageHours < 6) {
      boost = 1;
      multiplier = 1.5;
    } else if (ageHours < 24) {
      boost = 0.5;
      multiplier = 1.0;
    } else if (ageHours > 72) {
      boost = -1;
      multiplier = 0.8;
    }

    return { post, boost, multiplier };
  });
}

// ─── 4. EXPLORE vs EXPLOIT (DYNAMIC) ─────────────────────────────────

export interface ExploreExploitSplit {
  exploit: UnifiedPost[];
  explore: UnifiedPost[];
}

export interface ExploreExploitRatio {
  exploitPct: number;
  explorePct: number;
  exploreInterval: number;
}

/**
 * Dynamic explore/exploit ratio based on session duration.
 * Early session: exploit heavily (learn preferences).
 * Mid session: introduce variety (prevent boredom).
 * Late session: keep discovering (maximize novelty).
 * Flow state (>30min): go back to exploit (they're hooked).
 */
export function getDynamicExploreExploitRatio(sessionDurationMs: number): ExploreExploitRatio {
  if (sessionDurationMs < 5 * 60_000) {
    return { exploitPct: 0.9, explorePct: 0.1, exploreInterval: 10 };
  }
  if (sessionDurationMs < 15 * 60_000) {
    return { exploitPct: 0.7, explorePct: 0.3, exploreInterval: 3 };
  }
  if (sessionDurationMs < 30 * 60_000) {
    return { exploitPct: 0.6, explorePct: 0.4, exploreInterval: 2 };
  }
  return { exploitPct: 0.8, explorePct: 0.2, exploreInterval: 5 };
}

/**
 * Splits posts into exploit and explore pools.
 * Exploit = content from followed/interested sources matching user's niches.
 * Explore = high-engagement content from different topics/creators.
 */
export function splitExploreExploit(
  posts: UnifiedPost[],
  followed: Set<string>,
  preferredNiches: Set<string>,
  inferredNiches?: Record<string, number>,
): ExploreExploitSplit {
  const exploit: UnifiedPost[] = [];
  const explore: UnifiedPost[] = [];
  const inferredNicheSet = new Set(Object.keys(inferredNiches ?? {}));

  for (const post of posts) {
    const isFollowed = followed.has(post.author.id);
    const nicheMatch = post.niches.some(
      (n) => preferredNiches.has(n.toLowerCase()) || inferredNicheSet.has(n.toLowerCase()),
    );
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
 * Interleaves explore posts every Nth position.
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

// ─── 5. ENGAGEMENT PREDICTION ───────────────────────────────────────

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

// ─── 6. SCROLL DEPTH TRACKING ───────────────────────────────────────

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

// ─── 7. CONTENT VARIETY ENFORCEMENT ──────────────────────────────────

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

// ─── 8. TEMPORAL ENGAGEMENT PATTERNS ────────────────────────────────

export type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface TemporalWeights {
  slot: TimeSlot;
  preferredNiches: string[];
  preferredContentTypes: string[];
  velocityMultiplier: number;
}

export function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

const TEMPORAL_PATTERNS: Record<TimeSlot, TemporalWeights> = {
  morning: {
    slot: 'morning',
    preferredNiches: ['news', 'market', 'macro', 'trading', 'analysis', 'crypto'],
    preferredContentTypes: ['text', 'link', 'thread'],
    velocityMultiplier: 1.2,
  },
  midday: {
    slot: 'midday',
    preferredNiches: ['analysis', 'defi', 'technical', 'development', 'research', 'tutorial'],
    preferredContentTypes: ['text', 'thread', 'video'],
    velocityMultiplier: 1.0,
  },
  afternoon: {
    slot: 'afternoon',
    preferredNiches: ['social', 'meme', 'community', 'nft', 'gaming', 'culture'],
    preferredContentTypes: ['image', 'text', 'video'],
    velocityMultiplier: 1.1,
  },
  evening: {
    slot: 'evening',
    preferredNiches: ['entertainment', 'video', 'spaces', 'podcast', 'live', 'music'],
    preferredContentTypes: ['video', 'image', 'link'],
    velocityMultiplier: 1.3,
  },
  night: {
    slot: 'night',
    preferredNiches: ['digest', 'summary', 'recap', 'longform', 'deep-dive'],
    preferredContentTypes: ['text', 'thread'],
    velocityMultiplier: 0.6,
  },
};

export function getTemporalPatterns(now: number = Date.now()): TemporalWeights {
  const hour = new Date(now).getHours();
  return TEMPORAL_PATTERNS[getTimeSlot(hour)];
}

export function applyTemporalBoost(
  post: UnifiedPost,
  temporal: TemporalWeights,
  baseScore: number,
): number {
  let score = baseScore;
  const niches = post.niches.map((n) => n.toLowerCase());
  for (const niche of temporal.preferredNiches) {
    if (niches.includes(niche)) {
      score += 1.5;
      break;
    }
  }
  const type = post.contentType ?? 'text';
  if (temporal.preferredContentTypes.includes(type)) {
    score += 0.5;
  }
  return score * temporal.velocityMultiplier;
}

// ─── 9. CONTENT HOOK OPTIMIZATION ────────────────────────────────────

const HOOK_POSTS_COUNT = 3;
const SURPRISE_INTERVAL = 7;

/**
 * Ensures the first N posts in a feed are high-engagement hooks
 * with no experimentation. Sorts by total engagement + predicted score.
 */
export function ensureHookPosts(posts: UnifiedPost[]): UnifiedPost[] {
  if (posts.length <= HOOK_POSTS_COUNT) return posts;
  const hookCandidates = [...posts].sort((a, b) => {
    const engA =
      (a.metrics.likes ?? 0) +
      (a.metrics.reposts ?? 0) +
      (a.metrics.replies ?? 0) +
      (a.score?.total ?? 0);
    const engB =
      (b.metrics.likes ?? 0) +
      (b.metrics.reposts ?? 0) +
      (b.metrics.replies ?? 0) +
      (b.score?.total ?? 0);
    return engB - engA;
  });
  const hooks = hookCandidates.slice(0, HOOK_POSTS_COUNT);
  const hookIds = new Set(hooks.map((h) => h.id));
  const rest = posts.filter((p) => !hookIds.has(p.id));
  return [...hooks, ...rest];
}

/**
 * Injects a "surprise" post from a completely different topic every Nth position.
 */
export function injectSurpriseContent(
  posts: UnifiedPost[],
  allAvailablePosts: UnifiedPost[],
): UnifiedPost[] {
  const result: UnifiedPost[] = [];
  const seenNiches = new Set<string>();
  const availablePool = allAvailablePosts.filter((p) => !posts.some((fp) => fp.id === p.id));

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    if (post) {
      result.push(post);
      for (const niche of post.niches) seenNiches.add(niche.toLowerCase());
    }

    if ((i + 1) % SURPRISE_INTERVAL === 0 && availablePool.length > 0) {
      const surprise = availablePool.find(
        (p) => !p.niches.some((n) => seenNiches.has(n.toLowerCase())),
      );
      if (surprise) {
        result.push(surprise);
        const idx = availablePool.indexOf(surprise);
        availablePool.splice(idx, 1);
      }
    }
  }

  return result;
}

/**
 * Staggered content type rotation: alternates text/image/video, then link/thread.
 * More aggressive than the basic rotation for visual interest.
 */
export function alternateContentTypes(posts: UnifiedPost[]): UnifiedPost[] {
  const VISUAL_TYPES = ['image', 'video'] as const;
  const TEXT_TYPES = ['text', 'thread', 'link'] as const;
  const byVisual = posts.filter((p) =>
    (VISUAL_TYPES as readonly string[]).includes(p.contentType ?? 'text'),
  );
  const byText = posts.filter((p) =>
    (TEXT_TYPES as readonly string[]).includes(p.contentType ?? 'text'),
  );
  const other = posts.filter(
    (p) =>
      !(VISUAL_TYPES as readonly string[]).includes(p.contentType ?? 'text') &&
      !(TEXT_TYPES as readonly string[]).includes(p.contentType ?? 'text'),
  );

  const result: UnifiedPost[] = [];
  let vi = 0,
    ti = 0,
    oi = 0;

  while (vi < byVisual.length || ti < byText.length || oi < other.length) {
    if (ti < byText.length) result.push(byText[ti++]!);
    if (vi < byVisual.length) result.push(byVisual[vi++]!);
    if (ti < byText.length) result.push(byText[ti++]!);
    if (vi < byVisual.length) result.push(byVisual[vi++]!);
    if (oi < other.length) result.push(other[oi++]!);
  }

  return result;
}

// ─── 10. DOPAMINE LOOP SIGNALS ──────────────────────────────────────

export interface DopamineSignals {
  caughtUp: boolean;
  streakCount: number;
  newSinceLastVisit: number;
  postCount: number;
}

const CAUGHT_UP_THRESHOLD = 100;

export function computeDopamineSignals(
  postsShown: number,
  streak: { count: number; lastVisitDate: string },
  lastVisitTimestamp: number,
  newestPostTimestamp: number,
): DopamineSignals {
  return {
    caughtUp: postsShown >= CAUGHT_UP_THRESHOLD,
    streakCount: streak.count,
    newSinceLastVisit:
      lastVisitTimestamp > 0
        ? Math.max(0, newestPostTimestamp > lastVisitTimestamp ? 1 : 0) // simplified; caller provides count
        : 0,
    postCount: postsShown,
  };
}

// ─── 11. CONTENT VELOCITY BOOSTING ──────────────────────────────────

export interface VelocityBoostInput {
  post: UnifiedPost;
  rapidEngagement: boolean;
  tippedCreator: boolean;
  memberCommunity: boolean;
}

export function applyVelocityBoost(input: VelocityBoostInput, baseScore: number): number {
  let multiplier = 1.0;
  const factors: string[] = [];
  if (input.rapidEngagement) {
    multiplier *= 2.0;
    factors.push('rapid-engagement-2x');
  }
  if (input.tippedCreator) {
    multiplier *= 1.5;
    factors.push('tipped-creator-1.5x');
  }
  if (input.memberCommunity) {
    multiplier *= 1.3;
    factors.push('member-community-1.3x');
  }
  return baseScore * multiplier;
}

export function computeRapidEngagement(
  post: UnifiedPost,
  previousEngagement: Map<string, { likes: number; reposts: number; replies: number; at: number }>,
): boolean {
  const prev = previousEngagement.get(post.id);
  if (!prev) return false;
  const elapsedMs = Date.now() - prev.at;
  if (elapsedMs > 15 * 60_000 || elapsedMs < 10_000) return false;
  const prevTotal = prev.likes + prev.reposts + prev.replies;
  const currTotal = post.metrics.likes + post.metrics.reposts + post.metrics.replies;
  const delta = currTotal - prevTotal;
  const rate = delta / (elapsedMs / 60_000);
  return rate > 2.0;
}

// ─── 12. CURATED FEED ORCHESTRATOR (ADDICTIVE EDITION) ──────────────

export interface CuratedFeedOptions {
  wallet?: string;
  limit: number;
  followed: Set<string>;
  preferredNiches: Set<string>;
  preferredContentTypes: Set<string>;
  engagedCreators: Set<string>;
  scrollProfile?: ScrollProfile;
  behaviorProfile?: BehaviorProfile;
  lastVisitTimestamp?: number;
  tippedCreators?: Set<string>;
  memberCommunities?: Set<string>;
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
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
    dopamine?: DopamineSignals;
    temporal?: TimeSlot;
    exploreRatio?: ExploreExploitRatio;
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

  // 3. Temporal patterns
  const temporal = getTemporalPatterns(now);

  // 4. Engagement prediction with temporal + velocity boosts + freshness multiplier
  const inferredNiches = opts.behaviorProfile?.preferredNichesInferred ?? {};
  const _biasedMap = new Map(biasedPosts.map((b) => [b.post.id, b]));
  const predicted = predictEngagement(
    biasedPosts.map((b) => {
      const post = b.post;
      let baseScore = ((post.score?.total ?? 0) + b.boost) * b.multiplier;
      baseScore = applyTemporalBoost(post, temporal, baseScore);
      const rapidEngagement = opts.previousEngagement
        ? computeRapidEngagement(post, opts.previousEngagement)
        : false;
      baseScore = applyVelocityBoost(
        {
          post,
          rapidEngagement,
          tippedCreator: opts.tippedCreators?.has(post.author.id) ?? false,
          memberCommunity: opts.memberCommunities?.has(post.id) ?? false,
        },
        baseScore,
      );
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

  // 5. Dynamic explore/exploit ratio
  const sessionDuration = opts.behaviorProfile ? now - opts.behaviorProfile.sessionStartedAt : 0;
  const ratio = getDynamicExploreExploitRatio(sessionDuration);

  const { exploit, explore } = splitExploreExploit(
    sortedPosts,
    opts.followed,
    opts.preferredNiches,
    inferredNiches,
  );

  const exploitTarget = Math.min(
    Math.max(1, Math.floor(adjustedLimit * ratio.exploitPct)),
    exploit.length,
  );
  const exploreTarget = Math.min(
    Math.max(0, Math.floor(adjustedLimit * ratio.explorePct)),
    explore.length,
  );

  const exploitLimited = exploit.slice(0, exploitTarget);
  const exploreLimited = explore.slice(0, exploreTarget);

  // 6. Interleave with dynamic interval
  const interleaved = interleaveExplore(exploitLimited, exploreLimited, ratio.exploreInterval);

  // 7. Content hooks: first 3 posts must be high-engagement
  const hooked = ensureHookPosts(interleaved);

  // 8. Inject surprise content every 7th post
  const surprised = injectSurpriseContent(hooked, sortedPosts);

  // 9. Enforce content variety
  const varied = enforceVariety(surprised, {
    maxPerCreator: 2,
    maxPerTopic: 3,
  });

  // 10. Alternate content types (text/image/video rhythm)
  const alternated = alternateContentTypes(varied);

  // 11. Apply visual rotation as final safety layer
  const rotated = rotateContentTypes(alternated);

  const finalPosts = rotated.slice(0, adjustedLimit);

  // 12. Dopamine signals
  const postsShown = opts.behaviorProfile?.postsShown ?? 0;
  const streak = opts.behaviorProfile?.streak ?? {
    count: 0,
    lastVisitDate: '',
  };
  const dopamine = computeDopamineSignals(
    postsShown,
    streak,
    opts.lastVisitTimestamp ?? 0,
    finalPosts.length > 0 ? (finalPosts[0]?.createdAt ?? 0) : 0,
  );

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
      dopamine,
      temporal: temporal.slot,
      exploreRatio: ratio,
    },
  };
}
