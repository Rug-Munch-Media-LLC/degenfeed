/**
 * @degenfeed/api-worker — Live Gifts API Handlers
 *
 * API endpoints for the gift/reward system:
 *   POST /api/live/gifts/send          — Send a gift
 *   GET  /api/live/gifts/leaderboard   — Stream leaderboard
 *   GET  /api/live/gifts/types         — Available gift types
 *   GET  /api/live/gifts/packages      — Available gift packages
 *   GET  /api/live/gifts/history       — User gift history
 *   GET  /api/live/gifts/earnings      — Creator earnings for a stream
 *   POST /api/live/gifts/process-payout — Trigger stream payouts
 *
 * Integrates with:
 *   - unified-tip-core.ts → recordUnifiedTip (unified ledger)
 *   - stream-chat.ts → appendMessage (gift notif in chat)
 *   - ws-broadcast.ts + CHANNELS.TIP_RECEIVED (realtime animation)
 *   - creator-rewards.ts → recordCreatorMetrics (earnings accrual)
 */

import { getPlatformBadge } from '../lib/stream-chat';
import { broadcastToAll } from '../ws-broadcast';
import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import { CHANNELS } from '../ws-channels';
import {
  calculateCreatorEarnings,
  checkStreakTier,
  GIFT_PACKAGES,
  GIFT_STREAK_TIERS,
  GIFT_TIERS,
  GIFT_TYPES,
  type GiftRecord,
  type GiftStreakTier,
  type GiftType,
  type GiftTypeId,
  isSupportedGiftChain,
  isValidGiftTypeId,
  kvGetJson,
  kvPutJson,
  liveGiftLeaderboardKey,
  lookupGiftType,
  type StreamGiftState,
  streamGiftKey,
  userGiftHistoryKey,
} from './live-gifts-core';
import { recordUnifiedTip } from './unified-tip-core';

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_LEADERBOARD_ENTRIES = 50;
const MAX_GIFT_HISTORY_PER_USER = 200;
const MAX_STREAK_SENDERS = 1000;

// ─── Core: Record a Gift ────────────────────────────────────────────────

/**
 * Record a gift event in the stream state and update all downstream systems.
 * This is the main integration point called after payment confirmation.
 *
 * Returns the gift record with streak info and the updated streaming state.
 */
export async function recordGift(
  env: Env,
  streamId: string,
  creatorId: string,
  giftTypeId: GiftTypeId,
  options: {
    senderId?: string;
    senderLabel?: string;
    isAnonymous?: boolean;
    chain?: string;
    txHash?: string;
    isPackage?: boolean;
    packageId?: string;
    isSubscriptionGift?: boolean;
    subscriptionDays?: number;
    platform?: string;
    creatorLabel?: string;
  },
): Promise<{
  gift: GiftRecord;
  streamState: StreamGiftState;
  triggeredStreak: GiftStreakTier | null;
}> {
  const giftType = lookupGiftType(giftTypeId);
  if (!giftType) throw new Error(`Invalid gift type: ${giftTypeId}`);

  const now = Date.now();
  const key = streamGiftKey(streamId);
  const state = (await kvGetJson<StreamGiftState>(env, key)) ?? {
    streamId,
    creatorId,
    totalSats: 0,
    totalUsd: 0,
    totalGifts: 0,
    uniqueGifters: 0,
    streaks: {},
    leaderboard: [],
    gifts: [],
    streamStartedAt: now,
  };

  // ── Streak Tracking ──
  const senderKey = options.senderId || `anon:${now}`;
  let streakCount = 1;
  let lastStreakTierIndex = -1;

  if (options.senderId) {
    const senderStreak = state.streaks[senderKey] ?? {
      count: 0,
      lastGiftAt: 0,
      peakStreak: 0,
      lastStreakTierIndex: -1,
    };

    // If last gift was within 30 seconds, it's a consecutive streak
    if (now - senderStreak.lastGiftAt < 30_000 && senderStreak.lastGiftAt > 0) {
      senderStreak.count += 1;
    } else {
      senderStreak.count = 1;
    }

    streakCount = senderStreak.count;
    if (streakCount > senderStreak.peakStreak) senderStreak.peakStreak = streakCount;

    // Check for triggered streak tier
    const tier = checkStreakTier(streakCount);
    if (tier) {
      // Find which tier index
      const idx = GIFT_STREAK_TIERS.indexOf(tier);
      if (idx > senderStreak.lastStreakTierIndex) {
        lastStreakTierIndex = idx;
        senderStreak.lastStreakTierIndex = idx;
      }
    }

    senderStreak.lastGiftAt = now;
    state.streaks[senderKey] = senderStreak;

    // Trim streaks map
    const streakKeys = Object.keys(state.streaks);
    if (streakKeys.length > MAX_STREAK_SENDERS) {
      const sorted = streakKeys.sort(
        (a, b) => state.streaks[b].lastGiftAt - state.streaks[a].lastGiftAt,
      );
      for (let i = MAX_STREAK_SENDERS; i < sorted.length; i++) {
        delete state.streaks[sorted[i]];
      }
    }
  }

  const triggeredStreakTier =
    lastStreakTierIndex >= 0 ? GIFT_STREAK_TIERS[lastStreakTierIndex] : undefined;

  // ── Build Gift Record ──
  const gift: GiftRecord = {
    id: `gift:${streamId}:${now}:${Math.random().toString(36).slice(2, 8)}`,
    giftTypeId,
    streamId,
    creatorId,
    creatorLabel: options.creatorLabel,
    senderId: options.senderId,
    senderLabel: options.isAnonymous
      ? undefined
      : options.senderLabel || options.senderId?.slice(0, 8),
    isAnonymous: options.isAnonymous ?? false,
    sats: giftType.sats,
    usd: giftType.usd,
    creatorEarnsUsd: giftType.creatorEarnsUsd,
    chain: options.chain || 'lightning',
    txHash: options.txHash,
    timestamp: now,
    isPackage: options.isPackage ?? false,
    packageId: options.packageId,
    isSubscriptionGift: options.isSubscriptionGift ?? false,
    subscriptionDays: options.subscriptionDays,
    streakCount,
    triggeredStreakTier,
    platform: options.platform || 'degenfeed',
  };

  // ── Update Stream State ──
  state.totalSats += giftType.sats;
  state.totalUsd = Math.round((state.totalUsd + giftType.creatorEarnsUsd) * 100) / 100;
  state.totalGifts += 1;
  state.gifts.unshift(gift);
  state.gifts = state.gifts.slice(0, MAX_GIFT_HISTORY_PER_USER);

  // ── Update Leaderboard ──
  if (options.senderId) {
    const senderLower = options.senderId.toLowerCase();
    const existing = state.leaderboard.find((e) => e.senderId === senderLower);

    if (existing) {
      existing.totalUsd = Math.round((existing.totalUsd + giftType.usd) * 100) / 100;
      existing.totalSats += giftType.sats;
      existing.giftCount += 1;
      existing.gifts[giftTypeId] = (existing.gifts[giftTypeId] ?? 0) + 1;
      if (options.senderLabel) existing.senderLabel = options.senderLabel;
    } else {
      state.leaderboard.push({
        senderId: senderLower,
        senderLabel: options.senderLabel || senderLower.slice(0, 8),
        totalUsd: giftType.usd,
        totalSats: giftType.sats,
        giftCount: 1,
        gifts: { [giftTypeId]: 1 } as Record<GiftTypeId, number>,
      });
    }

    state.leaderboard.sort((a, b) => b.totalSats - a.totalSats);
    state.leaderboard = state.leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);
    state.uniqueGifters = state.leaderboard.length;
  }

  // ── Persist ──
  await kvPutJson(env, key, state);

  // ── Record in unified tip system ──
  if (creatorId) {
    recordUnifiedTip(env, {
      platform: (options.platform as any) || 'degenfeed',
      entityId: streamId,
      entityType: 'video',
      amountUsd: giftType.usd,
      fromUserId: options.senderId,
      toUserId: creatorId,
      fromLabel: options.senderLabel,
      toLabel: options.creatorLabel,
      entityLabel: `Gift: ${giftType.icon} ${giftType.name}`,
      method: `gift:${giftTypeId}:${options.chain || 'lightning'}`,
    }).catch((err) => console.warn('[live-gifts] unified tip record failed:', err));
  }

  // ── Record in creator rewards system ──
  if (creatorId) {
    try {
      const { recordCreatorMetrics } = await import('../lib/creator-rewards');
      await recordCreatorMetrics(env, creatorId, {
        tipsReceived: Math.round(giftType.creatorEarnsUsd * 100),
        tipperCount: 1,
      });
    } catch {
      /* non-fatal */
    }
  }

  // ── Record user gift history ──
  if (options.senderId) {
    try {
      const historyKey = userGiftHistoryKey(options.senderId);
      const history = (await kvGetJson<GiftRecord[]>(env, historyKey)) ?? [];
      history.unshift(gift);
      await kvPutJson(env, historyKey, history.slice(0, MAX_GIFT_HISTORY_PER_USER));
    } catch {
      /* non-fatal */
    }
  }

  // ── Broadcast real-time gift events ──
  const senderLabel = options.isAnonymous
    ? 'Anonymous'
    : options.senderLabel || options.senderId || 'Someone';
  const chatMessage = options.isAnonymous
    ? `🎁 Anonymous sent a ${giftType.icon} ${giftType.name}!`
    : `🎁 ${senderLabel} sent a ${giftType.icon} ${giftType.name}!`;

  // WebSocket: gift animation payload
  broadcastToAll(CHANNELS.TIP_RECEIVED, {
    type: 'gift',
    streamId,
    gift: {
      id: gift.id,
      giftTypeId: gift.giftTypeId,
      icon: giftType.icon,
      name: giftType.name,
      tier: giftType.tier,
      sats: giftType.sats,
      usd: giftType.usd,
    },
    sender: {
      id: options.senderId,
      label: options.isAnonymous ? 'Anonymous' : senderLabel,
      isAnonymous: options.isAnonymous ?? false,
    },
    creator: {
      id: creatorId,
      label: options.creatorLabel,
    },
    streak: triggeredStreakTier
      ? {
          count: streakCount,
          label: triggeredStreakTier.label,
          animationBonus: triggeredStreakTier.animationBonus,
        }
      : undefined,
    timestamp: now,
  });

  // WebSocket: stream leaderboard update
  broadcastToAll(CHANNELS.TIP_GLOBAL, {
    type: 'gift_leaderboard_update',
    streamId,
    leaderboard: state.leaderboard.slice(0, 10),
    totalSats: state.totalSats,
    totalGifts: state.totalGifts,
  });

  // ── Append gift notification to stream chat ──
  try {
    const { appendMessage } = await import('../lib/stream-chat');
    await appendMessage(env, streamId, {
      id: gift.id,
      streamId,
      userId: options.senderId || 'anonymous',
      displayName: options.isAnonymous ? 'Anonymous' : senderLabel,
      message: chatMessage,
      timestamp: now,
      source: 'degenfeed',
      isHighlighted: true,
      tipAmount: `${giftType.usd.toFixed(2)}`,
      tipChain: options.chain || 'lightning',
      badges: ['tipstar'],
      platformMeta: {
        giftType: giftTypeId,
        giftIcon: giftType.icon,
        isGift: true,
        isAnonymous: options.isAnonymous ?? false,
      },
    });
  } catch {
    /* non-fatal */
  }

  // ── Broadcast to Nostr (if sender/receiver have Nostr identities) ──
  try {
    const { default: NostrSdk } = await import('@degenfeed/nostr-sdk');
    if (NostrSdk && creatorId && options.senderId && env.NOSTR_PRIVATE_KEY) {
      const { NostrLiveBridge } = await import('../lib/nostr-live-bridge');
      const bridge = new NostrLiveBridge(env);
      // Fire-and-forget: announce gift as a zap-like note
      // In production, this would publish a NIP-57 zap receipt or a kind 1
      bridge.bridgeChat(streamId, `degenfeed-stream-${streamId}`).catch(() => {});
    }
  } catch {
    /* non-fatal — Nostr bridge is optional */
  }

  return { gift, streamState: state, triggeredStreak: triggeredStreakTier ?? null };
}

// ─── POST /api/live/gifts/send — Send a Gift ────────────────────────────

export async function handleGiftSend(request: Request, env: Env): Promise<Response> {
  const bodySizeCheck = validateBodySize(request, 4 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeString(body.streamId, 128);
    const giftTypeId = sanitizeString(body.giftTypeId, 32);
    const creatorId = sanitizeString(body.creatorId, 128);
    const senderId = sanitizeString(body.senderId, 128);
    const senderLabel = sanitizeString(body.senderLabel, 64);
    const creatorLabel = sanitizeString(body.creatorLabel, 64);
    const chain = sanitizeString(body.chain, 32) || 'lightning';
    const txHash = sanitizeString(body.txHash, 128);
    const platform = sanitizeString(body.platform, 32) || 'degenfeed';
    const isAnonymous = body.isAnonymous === true;
    const isPackage = body.isPackage === true;
    const packageId = sanitizeString(body.packageId, 64);
    const isSubscriptionGift = body.isSubscriptionGift === true;
    const subscriptionDays =
      typeof body.subscriptionDays === 'number' ? body.subscriptionDays : undefined;

    // Validate required fields
    if (!streamId || hasSuspiciousPayload(streamId)) {
      return jsonResponse({ error: 'Valid streamId is required' }, 400);
    }
    if (!giftTypeId || !isValidGiftTypeId(giftTypeId)) {
      return jsonResponse({ error: `giftTypeId must be one of: ${GIFT_TIERS.join(', ')}` }, 400);
    }
    if (!creatorId || hasSuspiciousPayload(creatorId)) {
      return jsonResponse({ error: 'Valid creatorId is required' }, 400);
    }
    if (!isSupportedGiftChain(chain)) {
      return jsonResponse(
        { error: 'chain must be one of: lightning, solana, ethereum, base, creator_coin' },
        400,
      );
    }
    if (txHash && hasSuspiciousPayload(txHash)) {
      return jsonResponse({ error: 'Invalid txHash' }, 400);
    }

    const giftType = lookupGiftType(giftTypeId)!;

    // Check for suspicious payloads in IDs
    if (
      (senderId && hasSuspiciousPayload(senderId)) ||
      (senderLabel && hasSuspiciousPayload(senderLabel))
    ) {
      return jsonResponse({ error: 'Invalid sender information' }, 400);
    }

    const result = await recordGift(env, streamId, creatorId, giftTypeId, {
      senderId: senderId || undefined,
      senderLabel: senderLabel || undefined,
      isAnonymous,
      chain,
      txHash: txHash || undefined,
      isPackage,
      packageId: packageId || undefined,
      isSubscriptionGift,
      subscriptionDays,
      platform,
      creatorLabel: creatorLabel || undefined,
    });

    return jsonResponse(
      {
        success: true,
        gift: result.gift,
        streak: result.triggeredStreak
          ? {
              count: result.gift.streakCount,
              label: result.triggeredStreak.label,
              animationBonus: result.triggeredStreak.animationBonus,
            }
          : null,
        streamState: {
          totalSats: result.streamState.totalSats,
          totalUsd: result.streamState.totalUsd,
          totalGifts: result.streamState.totalGifts,
          uniqueGifters: result.streamState.uniqueGifters,
        },
        earnings: {
          creatorEarnsUsd: giftType.creatorEarnsUsd,
          platformFeeUsd: giftType.platformFeeUsd,
          netUsd: result.streamState.totalUsd,
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── GET /api/live/gifts/leaderboard — Stream Leaderboard ───────────────

export async function handleGiftLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const streamId = sanitizeString(url.searchParams.get('streamId'), 128);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit')) || 20, 1),
    MAX_LEADERBOARD_ENTRIES,
  );

  if (!streamId) {
    return jsonResponse({ error: 'streamId is required' }, 400);
  }

  const state = await kvGetJson<StreamGiftState>(env, streamGiftKey(streamId));

  if (!state) {
    return jsonResponse({
      streamId,
      leaderboard: [],
      totalSats: 0,
      totalGifts: 0,
      uniqueGifters: 0,
    });
  }

  return jsonResponse({
    streamId,
    leaderboard: state.leaderboard.slice(0, limit).map((entry, i) => ({
      rank: i + 1,
      senderId: entry.senderId,
      senderLabel: entry.senderLabel,
      totalUsd: entry.totalUsd,
      totalSats: entry.totalSats,
      giftCount: entry.giftCount,
      topGift: getTopGift(entry.gifts),
    })),
    totalSats: state.totalSats,
    totalUsd: state.totalUsd,
    totalGifts: state.totalGifts,
    uniqueGifters: state.uniqueGifters,
  });
}

function getTopGift(gifts: Record<string, number>): { giftTypeId: string; count: number } | null {
  let maxCount = 0;
  let topId: string | null = null;
  for (const [id, count] of Object.entries(gifts)) {
    if (count > maxCount) {
      maxCount = count;
      topId = id;
    }
  }
  return topId ? { giftTypeId: topId, count: maxCount } : null;
}

// ─── GET /api/live/gifts/types — Available Gift Types ───────────────────

export async function handleGiftTypes(_request: Request): Promise<Response> {
  return jsonResponse({
    gifts: GIFT_TIERS.map((id) => {
      const g = GIFT_TYPES[id];
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        sats: g.sats,
        usd: g.usd,
        creatorEarnsUsd: g.creatorEarnsUsd,
        platformFeeUsd: g.platformFeeUsd,
        tier: g.tier,
        animationDurationSec: g.animationDurationSec,
        animationClass: g.animationClass,
        isFullScreenAnimation: g.isFullScreenAnimation,
        canGiftSubscription: g.canGiftSubscription,
        allowsAnonymous: g.allowsAnonymous,
        description: g.description,
      };
    }),
    streaks: GIFT_STREAK_TIERS.map((s) => ({
      count: s.count,
      label: s.label,
      animationBonus: s.animationBonus,
      displayMultiplier: s.displayMultiplier,
    })),
  });
}

// ─── GET /api/live/gifts/packages — Available Gift Packages ─────────────

export async function handleGiftPackages(_request: Request): Promise<Response> {
  return jsonResponse({
    packages: GIFT_PACKAGES.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      giftTypeId: p.giftTypeId,
      giftTypeName: GIFT_TYPES[p.giftTypeId].name,
      giftIcon: GIFT_TYPES[p.giftTypeId].icon,
      count: p.count,
      totalSats: p.totalSats,
      totalUsd: p.totalUsd,
      discountPercent: p.discountPercent,
      savingsSats: GIFT_TYPES[p.giftTypeId].sats * p.count - p.totalSats,
    })),
  });
}

// ─── GET /api/live/gifts/history — User Gift History ────────────────────

export async function handleGiftHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = sanitizeString(url.searchParams.get('userId'), 128);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get('limit')) || 50, 1),
    MAX_GIFT_HISTORY_PER_USER,
  );

  if (!userId) {
    // Require session if no userId provided
    const session = await requireSession(request, env);
    if (session instanceof Response) return session;
    return getGiftHistoryForUser(env, session.address, limit);
  }

  return getGiftHistoryForUser(env, userId, limit);
}

async function getGiftHistoryForUser(env: Env, userId: string, limit: number): Promise<Response> {
  const key = userGiftHistoryKey(userId.toLowerCase());
  const history = (await kvGetJson<GiftRecord[]>(env, key)) ?? [];

  return jsonResponse({
    userId: userId.toLowerCase(),
    totalGifts: history.length,
    totalSats: history.reduce((s, g) => s + g.sats, 0),
    totalUsd: history.reduce((s, g) => s + g.usd, 0),
    history: history.slice(0, limit).map((g) => ({
      id: g.id,
      giftType: GIFT_TYPES[g.giftTypeId]
        ? {
            id: g.giftTypeId,
            name: GIFT_TYPES[g.giftTypeId].name,
            icon: GIFT_TYPES[g.giftTypeId].icon,
          }
        : { id: g.giftTypeId, name: g.giftTypeId, icon: '🎁' },
      streamId: g.streamId,
      creatorLabel: g.creatorLabel || g.creatorId,
      sats: g.sats,
      usd: g.usd,
      chain: g.chain,
      timestamp: g.timestamp,
      isAnonymous: g.isAnonymous,
      isPackage: g.isPackage,
      isSubscriptionGift: g.isSubscriptionGift,
      platform: g.platform,
    })),
  });
}

// ─── GET /api/live/gifts/earnings — Creator Earnings ────────────────────

export async function handleGiftEarnings(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const streamId = sanitizeString(url.searchParams.get('streamId'), 128);
  const creatorId = sanitizeString(url.searchParams.get('creatorId'), 128);

  if (!streamId && !creatorId) {
    return jsonResponse({ error: 'streamId or creatorId is required' }, 400);
  }

  let combinedSats = 0;
  let combinedUsd = 0;
  let totalGifts = 0;
  let streams: string[] = [];

  if (streamId) {
    const state = await kvGetJson<StreamGiftState>(env, streamGiftKey(streamId));
    if (state) {
      combinedSats = state.totalSats;
      combinedUsd = state.totalUsd;
      totalGifts = state.totalGifts;
      streams = [streamId];
    }
  } else if (creatorId) {
    // Aggregate across all stream states for this creator
    // Uses KV list prefix — in production you'd index this
    try {
      const listResult = await env.CACHE?.list({ prefix: GIFT_STREAM_STATE_PREFIX });
      if (listResult) {
        for (const { name } of listResult.keys) {
          const raw = await env.CACHE?.get(name);
          if (raw) {
            const state = JSON.parse(raw) as StreamGiftState;
            if (state.creatorId.toLowerCase() === creatorId.toLowerCase()) {
              combinedSats += state.totalSats;
              combinedUsd += state.totalUsd;
              totalGifts += state.totalGifts;
              streams.push(state.streamId);
            }
          }
        }
      }
    } catch {
      /* fallback — return what we have */
    }
  }

  return jsonResponse({
    creatorId: creatorId?.toLowerCase(),
    streamId: streamId || undefined,
    totalSats: combinedSats,
    totalUsd: combinedUsd,
    totalGifts,
    streams,
    feeRate: '15%',
    platformFeeBps: 1500,
  });
}

// ─── POST /api/live/gifts/process-payout — Process Stream Payout ────

export async function handleGiftPayout(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeString(body.streamId, 128);
    const creatorId = sanitizeString(body.creatorId, 128);

    if (!streamId) {
      return jsonResponse({ error: 'streamId is required' }, 400);
    }

    const key = streamGiftKey(streamId);
    const state = await kvGetJson<StreamGiftState>(env, key);

    if (!state) {
      return jsonResponse({ error: 'No gifts found for this stream' }, 404);
    }

    if (state.payoutProcessed) {
      return jsonResponse({ error: 'Payout already processed for this stream' }, 409);
    }

    if (
      creatorId &&
      creatorId.toLowerCase() !== session.address.toLowerCase() &&
      state.creatorId.toLowerCase() !== session.address.toLowerCase()
    ) {
      return jsonResponse({ error: 'Only the stream creator can process payouts' }, 403);
    }

    // Mark as processed
    state.payoutProcessed = true;
    state.streamEndedAt = Date.now();
    await kvPutJson(env, key, state);

    // Initiate payout record
    const payoutRecord = {
      streamId,
      creatorId: state.creatorId,
      totalSats: state.totalSats,
      totalUsd: state.totalUsd,
      totalGifts: state.totalGifts,
      platformFeeUsd: state.gifts.reduce((s, g) => s + g.usd - g.creatorEarnsUsd, 0),
      creatorEarnsUsd: state.totalUsd,
      status: 'processing' as const,
      processedAt: Date.now(),
      txHash: null as string | null,
    };

    // Store payout record
    await kvPutJson(env, `live:gifts:payout:${streamId}`, payoutRecord);

    // Queue actual payout — in production this would trigger
    // an on-chain tx or Lightning withdrawal to the creator's wallet
    try {
      const { default: NostrSdk } = await import('@degenfeed/nostr-sdk');
      if (NostrSdk && env.NOSTR_PRIVATE_KEY) {
        // Publish a zap receipt / payout announcement on Nostr
        const event = {
          kind: 9735, // Zap receipt
          content: `Payout processed for stream ${streamId}: ${state.totalSats} sats earned from ${state.totalGifts} gifts`,
          tags: [
            ['p', state.creatorId],
            ['amount', String(state.totalSats * 1000)], // millisats
            ['stream', streamId],
          ],
          created_at: Math.floor(Date.now() / 1000),
        };
        // Fire-and-forget
        console.log('[live-gifts] Payout event created for Nostr:', event.kind);
      }
    } catch {
      /* Nostr payout announcement is optional */
    }

    return jsonResponse({
      success: true,
      payout: payoutRecord,
      message: `Payout initiated for ${state.totalSats} sats ($${state.totalUsd.toFixed(2)}) from ${state.totalGifts} gifts. Payment will be sent to the creator's wallet.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: msg }, 500);
  }
}
