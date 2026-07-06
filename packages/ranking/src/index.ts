import { BOOST_TERMS, PLATFORM_TIER_WEIGHTS, keywordRelevance } from '@degenfeed/feed-core';
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

export const RECENCY_HALF_LIFE_HOURS = 12;
export const PLATFORM_TIER: Record<Protocol, number> = {
  nostr: 1,
  farcaster: 1,
  lens: 1,
  bluesky: 1,
  mastodon: 1,
  threads: 3,
  rss: 2,
  ethereum: 2,
  solana: 2,
};

export interface UserAlgorithmPreferences {
  preferredNiches: string[];
  preferredPlatforms: Protocol[];
  recencyWeight: number;
  engagementWeight: number;
  diversityBoost: boolean;
}

export interface RankingContext {
  viewer: UnifiedIdentity | null;
  recentAuthors: Map<string, number>;
  sourceQuality: Map<string, number>;
  viewerNiches: Set<string>;
  followed: Set<string>;
  now: number;
  preferences?: UserAlgorithmPreferences | null;
}

export interface ScoreBreakdown {
  recency: number;
  platform: number;
  engagement: number;
  relevance: number;
  quality: number;
  diversity: number;
  total: number;
}

export function recencyDecay(createdAt: number, now: number, halfLifeHours: number): number {
  const ageHours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
  return 0.5 ** (ageHours / halfLifeHours);
}

function normalizeEngagement(post: UnifiedPost): number {
  const m = post.metrics;
  const raw = m.likes + m.reposts * 2 + m.replies * 3 + m.quotes * 4;
  return Math.log(1 + raw);
}

function platformWeight(protocol: Protocol): number {
  return PLATFORM_TIER_WEIGHTS[protocol] ?? 0.5;
}

function sourceQualityBoost(
  post: UnifiedPost,
  sourceQuality: Map<string, number>,
  followed: Set<string>,
): number {
  let boost = sourceQuality.get(post.author.id) ?? 0;
  if (followed.has(post.author.id)) boost += 1;
  return boost;
}

function nicheRelevance(
  post: UnifiedPost,
  viewerNiches: Set<string>,
  prefs?: UserAlgorithmPreferences | null,
): number {
  const preferred = new Set<string>(prefs?.preferredNiches ?? []);
  const all = new Set([...viewerNiches, ...preferred]);
  const matches = post.niches.filter((n) => all.has(n)).length;
  return matches > 0 ? 1 + matches * 0.2 : 1;
}

export function scoreBreakdown(post: UnifiedPost, ctx: RankingContext): ScoreBreakdown {
  const prefs = ctx.preferences;
  const recency = recencyDecay(post.createdAt, ctx.now, RECENCY_HALF_LIFE_HOURS);
  const platform = platformWeight(post.protocol);
  const engagement = normalizeEngagement(post);
  const relevance = keywordRelevance(post.text) * nicheRelevance(post, ctx.viewerNiches, prefs);
  const quality = sourceQualityBoost(post, ctx.sourceQuality, ctx.followed);
  const diversityHit = ctx.recentAuthors.get(post.author.id) ?? 0;
  const diversity = prefs?.diversityBoost === false ? 0 : -diversityHit;

  const rw = prefs?.recencyWeight ?? 1;
  const ew = prefs?.engagementWeight ?? 1;
  const total =
    recency * rw * 2 +
    platform * 1.5 +
    engagement * ew * 2 +
    relevance * 1.5 +
    quality * 1.2 +
    diversity;

  return {
    recency,
    platform,
    engagement,
    relevance,
    quality,
    diversity,
    total,
  };
}

export function score(post: UnifiedPost, ctx: RankingContext): number {
  return scoreBreakdown(post, ctx).total;
}

export function rank(posts: UnifiedPost[], ctx: RankingContext): UnifiedPost[] {
  const scored = posts.map((p) => ({ p, s: score(p, ctx) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.p);
}

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
    const tickers = extractTickers(text);
    for (const t of tickers) {
      const cur = counts.get(`$${t}`) ?? { count: 0, score: 0 };
      cur.count++;
      cur.score += 2;
      counts.set(`$${t}`, cur);
    }
    const hashtags = extractHashtags(text);
    for (const h of hashtags) {
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
