/**
 * feed-quality-gates — Content quality pipeline.
 *
 * Order: quality gate → engagement floor → language filter →
 *        cross-protocol dedup → freshness scoring → source diversity → ranking.
 *
 * Each gate is independently configurable and emits metadata for observability.
 */

import { isEnglishPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { deduplicateCrossProtocol } from './content-dedup';
import { hasNsfwContent, hasSpamSignals } from '../ranking/ranking-weights';

type SourceCategory = 'social' | 'lemmy' | 'peertube' | 'youtube' | 'mastodon' | 'rss' | 'reddit';

// ─── 1. Content quality gate ─────────────────────────────────────

export interface QualityGateResult {
  passed: number;
  filtered: number;
  threshold: number;
}

/**
 * Filters out posts with quality score below threshold.
 * Quality score is the normalized 0-1 value from the composite quality system
 * (stored as feedDebug.qualityScore or score.qualityScore/100).
 * Default threshold of 0.3 lets through reasonably good content.
 */
export function applyQualityGate(
  posts: UnifiedPost[],
  threshold: number = 0.3,
): { posts: UnifiedPost[]; meta: QualityGateResult } {
  if (threshold <= 0) return { posts, meta: { passed: posts.length, filtered: 0, threshold } };
  let filtered = 0;
  const passed = posts.filter((p) => {
    const qs = getQualityScore(p);
    if (qs < threshold) {
      filtered++;
      return false;
    }
    return true;
  });
  return { posts: passed, meta: { passed: passed.length, filtered, threshold } };
}

function getQualityScore(post: UnifiedPost): number {
  const feedDebug = (post as unknown as Record<string, unknown>).feedDebug as
    | { qualityScore?: number }
    | undefined;
  if (feedDebug?.qualityScore !== undefined && feedDebug.qualityScore >= 0) {
    return feedDebug.qualityScore;
  }
  const score = (post as unknown as { score?: { qualityScore?: number } }).score;
  if (score?.qualityScore !== undefined && score.qualityScore >= 0) {
    return score.qualityScore / 100;
  }
  const qualityBadge = (post as unknown as { qualityScore?: { ratio?: number } }).qualityScore;
  if (qualityBadge?.ratio !== undefined) return qualityBadge.ratio;
  // Heuristic fallback: engagement / (age + 1) normalized
  const eng = post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3;
  const ageDays = (Date.now() - post.createdAt) / 86400000;
  const heuristic = Math.min(1, eng / Math.max(1, ageDays + 1) / 10);
  return heuristic;
}

// ─── 2. Engagement floor ──────────────────────────────────────────

export interface EngagementFloorResult {
  promoted: number;
  deprioritized: number;
  zeroEngagementOlder24h: number;
}

/**
 * Posts with 0 engagement AND older than 24h are deprioritized
 * (moved after newer content) while still being kept in the feed.
 * Posts with low non-zero but very old engagement are also nudged down.
 */
export function applyEngagementFloor(
  posts: UnifiedPost[],
  now: number = Date.now(),
  ageHours: number = 24,
): { posts: UnifiedPost[]; meta: EngagementFloorResult } {
  const ageMs = ageHours * 3600000;
  const fresh: UnifiedPost[] = [];
  const stale: UnifiedPost[] = [];
  let zeroEngagementOlder24h = 0;

  for (const post of posts) {
    const totalEng =
      (post.metrics.likes ?? 0) +
      (post.metrics.reposts ?? 0) +
      (post.metrics.replies ?? 0) +
      (post.metrics.quotes ?? 0);
    const ageMsVal = now - post.createdAt;

    if (totalEng === 0 && ageMsVal > ageMs) {
      zeroEngagementOlder24h++;
      stale.push(post);
    } else if (totalEng > 0) {
      fresh.push(post);
    } else {
      fresh.push(post);
    }
  }

  return {
    posts: [...fresh, ...stale],
    meta: {
      promoted: fresh.length,
      deprioritized: stale.length,
      zeroEngagementOlder24h,
    },
  };
}

// ─── 3. Language detection filter ─────────────────────────────────

export interface LanguageFilterResult {
  passed: number;
  filtered: number;
  preferEnglish: boolean;
}

const _LATIN_SCRIPT_RE = /^[\x00-\x7F\u00C0-\u024F\s\p{P}\p{S}\p{N}\p{Emoji}]+$/u;

function fastNonLatinScriptCheck(text: string): boolean {
  let nonLatin = 0;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 127) {
      // Check if this is a CJK, Cyrillic, Arabic, or other non-Latin block
      if (
        (c >= 0x0400 && c <= 0x04ff) || // Cyrillic
        (c >= 0x0600 && c <= 0x06ff) || // Arabic
        (c >= 0x0900 && c <= 0x097f) || // Devanagari
        (c >= 0x1100 && c <= 0x11ff) || // Hangul
        (c >= 0x3000 && c <= 0x9fff) || // CJK
        (c >= 0xac00 && c <= 0xd7af) || // Hangul syllables
        (c >= 0x3040 && c <= 0x309f) || // Hiragana
        (c >= 0x30a0 && c <= 0x30ff) // Katakana
      ) {
        nonLatin++;
      }
    }
    total++;
  }
  return total > 0 && nonLatin / total < 0.3;
}

/**
 * Language filter: primarily shows English content.
 * Uses the existing isEnglishPost from feed-core + fast non-Latin script check.
 * Configurable via `preferEnglish` flag.
 */
export function applyLanguageFilter(
  posts: UnifiedPost[],
  preferEnglish: boolean = true,
): { posts: UnifiedPost[]; meta: LanguageFilterResult } {
  if (!preferEnglish) {
    return { posts, meta: { passed: posts.length, filtered: 0, preferEnglish: false } };
  }

  const passed = posts.filter((p) => {
    const text = p.text || '';
    if (text.length < 10) return true;
    if (!fastNonLatinScriptCheck(text)) return false;
    return isEnglishPost(text);
  });

  return {
    posts: passed,
    meta: { passed: passed.length, filtered: posts.length - passed.length, preferEnglish: true },
  };
}

// ─── 3b. NSFW / Spam content filter ──────────────────────────────

export interface NsfwFilterResult {
  passed: number;
  filtered: number;
  nsfwFiltered: number;
  spamFiltered: number;
}

/**
 * Filters out posts containing NSFW or spam content.
 * Uses keyword-based detection from ranking-weights.
 */
export function applyNsfwSpamFilter(
  posts: UnifiedPost[],
): { posts: UnifiedPost[]; meta: NsfwFilterResult } {
  let nsfwFiltered = 0;
  let spamFiltered = 0;

  const passed = posts.filter((p) => {
    const text = p.text || '';

    // Check NSFW content
    if (hasNsfwContent(text)) {
      nsfwFiltered++;
      return false;
    }

    // Check spam signals
    if (hasSpamSignals(text)) {
      spamFiltered++;
      return false;
    }

    // Also check embed descriptions/meta for NSFW
    for (const embed of p.embeds) {
      const metaText = [embed.meta?.title, embed.meta?.description].filter(Boolean).join(' ');
      if (hasNsfwContent(metaText)) {
        nsfwFiltered++;
        return false;
      }
    }

    return true;
  });

  return {
    posts: passed,
    meta: {
      passed: passed.length,
      filtered: nsfwFiltered + spamFiltered,
      nsfwFiltered,
      spamFiltered,
    },
  };
}

// ─── 4. Cross-protocol dedup ──────────────────────────────────────

export interface CrossProtocolDedupResult {
  remaining: number;
  deduped: number;
  crossProtocol: number;
  urlDedup: number;
}

/**
 * Same content posted on multiple protocols (e.g. Nostr AND Farcaster)
 * appears only once, keeping the version with higher engagement.
 * Wraps the existing deduplicateCrossProtocol from content-dedup.ts.
 */
export function applyCrossProtocolDedup(posts: UnifiedPost[]): {
  posts: UnifiedPost[];
  meta: CrossProtocolDedupResult;
} {
  const result = deduplicateCrossProtocol(posts);
  return {
    posts: result.posts,
    meta: {
      remaining: result.posts.length,
      deduped: result.deduped,
      crossProtocol: result.crossProtocol,
      urlDedup: result.urlDedup,
    },
  };
}

// ─── 5. Content freshness scoring ─────────────────────────────────

export interface FreshnessScoringConfig {
  /** <1h booster */
  highFreshnessBoost: number;
  /** 1-6h booster */
  mediumFreshnessBoost: number;
  /** 6-24h booster */
  lowFreshnessBoost: number;
  /** >24h baseline */
  baseline: number;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessScoringConfig = {
  highFreshnessBoost: 3.0,
  mediumFreshnessBoost: 2.0,
  lowFreshnessBoost: 1.5,
  baseline: 1.0,
};

export const HOT_FRESHNESS_CONFIG: FreshnessScoringConfig = {
  highFreshnessBoost: 5.0,
  mediumFreshnessBoost: 3.0,
  lowFreshnessBoost: 1.5,
  baseline: 0.8,
};

export const TRENDING_FRESHNESS_CONFIG: FreshnessScoringConfig = {
  highFreshnessBoost: 4.0,
  mediumFreshnessBoost: 2.5,
  lowFreshnessBoost: 1.2,
  baseline: 0.6,
};

export const TOP_FRESHNESS_CONFIG: FreshnessScoringConfig = {
  highFreshnessBoost: 1.0,
  mediumFreshnessBoost: 1.0,
  lowFreshnessBoost: 1.0,
  baseline: 1.0,
};

export interface FreshnessScores {
  score: number;
  tier: 'high' | 'medium' | 'low' | 'baseline';
  ageHours: number;
}

export function computeFreshnessScore(
  post: UnifiedPost,
  now: number = Date.now(),
  config: FreshnessScoringConfig = DEFAULT_FRESHNESS_CONFIG,
): FreshnessScores {
  const ageMs = now - post.createdAt;
  const ageHours = ageMs / 3600000;
  let score: number;
  let tier: 'high' | 'medium' | 'low' | 'baseline';

  if (ageHours < 1) {
    score = config.highFreshnessBoost;
    tier = 'high';
  } else if (ageHours < 6) {
    score = config.mediumFreshnessBoost;
    tier = 'medium';
  } else if (ageHours < 24) {
    score = config.lowFreshnessBoost;
    tier = 'low';
  } else {
    score = config.baseline;
    tier = 'baseline';
  }

  return { score, tier, ageHours: Math.round(ageHours * 100) / 100 };
}

export interface FreshnessScoringResult {
  applied: number;
  high: number;
  medium: number;
  low: number;
  baseline: number;
  config: FreshnessScoringConfig;
}

/**
 * Applies configurable freshness scoring to posts.
 * Attaches a `freshnessScore` field to each post and sorts by
 * freshness-multiplied score. Posts get reordered so fresher
 * content surfaces higher, weighted by the per-tab config.
 */
export function applyFreshnessScoring(
  posts: UnifiedPost[],
  now: number = Date.now(),
  config: FreshnessScoringConfig = DEFAULT_FRESHNESS_CONFIG,
): { posts: UnifiedPost[]; meta: FreshnessScoringResult } {
  let high = 0,
    medium = 0,
    low = 0,
    baseline = 0;

  const scored = posts.map((post) => {
    const fs = computeFreshnessScore(post, now, config);
    switch (fs.tier) {
      case 'high':
        high++;
        break;
      case 'medium':
        medium++;
        break;
      case 'low':
        low++;
        break;
      default:
        baseline++;
        break;
    }
    const existingScore = (post as unknown as { score?: { total?: number } }).score?.total ?? 0;
    const boostedScore = existingScore * fs.score;
    return { post, freshnessScore: fs, boostedScore };
  });

  scored.sort((a, b) => b.boostedScore - a.boostedScore);

  for (const s of scored) {
    (s.post as unknown as Record<string, unknown>).freshnessScore = s.freshnessScore;
    (s.post as unknown as Record<string, unknown>).freshnessBoostedScore = s.boostedScore;
  }

  return {
    posts: scored.map((s) => s.post),
    meta: { applied: scored.length, high, medium, low, baseline, config },
  };
}

// ─── 6. Source diversity ──────────────────────────────────────────

export interface SourceDiversityResult {
  diverse: boolean;
  sourceBreakdown: Record<string, { count: number; pct: number; capped: boolean }>;
  rearranged: boolean;
  maxPctPerSource: number;
}

const SOURCE_CATEGORY_ORDER: SourceCategory[] = [
  'social',
  'lemmy',
  'rss',
  'reddit',
  'peertube',
  'youtube',
  'mastodon',
];

function resolveSourceCategory(post: UnifiedPost): SourceCategory {
  const src = (post as unknown as { sourceCategory?: SourceCategory }).sourceCategory;
  if (src) return src;
  const protocol = post.protocol ?? 'rss';
  if (['nostr', 'farcaster', 'lens', 'bluesky'].includes(protocol)) return 'social';
  if (protocol === 'mastodon') return 'mastodon';
  if (protocol === 'lemmy') return 'lemmy';
  if (protocol === 'peertube') return 'peertube';
  if (protocol === 'youtube') return 'youtube';
  if (protocol === 'rss') return 'rss';
  if (protocol === 'reddit') return 'reddit';
  return 'social';
}

/**
 * Ensures no more than `maxPctPerSource`% of the feed comes from any
 * single source category. Rearranges posts to enforce diversity:
 * when a source hits its cap, its remaining posts move to the bottom.
 *
 * Also ensures protocol diversity by interleaving sources.
 */
export function applySourceDiversity(
  posts: UnifiedPost[],
  maxPctPerSource: number = 30,
): { posts: UnifiedPost[]; meta: SourceDiversityResult } {
  if (posts.length === 0) {
    return {
      posts: [],
      meta: { diverse: true, sourceBreakdown: {}, rearranged: false, maxPctPerSource },
    };
  }

  const maxPerSource = Math.max(1, Math.ceil((posts.length * maxPctPerSource) / 100));

  // Count by source
  const sourceCounts = new Map<SourceCategory, number>();
  for (const p of posts) {
    const src = resolveSourceCategory(p);
    sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }

  const sourceBreakdown: Record<string, { count: number; pct: number; capped: boolean }> = {};
  for (const [src, count] of sourceCounts) {
    sourceBreakdown[src] = {
      count,
      pct: Math.round((count / posts.length) * 100 * 100) / 100,
      capped: count > maxPerSource,
    };
  }

  // If no source is capped, return as-is
  const anyCapped = Object.values(sourceBreakdown).some((b) => b.capped);
  if (!anyCapped) {
    return { posts, meta: { diverse: true, sourceBreakdown, rearranged: false, maxPctPerSource } };
  }

  // Reorder: interleave sources, respecting caps
  const buckets = new Map<SourceCategory, UnifiedPost[]>();
  for (const p of posts) {
    const src = resolveSourceCategory(p);
    const bucket = buckets.get(src) || [];
    bucket.push(p);
    buckets.set(src, bucket);
  }

  const result: UnifiedPost[] = [];
  const sourceUsed = new Map<SourceCategory, number>();
  const overflow: UnifiedPost[] = [];
  let added = true;

  while (added) {
    added = false;
    for (const src of SOURCE_CATEGORY_ORDER) {
      const bucket = buckets.get(src);
      if (!bucket || bucket.length === 0) continue;
      const used = sourceUsed.get(src) ?? 0;
      if (used >= maxPerSource) continue;

      const post = bucket.shift()!;
      result.push(post);
      sourceUsed.set(src, used + 1);
      added = true;
    }
  }

  // Collect remaining overflow posts
  for (const [, bucket] of buckets) {
    overflow.push(...bucket);
  }

  return {
    posts: [...result, ...overflow],
    meta: { diverse: overflow.length === 0, sourceBreakdown, rearranged: true, maxPctPerSource },
  };
}

// ─── 7. Full quality pipeline orchestrator ────────────────────────

export interface QualityPipelineOptions {
  /** Minimum quality score (0-1). Default 0.3. Set to 0 to disable. */
  minQualityScore?: number;
  /** Whether to enforce engagement floor. Default true. */
  enforceEngagementFloor?: boolean;
  /** Age threshold for engagement floor in hours. Default 24. */
  engagementFloorAgeHours?: number;
  /** Prefer English content. Default true. */
  preferEnglish?: boolean;
  /** Whether to filter NSFW/spam content. Default true. */
  filterNsfwSpam?: boolean;
  /** Whether to deduplicate cross-protocol content. Default true. */
  crossProtocolDedup?: boolean;
  /** Freshness scoring config. Null = skip freshness scoring. */
  freshnessConfig?: FreshnessScoringConfig | null;
  /** Max percentage from any single source. Default 30. Set to 0 to disable. */
  maxPctPerSource?: number;
  /** Current time for age calculations */
  now?: number;
}

export interface QualityPipelineResult {
  posts: UnifiedPost[];
  meta: {
    quality: QualityGateResult;
    engagement: EngagementFloorResult;
    language: LanguageFilterResult;
    nsfw: NsfwFilterResult;
    dedup: CrossProtocolDedupResult;
    freshness: FreshnessScoringResult | null;
    diversity: SourceDiversityResult;
    inputCount: number;
    outputCount: number;
    totalFiltered: number;
  };
}

/**
 * Full quality pipeline. Order:
 * quality gate → engagement floor → language filter → NSFW/spam filter
 * → dedup → freshness → diversity → output.
 *
 * Each gate reports its metrics in the meta object for observability.
 */
export function applyQualityPipeline(
  posts: UnifiedPost[],
  opts: QualityPipelineOptions = {},
): QualityPipelineResult {
  const now = opts.now ?? Date.now();
  const inputCount = posts.length;
  let output = [...posts];

  // 1. Quality gate
  const quality = applyQualityGate(output, opts.minQualityScore ?? 0.3);
  output = quality.posts;

  // 2. Engagement floor
  const engagement =
    opts.enforceEngagementFloor !== false
      ? applyEngagementFloor(output, now, opts.engagementFloorAgeHours ?? 24)
      : {
          posts: output,
          meta: { promoted: output.length, deprioritized: 0, zeroEngagementOlder24h: 0 },
        };
  output = engagement.posts;

  // 3. Language filter
  const language = applyLanguageFilter(output, opts.preferEnglish ?? true);
  output = language.posts;

  // 3b. NSFW + spam filter (added v3.1 — content-based filtering)
  const nsfw =
    opts.filterNsfwSpam !== false
      ? applyNsfwSpamFilter(output)
      : {
          posts: output,
          meta: { passed: output.length, filtered: 0, nsfwFiltered: 0, spamFiltered: 0 },
        };
  output = nsfw.posts;

  // 4. Cross-protocol dedup
  const dedup =
    opts.crossProtocolDedup !== false
      ? applyCrossProtocolDedup(output)
      : {
          posts: output,
          meta: { remaining: output.length, deduped: 0, crossProtocol: 0, urlDedup: 0 },
        };
  output = dedup.posts;

  // 5. Freshness scoring
  let freshness: FreshnessScoringResult | null = null;
  if (opts.freshnessConfig !== null) {
    const config = opts.freshnessConfig ?? DEFAULT_FRESHNESS_CONFIG;
    const result = applyFreshnessScoring(output, now, config);
    freshness = result.meta;
    output = result.posts;
  }

  // 6. Source diversity
  const maxPct = opts.maxPctPerSource ?? 30;
  const diversity =
    maxPct > 0
      ? applySourceDiversity(output, maxPct)
      : {
          posts: output,
          meta: { diverse: true, sourceBreakdown: {}, rearranged: false, maxPctPerSource: 0 },
        };
  output = diversity.posts;

  const totalFiltered = inputCount - output.length;

  return {
    posts: output,
    meta: {
      quality: quality.meta,
      engagement: engagement.meta,
      language: language.meta,
      nsfw: nsfw.meta,
      dedup: dedup.meta,
      freshness,
      diversity: diversity.meta,
      inputCount,
      outputCount: output.length,
      totalFiltered,
    },
  };
}
