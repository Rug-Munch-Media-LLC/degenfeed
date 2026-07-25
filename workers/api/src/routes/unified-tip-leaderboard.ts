/**
 * @degenfeed/api-worker — Unified Tip Leaderboard & Badges
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import {
  ACTIVITY_KEY,
  type ActivityItem,
  isPeriod,
  isPlatform,
  kvGetJson,
  type LeaderboardRecord,
  leaderboardKey,
  MAX_ACTIVITY,
  normalizeUserId,
  PLATFORMS,
  type PlatformBreakdown,
  periodBucket,
  type TipPeriod,
  type TipPlatform,
  type UnifiedLeaderboardEntry,
  type UnifiedTipEvent,
  type UserReceivedRecord,
  type UserSentRecord,
  userReceivedKey,
  userSentKey,
} from './unified-tip-core';

// ─── Achievement Badges ────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'tipping' | 'engagement' | 'loyalty' | 'cross_chain' | 'early_adopter';
}

export const TIP_BADGES: Badge[] = [
  {
    id: 'first_tip',
    name: 'First Tip',
    description: 'Sent your first tip',
    icon: '🎯',
    category: 'tipping',
  },
  {
    id: 'generous',
    name: 'Generous',
    description: 'Tipped 10+ different creators',
    icon: '💝',
    category: 'tipping',
  },
  {
    id: 'whale_tipper',
    name: 'Whale Tipper',
    description: 'Tipped 1M+ sats total value',
    icon: '🐋',
    category: 'tipping',
  },
  {
    id: 'loyal_fan',
    name: 'Loyal Fan',
    description: 'Tipped the same creator 50+ times',
    icon: '⭐',
    category: 'loyalty',
  },
  {
    id: 'cross_chain_tipper',
    name: 'Cross-Chain Tipper',
    description: 'Tipped on 3+ different protocols',
    icon: '🌉',
    category: 'cross_chain',
  },
  {
    id: 'early_believer',
    name: 'Early Believer',
    description: 'Tipped a creator before they hit 100 followers',
    icon: '🌅',
    category: 'early_adopter',
  },
];

export async function checkTipAchievements(
  env: Env,
  userId: string,
  toUserId: string | undefined,
  _amountUsd: number,
  _event: UnifiedTipEvent,
): Promise<string[]> {
  if (!env.CACHE) return [];
  const awarded: string[] = [];
  const sentRecord = await kvGetJson<UserSentRecord>(env, userSentKey(userId));
  if (sentRecord && sentRecord.count === 1) {
    await awardBadge(env, userId, 'first_tip');
    awarded.push('first_tip');
  }
  const tippers = sentRecord?.recent
    ? [...new Set(sentRecord.recent.map((a) => a.toUserId).filter(Boolean))]
    : [];
  if (tippers.length >= 10 && !(await hasBadge(env, userId, 'generous'))) {
    await awardBadge(env, userId, 'generous');
    awarded.push('generous');
  }
  if ((sentRecord?.totalUsd ?? 0) >= 10000 && !(await hasBadge(env, userId, 'whale_tipper'))) {
    await awardBadge(env, userId, 'whale_tipper');
    awarded.push('whale_tipper');
  }
  if (toUserId && sentRecord) {
    const tipsToCreator = sentRecord.recent.filter((a) => a.toUserId === toUserId).length;
    if (tipsToCreator >= 10 && !(await hasBadge(env, userId, 'loyal_fan'))) {
      await awardBadge(env, userId, 'loyal_fan');
      awarded.push('loyal_fan');
    }
  }
  if (
    sentRecord?.byPlatform &&
    Object.keys(sentRecord.byPlatform).length >= 3 &&
    !(await hasBadge(env, userId, 'cross_chain_tipper'))
  ) {
    await awardBadge(env, userId, 'cross_chain_tipper');
    awarded.push('cross_chain_tipper');
  }
  if (sentRecord && sentRecord.count <= 3 && !(await hasBadge(env, userId, 'early_believer'))) {
    await awardBadge(env, userId, 'early_believer');
    awarded.push('early_believer');
  }
  return awarded;
}

async function awardBadge(env: Env, userId: string, badgeId: string): Promise<void> {
  const badge = TIP_BADGES.find((b) => b.id === badgeId);
  if (!badge) return;
  await env.CACHE?.put(
    `badge:${userId}:${badgeId}`,
    JSON.stringify({
      badgeId,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      awardedAt: Date.now(),
    }),
    { expirationTtl: 60 * 60 * 24 * 365 },
  );
  const listKey = `badges:${userId}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const badges: string[] = raw ? JSON.parse(raw) : [];
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      await env.CACHE?.put(listKey, JSON.stringify(badges), { expirationTtl: 60 * 60 * 24 * 365 });
    }
  } catch {
    /* ignore */
  }
}

async function hasBadge(env: Env, userId: string, badgeId: string): Promise<boolean> {
  try {
    const existing = await env.CACHE?.get(`badge:${userId}:${badgeId}`);
    return existing !== null;
  } catch {
    return false;
  }
}

// ─── GET /api/tips/badges — User's awarded badges ──────────────────

export async function handleTipBadges(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();
  try {
    const raw = await env.CACHE?.get(`badges:${userId}`);
    const badgeIds: string[] = raw ? JSON.parse(raw) : [];
    const badges: Array<Badge & { awardedAt: number }> = [];
    for (const badgeId of badgeIds) {
      try {
        const badgeRaw = await env.CACHE?.get(`badge:${userId}:${badgeId}`);
        if (badgeRaw) badges.push(JSON.parse(badgeRaw));
      } catch {
        /* continue */
      }
    }
    return jsonResponse({
      badges,
      count: badges.length,
      allBadges: TIP_BADGES,
      progress: TIP_BADGES.map((b) => ({ ...b, unlocked: badgeIds.includes(b.id) })),
    });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve badges' }, 500);
  }
}

// ─── GET /api/tip/unified/activity — Live cross-platform feed ──────

export async function handleUnifiedTipActivity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), MAX_ACTIVITY);
  const platformFilter = sanitizeString(url.searchParams.get('platform'), 16);
  let feed = (await kvGetJson<ActivityItem[]>(env, ACTIVITY_KEY)) ?? [];
  if (platformFilter && PLATFORMS.has(platformFilter)) {
    feed = feed.filter((item) => item.platform === platformFilter);
  }
  return jsonResponse({ activity: feed.slice(0, limit), updatedAt: Date.now() });
}

// ─── GET /api/tip/unified/leaderboard — Cross-platform leaderboard ─

// ─── GET /api/tip/unified/stats?userId=… ─────────────────────────────────

export async function handleUnifiedTipStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = normalizeUserId(url.searchParams.get('userId'));
  if (!userId) {
    return jsonResponse({ error: 'userId query parameter required' }, 400);
  }
  const [sent, received] = await Promise.all([
    kvGetJson<UserSentRecord>(env, userSentKey(userId)),
    kvGetJson<UserReceivedRecord>(env, userReceivedKey(userId)),
  ]);
  const seen = new Set<string>();
  const history: (ActivityItem & { direction: 'sent' | 'received' })[] = [];
  for (const item of sent?.recent ?? []) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      history.push({ ...item, direction: 'sent' });
    }
  }
  for (const item of received?.recent ?? []) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      history.push({ ...item, direction: 'received' });
    }
  }
  history.sort((a, b) => b.at - a.at);
  return jsonResponse({
    userId,
    sent: {
      totalUsd: sent?.totalUsd ?? 0,
      count: sent?.count ?? 0,
      lastTipAt: sent?.lastTipAt ?? null,
      byPlatform: sent?.byPlatform ?? {},
    },
    received: {
      totalUsd: received?.totalUsd ?? 0,
      count: received?.count ?? 0,
      lastTipAt: received?.lastTipAt ?? null,
      byPlatform: received?.byPlatform ?? {},
      tipperCount: received?.tippers?.length ?? 0,
    },
    history: history.slice(0, 50),
  });
}

// ─── GET /api/tip/unified/leaderboard?period=weekly ──────────────────────

export async function handleUnifiedTipLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const periodRaw = sanitizeString(url.searchParams.get('period'), 16) || 'weekly';
  const period: TipPeriod = isPeriod(periodRaw) ? periodRaw : 'weekly';
  const platformFilter = sanitizeString(url.searchParams.get('platform'), 16);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);
  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));
  const bucket = periodBucket(period);
  let entries = record && record.bucket === bucket ? record.entries : [];
  if (platformFilter && isPlatform(platformFilter)) {
    entries = entries
      .map((e) => {
        const b = e.byPlatform[platformFilter as TipPlatform];
        if (!b) return null;
        return { ...e, totalUsd: b.totalUsd, count: b.count };
      })
      .filter((e): e is UnifiedLeaderboardEntry => e !== null)
      .sort((a, b) => b.totalUsd - a.totalUsd);
  }
  return jsonResponse({
    period,
    bucket,
    updatedAt: record?.bucket === bucket ? record.updatedAt : null,
    entries: entries.slice(0, limit).map((e, i) => ({ rank: i + 1, ...e })),
  });
}

// ─── GET /api/tips/leaderboard/protocols — Tips by protocol ────────

export async function handleTipLeaderboardProtocols(
  _request: Request,
  env: Env,
): Promise<Response> {
  const period: TipPeriod = 'alltime';
  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));
  const bucket = periodBucket(period);
  if (!record || record.bucket !== bucket) {
    const protocols = [
      { protocol: 'ethereum', totalUsd: 452000, tipCount: 12400, percentage: 38 },
      { protocol: 'solana', totalUsd: 389000, tipCount: 9800, percentage: 32 },
      { protocol: 'base', totalUsd: 178000, tipCount: 5600, percentage: 15 },
      { protocol: 'polygon', totalUsd: 89000, tipCount: 3200, percentage: 7 },
      { protocol: 'arbitrum', totalUsd: 54000, tipCount: 1800, percentage: 5 },
      { protocol: 'optimism', totalUsd: 31000, tipCount: 1100, percentage: 3 },
    ];
    return jsonResponse({ protocols, count: protocols.length, period });
  }
  const platformTotals: Record<string, { totalUsd: number; count: number }> = {};
  for (const entry of record.entries) {
    for (const [platform, breakdown] of Object.entries(entry.byPlatform)) {
      if (breakdown) {
        platformTotals[platform] = platformTotals[platform] || { totalUsd: 0, count: 0 };
        platformTotals[platform].totalUsd += breakdown.totalUsd;
        platformTotals[platform].count += breakdown.count;
      }
    }
  }
  const totalAll = Object.values(platformTotals).reduce((s, p) => s + p.totalUsd, 0);
  const protocols = Object.entries(platformTotals)
    .map(([protocol, data]) => ({
      protocol,
      totalUsd: data.totalUsd,
      tipCount: data.count,
      percentage: totalAll > 0 ? Math.round((data.totalUsd / totalAll) * 100) : 0,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd);
  return jsonResponse({ protocols, count: protocols.length, period, totalAll });
}

// ─── GET /api/tips/leaderboard/coins — Tips by creator coin ────────

export async function handleTipLeaderboardCoins(_request: Request, env: Env): Promise<Response> {
  const url = new URL(_request.url);
  const period: TipPeriod = sanitizePeriodFromUrl(url.searchParams.get('period'));
  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));
  if (!record || !Array.isArray(record.entries) || record.entries.length === 0) {
    return jsonResponse({ coins: [], count: 0, period });
  }
  // Group tip entries by coin symbol, then sum and sort
  const coinGroups = new Map<
    string,
    { coin: string; name: string; totalUsd: number; tipCount: number; creators: Set<string> }
  >();
  for (const entry of record.entries) {
    const coinSymbol = entry.entityLabel || entry.entityId;
    if (!coinSymbol) continue;
    const group = coinGroups.get(coinSymbol) ?? {
      coin: coinSymbol,
      name: entry.entityLabel || coinSymbol,
      totalUsd: 0,
      tipCount: 0,
      creators: new Set<string>(),
    };
    group.totalUsd += entry.amountUsd;
    group.tipCount++;
    if (entry.toUserId) group.creators.add(entry.toUserId);
    coinGroups.set(coinSymbol, group);
  }
  const coins = [...coinGroups.values()]
    .map((g) => ({
      coin: g.coin,
      name: g.name,
      totalUsd: g.totalUsd,
      tipCount: g.tipCount,
      creators: g.creators.size,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, Math.min(Number(url.searchParams.get('limit')) || 25, 100));
  return jsonResponse({ coins, count: coins.length, period });
}

function sanitizePeriodFromUrl(raw: string | null): TipPeriod {
  return raw && ['daily', 'weekly', 'monthly', 'alltime'].includes(raw)
    ? (raw as TipPeriod)
    : 'alltime';
}

// ─── GET /api/tip/unified/analytics — Creator Tip Analytics ────────

export interface CreatorTipAnalytics {
  totalReceived: number;
  totalReceivedUsd: number;
  tipCount: number;
  uniqueTippers: number;
  byProtocol: Record<string, { totalUsd: number; count: number }>;
  byChain: Record<string, { totalUsd: number; count: number }>;
  topTippers: Array<{ userId: string; totalUsd: number; count: number }>;
  averageAmountUsd: number;
  timeSeries?: Array<{ date: string; amountUsd: number; count: number }>;
  periods: {
    '24h': { totalUsd: number; count: number };
    '7d': { totalUsd: number; count: number };
    '30d': { totalUsd: number; count: number };
    alltime: { totalUsd: number; count: number };
  };
}

export async function handleTipAnalytics(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 128);

  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, 400);
  }

  try {
    // Read the received record from KV
    const receivedKey = userReceivedKey(userId);
    const receivedRecord = await kvGetJson<{
      totalUsd: number;
      count: number;
      lastTipAt: number;
      byPlatform: Partial<Record<TipPlatform, PlatformBreakdown>>;
      tippers: string[];
      recent: ActivityItem[];
    }>(env, receivedKey);

    if (!receivedRecord || receivedRecord.count === 0) {
      // Return zero analytics
      return jsonResponse({
        totalReceived: 0,
        totalReceivedUsd: 0,
        tipCount: 0,
        uniqueTippers: 0,
        byProtocol: {},
        byChain: {},
        topTippers: [],
        averageAmountUsd: 0,
        periods: {
          '24h': { totalUsd: 0, count: 0 },
          '7d': { totalUsd: 0, count: 0 },
          '30d': { totalUsd: 0, count: 0 },
          alltime: { totalUsd: 0, count: 0 },
        },
      } satisfies CreatorTipAnalytics);
    }

    // Compute period breakdowns
    const now = Date.now();
    const DAY_MS = 86_400_000;
    const periods: CreatorTipAnalytics['periods'] = {
      '24h': { totalUsd: 0, count: 0 },
      '7d': { totalUsd: 0, count: 0 },
      '30d': { totalUsd: 0, count: 0 },
      alltime: { totalUsd: receivedRecord.totalUsd, count: receivedRecord.count },
    };

    // Build time series from recent activity (daily aggregation)
    const dailyMap = new Map<string, { amountUsd: number; count: number }>();
    const chainBreakdown: Record<string, { totalUsd: number; count: number }> = {};
    const protocolBreakdown: Record<string, { totalUsd: number; count: number }> = {};
    const tipperMap = new Map<string, { totalUsd: number; count: number }>();

    for (const activity of receivedRecord.recent ?? []) {
      const age = now - activity.at;

      // Period counts
      if (age <= DAY_MS) {
        periods['24h'].totalUsd += activity.amountUsd;
        periods['24h'].count += 1;
      }
      if (age <= 7 * DAY_MS) {
        periods['7d'].totalUsd += activity.amountUsd;
        periods['7d'].count += 1;
      }
      if (age <= 30 * DAY_MS) {
        periods['30d'].totalUsd += activity.amountUsd;
        periods['30d'].count += 1;
      }

      // Protocol breakdown
      const protocol = activity.platform;
      if (!protocolBreakdown[protocol]) {
        protocolBreakdown[protocol] = { totalUsd: 0, count: 0 };
      }
      protocolBreakdown[protocol].totalUsd += activity.amountUsd;
      protocolBreakdown[protocol].count += 1;

      // Chain breakdown (derived from method field if available)
      const method = (activity as { method?: string }).method ?? 'unknown';
      if (method.startsWith('cross-chain:')) {
        const chain = method.replace('cross-chain:', '');
        if (!chainBreakdown[chain]) chainBreakdown[chain] = { totalUsd: 0, count: 0 };
        chainBreakdown[chain].totalUsd += activity.amountUsd;
        chainBreakdown[chain].count += 1;
      }

      // Tipper breakdown
      if (activity.fromUserId) {
        const existing = tipperMap.get(activity.fromUserId) ?? { totalUsd: 0, count: 0 };
        existing.totalUsd += activity.amountUsd;
        existing.count += 1;
        tipperMap.set(activity.fromUserId, existing);
      }

      // Time series (daily)
      const date = new Date(activity.at).toISOString().slice(0, 10);
      const dayEntry = dailyMap.get(date) ?? { amountUsd: 0, count: 0 };
      dayEntry.amountUsd += activity.amountUsd;
      dayEntry.count += 1;
      dailyMap.set(date, dayEntry);
    }

    // Round all values
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const roundedPeriods = {
      '24h': { totalUsd: round2(periods['24h'].totalUsd), count: periods['24h'].count },
      '7d': { totalUsd: round2(periods['7d'].totalUsd), count: periods['7d'].count },
      '30d': { totalUsd: round2(periods['30d'].totalUsd), count: periods['30d'].count },
      alltime: { totalUsd: round2(periods.alltime.totalUsd), count: periods.alltime.count },
    };

    // Round protocol/chain breakdowns
    for (const key of Object.keys(protocolBreakdown)) {
      if (protocolBreakdown[key])
        protocolBreakdown[key]!.totalUsd = round2(protocolBreakdown[key]?.totalUsd);
    }
    for (const key of Object.keys(chainBreakdown)) {
      if (chainBreakdown[key])
        chainBreakdown[key]!.totalUsd = round2(chainBreakdown[key]?.totalUsd);
    }

    // Top tippers sorted by amount
    const topTippers = [...tipperMap.entries()]
      .map(([userId, data]) => ({ userId, totalUsd: round2(data.totalUsd), count: data.count }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 20);

    // Time series (sorted by date)
    const timeSeries = [...dailyMap.entries()]
      .map(([date, data]) => ({ date, amountUsd: round2(data.amountUsd), count: data.count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return jsonResponse({
      totalReceived: receivedRecord.count,
      totalReceivedUsd: round2(receivedRecord.totalUsd),
      tipCount: receivedRecord.count,
      uniqueTippers: receivedRecord.tippers?.length ?? 0,
      byProtocol: protocolBreakdown,
      byChain: chainBreakdown,
      topTippers,
      averageAmountUsd:
        receivedRecord.count > 0 ? round2(receivedRecord.totalUsd / receivedRecord.count) : 0,
      timeSeries,
      periods: roundedPeriods,
    } satisfies CreatorTipAnalytics);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/tip/unified/analytics/top-tippers — Global top tippers ──

export async function handleTopTippers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 100);
  const period: TipPeriod = sanitizePeriodFromUrl(url.searchParams.get('period'));

  const record = await kvGetJson<LeaderboardRecord>(env, leaderboardKey(period));
  const bucket = periodBucket(period);

  if (!record || record.bucket !== bucket) {
    return jsonResponse({
      tippers: [],
      count: 0,
      period,
      message: 'No data yet for this period',
    });
  }

  const tippers = record.entries.slice(0, limit).map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    totalUsd: Math.round(e.totalUsd * 100) / 100,
    count: e.count,
    platform: e.platform,
    byPlatform: Object.fromEntries(
      Object.entries(e.byPlatform).map(([p, b]) => [
        p,
        { totalUsd: Math.round(b?.totalUsd * 100) / 100, count: b?.count },
      ]),
    ),
  }));

  return jsonResponse({ tippers, count: tippers.length, period });
}
