/**
 * @degenfeed/api-worker — Mastodon Tipping Routes
 *
 * Tipping for Mastodon posts (toots).
 * Supports all 6 DegenFeed methods via the unified resolution pipeline.
 *
 * KV schema:
 *   mastodon:tip:{statusId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   mastodon:tip:leaderboard → [ { statusId, authorAcct, totalUsd, totalCount }, ... ]
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { type Env, jsonResponse } from '../index';
import {
  hasSuspiciousPayload,
  isValidAmount,
  sanitizeString,
  validateBodySize,
} from '../sanitize';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────

interface MastodonTipRecord {
  amount: number; // USD amount
  currency: string;
  method: string;
  from?: string;
  timestamp: number;
}

interface MastodonTipAggregate {
  statusId: string;
  authorAcct: string;
  totalUsd: number;
  totalCount: number;
  tips: MastodonTipRecord[];
  lastTippedAt: number;
}

interface MastodonLeaderboardEntry {
  statusId: string;
  authorAcct: string;
  totalUsd: number;
  totalCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const TIP_PREFIX = 'mastodon:tip:';
const LEADERBOARD_KEY = 'mastodon:tip:leaderboard';
const MAX_TIPS_STORED = 500;
const LEADERBOARD_MAX = 100;
const TTL_SECONDS = 60 * 60 * 24 * 365;

// ─── Helpers ─────────────────────────────────────────────────────────

function sanitizeStatusId(raw: unknown): string | null {
  const str = sanitizeString(raw, 256);
  if (!str || str.length < 3 || hasSuspiciousPayload(str)) return null;
  if (!/^[a-zA-Z0-9\-_:.]+$/.test(str)) return null;
  return str;
}

function sanitizeCurrency(raw: unknown): string | null {
  const allowed = new Set(['eth', 'sol', 'btc', 'usdc', 'base', 'matic']);
  const val = sanitizeString(raw, 16);
  return val && allowed.has(val) ? val : null;
}

// ─── KV helpers ──────────────────────────────────────────────────────

async function getAggregate(env: Env, statusId: string): Promise<MastodonTipAggregate | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${TIP_PREFIX}${statusId}`);
    if (!raw) return null;
    return JSON.parse(raw) as MastodonTipAggregate;
  } catch {
    return null;
  }
}

async function saveAggregate(env: Env, agg: MastodonTipAggregate): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`${TIP_PREFIX}${agg.statusId}`, JSON.stringify(agg), {
      expirationTtl: TTL_SECONDS,
    });
  } catch (err) {
    console.warn('[mastodon-tip] failed to save aggregate:', err instanceof Error ? err.message : err);
  }
}

async function updateLeaderboard(env: Env, entry: MastodonLeaderboardEntry): Promise<void> {
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(LEADERBOARD_KEY);
    let board: MastodonLeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    const existingIdx = board.findIndex((e) => e.statusId === entry.statusId);
    if (existingIdx >= 0) {
      board[existingIdx] = entry;
    } else {
      board.push(entry);
    }
    board.sort((a, b) => b.totalUsd - a.totalUsd);
    board = board.slice(0, LEADERBOARD_MAX);
    await env.CACHE.put(LEADERBOARD_KEY, JSON.stringify(board), {
      expirationTtl: TTL_SECONDS,
    });
  } catch (err) {
    console.warn('[mastodon-tip] leaderboard update failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Shared recording path ───────────────────────────────────────────

export interface RecordMastodonTipInput {
  statusId: string;
  authorAcct: string;
  authorDisplayName?: string;
  /** USD value of the tip */
  amountUsd: number;
  currency: string;
  method: string;
  from?: string;
  fromLabel?: string;
  toLabel?: string;
  /** Unified ledger recipient id — falls back to authorAcct */
  recipientUserId?: string;
}

export async function recordMastodonTip(
  env: Env,
  input: RecordMastodonTipInput,
): Promise<{ totalUsd: number; totalCount: number }> {
  const { statusId, authorAcct, amountUsd, currency, method, from } = input;

  const tipRecord: MastodonTipRecord = {
    amount: amountUsd,
    currency,
    method,
    from: from || undefined,
    timestamp: Date.now(),
  };

  const existing = await getAggregate(env, statusId);
  const aggregate: MastodonTipAggregate = existing ?? {
    statusId,
    authorAcct,
    totalUsd: 0,
    totalCount: 0,
    tips: [],
    lastTippedAt: 0,
  };

  aggregate.totalUsd += amountUsd;
  aggregate.totalCount += 1;
  aggregate.tips.push(tipRecord);
  aggregate.lastTippedAt = Date.now();

  if (aggregate.tips.length > MAX_TIPS_STORED) {
    aggregate.tips = aggregate.tips.slice(-MAX_TIPS_STORED);
  }

  await saveAggregate(env, aggregate);
  await updateLeaderboard(env, {
    statusId,
    authorAcct,
    totalUsd: aggregate.totalUsd,
    totalCount: aggregate.totalCount,
  });

  // ─── Record in the unified cross-platform ledger ─────────────
  await recordUnifiedTip(env, {
    platform: 'mastodon',
    entityId: statusId,
    entityType: 'post',
    amountUsd,
    fromUserId: from,
    toUserId: input.recipientUserId || authorAcct,
    fromLabel: input.fromLabel,
    toLabel: input.toLabel || input.authorDisplayName || authorAcct,
    method: currency,
  });

  // ─── Store notification ──────────────────────────────────────
  const notifRecipient = authorAcct;
  if (notifRecipient) {
    try {
      const notifKey = `notifications:mastodon:${notifRecipient}`;
      const tipNotif = {
        id: `mastodon:tip:${statusId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        type: 'tip' as const,
        protocol: 'mastodon',
        sourceProtocol: `mastodon_${currency}`,
        actorName: from ? `${from.slice(0, 6)}...` : 'Anonymous',
        actorHandle: from || '',
        statusId,
        amount: String(amountUsd),
        currency,
        createdAt: Date.now(),
        read: false,
      };
      const existingRaw = await env.CACHE?.get(notifKey);
      const existingNotifs: unknown[] = existingRaw ? JSON.parse(existingRaw) : [];
      await env.CACHE?.put(
        notifKey,
        JSON.stringify([tipNotif, ...existingNotifs].slice(0, 100)),
        { expirationTtl: 60 * 60 * 24 * 30 },
      );
    } catch (kvErr) {
      console.warn('[mastodon-tip] failed to store notification:', String(kvErr));
    }
  }

  return { totalUsd: aggregate.totalUsd, totalCount: aggregate.totalCount };
}

// ─── POST /api/mastodon/tip — Record a tip ─────────────────────────────

export async function handleMastodonTipCreate(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as {
      statusId?: string;
      authorAcct?: string;
      amount?: string;
      currency?: string;
      method?: string;
      from?: string;
    };

    const statusId = sanitizeStatusId(body.statusId);
    const authorAcct = sanitizeString(body.authorAcct, 256);
    const amount = sanitizeString(body.amount, 64);
    const currency = sanitizeCurrency(body.currency ?? body.method);
    const method = sanitizeString(body.method ?? body.currency, 32);
    const from = sanitizeString(body.from, 128);

    if (!statusId || !authorAcct || !amount || !isValidAmount(amount) || !currency) {
      return jsonResponse({ error: 'statusId, authorAcct, amount, and currency are required' }, 400);
    }

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
      return jsonResponse({ error: 'Amount must be between 0.01 and 10,000' }, 400);
    }

    const result = await recordMastodonTip(env, {
      statusId,
      authorAcct,
      amountUsd: amountNum,
      currency,
      method,
      from: from || undefined,
    });

    return jsonResponse({
      success: true,
      statusId,
      totalUsd: result.totalUsd,
      totalCount: result.totalCount,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/mastodon/tip/stats?statusId=... — Get tip stats ──────────

export async function handleMastodonTipStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const statusId = sanitizeStatusId(url.searchParams.get('statusId'));

  if (!statusId) {
    return jsonResponse({ error: 'statusId query parameter required' }, 400);
  }

  const agg = await getAggregate(env, statusId);

  if (!agg) {
    return jsonResponse({
      statusId,
      totalUsd: 0,
      totalCount: 0,
      tips: [],
      lastTippedAt: null,
    });
  }

  return jsonResponse({
    statusId: agg.statusId,
    authorAcct: agg.authorAcct,
    totalUsd: agg.totalUsd,
    totalCount: agg.totalCount,
    lastTippedAt: agg.lastTippedAt,
    recentTips: agg.tips.slice(-50).reverse(),
  });
}

// ─── GET /api/mastodon/tip/leaderboard — Top tipped content ─────────────

export async function handleMastodonLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  if (!env.CACHE) {
    return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
  }

  try {
    const raw = await env.CACHE.get(LEADERBOARD_KEY);
    if (!raw) {
      return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
    }
    let board: MastodonLeaderboardEntry[] = JSON.parse(raw);
    board = board.slice(0, limit);
    return jsonResponse({ leaderboard: board, meta: { total: board.length, limit } });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}
