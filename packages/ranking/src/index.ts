/**
 * v1 ranking weights. Documented, versioned, user-overridable in 1.1.
 * Higher = more influence on score. All positive except diversity_penalty
 * which subtracts to avoid same-author dominance.
 */
export const WEIGHTS = {
  w1: 1.0, // log(1 + likes)
  w2: 1.5, // log(1 + reposts) — reposts signal stronger endorsement
  w3: 0.8, // log(1 + replies) — replies are noisier
  w4: 2.0, // engagement rate (likes/views)
  w5: 1.2, // recency decay
  w6: 3.0, // follow boost
  w7: 1.0, // niche match
  w8: 0.5, // source quality (curated accounts)
  w9: 0.5, // reply-to-author ratio penalty (conversation dominance)
  diversityPenalty: 1.5, // per repeat author in recent feed
} as const;

export const RECENCY_HALF_LIFE_HOURS = 12;

import type { UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export interface RankingContext {
  viewer: UnifiedIdentity | null;
  /** Authors already shown in the recent feed, with count */
  recentAuthors: Map<string, number>;
  /** Curated source boost (0 for non-curated, +1 for curated) */
  sourceQuality: Map<string, number>;
  /** Viewer's declared interests (niches) */
  viewerNiches: Set<string>;
  /** Followed identity ids */
  followed: Set<string>;
  /** Now in unix ms, injectable for tests */
  now: number;
}

/** Half-life decay: 1.0 at age=0, 0.5 at age=halfLife, 0.25 at age=2*halfLife. */
export function recencyDecay(createdAt: number, now: number, halfLifeHours: number): number {
  const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return Math.pow(0.5, ageHours / halfLifeHours);
}

export function score(post: UnifiedPost, ctx: RankingContext): number {
  const w = WEIGHTS;
  const m = post.metrics;
  const likes = Math.log(1 + m.likes);
  const reposts = Math.log(1 + m.reposts);
  const replies = Math.log(1 + m.replies);
  const engagementRate = m.views && m.views > 0 ? m.likes / m.views : 0;
  const recency = recencyDecay(post.createdAt, ctx.now, RECENCY_HALF_LIFE_HOURS);
  const followBoost = ctx.followed.has(post.author.id) ? 1 : 0;
  const nicheMatch = post.niches.some((n) => ctx.viewerNiches.has(n)) ? 1 : 0;
  const sourceQuality = ctx.sourceQuality.get(post.author.id) ?? 0;
  const replyPenalty = m.replies > 0 && m.likes > 0 ? m.replies / (m.replies + m.likes) : 0;
  const diversityHit = ctx.recentAuthors.get(post.author.id) ?? 0;

  return (
    w.w1 * likes +
    w.w2 * reposts +
    w.w3 * replies +
    w.w4 * engagementRate +
    w.w5 * recency +
    w.w6 * followBoost +
    w.w7 * nicheMatch +
    w.w8 * sourceQuality -
    w.w9 * replyPenalty -
    w.diversityPenalty * diversityHit
  );
}

export function rank(posts: UnifiedPost[], ctx: RankingContext): UnifiedPost[] {
  const scored = posts.map((p) => ({ p, s: score(p, ctx) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.p);
}