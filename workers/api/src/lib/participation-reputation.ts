/**
 * @degenfeed/api-worker — Participation Reputation Engine
 *
 * Assigns reputation scores (0–1000) based on DAO participation actions,
 * with decay over inactivity periods. Tied to the REPUTATION KV namespace.
 *
 * KV schema:
 *   reputation:{userId}                          → ReputationRecord
 *   reputation:{userId}:history                  → ReputationEvent[] (capped at 500)
 *   reputation:{userId}:daily:{date}             → DailyCounter (rate limits)
 *   dao:leaderboard:{daoId}:{period}             → LeaderboardEntry[]
 *   reputation:dao:{daoId}:most-active-week      → ActiveMember[]
 *
 * Periods: weekly, monthly, alltime
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReputationAction =
  | 'vote_cast'
  | 'proposal_created'
  | 'proposal_passed'
  | 'treasury_managed'
  | 'member_recruited'
  | 'discussion_participation'
  | 'delegation_trusted'
  | 'consistent_voter'
  | 'early_member'
  | 'consecutive_vote_bonus';

export interface ReputationEvent {
  action: ReputationAction;
  points: number;
  timestamp: number;
  daoId?: string;
  meta?: Record<string, unknown>;
}

export interface ReputationRecord {
  userId: string;
  total: number;
  level: ReputationLevel;
  history: ReputationEvent[];
  lastActiveAt: number;
  joinedAt: number;
  consecutiveVotes: number;
  lastFiveProposalsVoted: boolean;
}

export interface DailyCounter {
  date: string;
  votes: number;
  discussions: number;
}

export type ReputationLevel =
  | 'contributor'
  | 'active_member'
  | 'core_member'
  | 'guardian'
  | 'steward';

export interface ReputationLevelInfo {
  id: ReputationLevel;
  label: string;
  icon: string;
  minScore: number;
  maxScore: number;
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  score: number;
  level: ReputationLevel;
  change: number; // position change since last period
  displayName?: string;
  avatarUrl?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const MAX_REPUTATION = 1000;
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export const INACTIVITY_DECAY_PCT = 5; // 5% per month
export const DAILY_VOTE_LIMIT = 50;
export const DAILY_DISCUSSION_LIMIT = 20;
export const CONSECUTIVE_PROPOSAL_THRESHOLD = 5;
export const EARLY_MEMBER_DAYS = 30;
export const HISTORY_CAP = 500;
export const LEADERBOARD_CAP = 100;

export const REPUTATION_LEVELS: ReputationLevelInfo[] = [
  { id: 'contributor', label: 'Contributor', icon: '🥉', minScore: 0, maxScore: 100 },
  { id: 'active_member', label: 'Active Member', icon: '🥈', minScore: 101, maxScore: 300 },
  { id: 'core_member', label: 'Core Member', icon: '🥇', minScore: 301, maxScore: 600 },
  { id: 'guardian', label: 'Guardian', icon: '💎', minScore: 601, maxScore: 900 },
  { id: 'steward', label: 'Steward', icon: '👑', minScore: 901, maxScore: 1000 },
];

const ACTION_POINTS: Record<ReputationAction, { points: number; dailyCap?: number }> = {
  vote_cast: { points: 5, dailyCap: DAILY_VOTE_LIMIT },
  proposal_created: { points: 50 },
  proposal_passed: { points: 100 },
  treasury_managed: { points: 25 },
  member_recruited: { points: 30 },
  discussion_participation: { points: 2, dailyCap: DAILY_DISCUSSION_LIMIT },
  delegation_trusted: { points: 50 },
  consistent_voter: { points: 10 },
  early_member: { points: 100 },
  consecutive_vote_bonus: { points: 10 },
};

// ─── KV helpers (REPUTATION namespace) ─────────────────────────────────────

function repKey(userId: string): string {
  return `reputation:${userId}`;
}

function repHistoryKey(userId: string): string {
  return `reputation:${userId}:history`;
}

function dailyCounterKey(userId: string, date: string): string {
  return `reputation:${userId}:daily:${date}`;
}

function leaderboardKey(daoId: string, period: string): string {
  return `dao:leaderboard:${daoId}:${period}`;
}

function mostActiveKey(daoId: string): string {
  return `reputation:dao:${daoId}:most-active-week`;
}

async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function kvPut(env: Env, key: string, value: unknown, ttl = 0): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(value), ttl > 0 ? { expirationTtl: ttl } : undefined);
  } catch {
    /* non-critical */
  }
}

// ─── Core helpers ──────────────────────────────────────────────────────────

/** Resolve the reputation level for a given score (0–1000). */
export function computeLevel(score: number): ReputationLevel {
  const clamped = Math.max(0, Math.min(MAX_REPUTATION, score));
  for (const level of REPUTATION_LEVELS) {
    if (clamped >= level.minScore && clamped <= level.maxScore) return level.id;
  }
  return 'contributor';
}

/** Get level metadata. */
export function getLevelInfo(level: ReputationLevel): ReputationLevelInfo {
  return REPUTATION_LEVELS.find((l) => l.id === level) ?? REPUTATION_LEVELS[0]!;
}

/** Calculate inactivity decay (+5% per full month since last active). */
export function computeDecay(record: ReputationRecord): number {
  const now = Date.now();
  const elapsed = now - record.lastActiveAt;
  if (elapsed < MONTH_MS) return 0;
  const fullMonths = Math.floor(elapsed / MONTH_MS);
  const decay = Math.min(
    MAX_REPUTATION,
    Math.floor((record.total * (INACTIVITY_DECAY_PCT * fullMonths)) / 100),
  );
  return decay;
}

/** Today's date string in YYYY-MM-DD format. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Check and increment a daily counter, returning true if the action is allowed. */
async function checkDailyCap(env: Env, userId: string, action: ReputationAction): Promise<boolean> {
  const config = ACTION_POINTS[action];
  if (!config?.dailyCap) return true; // no cap

  const date = todayStr();
  const key = dailyCounterKey(userId, date);
  const counter = (await kvGet<DailyCounter>(env, key)) ?? { date, votes: 0, discussions: 0 };

  if (action === 'vote_cast' && counter.votes >= DAILY_VOTE_LIMIT) return false;
  if (action === 'discussion_participation' && counter.discussions >= DAILY_DISCUSSION_LIMIT)
    return false;

  if (action === 'vote_cast') counter.votes += 1;
  if (action === 'discussion_participation') counter.discussions += 1;

  await kvPut(env, key, counter, 86400); // 24h TTL
  return true;
}

// ─── Main reputation engine ────────────────────────────────────────────────

/**
 * Award reputation points for a DAO participation action.
 * Returns the updated reputation record or null if rate-limited.
 */
export async function awardReputation(
  env: Env,
  userId: string,
  action: ReputationAction,
  daoId?: string,
  meta?: Record<string, unknown>,
): Promise<ReputationRecord | null> {
  const config = ACTION_POINTS[action];
  if (!config) return null;

  // Check daily cap
  const allowed = await checkDailyCap(env, userId, action);
  if (!allowed) return null;

  const key = repKey(userId);
  const record = (await kvGet<ReputationRecord>(env, key)) ?? {
    userId,
    total: 0,
    level: 'contributor' as ReputationLevel,
    history: [],
    lastActiveAt: 0,
    joinedAt: Date.now(),
    consecutiveVotes: 0,
    lastFiveProposalsVoted: false,
  };

  // Apply decay before adding new points (if this is user returning from inactivity)
  const decay = computeDecay(record);
  let newTotal = Math.max(0, record.total - decay);

  // Special handling for early member bonus (one-time, at join)
  if (action === 'early_member') {
    const daysSinceJoin = (Date.now() - record.joinedAt) / (1000 * 60 * 60 * 24);
    if (daysSinceJoin > EARLY_MEMBER_DAYS) return record; // too late for early member bonus
    // Check if already awarded
    const hasEarlyMember = record.history.some((e) => e.action === 'early_member');
    if (hasEarlyMember) return record;
  }

  // Track consecutive votes for the consistent voter bonus
  if (action === 'vote_cast') {
    record.consecutiveVotes += 1;
    if (record.consecutiveVotes >= CONSECUTIVE_PROPOSAL_THRESHOLD) {
      // Award consistent voter bonus (once per threshold crossed)
      const hasRecentBonus = record.history
        .filter((e) => e.action === 'consistent_voter')
        .slice(-1)[0];
      const bonusCooldown = hasRecentBonus
        ? Date.now() - hasRecentBonus.timestamp < MONTH_MS
        : false;
      if (!bonusCooldown) {
        newTotal += ACTION_POINTS.consistent_voter?.points;
        record.history.push({
          action: 'consistent_voter',
          points: ACTION_POINTS.consistent_voter?.points,
          timestamp: Date.now(),
          daoId,
        });
      }
    }
  } else {
    // Non-vote actions reset the consecutive counter
    record.consecutiveVotes = 0;
  }

  // Add the base points
  newTotal = Math.min(MAX_REPUTATION, newTotal + config.points);

  // Build the event
  const event: ReputationEvent = {
    action,
    points: config.points,
    timestamp: Date.now(),
    daoId,
    meta,
  };

  // Update record
  record.total = newTotal;
  record.lastActiveAt = Date.now();
  record.level = computeLevel(newTotal);
  record.history.push(event);
  if (record.history.length > HISTORY_CAP) {
    record.history = record.history.slice(-HISTORY_CAP);
  }

  await kvPut(env, key, record);

  // Maintain separate history list for efficient queries
  const histKey = repHistoryKey(userId);
  const hist = (await kvGet<ReputationEvent[]>(env, histKey)) ?? [];
  hist.push(event);
  await kvPut(env, histKey, hist.slice(-HISTORY_CAP));

  return record;
}

/**
 * Get a user's full reputation record.
 */
export async function getReputation(env: Env, userId: string): Promise<ReputationRecord | null> {
  return kvGet<ReputationRecord>(env, repKey(userId));
}

/**
 * Get a user's reputation history.
 */
export async function getReputationHistory(env: Env, userId: string): Promise<ReputationEvent[]> {
  return (await kvGet<ReputationEvent[]>(env, repHistoryKey(userId))) ?? [];
}

/**
 * Apply decay to all active reputation records (batch maintenance).
 * Called by cron (weekly or daily).
 */
export async function applyDecayAll(env: Env): Promise<number> {
  if (!env.REPUTATION) return 0;
  let decayed = 0;
  try {
    const list = await env.REPUTATION.list({ prefix: 'reputation:' });
    for (const key of list.keys) {
      const raw = await env.REPUTATION.get(key.name);
      if (!raw) continue;
      const record = JSON.parse(raw) as ReputationRecord;
      const decay = computeDecay(record);
      if (decay > 0) {
        record.total = Math.max(0, record.total - decay);
        record.level = computeLevel(record.total);
        await env.REPUTATION.put(key.name, JSON.stringify(record));
        decayed++;
      }
    }
  } catch {
    /* best-effort */
  }
  return decayed;
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

/**
 * Update the participation leaderboard for a DAO.
 * Periods: 'weekly', 'monthly', 'alltime'
 */
export async function updateLeaderboard(
  env: Env,
  daoId: string,
  period: string,
  entries: LeaderboardEntry[],
): Promise<void> {
  const sorted = entries
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_CAP)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  await kvPut(env, leaderboardKey(daoId, period), {
    entries: sorted,
    updatedAt: Date.now(),
    period,
  });
}

/**
 * Get the participation leaderboard for a DAO.
 */
export async function getLeaderboard(
  env: Env,
  daoId: string,
  period: string,
  limit = 50,
): Promise<{ entries: LeaderboardEntry[]; updatedAt: number }> {
  const data = await kvGet<{ entries: LeaderboardEntry[]; updatedAt: number }>(
    env,
    leaderboardKey(daoId, period),
  );
  if (data) {
    return {
      entries: data.entries.slice(0, Math.min(limit, LEADERBOARD_CAP)),
      updatedAt: data.updatedAt,
    };
  }
  return { entries: [], updatedAt: 0 };
}

/**
 * Get most active members this week.
 */
export async function getMostActiveMembers(
  env: Env,
  daoId: string,
  limit = 10,
): Promise<{ userId: string; score: number }[]> {
  const data = await kvGet<{ userId: string; score: number }[]>(env, mostActiveKey(daoId));
  return (data ?? []).slice(0, limit);
}

/**
 * Set most active members this week.
 */
export async function setMostActiveMembers(
  env: Env,
  daoId: string,
  members: { userId: string; score: number }[],
): Promise<void> {
  await kvPut(env, mostActiveKey(daoId), members, 604800); // 7 day TTL
}
