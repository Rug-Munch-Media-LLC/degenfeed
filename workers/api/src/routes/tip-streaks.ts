/**
 * @degenfeed/api-worker — Tip Streaks & Incentives Backend
 *
 * TASK 5: Tip Incentives
 * Tracks tip streaks, awards badges, manages revenue goals,
 * and provides leaderboard data for the tipping UI.
 *
 * Uses KV-based streak tracking with 1-year TTL.
 *
 * @see ../routes/unified-tip-core.ts — Core tip recording + badge system
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import type { Env } from '../types';
import { awardBadge, kvGetJson, kvPutJson, type UnifiedTipEvent } from './unified-tip-core';

// ─── Types ───────────────────────────────────────────────────────────────

const _VALID_METHODS = [
  'direct_onchain',
  'resolve_identity',
  'protocol_native',
  'generate_link',
  'generate_qr',
];

export interface TipStreakRecord {
  /** Current streak count in days */
  currentStreak: number;
  /** Longest streak ever achieved */
  longestStreak: number;
  /** Last date a tip was sent (YYYY-MM-DD) */
  lastTipDate: string;
  /** When the streak started */
  streakStartDate: string;
  /** When the record was last updated */
  updatedAt: number;
  /** Consecutive days tipped this week */
  weekDaysTipped: number;
  /** Badges earned from this streak */
  badges: string[];
}

export interface RevenueGoal {
  /** Monthly revenue target in USD */
  targetUsd: number;
  /** Current progress in USD */
  currentUsd: number;
  /** Goal period (month) */
  period: string; // YYYY-MM
  /** Goal label */
  label: string;
  /** Whether the goal is active */
  active: boolean;
}

export interface TipStreakBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  streakDays: number;
}

/** Tip streak badges */
export const TIP_STREAK_BADGES: TipStreakBadge[] = [
  {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Tipped 3 days in a row',
    icon: '🔥',
    requirement: 'Tip 3 consecutive days',
    streakDays: 3,
  },
  {
    id: 'streak_5',
    name: '5-Day Streak',
    description: 'Tipped 5 days in a row',
    icon: '⭐',
    requirement: 'Tip 5 consecutive days',
    streakDays: 5,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Tipped 7 days in a row',
    icon: '💪',
    requirement: 'Tip 7 consecutive days',
    streakDays: 7,
  },
  {
    id: 'streak_14',
    name: 'Fortnight Flame',
    description: 'Tipped 14 days in a row',
    icon: '🔥',
    requirement: 'Tip 14 consecutive days',
    streakDays: 14,
  },
  {
    id: 'streak_30',
    name: 'Monthly MVP',
    description: 'Tipped 30 days in a row',
    icon: '🏆',
    requirement: 'Tip 30 consecutive days',
    streakDays: 30,
  },
  {
    id: 'streak_100',
    name: 'Centurion Tipper',
    description: 'Tipped 100 days in a row',
    icon: '👑',
    requirement: 'Tip 100 consecutive days',
    streakDays: 100,
  },
];

// ─── Key Builders ────────────────────────────────────────────────────────

function streakKey(userId: string): string {
  return `tip:streak:${userId}`;
}
function goalKey(userId: string, period: string): string {
  return `tip:goal:${userId}:${period}`;
}
function leaderboardKey(entityId: string): string {
  return `tip:leaderboard:post:${entityId}`;
}

// ─── Today's date helper ─────────────────────────────────────────────────

function todayDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function yesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// ─── Streak Tracking ─────────────────────────────────────────────────────

/**
 * Update the tip streak for a user after they send a tip.
 * Called from recordUnifiedTip when a tip is recorded.
 *
 * Streak rules:
 * - Same day → no change (only counts once per day)
 * - Consecutive day → increment streak
 * - Gap → reset streak to 1
 * - Check and award streak badges
 */
export async function updateTipStreak(env: Env, userId: string): Promise<TipStreakRecord> {
  const key = streakKey(userId);
  const now = todayDate();
  const yesterday = yesterdayDate();

  const record = (await kvGetJson<TipStreakRecord>(env, key)) ?? {
    currentStreak: 0,
    longestStreak: 0,
    lastTipDate: '',
    streakStartDate: now,
    updatedAt: Date.now(),
    weekDaysTipped: 0,
    badges: [],
  };

  // Same day — no streak update (prevent double-counting)
  if (record.lastTipDate === now) {
    return record;
  }

  // Consecutive day after yesterday
  if (record.lastTipDate === yesterday) {
    record.currentStreak += 1;

    // Update longest streak
    if (record.currentStreak > record.longestStreak) {
      record.longestStreak = record.currentStreak;
    }

    // Check for streak badges
    for (const badge of TIP_STREAK_BADGES) {
      if (record.currentStreak >= badge.streakDays && !record.badges.includes(badge.id)) {
        await awardBadge(env, userId, badge.id);
        record.badges.push(badge.id);
      }
    }

    // Week days tipped (reset logic handled by weekly badge check)
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      record.weekDaysTipped += 1;
    }
  }
  // Not consecutive — different day but not yesterday
  else if (record.lastTipDate !== now && record.lastTipDate !== yesterday) {
    // Gap found — reset streak
    record.currentStreak = 1;
    record.streakStartDate = now;
    record.weekDaysTipped = 1;
  }

  record.lastTipDate = now;
  record.updatedAt = Date.now();

  await kvPutJson(env, key, record);
  return record;
}

/**
 * Get the current tip streak for a user.
 */
export async function getTipStreak(env: Env, userId: string): Promise<TipStreakRecord> {
  const key = streakKey(userId);
  return (
    kvGetJson<TipStreakRecord>(env, key) ?? {
      currentStreak: 0,
      longestStreak: 0,
      lastTipDate: '',
      streakStartDate: todayDate(),
      updatedAt: Date.now(),
      weekDaysTipped: 0,
      badges: [],
    }
  );
}

// ─── Revenue Goals ───────────────────────────────────────────────────────

/**
 * Update revenue goal progress for a creator.
 */
export async function updateRevenueGoal(
  env: Env,
  userId: string,
  amountUsd: number,
): Promise<RevenueGoal> {
  const period = currentPeriod();
  const key = goalKey(userId, period);

  const goal = (await kvGetJson<RevenueGoal>(env, key)) ?? {
    targetUsd: 100, // Default monthly target
    currentUsd: 0,
    period,
    label: `Monthly goal (${period})`,
    active: true,
  };

  goal.currentUsd = Math.round((goal.currentUsd + amountUsd) * 100) / 100;
  goal.updatedAt = Date.now();

  await kvPutJson(env, key, goal);
  return goal;
}

/**
 * Get or set a revenue goal for a creator.
 */
export async function getRevenueGoal(env: Env, userId: string): Promise<RevenueGoal> {
  const period = currentPeriod();
  const key = goalKey(userId, period);

  const existing = await kvGetJson<RevenueGoal>(env, key);
  if (existing) return existing;

  return {
    targetUsd: 100,
    currentUsd: 0,
    period,
    label: `Monthly goal (${period})`,
    active: true,
  };
}

/**
 * Set a revenue goal target for a creator.
 */
export async function setRevenueGoal(
  env: Env,
  userId: string,
  targetUsd: number,
): Promise<RevenueGoal> {
  const period = currentPeriod();
  const key = goalKey(userId, period);

  const goal = (await kvGetJson<RevenueGoal>(env, key)) ?? {
    targetUsd: 100,
    currentUsd: 0,
    period,
    label: `Monthly goal (${period})`,
    active: true,
  };

  goal.targetUsd = Math.max(1, targetUsd);
  goal.updatedAt = Date.now();

  await kvPutJson(env, key, goal);
  return goal;
}

// ─── Per-Post Leaderboard ────────────────────────────────────────────────

export interface PostTipEntry {
  tipperId: string;
  tipperName: string;
  amountUsd: number;
  method: string;
  at: number;
}

export interface PostLeaderboard {
  entityId: string;
  tips: PostTipEntry[];
  totalUsd: number;
  topTippers: Array<{ tipperId: string; tipperName: string; totalUsd: number; count: number }>;
  updatedAt: number;
}

/**
 * Track a tip on a specific post for the per-post leaderboard.
 */
export async function recordPostTip(
  env: Env,
  entityId: string,
  entry: PostTipEntry,
): Promise<void> {
  const key = leaderboardKey(entityId);
  const board = (await kvGetJson<PostLeaderboard>(env, key)) ?? {
    entityId,
    tips: [],
    totalUsd: 0,
    topTippers: [],
    updatedAt: 0,
  };

  board.tips.unshift(entry);
  board.totalUsd = Math.round((board.totalUsd + entry.amountUsd) * 100) / 100;
  board.updatedAt = Date.now();

  // Keep last 100 tips
  board.tips = board.tips.slice(0, 100);

  // Recalculate top tippers
  const tipperMap = new Map<
    string,
    { tipperId: string; tipperName: string; totalUsd: number; count: number }
  >();
  for (const t of board.tips) {
    const existing = tipperMap.get(t.tipperId) ?? {
      tipperId: t.tipperId,
      tipperName: t.tipperName,
      totalUsd: 0,
      count: 0,
    };
    existing.totalUsd = Math.round((existing.totalUsd + t.amountUsd) * 100) / 100;
    existing.count += 1;
    tipperMap.set(t.tipperId, existing);
  }

  board.topTippers = [...tipperMap.values()].sort((a, b) => b.totalUsd - a.totalUsd).slice(0, 10);

  await kvPutJson(env, key, board);
}

/**
 * Get the leaderboard for a specific post.
 */
export async function getPostLeaderboard(
  env: Env,
  entityId: string,
): Promise<PostLeaderboard | null> {
  const key = leaderboardKey(entityId);
  return kvGetJson<PostLeaderboard>(env, key);
}

// ─── Hook into unified tip recording ────────────────────────────────────

/**
 * Called after a tip is recorded to update streaks, goals, and leaderboards.
 * This is a fire-and-forget call from recordUnifiedTip.
 */
export async function handleTipIncentives(env: Env, event: UnifiedTipEvent): Promise<void> {
  const promises: Array<Promise<unknown>> = [];

  // Update sender's streak
  if (event.fromUserId) {
    promises.push(updateTipStreak(env, event.fromUserId));
  }

  // Update recipient's revenue goal
  if (event.toUserId) {
    promises.push(updateRevenueGoal(env, event.toUserId, event.amountUsd));
  }

  // Record per-post leaderboard entry
  if (event.fromUserId && event.fromLabel) {
    promises.push(
      recordPostTip(env, event.entityId, {
        tipperId: event.fromUserId,
        tipperName: event.fromLabel,
        amountUsd: event.amountUsd,
        method: event.method ?? 'tip',
        at: Date.now(),
      }),
    );
  }

  await Promise.allSettled(promises);
}

// ─── API Handlers ────────────────────────────────────────────────────────

/**
 * GET /api/tip/streak?userId=xxx
 * Returns the tip streak for a user.
 */
export async function handleGetStreak(request: Request, env: Env): Promise<Response> {
  const userId = sanitizeString(new URL(request.url).searchParams.get('userId'), 128);
  if (!userId || hasSuspiciousPayload(userId)) {
    return jsonResponse({ error: 'userId required' }, 400);
  }
  const streak = await getTipStreak(env, userId);
  return jsonResponse(streak);
}

/**
 * GET /api/tip/goal?userId=xxx
 * Returns the revenue goal and progress for a user.
 */
export async function handleGetGoal(request: Request, env: Env): Promise<Response> {
  const userId = sanitizeString(new URL(request.url).searchParams.get('userId'), 128);
  if (!userId || hasSuspiciousPayload(userId)) {
    return jsonResponse({ error: 'userId required' }, 400);
  }
  const goal = await getRevenueGoal(env, userId);
  return jsonResponse(goal);
}

/**
 * POST /api/tip/goal
 * Body: { userId, targetUsd }
 * Sets a revenue goal for a user.
 */
export async function handleSetGoal(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 2 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as { userId?: string; targetUsd?: number };
    const userId = sanitizeString(body.userId, 128);
    const targetUsd = body.targetUsd;

    if (!userId || !targetUsd || targetUsd < 1 || targetUsd > 1_000_000) {
      return jsonResponse({ error: 'Valid userId and targetUsd (1-1,000,000) required' }, 400);
    }

    const goal = await setRevenueGoal(env, userId, targetUsd);
    return jsonResponse(goal);
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

/**
 * GET /api/tip/post-leaderboard?entityId=xxx
 * Returns the leaderboard for a specific post.
 */
export async function handlePostLeaderboard(request: Request, env: Env): Promise<Response> {
  const entityId = sanitizeString(new URL(request.url).searchParams.get('entityId'), 256);
  if (!entityId || hasSuspiciousPayload(entityId)) {
    return jsonResponse({ error: 'entityId required' }, 400);
  }

  const board = await getPostLeaderboard(env, entityId);
  if (!board) {
    return jsonResponse({ entityId, tips: [], totalUsd: 0, topTippers: [] });
  }

  return jsonResponse(board);
}

/**
 * GET /api/tip/streak-badges
 * Returns the list of all tip streak badges with their requirements.
 */
export async function handleStreakBadges(_request: Request): Promise<Response> {
  return jsonResponse({
    badges: TIP_STREAK_BADGES,
    count: TIP_STREAK_BADGES.length,
  });
}
