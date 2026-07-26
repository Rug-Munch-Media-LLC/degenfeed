/**
 * @degenfeed/api-worker — Premium Publish Analytics
 *
 * Real post analytics tracking for premium publishing:
 * - Engagement metrics per protocol (likes, reposts, replies, quotes, tips)
 * - Publish success/failure rates
 * - Best-performing content analysis
 * - Cross-posting efficiency reports
 * - Per-post performance analytics
 *
 * Uses KV-backed counters for real-time aggregation.
 * Complements post-analytics.ts (which provides the aggregate dashboard).
 */

import { requirePremiumTier } from '../../premium';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

// ─── KV Key Prefixes ──────────────────────────────────────────────────────

const PREFIX_POST_ANALYTICS = 'premium:post:analytics:';
const PREFIX_PROTOCOL_STATS = 'premium:protocol:stats:';
// Reserved for daily aggregation: const PREFIX_DAILY_AGG = 'premium:daily:';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PostPerformance {
  /** Queue entry ID */
  entryId: string;
  /** Wallet address */
  walletAddress: string;
  /** Text preview (first 200 chars) */
  textPreview: string;
  /** Protocols published to */
  protocols: string[];
  /** When the post was published */
  publishedAt: string;
  /** Engagement metrics per protocol */
  perProtocol: Record<string, ProtocolEngagement>;
  /** Total engagement across all protocols */
  total: AggregatedEngagement;
  /** Computed engagement score (0-100) */
  engagementScore: number;
  /** Top performing protocol */
  bestProtocol: string | null;
  /** Content type */
  contentType: 'text' | 'image' | 'video' | 'link' | 'thread';
}

export interface ProtocolEngagement {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  tips: number;
  /** Estimated reach/impressions */
  reach?: number;
  /** Error if engagement fetch failed */
  error?: string;
  /** Last updated timestamp */
  updatedAt: string;
}

export interface AggregatedEngagement {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  tips: number;
  total: number;
}

export interface ProtocolStats {
  /** Total posts published to this protocol */
  totalPosts: number;
  /** Successful publishes */
  successfulPosts: number;
  /** Failed publishes */
  failedPosts: number;
  /** Total engagement across all posts */
  totalEngagement: number;
  /** Average engagement per post */
  avgEngagement: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Last published timestamp */
  lastPublishedAt: string | null;
}

export interface PostAnalyticsSummary {
  /** Total posts published */
  totalPosts: number;
  /** Posts by status */
  byStatus: Record<string, number>;
  /** Posts by protocol */
  byProtocol: Record<string, number>;
  /** Total engagement */
  totalEngagement: number;
  /** Average engagement per post */
  avgEngagementPerPost: number;
  /** Average engagement score (0-100) */
  avgEngagementScore: number;
  /** Best performing protocol */
  bestProtocol: string | null;
  /** Protocol breakdown */
  protocolBreakdown: Record<string, ProtocolStats>;
  /** Top posts by engagement */
  topPosts: Array<{ entryId: string; textPreview: string; engagementScore: number }>;
}

// ─── Record Engagement ────────────────────────────────────────────────────

/**
 * Record engagement metrics for a published post on a specific protocol.
 * Called by the cron sync or via webhook callback when engagement data arrives.
 *
 * POST /api/premium/analytics/record
 */
export async function handleRecordEngagement(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const body = (await request.json()) as {
      entryId: string;
      protocol: string;
      likes?: number;
      reposts?: number;
      replies?: number;
      quotes?: number;
      bookmarks?: number;
      tips?: number;
      reach?: number;
    };

    if (!body.entryId || !body.protocol) {
      return jsonResponse({ error: 'entryId and protocol required' }, 400);
    }

    const address = session.address.toLowerCase();
    const now = new Date().toISOString();

    // Update per-post analytics
    const postKey = `${PREFIX_POST_ANALYTICS}${address}:${body.entryId}`;
    let perf: PostPerformance;

    const existing = await env.CACHE?.get(postKey, 'json');
    if (existing) {
      perf = existing as PostPerformance;
    } else {
      // Need to create minimal record — enrich from queue entry
      const { getQueueEntry } = await import('./utils');
      const entry = await getQueueEntry(env, address, body.entryId);
      perf = {
        entryId: body.entryId,
        walletAddress: address,
        textPreview: entry?.masterPost?.text?.slice(0, 200) ?? '',
        protocols: entry?.protocols ?? [body.protocol],
        publishedAt: entry?.updatedAt ?? now,
        perProtocol: {},
        total: { likes: 0, reposts: 0, replies: 0, quotes: 0, bookmarks: 0, tips: 0, total: 0 },
        engagementScore: 0,
        bestProtocol: null,
        contentType: detectContentType(
          entry?.masterPost as
            | { text?: string; media?: Array<{ type?: string }>; linkCard?: { url?: string } }
            | undefined,
        ),
      };
    }

    // Update per-protocol engagement
    const existingProto = perf.perProtocol[body.protocol] ?? {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      bookmarks: 0,
      tips: 0,
      updatedAt: now,
    };

    perf.perProtocol[body.protocol] = {
      likes: body.likes ?? existingProto.likes,
      reposts: body.reposts ?? existingProto.reposts,
      replies: body.replies ?? existingProto.replies,
      quotes: body.quotes ?? existingProto.quotes,
      bookmarks: body.bookmarks ?? existingProto.bookmarks,
      tips: body.tips ?? existingProto.tips,
      reach: body.reach ?? existingProto.reach,
      updatedAt: now,
    };

    // Recalculate totals
    perf.total = calculateAggregated(perf.perProtocol);
    perf.engagementScore = calculateEngagementScore(perf.total);
    perf.bestProtocol = findBestProtocol(perf.perProtocol);

    // Store in KV (90 day TTL)
    if (env.CACHE) {
      await env.CACHE.put(postKey, JSON.stringify(perf), { expirationTtl: 86400 * 90 });
    }

    // Update protocol-level aggregate stats
    await updateProtocolStats(env, address, body.protocol, true);

    return jsonResponse({ ok: true, performance: perf });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Get Post Performance ─────────────────────────────────────────────────

/**
 * GET /api/premium/analytics/posts/:entryId
 *
 * Get detailed performance for a single post.
 */
export async function handleGetPostPerformance(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const entryId = url.pathname.split('/').pop();
    if (!entryId) return jsonResponse({ error: 'Missing entry ID' }, 400);

    const address = session.address.toLowerCase();
    const key = `${PREFIX_POST_ANALYTICS}${address}:${entryId}`;
    const raw = await env.CACHE?.get(key, 'json');

    if (!raw) {
      return jsonResponse(
        { error: 'Analytics not found for this post. It may not have been synced yet.' },
        404,
      );
    }

    return jsonResponse({ ok: true, performance: raw as PostPerformance });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── List Post Analytics ──────────────────────────────────────────────────

/**
 * GET /api/premium/analytics/posts
 *
 * List all post analytics for the user, sorted by engagement score.
 * Query params: ?limit=20&cursor=xxx&sort=score|date|protocol
 */
export async function handleListPostAnalytics(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
    const cursor = url.searchParams.get('cursor') || undefined;
    const sort = url.searchParams.get('sort') || 'score';

    const address = session.address.toLowerCase();
    const prefix = `${PREFIX_POST_ANALYTICS}${address}:`;
    const posts: PostPerformance[] = [];

    let nextCursor: string | undefined = cursor;
    let hasMore = false;

    if (env.CACHE) {
      const page = await env.CACHE.list({ prefix, cursor: nextCursor, limit });
      for (const key of page.keys) {
        const raw = await env.CACHE.get(key.name, 'json');
        if (raw) posts.push(raw as PostPerformance);
      }
      hasMore = !page.list_complete;
      nextCursor = page.list_complete ? undefined : page.cursor;
    }

    // Sort
    if (sort === 'score') {
      posts.sort((a, b) => b.engagementScore - a.engagementScore);
    } else if (sort === 'date') {
      posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sort === 'protocol') {
      posts.sort((a, b) => (b.protocols?.length ?? 0) - (a.protocols?.length ?? 0));
    }

    // Compute summary
    const totalEngagement = posts.reduce((sum, p) => sum + p.total.total, 0);
    const avgScore =
      posts.length > 0 ? posts.reduce((sum, p) => sum + p.engagementScore, 0) / posts.length : 0;

    return jsonResponse({
      ok: true,
      posts: posts.slice(0, limit),
      total: posts.length,
      totalEngagement,
      avgEngagementScore: Math.round(avgScore * 100) / 100,
      nextCursor: hasMore ? nextCursor : undefined,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Analytics Summary ────────────────────────────────────────────────────

/**
 * GET /api/premium/analytics/summary
 *
 * Get aggregate analytics summary for the user's premium publishing.
 */
export async function handleAnalyticsSummary(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;

    const gate = await requirePremiumTier(session.address, env, 'pro');
    if (gate) return gate;

    const address = session.address.toLowerCase();
    const prefix = `${PREFIX_POST_ANALYTICS}${address}:`;
    const allPosts: PostPerformance[] = [];

    if (env.CACHE) {
      let cursor: string | undefined;
      do {
        const page = await env.CACHE.list({ prefix, cursor, limit: 100 });
        for (const key of page.keys) {
          const raw = await env.CACHE.get(key.name, 'json');
          if (raw) allPosts.push(raw as PostPerformance);
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
    }

    // Compute protocol breakdown
    const protocolBreakdown: Record<string, ProtocolStats> = {};
    const byStatus: Record<string, number> = {};
    const byProtocol: Record<string, number> = {};

    for (const post of allPosts) {
      byStatus.published = (byStatus.published ?? 0) + 1;

      for (const protocol of post.protocols ?? []) {
        byProtocol[protocol] = (byProtocol[protocol] ?? 0) + 1;

        if (!protocolBreakdown[protocol]) {
          protocolBreakdown[protocol] = {
            totalPosts: 0,
            successfulPosts: 0,
            failedPosts: 0,
            totalEngagement: 0,
            avgEngagement: 0,
            successRate: 1,
            lastPublishedAt: null,
          };
        }

        const stats = protocolBreakdown[protocol];
        if (stats) {
          stats.totalPosts++;
          const protoEng = post.perProtocol[protocol];
          if (protoEng) {
            stats.successfulPosts++;
            stats.totalEngagement += protoEng.likes + protoEng.reposts + protoEng.replies;
            stats.lastPublishedAt = protoEng.updatedAt;
          }
        }
      }
    }

    // Calculate averages
    for (const protocol of Object.keys(protocolBreakdown)) {
      const stats = protocolBreakdown[protocol];
      if (stats) {
        stats.avgEngagement =
          stats.totalPosts > 0 ? Math.round(stats.totalEngagement / stats.totalPosts) : 0;
        stats.successRate = stats.totalPosts > 0 ? stats.successfulPosts / stats.totalPosts : 0;
      }
    }

    // Find best protocol
    let bestProtocol: string | null = null;
    let bestAvg = 0;
    for (const [protocol, stats] of Object.entries(protocolBreakdown)) {
      if (stats.avgEngagement > bestAvg) {
        bestAvg = stats.avgEngagement;
        bestProtocol = protocol;
      }
    }

    const totalEngagement = allPosts.reduce((sum, p) => sum + p.total.total, 0);
    const avgScore =
      allPosts.length > 0
        ? allPosts.reduce((sum, p) => sum + p.engagementScore, 0) / allPosts.length
        : 0;

    // Top posts
    const topPosts = [...allPosts]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10)
      .map((p) => ({
        entryId: p.entryId,
        textPreview: p.textPreview,
        engagementScore: p.engagementScore,
        totalEngagement: p.total.total,
        bestProtocol: p.bestProtocol,
      }));

    return jsonResponse({
      ok: true,
      summary: {
        totalPosts: allPosts.length,
        byStatus,
        byProtocol,
        totalEngagement,
        avgEngagementPerPost:
          allPosts.length > 0 ? Math.round(totalEngagement / allPosts.length) : 0,
        avgEngagementScore: Math.round(avgScore * 100) / 100,
        bestProtocol,
        protocolBreakdown,
        topPosts,
      },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────

function calculateAggregated(
  perProtocol: Record<string, ProtocolEngagement>,
): AggregatedEngagement {
  const total: AggregatedEngagement = {
    likes: 0,
    reposts: 0,
    replies: 0,
    quotes: 0,
    bookmarks: 0,
    tips: 0,
    total: 0,
  };

  for (const proto of Object.values(perProtocol)) {
    total.likes += proto.likes ?? 0;
    total.reposts += proto.reposts ?? 0;
    total.replies += proto.replies ?? 0;
    total.quotes += proto.quotes ?? 0;
    total.bookmarks += proto.bookmarks ?? 0;
    total.tips += proto.tips ?? 0;
  }

  total.total =
    total.likes + total.reposts + total.replies + total.quotes + total.bookmarks + total.tips;
  return total;
}

function calculateEngagementScore(total: AggregatedEngagement): number {
  // Weighted formula: likes(1x) + reposts(3x) + replies(2x) + quotes(4x) + bookmarks(1.5x) + tips(5x)
  const weighted =
    total.likes +
    total.reposts * 3 +
    total.replies * 2 +
    total.quotes * 4 +
    total.bookmarks * 1.5 +
    total.tips * 5;

  // Normalize to 0-100 (capped at 1000 raw = 100 score)
  return Math.min(100, Math.round((weighted / 10) * 10) / 10);
}

function findBestProtocol(perProtocol: Record<string, ProtocolEngagement>): string | null {
  let best: string | null = null;
  let bestScore = 0;

  for (const [protocol, eng] of Object.entries(perProtocol)) {
    const score = (eng.likes ?? 0) + (eng.reposts ?? 0) * 3 + (eng.replies ?? 0) * 2;
    if (score > bestScore) {
      bestScore = score;
      best = protocol;
    }
  }

  return best;
}

function detectContentType(
  masterPost?: {
    text?: string;
    media?: Array<{ type?: string }>;
    linkCard?: { url?: string };
  } | null,
): 'text' | 'image' | 'video' | 'link' | 'thread' {
  if (!masterPost) return 'text';
  const media = masterPost.media;
  if (media && Array.isArray(media) && media.some((m) => m.type === 'video')) return 'video';
  if (media && Array.isArray(media) && (media.some((m) => m.type === 'image') || media.length > 0))
    return 'image';
  if (masterPost.linkCard?.url) return 'link';
  if ((masterPost.text?.length ?? 0) > 500) return 'thread';
  return 'text';
}

async function updateProtocolStats(
  env: Env,
  walletAddress: string,
  protocol: string,
  success: boolean,
): Promise<void> {
  try {
    const key = `${PREFIX_PROTOCOL_STATS}${walletAddress}:${protocol}`;
    const existing = await env.CACHE?.get(key, 'json');
    const stats: ProtocolStats = existing
      ? (existing as ProtocolStats)
      : {
          totalPosts: 0,
          successfulPosts: 0,
          failedPosts: 0,
          totalEngagement: 0,
          avgEngagement: 0,
          successRate: 1,
          lastPublishedAt: null,
        };

    stats.totalPosts++;
    if (success) stats.successfulPosts++;
    else stats.failedPosts++;
    stats.lastPublishedAt = new Date().toISOString();
    stats.successRate = stats.totalPosts > 0 ? stats.successfulPosts / stats.totalPosts : 0;
    stats.avgEngagement =
      stats.totalPosts > 0 ? Math.round(stats.totalEngagement / stats.totalPosts) : 0;

    if (env.CACHE) {
      await env.CACHE.put(key, JSON.stringify(stats), { expirationTtl: 86400 * 365 });
    }
  } catch {
    // Best-effort
  }
}
