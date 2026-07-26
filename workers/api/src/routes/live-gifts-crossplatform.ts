/**
 * @degenfeed/api-worker — Cross-Platform Gift Receivers
 *
 * Receives gifts from external platforms and records them in the
 * DegenFeed gift system. Gifts work regardless of which platform
 * the viewer is watching from:
 *
 *   - Farcaster viewer → Farcaster frame action → gift recorded
 *   - Nostr viewer     → NIP-57 zap → gift animation → creator earns
 *   - Bluesky viewer   → Bluesky tip → gift → creator earns
 *   - Lens viewer      → Lens tip → gift
 *
 * All unified in the same gift state and creator earnings dashboard.
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';
import { type GiftTypeId, isValidGiftTypeId } from './live-gifts-core';
import { recordGift } from './live-gifts-handlers';

// ─── NIP-57 Zap Receipt Handler (Nostr) ─────────────────────────────────

/**
 * POST /api/live/gifts/nostr-zap
 *
 * Called when a Nostr zap (NIP-57) receipt is received for a stream.
 * Parses the zap amount, maps it to the closest gift type, and records it.
 *
 * The zap sender sees the gift animation and chat notification
 * just like a native DegenFeed gift sender.
 */
export async function handleNostrZapGift(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeString(body.streamId, 128);
    const creatorId = sanitizeString(body.creatorId, 128);
    const creatorLabel = sanitizeString(body.creatorLabel, 64);

    // Nostr-specific fields
    const eventId = sanitizeString(body.eventId, 128);
    const pubkey = sanitizeString(body.pubkey, 128);
    const npub = sanitizeString(body.npub, 128);
    const amountMsats = typeof body.amountMsats === 'number' ? body.amountMsats : 0;
    const zapContent = sanitizeString(body.content, 256);

    if (!streamId || !creatorId || !eventId) {
      return jsonResponse({ error: 'streamId, creatorId, and eventId required' }, 400);
    }

    if (amountMsats <= 0) {
      return jsonResponse({ error: 'amountMsats must be positive' }, 400);
    }

    // Convert msats to sats
    const amountSats = Math.floor(amountMsats / 1000);

    // Map zap amount to closest gift type
    const giftTypeId = mapSatsToGiftType(amountSats);

    const senderLabel =
      sanitizeString(body.senderLabel, 64) || npub?.slice(0, 12) || pubkey?.slice(0, 8);

    // Record the gift
    const result = await recordGift(env, streamId, creatorId, giftTypeId, {
      senderId: pubkey || undefined,
      senderLabel: senderLabel || undefined,
      chain: 'lightning',
      txHash: eventId,
      platform: 'nostr',
      creatorLabel: creatorLabel || undefined,
    });

    return jsonResponse(
      {
        success: true,
        platform: 'nostr',
        amountSats,
        mappedGift: {
          id: result.gift.giftTypeId,
          name: result.gift.giftTypeId,
          icon: '⚡',
          sats: result.gift.sats,
        },
        zapContent,
        gift: result.gift,
      },
      201,
    );
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Farcaster Frame Gift Handler ───────────────────────────────────────

/**
 * POST /api/live/gifts/farcaster
 *
 * Called from a Farcaster Frame action when a viewer sends a gift
 * via a Farcaster-compatible frame.
 */
export async function handleFarcasterGift(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeString(body.streamId, 128);
    const creatorId = sanitizeString(body.creatorId, 128);
    const giftTypeId = sanitizeString(body.giftTypeId, 32);
    const fid = typeof body.fid === 'number' ? body.fid : 0;
    const username = sanitizeString(body.username, 64);
    const txHash = sanitizeString(body.txHash, 128);
    const creatorLabel = sanitizeString(body.creatorLabel, 64);

    if (!streamId || !creatorId || !giftTypeId || !isValidGiftTypeId(giftTypeId)) {
      return jsonResponse({ error: 'streamId, creatorId, giftTypeId required' }, 400);
    }

    const result = await recordGift(env, streamId, creatorId, giftTypeId as GiftTypeId, {
      senderId: fid ? `farcaster:fid:${fid}` : undefined,
      senderLabel: username || undefined,
      chain: 'ethereum',
      txHash: txHash || undefined,
      platform: 'farcaster',
      creatorLabel: creatorLabel || undefined,
    });

    return jsonResponse(
      {
        success: true,
        platform: 'farcaster',
        fid,
        gift: result.gift,
      },
      201,
    );
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Bluesky Gift Handler ───────────────────────────────────────────────

/**
 * POST /api/live/gifts/bluesky
 *
 * Called when a Bluesky viewer sends a tip that should be
 * converted into a gift.
 */
export async function handleBlueskyGift(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const streamId = sanitizeString(body.streamId, 128);
    const creatorId = sanitizeString(body.creatorId, 128);
    const did = sanitizeString(body.did, 128);
    const handle = sanitizeString(body.handle, 64);
    const amountUsd = typeof body.amountUsd === 'number' ? body.amountUsd : 0;
    const creatorLabel = sanitizeString(body.creatorLabel, 64);

    if (!streamId || !creatorId || amountUsd <= 0) {
      return jsonResponse({ error: 'streamId, creatorId, amountUsd required' }, 400);
    }

    // Map USD amount to closest gift type
    const giftTypeId = mapUsdToGiftType(amountUsd);

    const result = await recordGift(env, streamId, creatorId, giftTypeId, {
      senderId: did || undefined,
      senderLabel: handle || undefined,
      chain: 'ethereum',
      platform: 'bluesky',
      creatorLabel: creatorLabel || undefined,
    });

    return jsonResponse(
      {
        success: true,
        platform: 'bluesky',
        did,
        amountUsd,
        mappedGift: {
          id: result.gift.giftTypeId,
          name: result.gift.giftTypeId,
          icon: '☁️',
        },
        gift: result.gift,
      },
      201,
    );
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// ─── Gift Type Mapping ──────────────────────────────────────────────────

const TIERED_GIFTS: Array<{ id: GiftTypeId; sats: number; usd: number }> = [
  { id: 'rose', sats: 100, usd: 0.03 },
  { id: 'balloon', sats: 500, usd: 0.15 },
  { id: 'diamond', sats: 5_000, usd: 1.5 },
  { id: 'rocket', sats: 10_000, usd: 3.0 },
  { id: 'crown', sats: 50_000, usd: 15.0 },
  { id: 'whale', sats: 100_000, usd: 30.0 },
];

function mapSatsToGiftType(sats: number): GiftTypeId {
  // Find the closest gift type by sats amount (prefer lower if between tiers)
  let best: GiftTypeId = 'rose';
  let bestDiff = Infinity;

  for (const gift of TIERED_GIFTS) {
    const diff = Math.abs(sats - gift.sats);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = gift.id;
    }
  }

  return best;
}

function mapUsdToGiftType(usd: number): GiftTypeId {
  let best: GiftTypeId = 'rose';
  let bestDiff = Infinity;

  for (const gift of TIERED_GIFTS) {
    const diff = Math.abs(usd - gift.usd);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = gift.id;
    }
  }

  return best;
}
