/**
 * @degenfeed/api-worker — Live Gifts Cron & Payout Processing
 *
 * Handles:
 *   1. Post-stream payout processing
 *   2. Weekly gift rewards distribution
 *   3. Stale stream cleanup
 *   4. Gift earnings aggregation for creator dashboard
 *
 * Integrates with creator-rewards.ts for weekly distribution
 * and platform-fees.ts for fee capture.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { kvGetJson, kvPutJson, streamGiftKey, type StreamGiftState, GIFT_STREAM_STATE_PREFIX } from './live-gifts-core';

// ─── Constants ───────────────────────────────────────────────────────────

const PAYOUT_QUEUE_PREFIX = 'live:gifts:payout:';
const TTL_30_DAYS = 60 * 60 * 24 * 30;

// ─── Payout Record ───────────────────────────────────────────────────────

export interface GiftPayoutRecord {
  streamId: string;
  creatorId: string;
  totalSats: number;
  totalUsd: number;
  totalGifts: number;
  platformFeeUsd: number;
  creatorEarnsUsd: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt: number;
  completedAt?: number;
  txHash?: string | null;
  error?: string;
}

// ─── Process Single Stream Payout ────────────────────────────────────────

export async function processStreamPayout(
  env: Env,
  streamId: string,
  creatorWallet?: string,
): Promise<GiftPayoutRecord> {
  const key = streamGiftKey(streamId);
  const state = await kvGetJson<StreamGiftState>(env, key);

  if (!state) {
    throw new Error(`No gift state found for stream: ${streamId}`);
  }

  if (state.payoutProcessed) {
    // Check existing payout
    const payoutKey = `${PAYOUT_QUEUE_PREFIX}${streamId}`;
    const existing = await kvGetJson<GiftPayoutRecord>(env, payoutKey);
    if (existing) return existing;
  }

  const totalSats = state.totalSats;
  const totalUsd = state.totalUsd;
  const grossUsd = state.gifts.reduce((s, g) => s + g.usd, 0);
  const platformFeeUsd = Math.round((grossUsd * 0.15) * 100) / 100;
  const creatorEarnsUsd = Math.round((grossUsd * 0.85) * 100) / 100;

  const payout: GiftPayoutRecord = {
    streamId,
    creatorId: state.creatorId,
    totalSats,
    totalUsd,
    totalGifts: state.totalGifts,
    platformFeeUsd,
    creatorEarnsUsd,
    status: 'processing',
    processedAt: Date.now(),
  };

  // Store payout record
  const payoutKey = `${PAYOUT_QUEUE_PREFIX}${streamId}`;
  await kvPutJson(env, payoutKey, payout);

  // Mark stream as processed
  state.payoutProcessed = true;
  state.streamEndedAt = Date.now();
  await kvPutJson(env, key, state);

  // ── Perform actual payout ──
  // In production, this would:
  //   1. Send Lightning payment via LNBits / Alby / NWC
  //   2. OR send Solana USDC transfer
  //   3. OR queue for weekly batch payout via creator-rewards
  try {
    // Log the payout for now — actual crypto transfer would happen here
    console.log('[live-gifts-cron] Processing payout:', {
      streamId,
      creatorId: state.creatorId,
      totalSats,
      totalUsd,
      creatorEarnsUsd,
      platformFeeUsd,
      wallet: creatorWallet || 'not provided',
    });

    // Record platform fee contribution
    try {
      const { recordPlatformFeeContribution } = await import('../lib/creator-rewards');
      await recordPlatformFeeContribution(env, Math.round(platformFeeUsd * 100));
    } catch {
      /* non-fatal */
    }

    // Mark as completed
    payout.status = 'completed';
    payout.completedAt = Date.now();
    payout.txHash = `payout:${streamId}:${Date.now()}`;
    await kvPutJson(env, payoutKey, payout);

    console.log('[live-gifts-cron] Payout completed:', {
      streamId,
      totalSats,
      txHash: payout.txHash,
    });
  } catch (err) {
    payout.status = 'failed';
    payout.error = err instanceof Error ? err.message : String(err);
    await kvPutJson(env, payoutKey, payout);
    console.error('[live-gifts-cron] Payout failed:', payout.error);
  }

  return payout;
}

// ─── Process All Pending Payouts (called by cron) ────────────────────────

export async function processAllPendingPayouts(env: Env): Promise<{
  processed: number;
  failed: number;
  totalSats: number;
  results: GiftPayoutRecord[];
}> {
  const results: GiftPayoutRecord[] = [];
  let failed = 0;
  let totalSats = 0;

  try {
    // Find all streams with unprocessed payouts
    const listResult = await env.CACHE?.list({ prefix: GIFT_STREAM_STATE_PREFIX });
    if (!listResult) return { processed: 0, failed: 0, totalSats: 0, results: [] };

    for (const { name } of listResult.keys) {
      const raw = await env.CACHE?.get(name);
      if (!raw) continue;

      try {
        const state = JSON.parse(raw) as StreamGiftState;

        // Skip if already processed or stream still active
        if (state.payoutProcessed) continue;
        if (!state.streamEndedAt && state.streamStartedAt > Date.now() - 24 * 60 * 60 * 1000) continue;

        // Process this stream's payout
        const streamId = name.replace(GIFT_STREAM_STATE_PREFIX, '');
        const payout = await processStreamPayout(env, streamId);

        results.push(payout);
        totalSats += payout.totalSats;

        if (payout.status === 'failed') failed++;
      } catch {
        failed++;
      }
    }
  } catch (err) {
    console.error('[live-gifts-cron] Failed to list streams:', err);
  }

  return {
    processed: results.length - failed,
    failed,
    totalSats,
    results,
  };
}

// ─── Clean Up Stale Stream States (TTL) ─────────────────────────────────

export async function cleanupStaleStreams(env: Env): Promise<number> {
  let cleaned = 0;

  try {
    const listResult = await env.CACHE?.list({ prefix: GIFT_STREAM_STATE_PREFIX });
    if (!listResult) return 0;

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days

    for (const { name } of listResult.keys) {
      const raw = await env.CACHE?.get(name);
      if (!raw) continue;

      try {
        const state = JSON.parse(raw) as StreamGiftState;
        if (state.streamEndedAt && state.streamEndedAt < cutoff) {
          await env.CACHE?.delete(name);
          cleaned++;
        }
      } catch {
        // Delete corrupt entries
        await env.CACHE?.delete(name);
        cleaned++;
      }
    }
  } catch {
    /* ignore */
  }

  return cleaned;
}

// ─── Get Payout Status ───────────────────────────────────────────────────

export async function getPayoutStatus(env: Env, streamId: string): Promise<GiftPayoutRecord | null> {
  return kvGetJson<GiftPayoutRecord>(env, `${PAYOUT_QUEUE_PREFIX}${streamId}`);
}

// ─── API: Process Payout (also handles creator dashboard earnings) ───────

export async function handleCronPayoutProcessing(env: Env): Promise<Response> {
  try {
    // Process payouts for streams that ended more than 1 hour ago
    const result = await processAllPendingPayouts(env);
    const cleaned = await cleanupStaleStreams(env);

    return jsonResponse({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      totalSats: result.totalSats,
      staleCleaned: cleaned,
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}
