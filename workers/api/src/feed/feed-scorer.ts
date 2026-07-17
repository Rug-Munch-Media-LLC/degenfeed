/**
 * feed-scorer — Ranking v2 scoring, velocity tracking, and trending.
 *
 * Owns algorithm-preference parsing/merging, ranking context
 * construction, engagement velocity snapshots (KV-backed), score
 * breakdown computation, sort modes (scored/hot/new/top), diversity
 * ranking, cursor pagination, and trending topic aggregation.
 */

import {
  computeTrendingTopics,
  type RankingContext,
  rankDiverse,
  type ScoreBreakdown,
  scoreBreakdownV2,
  type TrendingTopic,
  type UserAlgorithmPreferences,
} from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { Env } from '../index';
import type { StoredUserPreferences } from './feed-cache';

// ─── Preference parsing & merging ──────────────────────────────────

export function parsePrefsFromQuery(params: URLSearchParams): UserAlgorithmPreferences | null {
  const niches = params.get('niches');
  const platforms = params.get('platforms');
  const recencyWeight = Number(params.get('recencyWeight'));
  const engagementWeight = Number(params.get('engagementWeight'));
  const diversityBoost = params.get('diversityBoost');
  if (!niches && !platforms && !recencyWeight && !engagementWeight) return null;
  return {
    preferredNiches: niches ? niches.split(',').filter(Boolean) : [],
    preferredPlatforms: platforms ? (platforms.split(',').filter(Boolean) as Protocol[]) : [],
    recencyWeight: recencyWeight || 1,
    engagementWeight: engagementWeight || 1,
    diversityBoost: diversityBoost !== 'false',
  };
}

/** Anonymous cookie preferences: personalized feed without sign-in. */
export function parseCookiePrefs(cookieHeader: string): UserAlgorithmPreferences | null {
  const cookieMatch = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('df_prefs='));
  if (!cookieMatch) return null;
  try {
    return JSON.parse(
      decodeURIComponent(cookieMatch.slice('df_prefs='.length)),
    ) as UserAlgorithmPreferences;
  } catch (err) {
    console.warn('[feed] cookie prefs parse failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** New posts since last visit: reads the df_last_visit cookie, counts newer posts. */
export function countNewSinceLastVisit(cookieHeader: string, posts: UnifiedPost[]): number {
  const lastVisitCookie = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('df_last_visit='));
  if (!lastVisitCookie) return 0;
  const lastVisit = Number(lastVisitCookie.slice('df_last_visit='.length));
  if (!(lastVisit > 0)) return 0;
  return posts.filter((p) => p.createdAt > lastVisit).length;
}

/**
 * Merges per-user stored niches/platforms and anonymous cookie
 * preferences into the query-param preferences. Query params win,
 * then authenticated preferences, then cookie preferences.
 */
export function mergePreferences(
  queryPrefs: UserAlgorithmPreferences | null,
  storedPrefs: StoredUserPreferences | null,
  cookiePrefs: UserAlgorithmPreferences | null,
): UserAlgorithmPreferences {
  const mergedPrefs: UserAlgorithmPreferences = queryPrefs ?? {
    preferredNiches: [],
    preferredPlatforms: [],
    recencyWeight: 1,
    engagementWeight: 1,
    diversityBoost: true,
  };
  if (storedPrefs) {
    for (const n of storedPrefs.preferredNiches) {
      if (!mergedPrefs.preferredNiches.includes(n)) {
        mergedPrefs.preferredNiches = [...mergedPrefs.preferredNiches, n];
      }
    }
    for (const p of storedPrefs.preferredPlatforms) {
      if (!mergedPrefs.preferredPlatforms.includes(p)) {
        mergedPrefs.preferredPlatforms = [...mergedPrefs.preferredPlatforms, p];
      }
    }
    if (storedPrefs.recencyWeight) mergedPrefs.recencyWeight = storedPrefs.recencyWeight;
    if (storedPrefs.engagementWeight) mergedPrefs.engagementWeight = storedPrefs.engagementWeight;
    if (storedPrefs.diversityBoost === false) mergedPrefs.diversityBoost = false;
  }
  // Anonymous cookie preferences (lowest priority — overridden by query params and auth'd prefs)
  if (cookiePrefs) {
    for (const n of cookiePrefs.preferredNiches) {
      if (!mergedPrefs.preferredNiches.includes(n)) mergedPrefs.preferredNiches.push(n);
    }
    for (const p of cookiePrefs.preferredPlatforms) {
      if (!mergedPrefs.preferredPlatforms.includes(p)) mergedPrefs.preferredPlatforms.push(p);
    }
    if (cookiePrefs.recencyWeight) mergedPrefs.recencyWeight = cookiePrefs.recencyWeight;
    if (cookiePrefs.engagementWeight) mergedPrefs.engagementWeight = cookiePrefs.engagementWeight;
  }
  return mergedPrefs;
}

// ─── Ranking context ───────────────────────────────────────────────

export function buildRankingContext(
  now: number,
  prefs?: UserAlgorithmPreferences | null,
  recentAuthors?: Map<string, number>,
  followed?: Set<string>,
  sourceQuality?: Map<string, number>,
): RankingContext {
  return {
    viewer: null,
    recentAuthors: recentAuthors ?? new Map(),
    sourceQuality: sourceQuality ?? new Map(),
    viewerNiches: new Set(prefs?.preferredNiches ?? []),
    followed: followed ?? new Set(prefs?.followed ?? []),
    now,
    preferences: prefs ?? null,
  };
}

/**
 * Populates recentAuthors for the diversity bonus: counts how many
 * times each author appears (repeat authors get penalized so one
 * noisy account doesn't dominate the feed) and derives a follower
 * based source quality signal.
 */
export function buildAuthorSignals(posts: UnifiedPost[]): {
  recentAuthors: Map<string, number>;
  sourceQuality: Map<string, number>;
} {
  const recentAuthors = new Map<string, number>();
  const sourceQuality = new Map<string, number>();
  for (const p of posts) {
    const key = p.author.id;
    recentAuthors.set(key, (recentAuthors.get(key) ?? 0) + 1);
    if (p.author.followerCount > 0) {
      sourceQuality.set(key, Math.min(1.5, p.author.followerCount / 10000));
    }
  }
  return { recentAuthors, sourceQuality };
}

// ─── Engagement velocity tracking ──────────────────────────────────

export type EngagementSnapshot = { likes: number; reposts: number; replies: number; at: number };

/**
 * Loads previous engagement snapshots from KV for velocity tracking.
 * Each key is eng:<postId> with TTL 300s, storing {likes, reposts, replies, at}.
 */
export async function loadPreviousEngagement(
  env: Env,
  posts: UnifiedPost[],
): Promise<Map<string, EngagementSnapshot>> {
  const previousEngagement = new Map<string, EngagementSnapshot>();
  if (!env.CACHE) return previousEngagement;
  try {
    const keys = posts.slice(0, 200).map((p) => `eng:${p.id}`);
    const results = await Promise.allSettled(keys.map((k) => env.CACHE?.get(k)));
    for (let i = 0; i < results.length; i++) {
      const r = results[i] as PromiseFulfilledResult<string | null> | PromiseRejectedResult;
      const postId = posts[i]?.id;
      if (r.status === 'fulfilled' && r.value && postId) {
        try {
          const snap = JSON.parse(r.value) as EngagementSnapshot;
          previousEngagement.set(postId, snap);
        } catch (err) {
          // Non-critical — log and continue
          console.warn(
            '[feed] previousEngagement parse failed:',
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  } catch (err) {
    console.warn(
      '[feed] previousEngagement KV fetch failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return previousEngagement;
}

/**
 * Stores current engagement snapshots for the next velocity
 * calculation. Fire-and-forget — non-critical.
 */
export async function storeEngagementSnapshots(env: Env, posts: UnifiedPost[]): Promise<void> {
  if (!env.CACHE) return;
  const now = Date.now();
  const puts = posts.slice(0, 100).map((p) =>
    env.CACHE?.put(
      `eng:${p.id}`,
      JSON.stringify({
        likes: p.metrics.likes,
        reposts: p.metrics.reposts,
        replies: p.metrics.replies,
        at: now,
      }),
      { expirationTtl: 300 },
    ).catch(() => {}),
  );
  await Promise.allSettled(puts);
}

// ─── Scoring, sorting, ranking ─────────────────────────────────────

export interface PostScore {
  total: number;
  recency: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  source: number;
  velocity: number;
  reasons: string[];
}

export type RankedPost = UnifiedPost & {
  score?: PostScore;
  isNew?: boolean;
  isHot?: boolean;
  isTrending?: boolean;
};

export interface ScoredPost {
  post: UnifiedPost;
  breakdown: ScoreBreakdown;
}

export interface ScoreAndRankOptions {
  prefs: UserAlgorithmPreferences;
  followed: Set<string>;
  /** scored | hot | new | top */
  sort: string;
  diverse: boolean;
  limit: number;
  /** Cursor-based pagination: createdAt boundary, 0 disables. */
  cursor: number;
  direction: 'asc' | 'desc';
  hideLowQuality: boolean;
  hideLowQualityThreshold: number;
}

export interface ScoreAndRankResult {
  ranked: RankedPost[];
  topOfHour: string | null;
  nextCursor: number | null;
}

/**
 * Computes score breakdowns (with velocity from KV snapshots),
 * applies cursor pagination and the low-quality filter, sorts by the
 * requested mode ('scored' uses the diversity ranker; 'hot'/'top'/
 * 'new' are simple sorts that bypass it), and attaches score
 * transparency fields to each returned post.
 */
export async function scoreAndRank(
  env: Env,
  posts: UnifiedPost[],
  opts: ScoreAndRankOptions,
): Promise<ScoreAndRankResult> {
  const { recentAuthors, sourceQuality } = buildAuthorSignals(posts);
  const previousEngagement = await loadPreviousEngagement(env, posts);

  const ctx = buildRankingContext(
    Date.now(),
    opts.prefs,
    recentAuthors,
    opts.followed,
    sourceQuality,
  );
  // Inject previous engagement for velocity scoring.
  ctx.previousEngagement = previousEngagement;

  // Compute score breakdowns for transparency / hover signals.
  const scoredRelevant: ScoredPost[] = posts.map((p) => ({
    post: p,
    breakdown: scoreBreakdownV2(p, ctx),
  }));

  // Store current engagement snapshots for next velocity calculation.
  void storeEngagementSnapshots(env, posts);

  // Cursor-based pagination: filter posts by createdAt relative to cursor.
  let cursorScored = scoredRelevant;
  if (opts.cursor > 0) {
    cursorScored =
      opts.direction === 'asc'
        ? scoredRelevant.filter((s) => s.post.createdAt > opts.cursor)
        : scoredRelevant.filter((s) => s.post.createdAt < opts.cursor);
  }

  const filteredScored = opts.hideLowQuality
    ? cursorScored.filter((s) => s.breakdown.total >= opts.hideLowQualityThreshold)
    : cursorScored;

  const rankedPosts = (() => {
    if (opts.sort === 'new') {
      return [...filteredScored]
        .sort((a, b) => b.post.createdAt - a.post.createdAt)
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'top') {
      return [...filteredScored]
        .sort((a, b) => b.breakdown.engagement - a.breakdown.engagement)
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'hot') {
      return [...filteredScored]
        .sort((a, b) => b.breakdown.total - a.breakdown.total)
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    // Default 'scored': use diversity ranker
    return (
      opts.diverse
        ? rankDiverse(
            filteredScored.map((s) => s.post),
            ctx,
            {
              maxPerAuthor: 2,
              perProtocolMin: { farcaster: 2, lens: 2, bluesky: 2, nostr: 2, lemmy: 2 },
            },
          )
        : filteredScored.map((s) => s.post)
    ).slice(0, Math.min(opts.limit, 100));
  })();

  // Attach score breakdowns by id lookup
  const scoreById = new Map(filteredScored.map((s) => [s.post.id, s.breakdown]));
  const ranked: RankedPost[] = rankedPosts.map((p) => {
    const breakdown = scoreById.get(p.id);
    if (!breakdown) return p;
    const now = Date.now();
    const ageMin = (now - p.createdAt) / 60000;
    return {
      ...p,
      score: {
        total: breakdown.total,
        recency: breakdown.recency,
        engagement: breakdown.engagement,
        relevance: breakdown.relevance,
        quality: breakdown.quality,
        diversity: breakdown.diversity,
        source: breakdown.source,
        velocity: breakdown.velocity,
        reasons: breakdown.reasons,
      },
      isNew: ageMin < 15,
      isHot: breakdown.velocity > 2.0,
      isTrending: breakdown.engagement > 3,
    };
  });

  // Top-of-hour: highest-scoring post from the last 60 minutes.
  const now = Date.now();
  const recentPosts = filteredScored.filter((s) => now - s.post.createdAt < 3600000);
  const topOfHour =
    recentPosts.length > 0
      ? recentPosts.reduce((best, cur) => (cur.breakdown.total > best.breakdown.total ? cur : best))
          .post.id
      : null;

  const nextCursor = ranked.length > 0 ? (ranked[ranked.length - 1]?.createdAt ?? null) : null;

  return { ranked, topOfHour, nextCursor };
}

// ─── Trending topics ───────────────────────────────────────────────

/**
 * Computes trending topics from the post window and merges trending
 * hashtags from our Mastodon instance. Non-critical — Mastodon
 * failures are logged and swallowed.
 */
export async function computeTrending(
  posts: UnifiedPost[],
  windowHours: number,
): Promise<TrendingTopic[]> {
  const trending = computeTrendingTopics(posts, Date.now(), 12, windowHours * 3600000);
  try {
    const mastoTrends = await fetch('https://social.degenfeed.xyz/api/v1/trends/tags?limit=8', {
      headers: { 'user-agent': 'DegenFeed/0.1' },
    });
    if (mastoTrends.ok) {
      const tags = (await mastoTrends.json()) as Array<{
        name: string;
        history: Array<{ accounts: string }>;
      }>;
      for (const tag of tags) {
        const existing = trending.find((t) => t.topic === tag.name);
        if (existing) existing.score += tag.history?.length || 0;
        else trending.push({ topic: tag.name, count: tag.history?.length || 1, score: 3 });
      }
    }
  } catch (err) {
    console.warn(
      '[feed] Mastodon trending tags fetch failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return trending;
}
