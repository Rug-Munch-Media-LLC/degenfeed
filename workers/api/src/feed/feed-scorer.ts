/**
 * feed-scorer — Ranking v2 scoring, velocity tracking, and trending.
 *
 * Owns algorithm-preference parsing/merging, ranking context
 * construction, engagement velocity snapshots (KV-backed), score
 * breakdown computation, sort modes (scored/hot/new/top), diversity
 * ranking, cursor pagination, and trending topic aggregation.
 */

import {
  applyQualityFilters,
  buildQualityAuthorProfile,
  computeProtocolQuality,
  computeQualityScore,
  type PresetName,
  type ProtocolQualityResult,
  type ResolvedPreset,
} from '@degenfeed/feed-core';
import {
  checkDiversity,
  computeTrendingTopics,
  freshnessBoost,
  interleaveByProtocol,
  type RankingContext,
  rankDiverse,
  type ScoreBreakdown,
  scoreBreakdownV2,
  type TrendingTopic,
  type UserAlgorithmPreferences,
} from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, log } from '../index';
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
    log('warn', '[feed] cookie prefs parse failed', err instanceof Error ? err.message : err);
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
  // Anonymous cookie preferences (lowest priority — fill gaps, never override scalars)
  if (cookiePrefs) {
    for (const n of cookiePrefs.preferredNiches) {
      if (!mergedPrefs.preferredNiches.includes(n)) {
        mergedPrefs.preferredNiches = [...mergedPrefs.preferredNiches, n];
      }
    }
    for (const p of cookiePrefs.preferredPlatforms) {
      if (!mergedPrefs.preferredPlatforms.includes(p)) {
        mergedPrefs.preferredPlatforms = [...mergedPrefs.preferredPlatforms, p];
      }
    }
  }
  // Stored prefs (highest priority — override cookie + query gaps)
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
          log(
            'warn',
            '[feed] previousEngagement parse failed',
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  } catch (err) {
    log(
      'warn',
      '[feed] previousEngagement KV fetch failed',
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
  reputation: number;
  diversity: number;
  source: number;
  velocity: number;
  spam: number;
  /** Quality score 0-100 from the composite quality scoring system */
  qualityScore: number;
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
  /** scored | hot | new | top | quality | trending */
  sort: string;
  diverse: boolean;
  limit: number;
  /** Cursor-based pagination: createdAt boundary, 0 disables. */
  cursor: number;
  direction: 'asc' | 'desc';
  hideLowQuality: boolean;
  hideLowQualityThreshold: number;
  // ── New quality filter options ─────────────────────────────────
  /** Show only original content (filter out reposts and link-only). */
  showOriginalContent: boolean;
  /** Minimum total engagement (likes+reposts+replies+quotes) to show. */
  minEngagement: number;
  /** Max posts per niche per page. */
  maxPerNiche: number;
  /** Whether to interleave protocols. */
  interleaveProtocols: boolean;
  // ── Protocol quality preset options ────────────────────────────
  /** Active preset name for the current protocol/feed. */
  presetName?: PresetName;
  /** Resolved preset ready to apply. */
  resolvedPreset?: ResolvedPreset;
}

export interface ScoreAndRankResult {
  ranked: RankedPost[];
  topOfHour: string | null;
  nextCursor: number | null;
  /** Quality signals for X-DegenFeed-Debug header. */
  debug: {
    avgSpam: number;
    avgQuality: number;
    avgReputation: number;
    avgVelocity: number;
    /** Composite quality score (0-100) average across the batch */
    avgQualityScore: number;
  };
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

  // ── Protocol quality preset filter ─────────────────────────────
  let presetFiltered = cursorScored;
  if (opts.resolvedPreset) {
    presetFiltered = cursorScored.filter((s) => {
      const result = applyQualityFilters(s.post, opts.resolvedPreset!, s.post.protocol);
      return result.passed;
    });
  }

  // ── New quality filters ────────────────────────────────────────
  let qualityFiltered = presetFiltered;

  // Show only original content (no reposts, no link-only)
  if (opts.showOriginalContent) {
    qualityFiltered = qualityFiltered.filter((s) => {
      const text = s.post.text.trim();
      const isRepost = /^RT\b/i.test(text) || /^[@＠]\w+/i.test(text);
      const isLinkOnly =
        s.post.embeds.some((e) => e.kind === 'link') &&
        text.replace(/https?:\/\/\S+/g, '').trim().length < 20;
      return !isRepost && !isLinkOnly;
    });
  }

  // Minimum engagement filter
  if (opts.minEngagement > 0) {
    qualityFiltered = qualityFiltered.filter((s) => {
      const total =
        s.post.metrics.likes +
        s.post.metrics.reposts +
        s.post.metrics.replies +
        (s.post.metrics.quotes ?? 0);
      return total >= opts.minEngagement;
    });
  }

  const filteredScored = opts.hideLowQuality
    ? qualityFiltered.filter((s) => s.breakdown.total >= opts.hideLowQualityThreshold)
    : qualityFiltered;

  // ── Spam integration: filter > 0.9, demote > 0.7 ───────────────
  const spamFiltered = filteredScored.filter((s) => {
    const spam = ((s.post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
    return spam < 0.9;
  });

  // ── Per-protocol quality scores (computed once, attached to all) ─
  const protocolQualityById = new Map<string, ProtocolQualityResult>();
  for (const s of spamFiltered) {
    protocolQualityById.set(s.post.id, computeProtocolQuality(s.post, { followed: opts.followed }));
  }

  const rankedPosts = (() => {
    if (opts.sort === 'new') {
      return [...spamFiltered]
        .sort((a, b) => b.post.createdAt - a.post.createdAt)
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'top') {
      return [...spamFiltered]
        .sort((a, b) => b.breakdown.engagement - a.breakdown.engagement)
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'quality') {
      // Best content per protocol rules: quality ratio first, then
      // overall score, so equally-good posts fall back to ranking v2.
      return [...spamFiltered]
        .sort((a, b) => {
          const aq = protocolQualityById.get(a.post.id)?.ratio ?? 0;
          const bq = protocolQualityById.get(b.post.id)?.ratio ?? 0;
          if (bq !== aq) return bq - aq;
          return b.breakdown.total - a.breakdown.total;
        })
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'trending') {
      // Rising engagement velocity: velocity first, engagement as
      // tiebreak, restricted to the last 24h window.
      const dayAgo = Date.now() - 24 * 3600000;
      const windowed = spamFiltered.filter((s) => s.post.createdAt >= dayAgo);
      const pool = windowed.length >= 5 ? windowed : spamFiltered;
      return [...pool]
        .sort((a, b) => {
          if (b.breakdown.velocity !== a.breakdown.velocity) {
            return b.breakdown.velocity - a.breakdown.velocity;
          }
          return b.breakdown.engagement - a.breakdown.engagement;
        })
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    if (opts.sort === 'hot') {
      return [...spamFiltered]
        .sort((a, b) => {
          const aSpam = ((a.post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
          const bSpam = ((b.post as unknown as Record<string, unknown>).spamScore as number) ?? 0;
          // Demote high-spam to bottom, then sort by score
          if (aSpam > 0.7 !== bSpam > 0.7) return aSpam > 0.7 ? 1 : -1;
          return b.breakdown.total - a.breakdown.total;
        })
        .map((s) => s.post)
        .slice(0, Math.min(opts.limit, 100));
    }
    // Default 'scored': use diversity ranker
    let diversePosts = opts.diverse
      ? rankDiverse(
          spamFiltered.map((s) => s.post),
          ctx,
          {
            maxPerAuthor: opts.maxPerNiche > 0 ? 3 : 2,
            perProtocolMin: { farcaster: 2, lens: 2, bluesky: 2, nostr: 2, lemmy: 2 },
          },
        )
      : spamFiltered.map((s) => s.post);

    // ── Demote high-spam posts to the bottom ─────────────────────
    const highSpam = diversePosts.filter(
      (p) => (((p as unknown as Record<string, unknown>).spamScore as number) ?? 0) > 0.7,
    );
    const cleanPosts = diversePosts.filter(
      (p) => (((p as unknown as Record<string, unknown>).spamScore as number) ?? 0) <= 0.7,
    );
    diversePosts = [...cleanPosts, ...highSpam];

    // Apply niche diversity cap (checkDiversity) and protocol interleaving
    const withNicheDiversity: UnifiedPost[] = [];
    const authorCounts = new Map<string, number>();
    const nicheCounts = new Map<string, number>();
    for (const p of diversePosts) {
      const { allowed } = checkDiversity(p, authorCounts, nicheCounts, {
        maxPerAuthor: 3,
        maxPerNiche: opts.maxPerNiche,
        interleaveProtocols: false,
      });
      if (allowed) {
        checkDiversity(p, authorCounts, nicheCounts, undefined, true);
        withNicheDiversity.push(p);
      }
    }

    // Interleave by protocol to avoid 10 Nostr posts in a row
    const interleaved = opts.interleaveProtocols
      ? interleaveByProtocol(withNicheDiversity)
      : withNicheDiversity;

    return interleaved.slice(0, Math.min(opts.limit, 100));
  })();

  // Attach score breakdowns by id lookup
  const scoreById = new Map(spamFiltered.map((s) => [s.post.id, s.breakdown]));
  const ranked: RankedPost[] = rankedPosts.map((p) => {
    const breakdown = scoreById.get(p.id);
    if (!breakdown) return p as RankedPost;
    const now = Date.now();
    const ageMin = (now - p.createdAt) / 60000;
    const spam = ((p as unknown as Record<string, unknown>).spamScore as number) ?? 0;
    const qScore = computeQualityScore(p, {
      author: buildQualityAuthorProfile(p.author),
      uniqueness: 10,
    });
    const protocolQuality = protocolQualityById.get(p.id);
    const { score: _, ...rest } = p as unknown as Record<string, unknown>;
    return {
      ...(rest as unknown as UnifiedPost),
      score: {
        total: breakdown.total,
        recency: breakdown.recency,
        engagement: breakdown.engagement,
        relevance: breakdown.relevance,
        quality: breakdown.quality,
        reputation: breakdown.reputation,
        diversity: breakdown.diversity,
        source: breakdown.source,
        velocity: breakdown.velocity,
        spam,
        qualityScore: qScore,
        reasons: breakdown.reasons,
      },
      isNew: ageMin < 15,
      isHot: breakdown.velocity > 2.0,
      isTrending: breakdown.engagement > 3,
      qualityScore: protocolQuality
        ? {
            score: protocolQuality.score,
            max: protocolQuality.maxScore,
            ratio: protocolQuality.ratio,
            reasons: protocolQuality.reasons,
          }
        : undefined,
      qualityBadge: protocolQuality?.badge ?? null,
      feedDebug: {
        spamScore: spam,
        qualityScore: qScore / 100, // Normalize 0–100 → 0–1 for the UI
        authorReputation: breakdown.reputation,
        topicMatch: Math.min(breakdown.relevance / 3, 1),
        velocity: breakdown.velocity,
        freshness: freshnessBoost(p.createdAt, now),
        sourceProtocol: p.protocol,
        isFollowed: opts.followed.has(p.author.id),
        isMutedOrBlocked: false, // Muted/blocked posts are filtered before scoring
      },
    };
  });

  // Top-of-hour: highest-scoring post from the last 60 minutes.
  const now = Date.now();
  const recentPosts = spamFiltered.filter((s) => now - s.post.createdAt < 3600000);
  const topOfHour =
    recentPosts.length > 0
      ? recentPosts.reduce((best, cur) => (cur.breakdown.total > best.breakdown.total ? cur : best))
          .post.id
      : null;

  const nextCursor = ranked.length > 0 ? (ranked[ranked.length - 1]?.createdAt ?? null) : null;

  // ── Compute debug header averages ──────────────────────────────
  const totalPosts = spamFiltered.length || 1;
  const debug = {
    avgSpam:
      spamFiltered.reduce(
        (sum, s) =>
          sum + (((s.post as unknown as Record<string, unknown>).spamScore as number) ?? 0),
        0,
      ) / totalPosts,
    avgQuality: spamFiltered.reduce((sum, s) => sum + s.breakdown.quality, 0) / totalPosts,
    avgReputation: spamFiltered.reduce((sum, s) => sum + s.breakdown.reputation, 0) / totalPosts,
    avgVelocity: spamFiltered.reduce((sum, s) => sum + s.breakdown.velocity, 0) / totalPosts,
    avgQualityScore:
      spamFiltered.reduce(
        (sum, s) =>
          sum +
          computeQualityScore(s.post, {
            author: buildQualityAuthorProfile(s.post.author),
            uniqueness: 10,
          }),
        0,
      ) / totalPosts,
  };

  return { ranked, topOfHour, nextCursor, debug };
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
    log(
      'warn',
      '[feed] Mastodon trending tags fetch failed',
      err instanceof Error ? err.message : err,
    );
  }
  return trending;
}
