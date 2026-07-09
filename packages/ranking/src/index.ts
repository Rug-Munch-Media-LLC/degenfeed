/**
 * @degenfeed/ranking v2
 *
 * A transparent, configurable ranking engine for the unified web3 feed.
 * Each component is exposed for inspection in the UI.
 *
 * Score = recency × engagement × relevance × quality × diversity × source
 *
 * - recency: 12h half-life (younger = better)
 * - engagement: log(1 + likes + 2×reposts + 3×replies + 4×quotes) with
 *   velocity boost (recently-trending posts get a boost)
 * - relevance: keyword + niche overlap with viewer's preferences
 * - quality: source tier (must-read) + author follow boost
 * - diversity: penalize repeat authors (anti-feed-spam)
 * - source: protocol tier weight (Nostr > Threads, etc.)
 */
import { BOOST_TERMS, keywordRelevance, PLATFORM_TIER_WEIGHTS } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export const WEIGHTS = {
  w1: 1.0,
  w2: 1.5,
  w3: 0.8,
  w4: 2.0,
  w5: 1.2,
  w6: 3.0,
  w7: 1.0,
  w8: 0.5,
  w9: 0.5,
  diversityPenalty: 1.5,
} as const;

export const WEIGHTS_V2 = {
  recency: 2.4,
  engagement: 3.5,
  relevance: 1.8,
  quality: 1.4,
  diversity: 1.0,
  source: 0.8,
  velocity: 1.2,
} as const;

export const RECENCY_HALF_LIFE_HOURS = 12;
export const VELOCITY_WINDOW_HOURS = 4;
export const PLATFORM_TIER: Record<Protocol, number> = {
  nostr: 1,
  farcaster: 1,
  lens: 1,
  bluesky: 1,
  mastodon: 1,
  threads: 0.7,
  reddit: 0.8,
  rss: 0.8,
  ponder: 0.8,
  ethereum: 0.6,
  solana: 0.6,
};

export interface UserAlgorithmPreferences {
  preferredNiches: string[];
  preferredPlatforms: Protocol[];
  recencyWeight: number;
  engagementWeight: number;
  diversityBoost: boolean;
  /** Author ids the viewer has recently engaged with — boost these */
  followed?: string[];
  /** Niche black-list (e.g. viewer hid memecoins) */
  mutedNiches?: string[];
}

export interface RankingContext {
  viewer: UnifiedIdentity | null;
  /** authorId -> count of recent posts already in the result window */
  recentAuthors: Map<string, number>;
  /** authorId or sourceName -> 0..2 quality score */
  sourceQuality: Map<string, number>;
  /** Set of authorIds the viewer follows */
  followed: Set<string>;
  /** Set of niches the viewer has interacted with */
  viewerNiches: Set<string>;
  /** When we're ranking */
  now: number;
  /** User's saved preferences */
  preferences?: UserAlgorithmPreferences | null;
  /** Previous engagement snapshot per post for velocity calculation */
  previousEngagement?: Map<string, { likes: number; reposts: number; replies: number; at: number }>;
}

export interface ScoreBreakdown {
  recency: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  source: number;
  velocity: number;
  total: number;
  reasons: string[];
}

export function recencyDecay(createdAt: number, now: number, halfLifeHours: number): number {
  const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return 0.5 ** (ageHours / halfLifeHours);
}

export function normalizeEngagement(post: UnifiedPost): number {
  const m = post.metrics;
  const raw = m.likes + m.reposts * 2 + m.replies * 3 + m.quotes * 4;
  return Math.log(1 + raw);
}

export function engagementVelocity(
  post: UnifiedPost,
  prev: { likes: number; reposts: number; replies: number; at: number } | undefined,
  now: number,
): number {
  if (!prev) return 1;
  const ageHrs = Math.max(0.1, (now - prev.at) / 3600000);
  const dLikes = Math.max(0, post.metrics.likes - prev.likes);
  const dReposts = Math.max(0, post.metrics.reposts - prev.reposts);
  const dReplies = Math.max(0, post.metrics.replies - prev.replies);
  const delta = dLikes + dReposts * 2 + dReplies * 3;
  // Velocity in events per hour, normalized
  const velocity = delta / ageHrs;
  return 1 + Math.min(velocity / 5, 2);
}

export function sourceWeight(protocol: Protocol): number {
  return PLATFORM_TIER_WEIGHTS[protocol] ?? 0.5;
}

export function qualityBoost(
  post: UnifiedPost,
  sourceQuality: Map<string, number>,
  followed: Set<string>,
): number {
  let boost = sourceQuality.get(post.author.id) ?? sourceQuality.get(post.author.displayName) ?? 0;
  if (followed.has(post.author.id)) boost += 1.2;
  return boost;
}

export function nicheRelevance(
  post: UnifiedPost,
  viewerNiches: Set<string>,
  prefs?: UserAlgorithmPreferences | null,
): number {
  const preferred = new Set<string>(prefs?.preferredNiches ?? []);
  const muted = new Set<string>(prefs?.mutedNiches ?? []);
  const all = new Set([...viewerNiches, ...preferred]);
  let matches = 0;
  let mutedHits = 0;
  for (const n of post.niches) {
    if (muted.has(n)) mutedHits++;
    if (all.has(n)) matches++;
  }
  if (mutedHits > 0 && matches === 0) return 0.3; // heavy penalty
  if (matches === 0) return 1;
  return 1 + matches * 0.25;
}

export function platformRelevance(
  post: UnifiedPost,
  prefs?: UserAlgorithmPreferences | null,
): number {
  if (!prefs?.preferredPlatforms?.length) return 1;
  if (prefs.preferredPlatforms.includes(post.protocol)) return 1.4;
  return 0.85;
}

export function scoreBreakdownV2(post: UnifiedPost, ctx: RankingContext): ScoreBreakdown {
  const prefs = ctx.preferences;
  const reasons: string[] = [];
  const muted = new Set(prefs?.mutedNiches ?? []);
  const isMuted = post.niches.some((n) => muted.has(n));
  if (isMuted) reasons.push('muted-niche');

  const recency = recencyDecay(post.createdAt, ctx.now, RECENCY_HALF_LIFE_HOURS);
  if (recency > 0.8) reasons.push('fresh');
  else if (recency < 0.2) reasons.push('aging');

  const engagement = normalizeEngagement(post);
  if (engagement > 3) reasons.push('viral');

  const relevance =
    keywordRelevance(post.text) *
    nicheRelevance(post, ctx.viewerNiches, prefs) *
    platformRelevance(post, prefs);
  if (relevance > 1.5) reasons.push('on-topic');

  const quality = qualityBoost(post, ctx.sourceQuality, ctx.followed);
  if (quality > 1) reasons.push('followed-or-high-quality');

  const diversityHit = ctx.recentAuthors.get(post.author.id) ?? 0;
  const diversity = prefs?.diversityBoost === false ? 0 : Math.max(-1.2, -diversityHit * 0.4);
  if (diversity < 0) reasons.push('author-diversity');

  const source = sourceWeight(post.protocol);
  const prev = ctx.previousEngagement?.get(post.id);
  const velocity = engagementVelocity(post, prev, ctx.now);
  if (velocity > 1.3) reasons.push('trending-now');

  const rw = prefs?.recencyWeight ?? 1;
  const ew = prefs?.engagementWeight ?? 1;
  const total =
    recency * rw * WEIGHTS_V2.recency +
    engagement * ew * WEIGHTS_V2.engagement +
    relevance * WEIGHTS_V2.relevance +
    quality * WEIGHTS_V2.quality +
    diversity * WEIGHTS_V2.diversity +
    source * WEIGHTS_V2.source +
    velocity * WEIGHTS_V2.velocity;

  if (isMuted) reasons.unshift('muted-penalty');

  return { recency, engagement, relevance, quality, diversity, source, velocity, total, reasons };
}

export function scoreV2(post: UnifiedPost, ctx: RankingContext): number {
  return scoreBreakdownV2(post, ctx).total;
}

export function rankV2(posts: UnifiedPost[], ctx: RankingContext): UnifiedPost[] {
  // Single pass: score + count authors in parallel
  const scored = posts.map((p) => {
    const breakdown = scoreBreakdownV2(p, ctx);
    return { p, s: breakdown.total };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.p);
}

/**
 * Anti-cluster ranker: greedy selection that minimizes duplicate authors
 * and surfaces under-represented protocols.
 */
export function rankDiverse(
  posts: UnifiedPost[],
  ctx: RankingContext,
  opts: { maxPerAuthor?: number; perProtocolMin?: Partial<Record<Protocol, number>> } = {},
): UnifiedPost[] {
  const maxPerAuthor = opts.maxPerAuthor ?? 3;
  const perProtocolMin = opts.perProtocolMin ?? {};
  const byProtocol: Record<string, UnifiedPost[]> = {};
  const byAuthor = new Map<string, number>();
  const selected: UnifiedPost[] = [];

  const scored = posts
    .map((p) => ({ p, s: scoreBreakdownV2(p, ctx).total }))
    .sort((a, b) => b.s - a.s);

  // First pass: honor per-protocol minimums
  for (const { p } of scored) {
    const min = perProtocolMin[p.protocol] ?? 0;
    if (min > 0) {
      const cur = (byProtocol[p.protocol] ?? []).length;
      if (cur < min) {
        const cnt = byAuthor.get(p.author.id) ?? 0;
        if (cnt < maxPerAuthor) {
          selected.push(p);
          byAuthor.set(p.author.id, cnt + 1);
          byProtocol[p.protocol] = [...(byProtocol[p.protocol] ?? []), p];
        }
      }
    }
  }

  // Second pass: greedy best-score with per-author cap
  for (const { p } of scored) {
    if (selected.includes(p)) continue;
    const cnt = byAuthor.get(p.author.id) ?? 0;
    if (cnt >= maxPerAuthor) continue;
    selected.push(p);
    byAuthor.set(p.author.id, cnt + 1);
  }

  return selected;
}

// ─── Trending topics (kept from v1, hardened) ───────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
}

export function extractTickers(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\$[A-Z]{2,5}\b/g)).map((m) => m[1]))).filter(
    (t): t is string => typeof t === 'string',
  );
}

export function extractHashtags(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/#[a-zA-Z0-9_]+/g)).map((m) => m[0]))).filter(
    (h): h is string => typeof h === 'string',
  );
}

export function computeTrendingTopics(
  posts: UnifiedPost[],
  now: number,
  limit = 12,
): TrendingTopic[] {
  const counts = new Map<string, { count: number; score: number }>();
  const cutoff = now - 24 * 60 * 60 * 1000;

  for (const post of posts) {
    if (post.createdAt < cutoff) continue;
    const text = `${post.text} ${post.author.displayName}`.toLowerCase();
    for (const niche of post.niches) {
      const cur = counts.get(niche) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 1;
      counts.set(niche, cur);
    }
    for (const term of BOOST_TERMS) {
      if (text.includes(term)) {
        const cur = counts.get(term) ?? { count: 0, score: 0 };
        cur.count++;
        cur.score += 0.5;
        counts.set(term, cur);
      }
    }
    for (const t of extractTickers(text)) {
      const cur = counts.get(`$${t}`) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 2;
      counts.set(`$${t}`, cur);
    }
    for (const h of extractHashtags(text)) {
      const cur = counts.get(h) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 1.5;
      counts.set(h, cur);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([topic, v]) => ({ topic, count: v.count, score: v.score }));
}

// ─── Backwards-compatible v1 exports ─────────────────────────────
// Old call sites still get a working `rank()` and `score()`.

export function score(post: UnifiedPost, ctx: RankingContext): number {
  return scoreV2(post, ctx);
}

export function rank(posts: UnifiedPost[], ctx: RankingContext): UnifiedPost[] {
  return rankV2(posts, ctx);
}
