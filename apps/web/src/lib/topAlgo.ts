/**
 * @degenfeed/web — Top-Tier 2026 Feed Algorithm
 *
 * User-controlled, diverse, engaging, and transparent ranking engine.
 * Replaces the legacy client-side blend in feedRanking.ts for the unified
 * feed page. Every signal is a pure function so the ranking is auditable
 * and each post can explain itself ("Why this?").
 *
 * Signals:
 *   1. Personalization      — engagement profile (protocols/topics/creators)
 *   2. Freshness decay      — genre-specific half-life curves (news fast,
 *                             analysis slow)
 *   3. Creator reputation   — verified badge, follower count, creator coin
 *   4. Engagement velocity  — engagements per hour (trending), not just count
 *   5. Content diversity    — slot-filling caps: never >2 posts from the same
 *                             creator in a row
 *   6. Cold start discovery — new creators get a boost for their first 24h
 *   7. Serendipity          — the "Discover" slider reserves a slice of the
 *                             feed from protocols/topics the user doesn't
 *                             normally see
 *
 * User controls (sliders on the feed page):
 *   - Recency ↔ Quality      (recencyQuality)
 *   - Engagement ↔ Diversity (engagementDiversity)
 *   - Protocol diversity     (protocolDiversity)
 *   - Familiar ↔ Discover    (familiarDiscover → serendipity fraction)
 *   - Creator size           (creatorSize → indie vs big accounts)
 *   - Per-protocol weights   (from the Feed Tuner modal, optional)
 *
 * 'Latest' sort is explicitly chronological — user weights do not distort it.
 */

import {
  type DiversityConfig,
  diversifyFeed,
  isSerendipitous,
  type ScoredItem,
} from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { type AlgoProfile, EMPTY_ALGO_PROFILE, hasAlgoProfileSignal } from './algoProfile';
import { type FeedAlgorithmPrefs, type FeedControls, filterFeed } from './feedRanking';

// ─── Small helpers ─────────────────────────────────────────────────────

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const clampNum = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function fmtAge(ageHours: number): string {
  if (ageHours < 1) return `${Math.max(1, Math.round(ageHours * 60))}m`;
  if (ageHours < 24) return `${Math.round(ageHours)}h`;
  return `${Math.round(ageHours / 24)}d`;
}

// ─── 1. Genre-specific freshness ───────────────────────────────────────

export type ContentGenre = 'news' | 'analysis' | 'social' | 'memes';

/** Heuristic genre detection — drives the freshness decay curve. */
export function detectGenre(post: UnifiedPost): ContentGenre {
  const text = (post.text ?? '').toLowerCase();
  if (
    /\b(breaking|just in|live|today|announced|launches|launch|price|pump|dump|ath|crash|surge|plunge|etf approval|sec)\b/.test(
      text,
    )
  ) {
    return 'news';
  }
  if (
    /\b(analysis|review|guide|tutorial|explain|why|how|deep dive|whitepaper|report|research)\b/.test(
      text,
    )
  ) {
    return 'analysis';
  }
  if (/\b(moon|gem|wen|gm|wagmi|degens|ser|fren|ngmi|based|anons)\b/.test(text)) {
    return 'memes';
  }
  return 'social';
}

/** Half-life per genre — news decays in hours, analysis lasts for days. */
export const GENRE_HALF_LIFE_HOURS: Record<ContentGenre, number> = {
  news: 2,
  analysis: 24,
  social: 8,
  memes: 4,
};

export interface FreshnessResult {
  score: number;
  genre: ContentGenre;
  detail: string;
}

export function freshnessScore(post: UnifiedPost, now: number): FreshnessResult {
  const ageHours = Math.max(0, (now - post.createdAt) / 3_600_000);
  const genre = detectGenre(post);
  const halfLife = GENRE_HALF_LIFE_HOURS[genre];
  const score = 0.5 ** (ageHours / halfLife);
  return {
    score,
    genre,
    detail: `Posted ${fmtAge(ageHours)} ago (${genre} curve, ${halfLife}h half-life)`,
  };
}

// ─── 2. Engagement (absolute, log-scaled) ──────────────────────────────

export function engagementScore(post: UnifiedPost): number {
  const m = post.metrics;
  const raw = m.likes + m.reposts * 2 + m.replies * 3 + (m.quotes ?? 0) * 4 + (m.views ?? 0) / 10;
  return clamp01(Math.log(1 + raw) / Math.log(1 + 10_000));
}

// ─── 3. Engagement velocity (trending) ─────────────────────────────────

export interface VelocityResult {
  score: number;
  rate: number;
  detail: string;
}

export function velocityScore(post: UnifiedPost, now: number): VelocityResult {
  const m = post.metrics;
  const total = m.likes + m.reposts * 2 + m.replies * 3 + (m.quotes ?? 0) * 4 + (m.views ?? 0) / 10;
  const ageHours = Math.max(0.1, (now - post.createdAt) / 3_600_000);
  const rate = total / ageHours;
  const score = clamp01(Math.log(1 + rate) / Math.log(1 + 500));
  return {
    score,
    rate,
    detail: rate >= 5 ? `Trending — ${rate.toFixed(0)} engagements/hr` : '',
  };
}

// ─── 4. Content quality ────────────────────────────────────────────────

export function qualityScore(post: UnifiedPost): number {
  const ratio = post.qualityScore?.ratio;
  if (ratio !== undefined) return clamp01(ratio);
  const dbg = post.feedDebug?.qualityScore;
  if (dbg !== undefined) return clamp01(dbg);
  const spam = (post as unknown as { spamScore?: number }).spamScore ?? 0;
  const len = (post.text ?? '').trim().length;
  const hasMedia = post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');
  let s = (1 - spam) * 0.6 + Math.min(len / 400, 1) * 0.4;
  if (hasMedia) s = Math.min(1, s + 0.05);
  return clamp01(s);
}

// ─── 5. Creator reputation ─────────────────────────────────────────────

/** Defensive extraction of a creator-coin weight if the provider exposes one. */
export function creatorCoinWeight(post: UnifiedPost): number | null {
  const author = post.author as unknown as Record<string, unknown>;
  for (const key of ['coinWeight', 'creatorCoinWeight']) {
    const v = author[key];
    if (typeof v === 'number' && Number.isFinite(v)) return clamp01(v);
  }
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const nested = (raw.creatorCoin ?? raw.coin ?? {}) as Record<string, unknown>;
  for (const key of ['weight', 'score', 'marketCapUsd']) {
    const v = nested[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return clamp01(Math.log(1 + v) / Math.log(1 + 1_000_000));
    }
  }
  return null;
}

export interface ReputationResult {
  score: number;
  followers: number;
  verified: boolean;
  coin: number | null;
  reasons: string[];
}

export function reputationScore(post: UnifiedPost): ReputationResult {
  const reasons: string[] = [];
  const followers = post.author?.followerCount ?? 0;
  const verified = Array.isArray(post.author?.verified) && post.author.verified.length > 0;

  // Log-scale follower count (1 → ~0, 100k → 1).
  let score = Math.min(1, Math.log(1 + followers) / Math.log(1 + 100_000));
  if (verified) {
    score = Math.min(1, score + 0.2);
    reasons.push('verified-author');
  }
  if (followers >= 10_000) reasons.push('big-creator');
  else if (followers >= 1_000) reasons.push('established-author');
  else reasons.push('indie-creator'); // small / likely new

  const coin = creatorCoinWeight(post);
  if (coin !== null) {
    score = Math.min(1, score + coin * 0.25);
    reasons.push('creator-coin');
  }
  return { score, followers, verified, coin, reasons };
}

// ─── 6. Cold start discovery ───────────────────────────────────────────

/**
 * New creators (very low follower count) get a discovery boost for their
 * first 24 hours so they aren't crushed by established accounts.
 */
export function coldStartBoost(
  post: UnifiedPost,
  now: number,
): { boost: number; isColdStart: boolean } {
  const ageHours = (now - post.createdAt) / 3_600_000;
  const followers = post.author?.followerCount ?? 0;
  if (ageHours < 24 && followers < 50) {
    return { boost: 0.15, isColdStart: true };
  }
  return { boost: 0, isColdStart: false };
}

// ─── 7. Personalization ────────────────────────────────────────────────

export interface PersonalizationResult {
  score: number;
  reasons: string[];
}

export function personalizationScore(
  post: UnifiedPost,
  profile: AlgoProfile,
): PersonalizationResult {
  const reasons: string[] = [];
  let s = 0;

  // Topic affinity from the engagement profile.
  for (const n of post.niches ?? []) {
    const w = profile.topics[n.toLowerCase()] ?? 0;
    if (w > 0.05) {
      s += Math.min(0.2, w * 0.2);
      reasons.push('personalized-topic');
    } else if (w < -0.05) {
      s -= 0.15;
    }
  }

  // Protocol affinity.
  const pw = profile.protocols[post.protocol] ?? 0;
  if (pw > 0.05) {
    s += Math.min(0.2, pw * 0.2);
    reasons.push('personalized-protocol');
  }

  // Creator affinity (implicit "follow" from engagement).
  if (profile.creators.includes(post.author?.id ?? '')) {
    s += 0.3;
    reasons.push('followed');
  }

  return { score: clamp01(s), reasons: [...new Set(reasons)] };
}

/** Serendipity: content from protocols/topics/creators outside the user's bubble. */
export function isSerendipitousForUser(post: UnifiedPost, profile: AlgoProfile): boolean {
  const seenNiches = new Set(
    Object.keys(profile.topics).filter((k) => (profile.topics[k] ?? 0) > 0.05),
  );
  const seenCreators = new Set(profile.creators);
  const seenProtocols = new Set(
    Object.keys(profile.protocols).filter((k) => (profile.protocols[k] ?? 0) > 0.05),
  );
  return isSerendipitous(post, seenNiches, seenCreators, seenProtocols);
}

// ─── Per-protocol weight (Feed Tuner sliders) ──────────────────────────

/**
 * Gentle multiplicative boost from the Feed Tuner's per-protocol weights
 * (0-100, default 50). weight 100 → +~20%, 25 → −~15%.
 */
export function protocolWeightBoost(
  post: UnifiedPost,
  protocolWeights?: Record<string, number>,
): number {
  if (!protocolWeights) return 0;
  const weight = protocolWeights[post.protocol];
  if (weight === undefined) return 0;
  const ratio = weight / 50;
  return (Math.sqrt(Math.max(ratio, 0.1)) - 1) * 0.5;
}

// ─── Slider → weight mapping ───────────────────────────────────────────

function sliderWeights(a: FeedAlgorithmPrefs) {
  return {
    wRecency: (100 - a.recencyQuality) / 100,
    wQuality: a.recencyQuality / 100,
    wEngagement: (100 - a.engagementDiversity) / 100,
    wPersonal: (100 - a.familiarDiscover) / 100,
    wReputation: a.creatorSize / 100,
    indieMode: a.creatorSize < 50,
  };
}

/** Serendipity fraction from the Familiar ↔ Discover slider (default ≈10%). */
export function serendipityFraction(algo: FeedAlgorithmPrefs): number {
  return clampNum(0.03 + (algo.familiarDiscover / 100) * 0.14, 0.02, 0.2);
}

// ─── Transparency attachment ───────────────────────────────────────────

interface ComputedSignals {
  freshness: FreshnessResult;
  engagement: number;
  velocity: VelocityResult;
  quality: number;
  reputation: ReputationResult;
  personalization: PersonalizationResult;
  coldStart: boolean;
  protocolBoost: number;
  isSerendipitous: boolean;
}

function computeSignals(
  post: UnifiedPost,
  profile: AlgoProfile,
  protocolWeights: Record<string, number> | undefined,
  now: number,
): ComputedSignals {
  return {
    freshness: freshnessScore(post, now),
    engagement: engagementScore(post),
    velocity: velocityScore(post, now),
    quality: qualityScore(post),
    reputation: reputationScore(post),
    personalization: personalizationScore(post, profile),
    coldStart: coldStartBoost(post, now).isColdStart,
    protocolBoost: protocolWeightBoost(post, protocolWeights),
    isSerendipitous: isSerendipitousForUser(post, profile),
  };
}

/** Composite score from all signals blended with the user's slider weights. */
function compositeScore(
  post: UnifiedPost,
  signals: ComputedSignals,
  controls: FeedControls,
  now: number,
): number {
  const { wRecency, wQuality, wEngagement, wPersonal, wReputation, indieMode } = sliderWeights(
    controls.algorithm,
  );

  let score =
    wRecency * signals.freshness.score +
    wQuality * signals.quality +
    wEngagement * signals.engagement +
    0.5 * signals.velocity.score +
    wReputation * signals.reputation.score +
    wPersonal * signals.personalization.score +
    signals.protocolBoost;

  // Explicit niche selection gets a boost (user asked for it).
  if (controls.niches.length > 0 && post.niches.some((n) => controls.niches.includes(n))) {
    score += 0.2;
  }

  // Creator size: indie mode lifts small creators, big mode suppresses them.
  const followers = post.author?.followerCount ?? 0;
  if (followers < 1_000) score += indieMode ? 0.1 : -0.05;

  // Cold start discovery boost for new creators.
  score += coldStartBoost(post, now).boost;

  return Math.max(0, score);
}

function diversityConfig(controls: FeedControls, totalItems: number): DiversityConfig {
  const pd = controls.algorithm.protocolDiversity;
  return {
    maxConsecutiveCategory: 3,
    maxConsecutiveCreator: 2,
    maxConsecutiveProtocol: pd >= 80 ? 1 : pd >= 60 ? 2 : pd >= 40 ? 3 : 6,
    maxTotalCategory: 8,
    maxTotalCreator: 4,
    maxTotalProtocol: Math.max(6, totalItems),
    serendipityFraction: serendipityFraction(controls.algorithm),
    serendipityMinScore: 0.2,
    filterBubbleFraction: 0,
    interleaveProtocols: false, // slot-filling already enforces the caps
  };
}

/**
 * Attach the PostScore + FeedDebug transparency payload to a post so the
 * "Why this?" card can explain the ranking without extra requests.
 */
function attachTransparency(
  post: UnifiedPost,
  item: ScoredItem,
  signals: ComputedSignals,
  controls: FeedControls,
  profile: AlgoProfile,
  authorCounts: Map<string, number>,
): UnifiedPost {
  const reasons: string[] = [];

  if (signals.freshness.score > 0.6) reasons.push('fresh');
  if (signals.velocity.score > 0.45) reasons.push('trending-now');
  if (signals.personalization.reasons.includes('followed')) reasons.push('followed');
  if (signals.personalization.reasons.includes('personalized-topic')) reasons.push('on-topic');
  if (signals.personalization.reasons.includes('personalized-protocol'))
    reasons.push('personalized');
  if (signals.reputation.reasons.includes('verified-author')) reasons.push('verified-author');
  if (signals.reputation.reasons.includes('big-creator')) reasons.push('big-creator');
  if (signals.reputation.reasons.includes('indie-creator')) reasons.push('indie-creator');
  if (signals.reputation.reasons.includes('creator-coin')) reasons.push('creator-coin');
  if (signals.coldStart) reasons.push('discovery');
  if (signals.isSerendipitous && hasAlgoProfileSignal(profile)) reasons.push('serendipity');
  if (controls.algorithm.creatorSize < 50 && (post.author?.followerCount ?? 0) < 1_000) {
    reasons.push('indie-mode');
  }
  if (controls.algorithm.creatorSize >= 50 && (post.author?.followerCount ?? 0) >= 10_000) {
    reasons.push('big-creator');
  }
  if (signals.protocolBoost > 0.05) reasons.push('protocol-boost');

  const authorCount = authorCounts.get(post.author?.id ?? '') ?? 1;
  const diversity = clamp01(1 - (authorCount - 1) * 0.15);

  return {
    ...post,
    score: {
      total: Math.round(item.score * 10_000) / 1000,
      recency: Math.round(signals.freshness.score * 2_000) / 1000,
      engagement: Math.round(signals.engagement * 5_000) / 1000,
      relevance: Math.round(signals.personalization.score * 3_000) / 1000,
      quality: Math.round(signals.quality * 3_000) / 1000,
      diversity: Math.round(diversity * 2_000) / 1000,
      source: Math.round((signals.protocolBoost + 0.5) * 2_000) / 1000,
      velocity: Math.round(signals.velocity.score * 3_000) / 1000,
      reasons: [...new Set(reasons)],
    },
    feedDebug: {
      spamScore: 0,
      qualityScore: Math.round(signals.quality * 100) / 100,
      authorReputation: Math.round(signals.reputation.score * 2_000) / 1000,
      topicMatch: Math.round(signals.personalization.score * 100) / 100,
      velocity: Math.round(1 + signals.velocity.score * 2_000) / 1000,
      freshness: Math.round(1 + signals.freshness.score * 1_000) / 1000,
      sourceProtocol: post.protocol,
      isFollowed: signals.personalization.reasons.includes('followed'),
      isMutedOrBlocked: false,
    },
  } as UnifiedPost;
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Hard guarantee: never show more than `maxConsecutive` posts from the same
 * creator in a row. diversifyFeed's slot-filling enforces this in its normal
 * phase, but its relaxation phases (when few creators remain) can produce
 * longer runs — this post-pass swaps the offending post with a different-
 * creator post (forward first, backward for tail runs) and re-validates the
 * neighborhood so the cap always holds.
 */
function isRunSafe(items: ScoredItem[], index: number, maxConsecutive: number): boolean {
  const id = items[index]?.post.author?.id ?? '';
  if (!id) return true;
  let run = 1;
  for (let j = index - 1; j >= 0 && items[j]?.post.author?.id === id; j--) run++;
  for (let j = index + 1; j < items.length && items[j]?.post.author?.id === id; j++) run++;
  return run <= maxConsecutive;
}

function enforceMaxConsecutiveCreator(items: ScoredItem[], maxConsecutive: number): ScoredItem[] {
  const result = [...items];
  const n = result.length;
  if (n <= maxConsecutive) return result;
  const swap = (a: number, b: number) => {
    const tmp = result[a];
    const other = result[b];
    if (tmp === undefined || other === undefined) return;
    result[a] = other;
    result[b] = tmp;
  };

  let guard = 0;
  const maxIterations = Math.max(10, n * 4);
  for (let i = 0; i < n && guard < maxIterations; guard++) {
    if (isRunSafe(result, i, maxConsecutive)) {
      i++;
      continue;
    }
    const authorId = result[i]?.post.author?.id ?? '';
    let fixed = false;

    // Forward pass: swap with the next different-creator post.
    for (let j = i + 1; j < n; j++) {
      if (result[j]?.post.author?.id === authorId) continue;
      swap(i, j);
      if (isRunSafe(result, i, maxConsecutive) && isRunSafe(result, j, maxConsecutive)) {
        fixed = true;
        break;
      }
      swap(i, j); // revert
    }

    // Backward fallback: tail runs have no different creator ahead.
    if (!fixed) {
      for (let j = i - 1; j >= 0; j--) {
        if (result[j]?.post.author?.id === authorId) continue;
        swap(i, j);
        if (isRunSafe(result, i, maxConsecutive) && isRunSafe(result, j, maxConsecutive)) {
          fixed = true;
          break;
        }
        swap(i, j); // revert
      }
    }

    // Re-scan the neighborhood after a fix; if nothing worked, the batch is
    // unsatisfiable at this position (e.g. only one creator) — move on.
    i = fixed ? Math.max(0, i - 2) : i + 1;
  }
  return result;
}

export interface TopAlgoOptions {
  /** Engagement profile (localStorage) — powers personalization + serendipity. */
  profile?: AlgoProfile;
  /** Per-protocol weights 0-100 from the Feed Tuner modal. */
  protocolWeights?: Record<string, number>;
  /** Current timestamp (ms). Defaults to Date.now(). */
  now?: number;
}

/**
 * Rank a batch of posts with the top-tier 2026 algorithm.
 *
 * Pipeline: filter → score → diversify (slot-filling with author/protocol/
 * category caps + serendipity quota) → attach transparency.
 */
export function rankTopAlgo(
  posts: UnifiedPost[],
  controls: FeedControls,
  options: TopAlgoOptions = {},
): UnifiedPost[] {
  const now = options.now ?? Date.now();
  const profile = options.profile ?? EMPTY_ALGO_PROFILE;
  const protocolWeights = options.protocolWeights ?? {};

  const filtered = filterFeed(posts, controls, now);

  // 'Latest' is explicitly chronological — sliders do not distort it.
  if (controls.sort === 'latest') {
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }

  const items: ScoredItem[] = filtered.map((post) => {
    const signals = computeSignals(post, profile, protocolWeights, now);
    const score = compositeScore(post, signals, controls, now);
    return {
      post,
      score,
      category: post.niches[0],
      isSerendipitous: signals.isSerendipitous,
    };
  });

  const result = diversifyFeed(items, diversityConfig(controls, filtered.length));

  // Hard guarantee: never >2 posts from the same creator in a row.
  const diversified = enforceMaxConsecutiveCreator(result.items, 2);

  // Author counts across the final feed (for the diversity transparency bar).
  const authorCounts = new Map<string, number>();
  for (const item of diversified) {
    const id = item.post.author?.id ?? '';
    authorCounts.set(id, (authorCounts.get(id) ?? 0) + 1);
  }

  // Recompute signals once per post for transparency attachment.
  const signalCache = new Map<string, ComputedSignals>();
  for (const post of filtered) {
    signalCache.set(post.id, computeSignals(post, profile, protocolWeights, now));
  }

  return diversified.map((item) =>
    attachTransparency(
      item.post,
      item,
      signalCache.get(item.post.id) ?? computeSignals(item.post, profile, protocolWeights, now),
      controls,
      profile,
      authorCounts,
    ),
  );
}
