/**
 * @degenfeed/api-worker — PeerTube tipping routes
 *
 * Viewers can tip video creators on PeerTube instances during playback
 * or from the video page. Tips are stored in KV, aggregated by video,
 * and surfaced in a global leaderboard.
 *
 * KV schema:
 *   peertube:tip:{videoId}           → TipEntry[]
 *   peertube:tip:stats:{videoId}     → StatsEntry
 *   peertube:tip:leaderboard         → CreatorEntry[]
 *
 * The notification pipeline is shared with the main app: each tip creates
 * a `notifications:peertube:{creatorChannel}` KV entry that the unified
 * NotificationBell can pick up.
 */

import { type Env, jsonResponse } from '../index';
import { hasSuspiciousPayload, isValidAmount, sanitizeString, validateBodySize } from '../sanitize';
import { recordUnifiedTip } from './unified-tip';

// ─── Types ───────────────────────────────────────────────────────────────

interface TipEntry {
  id: string;
  videoId: string;
  creatorName: string;
  creatorChannel: string;
  videoTitle: string;
  instanceDomain: string;
  amount: number;
  sender: string;
  currency: string;
  timestamp: number;
}

interface StatsEntry {
  videoId: string;
  totalAmount: number;
  count: number;
  currency: string;
  lastTipAt: number;
}

interface CreatorEntry {
  creatorName: string;
  creatorChannel: string;
  instanceDomain: string;
  totalAmount: number;
  count: number;
  videoCount: number;
  /** Distinct tipped video ids (capped) — drives videoCount */
  videoIds?: string[];
  lastTipAt: number;
}

// ─── KV helpers ─────────────────────────────────────────────────────────

const TIPS_PREFIX = 'peertube:tip:';
const STATS_PREFIX = 'peertube:tip:stats:';
const LEADERBOARD_KEY = 'peertube:tip:leaderboard';
const NOTIF_PREFIX = 'notifications:peertube:';
const TTL_30D = 60 * 60 * 24 * 30;

async function getTips(env: Env, videoId: string): Promise<TipEntry[]> {
  try {
    const raw = await env.CACHE?.get(`${TIPS_PREFIX}${videoId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TipEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function putTips(env: Env, videoId: string, tips: TipEntry[]): Promise<void> {
  try {
    await env.CACHE?.put(`${TIPS_PREFIX}${videoId}`, JSON.stringify(tips), {
      expirationTtl: TTL_30D,
    });
  } catch {
    /* KV unavailable */
  }
}

async function getStats(env: Env, videoId: string): Promise<StatsEntry | null> {
  try {
    const raw = await env.CACHE?.get(`${STATS_PREFIX}${videoId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StatsEntry;
  } catch {
    return null;
  }
}

async function putStats(env: Env, videoId: string, stats: StatsEntry): Promise<void> {
  try {
    await env.CACHE?.put(`${STATS_PREFIX}${videoId}`, JSON.stringify(stats), {
      expirationTtl: TTL_30D,
    });
  } catch {
    /* KV unavailable */
  }
}

async function getLeaderboard(env: Env): Promise<CreatorEntry[]> {
  try {
    const raw = await env.CACHE?.get(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreatorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function putLeaderboard(env: Env, entries: CreatorEntry[]): Promise<void> {
  try {
    // Sort by totalAmount descending before storing
    entries.sort((a, b) => b.totalAmount - a.totalAmount);
    await env.CACHE?.put(LEADERBOARD_KEY, JSON.stringify(entries), {
      expirationTtl: TTL_30D,
    });
  } catch {
    /* KV unavailable */
  }
}

// ─── Shared recording path ───────────────────────────────────────────────
// Used by handlePeerTubeTipCreate (direct POST /api/peertube/tip) and by the
// unified tip router (POST /api/tip/unified with platform: 'peertube').
// Writes the PeerTube-specific KV surface, emits the creator notification,
// and records the tip in the unified cross-platform ledger exactly once.

export interface RecordPeerTubeTipInput {
  videoId: string;
  creatorName: string;
  creatorChannel: string;
  videoTitle: string;
  instanceDomain: string;
  /** USD value of the tip */
  amountUsd: number;
  sender?: string;
  senderLabel?: string;
  currency: string;
  /** Unified ledger recipient id — falls back to creatorChannel */
  recipientUserId?: string;
}

export async function recordPeerTubeTip(
  env: Env,
  input: RecordPeerTubeTipInput,
): Promise<{ tipId: string; totalAmount: number; totalTips: number }> {
  const { videoId, creatorName, creatorChannel, videoTitle, instanceDomain, currency } = input;
  const sender = input.sender ?? '';
  const roundedAmount = Math.round(input.amountUsd * 100) / 100;

  // ── Build tip entry ──
  const tipEntry: TipEntry = {
    id: `pt-tip:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    videoId,
    creatorName,
    creatorChannel,
    videoTitle,
    instanceDomain,
    amount: roundedAmount,
    sender: sender || 'Anonymous',
    currency,
    timestamp: Date.now(),
  };

  // ── Store tip in tips list ──
  const tips = await getTips(env, videoId);
  tips.unshift(tipEntry);
  // Keep only the last 500 tips per video
  await putTips(env, videoId, tips.slice(0, 500));

  // ── Update stats ──
  const existingStats = await getStats(env, videoId);
  const updatedStats: StatsEntry = {
    videoId,
    totalAmount: (existingStats?.totalAmount ?? 0) + roundedAmount,
    count: (existingStats?.count ?? 0) + 1,
    currency,
    lastTipAt: Date.now(),
  };
  await putStats(env, videoId, updatedStats);

  // ── Update leaderboard ──
  const leaderboard = await getLeaderboard(env);
  const existingEntryIndex = leaderboard.findIndex(
    (e) => e.creatorChannel === creatorChannel && e.instanceDomain === instanceDomain,
  );

  if (existingEntryIndex >= 0) {
    const existing = leaderboard[existingEntryIndex] as CreatorEntry;
    // Count distinct videos, not tips — legacy entries without videoIds keep
    // their historical videoCount as a floor.
    const videoIds = new Set(existing.videoIds ?? []);
    videoIds.add(videoId);
    leaderboard[existingEntryIndex] = {
      ...existing,
      totalAmount: existing.totalAmount + roundedAmount,
      count: existing.count + 1,
      videoCount: Math.max(existing.videoCount, videoIds.size),
      videoIds: [...videoIds].slice(-200),
      lastTipAt: Date.now(),
    };
  } else {
    leaderboard.push({
      creatorName,
      creatorChannel,
      instanceDomain,
      totalAmount: roundedAmount,
      count: 1,
      videoCount: 1,
      videoIds: [videoId],
      lastTipAt: Date.now(),
    });
  }
  await putLeaderboard(env, leaderboard);

  // ─── Record in the unified cross-platform ledger ─────────────
  await recordUnifiedTip(env, {
    platform: 'peertube',
    entityId: videoId,
    entityType: 'video',
    amountUsd: roundedAmount,
    fromUserId: sender || undefined,
    toUserId: input.recipientUserId || creatorChannel,
    fromLabel: input.senderLabel,
    toLabel: creatorName,
    entityLabel: videoTitle,
    method: currency,
  });

  // ── Emit notification ──
  try {
    const notifKey = `${NOTIF_PREFIX}${creatorChannel}`;
    const tipNotif = {
      id: `peertube-tip:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      type: 'tip' as const,
      protocol: 'peertube',
      sourceProtocol: 'peertube',
      actorName: sender ? `${sender.slice(0, 6)}...` : 'Anonymous',
      actorHandle: sender || '',
      amount: String(roundedAmount),
      currency,
      postText: `⚡ ${sender || 'Anonymous'} tipped $${roundedAmount} to ${creatorName} on ${videoTitle}`,
      createdAt: Date.now(),
      read: false,
    };
    const existingRaw = await env.CACHE?.get(notifKey);
    const existing: unknown[] = existingRaw ? JSON.parse(existingRaw) : [];
    await env.CACHE?.put(notifKey, JSON.stringify([tipNotif, ...existing].slice(0, 100)), {
      expirationTtl: TTL_30D,
    });
  } catch (kvErr) {
    const msg = kvErr instanceof Error ? kvErr.message : String(kvErr);
    console.warn('[peertube-tip] failed to store notification:', msg);
  }

  return { tipId: tipEntry.id, totalAmount: updatedStats.totalAmount, totalTips: updatedStats.count };
}

// ─── POST /api/peertube/tip ──────────────────────────────────────────────

/**
 * Tip a PeerTube video creator.
 *
 * Body: { videoId, creatorName, creatorChannel, videoTitle, instanceDomain,
 *         amount, sender?, currency? }
 *
 * Stores the tip, aggregates stats, updates leaderboard, records the tip in
 * the unified cross-platform ledger, and emits a notification into the
 * unified pipeline.
 */
export async function handlePeerTubeTipCreate(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 10 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as {
      videoId?: string;
      creatorName?: string;
      creatorChannel?: string;
      videoTitle?: string;
      instanceDomain?: string;
      amount?: string | number;
      sender?: string;
      currency?: string;
    };

    // ── Validate required fields ──
    const videoId = sanitizeString(body.videoId, 256);
    const creatorName = sanitizeString(body.creatorName, 256);
    const creatorChannel = sanitizeString(body.creatorChannel, 256);
    const videoTitle = sanitizeString(body.videoTitle, 512);
    const instanceDomain = sanitizeString(body.instanceDomain, 128);
    const sender = sanitizeString(body.sender, 128);
    const currency = sanitizeString(body.currency, 16) || 'usd';

    const amount =
      typeof body.amount === 'number' ? String(body.amount) : sanitizeString(body.amount, 64);

    if (
      !videoId ||
      !creatorName ||
      !creatorChannel ||
      !videoTitle ||
      !amount ||
      !isValidAmount(amount) ||
      hasSuspiciousPayload(
        `${videoId}${creatorName}${creatorChannel}${videoTitle}${instanceDomain}${sender}`,
      )
    ) {
      return jsonResponse(
        { error: 'videoId, creatorName, creatorChannel, videoTitle, and amount are required' },
        400,
      );
    }

    const numericAmount = Number.parseFloat(amount);
    if (numericAmount <= 0 || !Number.isFinite(numericAmount)) {
      return jsonResponse({ error: 'amount must be a positive number' }, 400);
    }

    const result = await recordPeerTubeTip(env, {
      videoId,
      creatorName,
      creatorChannel,
      videoTitle,
      instanceDomain,
      amountUsd: numericAmount,
      sender: sender || undefined,
      currency,
    });

    return jsonResponse({
      success: true,
      tip: {
        id: result.tipId,
        videoId,
        amount: Math.round(numericAmount * 100) / 100,
        totalAmount: result.totalAmount,
        totalTips: result.totalTips,
      },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── GET /api/peertube/tip/stats?videoId=... ─────────────────────────────

/**
 * Get tip statistics for a specific video.
 *
 * Returns total amount, tip count, and the last 50 tip entries.
 */
export async function handlePeerTubeTipStats(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const videoId = sanitizeString(url.searchParams.get('videoId'), 256);

  if (!videoId || hasSuspiciousPayload(videoId)) {
    return jsonResponse({ error: 'videoId query parameter required' }, 400);
  }

  const stats = await getStats(env, videoId);
  const tips = await getTips(env, videoId);

  return jsonResponse({
    videoId,
    totalAmount: stats?.totalAmount ?? 0,
    count: stats?.count ?? 0,
    lastTipAt: stats?.lastTipAt ?? null,
    tips: tips.slice(0, 50),
  });
}

// ─── GET /api/peertube/tip/leaderboard ───────────────────────────────────

/**
 * Get the top-tipped PeerTube creators leaderboard.
 *
 * Returns creators sorted by total tip amount descending.
 */
export async function handlePeerTubeLeaderboard(_request: Request, env: Env): Promise<Response> {
  const leaderboard = await getLeaderboard(env);

  return jsonResponse({
    leaderboard: leaderboard.slice(0, 100),
  });
}
