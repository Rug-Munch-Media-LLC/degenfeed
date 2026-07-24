/**
 * @degenfeed/api-worker — Reputation routes
 *
 * Non-transferable reputation token system with KV storage.
 *
 * KV keys:
 *   rep:score:{userId}        → ReputationScore (JSON)
 *   rep:history:{userId}       → ReputationEvent[] (JSON, newest first)
 *   rep:leaderboard            → LeaderboardEntry[] (sorted by total desc)
 *
 * Endpoints:
 *   GET /api/reputation/:userId        — Get user's reputation score
 *   GET /api/reputation/:userId/history — Reputation change history
 *   GET /api/reputation/leaderboard    — Top users by reputation
 *   POST /api/reputation/earn          — Record an earn event
 *   POST /api/reputation/slash         — Record a slash event
 *   POST /api/reputation/stake         — Stake reputation on a post
 *   POST /api/reputation/stake/resolve — Resolve a stake
 */

import {
  applyEarnMultipliers,
  applyEvent,
  computeDailyTotals,
  computeLevel,
  createDefaultScore,
  EARN_RULES,
  LOSE_RULES,
  nextLevelThreshold,
  type ReputationEvent,
  type ReputationEventKind,
  type ReputationScore,
  resolveStake,
  type StakeToPost,
  stakeOnPost,
  TIER_BENEFITS,
  TIER_LABELS,
  TIER_POST_LIMITS,
  wouldExceedDailyCap,
} from '@degenfeed/reputation';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Helpers ──────────────────────────────────────────────────────────────

const SCORE_PREFIX = 'rep:score:';
const HISTORY_PREFIX = 'rep:history:';
const LEADERBOARD_KEY = 'rep:leaderboard';
const STAKES_PREFIX = 'rep:stakes:';

function scoreKey(userId: string): string {
  return `${SCORE_PREFIX}${userId}`;
}
function historyKey(userId: string): string {
  return `${HISTORY_PREFIX}${userId}`;
}
function stakesKey(userId: string): string {
  return `${STAKES_PREFIX}${userId}`;
}

async function getScore(env: Env, userId: string): Promise<ReputationScore> {
  if (!env.REPUTATION) {
    return createDefaultScore(userId);
  }
  const raw = await env.REPUTATION.get(scoreKey(userId));
  if (!raw) {
    return createDefaultScore(userId);
  }
  try {
    const parsed = JSON.parse(raw) as ReputationScore;
    // Ensure level is up-to-date
    parsed.level = computeLevel(parsed.total);
    return parsed;
  } catch {
    return createDefaultScore(userId);
  }
}

async function putScore(env: Env, score: ReputationScore): Promise<void> {
  if (!env.REPUTATION) return;
  await env.REPUTATION.put(scoreKey(score.userId), JSON.stringify(score));
}

async function getHistory(env: Env, userId: string, limit = 50): Promise<ReputationEvent[]> {
  if (!env.REPUTATION) return [];
  const raw = await env.REPUTATION.get(historyKey(userId));
  if (!raw) return [];
  try {
    const all = JSON.parse(raw) as ReputationEvent[];
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

async function prependEvent(env: Env, userId: string, event: ReputationEvent): Promise<void> {
  if (!env.REPUTATION) return;
  const raw = await env.REPUTATION.get(historyKey(userId));
  let events: ReputationEvent[] = [];
  if (raw) {
    try {
      events = JSON.parse(raw) as ReputationEvent[];
    } catch {
      // ignore parse errors, start fresh
    }
  }
  events.unshift(event);
  // Keep only last 500 events to avoid unbounded growth
  if (events.length > 500) {
    events = events.slice(0, 500);
  }
  await env.REPUTATION.put(historyKey(userId), JSON.stringify(events));
}

async function updateLeaderboard(env: Env, score: ReputationScore): Promise<void> {
  if (!env.REPUTATION) return;
  const raw = await env.REPUTATION.get(LEADERBOARD_KEY);
  let board: Array<{
    userId: string;
    total: number;
    level: string;
    displayName?: string;
  }> = [];
  if (raw) {
    try {
      board = JSON.parse(raw);
    } catch {
      // reset on parse error
    }
  }
  const existing = board.findIndex((e) => e.userId === score.userId);
  const entry = {
    userId: score.userId,
    total: score.total,
    level: score.level,
    displayName: undefined as string | undefined,
  };
  if (existing >= 0) {
    board[existing] = entry;
  } else {
    board.push(entry);
  }
  // Sort descending by total, keep top 1000
  board.sort((a, b) => b.total - a.total);
  if (board.length > 1000) {
    board = board.slice(0, 1000);
  }
  await env.REPUTATION.put(LEADERBOARD_KEY, JSON.stringify(board));
}

// ─── Timestamp helpers ────────────────────────────────────────────────────

function _todayStart(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ─── Parse userId from path ───────────────────────────────────────────────

function _parseUserId(url: string, prefix: string): string | null {
  const parts = url.split(prefix);
  if (parts.length < 2) return null;
  const after = parts[1];
  if (!after) return null;
  // Strip trailing slash or sub-path
  const slash = after.indexOf('/');
  return slash > 0 ? after.slice(0, slash) : after;
}

// ─── Handlers ─────────────────────────────────────────────────────────────

/**
 * GET /api/reputation/:userId
 *
 * Returns the user's full reputation score including level, tier info,
 * progress to next level, and tier benefits.
 */
export async function handleReputationGet(
  _request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (!userId) {
    return jsonResponse({ error: 'Missing userId parameter' }, 400);
  }

  const score = await getScore(env, userId);
  const progress = nextLevelThreshold(score.level, score.total);
  const tierLabel = TIER_LABELS[score.level]!;
  const postLimit = TIER_POST_LIMITS[score.level]!;
  const benefits = TIER_BENEFITS[score.level]!;

  return noCacheJsonResponse({
    ...score,
    progress: {
      current: progress.current,
      next: progress.next,
      currentMin: progress.currentMin,
      nextMin: progress.nextMin,
      progress: progress.progress,
    },
    tier: {
      icon: tierLabel.icon,
      label: tierLabel.label,
      postLimit,
      benefits,
    },
  });
}

/**
 * GET /api/reputation/:userId/history
 *
 * Returns reputation change history, newest first.
 */
export async function handleReputationHistory(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (!userId) {
    return jsonResponse({ error: 'Missing userId parameter' }, 400);
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, Number.parseInt(limitParam, 10) || 50)) : 50;

  const history = await getHistory(env, userId, limit);
  return noCacheJsonResponse({
    userId,
    events: history,
    count: history.length,
  });
}

/**
 * GET /api/reputation/leaderboard
 *
 * Top users by reputation score.
 */
export async function handleReputationLeaderboard(request: Request, env: Env): Promise<Response> {
  if (!env.REPUTATION) {
    return jsonResponse({ entries: [] });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, Number.parseInt(limitParam, 10) || 50)) : 50;

  const raw = await env.REPUTATION.get(LEADERBOARD_KEY);
  if (!raw) {
    return jsonResponse({ entries: [] });
  }

  try {
    const board = JSON.parse(raw);
    const entries = board.slice(0, limit).map(
      (
        e: {
          userId: string;
          total: number;
          level: string;
          displayName?: string;
        },
        i: number,
      ) => ({
        rank: i + 1,
        userId: e.userId,
        total: e.total,
        level: e.level,
        label: TIER_LABELS[e.level as keyof typeof TIER_LABELS]?.label ?? 'Newcomer',
        icon: TIER_LABELS[e.level as keyof typeof TIER_LABELS]?.icon ?? '🌱',
        displayName: e.displayName,
      }),
    );
    return noCacheJsonResponse({ entries, count: entries.length });
  } catch {
    return jsonResponse({ entries: [] });
  }
}

/**
 * POST /api/reputation/earn
 *
 * Record an earn event for a user.
 * Body: { userId, kind: 'earn:post' | 'earn:like' | 'earn:tip' | 'earn:follow' | 'earn:bridge', ref?, reason? }
 */
export async function handleReputationEarn(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { userId: string; kind: string; ref?: string; reason?: string };
  try {
    body = (await request.json()) as {
      userId: string;
      kind: string;
      ref?: string;
      reason?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.kind) {
    return jsonResponse({ error: 'userId and kind are required' }, 400);
  }

  if (body.userId.toLowerCase() !== session.address.toLowerCase()) {
    return jsonResponse({ error: 'userId does not match session' }, 403);
  }

  const rule = EARN_RULES.find((r) => r.kind === body.kind);
  if (!rule) {
    return jsonResponse({ error: `Unknown earn kind: ${body.kind}` }, 400);
  }

  const score = await getScore(env, body.userId);

  // Daily caps check
  if (rule.dailyCap > 0) {
    const history = await getHistory(env, body.userId, 200);
    const dailyTotals = computeDailyTotals(history);
    const effective = applyEarnMultipliers(
      rule.baseAmount,
      body.kind as ReputationEventKind,
      score.multipliers,
    );
    if (wouldExceedDailyCap(body.kind as ReputationEventKind, effective, dailyTotals)) {
      return jsonResponse(
        {
          error: `Daily cap reached for ${body.kind} (max ${rule.dailyCap}/day)`,
          dailyCap: rule.dailyCap,
          dailyTotal: dailyTotals.get(body.kind) ?? 0,
        },
        429,
      );
    }
  }

  const amount = applyEarnMultipliers(
    rule.baseAmount,
    body.kind as ReputationEventKind,
    score.multipliers,
  );
  const { score: updated, event } = applyEvent(
    score,
    body.kind as ReputationEventKind,
    amount,
    body.ref,
    body.reason ?? rule.description,
  );

  await putScore(env, updated);
  await prependEvent(env, body.userId, event);
  await updateLeaderboard(env, updated);

  return jsonResponse(
    {
      ok: true,
      event,
      score: {
        total: updated.total,
        earned: updated.earned,
        staked: updated.staked,
        slashed: updated.slashed,
        level: updated.level,
      },
    },
    201,
  );
}

/**
 * POST /api/reputation/slash
 *
 * Record a slash event (spam, report, ban).
 * Body: { userId, kind: 'slash:spam' | 'slash:report' | 'slash:ban', ref?, reason? }
 */
export async function handleReputationSlash(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { userId: string; kind: string; ref?: string; reason?: string };
  try {
    body = (await request.json()) as {
      userId: string;
      kind: string;
      ref?: string;
      reason?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.kind) {
    return jsonResponse({ error: 'userId and kind are required' }, 400);
  }

  const loseRule = LOSE_RULES[body.kind];
  if (!loseRule && body.kind !== 'slash:ban') {
    return jsonResponse({ error: `Unknown slash kind: ${body.kind}` }, 400);
  }

  const score = await getScore(env, body.userId);

  let delta: number;
  if (body.kind === 'slash:ban') {
    // Ban: slash all staked reputation
    delta = -score.staked;
    // Also slash earned
    delta -= Math.min(score.earned, 100); // flat penalty on ban
  } else {
    delta = loseRule?.baseAmount ?? 0;
  }

  const { score: updated, event } = applyEvent(
    score,
    body.kind as ReputationEventKind,
    delta,
    body.ref,
    body.reason ?? loseRule?.description ?? 'Moderation action',
  );

  await putScore(env, updated);
  await prependEvent(env, body.userId, event);
  await updateLeaderboard(env, updated);

  return jsonResponse(
    {
      ok: true,
      event,
      score: {
        total: updated.total,
        earned: updated.earned,
        staked: updated.staked,
        slashed: updated.slashed,
        level: updated.level,
      },
    },
    201,
  );
}

/**
 * POST /api/reputation/stake
 *
 * Stake reputation on a post.
 * Body: { userId, postId, amount }
 */
export async function handleReputationStake(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { userId: string; postId: string; amount: number };
  try {
    body = (await request.json()) as {
      userId: string;
      postId: string;
      amount: number;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.postId || typeof body.amount !== 'number') {
    return jsonResponse({ error: 'userId, postId, and amount are required' }, 400);
  }

  const score = await getScore(env, body.userId);
  const result = stakeOnPost(score, body.postId, body.amount);

  if (!result.ok) {
    return jsonResponse({ error: result.error }, 400);
  }

  const stake = result.stake!;

  // Record the stake event
  const { score: updated, event } = applyEvent(
    score,
    'stake:post' as ReputationEventKind,
    -stake.amount, // negative because rep is locked
    body.postId,
    `Staked ${stake.amount} reputation on post`,
  );

  await putScore(env, updated);
  await prependEvent(env, body.userId, event);

  // Store stake record
  if (env.REPUTATION) {
    const stakesRaw = await env.REPUTATION.get(stakesKey(body.userId));
    let stakes: StakeToPost[] = [];
    if (stakesRaw) {
      try {
        stakes = JSON.parse(stakesRaw);
      } catch {
        /* reset */
      }
    }
    stakes.push(stake);
    await env.REPUTATION.put(stakesKey(body.userId), JSON.stringify(stakes));
  }

  return jsonResponse(
    {
      ok: true,
      stake,
      score: {
        total: updated.total,
        staked: updated.staked,
      },
    },
    201,
  );
}

/**
 * POST /api/reputation/stake/resolve
 *
 * Resolve a stake (return or slash).
 * Body: { userId, postId, outcome: 'return' | 'return-bonus' | 'slash', engagementCount? }
 */
export async function handleReputationStakeResolve(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    userId: string;
    postId: string;
    outcome: 'return' | 'return-bonus' | 'slash';
    engagementCount?: number;
  };
  try {
    body = (await request.json()) as {
      userId: string;
      postId: string;
      outcome: 'return' | 'return-bonus' | 'slash';
      engagementCount?: number;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.postId || !body.outcome) {
    return jsonResponse({ error: 'userId, postId, and outcome are required' }, 400);
  }

  if (!['return', 'return-bonus', 'slash'].includes(body.outcome)) {
    return jsonResponse({ error: 'outcome must be return, return-bonus, or slash' }, 400);
  }

  // Find the active stake for this post
  if (!env.REPUTATION) {
    return jsonResponse({ error: 'REPUTATION KV not bound' }, 500);
  }

  const stakesRaw = await env.REPUTATION.get(stakesKey(body.userId));
  if (!stakesRaw) {
    return jsonResponse({ error: 'No stakes found for user' }, 404);
  }

  let stakes: StakeToPost[];
  try {
    stakes = JSON.parse(stakesRaw);
  } catch {
    return jsonResponse({ error: 'Invalid stakes data' }, 500);
  }

  const stakeIdx = stakes.findIndex((s) => s.postId === body.postId && s.status === 'active');
  if (stakeIdx < 0) {
    return jsonResponse({ error: 'No active stake found for this post' }, 404);
  }

  const resolution = resolveStake(stakes[stakeIdx]!, body.outcome, body.engagementCount);
  stakes[stakeIdx] = resolution.stake;

  // Save updated stakes
  await env.REPUTATION.put(stakesKey(body.userId), JSON.stringify(stakes));

  // Apply the resolution delta to the score
  const score = await getScore(env, body.userId);
  const kind: ReputationEventKind = body.outcome === 'slash' ? 'slash:stake' : 'stake:return';
  const ref = body.postId;
  const reason =
    body.outcome === 'slash'
      ? `Stake slashed on post (${resolution.stake.amount} lost)`
      : resolution.stake.bonus
        ? `Stake returned with ${resolution.stake.bonus} bonus`
        : 'Stake returned';

  const { score: updated, event } = applyEvent(score, kind, resolution.delta, ref, reason);
  await putScore(env, updated);
  await prependEvent(env, body.userId, event);
  await updateLeaderboard(env, updated);

  return jsonResponse({
    ok: true,
    stake: resolution.stake,
    delta: resolution.delta,
    score: {
      total: updated.total,
      staked: updated.staked,
    },
  });
}

/**
 * GET /api/reputation/:userId/stakes
 *
 * Returns active stakes for a user.
 */
export async function handleReputationStakes(
  _request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  if (!userId) {
    return jsonResponse({ error: 'Missing userId parameter' }, 400);
  }

  if (!env.REPUTATION) {
    return jsonResponse({ stakes: [] });
  }

  const raw = await env.REPUTATION.get(stakesKey(userId));
  if (!raw) {
    return jsonResponse({ stakes: [] });
  }

  try {
    const stakes = JSON.parse(raw) as StakeToPost[];
    return noCacheJsonResponse({ stakes, count: stakes.length });
  } catch {
    return jsonResponse({ stakes: [] });
  }
}
