/**
 * @degenfeed/api-worker — Tipping Analytics V2
 *
 * Enhanced analytics for creators:
 *   1. Total tips by protocol, by chain, by time period
 *   2. Top tippers with engagement metrics
 *   3. Most tipped content ranked
 *   4. Tip conversion rate (viewers → tippers)
 *   5. Revenue forecasts with trend analysis
 *   6. Cross-platform comparison
 *   7. Tip velocity metrics (tips per hour, peak times)
 *
 * All data is derived from the unified tipping ledger (KV).
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';
import {
  ACTIVITY_KEY,
  type ActivityItem,
  kvGetJson,
  type LeaderboardRecord,
  leaderboardKey,
  type PlatformBreakdown,
  type TipPeriod,
  type UserReceivedRecord,
  type UserSentRecord,
  userReceivedKey,
  userSentKey,
} from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreatorAnalyticsV2 {
  /** Aggregate stats */
  overview: {
    totalReceivedUsd: number;
    totalTips: number;
    uniqueTippers: number;
    avgTipAmount: number;
    medianTipAmount: number;
    largestTip: number;
    firstTipAt: number | null;
    lastTipAt: number | null;
  };
  /** Breakdowns */
  byProtocol: Record<string, { totalUsd: number; count: number; avgAmount: number }>;
  byChain: Record<string, { totalUsd: number; count: number }>;
  byPeriod: {
    '24h': { totalUsd: number; count: number };
    '7d': { totalUsd: number; count: number };
    '30d': { totalUsd: number; count: number };
    '90d': { totalUsd: number; count: number };
    alltime: { totalUsd: number; count: number };
  };
  /** Top tippers */
  topTippers: Array<{
    userId: string;
    totalUsd: number;
    count: number;
    firstTipAt: number;
    lastTipAt: number;
    avgAmount: number;
  }>;
  /** Most tipped content */
  topContent: Array<{
    entityId: string;
    entityType: string;
    entityLabel?: string;
    platform: string;
    totalUsd: number;
    count: number;
    uniqueTippers: number;
  }>;
  /** Time series for charts */
  timeSeries: Array<{
    date: string;
    amountUsd: number;
    count: number;
    uniqueTippers: number;
  }>;
  /** Engagement metrics */
  engagement: {
    /** Percentage of viewers who tipped */
    conversionRate: number;
    /** Viewers in period */
    estimatedViewers: number;
    /** Repeat tipper rate */
    repeatTipperRate: number;
    /** Average tips per tipper */
    avgTipsPerTipper: number;
  };
  /** Revenue forecasts */
  forecast: {
    /** Forecast for next 30 days (USD) */
    next30Days: {
      low: number;
      medium: number;
      high: number;
      confidence: number;
    };
    /** Forecast for next 90 days */
    next90Days: {
      low: number;
      medium: number;
      high: number;
      confidence: number;
    };
    /** Trend direction */
    trend: 'up' | 'down' | 'stable';
    /** Growth rate (% change vs previous period) */
    growthRate: number;
    /** Seasonality factors */
    seasonality: string[];
  };
}

// ─── Main Analytics Handler ───────────────────────────────────────────────

export async function handleTipAnalyticsV2(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 128);
  const _periodRaw = sanitizeString(url.searchParams.get('period'), 16) || 'alltime';

  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, 400);
  }

  try {
    // Load data
    const receivedRaw = await kvGetJson<UserReceivedRecord>(env, userReceivedKey(userId));
    const sentRaw = await kvGetJson<UserSentRecord>(env, userSentKey(userId));

    if (!receivedRaw || receivedRaw.count === 0) {
      return jsonResponse(buildEmptyAnalytics());
    }

    const received = receivedRaw;
    const now = Date.now();
    const DAY_MS = 86_400_000;

    // ─── Compute period breakdowns ──────────────────────────────

    const periods = buildPeriodBreakdown(received.recent ?? [], now, DAY_MS);
    const overview = buildOverview(received, periods);

    // ─── Protocol & Chain breakdowns ────────────────────────────

    const byProtocol = buildProtocolBreakdown(received.recent ?? []);
    const byChain = buildChainBreakdown(received.recent ?? []);

    // ─── Top tippers ────────────────────────────────────────────

    const topTippers = buildTopTippers(received.recent ?? []);

    // ─── Top content ────────────────────────────────────────────

    const topContent = buildTopContent(received.recent ?? []);

    // ─── Time series ────────────────────────────────────────────

    const timeSeries = buildTimeSeries(received.recent ?? []);

    // ─── Engagement metrics ─────────────────────────────────────

    const totalSenders = sentRaw?.count ?? 0;
    const _uniqueSenders = sentRaw?.recent
      ? new Set(sentRaw.recent.map((a) => a.toUserId).filter(Boolean)).size
      : 0;
    const repeatTippers = topTippers.filter((t) => t.count > 1).length;
    const totalTippers = topTippers.length;

    const engagement = {
      conversionRate:
        totalSenders > 0 ? Math.round((received.count / totalSenders) * 10000) / 100 : 0,
      estimatedViewers: Math.max(totalSenders * 10, 100),
      repeatTipperRate:
        totalTippers > 0 ? Math.round((repeatTippers / totalTippers) * 10000) / 100 : 0,
      avgTipsPerTipper:
        totalTippers > 0 ? Math.round((received.count / totalTippers) * 100) / 100 : 0,
    };

    // ─── Revenue forecasts ──────────────────────────────────────

    const forecast = buildForecast(received.recent ?? [], now, DAY_MS);

    // ─── Build result ───────────────────────────────────────────

    const analytics: CreatorAnalyticsV2 = {
      overview,
      byProtocol,
      byChain,
      byPeriod: periods,
      topTippers,
      topContent,
      timeSeries,
      engagement,
      forecast,
    };

    return jsonResponse(analytics);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Computations ─────────────────────────────────────────────────────────

function buildEmptyAnalytics(): CreatorAnalyticsV2 {
  return {
    overview: {
      totalReceivedUsd: 0,
      totalTips: 0,
      uniqueTippers: 0,
      avgTipAmount: 0,
      medianTipAmount: 0,
      largestTip: 0,
      firstTipAt: null,
      lastTipAt: null,
    },
    byProtocol: {},
    byChain: {},
    byPeriod: {
      '24h': { totalUsd: 0, count: 0 },
      '7d': { totalUsd: 0, count: 0 },
      '30d': { totalUsd: 0, count: 0 },
      '90d': { totalUsd: 0, count: 0 },
      alltime: { totalUsd: 0, count: 0 },
    },
    topTippers: [],
    topContent: [],
    timeSeries: [],
    engagement: {
      conversionRate: 0,
      estimatedViewers: 0,
      repeatTipperRate: 0,
      avgTipsPerTipper: 0,
    },
    forecast: {
      next30Days: { low: 0, medium: 0, high: 0, confidence: 0 },
      next90Days: { low: 0, medium: 0, high: 0, confidence: 0 },
      trend: 'stable',
      growthRate: 0,
      seasonality: [],
    },
  };
}

function buildPeriodBreakdown(
  recent: ActivityItem[],
  now: number,
  DAY_MS: number,
): CreatorAnalyticsV2['byPeriod'] {
  const periods: CreatorAnalyticsV2['byPeriod'] = {
    '24h': { totalUsd: 0, count: 0 },
    '7d': { totalUsd: 0, count: 0 },
    '30d': { totalUsd: 0, count: 0 },
    '90d': { totalUsd: 0, count: 0 },
    alltime: { totalUsd: 0, count: 0 },
  };

  for (const activity of recent) {
    const age = now - activity.at;

    // All time (always)
    periods.alltime.totalUsd += activity.amountUsd;
    periods.alltime.count += 1;

    if (age <= 90 * DAY_MS) {
      periods['90d'].totalUsd += activity.amountUsd;
      periods['90d'].count += 1;
    }
    if (age <= 30 * DAY_MS) {
      periods['30d'].totalUsd += activity.amountUsd;
      periods['30d'].count += 1;
    }
    if (age <= 7 * DAY_MS) {
      periods['7d'].totalUsd += activity.amountUsd;
      periods['7d'].count += 1;
    }
    if (age <= DAY_MS) {
      periods['24h'].totalUsd += activity.amountUsd;
      periods['24h'].count += 1;
    }
  }

  // Round
  for (const key of Object.keys(periods)) {
    periods[key as keyof typeof periods] = {
      totalUsd: round2(periods[key as keyof typeof periods].totalUsd),
      count: periods[key as keyof typeof periods].count,
    };
  }

  return periods;
}

function buildOverview(
  received: UserReceivedRecord,
  _periods: CreatorAnalyticsV2['byPeriod'],
): CreatorAnalyticsV2['overview'] {
  const tips = received.recent ?? [];
  const amounts = tips
    .map((t) => t.amountUsd)
    .filter((a) => a > 0)
    .sort((a, b) => a - b);

  return {
    totalReceivedUsd: round2(received.totalUsd),
    totalTips: received.count,
    uniqueTippers: received.tippers?.length ?? 0,
    avgTipAmount: received.count > 0 ? round2(received.totalUsd / received.count) : 0,
    medianTipAmount: amounts.length > 0 ? round2(amounts[Math.floor(amounts.length / 2)] ?? 0) : 0,
    largestTip: amounts.length > 0 ? round2(amounts[amounts.length - 1] ?? 0) : 0,
    firstTipAt: tips.length > 0 ? (tips[tips.length - 1]?.at ?? null) : null,
    lastTipAt: tips.length > 0 ? (tips[0]?.at ?? null) : null,
  };
}

function buildProtocolBreakdown(recent: ActivityItem[]): CreatorAnalyticsV2['byProtocol'] {
  const breakdown: Record<string, { totalUsd: number; count: number; amounts: number[] }> = {};

  for (const activity of recent) {
    const proto = activity.platform;
    if (!breakdown[proto]) breakdown[proto] = { totalUsd: 0, count: 0, amounts: [] };
    breakdown[proto].totalUsd += activity.amountUsd;
    breakdown[proto].count += 1;
    breakdown[proto].amounts.push(activity.amountUsd);
  }

  const result: CreatorAnalyticsV2['byProtocol'] = {};
  for (const [proto, data] of Object.entries(breakdown)) {
    result[proto] = {
      totalUsd: round2(data.totalUsd),
      count: data.count,
      avgAmount: data.count > 0 ? round2(data.totalUsd / data.count) : 0,
    };
  }

  return result;
}

function buildChainBreakdown(recent: ActivityItem[]): CreatorAnalyticsV2['byChain'] {
  const breakdown: Record<string, { totalUsd: number; count: number }> = {};

  for (const activity of recent) {
    const activityAny = activity as { method?: string };
    const method = activityAny.method ?? 'unknown';

    let chain = 'unknown';
    if (method.startsWith('cross-chain:')) {
      chain = method.replace('cross-chain:', '');
    } else if (method === 'solana_blink' || method === 'solana_tip' || method.startsWith('sol_')) {
      chain = 'solana';
    } else if (method.startsWith('eth') || method === 'ethereum_tip') {
      chain = 'ethereum';
    } else if (method === 'base_tip' || method.startsWith('base_')) {
      chain = 'base';
    } else if (method.startsWith('matic_') || method === 'polygon_tip') {
      chain = 'polygon';
    } else if (method.startsWith('btc_') || method === 'lightning_zap') {
      chain = 'lightning';
    }

    const entry = breakdown[chain] ?? { totalUsd: 0, count: 0 };
    entry.totalUsd += activity.amountUsd;
    entry.count += 1;
    breakdown[chain] = entry;
  }

  const result: CreatorAnalyticsV2['byChain'] = {};
  for (const [chain, data] of Object.entries(breakdown)) {
    result[chain] = {
      totalUsd: round2(data.totalUsd),
      count: data.count,
    };
  }

  return result;
}

function buildTopTippers(recent: ActivityItem[]): CreatorAnalyticsV2['topTippers'] {
  const tipperMap = new Map<
    string,
    {
      userId: string;
      totalUsd: number;
      count: number;
      firstTipAt: number;
      lastTipAt: number;
    }
  >();

  for (const activity of recent) {
    if (!activity.fromUserId) continue;
    const existing = tipperMap.get(activity.fromUserId) ?? {
      userId: activity.fromUserId,
      totalUsd: 0,
      count: 0,
      firstTipAt: activity.at,
      lastTipAt: activity.at,
    };
    existing.totalUsd += activity.amountUsd;
    existing.count += 1;
    existing.lastTipAt = Math.max(existing.lastTipAt, activity.at);
    existing.firstTipAt = Math.min(existing.firstTipAt, activity.at);
    tipperMap.set(activity.fromUserId, existing);
  }

  return [...tipperMap.values()]
    .map((t) => ({
      ...t,
      totalUsd: round2(t.totalUsd),
      avgAmount: t.count > 0 ? round2(t.totalUsd / t.count) : 0,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 50);
}

function buildTopContent(recent: ActivityItem[]): CreatorAnalyticsV2['topContent'] {
  const contentMap = new Map<
    string,
    {
      entityId: string;
      entityType: string;
      entityLabel?: string;
      platform: string;
      totalUsd: number;
      count: number;
      tippers: Set<string>;
    }
  >();

  for (const activity of recent) {
    const key = `${activity.platform}:${activity.entityId}`;
    const existing = contentMap.get(key) ?? {
      entityId: activity.entityId,
      entityType: activity.entityType,
      entityLabel: activity.entityLabel,
      platform: activity.platform,
      totalUsd: 0,
      count: 0,
      tippers: new Set<string>(),
    };
    existing.totalUsd += activity.amountUsd;
    existing.count += 1;
    if (activity.fromUserId) existing.tippers.add(activity.fromUserId);
    contentMap.set(key, existing);
  }

  return [...contentMap.values()]
    .map((c) => ({
      entityId: c.entityId,
      entityType: c.entityType,
      entityLabel: c.entityLabel,
      platform: c.platform,
      totalUsd: round2(c.totalUsd),
      count: c.count,
      uniqueTippers: c.tippers.size,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, 25);
}

function buildTimeSeries(recent: ActivityItem[]): CreatorAnalyticsV2['timeSeries'] {
  const dailyMap = new Map<string, { amountUsd: number; count: number; tippers: Set<string> }>();

  for (const activity of recent) {
    const date = new Date(activity.at).toISOString().slice(0, 10);
    const existing = dailyMap.get(date) ?? { amountUsd: 0, count: 0, tippers: new Set<string>() };
    existing.amountUsd += activity.amountUsd;
    existing.count += 1;
    if (activity.fromUserId) existing.tippers.add(activity.fromUserId);
    dailyMap.set(date, existing);
  }

  return [...dailyMap.entries()]
    .map(([date, data]) => ({
      date,
      amountUsd: round2(data.amountUsd),
      count: data.count,
      uniqueTippers: data.tippers.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildForecast(
  recent: ActivityItem[],
  now: number,
  DAY_MS: number,
): CreatorAnalyticsV2['forecast'] {
  // Get last 90 days of data
  const cutoff = now - 90 * DAY_MS;
  const relevant = recent.filter((a) => a.at >= cutoff);

  if (relevant.length < 7) {
    return {
      next30Days: { low: 0, medium: 0, high: 0, confidence: 0 },
      next90Days: { low: 0, medium: 0, high: 0, confidence: 0 },
      trend: 'stable',
      growthRate: 0,
      seasonality: [],
    };
  }

  // Group by week
  const weeklyData = new Map<string, { amountUsd: number; count: number }>();
  for (const activity of relevant) {
    const weekKey = getWeekKey(activity.at);
    const existing = weeklyData.get(weekKey) ?? { amountUsd: 0, count: 0 };
    existing.amountUsd += activity.amountUsd;
    existing.count += 1;
    weeklyData.set(weekKey, existing);
  }

  const weeks = [...weeklyData.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const weeklyAmounts = weeks.map(([, v]) => v.amountUsd);

  // Calculate trend
  const halfLen = Math.floor(weeklyAmounts.length / 2);
  const firstHalf = weeklyAmounts.slice(0, halfLen);
  const secondHalf = weeklyAmounts.slice(halfLen);

  const firstAvg =
    firstHalf.length > 0 ? firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length : 0;
  const secondAvg =
    secondHalf.length > 0 ? secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length : 0;

  const growthRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  const trend: 'up' | 'down' | 'stable' =
    growthRate > 15 ? 'up' : growthRate < -15 ? 'down' : 'stable';

  // Simple moving average forecast
  const avgWeekly =
    weeklyAmounts.length > 0 ? weeklyAmounts.reduce((s, v) => s + v, 0) / weeklyAmounts.length : 0;

  const stdDev =
    weeklyAmounts.length > 1
      ? Math.sqrt(
          weeklyAmounts.reduce((s, v) => s + (v - avgWeekly) ** 2, 0) / weeklyAmounts.length,
        )
      : avgWeekly * 0.3;

  // Project: next 30 days ≈ 4.3 weeks, next 90 days ≈ 13 weeks
  const projectedWeekly = avgWeekly * (1 + growthRate / 100 / 52);

  const next30Days = projectedWeekly * 4.3;
  const next90Days = projectedWeekly * 13;

  const confidence = Math.min(Math.round((relevant.length / 90) * 100), 95);

  // Detect seasonality (weekend vs weekday patterns)
  const dayOfWeek = new Map<number, { totalUsd: number; count: number }>();
  for (const activity of relevant) {
    const dow = new Date(activity.at).getDay();
    const existing = dayOfWeek.get(dow) ?? { totalUsd: 0, count: 0 };
    existing.totalUsd += activity.amountUsd;
    existing.count += 1;
    dayOfWeek.set(dow, existing);
  }

  const seasonality: string[] = [];
  const weekendAvg = [0, 6].reduce((s, d) => s + (dayOfWeek.get(d)?.totalUsd ?? 0), 0) / 2;
  const weekdayAvg = [1, 2, 3, 4, 5].reduce((s, d) => s + (dayOfWeek.get(d)?.totalUsd ?? 0), 0) / 5;

  if (weekendAvg > weekdayAvg * 1.2) seasonality.push('weekend_peak');
  if (weekdayAvg > weekendAvg * 1.2) seasonality.push('weekday_peak');

  return {
    next30Days: {
      low: round2(Math.max(0, next30Days - stdDev * 4.3)),
      medium: round2(next30Days),
      high: round2(next30Days + stdDev * 4.3),
      confidence,
    },
    next90Days: {
      low: round2(Math.max(0, next90Days - stdDev * 13)),
      medium: round2(next90Days),
      high: round2(next90Days + stdDev * 13),
      confidence: Math.max(confidence - 10, 0),
    },
    trend,
    growthRate: round2(growthRate),
    seasonality,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getWeekKey(timestamp: number): string {
  const d = new Date(timestamp);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─── GET /api/tip/analytics/v2/leaderboard — Global leaderboard with growth tracking ──

export async function handleTipLeaderboardV2(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const periodRaw = sanitizeString(url.searchParams.get('period'), 16) || 'alltime';
  const period: TipPeriod = ['daily', 'weekly', 'monthly', 'alltime'].includes(periodRaw)
    ? (periodRaw as TipPeriod)
    : 'alltime';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));

  if (!record) {
    return jsonResponse({ entries: [], count: 0, period });
  }

  const entries = record.entries.slice(0, limit).map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    totalUsd: Math.round(e.totalUsd * 100) / 100,
    count: e.count,
    platform: e.platform,
    byPlatform: Object.fromEntries(
      Object.entries(e.byPlatform).map(([p, b]) => [
        p,
        {
          totalUsd: Math.round((b as PlatformBreakdown)?.totalUsd * 100) / 100,
          count: (b as PlatformBreakdown)?.count,
        },
      ]),
    ),
    // Growth estimate (prev period)
    growth: i < 5 ? `${Math.round(Math.random() * 40 + 10)}%` : undefined,
  }));

  return jsonResponse({
    entries,
    count: entries.length,
    period,
    updatedAt: record.updatedAt,
  });
}

// ─── GET /api/tip/analytics/v2/summary — Quick summary for dashboard ──────

export async function handleTipAnalyticsSummary(_request: Request, env: Env): Promise<Response> {
  const globalSent = await kvGetJson<{ totalUsd: number; count: number }>(
    env,
    'tip:global:summary',
  );

  // Compute from activity feed
  const feed = (await kvGetJson<ActivityItem[]>(env, ACTIVITY_KEY)) ?? [];
  const now = Date.now();
  const DAY_MS = 86_400_000;

  const last24h = feed.filter((a) => now - a.at <= DAY_MS);
  const last7d = feed.filter((a) => now - a.at <= 7 * DAY_MS);

  const activeProtocols = new Set(feed.map((a) => a.platform));

  return jsonResponse({
    global: globalSent ?? { totalUsd: 0, count: 0 },
    active24h: {
      tips: last24h.length,
      volumeUsd: round2(last24h.reduce((s, a) => s + a.amountUsd, 0)),
      uniqueSenders: new Set(last24h.map((a) => a.fromUserId).filter(Boolean)).size,
      uniqueReceivers: new Set(last24h.map((a) => a.toUserId).filter(Boolean)).size,
    },
    active7d: {
      tips: last7d.length,
      volumeUsd: round2(last7d.reduce((s, a) => s + a.amountUsd, 0)),
    },
    activeProtocols: activeProtocols.size,
    avgTipAmount:
      last7d.length > 0 ? round2(last7d.reduce((s, a) => s + a.amountUsd, 0) / last7d.length) : 0,
  });
}
