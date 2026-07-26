/**
 * @degenfeed/api-worker — Feed Quality Dashboard
 *
 * Quality metrics for admin dashboard:
 * 1. Average post quality score
 * 2. Category distribution
 * 3. Source diversity index
 * 4. User engagement rate
 * 5. Content freshness score
 *
 * Computes real-time metrics from the current feed window and stores
 * historical snapshots for trend analysis.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { scoreQualityV3, classifyPost } from '@degenfeed/feed-core';
import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface QualityDashboardMetrics {
  /** Timestamp of metric generation */
  generatedAt: number;
  /** Total posts analyzed */
  totalPosts: number;
  /** Unique creators in the window */
  uniqueCreators: number;
  /** Unique protocols represented */
  uniqueProtocols: number;

  // ── 1. Quality Scores ─────────────────────────────────────────────
  avgQualityScore: number; // 0-100
  medianQualityScore: number;
  qualityDistribution: {
    excellent: number; // 80-100
    good: number; // 60-79
    fair: number; // 40-59
    poor: number; // 20-39
    bad: number; // 0-19
  };
  /** Per-protocol average quality */
  qualityByProtocol: Record<string, number>;
  /** Per-creator top quality scores */
  topCreatorsByQuality: Array<{ creatorId: string; displayName: string; avgQuality: number; postCount: number }>;

  // ── 2. Category Distribution ──────────────────────────────────────
  categoryDistribution: Record<string, number>;
  categoryByProtocol: Record<string, Record<string, number>>;
  trendingCategories: Array<{ category: string; count: number; growth: number }>;

  // ── 3. Source Diversity ───────────────────────────────────────────
  diversityIndex: number; // 0-1 (Shannon entropy normalized)
  protocolShare: Record<string, number>; // Percentage per protocol
  creatorConcentration: number; // % of posts from top 5 creators
  protocolConcentration: number; // % of posts from top 3 protocols

  // ── 4. Engagement Metrics ─────────────────────────────────────────
  avgEngagementRate: number; // engagements per 1000 impressions
  medianEngagement: number;
  engagementByProtocol: Record<string, number>;
  viralPosts: number; // Posts with very high engagement
  zeroEngagementPosts: number; // Posts with zero engagement

  // ── 5. Freshness ──────────────────────────────────────────────────
  avgFreshnessScore: number; // 0-100
  freshnessDistribution: {
    breaking: number; // <15 min
    recent: number; // 15-60 min
    today: number; // 1-24h
    older: number; // >24h
  };
}

export interface QualityDashboardSnapshot {
  timestamp: number;
  metrics: QualityDashboardMetrics;
  windowSize: number;
}

// ─── Dashboard Builder ─────────────────────────────────────────────────

/**
 * Build a comprehensive quality dashboard from a set of posts.
 * Computes all metrics in a single pass for performance.
 */
export function buildQualityDashboard(
  posts: UnifiedPost[],
  now: number = Date.now(),
): QualityDashboardMetrics {
  const totalPosts = posts.length;
  if (totalPosts === 0) {
    return emptyDashboard(now);
  }

  // Single-pass accumulators
  const qualityScores: number[] = [];
  const engagementTotals: number[] = [];
  const protocolQualities: Record<string, number[]> = {};
  const protocolEngagements: Record<string, number[]> = {};
  const protocolCounts: Record<string, number> = {};
  const creatorCounts: Record<string, { quality: number[]; name: string }> = {};
  const categoryCounts: Record<string, number> = {};
  const categoryByProtocol: Record<string, Record<string, number>> = {};

  // Freshness buckets
  let breakingCount = 0;
  let recentCount = 0;
  let todayCount = 0;
  let olderCount = 0;

  // Quality distribution counts
  let excellentCount = 0;
  let goodCount = 0;
  let fairCount = 0;
  let poorCount = 0;
  let badCount = 0;

  // Engagement
  let totalEngagement = 0;
  let viralCount = 0;
  let zeroEngCount = 0;

  for (const post of posts) {
    // ── Quality Score (V3) ──────────────────────────────────────────
    const signals = scoreQualityV3(post, { now });
    const qScore = signals.composite;
    qualityScores.push(qScore);

    // Distribution
    if (qScore >= 80) excellentCount++;
    else if (qScore >= 60) goodCount++;
    else if (qScore >= 40) fairCount++;
    else if (qScore >= 20) poorCount++;
    else badCount++;

    // Per-protocol quality
    const proto = post.protocol;
    if (!protocolQualities[proto]) protocolQualities[proto] = [];
    protocolQualities[proto].push(qScore);
    protocolCounts[proto] = (protocolCounts[proto] ?? 0) + 1;

    // Per-creator quality
    const creatorId = post.author.id;
    const existing = creatorCounts[creatorId];
    if (existing) {
      existing.quality.push(qScore);
    } else {
      creatorCounts[creatorId] = { quality: [qScore], name: post.author.displayName };
    }

    // ── Engagement ──────────────────────────────────────────────────
    const engTotal = post.metrics.likes + post.metrics.reposts + post.metrics.replies + (post.metrics.quotes ?? 0);
    engagementTotals.push(engTotal);
    totalEngagement += engTotal;

    if (!protocolEngagements[proto]) protocolEngagements[proto] = [];
    protocolEngagements[proto].push(engTotal);

    if (engTotal === 0) zeroEngCount++;
    if (engTotal > 100) viralCount++;

    // ── Category (via V3 classifier) ────────────────────────────────
    const catResult = classifyPost(post);
    const primaryCat = catResult.primaryCategory;
    categoryCounts[primaryCat] = (categoryCounts[primaryCat] ?? 0) + 1;

    if (!categoryByProtocol[proto]) categoryByProtocol[proto] = {};
    categoryByProtocol[proto][primaryCat] = (categoryByProtocol[proto][primaryCat] ?? 0) + 1;

    // ── Freshness ───────────────────────────────────────────────────
    const ageMinutes = (now - post.createdAt) / 60000;
    if (ageMinutes < 15) breakingCount++;
    else if (ageMinutes < 60) recentCount++;
    else if (ageMinutes < 1440) todayCount++;
    else olderCount++;
  }

  // ── Compute Averages and Derived Metrics ──────────────────────────

  // Quality
  const sortedQuality = [...qualityScores].sort((a, b) => a - b);
  const avgQuality = qualityScores.reduce((s, v) => s + v, 0) / totalPosts;
  const medianQuality = sortedQuality[Math.floor(totalPosts / 2)] ?? 0;

  const qualityByProtocol: Record<string, number> = {};
  for (const [p, scores] of Object.entries(protocolQualities)) {
    qualityByProtocol[p] = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }

  // Top creators by quality
  const creatorAvgs = Object.entries(creatorCounts)
    .map(([id, data]) => ({
      creatorId: id,
      displayName: data.name,
      avgQuality: data.quality.reduce((s, v) => s + v, 0) / data.quality.length,
      postCount: data.quality.length,
    }))
    .filter((c) => c.postCount >= 2) // Need at least 2 posts for meaningful average
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .slice(0, 10);

  // Diversity: Shannon entropy normalized
  const totalProtocolPosts = Object.values(protocolCounts).reduce((a, b) => a + b, 0);
  const protocolShare: Record<string, number> = {};
  let shannonEntropy = 0;
  for (const [p, count] of Object.entries(protocolCounts)) {
    const pct = count / totalProtocolPosts;
    protocolShare[p] = Math.round(pct * 10000) / 100;
    if (pct > 0) shannonEntropy -= pct * Math.log(pct);
  }
  const maxEntropy = Math.log(Object.keys(protocolCounts).length || 1);
  const diversityIndex = maxEntropy > 0 ? shannonEntropy / maxEntropy : 0;

  // Creator concentration
  const sortedCreators = Object.entries(creatorCounts)
    .map(([id, data]) => ({ id, count: data.quality.length }))
    .sort((a, b) => b.count - a.count);
  const top5CreatorPosts = sortedCreators.slice(0, 5).reduce((s, c) => s + c.count, 0);
  const creatorConcentration = totalPosts > 0 ? (top5CreatorPosts / totalPosts) * 100 : 0;

  // Protocol concentration
  const sortedProtocols = Object.entries(protocolCounts)
    .sort((a, b) => b[1] - a[1]);
  const top3ProtocolPosts = sortedProtocols.slice(0, 3).reduce((s, [, c]) => s + c, 0);
  const protocolConcentration = totalPosts > 0 ? (top3ProtocolPosts / totalPosts) * 100 : 0;

  // Engagement
  const sortedEngagement = [...engagementTotals].sort((a, b) => a - b);
  const avgEngagement = totalEngagement / totalPosts;
  const medianEngagement = sortedEngagement[Math.floor(totalPosts / 2)] ?? 0;

  const engagementByProtocol: Record<string, number> = {};
  for (const [p, scores] of Object.entries(protocolEngagements)) {
    engagementByProtocol[p] = Math.round(
      scores.reduce((s, v) => s + v, 0) / scores.length,
    );
  }

  // Category distribution
  const totalCategorized = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const categoryDistribution: Record<string, number> = {};
  for (const [cat, count] of Object.entries(categoryCounts)) {
    categoryDistribution[cat] = Math.round((count / Math.max(totalCategorized, 1)) * 10000) / 100;
  }

  return {
    generatedAt: now,
    totalPosts,
    uniqueCreators: Object.keys(creatorCounts).length,
    uniqueProtocols: Object.keys(protocolCounts).length,

    avgQualityScore: Math.round(avgQuality * 100) / 100,
    medianQualityScore: Math.round(medianQuality * 100) / 100,
    qualityDistribution: {
      excellent: excellentCount,
      good: goodCount,
      fair: fairCount,
      poor: poorCount,
      bad: badCount,
    },
    qualityByProtocol,
    topCreatorsByQuality: creatorAvgs.map((c) => ({
      ...c,
      avgQuality: Math.round(c.avgQuality * 100) / 100,
    })),

    categoryDistribution,
    categoryByProtocol,
    trendingCategories: buildTrendingCategories(categoryCounts),

    diversityIndex: Math.round(diversityIndex * 10000) / 10000,
    protocolShare,
    creatorConcentration: Math.round(creatorConcentration * 100) / 100,
    protocolConcentration: Math.round(protocolConcentration * 100) / 100,

    avgEngagementRate: Math.round(avgEngagement * 100) / 100,
    medianEngagement: Math.round(medianEngagement * 100) / 100,
    engagementByProtocol,
    viralPosts: viralCount,
    zeroEngagementPosts: zeroEngCount,

    avgFreshnessScore: computeFreshnessScoreDistribution(breakingCount, recentCount, todayCount, olderCount),
    freshnessDistribution: {
      breaking: breakingCount,
      recent: recentCount,
      today: todayCount,
      older: olderCount,
    },
  };
}

function buildTrendingCategories(categoryCounts: Record<string, number>): Array<{ category: string; count: number; growth: number }> {
  return Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({
      category,
      count,
      growth: 0, // Would need historical data
    }));
}

function computeFreshnessScoreDistribution(
  breaking: number,
  recent: number,
  today: number,
  older: number,
): number {
  const total = breaking + recent + today + older;
  if (total === 0) return 0;
  // Weighted score: breaking = 100, recent = 70, today = 40, older = 10
  const score = (breaking * 100 + recent * 70 + today * 40 + older * 10) / total;
  return Math.round(score * 100) / 100;
}

function emptyDashboard(now: number): QualityDashboardMetrics {
  return {
    generatedAt: now,
    totalPosts: 0,
    uniqueCreators: 0,
    uniqueProtocols: 0,
    avgQualityScore: 0,
    medianQualityScore: 0,
    qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, bad: 0 },
    qualityByProtocol: {},
    topCreatorsByQuality: [],
    categoryDistribution: {},
    categoryByProtocol: {},
    trendingCategories: [],
    diversityIndex: 0,
    protocolShare: {},
    creatorConcentration: 0,
    protocolConcentration: 0,
    avgEngagementRate: 0,
    medianEngagement: 0,
    engagementByProtocol: {},
    viralPosts: 0,
    zeroEngagementPosts: 0,
    avgFreshnessScore: 0,
    freshnessDistribution: { breaking: 0, recent: 0, today: 0, older: 0 },
  };
}

// ─── KV-backed snapshot persistence ────────────────────────────────────

const DASHBOARD_PREFIX = 'feed:dashboard:v1:';

/**
 * Store a quality dashboard snapshot in KV.
 */
export async function storeDashboardSnapshot(
  env: Env,
  metrics: QualityDashboardMetrics,
): Promise<void> {
  const kv = (env as unknown as Record<string, unknown>).FEED_DASHBOARD_KV as { put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> } | undefined;
  if (!kv) return;
  const key = `${DASHBOARD_PREFIX}${metrics.generatedAt}`;
  try {
    await kv.put(key, JSON.stringify(metrics), {
      expirationTtl: 86400 * 30, // 30 days
    });
    // Keep latest snapshot at a well-known key
    await kv.put(`${DASHBOARD_PREFIX}latest`, JSON.stringify(metrics), {
      expirationTtl: 86400 * 7,
    });
  } catch {
    // Non-critical
  }
}

/**
 * Load the latest dashboard snapshot from KV.
 */
export async function loadLatestDashboardSnapshot(env: Env): Promise<QualityDashboardMetrics | null> {
  const kv = (env as unknown as Record<string, unknown>).FEED_DASHBOARD_KV as { get: (k: string) => Promise<string | null> } | undefined;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${DASHBOARD_PREFIX}latest`);
    if (!raw) return null;
    return JSON.parse(raw) as QualityDashboardMetrics;
  } catch {
    return null;
  }
}

interface KVKey { name: string }
interface KVListResult { keys: KVKey[] }

/**
 * Load dashboard snapshot history (last N snapshots).
 */
export async function loadDashboardHistory(
  env: Env,
  limit: number = 24,
): Promise<QualityDashboardMetrics[]> {
  const kv = (env as unknown as { FEED_DASHBOARD_KV?: { get: (k: string) => Promise<string | null>; list: (opts: { prefix: string; limit: number }) => Promise<KVListResult> } }).FEED_DASHBOARD_KV;
  if (!kv) return [];
  try {
    const keys = await kv.list({ prefix: DASHBOARD_PREFIX, limit });
    const snapshots: QualityDashboardMetrics[] = [];
    for (const key of keys.keys) {
      if (key.name === `${DASHBOARD_PREFIX}latest`) continue;
      const raw = await kv.get(key.name);
      if (raw) snapshots.push(JSON.parse(raw) as QualityDashboardMetrics);
    }
    return snapshots.sort((a, b) => b.generatedAt - a.generatedAt).slice(0, limit);
  } catch {
    return [];
  }
}
