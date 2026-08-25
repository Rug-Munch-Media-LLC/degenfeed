/**
 * @degenfeed/api-worker — Post Analytics Dashboard
 *
 * Premium analytics for cross-posts. Tracks engagement, best times,
 * content type performance, hashtag effectiveness, and follower growth.
 *
 * Data sources:
 *   - Bridge reliability KV (per-protocol publish success/failure)
 *   - Cross-publish orchestrator (batches, per-post stats)
 *   - Protocol-specific API calls for engagement metrics
 *   - Aggregated analytics KV store (pre-computed stats)
 *
 * All routes are premium-gated via premium-gate.ts / requirePremiumTier.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { kvGetJson } from '../lib/kv-json';
import { requirePremiumTier } from '../premium';
import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PostAnalytics {
  /** Post identifier */
  postId: string;
  /** Wallet address of the author */
  walletAddress: string;
  /** Post text preview (first 200 chars) */
  textPreview: string;
  /** Protocols published to */
  protocols: string[];
  /** Timestamp ISO */
  publishedAt: string;
  /** Total engagement across all protocols */
  totalEngagement: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    bookmarks: number;
  };
  /** Per-protocol breakdown */
  perProtocol: Record<
    string,
    {
      likes: number;
      reposts: number;
      replies: number;
      quotes: number;
      bookmarks: number;
      reach?: number;
      error?: string;
    }
  >;
  /** Content type classification */
  contentType: 'text' | 'image' | 'video' | 'link' | 'thread' | 'poll';
  /** Hashtags used */
  hashtags: string[];
  /** Overall engagement score (0-100) */
  engagementScore: number;
}

export interface AnalyticsSummary {
  totalPosts: number;
  totalEngagement: number;
  averageEngagementPerPost: number;
  bestPerformingProtocol: string | null;
  bestPostingTime: string | null;
  topHashtags: Array<{ tag: string; count: number; engagement: number }>;
  contentTypeBreakdown: Record<string, number>;
  protocolBreakdown: Record<
    string,
    {
      posts: number;
      engagement: number;
      successRate: number;
    }
  >;
  recentTrend: 'up' | 'down' | 'stable';
  followerGrowth: {
    total: number;
    change7d: number;
    change30d: number;
  };
}

export interface AnalyticsTimeRange {
  start: string;
  end: string;
  label: string;
}

// ─── Analytics KV Prefixes ────────────────────────────────────────────────

const PREFIX_ANALYTICS = 'premium:analytics:';
const PREFIX_ENGAGEMENT = 'premium:analytics:engagement:';
const PREFIX_FOLLOWERS = 'premium:analytics:followers:';

// ─── Summary Analytics ────────────────────────────────────────────────────

/**
 * GET /api/premium/analytics/summary
 *
 * Get aggregate analytics summary for the authenticated user.
 * Query: ?range=7d|30d|90d|all
 */
export async function handleAnalyticsSummary(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const range = getTimeRange(url.searchParams.get('range') || '30d');
    const address = session.address.toLowerCase();

    // Try cache first
    const cacheKey = `${PREFIX_ANALYTICS}summary:${address}:${range.label}`;
    if (env.CACHE) {
      const cached = await kvGetJson(env.CACHE, cacheKey);
      if (cached) return jsonResponse(cached as Record<string, unknown>);
    }

    const summary = await computeAnalyticsSummary(address, range, env);

    // Cache for 5 minutes
    if (env.CACHE) {
      await env.CACHE.put(cacheKey, JSON.stringify(summary), { expirationTtl: 300 });
    }

    return jsonResponse(summary);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/posts
 *
 * Get per-post analytics with pagination.
 * Query: ?limit=20&cursor=abc&sort=engagement|date&order=desc
 */
export async function handlePostAnalyticsList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
    const cursor = url.searchParams.get('cursor') || undefined;
    const sort = (url.searchParams.get('sort') || 'date') as 'engagement' | 'date';
    const order = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const range = getTimeRange(url.searchParams.get('range') || '30d');

    const address = session.address.toLowerCase();
    const posts = await listPostAnalytics(address, range, limit, cursor, sort, order, env);

    return jsonResponse(posts);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/posts/:id
 *
 * Get detailed analytics for a single post.
 */
export async function handlePostAnalyticsDetail(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const postId = url.pathname.split('/').pop();
    if (!postId) return jsonResponse({ error: 'Missing post ID' }, 400);

    const address = session.address.toLowerCase();
    const analytics = await getPostAnalytics(address, postId, env);
    if (!analytics) return jsonResponse({ error: 'Post not found' }, 404);

    return jsonResponse(analytics);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/top-posts
 *
 * Get top performing posts by engagement.
 * Query: ?limit=10&range=30d
 */
export async function handleTopPosts(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
    const range = getTimeRange(url.searchParams.get('range') || 'all');

    const address = session.address.toLowerCase();
    const posts = await listPostAnalytics(
      address,
      range,
      limit,
      undefined,
      'engagement',
      'desc',
      env,
    );

    return jsonResponse({
      topPosts: posts.posts.slice(0, limit),
      total: posts.total,
      range: range.label,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/best-times
 *
 * Get best posting times based on historical engagement data.
 */
export async function handleBestTimesAnalytics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const address = session.address.toLowerCase();
    const bestTimes = await computeBestPostingTimes(address, env);

    return jsonResponse({
      bestTimes,
      recommendation: bestTimes.length > 0 ? bestTimes[0] : null,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/hashtags
 *
 * Get top performing hashtags with engagement metrics.
 */
export async function handleHashtagAnalytics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const range = getTimeRange(url.searchParams.get('range') || '30d');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50);

    const address = session.address.toLowerCase();
    const hashtags = await computeTopHashtags(address, range, limit, env);

    return jsonResponse({ hashtags, range: range.label });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/content-types
 *
 * Get content type performance breakdown.
 */
export async function handleContentTypeAnalytics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const range = getTimeRange(url.searchParams.get('range') || '30d');

    const address = session.address.toLowerCase();
    const breakdown = await computeContentTypeBreakdown(address, range, env);

    return jsonResponse({ contentTypes: breakdown, range: range.label });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/premium/analytics/followers
 *
 * Get follower growth data.
 */
export async function handleFollowerAnalytics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const address = session.address.toLowerCase();
    const growth = await computeFollowerGrowth(address, env);

    return jsonResponse(growth);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Analytics Recording (called by publish orchestrator) ─────────────────

/**
 * Record analytics for a published post.
 * Called by the publish orchestrator after successful cross-post.
 */
export async function recordPostAnalytics(
  env: Env,
  walletAddress: string,
  postId: string,
  masterPost: MasterPost,
  protocols: string[],
  results: Record<string, { success: boolean; error?: string }>,
): Promise<void> {
  if (!env.CACHE) return;

  const address = walletAddress.toLowerCase();
  const now = new Date().toISOString();

  // Determine content type
  const contentType = classifyContent(masterPost);

  const analytics: PostAnalytics = {
    postId,
    walletAddress: address,
    textPreview: masterPost.text.slice(0, 200),
    protocols,
    publishedAt: now,
    totalEngagement: { likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 },
    perProtocol: {},
    contentType,
    hashtags: masterPost.hashtags ?? [],
    engagementScore: 0,
  };

  // Mark protocol success/failure
  for (const protocol of protocols) {
    analytics.perProtocol[protocol] = {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      bookmarks: 0,
      ...(results[protocol]?.success ? {} : { error: results[protocol]?.error }),
    };
  }

  // Store
  const key = `${PREFIX_ENGAGEMENT}${address}:${postId}`;
  await env.CACHE.put(key, JSON.stringify(analytics), { expirationTtl: 86400 * 365 });

  // Update summary index
  const indexKey = `${PREFIX_ANALYTICS}index:${address}`;
  const indexRaw = await kvGetJson(env.CACHE, indexKey);
  const index: string[] = (indexRaw as string[]) ?? [];
  index.push(postId);
  await env.CACHE.put(indexKey, JSON.stringify(index.slice(-5000)), { expirationTtl: 86400 * 365 });

  // Force recompute cache on next read
  await env.CACHE.delete(`${PREFIX_ANALYTICS}summary:${address}:7d`);
  await env.CACHE.delete(`${PREFIX_ANALYTICS}summary:${address}:30d`);
  await env.CACHE.delete(`${PREFIX_ANALYTICS}summary:${address}:90d`);
}

/**
 * Update engagement metrics for a post (called by webhook/cron).
 * Merges real-time data from protocol APIs.
 */
export async function updatePostEngagement(
  env: Env,
  walletAddress: string,
  postId: string,
  protocol: string,
  engagement: {
    likes?: number;
    reposts?: number;
    replies?: number;
    quotes?: number;
    bookmarks?: number;
  },
): Promise<void> {
  if (!env.CACHE) return;

  const address = walletAddress.toLowerCase();
  const key = `${PREFIX_ENGAGEMENT}${address}:${postId}`;
  const raw = await kvGetJson(env.CACHE, key);
  if (!raw) return;

  const analytics = raw as PostAnalytics;

  // Update per-protocol metrics
  if (!analytics.perProtocol[protocol]) {
    analytics.perProtocol[protocol] = { likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 };
  }

  const proto = analytics.perProtocol[protocol];
  proto.likes = engagement.likes ?? proto.likes;
  proto.reposts = engagement.reposts ?? proto.reposts;
  proto.replies = engagement.replies ?? proto.replies;
  proto.quotes = engagement.quotes ?? proto.quotes;
  proto.bookmarks = engagement.bookmarks ?? proto.bookmarks;

  // Recompute totals
  analytics.totalEngagement = { likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0 };
  for (const p of Object.values(analytics.perProtocol)) {
    if (p.error) continue;
    analytics.totalEngagement.likes += p.likes;
    analytics.totalEngagement.reposts += p.reposts;
    analytics.totalEngagement.replies += p.replies;
    analytics.totalEngagement.quotes += p.quotes;
    analytics.totalEngagement.bookmarks += p.bookmarks;
  }

  // Compute engagement score (0-100)
  analytics.engagementScore = computeEngagementScore(analytics.totalEngagement);

  await env.CACHE.put(key, JSON.stringify(analytics), { expirationTtl: 86400 * 365 });
}

// ─── Internal: Analytics Computation ──────────────────────────────────────

async function computeAnalyticsSummary(
  address: string,
  range: AnalyticsTimeRange,
  env: Env,
): Promise<AnalyticsSummary> {
  const posts = await getAllPostAnalytics(address, env);
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();

  const filtered = posts.filter((p) => {
    const t = new Date(p.publishedAt).getTime();
    return t >= rangeStart && t <= rangeEnd;
  });

  const totalPosts = filtered.length;
  if (totalPosts === 0) {
    return {
      totalPosts: 0,
      totalEngagement: 0,
      averageEngagementPerPost: 0,
      bestPerformingProtocol: null,
      bestPostingTime: null,
      topHashtags: [],
      contentTypeBreakdown: {},
      protocolBreakdown: {},
      recentTrend: 'stable',
      followerGrowth: { total: 0, change7d: 0, change30d: 0 },
    };
  }

  // Aggregate totals
  let totalEngagement = 0;
  const protocolStats: Record<
    string,
    { posts: number; engagement: number; successes: number; failures: number }
  > = {};
  const contentTypeCounts: Record<string, number> = {};
  const hashtagStats: Map<string, { count: number; engagement: number }> = new Map();
  const hourlyEngagement: Record<number, { count: number; total: number }> = {};

  for (const post of filtered) {
    const eng = post.totalEngagement;
    const postTotal = eng.likes + eng.reposts + eng.replies + eng.quotes;
    totalEngagement += postTotal;

    // Protocol breakdown
    for (const [proto, pEng] of Object.entries(post.perProtocol)) {
      if (!protocolStats[proto])
        protocolStats[proto] = { posts: 0, engagement: 0, successes: 0, failures: 0 };
      protocolStats[proto].posts++;
      protocolStats[proto].engagement += pEng.likes + pEng.reposts + pEng.replies;
      if (pEng.error) protocolStats[proto].failures++;
      else protocolStats[proto].successes++;
    }

    // Content type
    contentTypeCounts[post.contentType] = (contentTypeCounts[post.contentType] ?? 0) + 1;

    // Hashtags
    for (const tag of post.hashtags) {
      const existing = hashtagStats.get(tag) ?? { count: 0, engagement: 0 };
      existing.count++;
      existing.engagement += postTotal;
      hashtagStats.set(tag, existing);
    }

    // Hourly engagement
    const hour = new Date(post.publishedAt).getUTCHours();
    if (!hourlyEngagement[hour]) hourlyEngagement[hour] = { count: 0, total: 0 };
    hourlyEngagement[hour].count++;
    hourlyEngagement[hour].total += postTotal;
  }

  // Best performing protocol
  let bestProtocol: string | null = null;
  let bestAvgEngagement = 0;
  for (const [proto, stats] of Object.entries(protocolStats)) {
    const avg = stats.engagement / stats.posts;
    if (avg > bestAvgEngagement) {
      bestAvgEngagement = avg;
      bestProtocol = proto;
    }
  }

  // Best posting time
  let bestHour: number | null = null;
  let bestHourAvg = 0;
  for (const [hourStr, data] of Object.entries(hourlyEngagement)) {
    const avg = data.total / data.count;
    if (avg > bestHourAvg) {
      bestHourAvg = avg;
      bestHour = Number(hourStr);
    }
  }

  // Top hashtags
  const topHashtags = [...hashtagStats.entries()]
    .map(([tag, stats]) => ({ tag, count: stats.count, engagement: stats.engagement }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 20);

  // Protocol breakdown for response
  const protocolBreakdown: Record<
    string,
    { posts: number; engagement: number; successRate: number }
  > = {};
  for (const [proto, stats] of Object.entries(protocolStats)) {
    protocolBreakdown[proto] = {
      posts: stats.posts,
      engagement: stats.engagement,
      successRate: stats.posts > 0 ? stats.successes / stats.posts : 0,
    };
  }

  // Follower growth
  const followerGrowth = await computeFollowerGrowth(address, env);

  // Recent trend
  const midPoint = rangeStart + (rangeEnd - rangeStart) / 2;
  const firstHalf = filtered.filter((p) => new Date(p.publishedAt).getTime() < midPoint);
  const secondHalf = filtered.filter((p) => new Date(p.publishedAt).getTime() >= midPoint);
  const firstAvg =
    firstHalf.length > 0
      ? firstHalf.reduce((sum, p) => sum + getTotalEngagement(p.totalEngagement), 0) /
        firstHalf.length
      : 0;
  const secondAvg =
    secondHalf.length > 0
      ? secondHalf.reduce((sum, p) => sum + getTotalEngagement(p.totalEngagement), 0) /
        secondHalf.length
      : 0;
  const recentTrend: 'up' | 'down' | 'stable' =
    secondAvg > firstAvg * 1.1 ? 'up' : secondAvg < firstAvg * 0.9 ? 'down' : 'stable';

  return {
    totalPosts,
    totalEngagement,
    averageEngagementPerPost: totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0,
    bestPerformingProtocol: bestProtocol,
    bestPostingTime: bestHour !== null ? `${bestHour.toString().padStart(2, '0')}:00 UTC` : null,
    topHashtags,
    contentTypeBreakdown: contentTypeCounts,
    protocolBreakdown,
    recentTrend,
    followerGrowth,
  };
}

async function getPostAnalytics(
  address: string,
  postId: string,
  env: Env,
): Promise<PostAnalytics | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await kvGetJson(env.CACHE, `${PREFIX_ENGAGEMENT}${address}:${postId}`);
    return raw as PostAnalytics | null;
  } catch {
    return null;
  }
}

async function getAllPostAnalytics(address: string, env: Env): Promise<PostAnalytics[]> {
  const posts: PostAnalytics[] = [];
  if (!env.CACHE) return posts;

  try {
    let cursor: string | undefined;
    do {
      const page = await env.CACHE.list({
        prefix: `${PREFIX_ENGAGEMENT}${address}:`,
        cursor,
        limit: 100,
      });

      for (const key of page.keys) {
        const raw = await kvGetJson(env.CACHE, key.name);
        if (raw) posts.push(raw as PostAnalytics);
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch {
    // Partial results
  }

  return posts;
}

async function listPostAnalytics(
  address: string,
  range: AnalyticsTimeRange,
  limit: number,
  cursor?: string,
  sort: 'engagement' | 'date' = 'date',
  order: 'asc' | 'desc' = 'desc',
  env?: Env,
): Promise<{ posts: PostAnalytics[]; total: number; nextCursor?: string }> {
  if (!env?.CACHE) return { posts: [], total: 0 };

  let allPosts = await getAllPostAnalytics(address, env);

  // Filter by time range
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();
  allPosts = allPosts.filter((p) => {
    const t = new Date(p.publishedAt).getTime();
    return t >= rangeStart && t <= rangeEnd;
  });

  // Sort
  allPosts.sort((a, b) => {
    if (sort === 'engagement') {
      const aEng = getTotalEngagement(a.totalEngagement);
      const bEng = getTotalEngagement(b.totalEngagement);
      return order === 'desc' ? bEng - aEng : aEng - bEng;
    }
    return order === 'desc'
      ? new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      : new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
  });

  // Paginate (simple offset for now)
  const offset = cursor ? parseInt(cursor, 10) || 0 : 0;
  const sliced = allPosts.slice(offset, offset + limit);
  const nextCursor = offset + limit < allPosts.length ? String(offset + limit) : undefined;

  return {
    posts: sliced,
    total: allPosts.length,
    nextCursor,
  };
}

async function computeBestPostingTimes(
  address: string,
  env: Env,
): Promise<Array<{ hour: number; dayOfWeek: number; avgEngagement: number; postCount: number }>> {
  const posts = await getAllPostAnalytics(address, env);
  const slotMap = new Map<string, { total: number; count: number }>();

  for (const post of posts) {
    const date = new Date(post.publishedAt);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    const key = `${day}:${hour}`;

    const existing = slotMap.get(key) ?? { total: 0, count: 0 };
    existing.total += getTotalEngagement(post.totalEngagement);
    existing.count++;
    slotMap.set(key, existing);
  }

  return [...slotMap.entries()]
    .map(([key, data]) => {
      const [dayOfWeek, hour] = key.split(':').map(Number);
      return {
        hour,
        dayOfWeek,
        avgEngagement: data.count > 0 ? Math.round(data.total / data.count) : 0,
        postCount: data.count,
      };
    })
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 10);
}

async function computeTopHashtags(
  address: string,
  range: AnalyticsTimeRange,
  limit: number,
  env: Env,
): Promise<Array<{ tag: string; count: number; engagement: number }>> {
  const posts = await getAllPostAnalytics(address, env);
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();

  const hashtagStats = new Map<string, { count: number; engagement: number }>();

  for (const post of posts) {
    const t = new Date(post.publishedAt).getTime();
    if (t < rangeStart || t > rangeEnd) continue;

    const postEng = getTotalEngagement(post.totalEngagement);
    for (const tag of post.hashtags) {
      const existing = hashtagStats.get(tag) ?? { count: 0, engagement: 0 };
      existing.count++;
      existing.engagement += postEng;
      hashtagStats.set(tag, existing);
    }
  }

  return [...hashtagStats.entries()]
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);
}

async function computeContentTypeBreakdown(
  address: string,
  range: AnalyticsTimeRange,
  env: Env,
): Promise<Array<{ type: string; posts: number; totalEngagement: number; avgEngagement: number }>> {
  const posts = await getAllPostAnalytics(address, env);
  const rangeStart = new Date(range.start).getTime();
  const rangeEnd = new Date(range.end).getTime();

  const breakdown = new Map<string, { posts: number; totalEngagement: number }>();

  for (const post of posts) {
    const t = new Date(post.publishedAt).getTime();
    if (t < rangeStart || t > rangeEnd) continue;

    const ct = post.contentType || 'text';
    const existing = breakdown.get(ct) ?? { posts: 0, totalEngagement: 0 };
    existing.posts++;
    existing.totalEngagement += getTotalEngagement(post.totalEngagement);
    breakdown.set(ct, existing);
  }

  return [...breakdown.entries()]
    .map(([type, data]) => ({
      type,
      posts: data.posts,
      totalEngagement: data.totalEngagement,
      avgEngagement: data.posts > 0 ? Math.round(data.totalEngagement / data.posts) : 0,
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement);
}

async function computeFollowerGrowth(
  address: string,
  env: Env,
): Promise<{
  total: number;
  change7d: number;
  change30d: number;
  byProtocol: Record<string, { total: number; change7d: number; change30d: number }>;
}> {
  const defaults = { total: 0, change7d: 0, change30d: 0, byProtocol: {} };

  if (!env.SUBSCRIPTIONS) return defaults;

  try {
    const raw = await env.SUBSCRIPTIONS.get(`${PREFIX_FOLLOWERS}${address}`);
    if (raw) {
      return JSON.parse(raw) as typeof defaults;
    }
  } catch {
    // No data yet
  }

  return defaults;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getTotalEngagement(engagement: PostAnalytics['totalEngagement']): number {
  return (
    engagement.likes +
    engagement.reposts +
    engagement.replies +
    engagement.quotes +
    engagement.bookmarks
  );
}

function computeEngagementScore(engagement: PostAnalytics['totalEngagement']): number {
  const total = getTotalEngagement(engagement);
  // Normalize to 0-100 scale (log scale since engagement varies widely)
  if (total === 0) return 0;
  return Math.min(100, Math.round(Math.log10(total + 1) * 25));
}

function classifyContent(post: MasterPost): PostAnalytics['contentType'] {
  if (post.media?.some((m) => m.mimeType?.startsWith('video/'))) return 'video';
  if (post.media && post.media.length > 0) return 'image';
  if (post.linkCard) return 'link';
  if ((post.text?.length ?? 0) > 500) return 'thread';
  return 'text';
}

function getTimeRange(rangeParam: string): AnalyticsTimeRange {
  const now = new Date();
  const end = now.toISOString();

  switch (rangeParam) {
    case '7d': {
      const start = new Date(now.getTime() - 7 * 86400_000);
      return { start: start.toISOString(), end, label: '7d' };
    }
    case '30d': {
      const start = new Date(now.getTime() - 30 * 86400_000);
      return { start: start.toISOString(), end, label: '30d' };
    }
    case '90d': {
      const start = new Date(now.getTime() - 90 * 86400_000);
      return { start: start.toISOString(), end, label: '90d' };
    }
    default:
      return { start: new Date(0).toISOString(), end, label: 'all' };
  }
}
