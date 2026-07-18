/**
 * engagement-predictor — Predicts post engagement for ranking boost.
 *
 * Factors:
 * - Author's average engagement rate
 * - Topic's current trending status
 * - Time of day (morning posts get more engagement)
 * - Post type (images 2x, videos 3x engagement)
 */

import type { UnifiedPost } from '@degenfeed/types';

export interface AuthorEngagementStats {
  totalPosts: number;
  avgLikes: number;
  avgReposts: number;
  avgReplies: number;
  avgEngagement: number;
}

export interface EngagementPredictionInput {
  post: UnifiedPost;
  authorStats?: AuthorEngagementStats;
  trendingTopics: Set<string>;
  now: number;
}

export interface EngagementPredictionOutput {
  predictedEngagement: number;
  boost: number;
  factors: string[];
  confidence: number;
}

const MORNING_START = 6;
const MORNING_END = 10;
const AFTERNOON_START = 12;
const AFTERNOON_END = 17;
const EVENING_START = 18;
const EVENING_END = 22;

function getContentTypeMultiplier(post: UnifiedPost): number {
  const type = post.contentType ?? 'text';
  switch (type) {
    case 'video':
      return 3.0;
    case 'image':
      return 2.0;
    case 'thread':
      return 1.5;
    case 'link':
      return 0.8;
    default:
      return 1.0;
  }
}

function getTimeOfDayMultiplier(post: UnifiedPost, _now: number): number {
  const postHour = new Date(post.createdAt).getHours();
  const postDay = new Date(post.createdAt).getDay(); // 0=Sun

  // Weekend engagement is higher
  const isWeekend = postDay === 0 || postDay === 6;

  // Morning posts get more engagement
  if (postHour >= MORNING_START && postHour < MORNING_END) {
    return isWeekend ? 2.0 : 1.8;
  }

  // Lunchtime bump
  if (postHour >= AFTERNOON_START && postHour < AFTERNOON_END) {
    return isWeekend ? 1.5 : 1.2;
  }

  // Evening prime time
  if (postHour >= EVENING_START && postHour < EVENING_END) {
    return isWeekend ? 2.2 : 1.6;
  }

  // Late night — lower engagement
  return isWeekend ? 1.2 : 0.7;
}

function getAuthorBoost(authorStats?: AuthorEngagementStats): number {
  if (!authorStats || authorStats.totalPosts < 3) return 1.0;

  // Normalize: average engagement of 10+ is "viral", 5-10 is "strong", <2 is "weak"
  if (authorStats.avgEngagement > 15) return 2.5;
  if (authorStats.avgEngagement > 10) return 2.0;
  if (authorStats.avgEngagement > 5) return 1.5;
  if (authorStats.avgEngagement > 2) return 1.1;
  if (authorStats.avgEngagement < 0.5) return 0.7;
  return 1.0;
}

function getTrendingBoost(post: UnifiedPost, trendingTopics: Set<string>): number {
  if (trendingTopics.size === 0) return 1.0;

  const nicheMatches = post.niches.filter((n) => trendingTopics.has(n.toLowerCase()));
  if (nicheMatches.length >= 2) return 2.0;
  if (nicheMatches.length === 1) return 1.6;

  // Check if any niche is partially in trending
  for (const niche of post.niches) {
    for (const trending of trendingTopics) {
      if (niche.toLowerCase().includes(trending) || trending.includes(niche.toLowerCase())) {
        return 1.3;
      }
    }
  }

  return 1.0;
}

export function predictEngagementBoost(
  input: EngagementPredictionInput,
): EngagementPredictionOutput {
  const { post, authorStats, trendingTopics, now } = input;
  const factors: string[] = [];

  const contentTypeBoost = getContentTypeMultiplier(post);
  if (contentTypeBoost > 1.0) {
    factors.push(`content-type:${post.contentType ?? 'text'}=${contentTypeBoost}x`);
  }

  const timeBoost = getTimeOfDayMultiplier(post, now);
  if (timeBoost > 1.2) {
    const postHour = new Date(post.createdAt).getHours();
    factors.push(`time-of-day:${postHour}h=${timeBoost}x`);
  }

  const authorBoost = getAuthorBoost(authorStats);
  if (authorBoost > 1.2) {
    factors.push(`author-engagement=${authorBoost}x`);
  }

  const trendingBoost = getTrendingBoost(post, trendingTopics);
  if (trendingBoost > 1.0) {
    factors.push(`trending-topic=${trendingBoost}x`);
  }

  const followingCount = post.author.followerCount ?? 0;
  let followerBoost = 1.0;
  if (followingCount > 100000) followerBoost = 1.5;
  else if (followingCount > 10000) followerBoost = 1.3;
  else if (followingCount > 1000) followerBoost = 1.1;
  if (followerBoost > 1.0) factors.push(`followers=${followerBoost}x`);

  const recencyHours = (now - post.createdAt) / 3600000;
  let recencyBoost = 1.0;
  if (recencyHours < 1) recencyBoost = 3.0;
  else if (recencyHours < 3) recencyBoost = 2.0;
  else if (recencyHours < 6) recencyBoost = 1.5;
  else if (recencyHours < 24) recencyBoost = 1.2;
  else recencyBoost = 0.8;
  if (recencyBoost !== 1.0) factors.push(`recency=${recencyBoost}x`);

  const totalMultiplier =
    contentTypeBoost * timeBoost * authorBoost * trendingBoost * followerBoost * recencyBoost;

  const baseEngagement =
    (post.metrics.likes ?? 0) + (post.metrics.reposts ?? 0) * 2 + (post.metrics.replies ?? 0) * 3;

  const predictedEngagement = baseEngagement * totalMultiplier;

  const confidence = Math.min(1.0, 0.3 + factors.length * 0.15);

  return {
    predictedEngagement,
    boost: totalMultiplier,
    factors,
    confidence,
  };
}

export function computeAuthorStats(
  posts: UnifiedPost[],
  targetAuthorId: string,
): AuthorEngagementStats {
  const authorPosts = posts.filter((p) => p.author.id === targetAuthorId);
  if (authorPosts.length === 0) {
    return {
      totalPosts: 0,
      avgLikes: 0,
      avgReposts: 0,
      avgReplies: 0,
      avgEngagement: 0,
    };
  }

  const total = authorPosts.length;
  const avgLikes = authorPosts.reduce((sum, p) => sum + (p.metrics.likes ?? 0), 0) / total;
  const avgReposts = authorPosts.reduce((sum, p) => sum + (p.metrics.reposts ?? 0), 0) / total;
  const avgReplies = authorPosts.reduce((sum, p) => sum + (p.metrics.replies ?? 0), 0) / total;
  const avgEngagement = avgLikes + avgReposts * 2 + avgReplies * 3;

  return {
    totalPosts: total,
    avgLikes,
    avgReposts,
    avgReplies,
    avgEngagement,
  };
}

export function computeAllAuthorStats(posts: UnifiedPost[]): Map<string, AuthorEngagementStats> {
  const byAuthor = new Map<string, UnifiedPost[]>();
  for (const p of posts) {
    const key = p.author.id;
    const list = byAuthor.get(key) ?? [];
    list.push(p);
    byAuthor.set(key, list);
  }

  const stats = new Map<string, AuthorEngagementStats>();
  for (const [authorId, authorPosts] of byAuthor) {
    const total = authorPosts.length;
    if (total === 0) continue;
    const avgLikes = authorPosts.reduce((sum, p) => sum + (p.metrics.likes ?? 0), 0) / total;
    const avgReposts = authorPosts.reduce((sum, p) => sum + (p.metrics.reposts ?? 0), 0) / total;
    const avgReplies = authorPosts.reduce((sum, p) => sum + (p.metrics.replies ?? 0), 0) / total;
    const avgEngagement = avgLikes + avgReposts * 2 + avgReplies * 3;

    stats.set(authorId, {
      totalPosts: total,
      avgLikes,
      avgReposts,
      avgReplies,
      avgEngagement,
    });
  }

  return stats;
}
