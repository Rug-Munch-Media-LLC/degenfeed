/**
 * @degenfeed/api-worker — Creator Rewards Program
 *
 * Distributes 20% of all platform fees to creators based on:
 *   - Engagement (40%)
 *   - Tips received (30%)
 *   - Holder growth (20%)
 *   - Coin activity (10%)
 *
 * Rewards are computed weekly and stored in KV for transparency.
 *
 * KV keys:
 *   rewards:pool              → { currentPool, totalDistributed, lastDistribution, nextDistribution }
 *   rewards:cycle:{weekId}    → { weekId, totalPool, distributions: [{ creator, amount, breakdown }] }
 *   rewards:creator:{address} → { totalEarned, lastClaimedAt, pendingAmount }
 *   rewards:history           → RewardDistribution[] (last 52 weeks)
 *   rewards:metrics:{address} → Creator weekly metrics for formula computation
 */

import { type Env, jsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RewardPool {
  /** Current pool balance in USD cents */
  currentPool: number;
  /** Total distributed all-time in USD cents */
  totalDistributed: number;
  /** Last distribution timestamp (unix ms) */
  lastDistribution: number;
  /** Next scheduled distribution timestamp (unix ms) */
  nextDistribution: number;
  /** Current week ID (ISO week) */
  currentWeek: string;
}

export interface CreatorMetrics {
  /** Creator wallet address */
  address: string;
  /** Engagement score (weighted) */
  engagementScore: number;
  /** Total tips received in USD cents */
  tipsReceived: number;
  /** Number of unique tippers */
  tipperCount: number;
  /** Holder count growth this week */
  holderGrowth: number;
  /** Coin trade volume in USD cents */
  coinVolume: number;
  /** Total coin transactions */
  coinTxCount: number;
  /** Weighted contribution to reward pool */
  contributionWeight: number;
  /** Timestamp */
  updatedAt: number;
}

export interface RewardDistribution {
  /** ISO week identifier (e.g., "2026-W30") */
  weekId: string;
  /** Total pool for this week in USD cents */
  totalPool: number;
  /** Distribution timestamp */
  distributedAt: number;
  /** Individual creator distributions */
  distributions: Array<{
    creator: string;
    amountUsdCents: number;
    breakdown: {
      engagement: number;
      tipsReceived: number;
      holderGrowth: number;
      coinActivity: number;
    };
  }>;
  /** Transaction hash of the distribution tx */
  txHash?: string;
}

export interface CreatorRewardRecord {
  address: string;
  totalEarned: number;
  lastClaimedAt: number;
  pendingAmount: number;
  pendingWeek: string;
  lastDistribution?: {
    weekId: string;
    amount: number;
    breakdown: RewardDistribution['distributions'][0]['breakdown'];
    claimed: boolean;
    claimedAt?: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────

const REWARD_POOL_KEY = 'rewards:pool';
const REWARD_HISTORY_KEY = 'rewards:history';
const REWARD_CREATOR_PREFIX = 'rewards:creator:';
const REWARD_CYCLE_PREFIX = 'rewards:cycle:';

const DISTRIBUTION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
const KV_TTL_YEAR = 60 * 60 * 24 * 365;

// Weights
const WEIGHT_ENGAGEMENT = 0.4;
const WEIGHT_TIPS = 0.3;
const WEIGHT_HOLDER_GROWTH = 0.2;
const WEIGHT_COIN_ACTIVITY = 0.1;

// Platform fee capture (20% of platform fees go to rewards)
const REWARD_POOL_FRACTION = 0.2;

// ─── Key builders ──────────────────────────────────────────────────────────

function creatorRewardKey(address: string): string {
  return `${REWARD_CREATOR_PREFIX}${address.toLowerCase()}`;
}

function cycleKey(weekId: string): string {
  return `${REWARD_CYCLE_PREFIX}${weekId}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Get ISO week ID string */
export function getWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return null;
}

async function kvPut(env: Env, key: string, value: unknown, ttl?: number): Promise<void> {
  try {
    await env.CACHE?.put(key, JSON.stringify(value), {
      expirationTtl: ttl ?? KV_TTL_YEAR,
    });
  } catch {
    /* ignore */
  }
}

// ─── Record platform fee contribution ─────────────────────────────────────
// Called by the billing system whenever a platform fee is collected.
// 20% of every fee is allocated to the creator rewards pool.

export async function recordPlatformFeeContribution(
  env: Env,
  feeAmountUsdCents: number,
): Promise<void> {
  if (!env.CACHE || feeAmountUsdCents <= 0) return;

  const contribution = Math.round(feeAmountUsdCents * REWARD_POOL_FRACTION);

  try {
    const pool = (await kvGet<RewardPool>(env, REWARD_POOL_KEY)) ?? {
      currentPool: 0,
      totalDistributed: 0,
      lastDistribution: 0,
      nextDistribution: getNextDistributionDate().getTime(),
      currentWeek: getWeekId(),
    };

    pool.currentPool += contribution;

    await kvPut(env, REWARD_POOL_KEY, pool);
  } catch (err) {
    console.error('[creator-rewards] Failed to record fee contribution:', err);
  }
}

function getNextDistributionDate(from: Date = new Date()): Date {
  // Next Monday at 14:00 UTC
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7));
  next.setUTCHours(14, 0, 0, 0);
  return next;
}

// ─── Record creator metrics ───────────────────────────────────────────────

export async function recordCreatorMetrics(
  env: Env,
  address: string,
  metrics: Partial<CreatorMetrics>,
): Promise<void> {
  const key = creatorRewardKey(address);
  const existing = (await kvGet<CreatorMetrics>(env, key)) ?? {
    address: address.toLowerCase(),
    engagementScore: 0,
    tipsReceived: 0,
    tipperCount: 0,
    holderGrowth: 0,
    coinVolume: 0,
    coinTxCount: 0,
    contributionWeight: 0,
    updatedAt: Date.now(),
  };

  const updated: CreatorMetrics = {
    ...existing,
    engagementScore: existing.engagementScore + (metrics.engagementScore ?? 0),
    tipsReceived: existing.tipsReceived + (metrics.tipsReceived ?? 0),
    tipperCount: Math.max(existing.tipperCount, metrics.tipperCount ?? 0),
    holderGrowth: Math.max(existing.holderGrowth, metrics.holderGrowth ?? 0),
    coinVolume: existing.coinVolume + (metrics.coinVolume ?? 0),
    coinTxCount: existing.coinTxCount + (metrics.coinTxCount ?? 0),
    updatedAt: Date.now(),
  };

  await kvPut(env, key, updated);
}

// ─── Compute rewards for all creators ─────────────────────────────────────
// Called by cron trigger (weekly)

export async function computeWeeklyRewards(env: Env): Promise<{
  weekId: string;
  totalPool: number;
  creatorCount: number;
}> {
  const weekId = getWeekId();
  const pool = await kvGet<RewardPool>(env, REWARD_POOL_KEY);

  if (!pool || pool.currentPool <= 0) {
    return { weekId, totalPool: 0, creatorCount: 0 };
  }

  const totalPool = pool.currentPool;

  // Collect all creators with metrics
  // In production, this would iterate over a creator index in KV
  // For now, we use a prefix scan approach
  const creatorKeys: string[] = [];
  try {
    const listResult = await env.CACHE?.list({ prefix: REWARD_CREATOR_PREFIX });
    if (listResult) {
      creatorKeys.push(...listResult.keys.map((k) => k.name));
    }
  } catch {
    /* ignore */
  }

  // Load metrics for each creator
  const allMetrics: Array<{ address: string; metrics: CreatorMetrics }> = [];
  for (const key of creatorKeys) {
    try {
      const raw = await env.CACHE?.get(key);
      if (raw) {
        const metrics = JSON.parse(raw) as CreatorMetrics;
        allMetrics.push({ address: key.replace(REWARD_CREATOR_PREFIX, ''), metrics });
      }
    } catch {
      /* ignore */
    }
  }

  if (allMetrics.length === 0) {
    // No creators with metrics — distribute proportionally or roll over
    return { weekId, totalPool, creatorCount: 0 };
  }

  // Calculate total weighted scores
  let totalEngagement = 0;
  let totalTips = 0;
  let totalHolderGrowth = 0;
  let totalCoinActivity = 0;

  for (const { metrics } of allMetrics) {
    totalEngagement += metrics.engagementScore;
    totalTips += metrics.tipsReceived;
    totalHolderGrowth += metrics.holderGrowth;
    totalCoinActivity += metrics.coinVolume;
  }

  // Distribute rewards
  const distributions: RewardDistribution['distributions'] = [];

  for (const { address, metrics } of allMetrics) {
    if (
      metrics.contributionWeight <= 0 &&
      metrics.engagementScore <= 0 &&
      metrics.tipsReceived <= 0
    ) {
      continue;
    }

    // Calculate weighted allocation
    const engagementShare = totalEngagement > 0 ? metrics.engagementScore / totalEngagement : 0;
    const tipsShare = totalTips > 0 ? metrics.tipsReceived / totalTips : 0;
    const holderShare = totalHolderGrowth > 0 ? metrics.holderGrowth / totalHolderGrowth : 0;
    const coinShare = totalCoinActivity > 0 ? metrics.coinVolume / totalCoinActivity : 0;

    const weightedShare =
      engagementShare * WEIGHT_ENGAGEMENT +
      tipsShare * WEIGHT_TIPS +
      holderShare * WEIGHT_HOLDER_GROWTH +
      coinShare * WEIGHT_COIN_ACTIVITY;

    const amountUsdCents = Math.round(totalPool * weightedShare);

    if (amountUsdCents <= 0) continue;

    distributions.push({
      creator: address,
      amountUsdCents,
      breakdown: {
        engagement: Math.round(amountUsdCents * engagementShare * WEIGHT_ENGAGEMENT),
        tipsReceived: Math.round(amountUsdCents * tipsShare * WEIGHT_TIPS),
        holderGrowth: Math.round(amountUsdCents * holderShare * WEIGHT_HOLDER_GROWTH),
        coinActivity: Math.round(amountUsdCents * coinShare * WEIGHT_COIN_ACTIVITY),
      },
    });
  }

  // Sort by amount descending
  distributions.sort((a, b) => b.amountUsdCents - a.amountUsdCents);

  const now = Date.now();
  const distribution: RewardDistribution = {
    weekId,
    totalPool,
    distributedAt: now,
    distributions,
  };

  // Store distribution record
  await kvPut(env, cycleKey(weekId), distribution);

  // Update creator reward records
  for (const dist of distributions) {
    const key = creatorRewardKey(dist.creator);
    const record = (await kvGet<CreatorRewardRecord>(env, key)) ?? {
      address: dist.creator,
      totalEarned: 0,
      lastClaimedAt: 0,
      pendingAmount: 0,
      pendingWeek: '',
    };

    record.totalEarned += dist.amountUsdCents;
    record.pendingAmount += dist.amountUsdCents;
    record.pendingWeek = weekId;
    record.lastDistribution = {
      weekId,
      amount: dist.amountUsdCents,
      breakdown: dist.breakdown,
      claimed: false,
    };

    await kvPut(env, key, record);
  }

  // Update pool
  const updatedPool: RewardPool = {
    currentPool: 0, // Reset for next cycle
    totalDistributed: pool.totalDistributed + totalPool,
    lastDistribution: now,
    nextDistribution: getNextDistributionDate(new Date(now + DISTRIBUTION_INTERVAL_MS)).getTime(),
    currentWeek: weekId,
  };
  await kvPut(env, REWARD_POOL_KEY, updatedPool);

  // Append to history
  const history = (await kvGet<RewardDistribution[]>(env, REWARD_HISTORY_KEY)) ?? [];
  await kvPut(env, REWARD_HISTORY_KEY, [distribution, ...history].slice(0, 52));

  return { weekId, totalPool, creatorCount: distributions.length };
}

// ─── API Handlers ─────────────────────────────────────────────────────────

// GET /api/creator/rewards — Current pool + estimated share

export async function handleCreatorRewards(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const address = session.address.toLowerCase();
  const pool = await kvGet<RewardPool>(env, REWARD_POOL_KEY);
  const creatorRecord = await kvGet<CreatorRewardRecord>(env, creatorRewardKey(address));

  return jsonResponse({
    pool: pool ?? {
      currentPool: 0,
      totalDistributed: 0,
      lastDistribution: 0,
      nextDistribution: getNextDistributionDate().getTime(),
      currentWeek: getWeekId(),
    },
    myRewards: creatorRecord ?? {
      address,
      totalEarned: 0,
      lastClaimedAt: 0,
      pendingAmount: 0,
      pendingWeek: '',
    },
    distributionInfo: {
      interval: 'weekly',
      nextDistribution: pool?.nextDistribution ?? getNextDistributionDate().getTime(),
      poolFraction: REWARD_POOL_FRACTION,
    },
  });
}

// GET /api/creator/rewards/history — Past distributions

export async function handleCreatorRewardsHistory(_request: Request, env: Env): Promise<Response> {
  const url = new URL(_request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 12, 52);

  const history = (await kvGet<RewardDistribution[]>(env, REWARD_HISTORY_KEY)) ?? [];
  return jsonResponse({
    history: history.slice(0, limit),
    count: history.length,
  });
}

// POST /api/creator/rewards/claim — Claim pending rewards

export async function handleCreatorRewardsClaim(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const address = session.address.toLowerCase();
  const key = creatorRewardKey(address);
  const record = await kvGet<CreatorRewardRecord>(env, key);

  if (!record || record.pendingAmount <= 0) {
    return jsonResponse({ error: 'No pending rewards to claim' }, 400);
  }

  const claimAmount = record.pendingAmount;

  // Update record
  record.pendingAmount = 0;
  record.pendingWeek = '';
  record.lastClaimedAt = Date.now();
  if (record.lastDistribution) {
    record.lastDistribution.claimed = true;
    record.lastDistribution.claimedAt = Date.now();
  }

  await kvPut(env, key, record);

  return jsonResponse({
    success: true,
    claimedAmountUsdCents: claimAmount,
    claimedAmountUsd: (claimAmount / 100).toFixed(2),
    message: `Successfully claimed $${(claimAmount / 100).toFixed(2)} in creator rewards`,
    txHash: `0x${crypto.randomUUID().replace(/-/g, '')}`, // In production, this would be the actual tx
  });
}

// GET /api/creator/rewards/leaderboard — Top earning creators from rewards

export async function handleCreatorRewardsLeaderboard(
  _request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(_request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 100);

  // For demo, use the latest distribution cycle
  const weekId = getWeekId();
  const cycle = await kvGet<RewardDistribution>(env, cycleKey(weekId));
  const prevWeekId = getWeekId(new Date(Date.now() - DISTRIBUTION_INTERVAL_MS));
  const prevCycle = await kvGet<RewardDistribution>(env, cycleKey(prevWeekId));

  if (!cycle || cycle.distributions.length === 0) {
    return jsonResponse({ leaderboard: [], count: 0, weekId });
  }

  const leaderboard = cycle.distributions.slice(0, limit).map((d, i) => {
    // Find previous week's rank (if available)
    const prevRank = prevCycle?.distributions.findIndex((p) => p.creator === d.creator) ?? -1;
    return {
      rank: i + 1,
      creator: d.creator,
      amountUsdCents: d.amountUsdCents,
      amountUsd: (d.amountUsdCents / 100).toFixed(2),
      breakdown: d.breakdown,
      change: prevRank >= 0 ? prevRank - i : 0, // Positive = rising
    };
  });

  return jsonResponse({
    leaderboard,
    count: leaderboard.length,
    weekId,
    totalPool: cycle.totalPool,
    distributedAt: cycle.distributedAt,
  });
}

// POST /api/creator/rewards/compute — Trigger weekly computation (admin only)

export async function handleCreatorRewardsCompute(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Admin check
  if (env.ADMIN_WALLETS) {
    const admins = env.ADMIN_WALLETS.split(',').map((a) => a.trim().toLowerCase());
    if (!admins.includes(session.address.toLowerCase())) {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }
  }

  const result = await computeWeeklyRewards(env);
  return jsonResponse({ success: true, ...result });
}
