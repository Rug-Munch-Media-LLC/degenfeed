/**
 * @degenfeed/web — Client-side feed control ranking
 *
 * User-controllable sort / filter / rank for the unified feed. The bridge
 * returns a deduplicated, mostly-unsorted mix of posts — these pure functions
 * give the user deterministic control over ordering and mix, so the feed is
 * never a black box.
 *
 * The same preferences are forwarded to the bridge feed endpoint
 * (?sort=, ?protocols=, ?time=, ?contentType=, ?niches=, ?recencyQuality= …)
 * so ranking can move server-side without changing the client contract.
 */

import { interleaveProtocols, type ScoredItem } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────────

export type FeedSort = 'latest' | 'trending' | 'quality' | 'zapped' | 'engaged';
export type FeedContentType = 'posts' | 'media' | 'links' | 'longform' | 'polls';
export type FeedTimeRange = '1h' | '24h' | '7d' | 'all';

export interface FeedAlgorithmPrefs {
  /** 0 = pure recency … 100 = pure quality */
  recencyQuality: number;
  /** 0 = pure engagement … 100 = pure diversity */
  engagementDiversity: number;
  /** 0 = no mixing enforcement … 100 = strict protocol interleave */
  protocolDiversity: number;
  /** 0 = familiar (boost your bubble) … 100 = discover (serendipity ~20%) */
  familiarDiscover: number;
  /** 0 = indie/small creators … 100 = big accounts with large followings */
  creatorSize: number;
}

export interface FeedControls {
  /** Primary ordering signal */
  sort: FeedSort;
  /** Empty array = all protocols */
  protocols: string[];
  /** Empty array = all content types */
  contentTypes: FeedContentType[];
  /** Post age window */
  timeRange: FeedTimeRange;
  /** Empty array = all niches */
  niches: string[];
  /** "My Algorithm" slider weights */
  algorithm: FeedAlgorithmPrefs;
}

// ─── Defaults ───────────────────────────────────────────────────────────

export const DEFAULT_ALGORITHM: FeedAlgorithmPrefs = {
  recencyQuality: 50,
  engagementDiversity: 50,
  protocolDiversity: 50,
  familiarDiscover: 50,
  creatorSize: 50,
};

export const DEFAULT_FEED_CONTROLS: FeedControls = {
  sort: 'latest',
  protocols: [],
  contentTypes: [],
  timeRange: '24h',
  niches: [],
  algorithm: DEFAULT_ALGORITHM,
};

// ─── Labels (single source of truth for the UI) ────────────────────────

export const SORT_LABELS: Record<FeedSort, { label: string; icon: string; hint: string }> = {
  latest: { label: 'Latest', icon: '⏱', hint: 'Newest posts first' },
  trending: { label: 'Trending', icon: '🔥', hint: 'Fast-moving engagement' },
  quality: { label: 'Quality', icon: '💎', hint: 'Highest signal content' },
  zapped: { label: 'Most Zapped', icon: '⚡', hint: 'Most tips / zaps received' },
  engaged: { label: 'Most Engaged', icon: '💬', hint: 'Most likes, reposts & replies' },
};

export const CONTENT_TYPE_LABELS: Record<FeedContentType, { label: string; icon: string }> = {
  posts: { label: 'Posts', icon: '📝' },
  media: { label: 'Media', icon: '🎬' },
  links: { label: 'Links', icon: '🔗' },
  longform: { label: 'Long-form', icon: '📖' },
  polls: { label: 'Polls', icon: '🗳' },
};

export const TIME_RANGE_LABELS: Record<FeedTimeRange, string> = {
  '1h': 'Last hour',
  '24h': 'Today',
  '7d': 'This week',
  all: 'All time',
};

// ─── Helpers ────────────────────────────────────────────────────────────

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const clampNum = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

export function timeCutoffMs(timeRange: FeedTimeRange, now = Date.now()): number {
  switch (timeRange) {
    case '1h':
      return now - 60 * 60 * 1000;
    case '24h':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

function postHasMedia(post: UnifiedPost): boolean {
  if (post.contentType === 'video' || post.contentType === 'image') return true;
  return post.embeds.some((e) => e.kind === 'image' || e.kind === 'video');
}

function postHasLink(post: UnifiedPost): boolean {
  if (post.contentType === 'link') return true;
  return post.embeds.some((e) => e.kind === 'link');
}

function postIsLongForm(post: UnifiedPost): boolean {
  if (post.contentType === 'article' || post.contentType === 'thread') return true;
  return (post.text ?? '').trim().length > 400;
}

/** Polls are protocol-native — check raw payload + embeds conservatively. */
function postIsPoll(post: UnifiedPost): boolean {
  const raw = post.raw as { poll?: unknown; options?: unknown } | null;
  return Boolean(raw && (raw.poll !== undefined || raw.options !== undefined));
}

function postMatchesContentType(post: UnifiedPost, type: FeedContentType): boolean {
  switch (type) {
    case 'posts':
      return (
        !postHasMedia(post) && !postHasLink(post) && !postIsLongForm(post) && !postIsPoll(post)
      );
    case 'media':
      return postHasMedia(post);
    case 'links':
      return postHasLink(post);
    case 'longform':
      return postIsLongForm(post);
    case 'polls':
      return postIsPoll(post);
  }
}

// ─── Filtering ──────────────────────────────────────────────────────────

export function filterFeed(
  posts: UnifiedPost[],
  controls: FeedControls,
  now = Date.now(),
): UnifiedPost[] {
  const cutoff = timeCutoffMs(controls.timeRange, now);
  const typeSet = new Set(controls.contentTypes);
  const nicheSet = new Set(controls.niches);
  const protoSet = new Set(controls.protocols);

  return posts.filter((p) => {
    if (protoSet.size > 0 && !protoSet.has(p.protocol)) return false;
    if (cutoff > 0 && p.createdAt < cutoff) return false;
    if (typeSet.size > 0 && ![...typeSet].some((t) => postMatchesContentType(p, t))) return false;
    if (nicheSet.size > 0 && !p.niches.some((n) => nicheSet.has(n))) return false;
    return true;
  });
}

// ─── Ranking signals ────────────────────────────────────────────────────

/** Quality ratio 0-1 — prefer server-computed signals, fall back to heuristics. */
function qualityRatio(post: UnifiedPost): number {
  if (post.qualityScore?.ratio !== undefined) return clamp01(post.qualityScore.ratio);
  const debug = post.feedDebug?.qualityScore;
  if (debug !== undefined) return clamp01(debug);
  const spam = (post as unknown as { spamScore?: number }).spamScore ?? 0;
  const len = (post.text ?? '').trim().length;
  return clamp01((1 - spam) * 0.6 + Math.min(len / 400, 1) * 0.4);
}

/** Exponential decay matching feed-core's 12h half-life. */
function recencyNorm(post: UnifiedPost, now: number): number {
  const ageHours = Math.max(0, (now - post.createdAt) / (1000 * 60 * 60));
  return 0.5 ** (ageHours / 12);
}

/** Log-scaled engagement normalized to 0-1 (mirrors unified-scorer). */
function engagementNorm(post: UnifiedPost): number {
  const m = post.metrics;
  const raw = m.likes + m.reposts * 2 + m.replies * 3 + (m.quotes ?? 0) * 4 + (m.views ?? 0) / 10;
  const log = Math.log(1 + raw);
  return clamp01(log / Math.log(1 + 10_000));
}

/** Zaps/tips are the on-protocol "value" signal (Nostr zaps, tips). */
function zappedScore(post: UnifiedPost): number {
  const tips = post.tipCount ?? 0;
  const views = post.metrics.views ?? 0;
  return tips * 10 + views;
}

/** Trending = engagement velocity × engagement, decayed by age. */
function trendingScore(post: UnifiedPost, now: number): number {
  const velocity = post.feedDebug?.velocity ?? 1;
  const eng = engagementNorm(post);
  const ageMin = Math.max(0, (now - post.createdAt) / 60000);
  const recency = Math.max(0.1, 1 / (1 + ageMin / 60));
  return (0.6 * eng + 0.4 * velocity) * (0.5 + 0.5 * recency);
}

function diversityNorm(
  posts: UnifiedPost[],
  authorCounts: Map<string, number>,
): Map<string, number> {
  const norm = new Map<string, number>();
  for (const p of posts) {
    const count = authorCounts.get(p.author.id) ?? 1;
    norm.set(p.id, clamp01(1 / (1 + Math.log(count))));
  }
  return norm;
}

// ─── Sorting ────────────────────────────────────────────────────────────

function baseScore(post: UnifiedPost, sort: FeedSort, now: number): number {
  switch (sort) {
    case 'latest':
      return post.createdAt;
    case 'trending':
      return trendingScore(post, now);
    case 'quality':
      return qualityRatio(post);
    case 'zapped':
      return zappedScore(post);
    case 'engaged':
      return engagementNorm(post);
  }
}

/** Stable sort by score descending — base signal for the selected mode. */
export function sortFeed(posts: UnifiedPost[], sort: FeedSort, now = Date.now()): UnifiedPost[] {
  return posts
    .map((p, i) => ({ p, i, s: baseScore(p, sort, now) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}

// ─── "My Algorithm" blend ───────────────────────────────────────────────

/**
 * Apply user slider weights on top of the base sort.
 * - recencyQuality: blends recency ↔ quality for trending/quality sorts.
 * - engagementDiversity: blends engagement ↔ author diversity for
 *   trending/engaged sorts.
 * - protocolDiversity: enforces protocol interleaving (network mixing).
 * Chronological ("latest") is explicit — sliders do not distort it.
 */
export function blendAlgorithm(
  posts: UnifiedPost[],
  sort: FeedSort,
  algo: FeedAlgorithmPrefs,
  now = Date.now(),
): UnifiedPost[] {
  if (posts.length <= 1) return posts;
  const { recencyQuality: rq, engagementDiversity: ed, protocolDiversity: pd } = algo;
  const wQ = clamp01(rq / 100);
  const wD = clamp01(ed / 100);

  const authorCounts = new Map<string, number>();
  for (const p of posts) authorCounts.set(p.author.id, (authorCounts.get(p.author.id) ?? 0) + 1);
  const divNorm = diversityNorm(posts, authorCounts);

  const scored = posts.map((p) => {
    let score = baseScore(p, sort, now);
    if (sort === 'trending' || sort === 'quality') {
      const recency = recencyNorm(p, now);
      const quality = qualityRatio(p);
      // rq=0 → pure recency, rq=100 → pure quality
      score =
        wQ * quality + (1 - wQ) * (sort === 'quality' ? recency : 0.5 * recency + 0.5 * score);
    }
    if (sort === 'trending' || sort === 'engaged') {
      // ed=0 → pure engagement, ed=100 → pure diversity
      const eng = sort === 'engaged' ? score : engagementNorm(p);
      score = (1 - wD) * eng + wD * (divNorm.get(p.id) ?? 0.5);
    }
    return { p, score };
  });

  let ranked = scored.sort((a, b) => b.score - a.score).map((x) => x.p);

  // Protocol mixing enforcement — reuse feed-core interleaving.
  if (pd > 40 && sort !== 'latest') {
    const maxConsecutive = pd >= 80 ? 1 : pd >= 60 ? 2 : 3;
    const items: ScoredItem[] = ranked.map((p, i) => ({ post: p, score: posts.length - i }));
    ranked = interleaveProtocols(items, maxConsecutive).map((x) => x.post);
  }

  return ranked;
}

// ─── Combined pipeline ──────────────────────────────────────────────────

export function applyFeedControls(
  posts: UnifiedPost[],
  controls: FeedControls,
  now = Date.now(),
): UnifiedPost[] {
  const filtered = filterFeed(posts, controls, now);
  const sorted = sortFeed(filtered, controls.sort, now);
  return blendAlgorithm(sorted, controls.sort, controls.algorithm, now);
}

// ─── URL serialization (shared with useFeedControls) ────────────────────

export function serializeControls(controls: FeedControls): Record<string, string> {
  const params: Record<string, string> = {};
  if (controls.sort !== DEFAULT_FEED_CONTROLS.sort) params.sort = controls.sort;
  if (controls.protocols.length > 0) params.protocols = controls.protocols.join(',');
  if (controls.contentTypes.length > 0) params.types = controls.contentTypes.join(',');
  if (controls.timeRange !== DEFAULT_FEED_CONTROLS.timeRange) params.time = controls.timeRange;
  if (controls.niches.length > 0) params.niches = controls.niches.join(',');
  const a = controls.algorithm;
  if (
    a.recencyQuality !== 50 ||
    a.engagementDiversity !== 50 ||
    a.protocolDiversity !== 50 ||
    a.familiarDiscover !== 50 ||
    a.creatorSize !== 50
  ) {
    params.algo = `${a.recencyQuality},${a.engagementDiversity},${a.protocolDiversity},${a.familiarDiscover},${a.creatorSize}`;
  }
  return params;
}

export function parseControlsFromParams(params: URLSearchParams): Partial<FeedControls> | null {
  const has = ['sort', 'protocols', 'types', 'time', 'niches', 'algo'].some((k) => params.has(k));
  if (!has) return null;

  const patch: Partial<FeedControls> = {};
  const sort = params.get('sort');
  if (sort && sort in SORT_LABELS) patch.sort = sort as FeedSort;
  const protocols = params.get('protocols');
  if (protocols)
    patch.protocols = protocols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const types = params.get('types');
  if (types) {
    const valid = types
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as FeedContentType[];
    patch.contentTypes = valid.filter((t) => t in CONTENT_TYPE_LABELS);
  }
  const time = params.get('time');
  if (time && time in TIME_RANGE_LABELS) patch.timeRange = time as FeedTimeRange;
  const niches = params.get('niches');
  if (niches)
    patch.niches = niches
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const algo = params.get('algo');
  if (algo) {
    const parts = algo.split(',').map(Number);
    patch.algorithm = {
      recencyQuality: clampNum(parts[0] ?? 50, 0, 100),
      engagementDiversity: clampNum(parts[1] ?? 50, 0, 100),
      protocolDiversity: clampNum(parts[2] ?? 50, 0, 100),
      familiarDiscover: clampNum(parts[3] ?? 50, 0, 100),
      creatorSize: clampNum(parts[4] ?? 50, 0, 100),
    };
  }
  return patch;
}
