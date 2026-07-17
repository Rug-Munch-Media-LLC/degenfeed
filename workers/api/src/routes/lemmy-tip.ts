/**
 * @degenfeed/api-worker — Lemmy Tipping Routes
 *
 * Multi-currency tipping for Lemmy posts and comments.
 * Supports all 6 DegenFeed methods: ETH, SOL, Lightning, USDC,
 * Farcaster (Base), and Lens (Polygon).
 *
 * KV schema:
 *   lemmy:tip:{contentId} → { totalUsd, totalCount, tips: [...], lastTippedAt }
 *   lemmy:tip:leaderboard → [ { contentId, contentType, totalUsd, totalCount }, ... ] (sorted)
 *
 * Every recorded tip is also written to the unified cross-platform ledger
 * (see unified-tip.ts) via recordUnifiedTip().
 */

import { type Env, jsonResponse } from '../index';
import {
  hasSuspiciousPayload,
  isValidAmount,
  isValidEvmAddress,
  isValidSolanaAddress,
  sanitizeString,
  validateBodySize,
} from '../sanitize';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────

interface LemmyTipRecord {
  amount: number; // USD amount
  currency: string; // 'eth' | 'sol' | 'btc' | 'usdc' | 'base' | 'matic'
  method: string; // resolved method key
  from?: string; // sender address/identifier (first 6 chars)
  timestamp: number; // unix ms
}

interface LemmyTipAggregate {
  contentId: string;
  contentType: 'post' | 'comment';
  totalUsd: number;
  totalCount: number;
  tips: LemmyTipRecord[];
  lastTippedAt: number;
}

interface LemmyLeaderboardEntry {
  contentId: string;
  contentType: 'post' | 'comment';
  totalUsd: number;
  totalCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const LEMMY_TIP_PREFIX = 'lemmy:tip:';
const LEMMY_LEADERBOARD_KEY = 'lemmy:tip:leaderboard';
const MAX_TIPS_STORED = 500;
const LEADERBOARD_MAX = 100;
const TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year for tip records

// ─── Helpers ─────────────────────────────────────────────────────────

function sanitizeContentId(raw: unknown): string | null {
  const str = sanitizeString(raw, 256);
  if (!str || str.length < 3 || hasSuspiciousPayload(str)) return null;
  // Allow alphanumeric, hyphens, underscores, colons (for post IDs like "lemmy:12345")
  if (!/^[a-zA-Z0-9\-_:.]+$/.test(str)) return null;
  return str;
}

function sanitizeCurrency(raw: unknown): string | null {
  const allowed = new Set(['eth', 'sol', 'btc', 'usdc', 'base', 'matic']);
  const val = sanitizeString(raw, 16);
  return val && allowed.has(val) ? val : null;
}

// ─── KV helpers ──────────────────────────────────────────────────────

async function getAggregate(env: Env, contentId: string): Promise<LemmyTipAggregate | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${LEMMY_TIP_PREFIX}${contentId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LemmyTipAggregate;
  } catch {
    return null;
  }
}

async function saveAggregate(env: Env, agg: LemmyTipAggregate): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`${LEMMY_TIP_PREFIX}${agg.contentId}`, JSON.stringify(agg), {
      expirationTtl: TTL_SECONDS,
    });
  } catch (err) {
    console.warn('[lemmy-tip] failed to save aggregate:', err instanceof Error ? err.message : err);
  }
}

async function updateLeaderboard(
  env: Env,
  entry: LemmyLeaderboardEntry,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(LEMMY_LEADERBOARD_KEY);
    let board: LemmyLeaderboardEntry[] = raw ? JSON.parse(raw) : [];

    // Update or insert
    const existingIdx = board.findIndex((e) => e.contentId === entry.contentId);
    if (existingIdx >= 0) {
      board[existingIdx] = entry;
    } else {
      board.push(entry);
    }

    // Sort by totalUsd descending, keep top N
    board.sort((a, b) => b.totalUsd - a.totalUsd);
    board = board.slice(0, LEADERBOARD_MAX);

    await env.CACHE.put(LEMMY_LEADERBOARD_KEY, JSON.stringify(board), {
      expirationTtl: TTL_SECONDS,
    });
  } catch (err) {
    console.warn('[lemmy-tip] leaderboard update failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Shared recording path ───────────────────────────────────────────
// Used by handleLemmyTipCreate (direct POST /api/lemmy/tip) and by the
// unified tip router (POST /api/tip/unified with platform: 'lemmy').
// Writes the Lemmy-specific KV surface, emits the recipient notification,
// and records the tip in the unified cross-platform ledger exactly once.

export interface RecordLemmyTipInput {
  contentId: string;
  contentType: 'post' | 'comment';
  /** USD value of the tip */
  amountUsd: number;
  currency: string;
  method: string;
  from?: string;
  fromLabel?: string;
  toLabel?: string;
  recipientEvm?: string;
  recipientSol?: string;
  /** Unified ledger recipient id — falls back to recipientEvm/recipientSol */
  recipientUserId?: string;
}

export async function recordLemmyTip(
  env: Env,
  input: RecordLemmyTipInput,
): Promise<{ totalUsd: number; totalCount: number }> {
  const { contentId, contentType, amountUsd, currency, method, from } = input;

  // Build the tip record
  const tipRecord: LemmyTipRecord = {
    amount: amountUsd,
    currency,
    method,
    from: from || undefined,
    timestamp: Date.now(),
  };

  // Get or create aggregate
  const existing = await getAggregate(env, contentId);
  const aggregate: LemmyTipAggregate = existing ?? {
    contentId,
    contentType,
    totalUsd: 0,
    totalCount: 0,
    tips: [],
    lastTippedAt: 0,
  };

  aggregate.totalUsd += amountUsd;
  aggregate.totalCount += 1;
  aggregate.tips.push(tipRecord);
  aggregate.lastTippedAt = Date.now();

  // Trim tips to max storage
  if (aggregate.tips.length > MAX_TIPS_STORED) {
    aggregate.tips = aggregate.tips.slice(-MAX_TIPS_STORED);
  }

  // Persist
  await saveAggregate(env, aggregate);
  await updateLeaderboard(env, {
    contentId,
    contentType,
    totalUsd: aggregate.totalUsd,
    totalCount: aggregate.totalCount,
  });

  // ─── Record in the unified cross-platform ledger ─────────────
  const recipientUserId = input.recipientUserId || input.recipientEvm || input.recipientSol;
  await recordUnifiedTip(env, {
    platform: 'lemmy',
    entityId: contentId,
    entityType: contentType,
    amountUsd,
    fromUserId: from,
    toUserId: recipientUserId,
    fromLabel: input.fromLabel,
    toLabel: input.toLabel,
    method: currency,
  });

  // ─── Store notification ──────────────────────────────────────
  const notifRecipient = input.recipientEvm || input.recipientSol;
  if (notifRecipient) {
    try {
      const notifKey = `notifications:${notifRecipient}`;
      const tipNotif = {
        id: `lemmy:tip:${contentId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        type: 'tip' as const,
        protocol: 'lemmy',
        sourceProtocol: `lemmy_${currency}`,
        actorName: from ? `${from.slice(0, 6)}...` : 'Anonymous',
        actorHandle: from || '',
        postId: contentId,
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
      console.warn('[lemmy-tip] failed to store notification:', String(kvErr));
    }
  }

  return { totalUsd: aggregate.totalUsd, totalCount: aggregate.totalCount };
}

// ─── POST /api/lemmy/tip — Record a tip ─────────────────────────────

export async function handleLemmyTipCreate(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as {
      contentId?: string;
      contentType?: string;
      amount?: string;
      currency?: string;
      method?: string;
      recipientEvm?: string;
      recipientSol?: string;
      from?: string;
    };

    const contentId = sanitizeContentId(body.contentId);
    const contentType = body.contentType === 'comment' ? 'comment' : 'post';
    const amount = sanitizeString(body.amount, 64);
    const currency = sanitizeCurrency(body.currency ?? body.method);
    const method = sanitizeString(body.method ?? body.currency, 32);
    const from = sanitizeString(body.from, 128);
    const recipientEvm = sanitizeString(body.recipientEvm, 128);
    const recipientSol = sanitizeString(body.recipientSol, 128);

    if (!contentId || !amount || !isValidAmount(amount) || !currency) {
      return jsonResponse({ error: 'contentId, amount, and currency are required' }, 400);
    }

    // Validate addresses if provided
    if (recipientEvm && !isValidEvmAddress(recipientEvm)) {
      return jsonResponse({ error: 'Invalid EVM address' }, 400);
    }
    if (recipientSol && !isValidSolanaAddress(recipientSol)) {
      return jsonResponse({ error: 'Invalid Solana address' }, 400);
    }

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
      return jsonResponse({ error: 'Amount must be between 0.01 and 10,000' }, 400);
    }

    const result = await recordLemmyTip(env, {
      contentId,
      contentType,
      amountUsd: amountNum,
      currency,
      method,
      from: from || undefined,
      recipientEvm: recipientEvm || undefined,
      recipientSol: recipientSol || undefined,
    });

    return jsonResponse({
      success: true,
      contentId,
      totalUsd: result.totalUsd,
      totalCount: result.totalCount,
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/lemmy/tip/stats?contentId=... — Get tip stats ──────────

export async function handleLemmyTipStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const contentId = sanitizeContentId(url.searchParams.get('contentId'));

  if (!contentId) {
    return jsonResponse({ error: 'contentId query parameter required' }, 400);
  }

  const agg = await getAggregate(env, contentId);

  if (!agg) {
    return jsonResponse({
      contentId,
      totalUsd: 0,
      totalCount: 0,
      tips: [],
      lastTippedAt: null,
    });
  }

  // Return summary + recent tips (last 50 for privacy/context)
  return jsonResponse({
    contentId: agg.contentId,
    contentType: agg.contentType,
    totalUsd: agg.totalUsd,
    totalCount: agg.totalCount,
    lastTippedAt: agg.lastTippedAt,
    recentTips: agg.tips.slice(-50).reverse(),
  });
}

// ─── GET /api/lemmy/tip/leaderboard — Top tipped content ─────────────

export async function handleLemmyTipLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);

  if (!env.CACHE) {
    return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
  }

  try {
    const raw = await env.CACHE.get(LEMMY_LEADERBOARD_KEY);
    if (!raw) {
      return jsonResponse({ leaderboard: [], meta: { total: 0, limit } });
    }

    let board: LemmyLeaderboardEntry[] = JSON.parse(raw);
    board = board.slice(0, limit);

    return jsonResponse({ leaderboard: board, meta: { total: board.length, limit } });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}
