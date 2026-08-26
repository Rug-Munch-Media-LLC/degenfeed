/**
 * @degenfeed/api-worker — Platform Treasury & Fee System (TASK 4)
 *
 * DegenFeed charges 0.5% on every buy/sell of every creator coin.
 * This module handles:
 *   1. Fee collection tracking in KV
 *   2. Weekly revenue report generation
 *   3. Fee distribution: 60% protocol treasury, 20% DegenFeed ops, 20% creator reward pool
 *   4. On-chain treasury address configuration
 *   5. Revenue transparency endpoint (via creator-dashboard.ts)
 */

import { log } from '../logger';
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────

/** Platform fee: 0.5% = 50 bps */
export const PLATFORM_FEE_BPS = 50;
/** Basis points denominator */
const BPS_DENOM = 10_000;
/** Fee distribution splits (in percent) */
export const FEE_DISTRIBUTION = {
  protocolTreasury: 0.6, // 60% to protocol treasury
  degenfeedOps: 0.2, // 20% to DegenFeed operations
  creatorRewardPool: 0.2, // 20% to creator reward pool
} as const;

/** Default on-chain treasury address (Base) */
export const DEFAULT_TREASURY_ADDRESS = '0x0000000000000000000000000000000000000000';

// ─── KV Key Patterns ───────────────────────────────────────────────────

const KV_PREFIX = {
  feeEvent: 'treasury:fee:',
  dailyAggregate: 'treasury:daily:',
  weeklyReport: 'treasury:weekly:',
  config: 'treasury:config',
  revenueAggregate: 'platform:revenue:aggregate',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────

export interface FeeEvent {
  id: string;
  coinAddress: string;
  tradeType: 'buy' | 'sell';
  tradeValue: string; // In smallest units (wei/lamports)
  feeAmount: string; // Fee collected in smallest units
  feeUsd: number; // Fee in USD
  trader: string;
  timestamp: number;
  chain: 'solana' | 'base';
  txHash: string;
}

export interface DailyAggregate {
  date: string; // YYYY-MM-DD
  totalFeesWei: string;
  totalFeesUsd: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  uniqueCoins: number;
  uniqueTraders: number;
}

export interface WeeklyReport {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  totalFeesUsd: number;
  totalTrades: number;
  averageDailyFeesUsd: number;
  topCoins: Array<{ address: string; feesUsd: number; name: string; symbol: string }>;
  distribution: {
    protocolTreasury: number;
    degenfeedOps: number;
    creatorRewardPool: number;
  };
  generatedAt: number;
}

export interface TreasuryConfig {
  treasuryAddress: string;
  opsWallet: string;
  rewardPoolAddress: string;
  updatedAt: number;
  updatedBy: string;
}

// ─── Fee Collection ────────────────────────────────────────────────────

/**
 * Record a platform fee event from a creator coin trade.
 * Called after every buy/sell to track fee collection.
 */
export async function recordFeeEvent(
  env: Env,
  event: Omit<FeeEvent, 'id' | 'timestamp'>,
): Promise<void> {
  if (!env.CACHE) return;

  const feeEvent: FeeEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };

  // Store individual fee event (TTL: 90 days)
  const eventKey = `${KV_PREFIX.feeEvent}${feeEvent.id}`;
  await env.CACHE.put(eventKey, JSON.stringify(feeEvent), {
    expirationTtl: 90 * 86400,
  });

  // Update daily aggregate
  const today = new Date().toISOString().slice(0, 10);
  await updateDailyAggregate(env, today, feeEvent);

  // Update global aggregate
  await updateGlobalAggregate(env, feeEvent);

  log('info', '[treasury] Fee recorded', {
    coinAddress: feeEvent.coinAddress.slice(0, 10),
    feeUsd: feeEvent.feeUsd,
    tradeType: feeEvent.tradeType,
  });
}

/**
 * Calculate platform fee for a given trade amount.
 * Fee = amount * 0.5%
 */
export function calculatePlatformFee(amountWei: bigint): bigint {
  return (amountWei * BigInt(PLATFORM_FEE_BPS)) / BigInt(BPS_DENOM);
}

/**
 * Convert wei amount to a rough USD estimate using a price feed.
 */
export function weiToUsd(weiAmount: bigint, nativePriceUsd: number): number {
  const weiInEth = 1_000_000_000_000_000_000n;
  const ethAmount = Number(weiAmount) / Number(weiInEth);
  return ethAmount * nativePriceUsd;
}

// ─── Daily Aggregation ─────────────────────────────────────────────────

async function updateDailyAggregate(env: Env, date: string, event: FeeEvent): Promise<void> {
  const key = `${KV_PREFIX.dailyAggregate}${date}`;
  const existing = await getDailyAggregate(env, date);

  const updated: DailyAggregate = existing
    ? {
        ...existing,
        totalFeesWei: (BigInt(existing.totalFeesWei) + BigInt(event.feeAmount)).toString(),
        totalFeesUsd: existing.totalFeesUsd + event.feeUsd,
        tradeCount: existing.tradeCount + 1,
        buyCount: existing.buyCount + (event.tradeType === 'buy' ? 1 : 0),
        sellCount: existing.sellCount + (event.tradeType === 'sell' ? 1 : 0),
        uniqueCoins: existing.uniqueCoins + 1, // Approximate — simplified
        uniqueTraders: existing.uniqueTraders + 1,
      }
    : {
        date,
        totalFeesWei: event.feeAmount,
        totalFeesUsd: event.feeUsd,
        tradeCount: 1,
        buyCount: event.tradeType === 'buy' ? 1 : 0,
        sellCount: event.tradeType === 'sell' ? 1 : 0,
        uniqueCoins: 1,
        uniqueTraders: 1,
      };

  if (!env.CACHE) return;
  await env.CACHE.put(key, JSON.stringify(updated), {
    expirationTtl: 365 * 86400, // 1 year
  });
}

async function getDailyAggregate(env: Env, date: string): Promise<DailyAggregate | null> {
  const key = `${KV_PREFIX.dailyAggregate}${date}`;
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    return raw ? (JSON.parse(raw) as DailyAggregate) : null;
  } catch {
    return null;
  }
}

// ─── Global Aggregate ──────────────────────────────────────────────────

async function updateGlobalAggregate(env: Env, event: FeeEvent): Promise<void> {
  const key = KV_PREFIX.revenueAggregate;
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(key);
    const existing = raw
      ? (JSON.parse(raw) as {
          totalFeesCollected: string;
          totalTrades: number;
          activeCoins: number;
          dailyVolume: string;
          feeDistribution: {
            protocolTreasury: string;
            degenfeedOps: string;
            creatorRewardPool: string;
          };
          lastUpdated: number;
        })
      : null;

    const feeNum = Number.parseInt(event.feeAmount, 10) || 0;
    const totalFees = existing ? Number.parseInt(existing.totalFeesCollected, 10) + feeNum : feeNum;
    const protocolShare = Math.floor(totalFees * FEE_DISTRIBUTION.protocolTreasury);
    const opsShare = Math.floor(totalFees * FEE_DISTRIBUTION.degenfeedOps);
    const rewardShare = Math.floor(totalFees * FEE_DISTRIBUTION.creatorRewardPool);

    const updated = {
      totalFeesCollected: String(totalFees),
      totalTrades: (existing?.totalTrades ?? 0) + 1,
      activeCoins: (existing?.activeCoins ?? 0) + 1,
      dailyVolume: String(
        (Number.parseInt(existing?.dailyVolume ?? '0', 10) || 0) +
          Number.parseInt(event.tradeValue, 10),
      ),
      feeDistribution: {
        protocolTreasury: String(protocolShare),
        degenfeedOps: String(opsShare),
        creatorRewardPool: String(rewardShare),
      },
      lastUpdated: Date.now(),
    };

    await env.CACHE.put(key, JSON.stringify(updated));
  } catch (err) {
    log('error', '[treasury] Failed to update global aggregate', String(err));
  }
}

// ─── Weekly Report Generation ──────────────────────────────────────────

/**
 * Generate a weekly revenue report from daily aggregates.
 * Call this from a cron job (e.g., every Monday 00:00 UTC).
 */
export async function generateWeeklyReport(env: Env): Promise<WeeklyReport | null> {
  if (!env.CACHE) return null;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset - 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  let totalFeesUsd = 0;
  let totalTrades = 0;
  let dayCount = 0;
  const coinFees = new Map<
    string,
    { feesUsd: number; name: string; symbol: string; address: string }
  >();

  // Iterate over each day in the week
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    const agg = await getDailyAggregate(env, fmt(d));
    if (agg) {
      totalFeesUsd += agg.totalFeesUsd;
      totalTrades += agg.tradeCount;
      dayCount++;
    }
  }

  const report: WeeklyReport = {
    weekStart: fmt(weekStart),
    weekEnd: fmt(weekEnd),
    totalFeesUsd,
    totalTrades,
    averageDailyFeesUsd: dayCount > 0 ? Math.round(totalFeesUsd / dayCount) : 0,
    topCoins: Array.from(coinFees.values())
      .sort((a, b) => b.feesUsd - a.feesUsd)
      .slice(0, 10),
    distribution: {
      protocolTreasury: Math.round(totalFeesUsd * FEE_DISTRIBUTION.protocolTreasury),
      degenfeedOps: Math.round(totalFeesUsd * FEE_DISTRIBUTION.degenfeedOps),
      creatorRewardPool: Math.round(totalFeesUsd * FEE_DISTRIBUTION.creatorRewardPool),
    },
    generatedAt: Date.now(),
  };

  const reportKey = `${KV_PREFIX.weeklyReport}${fmt(weekStart)}`;
  await env.CACHE.put(reportKey, JSON.stringify(report), {
    expirationTtl: 365 * 86400,
  });

  log('info', '[treasury] Weekly report generated', {
    weekStart: report.weekStart,
    totalFeesUsd: report.totalFeesUsd,
    totalTrades: report.totalTrades,
  });

  return report;
}

// ─── Treasury Configuration ────────────────────────────────────────────

/**
 * Get the current treasury configuration.
 */
export async function getTreasuryConfig(env: Env): Promise<TreasuryConfig> {
  try {
    const raw = await env.CACHE?.get(KV_PREFIX.config);
    if (raw) return JSON.parse(raw) as TreasuryConfig;
  } catch {
    // Fall through to default
  }

  return {
    treasuryAddress: DEFAULT_TREASURY_ADDRESS,
    opsWallet: '',
    rewardPoolAddress: '',
    updatedAt: 0,
    updatedBy: '',
  };
}

/**
 * Update treasury configuration (governance-gated in production).
 */
export async function updateTreasuryConfig(
  env: Env,
  config: Partial<TreasuryConfig>,
  updatedBy: string,
): Promise<TreasuryConfig> {
  const current = await getTreasuryConfig(env);
  const updated: TreasuryConfig = {
    ...current,
    ...config,
    updatedAt: Date.now(),
    updatedBy,
  };

  await env.CACHE?.put(KV_PREFIX.config, JSON.stringify(updated));

  log('info', '[treasury] Config updated', { updatedBy: updatedBy.slice(0, 10) });
  return updated;
}

// ─── Fee Distribution Calculation ──────────────────────────────────────

/**
 * Calculate how a given fee amount should be distributed.
 * Returns amounts for each recipient.
 */
export function calculateFeeDistribution(totalFeeWei: bigint): {
  protocolTreasury: bigint;
  degenfeedOps: bigint;
  creatorRewardPool: bigint;
} {
  return {
    protocolTreasury:
      (totalFeeWei * BigInt(Math.round(FEE_DISTRIBUTION.protocolTreasury * 100))) / 100n,
    degenfeedOps: (totalFeeWei * BigInt(Math.round(FEE_DISTRIBUTION.degenfeedOps * 100))) / 100n,
    creatorRewardPool:
      (totalFeeWei * BigInt(Math.round(FEE_DISTRIBUTION.creatorRewardPool * 100))) / 100n,
  };
}

// ─── Fee Percentage Display ────────────────────────────────────────────

export function platformFeePercentage(): string {
  return `${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`;
}

export function platformFeeDisclosure(): string {
  return (
    `DegenFeed charges ${platformFeePercentage()} on all creator coin trades. ` +
    `Fees are distributed: ${FEE_DISTRIBUTION.protocolTreasury * 100}% to protocol treasury, ` +
    `${FEE_DISTRIBUTION.degenfeedOps * 100}% to operations, ` +
    `${FEE_DISTRIBUTION.creatorRewardPool * 100}% to creator rewards.`
  );
}
